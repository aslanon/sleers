const {
	app,
	BrowserWindow,
	session,
	desktopCapturer,
	ipcMain,
} = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const isDev = process.env.NODE_ENV === "development";
const waitOn = require("wait-on");

let mainWindow = null;
let selectionWindow = null;
let cameraWindow = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let tempVideoPath = null;

// Geçici video dosyası işlemleri
ipcMain.handle("SAVE_TEMP_VIDEO", async (event, blob) => {
	try {
		// Kullanıcının Downloads klasörü altında uygulama klasörü
		const downloadsPath = app.getPath("downloads");
		const appDir = path.join(downloadsPath, ".sleer");

		if (!fs.existsSync(appDir)) {
			fs.mkdirSync(appDir, { recursive: true });
		}

		// Eski geçici dosyayı temizle
		if (tempVideoPath && fs.existsSync(tempVideoPath)) {
			fs.unlinkSync(tempVideoPath);
		}

		// Yeni geçici dosya yolu
		tempVideoPath = path.join(appDir, `temp-${Date.now()}.webm`);

		// Base64 verisini dosyaya kaydet
		const base64Data = blob.replace(/^data:video\/\w+;base64,/, "");
		fs.writeFileSync(tempVideoPath, base64Data, "base64");

		return tempVideoPath;
	} catch (error) {
		console.error("Geçici video kaydedilirken hata:", error);
		throw error;
	}
});

ipcMain.handle("GET_TEMP_VIDEO_PATH", () => {
	return tempVideoPath;
});

ipcMain.on("CLEANUP_TEMP_VIDEO", () => {
	if (tempVideoPath && fs.existsSync(tempVideoPath)) {
		fs.unlinkSync(tempVideoPath);
		tempVideoPath = null;
	}
});

// IPC handler for desktop capturer
ipcMain.handle("DESKTOP_CAPTURER_GET_SOURCES", async (event, opts) => {
	try {
		const sources = await desktopCapturer.getSources(opts);
		return sources;
	} catch (error) {
		console.error("Error getting screen sources:", error);
		throw error;
	}
});

// IPC handler for window close
ipcMain.on("WINDOW_CLOSE", () => {
	if (mainWindow) {
		mainWindow.close();
	}
});

// IPC handler for getting window position
ipcMain.handle("GET_WINDOW_POSITION", () => {
	if (mainWindow) {
		return mainWindow.getPosition();
	}
	return [0, 0];
});

// IPC handler for setting window position
ipcMain.on("SET_WINDOW_POSITION", (event, { x, y }) => {
	if (mainWindow) {
		mainWindow.setPosition(Math.round(x), Math.round(y), true);
	}
});

// IPC handler for starting area selection
ipcMain.on("START_AREA_SELECTION", () => {
	if (selectionWindow) {
		selectionWindow.close();
	}

	const { screen } = require("electron");
	const primaryDisplay = screen.getPrimaryDisplay();
	const { width, height } = primaryDisplay.size;

	selectionWindow = new BrowserWindow({
		width: width,
		height: height,
		x: 0,
		y: 0,
		transparent: true,
		frame: false,
		fullscreen: true,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, "preload.cjs"),
		},
	});

	if (isDev) {
		selectionWindow.loadURL("http://127.0.0.1:3000/selection");
	} else {
		selectionWindow.loadFile(
			path.join(__dirname, "../.output/public/selection/index.html")
		);
	}

	selectionWindow.setAlwaysOnTop(true, "screen-saver");
	selectionWindow.setVisibleOnAllWorkspaces(true);

	selectionWindow.on("closed", () => {
		selectionWindow = null;
	});
});

// IPC handler for area selection complete
ipcMain.on("AREA_SELECTED", (event, area) => {
	if (mainWindow) {
		mainWindow.webContents.send("AREA_SELECTED", area);
	}
	if (selectionWindow) {
		selectionWindow.close();
	}
});

