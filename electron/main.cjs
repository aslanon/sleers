const {
	app,
	BrowserWindow,
	session,
	desktopCapturer,
	ipcMain,
	Menu,
	nativeImage,
	protocol,
	screen,
	dialog,
	net,
} = require("electron");
const path = require("path");
const fs = require("fs");
const isDev = process.env.NODE_ENV === "development";
const waitOn = require("wait-on");
const ffmpeg = require("fluent-ffmpeg");
const { uIOhook } = require("uiohook-napi");
const express = require("express");
const http = require("http");
const os = require("os");

// Top level olarak protokolleri kaydet (app.whenReady() önce çağrılmalı)
protocol.registerSchemesAsPrivileged([
	{
		scheme: "electron",
		privileges: {
			secure: true,
			standard: true,
			bypassCSP: true,
			allowServiceWorkers: true,
			supportFetchAPI: true,
			corsEnabled: true,
			stream: true,
		},
	},
	{
		scheme: "file",
		privileges: {
			secure: true,
			standard: true,
			bypassCSP: true,
			allowServiceWorkers: true,
			supportFetchAPI: true,
			corsEnabled: true,
			stream: true,
		},
	},
]);

const { IPC_EVENTS } = require("./constants.cjs");
const TrayManager = require("./trayManager.cjs");
const CameraManager = require("./cameraManager.cjs");
const EditorManager = require("./editorManager.cjs");
const SelectionManager = require("./selectionManager.cjs");
const TempFileManager = require("./tempFileManager.cjs");
const MediaStateManager = require("./mediaStateManager.cjs");
const DockManager = require("./dockManager.cjs");
const PortManager = require("./portManager.cjs");

// Express ve HTTP server değişkenleri
let expressApp = null;
let httpServer = null;
let portManager = new PortManager();

let mainWindow = null;
let trayManager = null;
let cameraManager = null;
let selectionManager = null;
let editorManager = null;
let tempFileManager = null;
let mediaStateManager = null;
let dockManager = null;
let editorSettings = {
	camera: {
		followMouse: true,
	},
};

// Pencere sürükleme için değişkenler
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let mousePosition = { x: 0, y: 0 };

// Mouse tracking için değişkenler
let isTracking = false;
let startTime = null;
let lastCursorType = "default";
let currentSystemCursor = "default"; // Sistemden alınan cursor tipi
// Delay yönetimi için state
let recordingDelay = 1000; // Varsayılan 1sn

// Kaynak ayarları için state
let recordingSource = {
	sourceType: "display",
	sourceId: null,
	sourceName: null,
};

// Not: MacRecorder fallback kodu kaldırıldı - sadece direkt MacRecorder kullanıyoruz

// UPDATE_EDITOR_SETTINGS
ipcMain.on(IPC_EVENTS.UPDATE_EDITOR_SETTINGS, (event, settings) => {
	editorSettings = {
		...editorSettings,
		...settings,
	};
});

// Kaydedilen handler'ları takip etmek için bir set oluşturalım
const registeredHandlers = new Set();

// Safe handle fonksiyonu, her handler için bir kez register etmemizi sağlar
function safeHandle(channel, handler) {
	if (registeredHandlers.has(channel)) {
		console.log(`[Main] Handler zaten kayıtlı, atlanıyor: ${channel}`);
		return;
	}

	try {
		ipcMain.handle(channel, handler);
		registeredHandlers.add(channel);
		console.log(`[Main] Handler başarıyla kaydedildi: ${channel}`);
	} catch (error) {
		console.error(`[Main] Handler kaydedilirken hata: ${channel}`, error);
	}
}

// Global MacRecorder instance - tek bir instance kullanacağız
let globalMacRecorder = null;

// MacRecorder instance getter
function getMacRecorderInstance() {
	if (!globalMacRecorder) {
		const MacRecorder = require("node-mac-recorder");
		globalMacRecorder = new MacRecorder();
	}
	return globalMacRecorder;
}

safeHandle(IPC_EVENTS.GET_EDITOR_SETTINGS, () => {
	return editorSettings;
});

// IPC handlers'a eklenecek
ipcMain.on(IPC_EVENTS.UPDATE_RECORDING_DELAY, (event, delay) => {
	recordingDelay = delay;
});

safeHandle(IPC_EVENTS.GET_RECORDING_DELAY, () => {
	return recordingDelay;
});

// Dock ikonları artık doğrudan dockManager.cjs içinde işleniyor
// PROCESS_DOCK_ICONS handler'ı kaldırıldı

safeHandle(IPC_EVENTS.GET_DOCK_ITEMS, async () => {
	try {
		console.log("[Main] Getting dock items...");
		if (dockManager) {
			const items = await dockManager.getDockItems();
			console.log(`[Main] Found ${items.length} dock items`);
			return items;
		}
		console.log("[Main] DockManager not initialized");
		return [];
	} catch (error) {
		console.error("[Main] Error getting dock items:", error);
		return [];
	}
});

// İzin durumlarını kontrol eden handler ekle
safeHandle(IPC_EVENTS.CHECK_PERMISSIONS, async () => {
	return await checkPermissionStatus();
});

// İzin isteme handler'ı ekle
safeHandle(IPC_EVENTS.REQUEST_PERMISSION, async (event, permissionType) => {
	if (process.platform !== "darwin") {
		return true; // macOS dışındaki platformlarda izin zaten var kabul ediyoruz
	}

	try {
		const { systemPreferences } = require("electron");
		if (permissionType === "camera" || permissionType === "microphone") {
			const granted = await systemPreferences.askForMediaAccess(permissionType);
			console.log(`[Main] ${permissionType} izni istendi, sonuç:`, granted);
			return granted;
		}
		return false; // Ekran kaydı izni programatik olarak istenemez
	} catch (error) {
		console.error(`[Main] ${permissionType} izni istenirken hata:`, error);
		return false;
	}
});

// Sistem ayarlarını açma handler'ı
ipcMain.on(IPC_EVENTS.OPEN_SYSTEM_PREFERENCES, () => {
	if (process.platform === "darwin") {
		// macOS için Gizlilik ve Güvenlik ayarlarını aç
		const { shell } = require("electron");
		shell.openExternal(
			"x-apple.systempreferences:com.apple.preference.security?Privacy"
		);
	}
});

// Editör modunu açan fonksiyon
function openEditorMode() {
	console.log("[Main] Editör modu doğrudan açılıyor...");

	// Kamera penceresini kapat - kesin olarak kapanmasını sağlayalım
	if (cameraManager) {
		console.log("[Main] Kamera penceresi kapatılıyor...");
		// Önce stopCamera() ile stream'i durdur
		cameraManager.stopCamera();

		// Kamera penceresinin tam olarak kapandığından emin olmak için
		try {
			if (
				cameraManager.cameraWindow &&
				!cameraManager.cameraWindow.isDestroyed()
			) {
				cameraManager.cameraWindow.hide();
				console.log("[Main] Kamera penceresi gizlendi");
			}
		} catch (err) {
			console.error("[Main] Kamera penceresi gizlenirken hata:", err);
		}
	}

	// Editör penceresini aç
	if (editorManager) {
		editorManager.createEditorWindow();
	}

	// Ana pencereyi gizle
	if (mainWindow && !mainWindow.isDestroyed()) {
		mainWindow.hide();
	}
}

// Editörden kayıt moduna geçişi yöneten fonksiyon
function handleEditorToRecordTransition() {
	console.log("[Main] Editörden kayıt moduna geçiliyor...");

	// State'i sıfırla
	if (mediaStateManager) {
		mediaStateManager.resetState();
	}

	// Kamerayı açma işlemini setTimeout ile geciktirelim (güvenilirlik için)
	setTimeout(() => {
		if (cameraManager) {
			console.log("[Main] Kamera penceresi açılıyor... (200ms gecikme ile)");
			cameraManager.resetForNewRecording();
		}

		// Ana pencereyi göster
		if (mainWindow && !mainWindow.isDestroyed()) {
			console.log("[Main] Ana pencere gösteriliyor...");
			mainWindow.show();
		}
	}, 200); // 200ms gecikme
}

// MacRecorder modülü için handler'lar

