import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";

interface AreaData {
	x: number;
	y: number;
	width: number;
	height: number;
	display: {
		width: number;
		height: number;
	};
	devicePixelRatio: number;
}

interface MergeProgress {
	percent: number;
	frames: number;
	fps: number;
	time: string;
}

interface MousePosition {
	x: number;
	y: number;
}

let mainWindow: BrowserWindow | null = null;
let cameraWindow: BrowserWindow | null = null;

const createWindow = () => {
	mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			contextIsolation: false,
			nodeIntegration: true,
		},
	});

	mainWindow.loadURL("http://localhost:3000");

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
};

const createCameraWindow = () => {
	cameraWindow = new BrowserWindow({
		width: 320,
		height: 320,
		frame: false,
		transparent: true,
		resizable: false,
		alwaysOnTop: true,
		webPreferences: {
			contextIsolation: false,
			nodeIntegration: true,
		},
	});

	cameraWindow.loadURL("http://localhost:3000/camera");

	cameraWindow.on("closed", () => {
		cameraWindow = null;
	});
};

// Pencere yönetimi
ipcMain.on("WINDOW_CLOSE", (event) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	if (win) {
		win.close();
	}
});

ipcMain.on("START_WINDOW_DRAG", (event, mousePos: MousePosition) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	if (win) {
		const bounds = win.getBounds();
		const offset = {
			x: mousePos.x - bounds.x,
			y: mousePos.y - bounds.y,
		};

		const moveWindow = (_: Electron.IpcMainEvent, pos: MousePosition) => {
			win.setBounds({
				x: pos.x - offset.x,
				y: pos.y - offset.y,
				width: bounds.width,
				height: bounds.height,
			});
		};

		ipcMain.on("WINDOW_DRAGGING", moveWindow);
		ipcMain.once("END_WINDOW_DRAG", () => {
			ipcMain.removeListener("WINDOW_DRAGGING", moveWindow);
		});
	}
});

// Kamera penceresi yönetimi
ipcMain.on("OPEN_CAMERA_WINDOW", () => {
	if (!cameraWindow) {
		createCameraWindow();
	}
});

ipcMain.on("CLOSE_CAMERA_WINDOW", () => {
	if (cameraWindow && !cameraWindow.isDestroyed()) {
		cameraWindow.close();
	}
});

// Kamera cihazı değişikliği
ipcMain.on("SELECT_VIDEO_DEVICE", (_, deviceId) => {
	if (cameraWindow && !cameraWindow.isDestroyed()) {
		cameraWindow.webContents.send("SELECT_VIDEO_DEVICE", deviceId);
	}
});

// Alan seçimi
ipcMain.on("START_AREA_SELECTION", () => {
	const selectionWindow = new BrowserWindow({
		width: 800,
		height: 600,
		frame: false,
		transparent: true,
		resizable: false,
		webPreferences: {
			contextIsolation: false,
			nodeIntegration: true,
		},
	});

	selectionWindow.loadURL("http://localhost:3000/selection");
});

ipcMain.on("AREA_SELECTED", (_, area) => {
	if (mainWindow && !mainWindow.isDestroyed()) {
		mainWindow.webContents.send("AREA_SELECTED", area);
	}
});

ipcMain.on("CLOSE_SELECTION_WINDOW", (event) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	if (win) {
		win.close();
	}
});

// Kayıt kontrolleri
ipcMain.on("START_RECORDING_FROM_TRAY", () => {
	if (mainWindow && !mainWindow.isDestroyed()) {
		mainWindow.webContents.send("START_RECORDING_FROM_TRAY");
	}
});

ipcMain.on("STOP_RECORDING_FROM_TRAY", () => {
	if (mainWindow && !mainWindow.isDestroyed()) {
		mainWindow.webContents.send("STOP_RECORDING_FROM_TRAY");
	}
});

// Birleştirme durumu
ipcMain.on("MERGE_PROGRESS", (_, progress) => {
	if (mainWindow && !mainWindow.isDestroyed()) {
		mainWindow.webContents.send("MERGE_PROGRESS", progress);
	}
});

// Uygulama başlatma
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
