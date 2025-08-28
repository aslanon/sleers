const { Tray, Menu, nativeImage, app, nativeTheme } = require("electron");
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
		this.isEditorOpen = false;
		this.openEditorMode = openEditorMode;
		
		// Tema değişikliklerini dinle
		nativeTheme.on('updated', () => {
			console.log('[TrayManager] Theme changed, updating tray icon');
			this.updateTrayIcon();
		});

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
		// During recording, return empty menu (no menu shown)
		if (this.isRecording) {
			return Menu.buildFromTemplate([]);
		}

		// Normal menu when not recording
		return Menu.buildFromTemplate([
			{
				label: "Start Recording",
				click: () => {
					this.mainWindow.webContents.send("START_RECORDING_FROM_TRAY");
					this.mainWindow.hide();
					this.isRecording = true;
					this.updateTrayIcon();
				},
			},
			{
				label: "Open Editor",
				click: () => {
					if (this.openEditorMode) {
						this.openEditorMode();
					} else {
						this.mainWindow.webContents.send(IPC_EVENTS.OPEN_EDITOR_MODE);
					}
				},
			},
			{
				label: "Show Window",
				click: () => {
					// Don't show main window when editor is open
					if (this.editorManager && this.editorManager.isEditorWindowOpen()) {
						console.log("[TrayManager] Editor is open, not showing main window");
						return;
					}
					this.mainWindow.show();
				},
			},
			{ type: "separator" },
			{
				label: "Quit",
				click: () => {
					app.quit();
				},
			},
		]);
	}

	getIconPath(isRecording = false) {
		// Sistem teması algıla (dark mode = true, light mode = false)
		const isDarkMode = nativeTheme.shouldUseDarkColors;
		
		// Tema ve kayıt durumuna göre logo dosyası seç
		let logoFileName;
		if (isRecording) {
			// Kayıt sırasında kırmızı varyasyonlar
			logoFileName = isDarkMode 
				? "logo-sample-red.png"        // Dark mode: beyaz kırmızı
				: "logo-sample-black-red.png"; // Light mode: siyah kırmızı
		} else {
			// Normal durum
			logoFileName = isDarkMode 
				? "logo-sample.png"       // Dark mode: beyaz
				: "logo-sample-black.png"; // Light mode: siyah
		}

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
				? nativeImage.createFromPath(iconPath)
				: nativeImage.createEmpty();

			this.tray.setImage(trayIcon);
			this.tray.setContextMenu(this.createTrayMenu());
			this.updateToolTip();

			console.log(
				`[TrayManager] Tray icon updated - Recording: ${this.isRecording}, Editor: ${this.isEditorOpen}`
			);
		} catch (error) {
			console.error("Tray ikonunu güncellerken hata:", error);
		}
	}

	createTray() {
		const iconPath = this.getIconPath(this.isRecording);

		try {
			const trayIcon = iconPath
				? nativeImage.createFromPath(iconPath)
				: nativeImage.createEmpty();

			if (!this.tray) {
				this.tray = new Tray(trayIcon);
				this.updateToolTip();
				
				// Add direct click handler for recording mode
				this.tray.on('click', () => {
					if (this.isRecording) {
						// Direct click during recording stops recording
						this.mainWindow.webContents.send("STOP_RECORDING_FROM_TRAY");
						this.isRecording = false;
						this.updateTrayIcon();
						console.log("[TrayManager] Recording stopped via direct tray click");
					}
				});
				
				this.tray.setContextMenu(this.createTrayMenu());
				console.log("[TrayManager] Tray created successfully");
			} else {
				this.tray.setImage(trayIcon);
			}
		} catch (error) {
			console.error("Tray oluşturulurken hata:", error);
		}
	}

	updateToolTip() {
		if (!this.tray) return;
		
		let tooltip = "Sleer Screen Recorder";
		if (this.isRecording) {
			tooltip += " - Recording (Click to stop)";
		} else if (this.isEditorOpen) {
			tooltip += " - Editor Mode";
		}
		
		this.tray.setToolTip(tooltip);
	}

	setRecordingStatus(status) {
		this.isRecording = status;
		this.updateTrayIcon();
		this.updateToolTip();
	}

	setEditorStatus(status) {
		this.isEditorOpen = status;
		this.updateTrayIcon(); // This will show/hide menu items
		this.updateToolTip();
	}

	cleanup() {
		if (this.tray) {
			this.tray.destroy();
			this.tray = null;
		}
	}
}

module.exports = TrayManager;