safeHandle(
	IPC_EVENTS.START_MAC_RECORDING,
	async (event, outputPath, options) => {
		try {
			console.log("[Main] MacRecorder kaydı başlatılıyor...", {
				outputPath,
				options: JSON.stringify(options, null, 2),
				recordingSource: JSON.stringify(recordingSource, null, 2),
			});

			if (!outputPath) {
				console.error("[Main] Çıktı dosya yolu belirtilmedi");
				return false;
			}

			// MacRecorder'ın sadece macOS'ta çalıştığını kontrol et
			if (process.platform !== "darwin") {
				console.error("[Main] MacRecorder sadece macOS'ta çalışır");
				return false;
			}

			// MacRecorder instance al
			const recorder = getMacRecorderInstance();
			console.log("[Main] MacRecorder instance alındı");

			// kaynak bilgisini options'a ekle, eğer recordingSource.sourceId varsa
			if (recordingSource && recordingSource.sourceId) {
				// Pencere kaynağı seçilmişse uyarı verelim
				if (recordingSource.sourceType === "window") {
					console.log(
						"[Main] Pencere kaynağı seçildi, MacRecorder hem ekran hem pencere destekler."
					);
					// Pencere kaynağını da options'a ekleyelim
				}

				options.sourceId = recordingSource.sourceId;
				options.sourceType = recordingSource.sourceType; // sourceType bilgisini de ekle

				console.log("[Main] RecordingSource'dan bilgiler eklendi:", {
					sourceId: recordingSource.sourceId,
					sourceType: recordingSource.sourceType,
				});
			}

			// MacRecorder ID varsa doğrudan kullan (daha öncelikli)
			if (recordingSource && recordingSource.macRecorderId) {
				const macRecorderId = parseInt(recordingSource.macRecorderId, 10);
				if (!isNaN(macRecorderId)) {
					options.sourceId = macRecorderId; // Doğrudan sayısal ID kullan
					console.log(
						"[Main] RecordingSource'dan macRecorderId eklendi:",
						macRecorderId,
						"(önceden dönüştürülmüş)"
					);
				}
			}

			// Kırpma alanı bilgisini kontrol et
			if (mediaStateManager && mediaStateManager.state.selectedArea) {
				const selectedArea = mediaStateManager.state.selectedArea;

				// Geçerli bir kırpma alanı varsa ekle
				if (
					selectedArea &&
					typeof selectedArea.x === "number" &&
					typeof selectedArea.y === "number" &&
					typeof selectedArea.width === "number" &&
					typeof selectedArea.height === "number" &&
					selectedArea.width > 0 &&
					selectedArea.height > 0
				) {
					console.log("[Main] Kırpma alanı bilgisi ekleniyor:", selectedArea);

					// MacRecorder kayıt seçeneklerine cropArea bilgisini ekle
					options.cropArea = {
						x: Math.round(selectedArea.x),
						y: Math.round(selectedArea.y),
						width: Math.round(selectedArea.width),
						height: Math.round(selectedArea.height),
					};

					// Aspect ratio bilgisi varsa dönüşüm için ekle
					if (selectedArea.aspectRatio && selectedArea.aspectRatio !== "free") {
						options.cropArea.aspectRatio = selectedArea.aspectRatio;

						if (selectedArea.aspectRatioValue) {
							options.cropArea.aspectRatioValue = selectedArea.aspectRatioValue;
						}
					}
				}
			}

			// macOS'ta ses izinlerini kontrol et
			if (process.platform === "darwin") {
				console.log("[Main] macOS için ses kaydı izinleri kontrol ediliyor...");
				try {
					// SystemPreferences modülünü yükle
					const { systemPreferences } = require("electron");

					// Mikrofon izni kontrolü
					const microphoneStatus =
						systemPreferences.getMediaAccessStatus("microphone");
					console.log("[Main] Mikrofon erişim durumu:", microphoneStatus);

					// Mikrofon izni yoksa, kullanıcıya bilgi mesajı göster
					if (
						microphoneStatus !== "granted" &&
						options.audio?.captureDeviceAudio
					) {
						console.warn(
							"[Main] Mikrofon erişim izni verilmemiş. Ses kaydı yapılamayabilir."
						);
						// İzin istemeyi dene
						systemPreferences
							.askForMediaAccess("microphone")
							.then((granted) => {
								console.log("[Main] Mikrofon erişimi istendi, sonuç:", granted);
							})
							.catch((err) => {
								console.error("[Main] Mikrofon erişimi isterken hata:", err);
							});
					}

					// Sistem sesi için ekran yakalama izinlerini kontrol et
					if (options.audio?.captureSystemAudio) {
						console.log(
							"[Main] Sistem sesi için ekran yakalama izinleri gerekli olabilir"
						);
					}
				} catch (permissionError) {
					console.warn(
						"[Main] Ses izinleri kontrol edilirken hata:",
						permissionError
					);
				}
			}

			// MacRecorder devre dışı - crash nedeniyle
			console.log(
				"[Main] ✅ MacRecorder etkin - cursor capture kapalı (uiohook devre dışı)"
			);
			// console.log("[Main] Ekran kaydı şu anda kullanılamıyor");
			// return false; // devre dışı bırakıldı, MacRecorder aktif

			// MacRecorder instance'ı kontrol et
			const macRecorder = getMacRecorderInstance();

			// Ekranları ve ses cihazlarını kontrol et
			try {
				console.log("[Main] Kullanılabilir ekranlar kontrol ediliyor");
				const screens = await macRecorder.getDisplays();
				console.log(
					"[Main] Kullanılabilir ekranlar:",
					screens ? screens.length : 0
				);

				console.log("[Main] Ses cihazları kontrol ediliyor");
				const audioDevices = await macRecorder.getAudioDevices();
				console.log(
					"[Main] MacRecorder ses cihazları:",
					audioDevices ? audioDevices.length : 0
				);
			} catch (deviceError) {
				console.warn(
					"[Main] Cihaz bilgileri alınamadı (kritik değil):",
					deviceError.message
				);
			}

			// Seçenekleri kopyala ve modifiye et
			const recordingOptions = { ...options };

			// audioDeviceId'yi düzelt - "system" yerine null kullan
			if (recordingOptions.audioDeviceId === "system") {
				console.log("[Main] audioDeviceId 'system'den null'a çevriliyor");
				recordingOptions.audioDeviceId = null;
			}

			// MediaStateManager'dan mikrofon ayarlarını al
			if (mediaStateManager) {
				const audioSettings = mediaStateManager.state.audioSettings;
				console.log("[Main] MediaStateManager ses ayarları:", audioSettings);

				// Sadece mikrofonun etkin olması durumunda seçili mikrofon cihazını ayarla
				if (
					audioSettings.microphoneEnabled &&
					audioSettings.selectedAudioDevice
				) {
					// Ses cihazı ID'sini doğrudan recordingOptions.audioDeviceId'ye atayalım
					recordingOptions.audioDeviceId = audioSettings.selectedAudioDevice;
					console.log(
						"[Main] Mikrofon cihazı ayarlandı:",
						audioSettings.selectedAudioDevice
					);
				} else {
					console.log("[Main] Mikrofon devre dışı veya cihaz seçilmemiş");
					if (!audioSettings.microphoneEnabled) {
						recordingOptions.includeDeviceAudio = false;
					}
				}

				// Ses ayarlarını güncelle
				recordingOptions.audio = {
					// Önceki ayarlar
					...(recordingOptions.audio || {}),
					// Yeni ayarlar
					captureDeviceAudio: audioSettings.microphoneEnabled,
					captureSystemAudio: audioSettings.systemAudioEnabled,
				};

				// Ses captureDeviceAudio false olsa bile includeDeviceAudio'yu direkt etkilemeli
				recordingOptions.includeDeviceAudio = audioSettings.microphoneEnabled;
				recordingOptions.includeSystemAudio = audioSettings.systemAudioEnabled;

				// Açık bir şekilde "audio" parametresini true yap - MacRecorder kütüphanesi bunu gerektirir
				if (
					audioSettings.systemAudioEnabled ||
					audioSettings.microphoneEnabled
				) {
					recordingOptions.audio = true;
				}

				console.log("[Main] MacRecorder ses ayarları güncellendi:", {
					audio: recordingOptions.audio, // Açık audio parametresi
					includeDeviceAudio: recordingOptions.includeDeviceAudio,
					includeSystemAudio: recordingOptions.includeSystemAudio,
					captureDeviceAudio: recordingOptions.audio.captureDeviceAudio,
					captureSystemAudio: recordingOptions.audio.captureSystemAudio,
					audioDeviceId: recordingOptions.audioDeviceId,
				});
			}

			// FPS ayarla
			recordingOptions.fps = recordingOptions.fps || 30;

			console.log("[Main] Kayıt başlatılıyor...", recordingOptions);

			// MacRecorder kayıt başlatma
			try {
				// MacRecorder için doğru format
				const macRecorderOptions = {
					displayId: 0, // Varsayılan ekran
					quality: recordingOptions.quality || "high",
					frameRate: recordingOptions.fps || 30,
					includeMicrophone: recordingOptions.includeDeviceAudio || false,
					includeSystemAudio: recordingOptions.includeSystemAudio !== false,
				};

				// macRecorderId varsa kullan (sayısal değer)
				if (recordingSource && recordingSource.macRecorderId !== null) {
					const screenId = parseInt(recordingSource.macRecorderId, 10);
					if (!isNaN(screenId)) {
						macRecorderOptions.displayId = screenId;
						console.log("[Main] MacRecorder displayId ayarlandı:", screenId);
					}
				}

				console.log("[Main] MacRecorder kayıt başlatılıyor:", {
					outputPath,
					options: macRecorderOptions,
				});

				const result = await recorder.startRecording(
					outputPath,
					macRecorderOptions
				);
				console.log("[Main] MacRecorder start result:", result);

				if (result) {
					console.log("[Main] ✅ MacRecorder kaydı başarıyla başlatıldı");
					return true;
				} else {
					console.error("[Main] ❌ MacRecorder kaydı başlatılamadı");
					return false;
				}
			} catch (error) {
				console.error("[Main] MacRecorder kaydı başlatılırken hata:", error);

				// Hataya özel mesaj
				if (
					error.message.includes("timeout") ||
					error.code === "RECORDER_TIMEOUT"
				) {
					console.error(
						"[Main] Kayıt zaman aşımı hatası. Sistem yükü yüksek olabilir veya başka bir kayıt uygulaması çalışıyor olabilir."
					);
				}

				return false;
			}
		} catch (error) {
			console.error(
				"[Main] MacRecorder kaydı başlatılırken genel hata:",
				error
			);
			return false;
		}
	}
);

safeHandle(IPC_EVENTS.STOP_MAC_RECORDING, async (event, outputPath) => {
	try {
		console.log("[Main] ✅ MacRecorder kaydı durduruluyor...");

		const recorder = getMacRecorderInstance();

		if (!recorder.isRecording) {
			console.log("[Main] ⚠️ Kayıt zaten durdurulmuş");
			return { success: true, filePath: outputPath };
		}

		// Kaydı durdur
		const result = await recorder.stopRecording();
		console.log("[Main] MacRecorder stop result:", result);

		if (result) {
			console.log("[Main] ✅ MacRecorder kaydı başarıyla durduruldu:", result);
			return { success: true, filePath: result };
		} else {
			console.error("[Main] ❌ MacRecorder kaydı durdurulamadı");
			return { success: false, filePath: null, error: "Stop failed" };
		}
	} catch (error) {
		console.error("[Main] ❌ MacRecorder kaydı durdurulurken hata:", error);
		return { success: false, filePath: null, error: error.message };
	}
});

