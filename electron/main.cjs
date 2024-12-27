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
let lastCameraPosition = { x: 0, y: 0 };

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
	const { screen } = require("electron");
	const displays = screen.getAllDisplays();
	const primaryDisplay = screen.getPrimaryDisplay();

	// Tüm ekranları kapsayacak bir pencere oluştur
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

	// Eğer varolan bir seçim penceresi varsa kapat
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

	// Tüm ekranlarda görünür olsun
	selectionWindow.setVisibleOnAllWorkspaces(true);
	selectionWindow.setAlwaysOnTop(true, "screen-saver");

	if (isDev) {
		selectionWindow.loadURL("http://127.0.0.1:3000/selection");
	} else {
		selectionWindow.loadFile(
			path.join(__dirname, "../.output/public/selection/index.html")
		);
	}

	// Alan seçimi tamamlandığında
	ipcMain.once("AREA_SELECTED", (event, area) => {
		// Seçilen alanı ana pencereye gönder
		if (mainWindow) {
			mainWindow.webContents.send("AREA_SELECTED", {
				...area,
				x: Math.round(area.x),
				y: Math.round(area.y),
				width: Math.round(area.width),
				height: Math.round(area.height),
			});
		}
		// Seçim penceresini kapat
		if (selectionWindow) {
			selectionWindow.close();
		}
	});

	// ESC tuşuna basıldığında veya iptal edildiğinde
	ipcMain.once("CANCEL_AREA_SELECTION", () => {
		if (selectionWindow) {
			selectionWindow.close();
		}
	});

	// Pencere kapandığında event listener'ları temizle
	selectionWindow.on("closed", () => {
		selectionWindow = null;
		ipcMain.removeAllListeners("AREA_SELECTED");
		ipcMain.removeAllListeners("CANCEL_AREA_SELECTION");
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
		width: 1000,
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
	ipcMain.on("START_WINDOW_DRAG", (event, mousePosition) => {
		isDragging = true;
		const winPosition = mainWindow.getPosition();
		dragOffset = {
			x: mousePosition.x - winPosition[0],
			y: mousePosition.y - winPosition[1],
		};
	});

	ipcMain.on("WINDOW_DRAGGING", (event, mousePosition) => {
		if (isDragging && mainWindow) {
			mainWindow.setPosition(
				Math.round(mousePosition.x - dragOffset.x),
				Math.round(mousePosition.y - dragOffset.y)
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

// Kamera pozisyonunu almak için yeni handler
ipcMain.handle("GET_CAMERA_POSITION", () => {
	return lastCameraPosition;
});

// Editör penceresi yükseklik ayarı için IPC handler
ipcMain.on("RESIZE_EDITOR_WINDOW", () => {
	if (mainWindow) {
		const [width, height] = mainWindow.getSize();
		mainWindow.setSize(width, 600); // Yüksekliği 600px yap
	}
});

// Yeni kayıt için pencereyi sıfırla
ipcMain.on("RESET_FOR_NEW_RECORDING", () => {
	if (mainWindow) {
		mainWindow.setSize(800, 200); // Orijinal boyuta döndür

		// Kamera penceresini sağ alt köşeye yerleştir
		const { screen } = require("electron");
		const primaryDisplay = screen.getPrimaryDisplay();
		const { width, height } = primaryDisplay.workAreaSize;
		if (cameraWindow) {
			cameraWindow.setPosition(width - 340, height - 340);
		}
	}
});
