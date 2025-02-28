const { BrowserWindow, screen } = require("electron");
const path = require("path");
const isDev = process.env.NODE_ENV === "development";

class SelectionManager {
	constructor(mainWindow) {
		this.mainWindow = mainWindow;
		this.selectionWindow = null;
		this.selectedArea = null;
	}

	startAreaSelection() {
		const displays = screen.getAllDisplays();
		const primaryDisplay = screen.getPrimaryDisplay();

		let totalWidth = 0;
		let totalHeight = 0;
		let minX = 0;
		let minY = 0;

		displays.forEach((display) => {
			const { bounds } = display;
			minX = Math.min(minX, bounds.x);
			minY = Math.min(minY, bounds.y);
			totalWidth = Math.max(totalWidth, bounds.x + bounds.width);
			totalHeight = Math.max(totalHeight, bounds.y + bounds.height);
		});

		if (this.selectionWindow) {
			this.selectionWindow.close();
			this.selectionWindow = null;
		}

		this.selectionWindow = new BrowserWindow({
			width: totalWidth - minX,
			height: totalHeight - minY,
			x: minX,
			y: minY,
			transparent: true,
			frame: false,
			fullscreen: true,
			alwaysOnTop: true,
			skipTaskbar: true,
			resizable: false,
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true,
				preload: path.join(__dirname, "preload.cjs"),
			},
		});

		this.selectionWindow.setVisibleOnAllWorkspaces(true);
		this.selectionWindow.setAlwaysOnTop(true, "screen-saver");

		if (isDev) {
			this.selectionWindow.loadURL("http://127.0.0.1:3000/selection");
		} else {
			this.selectionWindow.loadFile(
				path.join(__dirname, "../.output/public/selection/index.html")
			);
		}

		// Seçim penceresi kapatıldığında temizlik
		this.selectionWindow.on("closed", () => {
			this.selectionWindow = null;
			// Kapatma olayında IPC dinleyiciyi temizle
			this.removeCloseListener();
		});

		// Alan seçimi işlendiğinde
		this.selectionWindow.webContents.once("did-finish-load", () => {
			// Seçim penceresi hazır olduğunda logla
			console.log("[selectionManager.cjs] Seçim penceresi hazır");
		});

		// Önce varsa eski dinleyiciyi kaldır
		this.removeCloseListener();