// IPC event handlers
function setupIpcHandlers() {
	// Kayıtlı handler'ları takip etmek için bir set

	safeHandle(IPC_EVENTS.GET_FILE_SIZE, async (event, filePath) => {
		try {
			if (!filePath || !fs.existsSync(filePath)) {
				return 0;
			}
			const stats = fs.statSync(filePath);
			return stats.size;
		} catch (error) {
			console.error("[Main] Dosya boyutu alınırken hata:", error);
			return 0;
		}
	});

	// GET_MEDIA_STATE handler'ı ekle
	safeHandle(IPC_EVENTS.GET_MEDIA_STATE, async () => {
		if (mediaStateManager) {
			return mediaStateManager.getState();
		}
		return null;
	});

	// SET_MEDIA_STATE handler'ı ekle
	safeHandle(IPC_EVENTS.SET_MEDIA_STATE, async (event, newState) => {
		if (mediaStateManager) {
			mediaStateManager.updateState(newState);
			return true;
		}
		return false;
	});

	// GET_TEMP_VIDEO_PATH handler'ı eksik olabilir, ekleyelim
	safeHandle(IPC_EVENTS.GET_TEMP_VIDEO_PATH, async () => {
		if (tempFileManager) {
			return await tempFileManager.getTempFilePath();
		}
		return null;
	});

	// Processing complete handler
	ipcMain.on(IPC_EVENTS.PROCESSING_COMPLETE, async (event, mediaData) => {
		console.log("[Main] İşleme tamamlandı bildirimi alındı:", mediaData);

		try {
			// MediaStateManager'ı güncelle
			if (mediaStateManager) {
				mediaStateManager.updateState({
					videoPath: mediaData.videoPath || null,
					audioPath: mediaData.audioPath || null,
					cameraPath: mediaData.cameraPath || null,
					isEditing: true,
					processingStatus: {
						isProcessing: false,
						progress: 100,
						error: null,
					},
				});
			}

			// Dosyalar gerçekten var mı kontrol et
			const mediaReady = mediaStateManager.isMediaReady();
			console.log("[Main] Medya hazır durumu:", mediaReady);

			// Editor'ü aç
			if (mediaReady && editorManager) {
				console.log("[Main] Editor penceresi açılıyor...");
				editorManager.createEditorWindow();
			} else {
				console.warn("[Main] Medya dosyaları hazır değil veya editor yok:", {
					mediaReady,
					hasEditorManager: !!editorManager,
				});
			}
		} catch (error) {
			console.error("[Main] İşleme tamamlandı handler'ında hata:", error);
		}
	});

	// Recording status updates
	ipcMain.on(IPC_EVENTS.RECORDING_STATUS_UPDATE, (event, statusData) => {
		console.log("[Main] Kayıt durumu güncellendi:", statusData);

		// Tray manager'a bildir
		if (trayManager && typeof statusData.isActive === "boolean") {
			trayManager.setRecordingStatus(statusData.isActive);
		}

		// MediaStateManager'a bildir
		if (mediaStateManager) {
			mediaStateManager.updateRecordingStatus(statusData);
		}

		// Ana pencereye bildir
		if (mainWindow && mainWindow.webContents) {
			mainWindow.webContents.send(
				IPC_EVENTS.RECORDING_STATUS_UPDATE,
				statusData
			);
		}
	});

	// Desktop Capturer Sources - MacRecorder ile değiştir
	safeHandle(
		IPC_EVENTS.DESKTOP_CAPTURER_GET_SOURCES,
		async (event, options) => {
			try {
				console.log("[Main] MacRecorder Sources isteniyor:", options);

				const recorder = getMacRecorderInstance();
				let sources = [];

				// Ekranları al
				if (!options.types || options.types.includes("screen")) {
					const screens = await recorder.getDisplays();
					const screenSources = screens.map((screen) => ({
						id: `screen:${screen.id}`,
						name: screen.name || `Display ${screen.id}`,
						display_id: screen.id,
						thumbnail: null,
						appIcon: null,
						macRecorderId: screen.id,
						macRecorderInfo: screen,
					}));
					sources.push(...screenSources);
				}

				// Pencereleri al
				if (!options.types || options.types.includes("window")) {
					const windows = await recorder.getWindows();
					const windowSources = windows.map((window) => ({
						id: `window:${window.id}`,
						name: window.name,
						thumbnail: null,
						appIcon: null,
						macRecorderId: window.id,
						macRecorderInfo: window,
					}));
					sources.push(...windowSources);
				}

				console.log(`[Main] MacRecorder ${sources.length} kaynak buldu`);
				return sources;
			} catch (error) {
				console.error("[Main] MacRecorder Sources hatası:", error);
				throw error;
			}
		}
	);

	// MacRecorder Thumbnail fonksiyonları ekle
	safeHandle("GET_MAC_SCREEN_THUMBNAIL", async (event, screenId, options) => {
		try {
			console.log("[Main] MacRecorder ekran thumbnail'ı isteniyor:", screenId);

			// Ekran thumbnail'ı için özel izinler gerekebilir, şimdilik devre dışı
			console.warn(
				"[Main] Ekran thumbnail'ı şu anda desteklenmiyor (izin sorunu)"
			);
			return null;

			// TODO: Display thumbnail izin sorunu çözüldüğünde eklenecek
		} catch (error) {
			console.warn("[Main] MacRecorder ekran thumbnail hatası:", error.message);
			return null;
		}
	});

	safeHandle("GET_MAC_WINDOW_THUMBNAIL", async (event, windowId, options) => {
		try {
			console.log(
				"[Main] MacRecorder pencere thumbnail'ı isteniyor:",
				windowId
			);
			const MacRecorder = require("node-mac-recorder");
			const utilRecorder = new MacRecorder();
			const thumbnail = await utilRecorder.getWindowThumbnail(
				windowId,
				options
			);
			return thumbnail;
		} catch (error) {
			console.error("[Main] MacRecorder pencere thumbnail hatası:", error);
			return null;
		}
	});

	// MacRecorder Screens listesi
	safeHandle("GET_MAC_SCREENS", async (event) => {
		try {
			console.log("[Main] MacRecorder ekranları isteniyor");
			const recorder = getMacRecorderInstance();
			const screens = await recorder.getDisplays();
			console.log("[Main] MacRecorder ekranları:", screens);
			return screens;
		} catch (error) {
			console.error("[Main] MacRecorder ekranları alınamadı:", error);
			return [];
		}
	});

	// MacRecorder Windows listesi
	safeHandle("GET_MAC_WINDOWS", async (event) => {
		try {
			console.log("[Main] MacRecorder pencereleri isteniyor");
			const recorder = getMacRecorderInstance();
			const windows = await recorder.getWindows();
			console.log("[Main] MacRecorder pencereleri:", windows);
			return windows;
		} catch (error) {
			console.error("[Main] MacRecorder pencereleri alınamadı:", error);
			return [];
		}
	});

	// MacRecorder Audio Devices listesi
	safeHandle("GET_MAC_AUDIO_DEVICES", async (event) => {
		try {
			console.log("[Main] MacRecorder ses cihazları isteniyor");
			const recorder = getMacRecorderInstance();
			const devices = await recorder.getAudioDevices();
			console.log("[Main] MacRecorder ses cihazları:", devices);
			return devices;
		} catch (error) {
			console.error("[Main] MacRecorder ses cihazları alınamadı:", error);
			return [];
		}
	});

	// Recording status updates
	ipcMain.on(IPC_EVENTS.RECORDING_STATUS_UPDATE, (event, statusData) => {
		console.log("[Main] Kayıt durumu güncellendi:", statusData);

		// Tray manager'a bildir
		if (trayManager && typeof statusData.isActive === "boolean") {
			trayManager.setRecordingStatus(statusData.isActive);
		}

		// MediaStateManager'a bildir
		if (mediaStateManager) {
			mediaStateManager.updateRecordingStatus(statusData);
		}

		// Ana pencereye bildir
		if (mainWindow && mainWindow.webContents) {
			mainWindow.webContents.send(
				IPC_EVENTS.RECORDING_STATUS_UPDATE,
				statusData
			);
		}
	});

	// Recording status
	ipcMain.on(IPC_EVENTS.RECORDING_STATUS_CHANGED, async (event, status) => {
		console.log("[Main] Kayıt durumu değişti:", status);

		// Tray manager güncelle
		if (trayManager) {
			trayManager.setRecordingStatus(status);
		}

		if (status) {
			console.log("[Main] Kayıt başlatılıyor...");
			startMouseTracking();

			// Kayıt başladığında kamera penceresini gizle
			if (
				cameraManager &&
				cameraManager.cameraWindow &&
				!cameraManager.cameraWindow.isDestroyed()
			) {
				console.log("[Main] Kayıt başladığında kamera penceresi gizleniyor...");
				cameraManager.cameraWindow.hide();
			}
		} else {
			console.log("[Main] Kayıt durduruluyor...");
			stopMouseTracking();
			if (mediaStateManager && tempFileManager) {
				await mediaStateManager.saveCursorData(tempFileManager);
			}
		}

		try {
			const result = await mediaStateManager.handleRecordingStatusChange(
				status,
				tempFileManager
			);

			if (!status) {
				// Kayıt durdurulduğunda
				console.log("[Main] Kayıt durduruldu, sonuç:", result);

				if (cameraManager) {
					cameraManager.closeCameraWindow();
				}

				// Medya dosyaları hazır olduğunda editor'ü aç
				if (result && editorManager) {
					try {
						// Editor'ü açmadan önce son bir kez daha medya dosyalarını kontrol et
						const mediaReady = mediaStateManager.isMediaReady();
						console.log("[Main] Medya hazır durumu:", mediaReady);

						// Pencere kaydı durumunda daha esnek olalım
						const isWindowRecording =
							mediaStateManager.state.recordingSource &&
							mediaStateManager.state.recordingSource.sourceType === "window";

						if (!mediaReady && !isWindowRecording) {
							console.warn(
								"[Main] Medya dosyaları hazır değil, editor açılmayacak"
							);
							console.log("[Main] Medya state:", mediaStateManager.getState());

							// Kullanıcıya bilgi ver
							if (mainWindow && !mainWindow.isDestroyed()) {
								mainWindow.show();
								mainWindow.webContents.send(
									IPC_EVENTS.RECORDING_ERROR,
									"Medya dosyaları hazırlanamadı. Lütfen tekrar kayıt yapmayı deneyin."
								);
							}

							return;
						}

						// Pencere kaydı için ekstra bilgi log'u
						if (isWindowRecording) {
							console.log(
								"[Main] Pencere kaydı algılandı, daha esnek doğrulama kullanılıyor"
							);
						}

						// Editor penceresini aç
						console.log("[Main] Editor penceresi açılıyor...");
						editorManager.showEditorWindow();

						// Ana pencereyi gizle
						if (mainWindow && !mainWindow.isDestroyed()) {
							mainWindow.hide();
						}
					} catch (error) {
						console.error("[main.cjs] Editor penceresi açılırken hata:", error);

						// Hata durumunda ana pencereyi göster ve kullanıcıya bilgi ver
						if (mainWindow && !mainWindow.isDestroyed()) {
							mainWindow.show();
							mainWindow.webContents.send(
								IPC_EVENTS.RECORDING_ERROR,
								"Editor penceresi açılamadı: " + error.message
							);
						}
					}
				} else {
					console.warn(
						"[Main] Medya işleme sonucu başarısız veya editorManager yok:",
						{
							result,
							hasEditorManager: !!editorManager,
						}
					);

					// Sonuç başarısız ise ana pencereyi göster
					if (mainWindow && !mainWindow.isDestroyed()) {
						mainWindow.show();

						// Kullanıcıya bilgi ver
						if (!result) {
							mainWindow.webContents.send(
								IPC_EVENTS.RECORDING_ERROR,
								"Kayıt işleme başarısız. Lütfen tekrar deneyin."
							);
						} else if (!editorManager) {
							mainWindow.webContents.send(
								IPC_EVENTS.RECORDING_ERROR,
								"Editor bileşeni başlatılamadı. Uygulamayı yeniden başlatmayı deneyin."
							);
						}
					}
				}
			}
		} catch (error) {
			console.error("[main.cjs] Kayıt durumu değiştirilirken hata:", error);

			// Hata durumunda ana pencereyi göster
			if (mainWindow && !mainWindow.isDestroyed()) {
				mainWindow.show();
				event.reply(
					IPC_EVENTS.RECORDING_ERROR,
					error.message || "Beklenmeyen bir hata oluştu"
				);
			}
		}
	});

	// Cursor data handler
	safeHandle(IPC_EVENTS.LOAD_CURSOR_DATA, async () => {
		try {
			console.log("[main.cjs] Cursor verisi yükleniyor...");
			if (mediaStateManager) {
				const cursorData = await mediaStateManager.loadCursorData();
				console.log(
					"[main.cjs] Cursor verisi yüklendi:",
					cursorData?.length || 0
				);
				return cursorData;
			}
			return [];
		} catch (error) {
			console.error("[main.cjs] Cursor verisi yüklenirken hata:", error);
			return [];
		}
	});

	// Editor events
	ipcMain.on(IPC_EVENTS.EDITOR_CLOSED, () => {
		handleEditorToRecordTransition();
	});

	ipcMain.on(IPC_EVENTS.CLOSE_EDITOR_WINDOW, () => {
		if (editorManager) {
			editorManager.closeEditorWindow();
		}
		// closeEditorWindow zaten EDITOR_CLOSED eventini gönderiyor,
		// bu event de handleEditorToRecordTransition'ı çağıracak
	});

	// Area selection
	ipcMain.on(IPC_EVENTS.START_AREA_SELECTION, () => {
		if (selectionManager) {
			selectionManager.startAreaSelection();
		}
	});

	ipcMain.on(IPC_EVENTS.AREA_SELECTED, (event, selectedArea) => {
		console.log("[Main] Seçilen alan:", selectedArea);

		// Seçilen alanı mediaStateManager'a kaydet
		if (mediaStateManager) {
			try {
				mediaStateManager.updateState({
					selectedArea,
					recordingSource: {
						...(mediaStateManager.getState().recordingSource || {}),
						sourceType: "area",
					},
				});
				console.log("[Main] Seçilen alan mediaStateManager'a kaydedildi");
			} catch (error) {
				console.error("[Main] Alan kaydetme hatası:", error);
			}
		}

		// MainWindow'a seçilen alanı bildir
		if (mainWindow && !mainWindow.isDestroyed()) {
			try {
				mainWindow.webContents.send(IPC_EVENTS.AREA_SELECTED, selectedArea);
				console.log("[Main] Seçilen alan ana pencereye bildirildi");
			} catch (error) {
				console.error("[Main] Alan bildirme hatası:", error);
			}
		}

		// Seçim penceresini kapat
		if (selectionManager) {
			try {
				console.log("[Main] Seçim penceresi kapatılıyor...");
				selectionManager.closeSelectionWindow();
			} catch (error) {
				console.error("[Main] Pencere kapatma hatası:", error);
			}
		}
	});

	ipcMain.on(IPC_EVENTS.UPDATE_SELECTED_AREA, (event, area) => {
		if (selectionManager) {
			selectionManager.updateSelectedArea(area);
		}
	});

	safeHandle(IPC_EVENTS.GET_CROP_INFO, async () => {
		if (selectionManager) {
			const selectedArea = selectionManager.getSelectedArea();
			if (
				selectedArea &&
				typeof selectedArea.width === "number" &&
				typeof selectedArea.height === "number"
			) {
				return {
					x: Math.round(selectedArea.x || 0),
					y: Math.round(selectedArea.y || 0),
					width: Math.round(selectedArea.width),
					height: Math.round(selectedArea.height),
					scale: 1,
				};
			}
		}
		return null;
	});

	// Editörden kayıt moduna geçişi yöneten fonksiyon
	function handleEditorToRecordTransition() {
		console.log("[Main] Editörden kayıt moduna geçiliyor...");

		// State'i sıfırla
		if (mediaStateManager) {
			mediaStateManager.resetState();
		}

		// Kamerayı açma işlemini setTimeout ile geciktirelim (güvenilirlik için)
		setTimeout(() => {
			if (cameraManager) {
				console.log("[Main] Kamera penceresi açılıyor... (200ms gecikme ile)");
				cameraManager.resetForNewRecording();
			}

			// Ana pencereyi göster
			if (mainWindow && !mainWindow.isDestroyed()) {
				console.log("[Main] Ana pencere gösteriliyor...");
				mainWindow.show();
			}
		}, 200); // 200ms gecikme
	}

	// Media state
	safeHandle(IPC_EVENTS.GET_MEDIA_STATE, () => {
		return mediaStateManager.getState();
	});

	// Window management
	ipcMain.on(IPC_EVENTS.WINDOW_CLOSE, () => {
		if (mainWindow) {
			mainWindow.close();
			cameraManager.cleanup();
			app.quit();
		}
	});

	// Processing complete handler
	ipcMain.on(IPC_EVENTS.PROCESSING_COMPLETE, async (event, mediaData) => {
		console.log("[Main] İşleme tamamlandı bildirimi alındı:", mediaData);

		try {
			// MediaStateManager'ı güncelle
			if (mediaStateManager) {
				mediaStateManager.updateState({
					videoPath: mediaData.videoPath || null,
					audioPath: mediaData.audioPath || null,
					cameraPath: mediaData.cameraPath || null,
					isEditing: true,
					processingStatus: {
						isProcessing: false,
						progress: 100,
						error: null,
					},
				});
			}

			// Dosyalar gerçekten var mı kontrol et
			const mediaReady = mediaStateManager.isMediaReady();
			console.log("[Main] Medya hazır durumu:", mediaReady);

			// Editor'ü aç
			if (mediaReady && editorManager) {
				console.log("[Main] Editor penceresi açılıyor...");
				editorManager.createEditorWindow();
			} else {
				console.warn("[Main] Medya dosyaları hazır değil veya editor yok:", {
					mediaReady,
					hasEditorManager: !!editorManager,
				});
			}
		} catch (error) {
			console.error("[Main] İşleme tamamlandı handler'ında hata:", error);
		}
	});

	// File operations
	safeHandle(IPC_EVENTS.START_MEDIA_STREAM, async (event, type) => {
		return await tempFileManager.startMediaStream(type);
	});

	safeHandle(IPC_EVENTS.WRITE_MEDIA_CHUNK, async (event, type, chunk) => {
		return tempFileManager.writeChunkToStream(type, chunk);
	});

	safeHandle(IPC_EVENTS.END_MEDIA_STREAM, async (event, type) => {
		try {
			console.log(`[Main] ${type} medya stream'i sonlandırılıyor...`);
			const result = await tempFileManager.endMediaStream(type);
			console.log(`[Main] ${type} medya stream'i sonlandırıldı:`, result);
			return result;
		} catch (error) {
			console.error(
				`[Main] ${type} medya stream'i sonlandırılırken hata:`,
				error
			);
			// Hata olsa bile stream'i Map'ten kaldır
			tempFileManager.activeStreams.delete(type);
			return null;
		}
	});

	safeHandle(IPC_EVENTS.SAVE_TEMP_VIDEO, async (event, data, type) => {
		if (data.startsWith("data:")) {
			// Eski yöntem - base64'ten dosyaya
			return await tempFileManager.saveTempVideo(data, type);
		} else {
			// Yeni yöntem - doğrudan chunk'ı stream'e yaz
			return tempFileManager.writeChunkToStream(type, data);
		}
	});

	safeHandle(IPC_EVENTS.READ_VIDEO_FILE, async (event, filePath) => {
		try {
			if (!filePath || !fs.existsSync(filePath)) {
				console.error("[main.cjs] Dosya bulunamadı:", filePath);
				return null;
			}

			const stats = fs.statSync(filePath);
			if (stats.size === 0) {
				console.error("[main.cjs] Dosya boş:", filePath);
				return null;
			}

			console.log("[main.cjs] Video dosyası okunuyor:", {
				path: filePath,
				size: stats.size,
				sizeInMB: (stats.size / (1024 * 1024)).toFixed(2) + "MB",
			});

			const buffer = await fs.promises.readFile(filePath);
			return buffer.toString("base64");
		} catch (error) {
			console.error("[main.cjs] Video dosyası okunurken hata:", error);
			return null;
		}
	});

	safeHandle(IPC_EVENTS.GET_MEDIA_PATHS, () => {
		return {
			videoPath:
				tempFileManager.getFilePath("screen") ||
				tempFileManager.getFilePath("video"),
			audioPath: tempFileManager.getFilePath("audio"),
			cameraPath: tempFileManager.getFilePath("camera"),
		};
	});

	safeHandle(IPC_EVENTS.SHOW_SAVE_DIALOG, async (event, options) => {
		const { dialog } = require("electron");
		const result = await dialog.showSaveDialog({
			...options,
			properties: ["showOverwriteConfirmation"],
		});
		return result.filePath;
	});

	// Get Documents directory path
	safeHandle(IPC_EVENTS.GET_DOCUMENTS_PATH, async () => {
		try {
			return app.getPath("documents");
		} catch (error) {
			console.error("[main] Documents klasörü alınamadı:", error);
			return null;
		}
	});

	// Get any system path
	safeHandle(IPC_EVENTS.GET_PATH, async (event, pathName) => {
		try {
			return app.getPath(pathName);
		} catch (error) {
			console.error(`[main] "${pathName}" yolu alınamadı:`, error);
			return null;
		}
	});

	// Show directory selection dialog
	safeHandle(IPC_EVENTS.SHOW_DIRECTORY_DIALOG, async (event, options) => {
		try {
			console.log("[main] Dizin seçme diyaloğu gösteriliyor:", options);
			const result = await dialog.showOpenDialog({
				...options,
				properties: ["openDirectory", "createDirectory"],
			});
			console.log("[main] Dizin seçme sonucu:", result);
			return result;
		} catch (error) {
			console.error("[main] Dizin seçme diyaloğu gösterilirken hata:", error);
			return { canceled: true, filePaths: [] };
		}
	});

	// Get Home directory path
	safeHandle(IPC_EVENTS.GET_HOME_DIR, async () => {
		try {
			return app.getPath("home");
		} catch (error) {
			console.error("[main] Home klasörü alınamadı:", error);
			return null;
		}
	});

	// Show file in folder (Finder/Explorer)
	ipcMain.on(IPC_EVENTS.SHOW_FILE_IN_FOLDER, (event, filePath) => {
		try {
			const { shell } = require("electron");
			// Dosya varsa göster
			if (fs.existsSync(filePath)) {
				shell.showItemInFolder(filePath);
				console.log("[main] Dosya Explorer/Finder'da gösteriliyor:", filePath);
			} else {
				console.error("[main] Dosya bulunamadı:", filePath);
			}
		} catch (error) {
			console.error("[main] Dosyayı klasörde gösterirken hata:", error);
		}
	});

	// Video kaydetme işlemi
	safeHandle(
		IPC_EVENTS.SAVE_VIDEO_FILE,
		async (event, arrayBuffer, filePath, cropInfo, audioArrayBuffer) => {
			try {
				console.log("[main] Video kaydetme işlemi başlatıldı");

				// ArrayBuffer'ı Buffer'a çevir
				const videoBuffer = Buffer.from(arrayBuffer);
				const audioBuffer = audioArrayBuffer
					? Buffer.from(audioArrayBuffer)
					: null;

				// Geçici dosya oluştur
				const tempVideoPath = path.join(app.getPath("temp"), "temp_video.mp4");
				const tempAudioPath = audioBuffer
					? path.join(app.getPath("temp"), "temp_audio.mp3")
					: null;

				// Dosyaları geçici olarak kaydet
				await fs.promises.writeFile(tempVideoPath, videoBuffer);
				if (audioBuffer) {
					await fs.promises.writeFile(tempAudioPath, audioBuffer);
				}

				// FFmpeg ile video işleme
				return new Promise((resolve, reject) => {
					let command = ffmpeg(tempVideoPath);

					if (audioBuffer) {
						command = command.input(tempAudioPath);
					}

					if (cropInfo) {
						command = command.videoFilters([
							`crop=${cropInfo.width}:${cropInfo.height}:${cropInfo.x}:${cropInfo.y}`,
						]);
					}

					command
						.on("end", () => {
							// Geçici dosyaları temizle
							fs.unlinkSync(tempVideoPath);
							if (tempAudioPath) fs.unlinkSync(tempAudioPath);
							console.log("[main] Video başarıyla kaydedildi:", filePath);
							resolve({ success: true, path: filePath });
						})
						.on("error", (err) => {
							console.error("[main] Video kaydedilirken hata:", err);
							reject(err);
						})
						.save(filePath);
				});
			} catch (error) {
				console.error("[main] Video kaydetme hatası:", error);
				throw error;
			}
		}
	);

	// Video kaydetme işlemi
	safeHandle(
		IPC_EVENTS.SAVE_CANVAS_RECORDING,
		async (event, videoArrayBuffer, filePath, audioArrayBuffer) => {
			try {
				console.log("[main] Canvas kaydı kaydetme işlemi başlatıldı");

				// ArrayBuffer'ları Buffer'a çevir
				const videoBuffer = Buffer.from(videoArrayBuffer);
				const audioBuffer = audioArrayBuffer
					? Buffer.from(audioArrayBuffer)
					: null;

				// Geçici dosya yolları
				const tempVideoPath = path.join(
					app.getPath("temp"),
					"temp_canvas_video.webm"
				);
				const tempAudioPath = audioBuffer
					? path.join(app.getPath("temp"), "temp_canvas_audio.webm")
					: null;

				// Dosyaları geçici olarak kaydet
				await fs.promises.writeFile(tempVideoPath, videoBuffer);
				if (audioBuffer) {
					await fs.promises.writeFile(tempAudioPath, audioBuffer);
				}

				// FFmpeg ile video işleme
				return new Promise((resolve, reject) => {
					let command = ffmpeg(tempVideoPath);

					if (audioBuffer) {
						command = command.input(tempAudioPath);
					}

					command
						.videoCodec("libx264")
						.outputOptions([
							"-crf 23", // Kalite ayarı (0-51, düşük değer daha iyi kalite)
							"-preset medium", // Encoding hızı/kalite dengesi
							"-movflags +faststart", // Web'de hızlı başlatma için
						])
						.on("end", () => {
							// Geçici dosyaları temizle
							fs.unlinkSync(tempVideoPath);
							if (tempAudioPath) fs.unlinkSync(tempAudioPath);
							console.log("[main] Video başarıyla kaydedildi:", filePath);
							resolve({ success: true, path: filePath });
						})
						.on("error", (err) => {
							console.error("[main] Video kaydedilirken hata:", err);
							reject(err);
						})
						.save(filePath);
				});
			} catch (error) {
				console.error("[main] Canvas kaydı kaydetme hatası:", error);
				throw error;
			}
		}
	);

	// Pencere boyutu güncelleme
	ipcMain.on("UPDATE_WINDOW_SIZE", (event, { height }) => {
		if (mainWindow) {
			const [width] = mainWindow.getSize();
			mainWindow.setSize(width, height);
		}
	});

	// Kamera takip ayarı
	ipcMain.on("TOGGLE_CAMERA_FOLLOW", (event, shouldFollow) => {
		cameraManager.setFollowMouse(shouldFollow);
	});

	// Video kaydetme işleyicisi
	safeHandle(IPC_EVENTS.SAVE_VIDEO, async (event, base64Data, outputPath) => {
		try {
			console.log("[main] Video kaydediliyor...");

			// Base64'ten buffer'a çevir
			const base64String = base64Data.replace(/^data:video\/webm;base64,/, "");
			const inputBuffer = Buffer.from(base64String, "base64");

			// Geçici webm dosyası oluştur
			const tempWebmPath = path.join(
				app.getPath("temp"),
				`temp_${Date.now()}.webm`
			);
			fs.writeFileSync(tempWebmPath, inputBuffer);

			// FFmpeg ile MP4'e dönüştür ve kaliteyi ayarla
			return new Promise((resolve, reject) => {
				ffmpeg(tempWebmPath)
					.outputOptions([
						"-c:v libx264", // H.264 codec
						"-preset fast", // Hızlı encoding
						"-crf 18", // Yüksek kalite (0-51, düşük değer = yüksek kalite)
						"-movflags +faststart", // Web playback için optimize
						"-profile:v high", // Yüksek profil
						"-level 4.2", // Uyumluluk seviyesi
						"-pix_fmt yuv420p", // Renk formatı
						"-r 60", // 60 FPS
					])
					.on("end", () => {
						// Geçici dosyayı temizle
						fs.unlinkSync(tempWebmPath);
						console.log("[main] Video başarıyla kaydedildi:", outputPath);
						resolve({ success: true });
					})
					.on("error", (err) => {
						console.error("[main] Video dönüştürme hatası:", err);
						reject(new Error("Video dönüştürülemedi: " + err.message));
					})
					.save(outputPath);
			});
		} catch (error) {
			console.error("[main] Video kaydetme hatası:", error);
			throw error;
		}
	});

	// Editör penceresini aç
	safeHandle(IPC_EVENTS.OPEN_EDITOR, async (event, data) => {
		try {
			console.log("[Main] Editör açılıyor, tüm stream'ler temizleniyor...");

			// Fare takibini durdur
			if (isTracking) {
				console.log("[Main] Fare takibi durduruluyor...");
				uIOhook.stop();
				isTracking = false;
				mainWindow.webContents.send(IPC_EVENTS.MOUSE_TRACKING_STOPPED);
			}

			// Önce tüm aktif stream'leri temizle
			await tempFileManager.cleanupStreams();

			// Medya yollarını kaydet
			mediaStateManager.state.videoPath = data.videoPath;
			mediaStateManager.state.cameraPath = data.cameraPath;
			mediaStateManager.state.audioPath = data.audioPath;

			console.log("[Main] Stream'ler temizlendi, editör açılıyor...");
			console.log("[Main] Editör verileri:", data);

			// Editör penceresini aç
			createEditorWindow(data);
			return { success: true };
		} catch (error) {
			console.error("[Main] Editör açılırken hata:", error);
			return { success: false, error: error.message };
		}
	});

	// Mikrofon cihazı değişikliğini dinle
	ipcMain.on(IPC_EVENTS.AUDIO_DEVICE_CHANGED, (event, deviceId) => {
		console.log("[main.cjs] Mikrofon cihazı değişikliği alındı:", deviceId);
		if (mediaStateManager) {
			mediaStateManager.updateAudioDevice(deviceId);
		}
	});

	// UPDATE_RECORDING_SOURCE
	ipcMain.on("UPDATE_RECORDING_SOURCE", (event, source) => {
		console.log("[Main] Kayıt kaynağı güncellendi:", source);
		recordingSource = {
			...recordingSource,
			...source,
		};

		// Media state manager üzerinden aktif kaynak ayarını güncelle
		if (mediaStateManager) {
			mediaStateManager.updateRecordingSource(recordingSource);
		}
	});

	// MacRecorder handler'ları
	safeHandle(IPC_EVENTS.GET_MAC_SCREENS, async (event) => {
		try {
			console.log("[Main] MacRecorder ekran listesi alınıyor...");
			const recorder = getMacRecorderInstance();
			const displays = await recorder.getDisplays();
			console.log("[Main] MacRecorder ekranları:", displays);
			return displays;
		} catch (error) {
			console.error("[Main] MacRecorder ekran listesi alınamadı:", error);
			return [];
		}
	});

	safeHandle(IPC_EVENTS.GET_MAC_WINDOWS, async (event) => {
		try {
			console.log("[Main] MacRecorder pencere listesi alınıyor...");
			const recorder = getMacRecorderInstance();
			const windows = await recorder.getWindows();
			console.log("[Main] MacRecorder pencereleri:", windows);
			return windows;
		} catch (error) {
			console.error("[Main] MacRecorder pencere listesi alınamadı:", error);
			return [];
		}
	});

	safeHandle(IPC_EVENTS.GET_MAC_AUDIO_DEVICES, async (event) => {
		try {
			console.log("[Main] MacRecorder ses cihazları alınıyor...");
			const recorder = getMacRecorderInstance();
			const audioDevices = await recorder.getAudioDevices();
			console.log("[Main] MacRecorder ses cihazları:", audioDevices);
			return audioDevices;
		} catch (error) {
			console.error("[Main] MacRecorder ses cihazları alınamadı:", error);
			return [];
		}
	});

	// MacRecorder ekran ID doğrulama fonksiyonu
	safeHandle(IPC_EVENTS.VALIDATE_MAC_SCREEN_ID, async (event, screenId) => {
		try {
			console.log("[Main] MacRecorder ekran ID doğrulanıyor:", screenId);
			const recorder = getMacRecorderInstance();
			const displays = await recorder.getDisplays();
			const isValid = displays.some((display) => display.id === screenId);
			console.log("[Main] MacRecorder ekran ID doğrulama sonucu:", isValid);
			return isValid;
		} catch (error) {
			console.error("[Main] MacRecorder ekran ID doğrulanamadı:", error);
			return false;
		}
	});

	// Audio Settings
	ipcMain.on(IPC_EVENTS.UPDATE_AUDIO_SETTINGS, (event, settings) => {
		if (mediaStateManager) {
			mediaStateManager.updateAudioSettings(settings);
		}
	});

	safeHandle(IPC_EVENTS.GET_AUDIO_SETTINGS, () => {
		if (mediaStateManager) {
			return mediaStateManager.state.audioSettings;
		}
		return null;
	});

	// GIF kaydetme işleyicisi
	safeHandle(IPC_EVENTS.SAVE_GIF, async (event, base64Data, outputPath) => {
		try {
			console.log("[main] GIF kaydediliyor...");

			// Ensure directory exists
			const dirPath = path.dirname(outputPath);
			if (!fs.existsSync(dirPath)) {
				console.log(`[main] Dizin oluşturuluyor: ${dirPath}`);
				fs.mkdirSync(dirPath, { recursive: true });
			}

			// Base64'ten buffer'a çevir
			const base64String = base64Data.replace(/^data:video\/webm;base64,/, "");
			const inputBuffer = Buffer.from(base64String, "base64");

			// Geçici webm dosyası oluştur
			const tempWebmPath = path.join(
				app.getPath("temp"),
				`temp_${Date.now()}.webm`
			);
			fs.writeFileSync(tempWebmPath, inputBuffer);

			// FFmpeg ile GIF'e dönüştür
			return new Promise((resolve, reject) => {
				ffmpeg(tempWebmPath)
					.outputOptions([
						"-vf",
						"fps=15,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse", // GIF kalitesi için optimizasyon
					])
					.on("end", () => {
						// Geçici dosyayı temizle
						fs.unlinkSync(tempWebmPath);
						console.log("[main] GIF başarıyla kaydedildi:", outputPath);
						resolve({ success: true });
					})
					.on("error", (err) => {
						console.error("[main] GIF dönüştürme hatası:", err);
						reject(new Error("GIF dönüştürülemedi: " + err.message));
					})
					.save(outputPath);
			});
		} catch (error) {
			console.error("[main] GIF kaydetme hatası:", error);
			throw error;
		}
	});

	// Handle screenshot saving
	safeHandle(IPC_EVENTS.SAVE_SCREENSHOT, async (event, imageData, filePath) => {
		try {
			if (!imageData || !filePath) {
				return { success: false, error: "Invalid image data or file path" };
			}

			// Remove data:image/png;base64, prefix if it exists
			const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");

			// Write the file
			const fs = require("fs");
			fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

			return { success: true };
		} catch (error) {
			console.error("Error saving screenshot:", error);
			return { success: false, error: error.message };
		}
	});

	// Dialog handlers for layout management
	safeHandle(IPC_EVENTS.SHOW_PROMPT, async (event, options) => {
		if (!mainWindow) return null;

		const { title, message, defaultValue } = options;

		// Create a simple HTML prompt dialog
		const promptWindow = new BrowserWindow({
			width: 400,
			height: 200,
			parent: mainWindow,
			modal: true,
			show: false,
			resizable: false,
			minimizable: false,
			maximizable: false,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
			},
		});

		// Load HTML content
		promptWindow.loadURL(`data:text/html,
			<html>
			<head>
				<title>${title || "Giriş"}</title>
				<style>
					body {
						font-family: system-ui, -apple-system, sans-serif;
						background-color: #1f2937;
						color: white;
						padding: 20px;
						margin: 0;
						display: flex;
						flex-direction: column;
						height: 100vh;
					}
					h3 {
						margin-top: 0;
						margin-bottom: 15px;
					}
					input {
						padding: 8px;
						margin-bottom: 20px;
						background-color: #374151;
						border: 1px solid #4b5563;
						color: white;
						border-radius: 4px;
					}
					.buttons {
						display: flex;
						justify-content: flex-end;
						gap: 10px;
					}
					button {
						padding: 8px 16px;
						border: none;
						border-radius: 4px;
						cursor: pointer;
					}
					.cancel {
						background-color: #4b5563;
						color: white;
					}
					.ok {
						background-color: #2563eb;
						color: white;
					}
				</style>
			</head>
			<body>
				<h3>${message || "Lütfen bir değer girin:"}</h3>
				<input id="prompt-input" type="text" value="${defaultValue || ""}" autofocus />
				<div class="buttons">
					<button class="cancel" onclick="cancel()">İptal</button>
					<button class="ok" onclick="ok()">Tamam</button>
				</div>
				<script>
					const input = document.getElementById('prompt-input');
					input.select();
					
					function cancel() {
						window.promptResult = null;
						window.close();
					}
					
					function ok() {
						window.promptResult = input.value;
						window.close();
					}
					
					// Handle Enter key
					input.addEventListener('keyup', (e) => {
						if (e.key === 'Enter') ok();
						if (e.key === 'Escape') cancel();
					});
				</script>
			</body>
			</html>
		`);

		// Show window
		promptWindow.once("ready-to-show", () => {
			promptWindow.show();
		});

		// Wait for window to close and get result
		return new Promise((resolve) => {
			promptWindow.on("closed", () => {
				resolve(
					promptWindow.webContents.executeJavaScript("window.promptResult")
				);
			});
		});
	});

	safeHandle(IPC_EVENTS.SHOW_CONFIRM, async (event, options) => {
		if (!mainWindow) return 0;

		const { title, message, buttons } = options;
		const result = await dialog.showMessageBox(mainWindow, {
			type: "question",
			buttons: buttons || ["İptal", "Tamam"],
			defaultId: 1,
			cancelId: 0,
			title: title || "Onay",
			message: message || "Bu işlemi yapmak istediğinize emin misiniz?",
		});

		return result.response;
	});

	// Store handlers
	safeHandle(IPC_EVENTS.STORE_GET, async (event, key) => {
		try {
			// You can implement your own storage solution here
			// For now, we'll use a simple in-memory store
			const store = global.store || {};
			return store[key];
		} catch (error) {
			console.error(`[Main] Error getting store value for key ${key}:`, error);
			return null;
		}
	});

	safeHandle(IPC_EVENTS.STORE_SET, async (event, key, value) => {
		try {
			// You can implement your own storage solution here
			// For now, we'll use a simple in-memory store
			global.store = global.store || {};
			global.store[key] = value;
			return true;
		} catch (error) {
			console.error(`[Main] Error setting store value for key ${key}:`, error);
			return false;
		}
	});

	// Dosya koruma işlemleri için IPC olayları
	safeHandle(IPC_EVENTS.PROTECT_FILE, (event, filePath) => {
		if (tempFileManager) {
			return tempFileManager.protectFile(filePath);
		}
		return false;
	});

	safeHandle(IPC_EVENTS.UNPROTECT_FILE, (event, filePath) => {
		if (tempFileManager) {
			return tempFileManager.unprotectFile(filePath);
		}
		return false;
	});

	safeHandle(IPC_EVENTS.GET_PROTECTED_FILES, () => {
		if (tempFileManager) {
			return tempFileManager.getProtectedFiles();
		}
		return [];
	});

	// Event handlers (not using safeHandle as these are .on not .handle)

	// ... existing code ...

	// Debug helper to check static files location
	safeHandle(IPC_EVENTS.DEBUG_CHECK_STATIC_FILES, async () => {
		try {
			console.log("[Debug] Checking static files locations");

			const possiblePaths = [
				path.join(process.resourcesPath, "public"),
				path.join(process.resourcesPath, "app.asar/.output/public"),
				path.join(process.resourcesPath, "app/.output/public"),
				path.join(app.getAppPath(), ".output/public"),
				path.join(__dirname, "../.output/public"),
				path.join(__dirname, "../../.output/public"),
			];

			const results = {};

			for (const testPath of possiblePaths) {
				console.log(`[Debug] Checking path: ${testPath}`);
				try {
					const exists = fs.existsSync(testPath);
					let contents = [];

					if (exists) {
						try {
							contents = fs.readdirSync(testPath);
						} catch (err) {
							contents = [`Error reading directory: ${err.message}`];
						}
					}

					results[testPath] = {
						exists,
						contents,
						isDirectory: exists ? fs.statSync(testPath).isDirectory() : false,
						hasIndexHtml: exists
							? fs.existsSync(path.join(testPath, "index.html"))
							: false,
					};

					if (exists && fs.existsSync(path.join(testPath, "index.html"))) {
						try {
							const indexSize = fs.statSync(
								path.join(testPath, "index.html")
							).size;
							results[testPath].indexHtmlSize = indexSize;
						} catch (err) {
							results[testPath].indexHtmlError = err.message;
						}
					}
				} catch (err) {
					results[testPath] = {
						error: err.message,
					};
				}
			}

			// Check app paths
			results.appPaths = {
				appPath: app.getAppPath(),
				resourcesPath: process.resourcesPath,
				dirname: __dirname,
				cwd: process.cwd(),
				execPath: process.execPath,
			};

			return results;
		} catch (error) {
			console.error("[Debug] Error checking static files:", error);
			return { error: error.message, stack: error.stack };
		}
	});

	// Dosya koruma işlemleri için IPC olayları
	safeHandle(IPC_EVENTS.PROTECT_FILE, (event, filePath) => {
		if (tempFileManager) {
			return tempFileManager.protectFile(filePath);
		}
		return false;
	});

	safeHandle(IPC_EVENTS.UNPROTECT_FILE, (event, filePath) => {
		if (tempFileManager) {
			return tempFileManager.unprotectFile(filePath);
		}
		return false;
	});

	// Seçim penceresini kapatma olayı
	ipcMain.on("CLOSE_SELECTION_WINDOW", () => {
		console.log("[Main] CLOSE_SELECTION_WINDOW olayı alındı");
		if (selectionManager) {
			try {
				console.log("[Main] Seçim penceresi kapatılıyor (ESC tuşu)");
				selectionManager.closeSelectionWindow();
			} catch (error) {
				console.error("[Main] Pencere kapatma hatası (ESC):", error);
			}
		}
	});

	// OPEN_EDITOR_MODE
	ipcMain.on(IPC_EVENTS.OPEN_EDITOR_MODE, (event) => {
		openEditorMode();
	});

	// Mouse tracking için yardımcı fonksiyonlar
	function mapCursorType(systemCursor) {
		if (!systemCursor || typeof systemCursor !== "string") {
			return "default";
		}

		const cursorLower = systemCursor.toLowerCase();

		if (cursorLower.includes("pointer") || cursorLower.includes("hand")) {
			return "pointer";
		} else if (cursorLower.includes("text") || cursorLower.includes("ibeam")) {
			return "text";
		} else if (cursorLower.includes("grab")) {
			return "grab";
		} else if (
			cursorLower.includes("grabbing") ||
			cursorLower.includes("closed")
		) {
			return "grabbing";
		} else if (
			cursorLower.includes("resize") ||
			cursorLower.includes("split")
		) {
			return "resize";
		}

		return "default";
	}

	safeHandle(IPC_EVENTS.GET_PROTECTED_FILES, () => {
		if (tempFileManager) {
			return tempFileManager.getProtectedFiles();
		}
		return [];
	});

	// Kamera cihazı değişikliğini dinle
	ipcMain.on(IPC_EVENTS.CAMERA_DEVICE_CHANGED, (event, deviceId) => {
		console.log("[main.cjs] Kamera cihazı değişikliği alındı:", deviceId);
		if (cameraManager) {
			cameraManager.updateCameraDevice(deviceId);
		}
	});

	// Handle screenshot saving
	safeHandle(IPC_EVENTS.SAVE_SCREENSHOT, async (event, imageData, filePath) => {
		try {
			if (!imageData || !filePath) {
				return { success: false, error: "Invalid image data or file path" };
			}

			// Remove data:image/png;base64, prefix if it exists
			const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");

			// Write the file
			const fs = require("fs");
			fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

			return { success: true };
		} catch (error) {
			console.error("Error saving screenshot:", error);
			return { success: false, error: error.message };
		}
	});

	// Desktop capturer - Sadece MacRecorder
	safeHandle(IPC_EVENTS.DESKTOP_CAPTURER_GET_SOURCES, async (event, opts) => {
		try {
			console.log("[Main] ✅ MacRecorder kaynakları alınıyor...");

			// Direkt MacRecorder kullan - fallback yok
			const MacRecorder = require("node-mac-recorder");
			const recorder = new MacRecorder();
			console.log("[Main] ✅ MacRecorder instance oluşturuldu");

			const sources = [];

			// Ekranları al
			if (!opts.types || opts.types.includes("screen")) {
				try {
					console.log("[Main] MacRecorder displays alınıyor...");
					const displays = await recorder.getDisplays();
					console.log("[Main] MacRecorder displays:", displays);

					displays.forEach((display, index) => {
						sources.push({
							id: `screen:${display.id || index}`,
							name: display.name || `Display ${index + 1}`,
							type: "screen",
							macRecorderId: display.id || index,
							macRecorderInfo: display,
							thumbnail: null,
						});
					});
				} catch (error) {
					console.error("[Main] MacRecorder displays hatası:", error);
					throw error;
				}
			}

			// Pencereleri al
			if (!opts.types || opts.types.includes("window")) {
				try {
					console.log("[Main] MacRecorder windows alınıyor...");
					const windows = await recorder.getWindows();
					console.log("[Main] MacRecorder windows:", windows);

					windows.forEach((window) => {
						sources.push({
							id: `window:${window.id}`,
							name: window.appName || window.name || `Window ${window.id}`,
							type: "window",
							macRecorderId: window.id,
							macRecorderInfo: window,
							thumbnail: null,
						});
					});
				} catch (error) {
					console.error("[Main] MacRecorder windows hatası:", error);
					throw error;
				}
			}

			console.log(
				"[Main] ✅ MacRecorder toplam kaynak sayısı:",
				sources.length
			);
			return sources;
		} catch (error) {
			console.error("[Main] ❌ MacRecorder hatası:", error);
			throw error;
		}
	});

	// Reset
	ipcMain.on(IPC_EVENTS.RESET_FOR_NEW_RECORDING, () => {
		if (selectionManager) selectionManager.resetSelection();
		if (editorManager) editorManager.hideEditorWindow();
		if (mainWindow) mainWindow.show();
		if (cameraManager) cameraManager.showCameraWindow();
		tempFileManager.cleanupAllFiles();
	});

	// Audio Settings
	ipcMain.on(IPC_EVENTS.UPDATE_AUDIO_SETTINGS, (event, settings) => {
		if (mediaStateManager) {
			mediaStateManager.updateAudioSettings(settings);
		}
	});

	safeHandle(IPC_EVENTS.GET_AUDIO_SETTINGS, () => {
		if (mediaStateManager) {
			return mediaStateManager.state.audioSettings;
		}
		return null;
	});

	// Window dragging
	ipcMain.on(IPC_EVENTS.START_WINDOW_DRAG, (event, mousePos) => {
		isDragging = true;
		const win = BrowserWindow.fromWebContents(event.sender);
		const winPos = win.getPosition();
		dragOffset = {
			x: mousePos.x - winPos[0],
			y: mousePos.y - winPos[1],
		};

		// Mouse pozisyonunu kaydet
		mousePosition = mousePos;

		console.log("[Main] Pencere sürükleme başladı:", {
			mousePos,
			winPos,
			dragOffset,
		});
	});

	ipcMain.on(IPC_EVENTS.WINDOW_DRAGGING, (event, mousePos) => {
		if (!isDragging) return;
		const win = BrowserWindow.fromWebContents(event.sender);
		if (!win) return;

		// Mouse pozisyonunu güncelle
		mousePosition = mousePos;

		win.setPosition(mousePos.x - dragOffset.x, mousePos.y - dragOffset.y);
	});

	ipcMain.on(IPC_EVENTS.END_WINDOW_DRAG, () => {
		isDragging = false;
	});
}

