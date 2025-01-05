const {
	app,
	BrowserWindow,
	session,
	desktopCapturer,
	ipcMain,
	Menu,
	nativeImage,
	protocol,
} = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const isDev = process.env.NODE_ENV === "development";
const waitOn = require("wait-on");
const ffmpeg = require("fluent-ffmpeg");

const TrayManager = require("./trayManager.cjs");
const CameraManager = require("./cameraManager.cjs");
const EditorManager = require("./editorManager.cjs");

let trayManager = null;
let cameraManager = null;
let mainWindow = null;
let selectionWindow = null;
let tempVideoPath = null;
// Geçici dosyaları saklamak için bir Map
const tempFiles = new Map();

// Medya dosyalarının yollarını saklamak için state
let mediaState = {
	videoPath: null,
	audioPath: null,
	systemAudioPath: null,
	lastRecordingTime: null,
	isEditing: false,
};

// Pencere sürükleme için değişkenler
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

// Editor Manager instance'ı
let editorManager = null;

// State'i renderer process'e gönderen fonksiyon
function sendMediaStateToRenderer(window) {
	if (window && !window.isDestroyed()) {
		window.webContents.send("MEDIA_STATE_UPDATE", mediaState);
	}
}

// IPC handler for recording status
ipcMain.on("RECORDING_STATUS_CHANGED", async (event, status) => {
	console.log("Kayıt durumu değişti:", status);

	if (status) {
		if (mainWindow) mainWindow.hide();
	} else {
		// Kayıt bittiğinde mediaState'i güncelle
		mediaState = {
			...mediaState,
			videoPath: tempFiles.get("screen") || tempFiles.get("video") || null,
			audioPath: tempFiles.get("audio") || null,
			lastRecordingTime: new Date().toISOString(),
			isEditing: true,
		};

		console.log("MediaState güncellendi:", mediaState);

		// Kayıt bittiğinde editor'ü göster ve kamerayı gizle
		if (cameraManager) cameraManager.closeCameraWindow();
		if (editorManager) {
			await editorManager.showEditorWindow();
			// State'i hemen gönder
			if (editorManager.editorWindow) {
				sendMediaStateToRenderer(editorManager.editorWindow);
			}
		}
	}

	// Tray ikonunu güncelle
	if (trayManager) {
		trayManager.setRecordingStatus(status);
	}
});

// Editor penceresi kapandığında state'i temizle
ipcMain.on("EDITOR_CLOSED", () => {
	mediaState = {
		videoPath: null,
		audioPath: null,
		systemAudioPath: null,
		lastRecordingTime: null,
		isEditing: false,
	};
});

// State'i isteyen renderer process'lere gönder
ipcMain.handle("GET_MEDIA_STATE", () => {
	return mediaState;
});

// Kamera değişikliği için IPC handler
ipcMain.on("CAMERA_DEVICE_CHANGED", (event, deviceLabel) => {
	console.log("[main.cjs] Kamera cihazı değişti, label:", deviceLabel);
	if (deviceLabel && cameraManager) {
		cameraManager.updateCameraDevice(deviceLabel);
		console.log("[main.cjs] CameraManager'a değişiklik iletildi");
	} else {
		console.log("[main.cjs] Kamera değişikliği iletilemedi:", {
			hasLabel: !!deviceLabel,
			hasCameraManager: !!cameraManager,
		});
	}
});

