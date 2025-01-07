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
} = require("electron");
const path = require("path");
const fs = require("fs");
const isDev = process.env.NODE_ENV === "development";
const waitOn = require("wait-on");
const ffmpeg = require("fluent-ffmpeg");

const { IPC_EVENTS } = require("./constants.cjs");
const TrayManager = require("./trayManager.cjs");
const CameraManager = require("./cameraManager.cjs");
const EditorManager = require("./editorManager.cjs");
const SelectionManager = require("./selectionManager.cjs");
const TempFileManager = require("./tempFileManager.cjs");
const MediaStateManager = require("./mediaStateManager.cjs");

let mainWindow = null;
let trayManager = null;
let cameraManager = null;
let selectionManager = null;
let editorManager = null;
let tempFileManager = null;
let mediaStateManager = null;

// Pencere sürükleme için değişkenler
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

let mouseTrackingInterval = null;
let mousePositions = [];

// IPC event handlers
function setupIpcHandlers() {
	// Recording status
	ipcMain.on(IPC_EVENTS.RECORDING_STATUS_CHANGED, async (event, status) => {
		console.log("********Kayıt durumu değişti:", status);
		if (status) {
			// Start mouse position tracking when recording starts
			console.log(1232);
			startMouseTracking();
		} else {
			console.log(423);
			// Stop mouse position tracking when recording stops
			stopMouseTracking();
		}

		try {
			const result = await mediaStateManager.handleRecordingStatusChange(
				status,
				tempFileManager
			);

			if (!status) {
				// Kayıt durdurulduğunda
				if (cameraManager) {
					cameraManager.closeCameraWindow();
				}

				// Medya dosyaları hazır olduğunda editor'ü aç
				if (result && editorManager) {
					try {
						// Editor'ü açmadan önce son bir kez daha medya dosyalarını kontrol et
						if (!mediaStateManager.isMediaReady()) {
							throw new Error("Medya dosyaları hazır değil");
						}

						await editorManager.showEditorWindow();

						if (editorManager.editorWindow) {
							// Editor'ün yüklenmesini bekle
							await new Promise((resolve, reject) => {
								const timeout = setTimeout(() => {
									reject(new Error("Editor yükleme zaman aşımı"));
								}, 10000);

								editorManager.editorWindow.webContents.once(
									"did-finish-load",
									() => {
										clearTimeout(timeout);
										resolve();
									}
								);
							});

							// Editor'e medya durumunu gönder
							mediaStateManager.notifyRenderers(editorManager.editorWindow);

							setTimeout(() => {
								// Mouse position'ı editor'e gönder
								editorManager.editorWindow.webContents.send(
									IPC_EVENTS.MOUSE_POSITION_UPDATED,
									mousePositions
								);
							}, 3000);
						}
					} catch (error) {
						console.error("Editor açılırken hata:", error);

						// Hata durumunda ana pencereyi göster ve kullanıcıyı bilgilendir
						if (mainWindow) {
							mainWindow.show();
							mainWindow.webContents.send(
								IPC_EVENTS.EDITOR_LOAD_ERROR,
								error.message
							);
						}

						// State'i sıfırla
						mediaStateManager.resetState();
					}
				} else {
					console.error(
						"Medya dosyaları hazırlanamadı veya editor yüklenemedi"
					);
					if (mainWindow) {
						mainWindow.show();
						mainWindow.webContents.send(
							IPC_EVENTS.RECORDING_ERROR,
							"Kayıt işlemi tamamlanamadı"
						);
					}
				}
			}

			if (trayManager) {
				trayManager.setRecordingStatus(status);
			}
		} catch (error) {
			console.error("Kayıt işlemi sırasında hata:", error);
			if (mainWindow) {
				mainWindow.show();
				mainWindow.webContents.send(IPC_EVENTS.RECORDING_ERROR, error.message);
			}
		}
	});

	// Editor events
	ipcMain.on(IPC_EVENTS.EDITOR_CLOSED, () => {
		mediaStateManager.resetState();
	});

	ipcMain.on(IPC_EVENTS.CLOSE_EDITOR_WINDOW, () => {
		if (editorManager) {
			editorManager.closeEditorWindow();
		}
	});

	// Media state
	ipcMain.handle(IPC_EVENTS.GET_MEDIA_STATE, () => {
		return mediaStateManager.getState();
	});

	// Area selection
	ipcMain.on(IPC_EVENTS.START_AREA_SELECTION, () => {
		if (selectionManager) {
			selectionManager.startAreaSelection();
		}
	});

	ipcMain.on(IPC_EVENTS.AREA_SELECTED, (event, area) => {
		if (selectionManager) {
			selectionManager.handleAreaSelected(area);
		}
	});

	ipcMain.on(IPC_EVENTS.UPDATE_SELECTED_AREA, (event, area) => {
		if (selectionManager) {
			selectionManager.updateSelectedArea(area);
		}
	});

	ipcMain.handle(IPC_EVENTS.GET_CROP_INFO, async () => {
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

	// Window management
	ipcMain.on(IPC_EVENTS.WINDOW_CLOSE, () => {
		if (mainWindow) {
			mainWindow.close();
			cameraManager.cleanup();
			app.quit();
		}
	});

	// Window dragging
	ipcMain.on(IPC_EVENTS.START_WINDOW_DRAG, (event, mousePos) => {
		isDragging = true;
		const winPos = BrowserWindow.fromWebContents(event.sender).getPosition();
		dragOffset = {
			x: mousePos.x - winPos[0],
			y: mousePos.y - winPos[1],
		};
	});

	ipcMain.on(IPC_EVENTS.WINDOW_DRAGGING, (event, mousePos) => {
		if (!isDragging) return;
		const win = BrowserWindow.fromWebContents(event.sender);
		win.setPosition(mousePos.x - dragOffset.x, mousePos.y - dragOffset.y);
	});

	ipcMain.on(IPC_EVENTS.END_WINDOW_DRAG, () => {
		isDragging = false;
	});

	// File operations
	ipcMain.handle(IPC_EVENTS.SAVE_TEMP_VIDEO, async (event, data, type) => {
		return await tempFileManager.saveTempVideo(data, type);
	});

	ipcMain.handle(IPC_EVENTS.READ_VIDEO_FILE, async (event, filePath) => {
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

	ipcMain.handle(IPC_EVENTS.GET_MEDIA_PATHS, () => {
		return {
			videoPath:
				tempFileManager.getFilePath("screen") ||
				tempFileManager.getFilePath("video"),
			audioPath: tempFileManager.getFilePath("audio"),
		};
	});

	ipcMain.handle(IPC_EVENTS.SHOW_SAVE_DIALOG, async (event, options) => {
		const { dialog } = require("electron");
		const result = await dialog.showSaveDialog(mainWindow, options);
		return result.filePath;
	});

	// Desktop capturer
	ipcMain.handle(
		IPC_EVENTS.DESKTOP_CAPTURER_GET_SOURCES,
		async (event, opts) => {
			try {
				return await desktopCapturer.getSources(opts);
			} catch (error) {
				console.error("Ekran kaynakları alınırken hata:", error);
				throw error;
			}
		}
	);

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

	ipcMain.handle(IPC_EVENTS.GET_AUDIO_SETTINGS, () => {
		if (mediaStateManager) {
			return mediaStateManager.state.audioSettings;
		}
		return null;
	});

	// Video kaydetme işlemi
	ipcMain.handle(
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
}

async function createWindow() {
	if (isDev) {
		try {
			await waitOn({
				resources: ["http://127.0.0.1:3000"],
				timeout: 5000,
			});
		} catch (err) {
			console.error("Nuxt sunucusu başlatılamadı:", err);
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
			nodeIntegration: true,
			contextIsolation: true,
			preload: path.join(__dirname, "preload.cjs"),
			webSecurity: false,
			allowRunningInsecureContent: true,
			webviewTag: true,
			additionalArguments: ["--disable-site-isolation-trials"],
		},
	});

	setupSecurityPolicies();
	initializeManagers();
	setupWindowEvents();
	loadApplication();
}

function setupSecurityPolicies() {
	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		callback({
			responseHeaders: {
				...details.responseHeaders,
				"Content-Security-Policy": [
					"default-src 'self' 'unsafe-inline' 'unsafe-eval' file: data: blob:; media-src 'self' file: blob: data:;",
				],
			},
		});
	});

	protocol.registerFileProtocol("file", (request, callback) => {
		const pathname = decodeURIComponent(request.url.replace("file:///", ""));
		callback(pathname);
	});
}

function initializeManagers() {
	trayManager = new TrayManager(mainWindow);
	cameraManager = new CameraManager(mainWindow);
	selectionManager = new SelectionManager(mainWindow);
	editorManager = new EditorManager(mainWindow);
	tempFileManager = new TempFileManager();
	mediaStateManager = new MediaStateManager(mainWindow);

	trayManager.createTray();
	cameraManager.createCameraWindow();
}

function setupWindowEvents() {
	mainWindow.on("closed", () => {
		if (cameraManager) {
			cameraManager.cleanup();
		}
		mainWindow = null;
	});

	mainWindow.on("close", (event) => {
		if (!app.isQuitting) {
			event.preventDefault();
			mainWindow.hide();
		}
		return false;
	});
}

function loadApplication() {
	if (isDev) {
		mainWindow.loadURL("http://127.0.0.1:3000");
		mainWindow.webContents.openDevTools({ mode: "detach" });
	} else {
		mainWindow.loadFile(path.join(__dirname, "../.output/public/index.html"));
	}
}

// App lifecycle events
app.whenReady().then(() => {
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
	app.isQuitting = true;
	stopMouseTracking();
	if (mediaStateManager) mediaStateManager.cleanup();
	if (tempFileManager) tempFileManager.cleanupAllFiles();
	if (cameraManager) cameraManager.cleanup();
	if (selectionManager) selectionManager.cleanup();
});

function startMouseTracking() {
	console.log(44444);
	let time = 0;
	if (!mouseTrackingInterval) {
		mouseTrackingInterval = setInterval(() => {
			const mousePos = screen.getCursorScreenPoint();
			time = time + 1;
			console.log("xxxxxx", mousePos, time);
			mousePositions.push({
				x: mousePos.x,
				y: mousePos.y,
				timestamp: time,
			});
		}, 16); // ~60fps
	}
}

function stopMouseTracking() {
	if (mouseTrackingInterval) {
		clearInterval(mouseTrackingInterval);
		mouseTrackingInterval = null;
	}
}