async function createWindow() {
	if (isDev) {
		try {
			// Development modunda Nuxt server'ın çalıştığı portu tespit et
			// Script tarafından başlatılan Nuxt server'ı bekle
			let detectedPort = null;
			console.log("[Main] Nuxt server'ın hazır olması bekleniyor...");

			for (let port = 3002; port <= 3020; port++) {
				console.log(`[Main] Port ${port} kontrol ediliyor...`);
				try {
					await waitOn({
						resources: [`http://127.0.0.1:${port}`],
						timeout: 3000, // Timeout'u artırdık
					});
					detectedPort = port;
					console.log(`[Main] ✅ Nuxt server port ${port}'da bulundu!`);
					break;
				} catch (e) {
					console.log(`[Main] ❌ Port ${port}'da server bulunamadı`);
				}
			}

			if (!detectedPort) {
				console.error("[Main] ❌ Hiçbir portta Nuxt server bulunamadı!");
				throw new Error("Çalışan Nuxt server bulunamadı");
			}

			global.serverPort = detectedPort;
			portManager.currentPort = detectedPort;
			console.log(
				`[Main] 🎉 Nuxt server port ${detectedPort}'da tespit edildi`
			);
		} catch (err) {
			console.error("Nuxt sunucusu başlatılamadı:", err);
			app.quit();
			return;
		}
	} else {
		// Üretim modunda Express sunucusunu başlat
		try {
			await startExpressServer();
		} catch (err) {
			console.error("Express sunucusu başlatılamadı:", err);
			app.quit();
			return;
		}
	}

	mainWindow = new BrowserWindow({
		width: 920,
		height: 70,
		alwaysOnTop: true,
		resizable: false,
		skipTaskbar: false,
		frame: false,

		transparent: true,
		hasShadow: true,
		movable: true,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, "preload.cjs"),
			webSecurity: true,
			allowRunningInsecureContent: true,
			webviewTag: true,
			additionalArguments: ["--disable-site-isolation-trials"],
		},
	});

	setupSecurityPolicies();
	initializeManagers();
	setupWindowEvents();
	loadApplication();

	// Add CSP headers
	mainWindow.webContents.session.webRequest.onHeadersReceived(
		(details, callback) => {
			callback({
				responseHeaders: {
					...details.responseHeaders,
					"Content-Security-Policy": [
						"default-src 'self' http://localhost:* file: data: electron: blob: 'unsafe-inline' 'unsafe-eval' https://storage.googleapis.com https://*.tensorflow.org;",
					],
				},
			});
		}
	);
}