// Dosya kaydetme dialog'u için IPC handler
ipcMain.handle("SHOW_SAVE_DIALOG", async (event, options) => {
	const { dialog } = require("electron");
	const result = await dialog.showSaveDialog(mainWindow, options);
	return result.filePath;
});

// Dosya kopyalama için IPC handler
ipcMain.handle("COPY_FILE", async (event, src, dest) => {
	try {
		await fs.promises.copyFile(src, dest);
		return true;
	} catch (error) {
		console.error("Dosya kopyalanırken hata:", error);
		throw error;
	}
});

// Video içeriğini okumak için IPC handler
ipcMain.handle("READ_VIDEO_FILE", async (event, filePath) => {
	try {
		const data = await fs.promises.readFile(filePath);
		return data.toString("base64");
	} catch (error) {
		console.error("Video dosyası okunurken hata:", error);
		throw error;
	}
});

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
		width: 800,
		height: 200,
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

	// CSP ayarlarını güncelle
	mainWindow.webContents.session.webRequest.onHeadersReceived(
		(details, callback) => {
			callback({
				responseHeaders: {
					...details.responseHeaders,
					"Content-Security-Policy": [
						"default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: file:; media-src 'self' file: blob: data:;",
					],
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
		mainWindow.webContents.openDevTools();
	} else {
		mainWindow.loadFile(path.join(__dirname, "../.output/public/index.html"));
	}

	mainWindow.on("closed", () => {
		mainWindow = null;
		// Ana pencere kapandığında kamera penceresini de kapat
		if (cameraWindow) {
			cameraWindow.close();
		}
	});

	// Kamera penceresini oluştur
	cameraWindow = new BrowserWindow({
		width: 320,
		height: 320,
		frame: false,
		transparent: true,
		hasShadow: true,
		alwaysOnTop: true,
		resizable: false,
		skipTaskbar: true,
		closable: false,
		minimizable: false,
		maximizable: false,
		fullscreenable: false,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, "preload.cjs"),
		},
	});

	// Kamera penceresini sağ alt köşeye yerleştir
	const { screen } = require("electron");
	const primaryDisplay = screen.getPrimaryDisplay();
	const { width, height } = primaryDisplay.workAreaSize;
	cameraWindow.setPosition(width - 340, height - 340);

	// Her zaman en üstte kalmasını sağla
	cameraWindow.setAlwaysOnTop(true, "screen-saver");
	cameraWindow.setVisibleOnAllWorkspaces(true);

	if (isDev) {
		cameraWindow.loadURL("http://127.0.0.1:3000/camera");
	} else {
		cameraWindow.loadFile(
			path.join(__dirname, "../.output/public/camera/index.html")
		);
	}

	// Pencere sürükleme için IPC handlers
	ipcMain.on("CAMERA_WINDOW_DRAG", (event, { mouseX, mouseY }) => {
		if (cameraWindow) {
			const [x, y] = cameraWindow.getPosition();
			cameraWindow.setPosition(mouseX - 160, mouseY - 120);
		}
	});

	cameraWindow.on("closed", () => {
		cameraWindow = null;
		ipcMain.removeAllListeners("CAMERA_WINDOW_DRAG");
	});

	// Pencere sürükleme için mouse olaylarını dinle
	mainWindow.on("will-move", (event) => {
		if (!isDragging) {
			event.preventDefault();
		}
	});

	ipcMain.on("START_WINDOW_DRAG", (event, mousePosition) => {
		isDragging = true;
		const winPosition = mainWindow.getPosition();
		dragOffset = {
			x: mousePosition.x - winPosition[0],
			y: mousePosition.y - winPosition[1],
		};
	});

	ipcMain.on("WINDOW_DRAGGING", (event, mousePosition) => {
		if (isDragging) {
			mainWindow.setPosition(
				mousePosition.x - dragOffset.x,
				mousePosition.y - dragOffset.y
			);
		}
	});

	ipcMain.on("END_WINDOW_DRAG", () => {
		isDragging = false;
	});
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	if (mainWindow === null) {
		createWindow();
	}
});
