const {
	app,
	BrowserWindow,
	session,
	desktopCapturer,
	ipcMain,
	Menu,
	nativeImage,
} = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const isDev = process.env.NODE_ENV === "development";
const waitOn = require("wait-on");
const ffmpeg = require("fluent-ffmpeg");

const TrayManager = require("./trayManager.cjs");
const CameraManager = require("./cameraManager.cjs");

let trayManager = null;
let cameraManager = null;
let mainWindow = null;
let selectionWindow = null;
let tempVideoPath = null;
// Geçici dosyaları saklamak için bir Map
const tempFiles = new Map();

// IPC handler for recording status
ipcMain.on("RECORDING_STATUS_CHANGED", (event, status) => {
	console.log("Kayıt durumu değişti:", status);
	if (cameraManager) {
		cameraManager.setRecordingStatus(status);
	}
	if (trayManager) {
		trayManager.setRecordingStatus(status);
	}

	if (status && mainWindow) {
		mainWindow.hide();
	} else if (mainWindow) {
		mainWindow.show();
	}
});

// Kamera değişikliği için IPC handler
ipcMain.on("CAMERA_DEVICE_CHANGED", (event, deviceId) => {
	console.log("Kamera cihazı değişti:", deviceId);
	if (cameraManager) {
		cameraManager.updateCameraDevice(deviceId);
	}
});

// Kamera durumu değişikliği için IPC handler
ipcMain.on("CAMERA_STATUS_UPDATE", (event, statusData) => {
	console.log("Kamera durumu güncellendi:", statusData);
	if (cameraManager) {
		cameraManager.handleCameraStatusUpdate(statusData);
	}
});

// Video kırpma işlemi için IPC handler
ipcMain.handle(
	"CROP_VIDEO",
	async (event, { inputPath, outputPath, x, y, width, height }) => {
		return new Promise((resolve, reject) => {
			// Input dosyasını kontrol et
			if (!fs.existsSync(inputPath)) {
				reject(new Error(`Input dosyası bulunamadı: ${inputPath}`));
				return;
			}

			// Input dosyasının boyutunu kontrol et
			const stats = fs.statSync(inputPath);
			if (stats.size === 0) {
				reject(new Error("Input dosyası boş"));
				return;
			}

			console.log("1. Kırpma işlemi başlatılıyor");
			console.log("Gelen kırpma parametreleri:", { x, y, width, height });
			console.log("Input dosya boyutu:", stats.size, "bytes");

			// FFmpeg işlemleri...
			// ... existing code ...
		});
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
		},
	});

	trayManager = new TrayManager(mainWindow);
	cameraManager = new CameraManager(mainWindow);

	trayManager.createTray();
	cameraManager.createCameraWindow();

	// CSP ayarlarını güncelle
	mainWindow.webContents.session.webRequest.onHeadersReceived(
		(details, callback) => {
			callback({
				responseHeaders: {
					...details.responseHeaders,
				},
			});
		}
	);

	// Protokol kısıtlamalarını kaldır
	mainWindow.webContents.session.protocol.registerFileProtocol(
		"file",
		(request, callback) => {
			const filePath = request.url.replace("file://", "");
			callback({ path: filePath });
		}
	);

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
}

// Kamera penceresi hazır olduğunda
ipcMain.on("CAMERA_WINDOW_READY", () => {
	console.log("Main process: Kamera penceresi hazır sinyali alındı");
});

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

// Uygulama kapatılmadan önce
app.on("before-quit", () => {
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
	}
});

ipcMain.handle("GET_WINDOW_POSITION", () => {
	if (mainWindow) {
		return mainWindow.getPosition();
	}
	return [0, 0];
});

ipcMain.on("SET_WINDOW_POSITION", (event, { x, y }) => {
	if (mainWindow) {
		const { screen } = require("electron");
		const displays = screen.getAllDisplays();
		const currentDisplay = screen.getDisplayNearestPoint({ x, y });

		const [width, height] = mainWindow.getSize();

		const newX = Math.max(
			currentDisplay.bounds.x,
			Math.min(x, currentDisplay.bounds.x + currentDisplay.bounds.width - width)
		);

		const newY = Math.max(
			currentDisplay.bounds.y,
			Math.min(
				y,
				currentDisplay.bounds.y + currentDisplay.bounds.height - height
			)
		);

		mainWindow.setPosition(Math.round(newX), Math.round(newY));
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

	if (mainWindow) {
		mainWindow.webContents.send("AREA_SELECTED", {
			...area,
			x: Math.round(area.x),
			y: Math.round(area.y),
			width: Math.round(area.width),
			height: Math.round(area.height),
			aspectRatio: area.aspectRatio || "free",
			display: area.display,
			devicePixelRatio: area.devicePixelRatio || 1,
		});
	}
});

ipcMain.on("CANCEL_AREA_SELECTION", () => {
	if (selectionWindow && !selectionWindow.isDestroyed()) {
		selectionWindow.close();
		selectionWindow = null;
	}
});

// IPC handlers for file operations
ipcMain.handle("SHOW_SAVE_DIALOG", async (event, options) => {
	const { dialog } = require("electron");
	const result = await dialog.showSaveDialog(mainWindow, options);
	return result.filePath;
});

ipcMain.handle("COPY_FILE", async (event, src, dest) => {
	try {
		await fs.promises.copyFile(src, dest);
		return true;
	} catch (error) {
		console.error("Dosya kopyalanırken hata:", error);
		throw error;
	}
});

ipcMain.handle("READ_VIDEO_FILE", async (event, filePath) => {
	try {
		const data = await fs.promises.readFile(filePath);
		return data.toString("base64");
	} catch (error) {
		console.error("Video dosyası okunurken hata:", error);
		throw error;
	}
});

// Yeni kayıt için pencereyi sıfırla
ipcMain.on("RESET_FOR_NEW_RECORDING", () => {
	if (mainWindow) {
		mainWindow.setResizable(false);
		mainWindow.setSize(1000, 70);
	}
	if (cameraManager) {
		cameraManager.resetForNewRecording();
	}
});