function setupSecurityPolicies() {
	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		callback({
			responseHeaders: {
				...details.responseHeaders,
				"Content-Security-Policy": [
					"default-src 'self' http://localhost:* file: data: electron: blob: 'unsafe-inline' 'unsafe-eval' https://storage.googleapis.com https://*.tensorflow.org; " +
						"script-src 'self' http://localhost:* file: data: electron: blob: 'unsafe-inline' 'unsafe-eval' https://storage.googleapis.com https://*.tensorflow.org; " +
						"connect-src 'self' http://localhost:* file: data: electron: blob: https://storage.googleapis.com https://*.tensorflow.org; " +
						"img-src 'self' http://localhost:* file: data: electron: blob:; " +
						"style-src 'self' http://localhost:* file: data: electron: blob: 'unsafe-inline'; " +
						"font-src 'self' http://localhost:* file: data: electron: blob:; " +
						"media-src 'self' http://localhost:* file: data: electron: blob:;",
				],
			},
		});
	});

	// Protokolleri kaydet
	protocol.registerFileProtocol("file", (request, callback) => {
		const fileUrl = new URL(request.url);
		const filePath = decodeURIComponent(fileUrl.pathname);
		const normalizedPath =
			process.platform === "win32" ? filePath.substr(1) : filePath;

		console.log(`[Main] Dosya protokolü isteği: ${normalizedPath}`);
		callback({ path: normalizedPath });
	});

	// Electron protokolü için handler ekle
	protocol.registerFileProtocol("electron", (request, callback) => {
		const url = new URL(request.url);
		const filePath = url.pathname;
		console.log(`[Main] Electron protokolü isteği: ${filePath}`);
		callback({ path: filePath });
	});
}

