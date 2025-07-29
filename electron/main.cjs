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
const FFmpegWrapper = require("./ffmpegWrapper.cjs");

// FFmpeg wrapper instance
const ffmpegWrapper = new FFmpegWrapper();

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

// Global process tracking
global.ffmpegProcesses = [];

// Giphy API handler for secure API calls - registered early
ipcMain.handle("search-gifs", async (event, query) => {
	console.log("IPC: Searching for GIFs with query:", query);
	try {
		const url = `https://api.giphy.com/v1/gifs/search?api_key=DCabEPYut33Xk4DzYdL44AXsRcUAKjPp&q=${encodeURIComponent(
			query
		)}&limit=20&offset=0&rating=pg&lang=en`;
		console.log("IPC: Making request to:", url);

		const request = net.request({
			method: "GET",
			url: url,
		});

		return new Promise((resolve, reject) => {
			let data = "";

			request.on("response", (response) => {
				console.log("IPC: Got response with status:", response.statusCode);

				response.on("data", (chunk) => {
					data += chunk;
				});

				response.on("end", () => {
					try {
						const parsedData = JSON.parse(data);
						console.log(
							"IPC: Successfully parsed response, found",
							parsedData.data?.length || 0,
							"GIFs"
						);
						resolve(parsedData);
					} catch (error) {
						console.error("IPC: Error parsing response:", error);
						reject(error);
					}
				});
			});

			request.on("error", (error) => {
				console.error("IPC: Network error:", error);
				reject(error);
			});

			request.end();
		});
	} catch (error) {
		console.error("IPC: Error fetching GIFs:", error);
		throw error;
	}
});

// Synchronized Recording Service
class SynchronizedRecordingService {
	constructor() {
		this.masterStartTime = null;
		this.recordingStartTimes = {
			screen: null,
			camera: null,
			mouse: null,
		};
		this.offsets = {
			screen: 0,
			camera: 0,
			mouse: 0,
		};
		this.isRecording = false;
		this.recordingId = null;
		this.syncTolerance = 50;
	}

	startRecordingSession() {
		this.masterStartTime = Date.now();
		this.recordingId = `rec_${this.masterStartTime}`;
		this.isRecording = true;

		this.offsets = { screen: 0, camera: 0, mouse: 0 };
		this.recordingStartTimes = { screen: null, camera: null, mouse: null };

		console.log(
			`[SynchronizedRecording] Kayıt oturumu başlatıldı: ${this.recordingId}, master time: ${this.masterStartTime}`
		);

		return {
			recordingId: this.recordingId,
			masterStartTime: this.masterStartTime,
		};
	}

	recordStartTime(recordingType, customStartTime = null) {
		if (!this.isRecording) {
			throw new Error("Kayıt oturumu başlatılmamış");
		}

		const startTime = customStartTime || Date.now();
		this.recordingStartTimes[recordingType] = startTime;
		this.offsets[recordingType] = startTime - this.masterStartTime;

		console.log(
			`[SynchronizedRecording] ${recordingType} başlangıç zamanı kaydedildi:`,
			{
				startTime: new Date(startTime).toISOString(),
				offset: this.offsets[recordingType],
				masterTime: new Date(this.masterStartTime).toISOString(),
			}
		);

		return {
			startTime,
			offset: this.offsets[recordingType],
			masterStartTime: this.masterStartTime,
		};
	}

	getSynchronizedTimestamp(recordingType, relativeTime) {
		if (!this.isRecording || !this.recordingStartTimes[recordingType]) {
			return relativeTime;
		}
		const synchronizedTime = relativeTime - this.offsets[recordingType];
		return Math.max(0, synchronizedTime);
	}

	stopRecordingSession() {
		const finalSyncData = {
			recordingId: this.recordingId,
			masterStartTime: this.masterStartTime,
			recordingStartTimes: { ...this.recordingStartTimes },
			offsets: { ...this.offsets },
		};

		this.isRecording = false;
		this.masterStartTime = null;
		this.recordingId = null;

		console.log("[SynchronizedRecording] Kayıt oturumu sonlandırıldı");
		return finalSyncData;
	}
}

const synchronizedRecording = new SynchronizedRecordingService();

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

// Not: Mouse tracking removed - handled by MacRecorder
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

// Cursor tracking state için global değişkenler - Yeni cursor capture API
let cursorTrackingState = {
	isTracking: false,
	outputPath: null,
	startTime: null,
};

