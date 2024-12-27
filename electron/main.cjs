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

// IPC handler for window move
ipcMain.on("WINDOW_MOVE", (event, { deltaX, deltaY }) => {
	if (mainWindow) {
		const [x, y] = mainWindow.getPosition();
		mainWindow.setPosition(x + deltaX, y + deltaY);
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
