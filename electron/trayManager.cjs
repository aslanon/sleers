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
				name: "creavit-studio-settings",
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

	getIconPath(isRecording = false) {
		// Kayıt durumuna göre farklı logo dosyası seç
		const logoFileName = isRecording
			? "logo-sample-red.png"
			: "logo-sample.png";

		// Farklı klasörlerde logo dosyasını ara
		const possiblePaths = [
			path.join(__dirname, `../assets/${logoFileName}`),
			path.join(__dirname, `../public/assets/${logoFileName}`),
			path.join(__dirname, `../.output/public/assets/${logoFileName}`),
		];

		// İlk bulunan dosyayı kullan
		for (const filePath of possiblePaths) {
			if (fs.existsSync(filePath)) {
				console.log(
					`[TrayManager] ${
						isRecording ? "Recording" : "Normal"
					} icon found: ${filePath}`
				);
				return filePath;
			}
		}

		// Kayıt iconunu bulamazsa normal iconu dene
		if (isRecording) {
			console.warn(
				"[TrayManager] Recording icon not found, falling back to normal icon"
			);
			return this.getIconPath(false);
		}

		// Hiçbir logo bulunamazsa fallback
		const fallbackPath = path.join(__dirname, "../public/icons/default.png");
		if (fs.existsSync(fallbackPath)) {
			console.warn("[TrayManager] Using fallback icon:", fallbackPath);
			return fallbackPath;
		}

		console.warn("[TrayManager] No icon found, using empty icon");
		return null;
	}

	updateTrayIcon() {
		if (!this.tray) return;

		const iconPath = this.getIconPath(this.isRecording);

		try {
			const trayIcon = iconPath
				? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
				: nativeImage.createEmpty();

			this.tray.setImage(trayIcon);
			this.tray.setContextMenu(this.createTrayMenu());

			console.log(
				`[TrayManager] Tray icon updated - Recording: ${this.isRecording}`
			);
		} catch (error) {
			console.error("Tray ikonunu güncellerken hata:", error);
		}
	}

	createTray() {
		const iconPath = this.getIconPath(this.isRecording);

		try {
			const trayIcon = iconPath
				? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
				: nativeImage.createEmpty();

			if (!this.tray) {
				this.tray = new Tray(trayIcon);
				this.tray.setToolTip("Creavit Studio Screen Recorder");
				this.tray.setContextMenu(this.createTrayMenu());
				console.log("[TrayManager] Tray created successfully");
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
