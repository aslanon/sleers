const { Tray, Menu, nativeImage, app } = require("electron");
const path = require("path");
const { IPC_EVENTS } = require("./constants.cjs");
const fs = require("fs");
let Store;

// Electron-store modülünü güvenli bir şekilde yükle
try {
	// Dinamik import kullan
	const ElectronStore = require("electron-store");
	// Sınıf mı fonksiyon mu kontrol et
	if (typeof ElectronStore === "function") {
		Store = ElectronStore;
		console.log("electron-store modülü başarıyla yüklendi");
	} else {
		throw new Error("electron-store geçerli bir constructor değil");
	}
} catch (error) {
	console.error("electron-store modülü yüklenirken hata:", error);
	// Fallback olarak basit bir yerel store kullan
	Store = class SimpleStore {
		constructor(options = {}) {
			this.data = options.defaults || {};
			console.warn(
				"electron-store yerine basit bir inmemory store kullanılıyor"
			);
		}
		get(key) {
			return key ? this.data[key] : this.data;
		}
		set(key, value) {
			if (typeof key === "string") {
				this.data[key] = value;
			} else {
				this.data = { ...this.data, ...key };
			}
		}
		delete(key) {
			delete this.data[key];
		}
		clear() {
			this.data = {};
		}
	};
}

class TrayManager {
	constructor(mainWindow, openEditorMode) {
		this.mainWindow = mainWindow;
		this.tray = null;
		this.isRecording = false;
		this.openEditorMode = openEditorMode;

		// Store oluştur (güvenli)
		try {
			if (typeof Store !== "function") {
				throw new Error("Store sınıfı kullanılamıyor");
			}

			this.store = new Store({
				name: "sleer-settings",
				defaults: {
					recordingSettings: {
						audioEnabled: true,
						microphoneEnabled: true,
						cameraEnabled: true,
						systemAudioEnabled: true,
						recordingDelay: 1000, // ms cinsinden
					},
					editorSettings: {
						camera: {
							followMouse: true,
						},
					},
					recentFiles: [],
				},
			});
			console.log("Store başarıyla oluşturuldu");
		} catch (error) {
			console.error("Store oluşturulurken hata:", error);
			// Hata durumunda varsayılan değerlerle basit bir store oluştur
			this.store = {
				get: () => ({}),
				set: () => {},
			};
		}
	}

	createTrayMenu() {
		return Menu.buildFromTemplate([
			{
				label: this.isRecording ? "Kaydı Durdur" : "Kaydı Başlat",
				click: () => {
					if (this.isRecording) {
						this.mainWindow.webContents.send("STOP_RECORDING_FROM_TRAY");
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
					// Editor açıkken ana pencereyi gösterme
					if (this.editorManager && this.editorManager.isEditorWindowOpen()) {
						console.log("[TrayManager] Editor açık, ana pencere gösterilmiyor");
						return;
					}
					this.mainWindow.show();
				},
			},
			{ type: "separator" },
			{
				label: "Çıkış",
				click: () => {
					app.quit();
				},
			},
		]);
	}

	updateTrayIcon() {
		if (!this.tray) return;

		const iconName = this.isRecording ? "recording.png" : "default.png";
		let iconPath;

		// Dosyanın varlığını kontrol et, yoksa alternatif yolları dene
		if (fs.existsSync(path.join(__dirname, `../public/icons/${iconName}`))) {
			iconPath = path.join(__dirname, `../public/icons/${iconName}`);
		} else if (
			fs.existsSync(path.join(__dirname, `../.output/public/icons/${iconName}`))
		) {
			iconPath = path.join(__dirname, `../.output/public/icons/${iconName}`);
		} else {
			// Fallback: İkon oluştur
			iconPath = path.join(__dirname, `../.output/public/icons/default.png`);
		}

		try {
			const trayIcon = nativeImage
				.createFromPath(iconPath)
				.resize({ width: 16, height: 16 });

			this.tray.setImage(trayIcon);
			this.tray.setContextMenu(this.createTrayMenu());
		} catch (error) {
			console.error("Tray ikonunu güncellerken hata:", error);
		}
	}

	createTray() {
		// İkon yolunu kontrol et ve mevcut olanı kullan
		let iconPath;
		if (fs.existsSync(path.join(__dirname, "../public/icons/default.png"))) {
			iconPath = path.join(__dirname, "../public/icons/default.png");
		} else if (
			fs.existsSync(path.join(__dirname, "../.output/public/icons/default.png"))
		) {
			iconPath = path.join(__dirname, "../.output/public/icons/default.png");
		} else {
			// Fallback - boş ikon
			iconPath = nativeImage.createEmpty();
		}

		try {
			const trayIcon =
				typeof iconPath === "string"
					? nativeImage
							.createFromPath(iconPath)
							.resize({ width: 16, height: 16 })
					: iconPath;

			if (!this.tray) {
				this.tray = new Tray(trayIcon);
				this.tray.setToolTip("Sleer Screen Recorder");
				this.tray.setContextMenu(this.createTrayMenu());
			} else {
				this.tray.setImage(trayIcon);
			}
		} catch (error) {
			console.error("Tray oluşturulurken hata:", error);
		}
	}

	setRecordingStatus(status) {
		this.isRecording = status;
		this.updateTrayIcon();
	}

	cleanup() {
		if (this.tray) {
			this.tray.destroy();
			this.tray = null;
		}
	}
}

module.exports = TrayManager;