// Video kaydetme ve kırpma için IPC handler
ipcMain.handle(
	"SAVE_VIDEO_FILE",
	async (event, arrayBuffer, filePath, cropInfo) => {
		try {
			console.log("[main.cjs] Video kaydetme başlıyor:", {
				filePath,
				hasCropInfo: !!cropInfo,
				cropDetails: cropInfo,
			});

			// Önce geçici bir dosyaya kaydet
			const tempDir = path.join(app.getPath("temp"), "sleer-temp");
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}

			const tempInputPath = path.join(tempDir, `temp-input-${Date.now()}.webm`);
			const tempOutputPath = path.join(
				tempDir,
				`temp-output-${Date.now()}.mp4`
			);

			// ArrayBuffer'ı geçici dosyaya kaydet
			const buffer = Buffer.from(arrayBuffer);
			await fs.promises.writeFile(tempInputPath, buffer);

			console.log("[main.cjs] Geçici dosya oluşturuldu:", tempInputPath);

			// FFmpeg ile videoyu kırp ve kaydet
			await new Promise((resolve, reject) => {
				let command = ffmpeg(tempInputPath);

				// Kırpma parametreleri varsa uygula
				if (
					cropInfo &&
					typeof cropInfo.width === "number" &&
					typeof cropInfo.height === "number"
				) {
					console.log("[main.cjs] Kırpma filtresi uygulanıyor:", cropInfo);

					const cropFilter = {
						filter: "crop",
						options: {
							w: Math.round(cropInfo.width),
							h: Math.round(cropInfo.height),
							x: Math.round(cropInfo.x || 0),
							y: Math.round(cropInfo.y || 0),
						},
					};

					command = command.videoFilters([cropFilter]);
				}

				command
					.outputOptions([
						"-c:v libx264", // Video codec
						"-preset veryfast", // Encoding hızı
						"-crf 23", // Kalite seviyesi
						"-movflags +faststart", // Hızlı başlatma
					])
					.toFormat("mp4")
					.on("start", (cmdLine) => {
						console.log("[main.cjs] FFmpeg komutu başlatıldı:", cmdLine);
					})
					.on("progress", (progress) => {
						console.log("[main.cjs] İşlem durumu:", progress);
					})
					.on("end", () => {
						console.log("[main.cjs] Video dönüştürme tamamlandı");
						resolve();
					})
					.on("error", (err) => {
						console.error("[main.cjs] FFmpeg hatası:", err);
						reject(err);
					})
					.save(tempOutputPath);
			});

			// Dönüştürülen videoyu hedef konuma taşı
			await fs.promises.copyFile(tempOutputPath, filePath);
			console.log("[main.cjs] Video başarıyla kaydedildi:", filePath);

			// Geçici dosyaları temizle
			try {
				fs.unlinkSync(tempInputPath);
				fs.unlinkSync(tempOutputPath);
				console.log("[main.cjs] Geçici dosyalar temizlendi");
			} catch (err) {
				console.error("[main.cjs] Geçici dosyalar silinirken hata:", err);
			}

			return true;
		} catch (error) {
			console.error("[main.cjs] Video dosyası kaydedilirken hata:", error);
			throw error;
		}
	}
);

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

	// Ana kontrol penceresi
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

	// Güvenlik politikalarını ayarla
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

	// Protokol güvenliği için özel protokol kaydı
	protocol.registerFileProtocol("file", (request, callback) => {
		const pathname = decodeURIComponent(request.url.replace("file:///", ""));
		callback(pathname);
	});

	trayManager = new TrayManager(mainWindow);
	cameraManager = new CameraManager(mainWindow);

	trayManager.createTray();
	cameraManager.createCameraWindow();

	if (isDev) {
		mainWindow.loadURL("http://127.0.0.1:3000");
		mainWindow.webContents.openDevTools({ mode: "detach" });
	} else {
		mainWindow.loadFile(path.join(__dirname, "../.output/public/index.html"));
	}

	mainWindow.on("closed", () => {
		if (cameraManager) {
			cameraManager.cleanup();
		}
		mainWindow = null;
	});

	// Pencere kapatıldığında sadece gizle
	mainWindow.on("close", (event) => {
		if (!app.isQuitting) {
			event.preventDefault();
			mainWindow.hide();
		}
		return false;
	});

	// Editor Manager'ı başlat
	editorManager = new EditorManager(mainWindow);
}

// Uygulama yaşam döngüsü olayları
app.whenReady().then(createWindow);

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

