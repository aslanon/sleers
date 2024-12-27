const {
	app,
	BrowserWindow,
	session,
	desktopCapturer,
	ipcMain,
} = require("electron");
const path = require("path");
const isDev = process.env.NODE_ENV === "development";
const waitOn = require("wait-on");

let mainWindow = null;
let selectionWindow = null;

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

	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		callback({
			responseHeaders: {
				...details.responseHeaders,
				"Content-Security-Policy": [
					"default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*;",
					"script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* http://127.0.0.1:*;",
					"connect-src 'self' ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*;",
					"img-src 'self' data: http://localhost:* http://127.0.0.1:*;",
					"style-src 'self' 'unsafe-inline' http://localhost:* http://127.0.0.1:*;",
					"media-src 'self' mediastream: blob: *;",
				].join(" "),
			},
		});
	});

	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		frame: false,
		transparent: true,
		backgroundColor: "#1a1b26",
		hasShadow: true,
		movable: true,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, "preload.cjs"),
			webSecurity: true,
			allowRunningInsecureContent: false,
			enableRemoteModule: false,
		},
	});

	mainWindow.webContents.session.setPermissionRequestHandler(
		(webContents, permission, callback) => {
			const allowedPermissions = ["media", "display-capture", "mediaKeySystem"];
			if (allowedPermissions.includes(permission)) {
				callback(true);
			} else {
				callback(false);
			}
		}
	);

	mainWindow.webContents.session.setPermissionCheckHandler(
		(webContents, permission) => {
			const allowedPermissions = ["media", "display-capture", "mediaKeySystem"];
			return allowedPermissions.includes(permission);
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
	});

	// Pencere sürükleme için mouse olaylarını dinle
	let isDragging = false;
	let dragStartPosition = { x: 0, y: 0 };
	let windowStartPosition = { x: 0, y: 0 };

	mainWindow.on("will-move", (event) => {
		if (!isDragging) {
			event.preventDefault();
		}
	});

	ipcMain.on("START_WINDOW_DRAG", (event, mousePosition) => {
		isDragging = true;
		dragStartPosition = mousePosition;
		windowStartPosition = mainWindow.getPosition();
	});

	ipcMain.on("END_WINDOW_DRAG", () => {
		isDragging = false;
	});

	ipcMain.on("WINDOW_DRAGGING", (event, mousePosition) => {
		if (!isDragging) return;

		const deltaX = mousePosition.x - dragStartPosition.x;
		const deltaY = mousePosition.y - dragStartPosition.y;

		const newX = windowStartPosition[0] + deltaX;
		const newY = windowStartPosition[1] + deltaY;

		mainWindow.setPosition(Math.round(newX), Math.round(newY), true);
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
