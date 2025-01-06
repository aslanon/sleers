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
			fullscreen: false,
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
		});
	}

	handleAreaSelected(area) {
		console.log("Seçilen alan:", {
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

		if (this.mainWindow && !this.mainWindow.isDestroyed()) {
			this.mainWindow.webContents.send("AREA_SELECTED", this.selectedArea);
		}

		// Seçim tamamlandığında pencereyi kapat
		if (this.selectionWindow && !this.selectionWindow.isDestroyed()) {
			this.selectionWindow.close();
			this.selectionWindow = null;
		}
	}

	updateSelectedArea(area) {
		console.log("[selectionManager.cjs] Seçilen alan güncelleniyor:", area);
		this.selectedArea = area;
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
		if (this.selectionWindow && !this.selectionWindow.isDestroyed()) {
			this.selectionWindow.close();
			this.selectionWindow = null;
		}
		this.selectedArea = null;
	}
}

module.exports = SelectionManager;
