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
			console.log(
				"[editorManager.cjs] Mevcut editor penceresi gösteriliyor..."
			);
			if (this.mainWindow && !this.mainWindow.isDestroyed()) {
				this.mainWindow.hide();
			}
			this.editorWindow.show();
			return;
		}

		console.log("[editorManager.cjs] Editor penceresi oluşturuluyor...");

		// MediaStateManager ile iletişimi kontrol et (varsa)
		const { ipcMain } = require("electron");
		const { IPC_EVENTS } = require("./constants.cjs");

		// Ekran boyutlarını al
		const { width, height } = screen.getPrimaryDisplay().workAreaSize;

		const windowWidth = Math.round(width * 0.8);
		const windowHeight = Math.round(height * 0.8);

		// Editor penceresini oluştur
		try {
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

			// Yükleme hatalarını yönet
			this.editorWindow.webContents.on(
				"did-fail-load",
				(event, errorCode, errorDescription) => {
					console.error(
						"[editorManager.cjs] Editor penceresi yüklenemedi:",
						errorCode,
						errorDescription
					);

					// Hata durumunda 3 saniye sonra tekrar yüklemeyi dene
					setTimeout(() => {
						console.log(
							"[editorManager.cjs] Editor sayfası tekrar yükleniyor..."
						);
						if (isDev) {
							this.editorWindow.loadURL("http://127.0.0.1:3000/editor");
						} else {
							this.editorWindow.loadFile(
								path.join(__dirname, "../.output/public/editor/index.html")
							);
						}
					}, 3000);
				}
			);

			// URL'yi yükle
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

			// Yükleme tamamlandığında pencereyi göster
			this.editorWindow.webContents.once("did-finish-load", () => {
				console.log("[editorManager.cjs] Editor sayfası yükleme tamamlandı");

				if (this.mainWindow && !this.mainWindow.isDestroyed()) {
					this.mainWindow.hide();
				}

				// MEDIA_READY eventini gönder
				if (this.editorWindow && !this.editorWindow.isDestroyed()) {
					this.editorWindow.show();
					this.editorWindow.webContents.send(IPC_EVENTS.MEDIA_READY);
					console.log("[editorManager.cjs] MEDIA_READY eventi gönderildi");
				}
			});

			// Kapatıldığında temizlik yap
			this.editorWindow.on("closed", () => {
				console.log("[editorManager.cjs] Editor penceresi kapatıldı");
				this.editorWindow = null;

				// EDITOR_CLOSED eventini gönder
				ipcMain.emit(IPC_EVENTS.EDITOR_CLOSED);

				// Ana pencereyi göster
				if (this.mainWindow && !this.mainWindow.isDestroyed()) {
					this.mainWindow.show();
				}
			});
		} catch (error) {
			console.error(
				"[editorManager.cjs] Editor penceresi oluşturulurken hata:",
				error
			);
		}
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