function initializeManagers() {
	cameraManager = new CameraManager(mainWindow);
	selectionManager = new SelectionManager(mainWindow);
	editorManager = new EditorManager(mainWindow);
	tempFileManager = new TempFileManager(mainWindow);
	mediaStateManager = new MediaStateManager(mainWindow);
	trayManager = new TrayManager(mainWindow, openEditorMode);

	// Tray ekle
	trayManager.createTray();

	// Kamera penceresini başlat
	cameraManager.initializeCamera();
}

function setupWindowEvents() {
	mainWindow.on("closed", () => {
		if (cameraManager) {
			cameraManager.cleanup();
		}
		mainWindow = null;
	});

	mainWindow.on("close", (event) => {
		console.log("[Main] Pencere kapatılıyor, isQuitting:", app.isQuitting);

		if (!app.isQuitting) {
			// Sadece uygulama gerçekten kapanmıyorsa engelle
			event.preventDefault();
			mainWindow.hide();
			return false;
		}

		// Uygulama kapanıyorsa, burada bir şey yapmıyoruz
		// before-quit event handler'ında temizlik zaten yapılıyor
	});
}

function loadApplication() {
	if (isDev) {
		mainWindow.loadURL(portManager.getUrl());
		mainWindow.webContents.openDevTools({ mode: "detach" });
	} else {
		try {
			// Express sunucusunu kullan - bu daha stabil
			const serverUrl = `http://localhost:${global.serverPort}`;
			console.log(`[Main] Express ile yükleniyor: ${serverUrl}`);
			mainWindow.loadURL(serverUrl);

			// Hata ayıklama için DevTools aç (gerekirse)
			// mainWindow.webContents.openDevTools({ mode: "detach" });
		} catch (error) {
			console.error("[Main] Uygulama yüklenirken hata:", error);

			// Fallback - doğrudan dosyadan yüklemeyi dene
			try {
				// Olası dosya yollarını dene
				const possiblePaths = [
					path.join(process.resourcesPath, "public/index.html"),
					path.join(
						process.resourcesPath,
						"app.asar/.output/public/index.html"
					),
					path.join(process.resourcesPath, "app/.output/public/index.html"),
					path.join(app.getAppPath(), ".output/public/index.html"),
					path.join(__dirname, "../.output/public/index.html"),
				];

				let indexPath = null;
				for (const testPath of possiblePaths) {
					console.log(`[Main] Test ediliyor: ${testPath}`);
					if (fs.existsSync(testPath)) {
						indexPath = testPath;
						console.log(`[Main] Geçerli index.html bulundu: ${indexPath}`);
						break;
					}
				}

				if (indexPath) {
					console.log(`[Main] Doğrudan dosyadan yükleniyor: ${indexPath}`);
					mainWindow.loadFile(indexPath);
				} else {
					throw new Error("Hiçbir geçerli index.html bulunamadı");
				}
			} catch (fallbackError) {
				console.error("[Main] Fallback yükleme hatası:", fallbackError);

				// Hata sayfası göster
				mainWindow.loadURL(`data:text/html,
					<html>
						<head>
							<meta charset="utf-8">
							<title>Sleer - Hata</title>
							<style>
								body {
									font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
									background-color: #1E293B;
									color: white;
									display: flex;
									flex-direction: column;
									align-items: center;
									justify-content: center;
									height: 100vh;
									margin: 0;
									padding: 20px;
									text-align: center;
								}
								h1 { color: #ff5555; margin-bottom: 10px; }
								pre { 
									background: #2c3e50; 
									padding: 15px; 
									border-radius: 4px; 
									max-width: 600px; 
									white-space: pre-wrap;
									text-align: left;
									overflow-x: auto;
								}
							</style>
						</head>
						<body>
							<h1>Uygulama Yüklenirken Hata Oluştu</h1>
							<p>Lütfen uygulamayı yeniden başlatın veya geliştirici ile iletişime geçin.</p>
							<pre>${error.stack || error.message || "Bilinmeyen hata"}</pre>
							<pre>
Fallback hatası: ${fallbackError.message}

Aranılan yollar:
${possiblePaths.join("\n")}
							</pre>
						</body>
					</html>
				`);
			}
		}
	}
}

