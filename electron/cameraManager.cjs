const { BrowserWindow, screen } = require("electron");
const path = require("path");
const isDev = process.env.NODE_ENV === "development";

class CameraManager {
	constructor(mainWindow) {
		this.mainWindow = mainWindow;
		this.cameraWindow = null;
		this.isDragging = false;
		this.dragOffset = { x: 0, y: 0 };
		this.isLargeCamera = false;
		this.mouseTrackingInterval = null;
		this.currentPosition = { x: 0, y: 0 };
		this.targetPosition = { x: 0, y: 0 };
		this.lastMousePositions = [];
		this.lastCameraPosition = null;
		this.isRecording = false;

		// Constants
		this.SMALL_SIZE = 260;
		this.LARGE_SIZE = 460;
		this.SHAKE_THRESHOLD = 800;
		this.SHAKE_TIME_WINDOW = 500;
		this.REQUIRED_MOVEMENTS = 5;
	}

	// Lerp function for smooth animation
	lerp(start, end, factor) {
		return start + (end - start) * factor;
	}

	// Toggle camera size
	toggleCameraSize() {
		if (!this.cameraWindow) return;

		this.isLargeCamera = !this.isLargeCamera;
		const targetSize = this.isLargeCamera ? this.LARGE_SIZE : this.SMALL_SIZE;
		const currentSize = this.cameraWindow.getSize()[0];

		let startTime = Date.now();
		const duration = 300;
		const startSize = currentSize;

		const animationInterval = setInterval(() => {
			const currentTime = Date.now();
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const easeIn = progress * progress * progress;
			const newSize = Math.round(startSize + (targetSize - startSize) * easeIn);

			this.cameraWindow.setSize(newSize, newSize);
			this.cameraWindow.setBackgroundColor("#00000000");

			if (progress >= 1) {
				clearInterval(animationInterval);
			}
		}, 16);
	}

	// Check mouse shake for size toggle
	checkMouseShake(mousePos) {
		if (this.isDragging) return;

		const now = Date.now();
		this.lastMousePositions = this.lastMousePositions.filter(
			(pos) => now - pos.time < this.SHAKE_TIME_WINDOW
		);

		this.lastMousePositions.push({
			x: mousePos.x,
			y: mousePos.y,
			time: now,
		});

		if (this.lastMousePositions.length >= this.REQUIRED_MOVEMENTS) {
			let shakeCount = 0;
			let lastDirection = null;

			for (let i = 1; i < this.lastMousePositions.length; i++) {
				const prev = this.lastMousePositions[i - 1];
				const curr = this.lastMousePositions[i];

				const dx = curr.x - prev.x;
				const dy = curr.y - prev.y;
				const dt = curr.time - prev.time;
				const speed = Math.sqrt(dx * dx + dy * dy) / dt;

				const currentDirection = dx > 0 ? "right" : "left";

				if (
					lastDirection &&
					currentDirection !== lastDirection &&
					speed * 1000 > this.SHAKE_THRESHOLD
				) {
					shakeCount++;
				}

				lastDirection = currentDirection;
			}

			if (shakeCount >= 2) {
				this.toggleCameraSize();
				this.lastMousePositions = [];
			}
		}
	}

	// Start mouse tracking for camera movement
	startMouseTracking() {
		if (this.cameraWindow && !this.mouseTrackingInterval) {
			const [startX, startY] = this.cameraWindow.getPosition();
			this.currentPosition = { x: startX, y: startY };
			this.targetPosition = { x: startX, y: startY };

			this.mouseTrackingInterval = setInterval(() => {
				if (!this.cameraWindow || this.cameraWindow.isDestroyed()) {
					this.stopMouseTracking();
					return;
				}

				const mousePos = screen.getCursorScreenPoint();
				const [width, height] = this.cameraWindow.getSize();
				this.checkMouseShake(mousePos);

				const display = screen.getDisplayNearestPoint(mousePos);
				const bounds = display.bounds;

				let x = mousePos.x - width / 2;
				let y = mousePos.y + 25;

				const EDGE_THRESHOLD = 600;

				if (mousePos.x > bounds.x + bounds.width - EDGE_THRESHOLD) {
					x = mousePos.x - width - 25;
				} else if (mousePos.x < bounds.x + EDGE_THRESHOLD) {
					x = mousePos.x + 25;
				}

				if (mousePos.y > bounds.y + bounds.height - EDGE_THRESHOLD) {
					y = mousePos.y - height - 25;
				} else if (mousePos.y < bounds.y + EDGE_THRESHOLD) {
					y = mousePos.y + 25;
				}

				x = Math.max(bounds.x, Math.min(x, bounds.x + bounds.width - width));
				y = Math.max(bounds.y, Math.min(y, bounds.y + bounds.height - height));

				this.targetPosition = { x, y };

				this.currentPosition.x = this.lerp(
					this.currentPosition.x,
					this.targetPosition.x,
					0.15
				);
				this.currentPosition.y = this.lerp(
					this.currentPosition.y,
					this.targetPosition.y,
					0.15
				);

				if (this.cameraWindow && !this.cameraWindow.isDestroyed()) {
					this.cameraWindow.setPosition(
						Math.round(this.currentPosition.x),
						Math.round(this.currentPosition.y)
					);
				}
			}, 16);
		}
	}

