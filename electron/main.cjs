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
	systemPreferences,
} = require("electron");
const path = require("path");
const fs = require("fs");
const isDev = process.env.NODE_ENV === "development";
const waitOn = require("wait-on");
// FFmpeg removed - using WebM-only export

const express = require("express");
const http = require("http");
const os = require("os");

// Electron Store for persistent data
let Store;
try {
	const ElectronStore = require("electron-store");
	if (typeof ElectronStore === "function") {
		Store = ElectronStore;
		console.log("electron-store modülü başarıyla yüklendi");
	} else {
		throw new Error("electron-store geçerli bir constructor değil");
	}
} catch (error) {
	console.error("electron-store modülü yüklenirken hata:", error);
	// Fallback olarak basit bir yerel store kullan
	Store = class SimpleStore {
		constructor(options = {}) {
			this.data = options.defaults || {};
			console.warn(
				"electron-store yerine basit bir inmemory store kullanılıyor"
			);
		}
		get(key) {
			return key ? this.data[key] : this.data;
		}
		set(key, value) {
			if (typeof key === "string") {
				this.data[key] = value;
			} else {
				this.data = { ...this.data, ...key };
			}
		}
		delete(key) {
			delete this.data[key];
		}
		clear() {
			this.data = {};
		}
	};
}

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
const RecordingSettingsManager = require("./recordingSettingsManager.cjs");
const MediaStateManager = require("./mediaStateManager.cjs");
const DockManager = require("./dockManager.cjs");
const PortManager = require("./portManager.cjs");

// Global process tracking
global.ffmpegProcesses = [];