		// Yeni CLOSE_SELECTION_WINDOW dinleyicisi ekle
		this.setupCloseListener();
	}

	// IPC dinleyicisini kur
	setupCloseListener() {
		const { ipcMain } = require("electron");

		// Global bir referans tut
		this.closeListener = () => {
			console.log(
				"[selectionManager.cjs] Seçim penceresi kapatma isteği alındı"
			);
			this.closeSelectionWindow();
		};

		// İsteğe din
		ipcMain.on("CLOSE_SELECTION_WINDOW", this.closeListener);
	}

	// IPC dinleyicisini kaldır
	removeCloseListener() {
		const { ipcMain } = require("electron");

		if (this.closeListener) {
			try {
				console.log("[selectionManager.cjs] Eski dinleyici kaldırılıyor");
				ipcMain.removeListener("CLOSE_SELECTION_WINDOW", this.closeListener);
				this.closeListener = null;
			} catch (error) {
				console.warn(
					"[selectionManager.cjs] Dinleyici kaldırılırken hata:",
					error
				);
			}
		}
	}

	handleAreaSelected(area) {
		console.log("[selectionManager.cjs] Seçilen alan:", {
			...area,
			aspectRatio: area.aspectRatio || "free",
		});

		this.selectedArea = {
			...area,
			x: Math.round(area.x),
			y: Math.round(area.y),
			width: Math.round(area.width),
			height: Math.round(area.height),
			aspectRatio: area.aspectRatio || "free",
			display: area.display,
			devicePixelRatio: area.devicePixelRatio || 1,
		};

		// Önce ana pencereye bildir, sonra seçim penceresini kapat
		if (this.mainWindow && !this.mainWindow.isDestroyed()) {
			try {
				this.mainWindow.webContents.send("AREA_SELECTED", this.selectedArea);
				console.log(
					"[selectionManager.cjs] Alan seçimi ana pencereye bildirildi"
				);
			} catch (error) {
				console.error("[selectionManager.cjs] Alan bildirme hatası:", error);
			}
		}

		// Seçim tamamlandığında pencereyi hemen kapat
		console.log("[selectionManager.cjs] Seçim onaylandı, pencere kapatılıyor");
		this.closeSelectionWindow();
	}

	closeSelectionWindow() {
		// Seçim penceresini kapat
		if (this.selectionWindow && !this.selectionWindow.isDestroyed()) {
			console.log("[selectionManager.cjs] Seçim penceresi kapatılıyor");

			try {
				// Önce alwaysOnTop özelliğini kapat ve gizle
				this.selectionWindow.setAlwaysOnTop(false);
				this.selectionWindow.hide();

				// Doğrudan kapat
				this.selectionWindow.close();
				console.log("[selectionManager.cjs] Seçim penceresi kapatıldı");
				this.selectionWindow = null;
			} catch (error) {
				console.error("[selectionManager.cjs] Pencere kapatma hatası:", error);

				// Hata durumunda zorla kapatmayı dene
				try {
					if (this.selectionWindow && !this.selectionWindow.isDestroyed()) {
						this.selectionWindow.destroy();
						console.log("[selectionManager.cjs] Pencere zorla kapatıldı");
					}
				} catch (destroyError) {
					console.error(
						"[selectionManager.cjs] Zorla kapatma hatası:",
						destroyError
					);
				}

				// Her durumda null yap
				this.selectionWindow = null;
			}
		} else {
			console.log("[selectionManager.cjs] Seçim penceresi zaten kapalı");
			this.selectionWindow = null;
		}
	}

	updateSelectedArea(area) {
		console.log("[selectionManager.cjs] Seçilen alan güncelleniyor:", area);

		// Alan bilgilerini tam olarak tanımla ve dönüşümleri yap
		if (area) {
			// Alanın tam koordinatlarını doğrula ve yuvarla
			this.selectedArea = {
				...area,
				x: Math.round(area.x || 0),
				y: Math.round(area.y || 0),
				width: Math.round(area.width || 0),
				height: Math.round(area.height || 0),
				aspectRatio: area.aspectRatio || "free",
				display: area.display || null,
				devicePixelRatio: area.devicePixelRatio || 1,
			};

			// Aspect ratio değerini doğru biçimde işle
			if (area.aspectRatio && area.aspectRatio !== "free") {
				try {
					// Aspect ratio değerini sayısallaştır
					let aspectRatioValue = 0;
					if (area.aspectRatioValue) {
						aspectRatioValue = area.aspectRatioValue;
					} else if (area.aspectRatio === "16:9") {
						aspectRatioValue = 16 / 9;
					} else if (area.aspectRatio === "4:3") {
						aspectRatioValue = 4 / 3;
					} else if (area.aspectRatio === "1:1") {
						aspectRatioValue = 1;
					} else if (area.aspectRatio === "9:16") {
						aspectRatioValue = 9 / 16;
					} else if (area.aspectRatio === "3:4") {
						aspectRatioValue = 3 / 4;
					}

					if (aspectRatioValue > 0) {
						this.selectedArea.aspectRatioValue = aspectRatioValue;
					}
				} catch (error) {
					console.error(
						"[selectionManager.cjs] Aspect ratio hesaplama hatası:",
						error
					);
				}
			}

			console.log(
				"[selectionManager.cjs] Seçilen alan güncellendi:",
				this.selectedArea
			);
		} else {
			console.warn("[selectionManager.cjs] Geçersiz alan bilgisi:", area);
		}
	}

	getSelectedArea() {
		return this.selectedArea;
	}

	resetSelection() {
		this.selectedArea = null;
		if (this.selectionWindow && !this.selectionWindow.isDestroyed()) {
			this.selectionWindow.close();
			this.selectionWindow = null;
		}
	}

	cleanup() {
		// Pencere kapatma ve dinleyicileri temizleme
		this.closeSelectionWindow();
		this.removeCloseListener();
		this.selectedArea = null;
	}
}

module.exports = SelectionManager;