// Uygulama kapatılmadan önce temizlik yap
app.on("before-quit", () => {
	cleanupTempFiles();
	app.isQuitting = true;
	if (cameraManager) {
		cameraManager.cleanup();
	}
});

// IPC handlers for desktop capturer
ipcMain.handle("DESKTOP_CAPTURER_GET_SOURCES", async (event, opts) => {
	try {
		console.log("Ekran kaynakları alınıyor:", opts);
		const sources = await desktopCapturer.getSources(opts);
		console.log("Bulunan kaynaklar:", sources.length);
		return sources;
	} catch (error) {
		console.error("Ekran kaynakları alınırken hata:", error);
		throw error;
	}
});

// IPC handlers for window management
ipcMain.on("WINDOW_CLOSE", () => {
	if (mainWindow) {
		mainWindow.close();
		cameraManager.cleanup();
	}
});

// IPC handlers for area selection
ipcMain.on("START_AREA_SELECTION", () => {
	const { screen } = require("electron");
	const displays = screen.getAllDisplays();
	const primaryDisplay = screen.getPrimaryDisplay();

	let totalWidth = 0;
	let totalHeight = 0;
	let minX = 0;
	let minY = 0;

	displays.forEach((display) => {
		const { bounds } = display;
		minX = Math.min(minX, bounds.x);
		minY = Math.min(minY, bounds.y);
		totalWidth = Math.max(totalWidth, bounds.x + bounds.width);
		totalHeight = Math.max(totalHeight, bounds.y + bounds.height);
	});

	if (selectionWindow) {
		selectionWindow.close();
		selectionWindow = null;
	}

	selectionWindow = new BrowserWindow({
		width: totalWidth - minX,
		height: totalHeight - minY,
		x: minX,
		y: minY,
		transparent: true,
		frame: false,
		fullscreen: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		resizable: false,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, "preload.cjs"),
		},
	});

	selectionWindow.setVisibleOnAllWorkspaces(true);
	selectionWindow.setAlwaysOnTop(true, "screen-saver");

	if (isDev) {
		selectionWindow.loadURL("http://127.0.0.1:3000/selection");
	} else {
		selectionWindow.loadFile(
			path.join(__dirname, "../.output/public/selection/index.html")
		);
	}
});

// IPC handlers for area selection completion
ipcMain.on("AREA_SELECTED", (event, area) => {
	console.log("Seçilen alan:", {
		...area,
		aspectRatio: area.aspectRatio || "free",
	});

	// Seçilen alanı global değişkende sakla
	global.selectedArea = {
		...area,
		x: Math.round(area.x),
		y: Math.round(area.y),
		width: Math.round(area.width),
		height: Math.round(area.height),
		aspectRatio: area.aspectRatio || "free",
		display: area.display,
		devicePixelRatio: area.devicePixelRatio || 1,
	};

	if (mainWindow) {
		mainWindow.webContents.send("AREA_SELECTED", global.selectedArea);
	}
});

// Yeni kayıt için temizlik
ipcMain.on("RESET_FOR_NEW_RECORDING", () => {
	// Seçilen alanı sıfırla
	global.selectedArea = null;

	// Editor'ü gizle
	if (editorManager) {
		editorManager.hideEditorWindow();
	}

	// Ana pencere ve kamerayı göster
	if (mainWindow) mainWindow.show();
	if (cameraManager) cameraManager.showCameraWindow();

	// Geçici dosyaları temizle
	cleanupTempFiles();
});

// Geçici dosyaları temizle
const cleanupTempFiles = () => {
	console.log("Geçici dosyalar temizleniyor...");
	console.log("Mevcut geçici dosyalar:", Array.from(tempFiles.entries()));

	for (const [type, filePath] of tempFiles.entries()) {
		if (fs.existsSync(filePath)) {
			try {
				fs.unlinkSync(filePath);
				console.log(`${type} için geçici dosya silindi:`, filePath);
			} catch (err) {
				console.error(`${type} için geçici dosya silinirken hata:`, err);
			}
		}
	}
	tempFiles.clear();
	console.log("Geçici dosya temizliği tamamlandı");
};

