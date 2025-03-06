const { Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const { IPC_EVENTS } = require("./constants.cjs");

class TrayManager {
	constructor(mainWindow, openEditorMode) {
		this.mainWindow = mainWindow;
		this.tray = null;
		this.isRecording = false;
		this.openEditorMode = openEditorMode;
	}

	createTrayMenu() {
		return Menu.buildFromTemplate([
			{
				label: this.isRecording ? "Kaydı Durdur" : "Kaydı Başlat",
				click: () => {
					if (this.isRecording) {
						this.mainWindow.webContents.send("STOP_RECORDING_FROM_TRAY");
						this.mainWindow.show();
					} else {
						this.mainWindow.webContents.send("START_RECORDING_FROM_TRAY");
						this.mainWindow.hide();
					}
					this.isRecording = !this.isRecording;
					this.updateTrayIcon();
				},
			},
			{
				label: "Editör Modunu Aç",
				click: () => {
					if (this.openEditorMode) {
						this.openEditorMode();
					} else {
						this.mainWindow.webContents.send(IPC_EVENTS.OPEN_EDITOR_MODE);
					}
				},
			},
			{
				label: "Pencereyi Göster",
				click: () => {
					this.mainWindow.show();
				},
			},
			{ type: "separator" },
			{
				label: "Çıkış",
				click: () => {
					this.mainWindow.app.quit();
				},
			},
		]);
	}

	updateTrayIcon() {
		if (!this.tray) return;

		const iconName = this.isRecording ? "recording.png" : "default.png";
		const iconPath = path.join(__dirname, `../public/icons/${iconName}`);
		const trayIcon = nativeImage
			.createFromPath(iconPath)
			.resize({ width: 16, height: 16 });

		this.tray.setImage(trayIcon);
		this.tray.setContextMenu(this.createTrayMenu());
	}

	createTray() {
		const iconPath = path.join(__dirname, "../public/icons/default.png");
		const trayIcon = nativeImage
			.createFromPath(iconPath)
			.resize({ width: 16, height: 16 });

		if (!this.tray) {
			this.tray = new Tray(trayIcon);
			this.tray.setToolTip("Sleer Screen Recorder");
			this.tray.setContextMenu(this.createTrayMenu());
		} else {
			this.tray.setImage(trayIcon);
		}
	}

	setRecordingStatus(status) {
		this.isRecording = status;
		this.updateTrayIcon();
	}
}

module.exports = TrayManager;
