const { BrowserWindow } = require("electron");
const path = require("path");
const { IPC_EVENTS } = require("./constants.cjs");

class RecordingSettingsManager {
	constructor(mainWindow) {
		this.mainWindow = mainWindow;
		this.settingsWindow = null;
	}

	async createSettingsWindow() {
		if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
			this.settingsWindow.focus();
			return;
		}

		this.settingsWindow = new BrowserWindow({
			width: 800,
			height: 600,
			minWidth: 700,
			minHeight: 500,
			show: false,
			titleBarStyle: "hiddenInset",
			titleBarOverlay: false,
			backgroundColor: "#1e1e1e",
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true,
				enableRemoteModule: false,
				webSecurity: false,
				preload: path.join(__dirname, "preload.cjs"),
			},
			parent: this.mainWindow,
			modal: false,
			resizable: true,
			fullscreenable: false,
			skipTaskbar: true,
			vibrancy: 'sidebar', // macOS vibrancy effect
		});

		// Load settings page
		const isDev = process.env.NODE_ENV === "development";
		const settingsUrl = isDev
			? "http://localhost:3002/recording-settings"
			: `file://${path.join(__dirname, "../dist/recording-settings.html")}`;

		await this.settingsWindow.loadURL(settingsUrl);

		// Handle window events
		this.settingsWindow.once("ready-to-show", () => {
			console.log("[RecordingSettingsManager] Settings window ready to show");
			this.settingsWindow.show();
			this.settingsWindow.focus();
		});

		this.settingsWindow.on("closed", () => {
			console.log("[RecordingSettingsManager] Settings window closed");
			this.settingsWindow = null;
		});

		// Handle window focus events
		this.settingsWindow.on("focus", () => {
			console.log("[RecordingSettingsManager] Settings window focused");
		});

		this.settingsWindow.on("blur", () => {
			console.log("[RecordingSettingsManager] Settings window blurred");
		});

		// Prevent navigation
		this.settingsWindow.webContents.on("will-navigate", (event, url) => {
			console.log("[RecordingSettingsManager] Preventing navigation to:", url);
			event.preventDefault();
		});

		// Handle external links
		this.settingsWindow.webContents.setWindowOpenHandler(() => {
			return { action: "deny" };
		});

		console.log("[RecordingSettingsManager] Settings window created successfully");
	}

	async showSettingsWindow() {
		if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
			this.settingsWindow.show();
			this.settingsWindow.focus();
		} else {
			await this.createSettingsWindow();
		}
	}

	hideSettingsWindow() {
		if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
			this.settingsWindow.hide();
		}
	}

	closeSettingsWindow() {
		if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
			this.settingsWindow.close();
		}
	}

	isSettingsWindowOpen() {
		return this.settingsWindow && !this.settingsWindow.isDestroyed() && this.settingsWindow.isVisible();
	}

	getSettingsWindow() {
		return this.settingsWindow;
	}

	cleanup() {
		if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
			this.settingsWindow.close();
		}
		this.settingsWindow = null;
	}
}

module.exports = RecordingSettingsManager;