// MacRecorder instance getter
function getMacRecorderInstance(forceReset = false) {
	console.log("[Main] getMacRecorderInstance çağrıldı", {
		forceReset,
		hasInstance: !!globalMacRecorder,
	});

	if (forceReset && globalMacRecorder) {
		console.log("[Main] Force reset - önceki instance temizleniyor...");
		try {
			// Eğer tracking yapıyorsa durdur
			if (typeof globalMacRecorder.stopCursorTracking === "function") {
				globalMacRecorder.stopCursorTracking().catch(() => {});
			}
		} catch (err) {
			console.warn("[Main] Force reset cleanup hatası:", err.message);
		}
		globalMacRecorder = null;
	}

	if (!globalMacRecorder) {
		try {
			console.log("[Main] Yeni MacRecorder instance oluşturuluyor...");

			const MacRecorder = require("node-mac-recorder");
			globalMacRecorder = new MacRecorder();
			console.log("[Main] ✅ MacRecorder instance başarıyla oluşturuldu");

			// Event system setup - README'den eklendi
			globalMacRecorder.on("started", (outputPath) => {
				console.log("[MacRecorder] Kayıt başladı:", outputPath);

				// Ana pencereye bildir
				if (mainWindow && mainWindow.webContents) {
					mainWindow.webContents.send("MAC_RECORDING_STARTED", { outputPath });
				}

				// Kamera penceresine bildir
				if (
					cameraManager &&
					cameraManager.cameraWindow &&
					cameraManager.cameraWindow.webContents
				) {
					cameraManager.cameraWindow.webContents.send("MAC_RECORDING_STARTED", {
						outputPath,
					});
				}
			});

			globalMacRecorder.on("stopped", (result) => {
				console.log("[MacRecorder] Kayıt durdu:", result);

				// Ana pencereye bildir
				if (mainWindow && mainWindow.webContents) {
					mainWindow.webContents.send("MAC_RECORDING_STOPPED", result);
				}

				// Kamera penceresine bildir
				if (
					cameraManager &&
					cameraManager.cameraWindow &&
					cameraManager.cameraWindow.webContents
				) {
					cameraManager.cameraWindow.webContents.send(
						"MAC_RECORDING_STOPPED",
						result
					);
				}
			});

			globalMacRecorder.on("timeUpdate", (seconds) => {
				console.log(`[MacRecorder] Kayıt süresi: ${seconds}s`);

				// Ana pencereye bildir
				if (mainWindow && mainWindow.webContents) {
					mainWindow.webContents.send("MAC_RECORDING_TIME_UPDATE", { seconds });
				}

				// Kamera penceresine bildir
				if (
					cameraManager &&
					cameraManager.cameraWindow &&
					cameraManager.cameraWindow.webContents
				) {
					cameraManager.cameraWindow.webContents.send(
						"MAC_RECORDING_TIME_UPDATE",
						{ seconds }
					);
				}
			});

			globalMacRecorder.on("completed", (outputPath) => {
				console.log("[MacRecorder] Kayıt tamamlandı:", outputPath);

				// Ana pencereye bildir
				if (mainWindow && mainWindow.webContents) {
					mainWindow.webContents.send("MAC_RECORDING_COMPLETED", {
						outputPath,
					});
				}

				// Kamera penceresine bildir
				if (
					cameraManager &&
					cameraManager.cameraWindow &&
					cameraManager.cameraWindow.webContents
				) {
					cameraManager.cameraWindow.webContents.send(
						"MAC_RECORDING_COMPLETED",
						{ outputPath }
					);
				}
			});

			globalMacRecorder.on("error", (error) => {
				console.error("[MacRecorder] Kayıt hatası:", error);

				// Ana pencereye bildir
				if (mainWindow && mainWindow.webContents) {
					mainWindow.webContents.send("MAC_RECORDING_ERROR", {
						error: error.message,
					});
				}

				// Kamera penceresine bildir
				if (
					cameraManager &&
					cameraManager.cameraWindow &&
					cameraManager.cameraWindow.webContents
				) {
					cameraManager.cameraWindow.webContents.send("MAC_RECORDING_ERROR", {
						error: error.message,
					});
				}
			});

			console.log("[Main] MacRecorder event listeners kuruldu");
		} catch (error) {
			console.error("[Main] MacRecorder yüklenirken hata:", error.message);
			globalMacRecorder = null;
			return null;
		}
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

// Eski START_MAC_RECORDING handler kaldırıldı - Yeni handler aşağıda

/*
OLD_safeHandle(
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
				// README - İzinleri kontrol et (kritik)
				console.log("[Main] MacRecorder izinleri kontrol ediliyor...");
				try {
					const permissions = await recorder.checkPermissions();
					console.log("[Main] MacRecorder izinleri:", permissions);

					if (!permissions.screenRecording) {
						console.error(
							"[Main] ❌ Ekran kaydı izni yok! macOS System Preferences'den izin verin"
						);
						console.error(
							"[Main] Sistem Ayarları > Gizlilik ve Güvenlik > Ekran Kaydı > Creavit Studio'yu etkinleştirin"
						);
						return false;
					}

					console.log("[Main] ✅ Ekran kaydı izni mevcut");
				} catch (permError) {
					console.warn("[Main] İzin kontrolü yapılamadı:", permError.message);
					console.warn("[Main] Devam ediliyor, ancak kayıt başarısız olabilir");
				}

				// MacRecorder için doğru format - README'den optimize edildi
				const macRecorderOptions = {
					// Ses ayarları (README'den) - önce ayarla
					includeMicrophone: false, // Varsayılan kapalı
					includeSystemAudio: true, // Varsayılan açık (sistem sesi)

					// Display/Window seçimi (null = ana ekran)
					displayId: null,
					windowId: null, // README'den eklendi

					// Kırpma alanı seçimi (README'den)
					captureArea: null,

					// Kalite ve performans ayarları (README seçenekleri)
					quality: options.quality || "high", // 'low', 'medium', 'high'
					frameRate: options.frameRate || options.fps || 30, // 15, 30, 60
					captureCursor: options.captureCursor || false, // Cursor gösterimi
				};

				// MediaStateManager'dan ses ayarlarını al
				if (mediaStateManager) {
					const audioSettings = mediaStateManager.state.audioSettings;
					macRecorderOptions.includeMicrophone =
						audioSettings.microphoneEnabled || false;
					macRecorderOptions.includeSystemAudio =
						audioSettings.systemAudioEnabled !== false; // varsayılan true

					console.log("[Main] Ses ayarları MacRecorder'a uygulandı:", {
						includeMicrophone: macRecorderOptions.includeMicrophone,
						includeSystemAudio: macRecorderOptions.includeSystemAudio,
					});
				}

				// Kaynak türüne göre uygun seçeneği belirle (README best practices)
				if (recordingSource && recordingSource.macRecorderId !== null) {
					if (recordingSource.sourceType === "window") {
						// Pencere kaydı için windowId kullan (README'den)
						const windowId = parseInt(recordingSource.macRecorderId, 10);
						if (!isNaN(windowId)) {
							macRecorderOptions.windowId = windowId;
							macRecorderOptions.displayId = null; // Window recording'de displayId null olmalı
							console.log("[Main] MacRecorder windowId ayarlandı:", windowId);
						}
					} else {
						// Ekran kaydı için displayId kullan
						const screenId = parseInt(recordingSource.macRecorderId, 10);
						if (!isNaN(screenId)) {
							macRecorderOptions.displayId = screenId;
							console.log("[Main] MacRecorder displayId ayarlandı:", screenId);
						}
					}
				}

				// Seçilen alan varsa captureArea olarak ekle (README format)
				if (mediaStateManager && mediaStateManager.state.selectedArea) {
					const selectedArea = mediaStateManager.state.selectedArea;
					if (
						selectedArea &&
						selectedArea.width > 0 &&
						selectedArea.height > 0
					) {
						macRecorderOptions.captureArea = {
							x: Math.round(selectedArea.x),
							y: Math.round(selectedArea.y),
							width: Math.round(selectedArea.width),
							height: Math.round(selectedArea.height),
						};
						// Alan kaydında display/window ID'sini temizle (README'den)
						macRecorderOptions.displayId = null;
						macRecorderOptions.windowId = null;
						console.log(
							"[Main] Kırpma alanı MacRecorder'a eklendi:",
							macRecorderOptions.captureArea
						);
					}
				}

				// README'den - Performans optimizasyonları
				if (macRecorderOptions.quality === "low") {
					macRecorderOptions.frameRate = Math.min(
						macRecorderOptions.frameRate,
						15
					);
				} else if (macRecorderOptions.quality === "medium") {
					macRecorderOptions.frameRate = Math.min(
						macRecorderOptions.frameRate,
						30
					);
				}

				// README'den - Geçersiz kombinasyonları temizle
				if (macRecorderOptions.windowId && macRecorderOptions.displayId) {
					console.warn(
						"[Main] Hem windowId hem displayId ayarlanmış, windowId tercih ediliyor"
					);
					macRecorderOptions.displayId = null;
				}

				console.log("[Main] Final MacRecorder options:", macRecorderOptions);

				console.log("[Main] MacRecorder kayıt başlatılıyor:", {
					outputPath,
					options: macRecorderOptions,
				});

				// MacRecorder instance durumunu kontrol et
				console.log("[Main] MacRecorder instance kontrol:", {
					isRecording: recorder.isRecording || "property yok",
					methods: Object.getOwnPropertyNames(Object.getPrototypeOf(recorder)),
				});

				// README debug information - module info
				try {
					console.log("[Main] MacRecorder module info kontrol ediliyor...");
					// Module info almanın bir yolu yoksa method listesini gösterelim
					const availableMethods = Object.getOwnPropertyNames(recorder)
						.concat(Object.getOwnPropertyNames(Object.getPrototypeOf(recorder)))
						.filter((name, index, arr) => arr.indexOf(name) === index); // unique
					console.log("[Main] MacRecorder mevcut metodlar:", availableMethods);
				} catch (infoError) {
					console.warn(
						"[Main] MacRecorder module info alınamadı:",
						infoError.message
					);
				}

				// MacRecorder'ın status metoduna test için erişmeye çalış
				try {
					const status = recorder.getStatus();
					console.log("[Main] MacRecorder status:", status);
				} catch (statusError) {
					console.log(
						"[Main] MacRecorder status alınamadı (normal):",
						statusError.message
					);
				}

				console.log("[Main] recorder.startRecording() çağrılıyor...");
				console.log("[Main] Process architecture:", process.arch);
				console.log("[Main] Node.js version:", process.version);

				// README'den basit test - problemi debug etmek için
				console.log("[Main] MacRecorder simple test başlatılıyor...");

				// DEBUG: Test'te çalışan exact seçenekleri kullanıyoruz
				const testOptions = {
					includeMicrophone: false,
					includeSystemAudio: false,
					displayId: null, // Ana ekran
					quality: "low",
					frameRate: 15,
					captureCursor: false,
				};

				console.log(
					"[Main] 🔧 DEBUG: Test'te çalışan seçenekleri kullanıyoruz"
				);
				console.log("[Main] Test options:", testOptions);
				console.log("[Main] Output path:", outputPath);
				console.log("[Main] Output path type:", typeof outputPath);
				console.log("[Main] Output path length:", outputPath?.length);

				const result = await recorder.startRecording(outputPath, testOptions);
				console.log("[Main] 🔧 MacRecorder start result:", result);
				console.log("[Main] 🔧 Result type:", typeof result);
				console.log("[Main] 🔧 Result keys:", Object.keys(result || {}));
				console.log("[Main] MacRecorder kayıt sonrası durum:", {
					isRecording: recorder.isRecording || "property yok",
				});

				// Test'te gördük ki result bir object döner: { outputPath: "...", code: 0 }
				// String değil! Result'ı düzgün handle edelim
				const actualOutputPath =
					result && typeof result === "object"
						? result.outputPath || result
						: result;
				console.log("[Main] 🔧 Actual output path:", actualOutputPath);

				// README best practice - Gelişmiş dosya monitoring
				let lastSize = 0;
				let sizeCheckCount = 0;
				const checkInterval = setInterval(() => {
					if (fs.existsSync(outputPath)) {
						const stats = fs.statSync(outputPath);
						const currentSize = stats.size;

						console.log(
							`[Main] 📊 Kayıt dosyası: ${outputPath} (${currentSize} bytes)`
						);

						if (currentSize > 0) {
							if (currentSize > lastSize) {
								console.log("[Main] ✅ Dosya büyüyor, kayıt aktif!");
								lastSize = currentSize;
								sizeCheckCount = 0; // Reset count
							} else {
								sizeCheckCount++;
								console.log(
									`[Main] ⚠️ Dosya boyutu aynı kaldı (${sizeCheckCount}/3)`
								);

								// 3 saniye boyunca boyut değişmezse uyar
								if (sizeCheckCount >= 3) {
									console.warn(
										"[Main] ⚠️ Dosya boyutu artmıyor, kayıt problemi olabilir"
									);
									clearInterval(checkInterval);
								}
							}
						} else {
							console.warn("[Main] ⚠️ Dosya hala boş");
						}
					} else {
						console.warn(
							"[Main] ⚠️ Kayıt dosyası henüz oluşmamış:",
							outputPath
						);
					}
				}, 1000);

				// 15 saniye sonra interval'ı durdur
				setTimeout(() => {
					clearInterval(checkInterval);
					console.log("[Main] Dosya monitoring durduruldu");

					// Final kontrol
					if (fs.existsSync(outputPath)) {
						const finalStats = fs.statSync(outputPath);
						console.log(
							`[Main] 🏁 Final dosya boyutu: ${finalStats.size} bytes`
						);

						if (finalStats.size === 0) {
							console.error(
								"[Main] ❌ UYARI: Kayıt dosyası boş! İzin problemi olabilir"
							);
						} else if (finalStats.size < 1000) {
							console.warn(
								"[Main] ⚠️ UYARI: Dosya çok küçük, kayıt kısa olabilir"
							);
						} else {
							console.log("[Main] ✅ Dosya boyutu normal görünüyor");
						}
					}
				}, 15000);

				// Test'te gördük ki startRecording outputPath döndürüyor (string)
				const startSuccess =
					result &&
					(typeof result === "string" ||
						(typeof result === "object" && result.outputPath));

				if (startSuccess) {
					console.log("[Main] ✅ MacRecorder kaydı başarıyla başlatıldı");
					console.log("[Main] 🔧 Start result was truthy:", !!result);
					return true;
				} else {
					console.error("[Main] ❌ MacRecorder kaydı başlatılamadı");
					console.error("[Main] 🔧 Start result was falsy:", result);
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
*/

// Downloads/.creavit-studio/temp_screen_TIMESTAMP.mov path'ini oluştur
function createScreenRecordingPath() {
	const homeDir = os.homedir();
	const downloadDir = path.join(homeDir, "Downloads");
	const creavitStudioDir = path.join(downloadDir, ".creavit-studio");

	// .creavit-studio klasörünü oluştur
	if (!fs.existsSync(creavitStudioDir)) {
		fs.mkdirSync(creavitStudioDir, { recursive: true });
		console.log(
			"[Main] .creavit-studio klasörü oluşturuldu:",
			creavitStudioDir
		);
	}

	// Timestamp ile temp dosya adı oluştur
	const timestamp = Date.now();
	return path.join(creavitStudioDir, `temp_screen_${timestamp}.mov`);
}

// START_MAC_RECORDING handler - MacRecorder başlatır
safeHandle(IPC_EVENTS.START_MAC_RECORDING, async (event, options) => {
	try {
		// YENİ KAYIT BAŞLAMADAN ÖNCE TEMİZLİK YAP
		if (tempFileManager) {
			await tempFileManager.cleanupAllFiles();
		}

		// 🎬 MacRecorder KAYIT BAŞLATMA
		const recorder = getMacRecorderInstance();
		if (!recorder) {
			return {
				success: false,
				outputPath: null,
				error: "MacRecorder instance bulunamadı",
			};
		}

		const outputPath = createScreenRecordingPath();

		// MediaStateManager'dan seçili kaynak bilgisini al
		const recordingSource = mediaStateManager?.state.recordingSource;
		console.log(
			"[Main] MacRecorder başlatılırken kaynak bilgisi:",
			recordingSource
		);

		const recordingOptions = {
			includeMicrophone: false,
			includeSystemAudio: false,
			quality: "medium",
			frameRate: 30,
			captureCursor: false,
			...options,
		};

		// MediaStateManager'dan ses ayarlarını al
		if (mediaStateManager) {
			const audioSettings = mediaStateManager.state.audioSettings;
			if (audioSettings) {
				recordingOptions.includeMicrophone = audioSettings.microphoneEnabled;
				recordingOptions.audioDeviceId = audioSettings.selectedAudioDevice;
				console.log("[Main] Ses ayarları eklendi:", {
					includeMicrophone: recordingOptions.includeMicrophone,
					audioDeviceId: recordingOptions.audioDeviceId,
				});
			}
		}

		// Seçili kaynağa göre MacRecorder seçeneklerini ayarla
		if (recordingSource && recordingSource.macRecorderId !== null) {
			if (recordingSource.sourceType === "window") {
				// Pencere kaydı için windowId kullan
				const windowId = parseInt(recordingSource.macRecorderId, 10);
				if (!isNaN(windowId)) {
					recordingOptions.windowId = windowId;
					recordingOptions.displayId = null; // Window recording'de displayId null olmalı
					console.log("[Main] MacRecorder windowId ayarlandı:", windowId);
				}
			} else if (
				recordingSource.sourceType === "display" ||
				recordingSource.sourceType === "screen"
			) {
				// Ekran kaydı için displayId kullan
				const displayId = parseInt(recordingSource.macRecorderId, 10);
				if (!isNaN(displayId)) {
					recordingOptions.displayId = displayId;
					recordingOptions.windowId = null; // Display recording'de windowId null olmalı
					console.log("[Main] MacRecorder displayId ayarlandı:", displayId);
				}
			}
		} else {
			// Default olarak ana ekranı kullan
			recordingOptions.displayId = 0;
			recordingOptions.windowId = null;
			console.log("[Main] MacRecorder default displayId (0) kullanılıyor");
		}

		// Seçilen alan varsa captureArea olarak ekle
		if (mediaStateManager && mediaStateManager.state.selectedArea) {
			const selectedArea = mediaStateManager.state.selectedArea;
			if (selectedArea && selectedArea.width > 0 && selectedArea.height > 0) {
				recordingOptions.captureArea = {
					x: Math.round(selectedArea.x),
					y: Math.round(selectedArea.y),
					width: Math.round(selectedArea.width),
					height: Math.round(selectedArea.height),
				};
				// Alan kaydında display/window ID'sini temizle
				recordingOptions.displayId = null;
				recordingOptions.windowId = null;
				console.log(
					"[Main] Kırpma alanı MacRecorder'a eklendi:",
					recordingOptions.captureArea
				);
			}
		}

		console.log("[Main] Final MacRecorder options:", recordingOptions);

		// Start synchronized recording session
		const syncSession = synchronizedRecording.startRecordingSession();

		const result = await recorder.startRecording(outputPath, recordingOptions);

		if (result) {
			// Record screen recording start time
			synchronizedRecording.recordStartTime("screen");

			// Start cursor capture with new API
			try {
				const timestamp = Date.now();
				const cursorFilePath = path.join(
					tempFileManager.appDir,
					`temp_cursor_${timestamp}.json`
				);

				console.log("[Main] 🎯 Cursor capture başlatılıyor...");
				await recorder.startCursorCapture(cursorFilePath);

				// State güncelle
				cursorTrackingState.isTracking = true;
				cursorTrackingState.outputPath = cursorFilePath;
				cursorTrackingState.startTime = Date.now();

				// Record mouse tracking start time
				synchronizedRecording.recordStartTime(
					"mouse",
					cursorTrackingState.startTime
				);

				if (mediaStateManager) {
					mediaStateManager.updateState({
						cursorPath: cursorFilePath,
						recordingId: syncSession.recordingId,
						masterStartTime: syncSession.masterStartTime,
						synchronizedTimestamps: synchronizedRecording.offsets,
					});
				}

				console.log("[Main] ✅ Cursor capture başlatıldı:", cursorFilePath);
			} catch (cursorError) {
				console.warn(
					"[Main] Cursor capture hatası (devam ediliyor):",
					cursorError.message
				);
			}

			// Update camera manager with synchronized recording
			if (cameraManager) {
				cameraManager.setRecordingStatus(true, synchronizedRecording);
			}

			// RECORDING_STATUS_CHANGED event'ini tetikle
			ipcMain.emit(IPC_EVENTS.RECORDING_STATUS_CHANGED, event, true);

			return { success: true, outputPath };
		} else {
			return {
				success: false,
				outputPath: null,
				error: "MacRecorder kaydı başlatılamadı",
			};
		}
	} catch (error) {
		console.error("[Main] START_MAC_RECORDING hatası:", error);
		return { success: false, outputPath: null, error: error.message };
	}
});

// STOP_MAC_RECORDING handler - MacRecorder durdurur
safeHandle(IPC_EVENTS.STOP_MAC_RECORDING, async (event) => {
	try {
		// 🎬 MacRecorder KAYIT DURDURMA
		const recorder = getMacRecorderInstance();
		if (!recorder) {
			return {
				success: false,
				filePath: null,
				error: "MacRecorder instance bulunamadı",
			};
		}

		// Stop cursor capture with new API
		try {
			console.log("[Main] 🛑 Cursor capture durduruluyor...");
			await recorder.stopCursorCapture();

			// Cursor data'sını düzenle ve MediaStateManager'a ekle
			if (
				cursorTrackingState.outputPath &&
				fs.existsSync(cursorTrackingState.outputPath)
			) {
				try {
					console.log(
						"[Main] 📝 Cursor data'sı düzenleniyor...",
						cursorTrackingState.outputPath
					);

					// JSON dosyasını oku
					const rawCursorData = await fs.promises.readFile(
						cursorTrackingState.outputPath,
						"utf8"
					);
					const cursorPositions = JSON.parse(rawCursorData);

					// Her bir cursor position'ını düzenle
					const enhancedCursorData = cursorPositions.map((position) => {
						const enhanced = {
							x: position.x,
							y: position.y,
							timestamp: synchronizedRecording.getSynchronizedTimestamp(
								"mouse",
								position.timestamp
							),
							originalTimestamp: position.timestamp,
							cursorType: position.cursorType || "default",
							type: position.type || "move",
							button: position.button,
							clickCount: position.clickCount,
							rotation: position.rotation,
							direction: position.direction,
						};

						// Event tipine göre button ve clickCount bilgilerini ekle
						if (position.type === "mousedown" || position.type === "mouseup") {
							enhanced.button = enhanced.button || 1; // Sol tık varsayılan
							enhanced.clickCount = enhanced.clickCount || 1;
						} else if (
							position.type === "rightmousedown" ||
							position.type === "rightmouseup"
						) {
							enhanced.button = enhanced.button || 2; // Sağ tık
							enhanced.clickCount = enhanced.clickCount || 1;
							// Type'ı standard format'a çevir
							enhanced.type = position.type.replace("rightmouse", "mouse");
						}

						return enhanced;
					});

					// MediaStateManager'a ekle
					if (mediaStateManager) {
						// Önce mevcut mouse position'ları temizle
						mediaStateManager.clearMousePositions();

						// Yeni data'yı ekle
						enhancedCursorData.forEach((position) => {
							mediaStateManager.addMousePosition(position);
						});

						console.log("[Main] ✅ Cursor data MediaStateManager'a eklendi:", {
							totalPositions: enhancedCursorData.length,
							firstPosition: enhancedCursorData[0],
							lastPosition: enhancedCursorData[enhancedCursorData.length - 1],
						});

						// Cursor data'sını dosyaya kaydet
						try {
							if (tempFileManager) {
								const cursorPath = await mediaStateManager.saveCursorData(
									tempFileManager
								);
								console.log(
									"[Main] ✅ Cursor data dosyaya kaydedildi:",
									cursorPath
								);
							} else {
								console.warn(
									"[Main] ⚠️ tempFileManager bulunamadı, cursor data dosyaya kaydedilemiyor"
								);
							}
						} catch (saveError) {
							console.error(
								"[Main] ❌ Cursor data dosyaya kaydedilirken hata:",
								saveError
							);
						}
					}
				} catch (dataError) {
					console.error("[Main] Cursor data düzenleme hatası:", dataError);
				}
			}

			// State güncelle
			cursorTrackingState.isTracking = false;
			cursorTrackingState.outputPath = null;
			cursorTrackingState.startTime = null;

			// Stop synchronized recording session
			const finalSyncData = synchronizedRecording.stopRecordingSession();

			// Save final synchronization data to state manager
			if (mediaStateManager) {
				mediaStateManager.updateState({
					finalSynchronizationData: finalSyncData,
				});
			}

			console.log("[Main] ✅ Cursor capture durduruldu");
		} catch (cursorError) {
			console.warn(
				"[Main] Cursor capture durdurma hatası (devam ediliyor):",
				cursorError.message
			);
		}

		const result = await recorder.stopRecording();

		// Stop result: { code: 0, outputPath: "..." }
		const actualFilePath =
			result && typeof result === "object" ? result.outputPath : result;
		const isSuccess =
			result && (result.code === 0 || result.code === undefined);

		if (isSuccess && actualFilePath) {
			// RECORDING_STATUS_CHANGED event'ini tetikle
			ipcMain.emit(IPC_EVENTS.RECORDING_STATUS_CHANGED, event, false);

			return { success: true, filePath: actualFilePath };
		} else {
			return {
				success: false,
				filePath: null,
				error: "MacRecorder kaydı durdurulamadı",
			};
		}
	} catch (error) {
		console.error("[Main] STOP_MAC_RECORDING hatası:", error);
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
				console.log("[Main] ✅ MacRecorder kaynakları alınıyor...");

				// Global instance kullan
				const recorder = getMacRecorderInstance();
				console.log("[Main] ✅ MacRecorder instance oluşturuldu");

				const sources = [];

				// Ekranları al
				if (!options.types || options.types.includes("screen")) {
					try {
						console.log("[Main] MacRecorder displays alınıyor...");
						const displays = await recorder.getDisplays();
						console.log("[Main] MacRecorder displays:", displays);

						// Process displays and get thumbnails
						for (const display of displays) {
							try {
								const thumbnail = await recorder.getDisplayThumbnail(
									display.id,
									{
										maxWidth: options.thumbnailSize?.width || 300,
										maxHeight: options.thumbnailSize?.height || 200,
									}
								);

								sources.push({
									id: `screen:${display.id || index}`,
									name: display.name || `Display ${index + 1}`,
									type: "screen",
									macRecorderId: display.id || index,
									macRecorderInfo: display,
									thumbnail: thumbnail,
								});
							} catch (thumbnailError) {
								console.warn(
									`[Main] Display thumbnail alınamadı (${display.id}):`,
									thumbnailError
								);
								sources.push({
									id: `screen:${display.id}`,
									name: display.name || `Display ${display.id}`,
									type: "screen",
									macRecorderId: display.id,
									macRecorderInfo: display,
									thumbnail: null,
								});
							}
						}
					} catch (error) {
						console.error("[Main] MacRecorder displays hatası:", error);
						throw error;
					}
				}

				// Pencereleri al
				if (!options.types || options.types.includes("window")) {
					try {
						console.log("[Main] MacRecorder windows alınıyor...");
						const windows = await recorder.getWindows();
						console.log("[Main] MacRecorder windows:", windows);

						// Process windows and get thumbnails
						for (const window of windows) {
							try {
								const thumbnail = await recorder.getWindowThumbnail(window.id, {
									maxWidth: options.thumbnailSize?.width || 300,
									maxHeight: options.thumbnailSize?.height || 200,
								});

								sources.push({
									id: `window:${window.id}`,
									name: window.appName || window.name || `Window ${window.id}`,
									type: "window",
									macRecorderId: window.id,
									macRecorderInfo: window,
									thumbnail: thumbnail,
								});
							} catch (thumbnailError) {
								console.warn(
									`[Main] Window thumbnail alınamadı (${window.id}):`,
									thumbnailError
								);
								sources.push({
									id: `window:${window.id}`,
									name: window.appName || window.name || `Window ${window.id}`,
									type: "window",
									macRecorderId: window.id,
									macRecorderInfo: window,
									thumbnail: null,
								});
							}
						}
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
		}
	);

	// MacRecorder Thumbnail fonksiyonları

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

			if (!recorder) {
				console.error("[Main] MacRecorder instance null - modül yüklenemedi");
				return [];
			}

			const windows = await recorder.getWindows();
			console.log("[Main] MacRecorder pencereleri:", windows.length, "adet");

			// Production build'de pencere listesi boş olabilir - fallback ekle
			if (app.isPackaged && (!windows || windows.length === 0)) {
				console.warn(
					"[Main] Production build'de pencere listesi boş, fallback kullanılıyor"
				);
				return [
					{
						id: 0,
						name: "Tüm Ekranlar",
						ownerName: "System",
						isOnScreen: true,
					},
				];
			}

			return windows || [];
		} catch (error) {
			console.error("[Main] MacRecorder pencereleri alınamadı:", error);
			console.error("[Main] Error details:", {
				name: error.name,
				message: error.message,
				stack: error.stack,
			});

			// Production build'de hata olduğunda fallback döndür
			if (app.isPackaged) {
				console.warn(
					"[Main] Production build'de pencere listesi hatası, fallback kullanılıyor"
				);
				return [
					{
						id: 0,
						name: "Varsayılan Display",
						ownerName: "System",
						isOnScreen: true,
					},
				];
			}

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

						// Ana pencereyi kapat
						if (mainWindow && !mainWindow.isDestroyed()) {
							mainWindow.hide();
							// Tüm kaynakları temizle
							mainWindow.webContents.send(IPC_EVENTS.RESET_FOR_NEW_RECORDING);
						}
					} catch (error) {
						console.error("[main.cjs] Editor penceresi açılırken hata:", error);

						// Hata durumunda ana pencereyi göster ve kullanıcıya bilgi ver
						if (mainWindow && !mainWindow.isDestroyed()) {
							// Editor zaten açık değilse ana pencereyi göster
							if (!editorManager || !editorManager.isEditorWindowOpen()) {
								mainWindow.show();
							}
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
						// Editor zaten açık değilse ana pencereyi göster
						if (!editorManager || !editorManager.isEditorWindowOpen()) {
							mainWindow.show();
						}

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
				// Editor zaten açık değilse ana pencereyi göster
				if (!editorManager || !editorManager.isEditorWindowOpen()) {
					mainWindow.show();
				}
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

			// Tüm dosyalar için güvenli streaming yaklaşımı
			return { type: "stream", path: filePath, size: stats.size };
		} catch (error) {
			console.error("[main.cjs] Video dosyası okunurken hata:", error);
			return null;
		}
	});

	// Stream-based file reading for large files
	safeHandle(
		IPC_EVENTS.READ_VIDEO_STREAM,
		async (event, filePath, chunkSize = 1024 * 1024) => {
			try {
				if (!filePath || !fs.existsSync(filePath)) {
					console.error("[main.cjs] Stream dosyası bulunamadı:", filePath);
					return null;
				}

				const stats = fs.statSync(filePath);
				const readStream = fs.createReadStream(filePath, {
					highWaterMark: chunkSize,
				});
				const chunks = [];

				return new Promise((resolve, reject) => {
					readStream.on("data", (chunk) => {
						chunks.push(chunk.toString("base64"));
					});

					readStream.on("end", () => {
						resolve({
							chunks,
							totalSize: stats.size,
							chunkCount: chunks.length,
						});
					});

					readStream.on("error", (error) => {
						console.error("[main.cjs] Stream okuma hatası:", error);
						reject(error);
					});
				});
			} catch (error) {
				console.error("[main.cjs] Video stream hatası:", error);
				return null;
			}
		}
	);

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

					// Process'i global array'e ekle
					global.ffmpegProcesses.push(command);

					command
						.on("end", () => {
							// Process'i array'den çıkar
							const index = global.ffmpegProcesses.indexOf(command);
							if (index > -1) {
								global.ffmpegProcesses.splice(index, 1);
							}

							// Geçici dosyaları temizle
							fs.unlinkSync(tempVideoPath);
							if (tempAudioPath) fs.unlinkSync(tempAudioPath);
							console.log("[main] Video başarıyla kaydedildi:", filePath);
							resolve({ success: true, path: filePath });
						})
						.on("error", (err) => {
							// Process'i array'den çıkar
							const index = global.ffmpegProcesses.indexOf(command);
							if (index > -1) {
								global.ffmpegProcesses.splice(index, 1);
							}

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

					// Process'i global array'e ekle
					global.ffmpegProcesses.push(command);

					command
						.videoCodec("libx264")
						.outputOptions([
							"-crf 23", // Kalite ayarı (0-51, düşük değer daha iyi kalite)
							"-preset medium", // Encoding hızı/kalite dengesi
							"-movflags +faststart", // Web'de hızlı başlatma için
						])
						.on("end", () => {
							// Process'i array'den çıkar
							const index = global.ffmpegProcesses.indexOf(command);
							if (index > -1) {
								global.ffmpegProcesses.splice(index, 1);
							}

							// Geçici dosyaları temizle
							fs.unlinkSync(tempVideoPath);
							if (tempAudioPath) fs.unlinkSync(tempAudioPath);
							console.log("[main] Video başarıyla kaydedildi:", filePath);
							resolve({ success: true, path: filePath });
						})
						.on("error", (err) => {
							// Process'i array'den çıkar
							const index = global.ffmpegProcesses.indexOf(command);
							if (index > -1) {
								global.ffmpegProcesses.splice(index, 1);
							}

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

			// WebM dosyasının varlığını ve boyutunu kontrol et
			const stats = fs.statSync(tempWebmPath);
			console.log(`[main] WebM dosya boyutu: ${stats.size} bytes`);

			if (stats.size === 0) {
				fs.unlinkSync(tempWebmPath);
				throw new Error("WebM dosyası boş - kayıt işlemi başarısız");
			}

			// Custom FFmpeg wrapper ile MP4'e dönüştür
			try {
				await ffmpegWrapper.convertWebmToMp4(tempWebmPath, outputPath);
				
				// Geçici dosyayı temizle
				fs.unlinkSync(tempWebmPath);
				console.log("[main] Video başarıyla kaydedildi:", outputPath);
				
				return { success: true };
			} catch (conversionError) {
				// Geçici dosyayı temizle
				if (fs.existsSync(tempWebmPath)) {
					fs.unlinkSync(tempWebmPath);
				}
				throw new Error("Video dönüştürülemedi: " + conversionError.message);
			}
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

			// Önce tüm aktif stream'leri temizle
			await tempFileManager.cleanupStreams();

			// Medya yollarını kaydet
			mediaStateManager.state.videoPath = data.videoPath;
			mediaStateManager.state.cameraPath = data.cameraPath;
			mediaStateManager.state.audioPath = data.audioPath;

			console.log("[Main] Stream'ler temizlendi, editör açılıyor...");
			console.log("[Main] Editör verileri:", data);

			// Editör penceresini aç
			await editorManager.createEditorWindow();
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

	// UPDATE_RECORDING_SOURCE - safeHandle ile invoke desteği
	safeHandle("UPDATE_RECORDING_SOURCE", async (event, source) => {
		console.log("[Main] Kayıt kaynağı güncellendi:", source);

		// Global recordingSource'u güncelle
		recordingSource = {
			...recordingSource,
			...source,
		};

		// Media state manager üzerinden aktif kaynak ayarını güncelle - DIREKt source'u gönder
		if (mediaStateManager) {
			console.log(
				"[Main] MediaStateManager.updateRecordingSource çağrılıyor:",
				source
			);
			mediaStateManager.updateRecordingSource(source); // Global değişken değil, direkt source
		} else {
			console.error("[Main] MediaStateManager bulunamadı!");
		}

		return { success: true, recordingSource: source };
	});

	// MacRecorder handler'ları
	safeHandle(IPC_EVENTS.GET_MAC_SCREENS, async (event) => {
		try {
			console.log("[Main] MacRecorder ekran listesi alınıyor...");
			const recorder = getMacRecorderInstance();

			if (!recorder) {
				console.error("[Main] MacRecorder instance null - modül yüklenemedi");
				// Production build'de fallback display listesi döndür
				if (app.isPackaged) {
					console.warn(
						"[Main] Production build'de display fallback kullanılıyor"
					);
					return [
						{
							id: 0,
							name: "Ana Ekran",
							width: 1920,
							height: 1080,
							isPrimary: true,
						},
					];
				}
				return [];
			}

			const displays = await recorder.getDisplays();
			console.log(
				"[Main] MacRecorder ekranları:",
				displays?.length || 0,
				"adet"
			);

			// Production build'de display listesi boş olabilir - fallback ekle
			if (app.isPackaged && (!displays || displays.length === 0)) {
				console.warn(
					"[Main] Production build'de display listesi boş, fallback kullanılıyor"
				);
				return [
					{
						id: 0,
						name: "Ana Ekran",
						width: 1920,
						height: 1080,
						isPrimary: true,
					},
				];
			}

			return displays || [];
		} catch (error) {
			console.error("[Main] MacRecorder ekran listesi alınamadı:", error);
			console.error("[Main] Error details:", {
				name: error.name,
				message: error.message,
				stack: error.stack,
			});

			// Production build'de hata olduğunda fallback döndür
			if (app.isPackaged) {
				console.warn(
					"[Main] Production build'de display listesi hatası, fallback kullanılıyor"
				);
				return [
					{
						id: 0,
						name: "Ana Ekran",
						width: 1920,
						height: 1080,
						isPrimary: true,
					},
				];
			}

			return [];
		}
	});

	safeHandle(IPC_EVENTS.GET_MAC_WINDOWS, async (event) => {
		try {
			console.log("[Main] MacRecorder pencere listesi alınıyor...");
			const recorder = getMacRecorderInstance();

			if (!recorder) {
				console.error("[Main] MacRecorder instance null - modül yüklenemedi");
				return [];
			}

			const windows = await recorder.getWindows();
			console.log(
				"[Main] MacRecorder pencereleri:",
				windows?.length || 0,
				"adet"
			);

			// Production build'de pencere listesi boş olabilir - fallback ekle
			if (app.isPackaged && (!windows || windows.length === 0)) {
				console.warn(
					"[Main] Production build'de pencere listesi boş, fallback kullanılıyor"
				);
				return [
					{
						id: 0,
						name: "Varsayılan Display",
						ownerName: "System",
						isOnScreen: true,
					},
				];
			}

			return windows || [];
		} catch (error) {
			console.error("[Main] MacRecorder pencere listesi alınamadı:", error);
			console.error("[Main] Error details:", {
				name: error.name,
				message: error.message,
				stack: error.stack,
			});

			// Production build'de hata olduğunda fallback döndür
			if (app.isPackaged) {
				console.warn(
					"[Main] Production build'de pencere listesi hatası, fallback kullanılıyor"
				);
				return [
					{
						id: 0,
						name: "Varsayılan Display",
						ownerName: "System",
						isOnScreen: true,
					},
				];
			}

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

	// MacRecorder thumbnail preview handlers - README'den eklendi
	safeHandle(
		"GET_MAC_WINDOW_THUMBNAIL",
		async (event, windowId, options = {}) => {
			try {
				console.log("[Main] Window thumbnail alınıyor:", windowId, options);
				const recorder = getMacRecorderInstance();
				const thumbnail = await recorder.getWindowThumbnail(windowId, {
					maxWidth: options.maxWidth || 300,
					maxHeight: options.maxHeight || 200,
				});
				console.log("[Main] Window thumbnail başarıyla alındı");
				return thumbnail;
			} catch (error) {
				console.error("[Main] Window thumbnail alınamadı:", error);
				return null;
			}
		}
	);

	safeHandle(
		"GET_MAC_SCREEN_THUMBNAIL",
		async (event, displayId, options = {}) => {
			try {
				console.log("[Main] Display thumbnail alınıyor:", displayId, options);
				const recorder = getMacRecorderInstance();
				const thumbnail = await recorder.getDisplayThumbnail(displayId, {
					maxWidth: options.maxWidth || 300,
					maxHeight: options.maxHeight || 200,
				});
				console.log("[Main] Display thumbnail başarıyla alındı");
				return thumbnail;
			} catch (error) {
				console.error("[Main] Display thumbnail alınamadı:", error);
				return null;
			}
		}
	);

	// MacRecorder permission checking - README'den eklendi
	safeHandle("CHECK_MAC_PERMISSIONS", async (event) => {
		try {
			console.log("[Main] MacRecorder izinleri kontrol ediliyor...");
			const recorder = getMacRecorderInstance();

			// Production build'de recorder null olabilir
			if (!recorder) {
				console.error("[Main] MacRecorder instance null - modül yüklenemedi");
				return {
					screenRecording: false,
					microphone: false,
					accessibility: false,
					error: "MacRecorder modülü yüklenemedi",
				};
			}

			const permissions = await recorder.checkPermissions();
			console.log("[Main] MacRecorder izinleri:", permissions);
			return permissions;
		} catch (error) {
			console.error("[Main] MacRecorder izinleri kontrol edilemedi:", error);
			console.error("[Main] Error details:", {
				name: error.name,
				message: error.message,
				stack: error.stack,
			});
			return {
				screenRecording: false,
				microphone: false,
				accessibility: false,
				error: error.message,
			};
		}
	});

	// MacRecorder status tracking - README'den eklendi
	safeHandle("GET_MAC_RECORDER_STATUS", async (event) => {
		try {
			console.log("[Main] MacRecorder status alınıyor...");
			const recorder = getMacRecorderInstance();
			const status = recorder.getStatus();
			console.log("[Main] MacRecorder status:", status);
			return status;
		} catch (error) {
			console.error("[Main] MacRecorder status alınamadı:", error);
			return {
				isRecording: false,
				outputPath: null,
				options: null,
				recordingTime: 0,
			};
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

			// Custom FFmpeg wrapper ile GIF'e dönüştür
			try {
				await ffmpegWrapper.convertWebmToGif(tempWebmPath, outputPath);
				
				// Geçici dosyayı temizle
				fs.unlinkSync(tempWebmPath);
				console.log("[main] GIF başarıyla kaydedildi:", outputPath);
				
				return { success: true };
			} catch (conversionError) {
				// Geçici dosyayı temizle
				if (fs.existsSync(tempWebmPath)) {
					fs.unlinkSync(tempWebmPath);
				}
				throw new Error("GIF dönüştürülemedi: " + conversionError.message);
			}
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

			// Global instance kullan
			const recorder = getMacRecorderInstance();
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

	// START_CURSOR_TRACKING_ONLY handler kaldırıldı
	// Cursor capture artık START_MAC_RECORDING içinde yönetiliyor

	// Standalone cursor tracking handlers kaldırıldı
	// Cursor capture artık START/STOP_MAC_RECORDING içinde yönetiliyor

	// Ana pencereyi gizleme
	ipcMain.on("HIDE_MAIN_WINDOW", () => {
		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.hide();
			// Tüm kaynakları temizle
			mainWindow.webContents.send(IPC_EVENTS.RESET_FOR_NEW_RECORDING);
		}
	});

	// Tray'den gelen kayıt başlatma isteği
	ipcMain.on("START_RECORDING_FROM_TRAY", () => {
		console.log("[Main] Tray'den kayıt başlatma isteği alındı");
		if (mainWindow && !mainWindow.isDestroyed()) {
			// Frontend'e direkt event gönder (zaten dinleniyor)
			mainWindow.webContents.send("START_RECORDING_FROM_TRAY");
		}
	});

	// Tray'den gelen kayıt durdurma isteği
	ipcMain.on("STOP_RECORDING_FROM_TRAY", () => {
		console.log("[Main] Tray'den kayıt durdurma isteği alındı");
		if (mainWindow && !mainWindow.isDestroyed()) {
			// Frontend'e direkt event gönder (zaten dinleniyor)
			mainWindow.webContents.send("STOP_RECORDING_FROM_TRAY");
		}
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

	// CSP headers are now handled globally in setupSecurityPolicies()
	// mainWindow.webContents.session.webRequest.onHeadersReceived(
	// 	(details, callback) => {
	// 		callback({
	// 			responseHeaders: {
	// 				...details.responseHeaders,
	// 				"Content-Security-Policy": [
	// 					"default-src 'self' http://localhost:* file: data: electron: blob: 'unsafe-inline' 'unsafe-eval' https://storage.googleapis.com https://*.tensorflow.org https://api.giphy.com https://*.giphy.com;",
	// 				],
	// 			},
	// 		});
	// 	}
	// );
}

function setupSecurityPolicies() {
	console.log("[Main] Setting up CSP with Giphy domains...");
	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		const cspPolicy =
			"default-src 'self' http://localhost:* file: data: electron: blob: 'unsafe-inline' 'unsafe-eval' https://storage.googleapis.com https://*.tensorflow.org https://api.giphy.com https://*.giphy.com https://media.giphy.com; " +
			"script-src 'self' http://localhost:* file: data: electron: blob: 'unsafe-inline' 'unsafe-eval' https://storage.googleapis.com https://*.tensorflow.org; " +
			"connect-src 'self' http://localhost:* file: data: electron: blob: https://storage.googleapis.com https://*.tensorflow.org https://api.giphy.com https://*.giphy.com; " +
			"img-src 'self' http://localhost:* file: data: electron: blob: https://*.giphy.com https://media.giphy.com https://media0.giphy.com https://media1.giphy.com https://media2.giphy.com https://media3.giphy.com https://media4.giphy.com; " +
			"style-src 'self' http://localhost:* file: data: electron: blob: 'unsafe-inline'; " +
			"font-src 'self' http://localhost:* file: data: electron: blob:; " +
			"media-src 'self' http://localhost:* file: data: electron: blob: https://*.giphy.com https://media.giphy.com;";

		console.log("[Main] Applying CSP:", cspPolicy);

		callback({
			responseHeaders: {
				...details.responseHeaders,
				"Content-Security-Policy": [cspPolicy],
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
		// mainWindow.webContents.openDevTools({ mode: "detach" });
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
							<title>Creavit Studio - Hata</title>
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

	// Setup security policies first
	console.log("[Main] Setting up security policies...");
	setupSecurityPolicies();

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
		// Editor açıkken ana pencereyi gösterme
		if (editorManager && editorManager.isEditorWindowOpen()) {
			console.log(
				"[Main] Editor açık, ana pencere gösterilmiyor (app activate)"
			);
			return;
		}
		mainWindow.show();
	}
});

app.on("before-quit", () => {
	console.log("[Main] Uygulama kapanıyor, isQuitting = true");
	app.isQuitting = true;

	// Tüm process'leri ve kaynakları temizle
	try {
		// Cursor tracking temizliği
		if (cursorTrackingState.pollingInterval) {
			console.log("[Main] Cursor polling interval temizleniyor...");
			clearInterval(cursorTrackingState.pollingInterval);
			cursorTrackingState.pollingInterval = null;
		}

		if (cursorTrackingState.isTracking) {
			console.log("[Main] Cursor tracking durduruluyor...");
			cursorTrackingState.isTracking = false;

			// MacRecorder'ı durdur (async olmadan)
			try {
				const recorder = getMacRecorderInstance();
				if (recorder && typeof recorder.stopCursorTracking === "function") {
					recorder.stopCursorTracking().catch((err) => {
						console.warn(
							"[Main] MacRecorder durdurma hatası (shutdown):",
							err.message
						);
					});
				}
			} catch (err) {
				console.warn("[Main] MacRecorder shutdown hatası:", err.message);
			}
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

		// FFmpeg process'lerini temizle
		if (global.ffmpegProcesses) {
			console.log("[Main] FFmpeg process'leri temizleniyor...");
			global.ffmpegProcesses.forEach((process) => {
				try {
					if (process && !process.killed) {
						process.kill("SIGTERM");
					}
				} catch (err) {
					console.warn("[Main] FFmpeg process temizleme hatası:", err.message);
				}
			});
			global.ffmpegProcesses = [];
		}

		// Tüm child process'leri temizle
		if (process.platform === "darwin") {
			try {
				const { exec } = require("child_process");
				exec("pkill -f 'sleer'", (error) => {
					if (error) {
						console.warn("[Main] Process temizleme hatası:", error.message);
					} else {
						console.log("[Main] Tüm sleer process'leri temizlendi");
					}
				});
			} catch (err) {
				console.warn("[Main] Process temizleme hatası:", err.message);
			}
		}

		// Node.js event loop'u temizle
		setTimeout(() => {
			process.exit(0);
		}, 100);

		console.log("[Main] Tüm kaynaklar temizlendi");
	} catch (error) {
		console.error("[Main] Temizleme işlemi sırasında hata:", error);
		// Hata olsa bile uygulamayı kapat
		setTimeout(() => {
			process.exit(0);
		}, 100);
	}
});

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
							<title>Creavit Studio</title>
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
							<h1>Creavit Studio Başlatılıyor</h1>
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