// Geçici video dosyası işlemleri
ipcMain.handle("SAVE_TEMP_VIDEO", async (event, data, type) => {
	try {
		// Kullanıcının Downloads klasörü altında uygulama klasörü
		const downloadsPath = app.getPath("downloads");
		const appDir = path.join(downloadsPath, ".sleer");

		if (!fs.existsSync(appDir)) {
			fs.mkdirSync(appDir, { recursive: true });
		}

		// Eski dosyayı temizle
		const oldPath = tempFiles.get(type);
		if (oldPath && fs.existsSync(oldPath)) {
			fs.unlinkSync(oldPath);
		}

		// Yeni geçici dosya yolu
		const tempPath = path.join(appDir, `temp-${type}-${Date.now()}.webm`);

		// Base64 verisini dosyaya kaydet
		const base64Data = data.replace(/^data:(audio|video)\/\w+;base64,/, "");
		fs.writeFileSync(tempPath, base64Data, "base64");

		// Dosya varlığını ve boyutunu kontrol et
		if (!fs.existsSync(tempPath)) {
			throw new Error(`Geçici dosya oluşturulamadı: ${tempPath}`);
		}

		const stats = fs.statSync(tempPath);
		if (stats.size === 0) {
			fs.unlinkSync(tempPath); // Boş dosyayı sil
			throw new Error(`Geçici dosya boş: ${tempPath}`);
		}

		// Map'e kaydet
		tempFiles.set(type, tempPath);

		// MediaState'i güncelle
		if (type === "video" || type === "screen") {
			mediaState.videoPath = tempPath;
		} else if (type === "audio") {
			mediaState.audioPath = tempPath;
		}

		console.log(`${type} için geçici dosya kaydedildi:`, {
			path: tempPath,
			size: stats.size,
			type: type,
			mediaState: mediaState, // State'i logla
		});

		return tempPath;
	} catch (error) {
		console.error("Geçici dosya kaydedilirken hata:", error);
		throw error;
	}
});

ipcMain.handle("GET_TEMP_VIDEO_PATH", () => {
	return tempVideoPath;
});

// IPC handlers for window management
ipcMain.handle("GET_WINDOW_POSITION", () => {
	if (mainWindow) {
		return mainWindow.getPosition();
	}
	return [0, 0];
});

// IPC handlers for file operations
ipcMain.handle("SHOW_SAVE_DIALOG", async (event, options) => {
	const { dialog } = require("electron");
	const result = await dialog.showSaveDialog(mainWindow, options);
	return result.filePath;
});

// Video dosyası okuma işlemi için IPC handler
ipcMain.handle("READ_VIDEO_FILE", async (event, filePath) => {
	try {
		// Dosyanın varlığını kontrol et
		if (!fs.existsSync(filePath)) {
			console.error("Dosya bulunamadı:", filePath);
			return null;
		}

		// Dosya boyutunu kontrol et
		const stats = fs.statSync(filePath);
		if (stats.size === 0) {
			console.error("Dosya boş:", filePath);
			return null;
		}

		console.log("Video dosyası okunuyor:", {
			path: filePath,
			size: stats.size,
		});

		// Dosyayı oku ve base64'e çevir
		const buffer = await fs.promises.readFile(filePath);
		return buffer.toString("base64");
	} catch (error) {
		console.error("Video dosyası okunurken hata:", error);
		return null;
	}
});

// Pencere sürükleme için IPC handlers
ipcMain.on("START_WINDOW_DRAG", (event, mousePos) => {
	isDragging = true;
	const winPos = BrowserWindow.fromWebContents(event.sender).getPosition();
	dragOffset = {
		x: mousePos.x - winPos[0],
		y: mousePos.y - winPos[1],
	};
});

