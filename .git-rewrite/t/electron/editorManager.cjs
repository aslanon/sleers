const { BrowserWindow, screen } = require("electron");
const path = require("path");
const isDev = process.env.NODE_ENV === "development";

class EditorManager {
	constructor(mainWindow) {
		this.mainWindow = mainWindow;
		this.editorWindow = null;
	}

	createEditorWindow() {
		if (this.editorWindow && !this.editorWindow.isDestroyed()) {
			if (this.mainWindow && !this.mainWindow.isDestroyed()) {
				this.mainWindow.hide();
			}
			this.editorWindow.show();
			return;
		}

		console.log("[editorManager.cjs] Editor penceresi oluşturuluyor...");
		const { width, height } = screen.getPrimaryDisplay().workAreaSize;

		const windowWidth = Math.round(width * 0.8);
		const windowHeight = Math.round(height * 0.8);

		this.editorWindow = new BrowserWindow({
			width: windowWidth,
			height: windowHeight,
			minWidth: 1024,
			minHeight: 768,
			show: false,
			frame: true,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: true,
				backgroundThrottling: false,
				preload: path.join(__dirname, "preload.cjs"),
			},
			backgroundColor: "#1a1a1a",
			titleBarOverlay: false,
			titleBarStyle: "hidden",
			trafficLightPosition: { x: 15, y: 15 },
			hasShadow: true,
			roundedCorners: true,
			visualEffectState: "active",
			movable: true,
		});

		this.editorWindow.center();

		if (isDev) {
			console.log(
				"[editorManager.cjs] Development modunda editor penceresi yükleniyor..."
			);
			this.editorWindow.loadURL("http://127.0.0.1:3000/editor");
			this.editorWindow.webContents.openDevTools({ mode: "detach" });
		} else {
			console.log(
				"[editorManager.cjs] Production modunda editor penceresi yükleniyor..."
			);
			this.editorWindow.loadFile(
				path.join(__dirname, "../.output/public/editor/index.html")
			);
		}

		this.editorWindow.webContents.once("did-finish-load", () => {
			if (this.mainWindow && !this.mainWindow.isDestroyed()) {
				this.mainWindow.hide();
			}
			this.editorWindow.show();
		});

		this.editorWindow.on("closed", () => {
			console.log("[editorManager.cjs] Editor penceresi kapatıldı");
			this.editorWindow = null;
		});

		this.editorWindow.webContents.on(
			"did-fail-load",
			(event, errorCode, errorDescription) => {
				console.error(
					"[editorManager.cjs] Editor penceresi yüklenemedi:",
					errorCode,
					errorDescription
				);
			}
		);
	}

	showEditorWindow() {
		if (!this.editorWindow || this.editorWindow.isDestroyed()) {
			this.createEditorWindow();
		} else {
			this.editorWindow.show();
		}
	}

	hideEditorWindow() {
		if (this.editorWindow && !this.editorWindow.isDestroyed()) {
			this.editorWindow.hide();
			if (this.mainWindow && !this.mainWindow.isDestroyed()) {
				if (isDev) {
					this.mainWindow.loadURL("http://127.0.0.1:3000");
				} else {
					this.mainWindow.loadFile(
						path.join(__dirname, "../.output/public/index.html")
					);
				}
				this.mainWindow.once("ready-to-show", () => {
					this.mainWindow.show();
				});
			}
		}
	}

	closeEditorWindow() {
		if (this.editorWindow && !this.editorWindow.isDestroyed()) {
			this.editorWindow.destroy();
			this.editorWindow = null;
		}
	}

	handleEditorStatusUpdate(statusData) {
		console.log("[editorManager.cjs] Editor durumu güncelleniyor:", statusData);
		if (this.mainWindow && !this.mainWindow.isDestroyed()) {
			this.mainWindow.webContents.send("EDITOR_STATUS_CHANGED", statusData);
			console.log("[editorManager.cjs] Ana pencere bilgilendirildi");
		}
	}

	startEditing(videoData) {
		if (this.editorWindow && !this.editorWindow.isDestroyed()) {
			this.editorWindow.webContents.send("START_EDITING", videoData);
			console.log("[editorManager.cjs] Düzenleme başlatıldı:", videoData);
		}
	}

	cleanup() {
		this.closeEditorWindow();
	}

	getEditorWindow() {
		return this.editorWindow;
	}
}

module.exports = EditorManager;