// Preload script yolunu doğru şekilde belirleyen yardımcı fonksiyon
function getPreloadPath() {
	console.log("[Main] Preload yolu belirleniyor...");

	// Olası preload yolları
	const possiblePaths = [
		path.join(__dirname, "preload.cjs"),
		path.join(process.resourcesPath, "app.asar/electron/preload.cjs"),
		path.join(process.resourcesPath, "app/electron/preload.cjs"),
		path.join(app.getAppPath(), "electron/preload.cjs"),
	];

	// Her yolu kontrol et
	for (const preloadPath of possiblePaths) {
		const exists = fs.existsSync(preloadPath);
		console.log(
			`[Main] Preload yolu kontrol: ${preloadPath}, Mevcut: ${exists}`
		);
		if (exists) {
			console.log(`[Main] Preload yolu belirlendi: ${preloadPath}`);
			return preloadPath;
		}
	}

	// Varsayılan yol
	console.error(
		"[Main] Hiçbir preload yolu bulunamadı! Varsayılan kullanılıyor."
	);
	return path.join(__dirname, "preload.cjs");
}

// App lifecycle events
app.whenReady().then(() => {
	// Uygulama kapanma değişkenini false olarak ayarla
	app.isQuitting = false;

	// Initialize DockManager early
	console.log("[Main] Initializing DockManager...");
	dockManager = new DockManager();

	// İzinleri başlangıçta kontrol et ve iste
	checkAndRequestPermissions();
	createWindow();
	setupIpcHandlers();
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	if (mainWindow === null) {
		createWindow();
	} else {
		mainWindow.show();
	}
});

app.on("before-quit", () => {
	console.log("[Main] Uygulama kapanıyor, isQuitting = true");
	app.isQuitting = true;

	// Temizlik işlemleri burada yapılıyor, ancak uygulamayı bloklamaması için
	// direkt olarak kapanmaya izin veriyoruz
	try {
		// Fare takibini durdur
		if (isTracking) {
			console.log("[Main] Fare takibi durduruluyor...");
			uIOhook.stop();
			isTracking = false;
		}

		// HTTP sunucusunu kapat
		if (httpServer) {
			console.log("[Main] HTTP sunucusu kapatılıyor...");
			httpServer.close();
		}

		// Diğer manager'ları temizle
		if (cameraManager) cameraManager.cleanup();
		if (trayManager) trayManager.cleanup();
		if (tempFileManager) tempFileManager.cleanupAllFiles();

		console.log("[Main] Tüm kaynaklar temizlendi");
	} catch (error) {
		console.error("[Main] Temizleme işlemi sırasında hata:", error);
	}
});