	// Stop mouse tracking
	stopMouseTracking() {
		if (this.mouseTrackingInterval) {
			clearInterval(this.mouseTrackingInterval);
			this.mouseTrackingInterval = null;
		}
	}

	// Create camera window
	createCameraWindow() {
		console.log("Kamera penceresi oluşturuluyor...");
		const { width, height } = screen.getPrimaryDisplay().workAreaSize;
		const size = this.SMALL_SIZE;

		this.cameraWindow = new BrowserWindow({
			width: size,
			height: size,
			x: width - size - 50,
			y: height - size - 50,
			transparent: true,
			frame: false,
			alwaysOnTop: true,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: true,
				backgroundThrottling: false,

				preload: path.join(__dirname, "preload.cjs"),
			},

			backgroundColor: "#00000000",
			hasShadow: false,
			roundedCorners: true,
			titleBarOverlay: false,
			fullscreenable: false,
			type: "panel",
			focusable: false,
			vibrancy: "ultra-dark",
			maximizable: false,
			minimizable: false,
		});

		const cameraHtmlPath = path.join(
			__dirname,
			"../.output/public/camera/index.html"
		);
		console.log("Kamera HTML yolu:", cameraHtmlPath);

		if (isDev) {
			console.log("Development modunda kamera penceresi yükleniyor...");
			this.cameraWindow.loadURL("http://127.0.0.1:3000/camera");
			this.cameraWindow.webContents.openDevTools({ mode: "detach" });
		} else {
			console.log("Production modunda kamera penceresi yükleniyor...");
			this.cameraWindow.loadFile(cameraHtmlPath);
		}

		this.cameraWindow.on("closed", () => {
			console.log("Kamera penceresi kapatıldı");
			this.cameraWindow = null;
			this.stopMouseTracking();
		});

		this.cameraWindow.webContents.on(
			"did-fail-load",
			(event, errorCode, errorDescription) => {
				console.error(
					"Kamera penceresi yüklenemedi:",
					errorCode,
					errorDescription
				);
			}
		);

		this.startMouseTracking();
	}

	// Close camera window
	closeCameraWindow() {
		if (this.cameraWindow) {
			this.stopMouseTracking();
			this.cameraWindow.close();
			this.cameraWindow = null;
		}
	}

	// Yeni metodlar
	getCameraPosition() {
		return this.lastCameraPosition;
	}

	updateCameraDevice(deviceId) {
		if (deviceId && this.cameraWindow && !this.cameraWindow.isDestroyed()) {
			this.cameraWindow.webContents.send("UPDATE_CAMERA_DEVICE", deviceId);
		}
	}

	setRecordingStatus(status) {
		this.isRecording = status;
		if (status) {
			this.createCameraWindow();
			this.startMouseTracking();
		} else {
			this.closeCameraWindow();
		}
	}

	handleCameraStatusUpdate(statusData) {
		if (this.mainWindow && !this.mainWindow.isDestroyed()) {
			this.mainWindow.webContents.send("CAMERA_STATUS_CHANGED", statusData);
		}
	}

	handleWindowDragStart(mousePos) {
		this.isDragging = true;
		const winPos = this.cameraWindow.getPosition();
		this.dragOffset = {
			x: mousePos.x - winPos[0],
			y: mousePos.y - winPos[1],
		};
	}

	handleWindowDragging(mousePos) {
		if (!this.isDragging) return;
		this.cameraWindow.setPosition(
			mousePos.x - this.dragOffset.x,
			mousePos.y - this.dragOffset.y
		);
	}

	handleWindowDragEnd() {
		this.isDragging = false;
		if (this.cameraWindow) {
			this.lastCameraPosition = this.cameraWindow.getPosition();
		}
	}

	resetForNewRecording() {
		if (this.cameraWindow) {
			const { width, height } = screen.getPrimaryDisplay().workAreaSize;
			this.cameraWindow.setPosition(width - 340, height - 340);
		}
	}

	cleanup() {
		this.stopMouseTracking();
		this.closeCameraWindow();
	}
}

module.exports = CameraManager;