ipcMain.on("WINDOW_DRAGGING", (event, mousePos) => {
	if (!isDragging) return;
	const win = BrowserWindow.fromWebContents(event.sender);
	win.setPosition(mousePos.x - dragOffset.x, mousePos.y - dragOffset.y);
});

ipcMain.on("END_WINDOW_DRAG", () => {
	isDragging = false;
});

ipcMain.on("CLOSE_EDITOR_WINDOW", () => {
	if (editorManager) {
		editorManager.closeEditorWindow();
	}
});

// Ekran kaydı başlat
ipcMain.on("START_RECORDING", async () => {
	try {
		const sources = await desktopCapturer.getSources({
			types: ["screen", "window"],
			thumbnailSize: { width: 0, height: 0 },
			fetchWindowIcons: true,
		});

		// Kayıt dizinini oluştur
		const recordingDir = path.join(
			app.getPath("temp"),
			"screen-studio-recordings"
		);
		if (!fs.existsSync(recordingDir)) {
			fs.mkdirSync(recordingDir, { recursive: true });
		}

		const timestamp = new Date().getTime();
		const videoPath = path.join(recordingDir, `video_${timestamp}.webm`);
		const audioPath = path.join(recordingDir, `audio_${timestamp}.webm`);
		const systemAudioPath = path.join(
			recordingDir,
			`system_audio_${timestamp}.webm`
		);

		// Ekran kaydı için MediaRecorder ayarları
		const videoConstraints = {
			audio: false,
			video: {
				mandatory: {
					chromeMediaSource: "desktop",
					chromeMediaSourceId: sources[0].id,
				},
			},
		};

		// Mikrofon kaydı için MediaRecorder ayarları
		const audioConstraints = {
			audio: {
				mandatory: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			},
			video: false,
		};

		// Sistem sesi kaydı için MediaRecorder ayarları
		const systemAudioConstraints = {
			audio: {
				mandatory: {
					chromeMediaSource: "desktop",
				},
			},
			video: false,
		};

		// Kayıt işlemini başlat
		mainWindow.webContents.send("START_RECORDING", {
			videoConstraints,
			audioConstraints,
			systemAudioConstraints,
			videoPath,
			audioPath,
			systemAudioPath,
		});

		currentRecording = {
			videoPath,
			audioPath,
			systemAudioPath,
			timestamp,
		};
	} catch (error) {
		console.error("Kayıt başlatma hatası:", error);
		mainWindow.webContents.send("RECORDING_ERROR", error.message);
	}
});

// Kırpma bilgisi için IPC handler
ipcMain.handle("GET_CROP_INFO", async (event) => {
	try {
		// Seçilen alan bilgisini kontrol et
		const selectedArea = global.selectedArea;
		console.log(
			"[main.cjs] GET_CROP_INFO çağrıldı, mevcut selectedArea:",
			selectedArea
		);

		if (
			selectedArea &&
			typeof selectedArea.width === "number" &&
			typeof selectedArea.height === "number"
		) {
			// Seçilen alan varsa, basitleştirilmiş formatı döndür
			const cropInfo = {
				x: Math.round(selectedArea.x || 0),
				y: Math.round(selectedArea.y || 0),
				width: Math.round(selectedArea.width),
				height: Math.round(selectedArea.height),
				scale: 1,
			};
			console.log("[main.cjs] Kırpma bilgisi döndürülüyor:", cropInfo);
			return cropInfo;
		}

		console.log("[main.cjs] Kırpma bilgisi bulunamadı, null döndürülüyor");
		return null;
	} catch (error) {
		console.error("[main.cjs] Kırpma bilgisi alınırken hata:", error);
		return null;
	}
});

// Seçilen alan güncellemesi için IPC handler
ipcMain.on("UPDATE_SELECTED_AREA", (event, area) => {
	console.log("[main.cjs] Seçilen alan güncelleniyor:", area);
	global.selectedArea = area;
});