function startMouseTracking() {
	console.log("Mouse tracking başlatılıyor, delay:", recordingDelay);

	if (!isTracking) {
		isTracking = true;
		startTime = Date.now();

		// Mouse hareketi
		uIOhook.on("mousemove", (event) => {
			if (!isTracking) return;
			const currentTime = Date.now() - startTime;

			mediaStateManager.addMousePosition({
				x: event.x,
				y: event.y,
				timestamp: currentTime,
				cursorType: lastCursorType,
				type: "move",
			});
		});

		// Mouse tıklama
		uIOhook.on("mousedown", (event) => {
			if (!isTracking) return;
			const currentTime = Date.now() - startTime;

			mediaStateManager.addMousePosition({
				x: event.x,
				y: event.y,
				timestamp: currentTime,
				cursorType: "pointer",
				type: "mousedown",
				button: event.button,
				clickCount: 1,
				scale: 0.8, // Tıklama anında küçülme
			});

			lastCursorType = "pointer";

			// 100ms sonra normale dön
			setTimeout(() => {
				mediaStateManager.addMousePosition({
					x: event.x,
					y: event.y,
					timestamp: currentTime + 100,
					cursorType: lastCursorType,
					type: "scale",
					scale: 1.1, // Hafif büyüme
				});

				// 200ms'de normal boyuta dön
				setTimeout(() => {
					mediaStateManager.addMousePosition({
						x: event.x,
						y: event.y,
						timestamp: currentTime + 200,
						cursorType: lastCursorType,
						type: "scale",
						scale: 1,
					});
				}, 100);
			}, 100);
		});

		// Mouse bırakma
		uIOhook.on("mouseup", (event) => {
			if (!isTracking) return;
			const currentTime = Date.now() - startTime;

			mediaStateManager.addMousePosition({
				x: event.x,
				y: event.y,
				timestamp: currentTime,
				cursorType: "default",
				type: "mouseup",
				button: event.button,
			});

			lastCursorType = "default";
		});

		// Mouse tekerleği
		uIOhook.on("wheel", (event) => {
			if (!isTracking) return;
			const currentTime = Date.now() - startTime;

			mediaStateManager.addMousePosition({
				x: event.x,
				y: event.y,
				timestamp: currentTime,
				cursorType: lastCursorType,
				type: "wheel",
				rotation: event.rotation,
				direction: event.direction,
			});
		});

		// Mouse sürükleme
		uIOhook.on("mousedrag", (event) => {
			if (!isTracking) return;
			const currentTime = Date.now() - startTime;

			mediaStateManager.addMousePosition({
				x: event.x,
				y: event.y,
				timestamp: currentTime,
				cursorType: "grabbing",
				type: "drag",
			});

			lastCursorType = "grabbing";
		});

		// Event dinlemeyi başlat
		uIOhook.start();
	}
}

function stopMouseTracking() {
	if (isTracking) {
		isTracking = false;
		startTime = null;
		lastCursorType = "default";

		// Event dinleyicileri temizle
		uIOhook.removeAllListeners("mousemove");
		uIOhook.removeAllListeners("mousedown");
		uIOhook.removeAllListeners("mouseup");
		uIOhook.removeAllListeners("wheel");
		uIOhook.removeAllListeners("mousedrag");

		// Event dinlemeyi durdur
		uIOhook.stop();
	}
}

/**
 * Uygulama başlangıcında gerekli tüm izinleri kontrol eder
 */
async function checkAndRequestPermissions() {
	// macOS'ta izin kontrolü yapılır
	if (process.platform === "darwin") {
		try {
			const { systemPreferences } = require("electron");

			// Sadece izinleri kontrol et, otomatik olarak isteme
			console.log("[Main] Kamera izinleri kontrol ediliyor...");
			const cameraStatus = systemPreferences.getMediaAccessStatus("camera");
			console.log("[Main] Kamera erişim durumu:", cameraStatus);

			console.log("[Main] Mikrofon izinleri kontrol ediliyor...");
			const microphoneStatus =
				systemPreferences.getMediaAccessStatus("microphone");
			console.log("[Main] Mikrofon erişim durumu:", microphoneStatus);

			console.log(
				"[Main] Ekran kaydı için sistem izinleri otomatik olarak istenemez. İlk kayıtta sistem tarafından sorulacaktır."
			);
		} catch (error) {
			console.error("[Main] İzinler kontrol edilirken hata:", error);
		}
	} else {
		console.log("[Main] İzin kontrolü sadece macOS için gereklidir.");
	}
}

/**
 * Mevcut izin durumlarını kontrol eder ve döndürür
 */
async function checkPermissionStatus() {
	// Windows veya Linux'ta izin kontrolü gerekmez
	if (process.platform !== "darwin") {
		return {
			camera: "granted",
			microphone: "granted",
			screen: "granted",
		};
	}

	try {
		const { systemPreferences } = require("electron");

		// Kamera ve mikrofon durumlarını doğrudan kontrol et
		const cameraStatus = systemPreferences.getMediaAccessStatus("camera");
		const microphoneStatus =
			systemPreferences.getMediaAccessStatus("microphone");

		// Ekran kaydı için izin durumu kontrol edilemez, sadece ilk kullanımda sistem tarafından sorulur
		// "unknown" olarak döndür ve UI'da uygun bilgilendirme yap
		const screenStatus = "unknown";

		return {
			camera: cameraStatus,
			microphone: microphoneStatus,
			screen: screenStatus,
		};
	} catch (error) {
		console.error("[Main] İzin durumları kontrol edilirken hata:", error);
		return {
			camera: "unknown",
			microphone: "unknown",
			screen: "unknown",
			error: error.message,
		};
	}
}

// Express sunucusunu başlatma fonksiyonu
async function startExpressServer() {
	return new Promise(async (resolve, reject) => {
		try {
			// Eğer daha önce başlatılmışsa sunucuyu kapat
			if (httpServer) {
				httpServer.close();
			}

			console.log("[Main] Express sunucusu başlatılıyor...");
			// Express uygulamasını oluştur
			expressApp = express();

			// Mevcut yol bilgilerini yazdır
			console.log("[Main] process.resourcesPath:", process.resourcesPath);
			console.log("[Main] app.getAppPath():", app.getAppPath());
			console.log("[Main] __dirname:", __dirname);

			// Statik dosya yollarını kontrol et ve ilk bulunanı kullan
			let staticFound = false;
			let staticPath = null;

			// Olası statik dosya yolları
			const possiblePaths = [
				path.join(process.resourcesPath, "public"), // package.json extraResources ile kopyalanan
				path.join(process.resourcesPath, "app.asar/.output/public"),
				path.join(process.resourcesPath, "app/.output/public"),
				path.join(app.getAppPath(), ".output/public"),
				path.join(__dirname, "../.output/public"),
				path.join(__dirname, "../../.output/public"),
			];

			// Her birini dene ve ilk bulunanı kullan
			for (const testPath of possiblePaths) {
				console.log(`[Main] Statik yol test ediliyor: ${testPath}`);

				try {
					if (
						fs.existsSync(testPath) &&
						fs.existsSync(path.join(testPath, "index.html"))
					) {
						staticPath = testPath;
						staticFound = true;
						console.log(`[Main] Geçerli statik yol bulundu: ${staticPath}`);
						break;
					} else {
						console.log(
							`[Main] Yol mevcut değil veya index.html yok: ${testPath}`
						);

						// Eğer dizin varsa ama index.html yoksa, içeriği göster
						if (fs.existsSync(testPath)) {
							try {
								const files = fs.readdirSync(testPath);
								console.log(`[Main] Dizin içeriği: ${files.join(", ")}`);
							} catch (err) {
								console.error(`[Main] Dizin içeriği okunamadı: ${err.message}`);
							}
						}
					}
				} catch (err) {
					console.error(`[Main] Yol test edilirken hata: ${testPath}`, err);
				}
			}

			// CORS ayarları
			expressApp.use((req, res, next) => {
				res.header("Access-Control-Allow-Origin", "*");
				res.header("Access-Control-Allow-Methods", "GET");
				res.header(
					"Access-Control-Allow-Headers",
					"Content-Type, Authorization"
				);
				// Cache kontrolü ekle
				res.header(
					"Cache-Control",
					"no-store, no-cache, must-revalidate, private"
				);
				res.header("Pragma", "no-cache");
				res.header("Expires", "0");
				next();
			});

			// Her isteği logla
			expressApp.use((req, res, next) => {
				console.log(`[Express] ${req.method} ${req.url}`);
				next();
			});

			if (staticPath) {
				// Statik dosyaları serve et
				console.log(`[Main] Statik dosyalar sunuluyor: ${staticPath}`);

				expressApp.use(
					express.static(staticPath, {
						etag: false, // ETag'leri devre dışı bırak
						lastModified: false, // Last-Modified başlıklarını devre dışı bırak
						setHeaders: (res) => {
							// Her statik dosya için cache kontrolü
							res.setHeader(
								"Cache-Control",
								"no-store, no-cache, must-revalidate, private"
							);
							res.setHeader("Pragma", "no-cache");
							res.setHeader("Expires", "0");
						},
					})
				);

				// Özel rotalar - sayfa yolları için catch-all route
				expressApp.get("*", (req, res) => {
					console.log(`[Express] Catch-all route: ${req.url}`);
					const indexPath = path.join(staticPath, "index.html");

					if (fs.existsSync(indexPath)) {
						// response header'larını ayarlayalım
						res.set(
							"Cache-Control",
							"no-store, no-cache, must-revalidate, private"
						);
						res.set("Pragma", "no-cache");
						res.set("Expires", "0");
						res.sendFile(indexPath);
					} else {
						console.error(`[Express] index.html bulunamadı: ${indexPath}`);
						res.status(404).send("index.html bulunamadı");
					}
				});
			} else {
				console.warn("[Main] Statik yol bulunamadı, fallback içerik sunuluyor");

				// Express middleware'ler
				expressApp.use(express.json());

				// Ana sayfayı oluştur
				expressApp.get("*", (req, res) => {
					console.log(`[Express] GET isteği: ${req.url}`);
					res.send(`
						<!DOCTYPE html>
						<html>
						<head>
							<meta charset="utf-8">
							<title>Sleer</title>
							<meta name="viewport" content="width=device-width, initial-scale=1">
							<style>
								body { 
									font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
									background-color: #1E293B; 
									color: white;
									display: flex;
									flex-direction: column;
									align-items: center;
									justify-content: center;
									height: 100vh;
									margin: 0;
									padding: 20px;
									text-align: center;
								}
								h1 { font-size: 24px; margin-bottom: 10px; }
								p { font-size: 16px; max-width: 600px; line-height: 1.5; }
							</style>
						</head>
						<body>
							<h1>Sleer Başlatılıyor</h1>
							<p>Uygulama kaynak dosyaları bulunamadı. Lütfen uygulamayı yeniden yükleyin veya geliştirici ile iletişime geçin.</p>
							<pre>
Aranılan yollar:
${possiblePaths.join("\n")}
							</pre>
						</body>
						</html>
					`);
				});
			}

			// HTTP sunucusu oluştur ve başlat
			httpServer = http.createServer(expressApp);

			// PortManager ile kullanılabilir port bul
			try {
				const availablePort = await portManager.findAvailablePort();

				httpServer.listen(availablePort, "127.0.0.1", () => {
					// Port numarasını global değişkene ekle
					global.serverPort = availablePort;
					console.log(
						`[Main] Express sunucusu ${portManager.getUrl()} adresinde başlatıldı`
					);
					resolve(availablePort);
				});

				httpServer.on("error", (err) => {
					console.error(`[Main] HTTP sunucusu başlatılırken hata:`, err);
					reject(err);
				});
			} catch (error) {
				console.error(`[Main] Kullanılabilir port bulunamadı:`, error);
				reject(error);
			}
		} catch (error) {
			console.error("[Main] Express sunucu başlatma hatası:", error);
			reject(error);
		}
	});
}