// Giphy API handler for secure API calls - registered early
ipcMain.handle("search-gifs", async (event, query) => {
	console.log("IPC: Searching for GIFs with query:", query);
	try {
		const url = `https://api.giphy.com/v1/stickers/search?api_key=DCabEPYut33Xk4DzYdL44AXsRcUAKjPp&q=${encodeURIComponent(
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
let recordingSettingsManager = null;
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

	// Ses ayarları güncellenmişse MediaStateManager'a ilet
	if (settings.audioSettings && mediaStateManager) {
		console.log("[Main] Ses ayarları güncelleniyor:", settings.audioSettings);
		mediaStateManager.updateAudioSettings(settings.audioSettings);
	}
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

// Global değişken - recording sırasında window bilgisini saklamak için
let currentRecordingWindowInfo = null;

// Cursor ve Camera kaydını başlatma fonksiyonu
async function startCursorAndCameraCapture(recordingDetails) {
	console.log(
		"[Main] 🎯 startCursorAndCameraCapture başlatılıyor:",
		recordingDetails
	);

	try {
		// Cursor capture başlat
		if (globalMacRecorder && !cursorTrackingState.isTracking) {
			const timestamp = Date.now();
			const cursorFilePath = path.join(
				tempFileManager.appDir,
				`temp_cursor_${timestamp}.json`
			);

			// Cursor capture options hazırla
			const cursorCaptureOptions = {};

			// currentRecordingWindowInfo'dan window bilgisini al
			if (currentRecordingWindowInfo) {
				cursorCaptureOptions.windowInfo = currentRecordingWindowInfo;
				cursorCaptureOptions.windowRelative = true;
				console.log(
					"[Main] 🎯 Window-relative cursor capture için window:",
					currentRecordingWindowInfo
				);
			} else {
				console.log(
					"[Main] 🎯 Global cursor capture kullanılacak (window bilgisi yok)"
				);
			}

			console.log(
				"[Main] 🎯 Synchronized cursor capture başlatılıyor...",
				cursorCaptureOptions
			);
			await globalMacRecorder.startCursorCapture(
				cursorFilePath,
				cursorCaptureOptions
			);

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
				});
			}

			console.log(
				"[Main] ✅ Synchronized cursor capture başlatıldı:",
				cursorFilePath
			);
		}

		// Camera kaydını başlat (eğer etkin ise)
		if (cameraManager && cameraManager.cameraWindow) {
			console.log("[Main] 📹 Camera kaydı synchronized olarak başlatılıyor...");
			cameraManager.cameraWindow.webContents.send(
				"START_SYNCHRONIZED_CAMERA_RECORDING"
			);
		}
	} catch (error) {
		console.error(
			"[Main] ❌ Synchronized cursor/camera capture hatası:",
			error
		);
	}
}

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

			// // Yeni recordingStarted eventi - kayıt gerçekten başladığında
			// globalMacRecorder.on("recordingStarted", (recordingDetails) => {
			// 	console.log("[MacRecorder] 🎬 Kayıt gerçekten başladı:");
			// 	console.log("[MacRecorder] recordingDetails:", JSON.stringify(recordingDetails, null, 2));

			// 	// Bu noktada cursor ve camera kaydını başlat
			// 	startCursorAndCameraCapture(recordingDetails);
			// });

			globalMacRecorder.on("recordingStarted", (outputPath) => {
				console.log("[MacRecorder] Kayıt başladı:", outputPath);

				// Cursor ve camera kaydını senkronize başlat
				console.log(
					"[MacRecorder] Cursor ve camera senkronize başlatılıyor..."
				);
				startCursorAndCameraCapture({ outputPath });

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
		// Check screen recording permission
		const screenPermission = systemPreferences.getMediaAccessStatus("screen");
		console.log(
			`[Main] Current screen recording permission status: ${screenPermission}`
		);

		if (screenPermission !== "granted") {
			console.log("[Main] Screen recording permission not granted");

			// Screen recording permission cannot be requested programmatically on macOS
			// The user must manually grant it through System Preferences
			// However, attempting to start recording will trigger the system dialog
			console.log(
				"[Main] Screen recording will trigger system permission dialog on first attempt"
			);

			// We can still proceed - the system will show the permission dialog
			// when we actually try to start recording with node-mac-recorder
		}

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
			// YENİ: Ses cihazları seçimi
			audioDeviceId: null,
			systemAudioDeviceId: null,
			...options,
		};

		// MediaStateManager'dan ses ayarlarını al
		if (mediaStateManager) {
			const audioSettings = mediaStateManager.state.audioSettings;
			console.log("[Main] 🎧 MediaStateManager audioSettings:", audioSettings);

			if (audioSettings) {
				recordingOptions.includeMicrophone = audioSettings.microphoneEnabled;
				recordingOptions.includeSystemAudio = audioSettings.systemAudioEnabled;
				recordingOptions.audioDeviceId = audioSettings.selectedAudioDevice;

				console.log("[Main] 🔧 Final audio settings before MacRecorder:", {
					"audioSettings.microphoneEnabled": audioSettings.microphoneEnabled,
					"audioSettings.selectedAudioDevice":
						audioSettings.selectedAudioDevice,
					"recordingOptions.includeMicrophone":
						recordingOptions.includeMicrophone,
				});

				console.log("[Main] 🔧 Audio settings applied to recording options:", {
					microphoneEnabled: audioSettings.microphoneEnabled,
					systemAudioEnabled: audioSettings.systemAudioEnabled,
					selectedAudioDevice: audioSettings.selectedAudioDevice,
				});

				// YENİ: Sistem sesi açıksa cihaz seçimi yap
				if (recordingOptions.includeSystemAudio) {
					try {
						console.log("[Main] 🔊 Sistem ses cihazları aranıyor...");
						const audioDevices = await recorder.getAudioDevices();
						const systemAudioDevices = audioDevices.filter(
							(device) =>
								device.name.toLowerCase().includes("aggregate") ||
								device.name.toLowerCase().includes("blackhole") ||
								device.name.toLowerCase().includes("soundflower") ||
								device.name.toLowerCase().includes("imobie") ||
								device.name.toLowerCase().includes("loopback")
						);

						if (systemAudioDevices.length > 0) {
							recordingOptions.systemAudioDeviceId = systemAudioDevices[0].id;
							console.log(
								"[Main] 🎯 Sistem ses cihazı:",
								systemAudioDevices[0].name
							);
						} else {
							console.warn("[Main] ⚠️ Sistem ses cihazı bulunamadı!");
						}
					} catch (error) {
						console.warn("[Main] Ses cihazları alınamadı:", error.message);
					}
				}

				console.log("[Main] Ses ayarları eklendi:", {
					includeMicrophone: recordingOptions.includeMicrophone,
					includeSystemAudio: recordingOptions.includeSystemAudio,
					audioDeviceId: recordingOptions.audioDeviceId,
					systemAudioDeviceId: recordingOptions.systemAudioDeviceId,
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

					// Window bilgisini cursor tracking için sakla
					if (recordingSource.windowInfo) {
						currentRecordingWindowInfo = recordingSource.windowInfo;
						console.log(
							"[Main] Window bilgisi cursor tracking için saklandı:",
							currentRecordingWindowInfo
						);
					}
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

		// Seçilen alan varsa captureArea olarak ekle (cropArea from recordingSource)
		if (mediaStateManager && mediaStateManager.state.recordingSource.cropArea) {
			const cropArea = mediaStateManager.state.recordingSource.cropArea;
			if (cropArea && cropArea.width > 0 && cropArea.height > 0) {
				recordingOptions.captureArea = {
					x: Math.round(cropArea.x),
					y: Math.round(cropArea.y),
					width: Math.round(cropArea.width),
					height: Math.round(cropArea.height),
				};
				// Alan kaydında display/window ID'sini temizle
				recordingOptions.displayId = null;
				recordingOptions.windowId = null;
				console.log(
					"[Main] Crop area added to MacRecorder:",
					recordingOptions.captureArea
				);
			}
		}
		// Backward compatibility: also check selectedArea
		else if (mediaStateManager && mediaStateManager.state.selectedArea) {
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
					"[Main] Selected area (legacy) added to MacRecorder:",
					recordingOptions.captureArea
				);
			}
		}

		console.log("[Main] Final MacRecorder options:", recordingOptions);

		// YENİ VERSİYON TEST: Ses ayarlarını özellikle logla
		if (
			recordingOptions.includeSystemAudio &&
			recordingOptions.systemAudioDeviceId
		) {
			console.log("[Main] 🎯 Sistem sesi kaydı YENİ VERSİYON ile aktif:");
			console.log(
				`[Main] - includeSystemAudio: ${recordingOptions.includeSystemAudio}`
			);
			console.log(
				`[Main] - systemAudioDeviceId: ${recordingOptions.systemAudioDeviceId}`
			);
		} else if (recordingOptions.includeSystemAudio) {
			console.warn(
				"[Main] ⚠️ Sistem sesi açık ama cihaz ID'si yok! Varsayılan cihaz kullanılacak"
			);
		}

		// Start synchronized recording session
		const syncSession = synchronizedRecording.startRecordingSession();

		console.log("[Main] 🎬 MacRecorder.startRecording çağrılıyor...", {
			outputPath,
			options: recordingOptions,
		});

		const result = await recorder.startRecording(outputPath, recordingOptions);

		console.log("[Main] 🎬 MacRecorder.startRecording sonucu:", {
			result,
			type: typeof result,
			isTrue: result === true,
			isFalse: result === false,
		});

		if (result) {
			// Record screen recording start time
			synchronizedRecording.recordStartTime("screen");

			// Not: Cursor capture artık recordingStarted eventinde yapılacak
			// Bu sayede kayıt gerçekten başladığında cursor ve camera senkronize olacak
			console.log(
				"[Main] 🎯 Cursor capture recordingStarted eventinde yapılacak - senkronizasyon için"
			);

			// Update camera manager with synchronized recording
			if (cameraManager) {
				cameraManager.setRecordingStatus(true, synchronizedRecording);
			}

			// RECORDING_STATUS_CHANGED event'ini tetikle
			ipcMain.emit(IPC_EVENTS.RECORDING_STATUS_CHANGED, event, true);

			console.log("[Main] ✅ Ekran kaydı başlatıldı:", outputPath);
			return { success: true, outputPath };
		} else {
			console.error(
				"[Main] ❌ MacRecorder kaydı başlatılamadı, result:",
				result
			);
			return {
				success: false,
				outputPath: null,
				error: "MacRecorder kaydı başlatılamadı",
			};
		}
	} catch (error) {
		console.error("[Main] START_MAC_RECORDING hatası:", error);
		console.error("[Main] Error details:", {
			name: error.name,
			message: error.message,
			stack: error.stack?.split("\n").slice(0, 3).join("\n"),
		});

		// Check if this is a permission error
		if (
			error.message &&
			error.message.includes("ScreenCaptureKit failed to start")
		) {
			const currentScreenPermission =
				systemPreferences.getMediaAccessStatus("screen");
			console.log(
				`[Main] Screen permission after error: ${currentScreenPermission}`
			);

			if (currentScreenPermission !== "granted") {
				return {
					success: false,
					outputPath: null,
					error:
						"Ekran kaydetme izni gerekli. Lütfen Sistem Ayarları > Gizlilik ve Güvenlik > Ekran ve Sistem Ses Kaydı bölümünden bu uygulamaya izin verin ve tekrar deneyin.",
				};
			}
		}

		// Try to get backend info for debugging
		try {
			const recorder = getMacRecorderInstance();
			if (recorder && recorder.getSystemInfo) {
				const systemInfo = await recorder.getSystemInfo();
				console.log("[Main] Recorder system info during error:", systemInfo);
				if (systemInfo.backend) {
					console.log(`[Main] Backend in use: ${systemInfo.backend}`);
					if (systemInfo.backend === "AVFoundation") {
						console.log("[Main] ✅ AVFoundation fallback is active");
					} else if (systemInfo.backend === "ScreenCaptureKit") {
						console.log(
							"[Main] ❌ ScreenCaptureKit failed - check entitlements"
						);
					}
				}
			}
		} catch (debugError) {
			console.log("[Main] Could not get debug info:", debugError.message);
		}

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

			// Window bilgisini temizle
			currentRecordingWindowInfo = null;
			console.log("[Main] Window bilgisi temizlendi");

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

		console.log("[Main] 🛑 MacRecorder.stopRecording çağrılıyor...");
		const result = await recorder.stopRecording();

		console.log("[Main] 🛑 MacRecorder.stopRecording sonucu:", {
			result,
			type: typeof result,
			hasCode: result && typeof result === "object" && "code" in result,
			hasOutputPath:
				result && typeof result === "object" && "outputPath" in result,
		});

		// Stop result: { code: 0, outputPath: "..." }
		const actualFilePath =
			result && typeof result === "object" ? result.outputPath : result;
		const isSuccess =
			result && (result.code === 0 || result.code === undefined);

		console.log("[Main] 🛑 Recording stop analysis:", {
			actualFilePath,
			isSuccess,
			fileExists: actualFilePath ? fs.existsSync(actualFilePath) : false,
			fileStat:
				actualFilePath && fs.existsSync(actualFilePath)
					? fs.statSync(actualFilePath)
					: null,
		});

		if (isSuccess && actualFilePath) {
			// Store screen recording file in TempFileManager
			tempFileManager.tempFiles.screen = actualFilePath;
			console.log(
				"[Main] 📁 Ekran kayıt dosyası TempFileManager'a eklendi:",
				actualFilePath
			);

			// RECORDING_STATUS_CHANGED event'ini tetikle
			ipcMain.emit(IPC_EVENTS.RECORDING_STATUS_CHANGED, event, false);

			console.log(
				"[Main] ✅ Ekran kaydı durduruldu ve dosya oluşturuldu:",
				actualFilePath
			);
			return { success: true, filePath: actualFilePath };
		} else {
			console.error(
				"[Main] ❌ MacRecorder kaydı durdurulamadı veya dosya oluşturulamadı"
			);
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

	// SET_RECORDING_SOURCE handler for overlay selections
	safeHandle("SET_RECORDING_SOURCE", async (event, recordingSource) => {
		console.log(
			"[Main] Setting recording source from overlay:",
			recordingSource
		);
		if (mediaStateManager) {
			mediaStateManager.setRecordingSource(recordingSource);
			return true;
		}
		return false;
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

	// GET_TEMP_AUDIO_PATH handler'ı - audio dosyası için
	safeHandle("GET_TEMP_AUDIO_PATH", async () => {
		if (tempFileManager) {
			return tempFileManager.getFilePath("audio");
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
			console.log(
				"[Main] MacRecorder ekranları:",
				screens?.length,
				"adet screen",
				screens?.[0]
			);

			// Thumbnail'ları ekle
			const screensWithThumbnails = await Promise.all(
				screens.map(async (screen) => {
					try {
						// desktopCapturer kullanarak thumbnail al
						const sources = await desktopCapturer.getSources({
							types: ["screen"],
							thumbnailSize: { width: 320, height: 180 },
						});

						const matchingSource = sources.find(
							(source) =>
								source.display_id === screen.id?.toString() ||
								source.name.includes(
									screen.displayName || `Display ${screen.id}`
								)
						);

						return {
							...screen,
							thumbnail: matchingSource?.thumbnail?.toDataURL() || null,
							name: screen.displayName || screen.name || `Display ${screen.id}`,
						};
					} catch (thumbError) {
						console.error("[Main] Thumbnail alınamadı:", thumbError);
						return {
							...screen,
							thumbnail: null,
							name: screen.displayName || screen.name || `Display ${screen.id}`,
						};
					}
				})
			);

			return screensWithThumbnails;
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
			console.log(
				"[Main] MacRecorder pencereleri:",
				windows?.length,
				"adet",
				windows?.[0]
			);

			// Thumbnail'ları ekle
			const windowsWithThumbnails = await Promise.all(
				(windows || []).map(async (window) => {
					try {
						// desktopCapturer kullanarak thumbnail al
						const sources = await desktopCapturer.getSources({
							types: ["window"],
							thumbnailSize: { width: 320, height: 180 },
						});

						const matchingSource = sources.find(
							(source) =>
								source.id.includes(window.id?.toString()) ||
								source.name === window.name ||
								source.name === window.windowName
						);

						return {
							...window,
							thumbnail: matchingSource?.thumbnail?.toDataURL() || null,
							name:
								window.name ||
								window.windowName ||
								window.title ||
								"Unknown Window",
						};
					} catch (thumbError) {
						console.error("[Main] Window thumbnail alınamadı:", thumbError);
						return {
							...window,
							thumbnail: null,
							name:
								window.name ||
								window.windowName ||
								window.title ||
								"Unknown Window",
						};
					}
				})
			);

			// Production build'de pencere listesi boş olabilir - fallback ekle
			if (app.isPackaged && windowsWithThumbnails.length === 0) {
				console.warn(
					"[Main] Production build'de pencere listesi boş, fallback kullanılıyor"
				);
				return [
					{
						id: 0,
						name: "Tüm Ekranlar",
						ownerName: "System",
						isOnScreen: true,
						thumbnail: null,
					},
				];
			}

			return windowsWithThumbnails;
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
				// cameraManager.cameraWindow.hide();
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
			// mainWindow.setSize(width, height);
		}
	});

	// Kamera takip ayarı
	ipcMain.on("TOGGLE_CAMERA_FOLLOW", (event, shouldFollow) => {
		cameraManager.setFollowMouse(shouldFollow);
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

	// YENİ: Sistem ses cihazlarını filtreli olarak al
	safeHandle("GET_SYSTEM_AUDIO_DEVICES", async (event) => {
		try {
			console.log("[Main] Sistem ses cihazları alınıyor...");
			const recorder = getMacRecorderInstance();
			const allDevices = await recorder.getAudioDevices();

			// Sistem ses cihazlarını filtrele
			const systemAudioDevices = allDevices.filter(
				(device) =>
					device.name.toLowerCase().includes("aggregate") ||
					device.name.toLowerCase().includes("blackhole") ||
					device.name.toLowerCase().includes("soundflower") ||
					device.name.toLowerCase().includes("imobie") ||
					device.name.toLowerCase().includes("loopback")
			);

			console.log(
				"[Main] Bulunan sistem ses cihazları:",
				systemAudioDevices.map((d) => `${d.name} (${d.id})`)
			);
			return systemAudioDevices;
		} catch (error) {
			console.error("[Main] Sistem ses cihazları alınırken hata:", error);
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

	// MP4 conversion removed - WebM-only support
	console.log("[main] MP4 conversion removed - WebM-only mode");
	ipcMain.handle("CONVERT_WEBM_TO_MP4", async (event, conversionData) => {
		console.log("[main] MP4 conversion not supported - WebM-only mode");
		return {
			success: false,
			error: "MP4 conversion is not supported. Please use WebM format instead.",
		};
	});

	// Basit WebM to MP4 conversion handler
	ipcMain.handle(
		"SAVE_VIDEO",
		async (event, base64Data, outputPath, options = {}) => {
			try {
				console.log("[main] ✅ SAVE_VIDEO handler called");
				console.log("[main] Output path:", outputPath);
				console.log("[main] Options:", options);

				// Ensure directory exists
				const directory = path.dirname(outputPath);
				if (!fs.existsSync(directory)) {
					fs.mkdirSync(directory, { recursive: true });
				}

				// Base64'ten buffer'a çevir
				const base64String = base64Data.replace(
					/^data:video\/webm;base64,/,
					""
				);
				const inputBuffer = Buffer.from(base64String, "base64");

				// WebM direct save için conversion skip
				console.log("[main] 🔍 Options received:", options);
				console.log("[main] 🔍 skipConversion value:", options.skipConversion);
				console.log(
					"[main] 🔍 skipConversion type:",
					typeof options.skipConversion
				);
				console.log("[main] 🔍 Output path:", outputPath);
				console.log(
					"[main] 🔍 Output path extension:",
					path.extname(outputPath)
				);
				if (options.skipConversion === true) {
					console.log("[main] ⚡ Skipping FFmpeg - direct WebM save");
					fs.writeFileSync(outputPath, inputBuffer);
					console.log("[main] ✅ WebM saved directly - LIGHTNING FAST!");
					return { success: true, filePath: outputPath };
				}

				// MP4 conversion removed - WebM-only mode
				console.log("[main] ❌ MP4 conversion not supported - WebM-only mode");
				return {
					success: false,
					error:
						"MP4 conversion is not supported. Please use WebM format with skipConversion: true",
				};
			} catch (error) {
				console.error("[main] ❌ Fast conversion error:", error);
				return { success: false, error: error.message };
			}
		}
	);

	// SÜPER BASIT - Direct file save, no processing
	ipcMain.handle("SAVE_FILE_DIRECT", async (event, buffer, outputPath) => {
		try {
			console.log("[main] 🚀 SAVE_FILE_DIRECT - No processing, just save!");
			console.log("[main] Output:", outputPath);
			console.log("[main] Size:", buffer.length, "bytes");

			// Directory oluştur
			const directory = path.dirname(outputPath);
			if (!fs.existsSync(directory)) {
				fs.mkdirSync(directory, { recursive: true });
			}

			// Direkt dosyaya yaz - hiçbir işlem yok!
			fs.writeFileSync(outputPath, buffer);
			console.log("[main] ✅ File saved DIRECTLY - INSTANT!");

			return { success: true, filePath: outputPath };
		} catch (error) {
			console.error("[main] ❌ Direct file save error:", error);
			return { success: false, error: error.message };
		}
	});

	// Buffer'ı direkt dosyaya kaydet - no dialog, no conversion
	ipcMain.handle("SAVE_BUFFER_TO_FILE", async (event, data) => {
		try {
			console.log(
				"[main] 🎯 SAVE_BUFFER_TO_FILE - Direct save to specified path"
			);

			const { buffer, outputPath } = data;
			console.log("[main] Output path:", outputPath);
			console.log("[main] Buffer size:", buffer.length, "bytes");

			// Directory oluştur
			const directory = path.dirname(outputPath);
			if (!fs.existsSync(directory)) {
				fs.mkdirSync(directory, { recursive: true });
			}

			// Buffer array'ini Uint8Array'e çevir ve dosyaya yaz
			const uint8Buffer = new Uint8Array(buffer);
			fs.writeFileSync(outputPath, uint8Buffer);

			console.log(
				"[main] ✅ File saved directly to specified path - NO DIALOG!"
			);

			return { success: true, filePath: outputPath };
		} catch (error) {
			console.error("[main] ❌ Buffer save error:", error);
			return { success: false, error: error.message };
		}
	});

	// FFmpeg tabanlı export handler
	safeHandle("EXPORT_WITH_FFMPEG", async (event, exportData) => {
		try {
			console.log("[main] FFmpeg export başlatılıyor...");
			console.log("Frame count:", exportData.frames.length);
			console.log("Settings:", exportData.settings);

			const { frames, settings, duration } = exportData;
			const {
				filename,
				directory,
				format,
				width,
				height,
				fps,
				bitrate,
				audioSourcePath,
				audioTrimInfo,
				encodingSpeed,
				useHardwareAccel,
				audioQuality,
			} = settings;

			// Output path oluştur
			const outputPath = path.join(directory, `${filename}.${format}`);

			// Ensure directory exists
			if (!fs.existsSync(directory)) {
				fs.mkdirSync(directory, { recursive: true });
			}

			console.log(
				`[main] Processing ${frames.length} frames with format: ${format}`
			);

			if (format === "webm") {
				// WebM export - direkt kaydet, FFmpeg kullanma
				console.log(
					"[main] ⚡ WebM format detected - direct save without FFmpeg"
				);

				// Frames'leri WebM formatında birleştir ve direkt kaydet
				// Bu durumda frames zaten WebM formatında geliyor olmalı
				if (frames && frames.length > 0) {
					// İlk frame'i al (WebM data olarak gelmiş olmalı)
					const webmData = frames[0]; // WebM data

					// Base64'ten buffer'a çevir (eğer base64 formatında geliyorsa)
					let webmBuffer;
					if (
						typeof webmData === "string" &&
						webmData.startsWith("data:video/webm;base64,")
					) {
						const base64String = webmData.replace(
							/^data:video\/webm;base64,/,
							""
						);
						webmBuffer = Buffer.from(base64String, "base64");
					} else if (webmData instanceof Buffer) {
						webmBuffer = webmData;
					} else {
						// Eğer frames array'i ise, ilk frame'i kullan
						webmBuffer = Buffer.from(webmData);
					}

					// Direkt dosyaya kaydet
					fs.writeFileSync(outputPath, webmBuffer);
					console.log("[main] ✅ WebM saved directly - LIGHTNING FAST!");
				} else {
					throw new Error("No WebM data available for direct save");
				}
			} else {
				throw new Error(
					`Only WebM format is supported. Requested format: ${format}`
				);
			}

			console.log("[main] Export completed:", outputPath);
			return { success: true, filePath: outputPath };
		} catch (error) {
			console.error("[main] Export error:", error);
			return { success: false, error: error.message };
		}
	});

	// GIF export removed - WebM-only support
	safeHandle(IPC_EVENTS.SAVE_GIF, async (event, base64Data, outputPath) => {
		console.log("[main] GIF export not supported - WebM-only mode");
		return {
			success: false,
			error: "GIF export is not supported. Please use WebM format instead.",
		};
	});

	// WebM save handler - video-only WebM + audio birleştirme
	safeHandle(
		IPC_EVENTS.SAVE_WEBM_DIRECT,
		async (event, base64Data, outputPath) => {
			try {
				console.log(
					"[main] 🚀 SAVE_WEBM_DIRECT - Video-only WebM + Audio merge"
				);
				console.log("[main] Output path:", outputPath);

				// Ensure directory exists
				const directory = path.dirname(outputPath);
				if (!fs.existsSync(directory)) {
					fs.mkdirSync(directory, { recursive: true });
				}

				// Base64'ten buffer'a çevir
				const base64String = base64Data.replace(
					/^data:video\/webm;base64,/,
					""
				);
				const inputBuffer = Buffer.from(base64String, "base64");

				// Geçici video-only WebM dosyası oluştur
				const tempVideoPath = path.join(
					app.getPath("temp"),
					`temp_video_${Date.now()}.webm`
				);
				fs.writeFileSync(tempVideoPath, inputBuffer);
				console.log("[main] Video-only WebM written to temp:", tempVideoPath);

				// Temp audio dosyasını kontrol et
				const tempAudioPath = await new Promise((resolve) => {
					const tempFileManager = require("./tempFileManager.cjs");
					if (tempFileManager && tempFileManager.getTempAudioPath) {
						resolve(tempFileManager.getTempAudioPath());
					} else {
						resolve(null);
					}
				});

				// Audio merge removed - WebM already includes audio from MediaRecorder
				console.log(
					"[main] WebM already includes audio - no FFmpeg merge needed"
				);
				fs.copyFileSync(tempVideoPath, outputPath);
				fs.unlinkSync(tempVideoPath);

				console.log("[main] ✅ WebM saved:", outputPath);
				return { success: true, filePath: outputPath };
			} catch (error) {
				console.error("[main] ❌ WebM save error:", error);
				return { success: false, error: error.message };
			}
		}
	);

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
			// macOS'ta ekran kaydından gizle
			...(process.platform === "darwin" && {
				excludedFromShownWindowsMenu: true,
			}),
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
			},
		});

		// macOS'ta dialog penceresini ekran kaydından gizle
		if (process.platform === "darwin") {
			try {
				promptWindow.setContentProtection(true);
				console.log("[Main] ✅ Dialog penceresi ekran kaydından gizlendi");
			} catch (error) {
				console.warn(
					"[Main] ⚠️ Dialog pencere gizleme başarısız:",
					error.message
				);
			}
		}

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

	// Kamera penceresini gizle/göster
	ipcMain.on(IPC_EVENTS.HIDE_CAMERA_WINDOW, (event) => {
		console.log(
			"[main.cjs] Kamera penceresi gizleniyor (No camera recording seçildi)"
		);
		if (
			cameraManager &&
			cameraManager.cameraWindow &&
			!cameraManager.cameraWindow.isDestroyed()
		) {
			cameraManager.cameraWindow.hide();
		}
	});

	ipcMain.on(IPC_EVENTS.SHOW_CAMERA_WINDOW, (event) => {
		console.log(
			"[main.cjs] Kamera penceresi gösteriliyor (Camera source seçildi)"
		);
		if (
			cameraManager &&
			cameraManager.cameraWindow &&
			!cameraManager.cameraWindow.isDestroyed()
		) {
			cameraManager.cameraWindow.show();
		}
	});

	// Recording Settings Window
	ipcMain.on("SHOW_RECORDING_SETTINGS", async (event) => {
		console.log("[main.cjs] Recording settings window açılıyor");
		if (recordingSettingsManager) {
			await recordingSettingsManager.showSettingsWindow();
		}
	});

	ipcMain.handle("SAVE_RECORDING_SETTINGS", (event, settings) => {
		console.log("[main.cjs] Recording settings kaydediliyor:", settings);
		// TODO: Save to electron-store
		return { success: true };
	});

	ipcMain.handle("GET_OS_INFO", (event) => {
		return {
			homedir: os.homedir(),
			platform: os.platform(),
			arch: os.arch(),
		};
	});

	ipcMain.handle("GET_RECORDING_SETTINGS", (event) => {
		console.log("[main.cjs] Recording settings yükleniyor");
		// TODO: Load from electron-store
		return {};
	});

	// Initialize persistent store
	let authStore;
	try {
		authStore = new Store({
			name: "creavit-auth",
			defaults: {},
		});
		console.log("[main] Authentication store initialized");
	} catch (error) {
		console.error("[main] Failed to initialize authentication store:", error);
	}

	// Authentication handlers
	ipcMain.handle("STORE_AUTH_DATA", async (event, authData) => {
		try {
			if (authStore) {
				authStore.set("authData", authData);
				console.log("[main] Authentication data stored");
				return { success: true };
			}
			return { success: false, error: "Store not available" };
		} catch (error) {
			console.error("[main] Error storing auth data:", error);
			return { success: false, error: error.message };
		}
	});

	ipcMain.handle("GET_AUTH_DATA", async (event) => {
		try {
			if (authStore) {
				const authData = authStore.get("authData");
				console.log(
					"[main] Authentication data retrieved:",
					authData ? "Found" : "Not found"
				);
				return authData || null;
			}
			return null;
		} catch (error) {
			console.error("[main] Error getting auth data:", error);
			return null;
		}
	});

	ipcMain.handle("CLEAR_AUTH_DATA", async (event) => {
		try {
			if (authStore) {
				authStore.delete("authData");
				console.log("[main] Authentication data cleared");
				return { success: true };
			}
			return { success: false, error: "Store not available" };
		} catch (error) {
			console.error("[main] Error clearing auth data:", error);
			return { success: false, error: error.message };
		}
	});

	ipcMain.handle("OPEN_EXTERNAL_URL", async (event, url) => {
		try {
			const { shell } = require("electron");
			await shell.openExternal(url);
			console.log("[main] Opened external URL:", url);
			return { success: true };
		} catch (error) {
			console.error("[main] Error opening external URL:", error);
			return { success: false, error: error.message };
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
		width: 880,
		minWidth: 880,
		maxWidth: 880,
		height: 76,
		useContentSize: true,
		alwaysOnTop: true,
		resizable: false,
		minHeight: 76,
		maxHeight: 76,
		skipTaskbar: false,
		frame: false,
		transparent: true,
		hasShadow: true,
		movable: true,
		icon: path.join(__dirname, "../build/icon.png"),
		// macOS'ta ekran kaydından gizle
		...(process.platform === "darwin" && {
			excludedFromShownWindowsMenu: true,
		}),
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, "preload.cjs"),
			webSecurity: true,
			allowRunningInsecureContent: true,
			webviewTag: true,
			additionalArguments: ["--disable-site-isolation-trials"],
			// devTools property kaldırıldı - programatik kontrol kullanılacak
		},
	});

	setupSecurityPolicies();
	initializeManagers();
	setupWindowEvents();
	setupProductionSecurity();
	loadApplication();
}

// Production'da güvenlik ayarları
function setupProductionSecurity() {
	if (!isDev) {
		// Application menüsünü kaldır
		Menu.setApplicationMenu(null);

		// DevTools'u programatik olarak devre dışı bırak
		try {
			mainWindow.webContents.setDevToolsWebContents(null);
		} catch (error) {
			console.log("setDevToolsWebContents not available:", error.message);
		}

		// DevTools açma kısayollarını engelle
		mainWindow.webContents.on("before-input-event", (event, input) => {
			// F12, Cmd+Opt+I, Cmd+Shift+I gibi DevTools kısayollarını engelle
			if (
				input.key === "F12" ||
				(input.meta && input.alt && input.key.toLowerCase() === "i") ||
				(input.meta && input.shift && input.key.toLowerCase() === "i") ||
				(input.control && input.shift && input.key.toLowerCase() === "i")
			) {
				event.preventDefault();
				console.log("DevTools shortcut blocked in production");
			}
		});

		// Right-click context menu'yu devre dışı bırak
		mainWindow.webContents.on("context-menu", (event) => {
			event.preventDefault();
		});

		// DevTools açılma denemelerini engelle
		mainWindow.webContents.on("devtools-opened", () => {
			mainWindow.webContents.closeDevTools();
		});

		console.log("Production security measures applied");
	}

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
			"connect-src 'self' http://localhost:* file: data: electron: blob: https://storage.googleapis.com https://*.tensorflow.org https://api.giphy.com https://*.giphy.com https://api.creavit.studio https://creavit.studio; " +
			"img-src 'self' http://localhost:* file: data: electron: blob: https://*.giphy.com https://media.giphy.com https://media0.giphy.com https://media1.giphy.com https://media2.giphy.com https://media3.giphy.com https://media4.giphy.com; " +
			"style-src 'self' http://localhost:* file: data: electron: blob: 'unsafe-inline'; " +
			"font-src 'self' http://localhost:* file: data: electron: blob:; " +
			"media-src 'self' http://localhost:* file: data: electron: blob: https://*.giphy.com https://media.giphy.com;";

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
	recordingSettingsManager = new RecordingSettingsManager(mainWindow);
	mediaStateManager = new MediaStateManager(mainWindow);
	trayManager = new TrayManager(mainWindow, openEditorMode);

	// Tray ekle
	trayManager.createTray();

	// Kamera penceresini başlat
	cameraManager.initializeCamera();
}

function setupWindowEvents() {
	// macOS'ta pencereyi ekran kaydından gizle (native API)
	if (process.platform === "darwin") {
		try {
			// Electron'un setContentProtection API'sini kullan
			mainWindow.setContentProtection(true);
			console.log(
				"[Main] ✅ Ana pencere ekran kaydından gizlendi (setContentProtection)"
			);
		} catch (error) {
			console.warn("[Main] ⚠️ Ana pencere gizleme başarısız:", error.message);
		}
	}

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

// Function to check and inform about permissions
async function checkPermissions() {
	console.log("[Main] Checking system permissions...");

	// Check screen recording permission
	const screenPermission = systemPreferences.getMediaAccessStatus("screen");
	console.log(`[Main] Screen recording permission: ${screenPermission}`);

	// Check camera permission
	const cameraPermission = systemPreferences.getMediaAccessStatus("camera");
	console.log(`[Main] Camera permission: ${cameraPermission}`);

	// Check microphone permission
	const micPermission = systemPreferences.getMediaAccessStatus("microphone");
	console.log(`[Main] Microphone permission: ${micPermission}`);

	if (screenPermission !== "granted") {
		console.log(
			"[Main] ⚠️ Screen recording permission not granted. Will request when needed."
		);
	}

	return {
		screen: screenPermission,
		camera: cameraPermission,
		microphone: micPermission,
	};
}

// App lifecycle events
app.whenReady().then(async () => {
	// Uygulama kapanma değişkenini false olarak ayarla
	app.isQuitting = false;

	// Setup security policies first
	console.log("[Main] Setting up security policies...");
	setupSecurityPolicies();

	// Check permissions
	await checkPermissions();

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
		if (recordingSettingsManager) recordingSettingsManager.cleanup();
		if (trayManager) trayManager.cleanup();
		if (tempFileManager) tempFileManager.cleanupAllFiles();

		// FFmpeg processes removed - WebM-only mode

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

// Native Overlay System
let overlayWindows = [];
let dynamicWindowOverlay = null;
let mouseTrackingInterval = null;

// Create native overlay window
function createOverlayWindow(options = {}) {
	const overlay = new BrowserWindow({
		width: options.width || screen.getPrimaryDisplay().workAreaSize.width,
		height: options.height || screen.getPrimaryDisplay().workAreaSize.height,
		x: options.x || 0,
		y: options.y || 0,
		frame: false,
		transparent: true,
		alwaysOnTop: true,
		level: "screen-saver",
		skipTaskbar: true,
		resizable: false,
		movable: false,
		minimizable: false,
		maximizable: false,
		closable: true,
		focusable: true,
		fullscreen: false, // Never use fullscreen to avoid new desktop space
		kiosk: false, // Disable kiosk mode
		simpleFullscreen: false, // Disable simple fullscreen
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			enableRemoteModule: false,
			preload: path.join(__dirname, "preload.cjs"),
		},
	});

	// Prevent fullscreen to avoid new desktop space
	overlay.on("enter-full-screen", () => {
		overlay.setFullScreen(false);
	});

	// ESC key handler
	overlay.webContents.on("before-input-event", (event, input) => {
		if (input.key === "Escape") {
			closeAllOverlays();
		}
	});

	overlayWindows.push(overlay);
	return overlay;
}

// Close all overlay windows
function closeAllOverlays() {
	overlayWindows.forEach((overlay) => {
		if (!overlay.isDestroyed()) {
			overlay.close();
		}
	});
	overlayWindows = [];

	// Also close dynamic window overlay and stop window selector
	if (windowSelector) {
		try {
			windowSelector.cleanup();
		} catch (error) {
			console.error("[Main] Error cleaning up window selector:", error);
		}
		windowSelector = null;
	}

	hideCustomWindowOverlay();

	// Stop mouse tracking (legacy)
	if (mouseTrackingInterval) {
		clearInterval(mouseTrackingInterval);
		mouseTrackingInterval = null;
	}
}

// Native Screen Selector - Transparent highlight overlays
ipcMain.on("SHOW_NATIVE_SCREEN_SELECTOR", async () => {
	try {
		closeAllOverlays(); // Close any existing overlays

		const displays = screen.getAllDisplays();

		for (const display of displays) {
			const overlay = createOverlayWindow({
				x: display.bounds.x,
				y: display.bounds.y,
				width: display.bounds.width,
				height: display.bounds.height,
				fullscreen: false,
			});

			// Create transparent screen highlight HTML
			const screenHighlightHTML = `
				<!DOCTYPE html>
				<html>
				<head>
					<style>
						* {
							margin: 0;
							padding: 0;
							box-sizing: border-box;
						}
						body {
							width: 100vw;
							height: 100vh;
							background: transparent;
							position: relative;
							cursor: pointer;
						}
						.screen-highlight {
							position: absolute;
							top: 0;
							left: 0;
							width: 100%;
							height: 100%;
							border: 4px solid #007aff;
							border-radius: 12px;
							background: rgba(0, 122, 255, 0.1);
							transition: all 0.3s ease;
							box-shadow: 0 0 20px rgba(0, 122, 255, 0.5);
						}
						.screen-highlight:hover {
							border-color: #0056b3;
							background: rgba(0, 122, 255, 0.15);
							box-shadow: 0 0 30px rgba(0, 122, 255, 0.7);
						}
						.screen-info {
							position: absolute;
							top: 15px;
							left: 15px;
							background: rgba(0, 0, 0, 0.9);
							color: white;
							padding: 12px 18px;
							border-radius: 8px;
							font-family: -apple-system, BlinkMacSystemFont, sans-serif;
							font-size: 16px;
							font-weight: 600;
							backdrop-filter: blur(10px);
							z-index: 10;
						}
						.control-buttons {
							position: absolute;
							top: 50%;
							left: 50%;
							transform: translate(-50%, -50%);
							display: flex;
							gap: 15px;
							z-index: 10;
						}
						.record-button {
							background: #ff4444;
							color: white;
							border: none;
							padding: 15px 30px;
							border-radius: 12px;
							font-size: 18px;
							font-weight: 600;
							cursor: pointer;
							transition: all 0.3s ease;
							box-shadow: 0 4px 15px rgba(255, 68, 68, 0.4);
							backdrop-filter: blur(10px);
						}
						.record-button:hover {
							background: #ff3333;
							transform: scale(1.05);
							box-shadow: 0 6px 20px rgba(255, 68, 68, 0.6);
						}
						.close-button {
							position: absolute;
							top: 15px;
							right: 15px;
							width: 35px;
							height: 35px;
							background: rgba(255, 68, 68, 0.9);
							border: none;
							border-radius: 50%;
							color: white;
							font-size: 18px;
							cursor: pointer;
							display: flex;
							align-items: center;
							justify-content: center;
							backdrop-filter: blur(10px);
							transition: all 0.3s ease;
							z-index: 10;
						}
						.close-button:hover {
							background: #ff3333;
							transform: scale(1.1);
						}
					</style>
				</head>
				<body onclick="selectScreen()">
					<div class="screen-highlight"></div>
					<div class="screen-info">${
						display.label || "Display " + (displays.indexOf(display) + 1)
					}</div>
					<div class="control-buttons">
						<button class="record-button" onclick="event.stopPropagation(); selectScreen();">
							📹 Start Recording
						</button>
					</div>
					<button class="close-button" onclick="event.stopPropagation(); closeOverlay();" title="Close">
						✕
					</button>
					<script>
						function selectScreen() {
							window.electron.ipcRenderer.send('NATIVE_SCREEN_SELECTED', {
								id: 'screen:${display.id}',
								name: '${display.label || "Display " + (displays.indexOf(display) + 1)}',
								macRecorderId: ${display.id},
								bounds: ${JSON.stringify(display.bounds)}
							});
						}
						function closeOverlay() {
							window.electron.ipcRenderer.send('CLOSE_NATIVE_OVERLAYS');
						}
						// ESC key handler
						document.addEventListener('keydown', (e) => {
							if (e.key === 'Escape') closeOverlay();
						});
					</script>
				</body>
				</html>
			`;

			overlay.loadURL(
				`data:text/html;charset=utf-8,${encodeURIComponent(
					screenHighlightHTML
				)}`
			);
		}
	} catch (error) {
		console.error("Error showing native screen selector:", error);
	}
});

// Native Window Selector - Better approach without Mission Control
ipcMain.on("SHOW_NATIVE_WINDOW_SELECTOR", async () => {
	try {
		console.log("[Main] Window selector disabled - no overlay will be shown");
		// TODO: Implement window selection using getWindows() without overlay
		// For now, just return to prevent any overlay creation
		return;

		closeAllOverlays();

		// Get all windows using desktopCapturer first
		const sources = await desktopCapturer.getSources({
			types: ["window"],
			fetchWindowIcons: true,
		});

		// Filter out system windows and get real application windows
		const appWindows = sources.filter(
			(source) =>
				source.name &&
				source.name !== "" &&
				source.name.length > 1 &&
				!source.name.includes("Desktop") &&
				!source.name.includes("Wallpaper") &&
				!source.name.includes("Window Server") &&
				!source.name.includes("StatusMenuBar") &&
				!source.name.includes("Notification") &&
				!source.name.includes("Control Center") &&
				source.name !== "Item-0"
		);

		console.log(
			"Found windows:",
			appWindows.map((w) => ({ name: w.name, id: w.id }))
		);

		if (appWindows.length === 0) {
			console.log("No suitable windows found for recording");
			return;
		}

		// Use AppleScript to get actual window positions and sizes
		const { exec } = require("child_process");

		// Create overlays for each window using AppleScript to get bounds
		for (let i = 0; i < appWindows.length; i++) {
			const windowSource = appWindows[i];

			try {
				// Get window bounds using AppleScript (this is a simplified version)
				const getWindowBounds = `
					tell application "System Events"
						set windowList to every window of (processes where background only is false)
						repeat with theWindow in windowList
							set windowName to name of theWindow
							if windowName contains "${windowSource.name.substring(0, 10)}" then
								set windowPosition to position of theWindow
								set windowSize to size of theWindow
								return {item 1 of windowPosition, item 2 of windowPosition, item 1 of windowSize, item 2 of windowSize}
							end if
						end repeat
						return {100, 100, 400, 300}
					end tell
				`;

				exec(`osascript -e '${getWindowBounds}'`, (error, stdout, stderr) => {
					if (error) {
						console.log(
							"AppleScript error, using fallback position for:",
							windowSource.name
						);
						// Fallback to grid positioning
						const cols = 3;
						const row = Math.floor(i / cols);
						const col = i % cols;
						const windowWidth = 350;
						const windowHeight = 250;
						const spacing = 20;
						const startX = 100;
						const startY = 100;

						createWindowOverlay(
							windowSource,
							startX + col * (windowWidth + spacing),
							startY + row * (windowHeight + spacing),
							windowWidth,
							windowHeight
						);
					} else {
						// Parse AppleScript result
						const bounds = stdout
							.trim()
							.split(", ")
							.map((n) => parseInt(n));
						if (bounds.length === 4) {
							createWindowOverlay(
								windowSource,
								bounds[0],
								bounds[1],
								bounds[2],
								bounds[3]
							);
						} else {
							// Fallback positioning
							const cols = 3;
							const row = Math.floor(i / cols);
							const col = i % cols;
							const windowWidth = 350;
							const windowHeight = 250;
							const spacing = 20;

							createWindowOverlay(
								windowSource,
								100 + col * (windowWidth + spacing),
								100 + row * (windowHeight + spacing),
								windowWidth,
								windowHeight
							);
						}
					}
				});
			} catch (scriptError) {
				console.error(
					"Script error for window:",
					windowSource.name,
					scriptError
				);
				// Fallback grid positioning
				const cols = 3;
				const row = Math.floor(i / cols);
				const col = i % cols;
				const windowWidth = 350;
				const windowHeight = 250;
				const spacing = 20;

				createWindowOverlay(
					windowSource,
					100 + col * (windowWidth + spacing),
					100 + row * (windowHeight + spacing),
					windowWidth,
					windowHeight
				);
			}
		}

		// Create a global close button overlay
		setTimeout(() => {
			const closeOverlay = createOverlayWindow({
				x: screen.getPrimaryDisplay().bounds.width - 80,
				y: 30,
				width: 60,
				height: 60,
				fullscreen: false,
			});

			const closeButtonHTML = `
				<!DOCTYPE html>
				<html>
				<head>
					<style>
						body {
							margin: 0;
							background: transparent;
							display: flex;
							align-items: center;
							justify-content: center;
							height: 100vh;
						}
						.close-btn {
							width: 50px;
							height: 50px;
							background: #ff4444;
							border: none;
							border-radius: 50%;
							color: white;
							font-size: 20px;
							cursor: pointer;
							display: flex;
							align-items: center;
							justify-content: center;
							backdrop-filter: blur(10px);
							transition: all 0.3s ease;
							box-shadow: 0 4px 15px rgba(255, 68, 68, 0.4);
						}
						.close-btn:hover {
							background: #ff3333;
							transform: scale(1.1);
						}
					</style>
				</head>
				<body>
					<button class="close-btn" onclick="closeAll()">✕</button>
					<script>
						function closeAll() {
							window.electron.ipcRenderer.send('CLOSE_NATIVE_OVERLAYS');
						}
						document.addEventListener('keydown', (e) => {
							if (e.key === 'Escape') closeAll();
						});
					</script>
				</body>
				</html>
			`;

			closeOverlay.loadURL(
				`data:text/html;charset=utf-8,${encodeURIComponent(closeButtonHTML)}`
			);
		}, 500);
	} catch (error) {
		console.error("Error showing native window selector:", error);
	}
});

// Helper function to create window overlay
function createWindowOverlay(windowSource, x, y, width, height) {
	const windowOverlay = createOverlayWindow({
		x: x,
		y: y,
		width: width,
		height: height,
		fullscreen: false,
	});

	const windowHighlightHTML = `
		<!DOCTYPE html>
		<html>
		<head>
			<style>
				* {
					margin: 0;
					padding: 0;
					box-sizing: border-box;
				}
				body {
					width: 100vw;
					height: 100vh;
					background: transparent;
					position: relative;
					cursor: pointer;
				}
				.window-highlight {
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					border: 3px solid #007aff;
					border-radius: 8px;
					background: rgba(0, 122, 255, 0.08);
					transition: all 0.3s ease;
					box-shadow: 0 0 20px rgba(0, 122, 255, 0.3);
				}
				.window-highlight:hover {
					border-color: #0056b3;
					background: rgba(0, 122, 255, 0.15);
					box-shadow: 0 0 30px rgba(0, 122, 255, 0.5);
					transform: scale(1.02);
				}
				.window-info {
					position: absolute;
					top: -40px;
					left: 0;
					right: 0;
					background: rgba(0, 0, 0, 0.9);
					color: white;
					padding: 8px 12px;
					border-radius: 6px;
					font-family: -apple-system, BlinkMacSystemFont, sans-serif;
					font-size: 13px;
					font-weight: 600;
					backdrop-filter: blur(10px);
					text-align: center;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}
				.record-button {
					position: absolute;
					top: 50%;
					left: 50%;
					transform: translate(-50%, -50%);
					background: #ff4444;
					color: white;
					border: none;
					padding: 12px 20px;
					border-radius: 8px;
					font-size: 16px;
					font-weight: 600;
					cursor: pointer;
					transition: all 0.3s ease;
					box-shadow: 0 4px 15px rgba(255, 68, 68, 0.4);
					backdrop-filter: blur(10px);
					opacity: 0;
					z-index: 10;
				}
				.window-highlight:hover .record-button {
					opacity: 1;
				}
				.record-button:hover {
					background: #ff3333;
					transform: translate(-50%, -50%) scale(1.05);
				}
			</style>
		</head>
		<body onclick="selectWindow()">
			<div class="window-highlight">
				<div class="window-info">${windowSource.name}</div>
				<button class="record-button" onclick="event.stopPropagation(); selectWindow();">
					📹 Record
				</button>
			</div>
			<script>
				function selectWindow() {
					// Send window selection
					window.electron.ipcRenderer.send('NATIVE_WINDOW_SELECTED', {
						id: '${windowSource.id}',
						name: '${windowSource.name.replace(/'/g, "\\'")}',
						macRecorderId: '${windowSource.id}',
						bounds: { x: ${x}, y: ${y}, width: ${width}, height: ${height} }
					});
				}
				
				// ESC key handler
				document.addEventListener('keydown', (e) => {
					if (e.key === 'Escape') {
						window.electron.ipcRenderer.send('CLOSE_NATIVE_OVERLAYS');
					}
				});
			</script>
		</body>
		</html>
	`;

	windowOverlay.loadURL(
		`data:text/html;charset=utf-8,${encodeURIComponent(windowHighlightHTML)}`
	);
}

// Native Area Selector
ipcMain.on("SHOW_NATIVE_AREA_SELECTOR", async () => {
	try {
		console.log("[Main] Starting custom area selector...");

		closeAllOverlays();

		// Get all displays and create overlay covering all screens
		const displays = screen.getAllDisplays();

		// Calculate bounds that cover all displays
		let minX = Math.min(...displays.map((d) => d.bounds.x));
		let minY = Math.min(...displays.map((d) => d.bounds.y));
		let maxX = Math.max(...displays.map((d) => d.bounds.x + d.bounds.width));
		let maxY = Math.max(...displays.map((d) => d.bounds.y + d.bounds.height));

		const overlay = createOverlayWindow({
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
			fullscreen: false, // Don't use fullscreen to avoid new desktop space
		});

		const areaSelectorHTML = `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body {
						margin: 0;
						padding: 0;
						background: rgba(0, 0, 0, 0.3);
						cursor: crosshair;
						height: 100vh;
						overflow: hidden;
						user-select: none;
					}
					.instructions {
						position: absolute;
						top: 30px;
						left: 50%;
						transform: translateX(-50%);
						background: rgba(0, 0, 0, 0.8);
						color: white;
						padding: 15px 25px;
						border-radius: 10px;
						font-family: -apple-system, BlinkMacSystemFont, sans-serif;
						font-size: 18px;
						font-weight: 500;
						z-index: 100;
					}
					.selection-area {
						position: absolute;
						border: 2px solid #007aff;
						background: rgba(0, 122, 255, 0.1);
						display: none;
						z-index: 50;
						cursor: move;
						min-width: 200px;
						min-height: 200px;
					}
					.resize-handle {
						position: absolute;
						background: #007aff;
						border: 1px solid white;
					}
					.resize-handle.nw { top: -5px; left: -5px; width: 10px; height: 10px; cursor: nw-resize; }
					.resize-handle.ne { top: -5px; right: -5px; width: 10px; height: 10px; cursor: ne-resize; }
					.resize-handle.sw { bottom: -5px; left: -5px; width: 10px; height: 10px; cursor: sw-resize; }
					.resize-handle.se { bottom: -5px; right: -5px; width: 10px; height: 10px; cursor: se-resize; }
					.selection-controls {
						position: absolute;
						bottom: 10px;
						right: 10px;
						display: none;
						gap: 10px;
					}
					.selection-controls button {
						padding: 10px 20px;
						border: none;
						border-radius: 8px;
						font-size: 14px;
						font-weight: 600;
						cursor: pointer;
					}
					.start-btn {
						background: #ff4444;
						color: white;
					}
					.start-btn:hover {
						background: #ff3333;
					}
					.cancel-btn {
						background: #666;
						color: white;
					}
					.cancel-btn:hover {
						background: #555;
					}
					.close-button {
						position: absolute;
						top: 30px;
						right: 30px;
						width: 50px;
						height: 50px;
						background: #ff4444;
						border: none;
						border-radius: 50%;
						color: white;
						font-size: 24px;
						cursor: pointer;
						display: flex;
						align-items: center;
						justify-content: center;
						z-index: 100;
					}
					.close-button:hover {
						background: #ff3333;
					}
				</style>
			</head>
			<body>
				<div class="instructions">Click and drag to select recording area</div>
				<button class="close-button" onclick="closeOverlay()" title="Close">&times;</button>
				<div class="selection-area" id="selectionArea">
					<div class="resize-handle nw"></div>
					<div class="resize-handle ne"></div>
					<div class="resize-handle sw"></div>
					<div class="resize-handle se"></div>
					<div class="selection-controls">
						<input type="number" id="widthInput" placeholder="Width" style="padding: 8px; width: 80px; margin-right: 5px; border: 1px solid #ccc; border-radius: 4px;">
						<input type="number" id="heightInput" placeholder="Height" style="padding: 8px; width: 80px; margin-right: 10px; border: 1px solid #ccc; border-radius: 4px;">
						<button class="start-btn" onclick="startAreaRecording()">Start Record</button>
						<button class="cancel-btn" onclick="closeOverlay()">Cancel</button>
					</div>
				</div>
				<script>
					let isSelecting = false;
					let isDragging = false;
					let isResizing = false;
					let resizeType = '';
					let startX, startY;
					let selectionArea = document.getElementById('selectionArea');
					let widthInput = document.getElementById('widthInput');
					let heightInput = document.getElementById('heightInput');
					
					// Create initial selection
					document.addEventListener('mousedown', (e) => {
						if (e.target.classList.contains('close-button') || e.target.closest('.selection-controls')) return;
						
						// Check for resize handle
						if (e.target.classList.contains('resize-handle')) {
							isResizing = true;
							resizeType = e.target.classList[1]; // nw, ne, sw, se
							startX = e.clientX;
							startY = e.clientY;
							return;
						}
						
						// Check if clicking inside selection area
						if (e.target === selectionArea || selectionArea.contains(e.target)) {
							isDragging = true;
							const rect = selectionArea.getBoundingClientRect();
							startX = e.clientX - rect.left;
							startY = e.clientY - rect.top;
							return;
						}
						
						// Create new selection
						isSelecting = true;
						startX = e.clientX;
						startY = e.clientY;
						
						selectionArea.style.left = startX + 'px';
						selectionArea.style.top = startY + 'px';
						selectionArea.style.width = '0px';
						selectionArea.style.height = '0px';
						selectionArea.style.display = 'block';
						selectionArea.querySelector('.selection-controls').style.display = 'none';
						updateInputs();
					});
					
					document.addEventListener('mousemove', (e) => {
						if (isSelecting) {
							const currentX = e.clientX;
							const currentY = e.clientY;
							
							const width = Math.abs(currentX - startX);
							const height = Math.abs(currentY - startY);
							const left = Math.min(currentX, startX);
							const top = Math.min(currentY, startY);
							
							selectionArea.style.left = left + 'px';
							selectionArea.style.top = top + 'px';
							selectionArea.style.width = width + 'px';
							selectionArea.style.height = height + 'px';
							updateInputs();
						} else if (isDragging) {
							const newLeft = e.clientX - startX;
							const newTop = e.clientY - startY;
							
							selectionArea.style.left = Math.max(0, newLeft) + 'px';
							selectionArea.style.top = Math.max(0, newTop) + 'px';
						} else if (isResizing) {
							const rect = selectionArea.getBoundingClientRect();
							
							let newLeft = rect.left;
							let newTop = rect.top;
							let newWidth = rect.width;
							let newHeight = rect.height;
							
							if (resizeType.includes('w')) {
								const deltaX = e.clientX - rect.left;
								newLeft = e.clientX;
								newWidth = rect.right - e.clientX;
							}
							if (resizeType.includes('e')) {
								newWidth = e.clientX - rect.left;
							}
							if (resizeType.includes('n')) {
								const deltaY = e.clientY - rect.top;
								newTop = e.clientY;
								newHeight = rect.bottom - e.clientY;
							}
							if (resizeType.includes('s')) {
								newHeight = e.clientY - rect.top;
							}
							
							// Apply minimum size constraints
							if (newWidth >= 200 && newHeight >= 200) {
								selectionArea.style.left = Math.max(0, newLeft) + 'px';
								selectionArea.style.top = Math.max(0, newTop) + 'px';
								selectionArea.style.width = newWidth + 'px';
								selectionArea.style.height = newHeight + 'px';
								updateInputs();
							}
						}
					});
					
					document.addEventListener('mouseup', (e) => {
						if (isSelecting) {
							isSelecting = false;
							const rect = selectionArea.getBoundingClientRect();
							if (rect.width >= 200 && rect.height >= 200) {
								selectionArea.querySelector('.selection-controls').style.display = 'flex';
								updateInputs();
							} else {
								selectionArea.style.display = 'none';
							}
						}
						isDragging = false;
						isResizing = false;
						resizeType = '';
					});
					
					// Update inputs when selection changes
					function updateInputs() {
						const rect = selectionArea.getBoundingClientRect();
						widthInput.value = Math.round(rect.width);
						heightInput.value = Math.round(rect.height);
					}
					
					// Update selection when inputs change
					widthInput.addEventListener('input', () => {
						const width = parseInt(widthInput.value) || 200;
						selectionArea.style.width = Math.max(200, width) + 'px';
					});
					
					heightInput.addEventListener('input', () => {
						const height = parseInt(heightInput.value) || 200;
						selectionArea.style.height = Math.max(200, height) + 'px';
					});
					
					function startAreaRecording() {
						const rect = selectionArea.getBoundingClientRect();
						console.log('[Overlay] Starting area recording with bounds:', {
							x: rect.left,
							y: rect.top, 
							width: rect.width,
							height: rect.height
						});
						
						// Validate minimum size
						if (rect.width < 200 || rect.height < 200) {
							alert('Selection area must be at least 200x200 pixels');
							return;
						}
						
						// Get screen offsets to correct Y-axis
						const screenX = window.screen.availLeft || 0;
						const screenY = window.screen.availTop || 0;
						
						const bounds = {
							x: Math.round(rect.left + screenX),
							y: Math.round(rect.top + screenY),
							width: Math.round(rect.width),
							height: Math.round(rect.height)
						};
						
						console.log('[Overlay] Corrected bounds with screen offset:', bounds);
						console.log('[Overlay] Screen offset:', { screenX, screenY });
						console.log('[Overlay] Sending START_AREA_RECORDING event...');
						
						window.electron.ipcRenderer.send('START_AREA_RECORDING', {
							bounds: bounds
						});
					}
					
					function closeOverlay() {
						window.electron.ipcRenderer.send('CLOSE_NATIVE_OVERLAYS');
					}
					
					// ESC key handler
					document.addEventListener('keydown', (e) => {
						if (e.key === 'Escape') closeOverlay();
					});
				</script>
			</body>
			</html>
		`;

		overlay.loadURL(
			`data:text/html;charset=utf-8,${encodeURIComponent(areaSelectorHTML)}`
		);
	} catch (error) {
		console.error("Error showing native area selector:", error);
	}
});

// Bring window to front
ipcMain.on("BRING_WINDOW_TO_FRONT", (event, windowId) => {
	try {
		// Use AppleScript to bring window to front
		const { exec } = require("child_process");
		// This is a simplified approach - in real implementation you'd use proper window management
		exec(
			'osascript -e "tell application \\"System Events\\" to keystroke tab using command down"'
		);
	} catch (error) {
		console.error("Error bringing window to front:", error);
	}
});

// Handle overlay events
ipcMain.on("NATIVE_SCREEN_SELECTED", (event, screenData) => {
	closeAllOverlays();
	// Forward to renderer
	if (mainWindow && !mainWindow.isDestroyed()) {
		mainWindow.webContents.send("NATIVE_SCREEN_SELECTED", screenData);
	}
});

ipcMain.on("NATIVE_WINDOW_SELECTED", (event, windowData) => {
	closeAllOverlays();
	// Forward to renderer
	if (mainWindow && !mainWindow.isDestroyed()) {
		mainWindow.webContents.send("NATIVE_WINDOW_SELECTED", windowData);
	}
});

ipcMain.on("START_AREA_RECORDING", async (event, areaData) => {
	console.log("[Main] START_AREA_RECORDING received:", areaData);
	closeAllOverlays();

	try {
		// Start area recording directly like window/screen recording
		console.log("[Main] Starting area recording with bounds:", areaData.bounds);

		// Send to renderer to start recording immediately
		const eventData = {
			cropArea: areaData.bounds,
			source: {
				sourceType: "area",
				sourceId: "area:custom",
				sourceName: "Selected Area",
			},
		};

		console.log(
			"[Main] Sending START_AREA_RECORDING event to renderer:",
			eventData
		);
		mainWindow.webContents.send("START_AREA_RECORDING", eventData);
	} catch (error) {
		console.error("[Main] Error handling START_AREA_RECORDING:", error);
	}
});

// Keep old handler for backward compatibility
ipcMain.on("NATIVE_AREA_SELECTED", (event, areaData) => {
	console.log("[Main] NATIVE_AREA_SELECTED received:", areaData);
	closeAllOverlays();
	// Forward to renderer
	if (mainWindow && !mainWindow.isDestroyed()) {
		console.log("[Main] Forwarding NATIVE_AREA_SELECTED to renderer");
		mainWindow.webContents.send("NATIVE_AREA_SELECTED", areaData);
	}
});

ipcMain.on("CLOSE_NATIVE_OVERLAYS", () => {
	closeAllOverlays();
});

// Dynamic Window Overlay System - Using native WindowSelector
let windowSelector = null;

async function startDynamicWindowOverlay() {
	try {
		closeAllOverlays(); // Close any existing overlays

		// Import WindowSelector
		const WindowSelector = require("node-mac-recorder/window-selector");
		windowSelector = new WindowSelector();

		console.log("[Main] Starting native WindowSelector...");

		// Set up event listeners
		windowSelector.on("windowEntered", (windowInfo) => {
			console.log(
				"[Main] Window entered:",
				windowInfo.title,
				windowInfo.appName
			);

			// Create our custom overlay to match the window
			createCustomWindowOverlay(windowInfo);
		});

		windowSelector.on("windowLeft", (windowInfo) => {
			console.log("[Main] Window left:", windowInfo.title);

			// Hide our custom overlay
			hideCustomWindowOverlay();
		});

		windowSelector.on("windowSelected", async (windowInfo) => {
			console.log("[DEBUG] WindowSelector windowSelected event triggered");
			console.log(
				"[Main] Window selected, starting recording:",
				windowInfo.title
			);

			// Stop selection first
			await stopDynamicWindowOverlay();

			// Prepare crop info for window recording
			const cropInfo = {
				x: windowInfo.x,
				y: windowInfo.y,
				width: windowInfo.width,
				height: windowInfo.height,
			};

			// Send to renderer to trigger recording with crop info
			if (mainWindow && !mainWindow.isDestroyed()) {
				const eventData = {
					windowInfo: windowInfo,
					cropInfo: cropInfo,
					source: {
						id: windowInfo.id.toString(),
						name: windowInfo.title,
						appName: windowInfo.appName,
						type: "window",
						...cropInfo,
					},
				};

				console.log(
					"[DEBUG] Sending START_WINDOW_RECORDING event with data:",
					eventData
				);
				mainWindow.webContents.send("START_WINDOW_RECORDING", eventData);
			}

			console.log(
				"[Main] Window recording request sent:",
				windowInfo.title,
				cropInfo
			);
		});

		windowSelector.on("error", (error) => {
			console.error("[Main] WindowSelector error:", error);
		});

		// Start the window selection
		await windowSelector.startSelection();

		console.log("[Main] Native WindowSelector started successfully");
	} catch (error) {
		console.error("[Main] Error starting native WindowSelector:", error);
	}
}

// Create custom overlay to enhance native selection
function createCustomWindowOverlay(windowInfo) {
	// Close existing custom overlay
	hideCustomWindowOverlay();

	// Create enhanced overlay window that matches the selected window exactly
	dynamicWindowOverlay = createOverlayWindow({
		x: windowInfo.x,
		y: windowInfo.y,
		width: windowInfo.width,
		height: windowInfo.height,
		fullscreen: false,
	});

	// Create enhanced overlay HTML - Screen Studio style
	const enhancedOverlayHTML = `
		<!DOCTYPE html>
		<html>
		<head>
			<style>
				* {
					margin: 0;
					padding: 0;
					box-sizing: border-box;
				}
				body {
					width: 100vw;
					height: 100vh;
					background: transparent;
					position: relative;
					overflow: hidden;
				}
				.window-highlight {
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					border: 4px solid #007AFF;
					border-radius: 12px;
					background: rgba(0, 122, 255, 0.08);
					box-shadow: 
						0 0 20px rgba(0, 122, 255, 0.5),
						inset 0 0 20px rgba(0, 122, 255, 0.1);
					pointer-events: none;
					animation: pulseGlow 2s ease-in-out infinite alternate;
				}
				.window-info {
					position: absolute;
					top: -50px;
					left: 50%;
					transform: translateX(-50%);
					background: rgba(0, 122, 255, 0.95);
					color: white;
					padding: 8px 16px;
					border-radius: 8px;
					font-family: -apple-system, BlinkMacSystemFont, sans-serif;
					font-size: 13px;
					font-weight: 500;
					white-space: nowrap;
					backdrop-filter: blur(15px);
					border: 1px solid rgba(0, 122, 255, 0.3);
					box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
				}
				@keyframes pulseGlow {
					0% { box-shadow: 0 0 20px rgba(0, 122, 255, 0.5), inset 0 0 20px rgba(0, 122, 255, 0.1); }
					100% { box-shadow: 0 0 30px rgba(0, 122, 255, 0.8), inset 0 0 25px rgba(0, 122, 255, 0.15); }
				}
			</style>
		</head>
		<body>
			<div class="window-highlight">
				<div class="window-info">${windowInfo.appName} - ${windowInfo.title}</div>
			</div>
		</body>
		</html>
	`;

	dynamicWindowOverlay.loadURL(
		`data:text/html;charset=utf-8,${encodeURIComponent(enhancedOverlayHTML)}`
	);
}

function hideCustomWindowOverlay() {
	if (dynamicWindowOverlay && !dynamicWindowOverlay.isDestroyed()) {
		dynamicWindowOverlay.close();
		dynamicWindowOverlay = null;
	}
}

async function stopDynamicWindowOverlay() {
	try {
		if (windowSelector) {
			await windowSelector.cleanup();
			windowSelector = null;
		}

		hideCustomWindowOverlay();

		console.log("[Main] Dynamic window overlay stopped");
	} catch (error) {
		console.error("[Main] Error stopping window overlay:", error);
	}
}

ipcMain.on("START_DYNAMIC_WINDOW_OVERLAY", startDynamicWindowOverlay);
ipcMain.on("STOP_DYNAMIC_WINDOW_OVERLAY", stopDynamicWindowOverlay);

// Screen Selection System - Using native WindowSelector
async function startDynamicScreenOverlay() {
	try {
		closeAllOverlays(); // Close any existing overlays

		// Import WindowSelector (same module, different method)
		const WindowSelector = require("node-mac-recorder/window-selector");
		windowSelector = new WindowSelector();

		console.log("[Main] Starting native Screen Selection...");

		// Use Promise-based screen selection
		try {
			console.log("[DEBUG] Waiting for screen selection...");
			const selectedScreen = await windowSelector.selectScreen();
			console.log("[DEBUG] Screen selection completed");
			console.log(
				"[Main] Screen selected, starting recording:",
				selectedScreen.name
			);

			// Stop selection first
			await stopDynamicScreenOverlay();

			// Prepare crop info for screen recording (full screen)
			const cropInfo = {
				x: selectedScreen.x,
				y: selectedScreen.y,
				width: selectedScreen.width,
				height: selectedScreen.height,
			};

			// Create screen recording source
			const source = {
				sourceType: "screen",
				id: selectedScreen.id,
				name: selectedScreen.name,
				thumbnail: "", // Will be filled later if needed
			};

			// Send to renderer to trigger recording with crop info
			if (mainWindow && !mainWindow.isDestroyed()) {
				const eventData = {
					screenInfo: selectedScreen,
					cropInfo: cropInfo,
					source: source,
				};

				console.log(
					"[DEBUG] Sending START_SCREEN_RECORDING event with data:",
					eventData
				);
				mainWindow.webContents.send("START_SCREEN_RECORDING", eventData);
			}

			console.log(
				"[Main] Screen recording request sent:",
				selectedScreen.name,
				cropInfo
			);
		} catch (selectionError) {
			if (selectionError.message.includes("cancelled")) {
				console.log("[Main] Screen selection cancelled by user");
			} else {
				console.error("[Main] Screen selection error:", selectionError);
			}
		}
	} catch (error) {
		console.error("[Main] Error starting native Screen Selection:", error);
	}
}

async function stopDynamicScreenOverlay() {
	try {
		if (windowSelector) {
			await windowSelector.stopScreenSelection();
			await windowSelector.cleanup();
			windowSelector = null;
		}

		console.log("[Main] Dynamic screen overlay stopped");
	} catch (error) {
		console.error("[Main] Error stopping screen overlay:", error);
	}
}

ipcMain.on("START_DYNAMIC_SCREEN_OVERLAY", startDynamicScreenOverlay);
ipcMain.on("STOP_DYNAMIC_SCREEN_OVERLAY", stopDynamicScreenOverlay);

// Clean up overlays on app quit
app.on("before-quit", () => {
	closeAllOverlays();
});
