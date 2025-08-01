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
		this.shouldFollowMouse = false;
		this.initializationAttempts = 0;
		this.maxInitializationAttempts = 3;
		this.initializationTimeout = null;

		// Constants
		this.SMALL_SIZE = 160;
		this.LARGE_SIZE = 360;
		this.SHAKE_THRESHOLD = 800;
		this.SHAKE_TIME_WINDOW = 500;
		this.REQUIRED_MOVEMENTS = 5;
		this.INITIALIZATION_RETRY_DELAY = 2000; // 2 seconds
	}

	// Initialize camera with retry mechanism
	async initializeCamera() {
		console.log(
			"[cameraManager.cjs] Kamera başlatılıyor... (deneme: " +
				(this.initializationAttempts + 1) +
				"/" +
				(this.maxInitializationAttempts + 1) +
				")"
		);

		// Zaten başlatılmış ve çalışır durumdaysa tekrar başlatmaya gerek yok
		if (
			this.cameraWindow &&
			!this.cameraWindow.isDestroyed() &&
			this.cameraWindow.isVisible()
		) {
			console.log(
				"[cameraManager.cjs] Kamera zaten çalışıyor, tekrar başlatılmıyor."
			);
			return;
		}

		if (this.initializationAttempts >= this.maxInitializationAttempts) {
			console.error(
				"[cameraManager.cjs] Maksimum kamera başlatma deneme sayısına ulaşıldı"
			);
			if (this.mainWindow && !this.mainWindow.isDestroyed()) {
				this.mainWindow.webContents.send(
					"camera-error",
					"Kamera birden fazla deneme sonrasında başlatılamadı"
				);
			}
			return;
		}

		try {
			console.log("[cameraManager.cjs] Kamera penceresi oluşturuluyor...");
			await this.createCameraWindow();
			this.initializationAttempts = 0; // Reset attempts on success
			console.log("[cameraManager.cjs] Kamera başarıyla başlatıldı");
		} catch (error) {
			console.error("[cameraManager.cjs] Kamera başlatma hatası:", error);
			this.initializationAttempts++;

			// Schedule retry
			if (this.initializationAttempts < this.maxInitializationAttempts) {
				if (this.initializationTimeout) {
					clearTimeout(this.initializationTimeout);
				}
				console.log(
					"[cameraManager.cjs] Kamera başlatma yeniden deneniyor... (" +
						this.INITIALIZATION_RETRY_DELAY +
						"ms sonra)"
				);
				this.initializationTimeout = setTimeout(() => {
					this.initializeCamera();
				}, this.INITIALIZATION_RETRY_DELAY);
			}
		}
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

				// Sadece shouldFollowMouse true ise fare takibi yap
				if (this.shouldFollowMouse) {
					const display = screen.getDisplayNearestPoint(mousePos);
					const bounds = display.bounds;

					const PADDING = 20;
					let x = mousePos.x - width / 2;
					let y = mousePos.y + 100;

					const EDGE_THRESHOLD = 600;

					if (mousePos.x > bounds.x + bounds.width - EDGE_THRESHOLD) {
						x = mousePos.x - width - 100;
					} else if (mousePos.x < bounds.x + EDGE_THRESHOLD) {
						x = mousePos.x + 100;
					}

					if (mousePos.y > bounds.y + bounds.height - EDGE_THRESHOLD) {
						y = mousePos.y - height - 100;
					} else if (mousePos.y < bounds.y + EDGE_THRESHOLD) {
						y = mousePos.y + 100;
					}

					// Ensure camera stays within bounds with padding
					x = Math.max(
						bounds.x + PADDING,
						Math.min(x, bounds.x + bounds.width - width - PADDING)
					);
					y = Math.max(
						bounds.y + PADDING,
						Math.min(y, bounds.y + bounds.height - height - PADDING)
					);

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

	// Create camera window with enhanced error handling
	async createCameraWindow() {
		console.log("Creating camera window...");

		if (this.cameraWindow) {
			try {
				if (!this.cameraWindow.isDestroyed()) {
					this.cameraWindow.close();
				}
			} catch (error) {
				console.warn("Error closing existing camera window:", error);
			}
		}

		const { width, height } = screen.getPrimaryDisplay().workAreaSize;
		const size = this.SMALL_SIZE; // Başlangıçta küçük boyutla başla

		try {
			this.cameraWindow = new BrowserWindow({
				width: size,
				height: size,
				x: width - size - 50,
				y: height - size - 50,
				transparent: true,
				frame: false,
				alwaysOnTop: true,
				// macOS'ta ekran kaydından gizle
				...(process.platform === "darwin" && {
					excludedFromShownWindowsMenu: true,
				}),
				webPreferences: {
					nodeIntegration: false,
					contextIsolation: true,
					backgroundThrottling: false,
					preload: path.join(__dirname, "preload.cjs"),
					webSecurity: false,
					allowRunningInsecureContent: true,
					// devTools property kaldırıldı - programatik kontrol kullanılacak
				},
				backgroundColor: "#00000000",
				hasShadow: false,
				roundedCorners: true,
				type: "panel",
				show: false, // Başlangıçta gizle, içerik yüklendikten sonra göster
				maximizable: false,
				minimizable: false,
				skipTaskbar: true,
				movable: true,
			});

			// macOS'ta kamera penceresini ekran kaydından gizle
			if (process.platform === "darwin") {
				try {
					this.cameraWindow.setContentProtection(true);
					console.log(
						"[CameraManager] ✅ Kamera penceresi ekran kaydından gizlendi"
					);
				} catch (error) {
					console.warn(
						"[CameraManager] ⚠️ Kamera pencere gizleme başarısız:",
						error.message
					);
				}
			}

			// Kamera penceresini yapılandır
			this.cameraWindow.removeMenu();
			this.cameraWindow.setAlwaysOnTop(true, "floating");
			this.cameraWindow.setVisibleOnAllWorkspaces(true);
			this.cameraWindow.setBackgroundColor("#00000000");

			// Log kamera penceresi oluşturma bilgisi
			console.log("[CameraManager] Kamera penceresi oluşturuldu, boyut:", size);

			// Set up window event handlers
			this.setupWindowEventHandlers();

			// Load camera content
			await this.loadCameraContent();

			// Production'da DevTools güvenlik önlemleri
			if (!isDev) {
				try {
					this.cameraWindow.webContents.setDevToolsWebContents(null);
				} catch (error) {
					console.log("setDevToolsWebContents not available:", error.message);
				}

				this.cameraWindow.webContents.on(
					"before-input-event",
					(event, input) => {
						if (
							input.key === "F12" ||
							(input.meta && input.alt && input.key.toLowerCase() === "i") ||
							(input.meta && input.shift && input.key.toLowerCase() === "i") ||
							(input.control && input.shift && input.key.toLowerCase() === "i")
						) {
							event.preventDefault();
						}
					}
				);

				this.cameraWindow.webContents.on("context-menu", (event) => {
					event.preventDefault();
				});

				this.cameraWindow.webContents.on("devtools-opened", () => {
					this.cameraWindow.webContents.closeDevTools();
				});
			}

			// Kamera penceresini göster
			if (this.cameraWindow && !this.cameraWindow.isDestroyed()) {
				this.cameraWindow.show();
				console.log("[CameraManager] Kamera penceresi gösteriliyor");
			}

			// Start mouse tracking after successful initialization
			this.startMouseTracking();
			return true;
		} catch (error) {
			console.error("Error creating camera window:", error);
			throw error;
		}
	}

	// Set up window event handlers
	setupWindowEventHandlers() {
		if (!this.cameraWindow) return;

		this.cameraWindow.on("closed", () => {
			console.log("Camera window closed");
			this.cameraWindow = null;
			this.stopMouseTracking();
		});

		this.cameraWindow.on("unresponsive", () => {
			console.log("Camera window became unresponsive");
			this.handleUnresponsiveWindow();
		});

		this.cameraWindow.webContents.on(
			"did-fail-load",
			(event, errorCode, errorDescription) => {
				console.error("Camera content failed to load:", errorDescription);
				this.handleLoadError(errorCode, errorDescription);
			}
		);

		// IPC olaylarını dinle
		const { ipcMain } = require("electron");

		// Kamera penceresi sürükleme olayları
		ipcMain.on("CAMERA_WINDOW_DRAG_START", (event, mousePos) => {
			if (event.sender === this.cameraWindow?.webContents) {
				this.handleWindowDragStart(mousePos);
			}
		});

		ipcMain.on("CAMERA_WINDOW_DRAGGING", (event, mousePos) => {
			if (event.sender === this.cameraWindow?.webContents) {
				this.handleWindowDragging(mousePos);
			}
		});

		ipcMain.on("CAMERA_WINDOW_DRAG_END", (event) => {
			if (event.sender === this.cameraWindow?.webContents) {
				this.handleWindowDragEnd();
			}
		});

		// Kamera durumu değişikliği
		ipcMain.on("CAMERA_STATUS_CHANGE", (event, statusData) => {
			if (event.sender === this.cameraWindow?.webContents) {
				this.handleCameraStatusUpdate(statusData);
			}
		});
	}

	// Handle unresponsive window
	async handleUnresponsiveWindow() {
		try {
			if (this.cameraWindow && !this.cameraWindow.isDestroyed()) {
				await this.cameraWindow.close();
			}
		} catch (error) {
			console.error("Error handling unresponsive window:", error);
		} finally {
			this.initializeCamera();
		}
	}

	// Handle load error
	handleLoadError(errorCode, errorDescription) {
		console.error(`Camera load error (${errorCode}):`, errorDescription);
		this.initializeCamera();
	}

	// Load camera content
	async loadCameraContent() {
		if (!this.cameraWindow) return;

		try {
			if (isDev) {
				console.log(
					"[CameraManager] Geliştirme modunda kamera penceresi yükleniyor..."
				);
				await this.cameraWindow.loadURL(
					`http://127.0.0.1:${global.serverPort}/camera`
				);
				// this.cameraWindow.webContents.openDevTools({ mode: "detach" });
			} else {
				// Express sunucusu kullanıyorsa
				const serverPort = global.serverPort || 3030; // Global değişkenden port bilgisini al
				const serverUrl = `http://localhost:${serverPort}/camera`;

				console.log(
					`[CameraManager] Üretim modunda kamera penceresi yükleniyor... URL: ${serverUrl}`
				);

				// Görünürlüğü hemen garantile
				setTimeout(() => {
					if (
						this.cameraWindow &&
						!this.cameraWindow.isDestroyed() &&
						!this.cameraWindow.isVisible()
					) {
						this.cameraWindow.show();
						console.log("[CameraManager] Erken görünürlük garantisi (timeout)");
					}
				}, 500);

				try {
					await this.cameraWindow.loadURL(serverUrl);
					console.log(
						"[CameraManager] Kamera penceresi başarıyla yüklendi (Express)"
					);
				} catch (expressError) {
					console.error(
						"[CameraManager] Express'ten yükleme başarısız:",
						expressError
					);

					// Alternatif 1: hash ile dene
					try {
						await this.cameraWindow.loadURL(
							`http://localhost:${serverPort}/#/camera`
						);
						console.log("[CameraManager] Hash ile yüklendi");
					} catch (hashError) {
						console.error("[CameraManager] Hash yükleme hatası:", hashError);

						try {
							// Alternatif 2: doğrudan yüklemeyi dene
							const cameraHtmlPath = path.join(
								process.resourcesPath,
								"public/camera.html"
							);
							console.log(
								`[CameraManager] Alternatif yükleme deneniyor: ${cameraHtmlPath}`
							);
							await this.cameraWindow.loadFile(cameraHtmlPath);
						} catch (fileError) {
							console.error("Dosyadan yükleme hatası:", fileError);

							// Son çare olarak doğrudan HTML oluştur
							console.log("[CameraManager] Inline HTML içeriği oluşturuluyor");
							const htmlContent = `
							<!DOCTYPE html>
							<html>
							<head>
								<meta charset="utf-8">
								<meta name="viewport" content="width=device-width, initial-scale=1">
								<title>Camera</title>
								<style>
									body {
										margin: 0;
										padding: 0;
										overflow: hidden;
										background: transparent;
									}
									.camera-container {
										width: 100vw;
										height: 100vh;
										display: flex;
										justify-content: center;
										align-items: center;
										border-radius: 50%;
										overflow: hidden;
									}
									video {
										width: 100%;
										height: 100%;
										object-fit: cover;
										transform: scaleX(-1);
										border-radius: 50%;
									}
									.loading {
										position: absolute;
										top: 0;
										left: 0;
										width: 100%;
										height: 100%;
										display: flex;
										justify-content: center;
										align-items: center;
										background: rgba(0,0,0,0.3);
										color: white;
										font-family: sans-serif;
										font-size: 12px;
										border-radius: 50%;
									}
								</style>
							</head>
							<body>
								<div class="camera-container">
									<div class="loading">Camera loading...</div>
									<video id="camera" autoplay muted playsinline></video>
								</div>
								<script>
									const startCamera = async () => {
										try {
											const stream = await navigator.mediaDevices.getUserMedia({
												video: {
													width: { ideal: 1280 },
													height: { ideal: 720 }
												},
												audio: false
											});
											
											const video = document.getElementById('camera');
											video.srcObject = stream;
											
											// Loading mesajını kaldır
											video.onloadeddata = () => {
												const loading = document.querySelector('.loading');
												if (loading) loading.style.display = 'none';
												
												// Electron API'ye erişim varsa durumu bildir
												if (window.electronAPI) {
													window.electronAPI.sendToMain('CAMERA_STATUS_CHANGE', {
														type: 'camera',
														isActive: true,
														status: 'ready'
													});
												}
											};
										} catch (err) {
											console.error('Kamera başlatma hatası:', err);
											const loading = document.querySelector('.loading');
											if (loading) loading.textContent = 'Camera error: ' + err.message;
										}
									};
									
									document.addEventListener('DOMContentLoaded', () => {
										startCamera();
										
										// Electron API'ye erişim varsa pencere yüklendi bilgisi gönder
										if (window.electronAPI) {
											window.electronAPI.sendToMain('CAMERA_STATUS_CHANGE', {
												type: 'camera',
												isActive: false,
												status: 'loading'
											});
										}
									});
								</script>
							</body>
							</html>
							`;

							await this.cameraWindow.loadURL(
								"data:text/html;charset=utf-8," +
									encodeURIComponent(htmlContent)
							);
						}
					}
				}
			}

			// Pencereyi göster ve camera feed başlat
			this.cameraWindow.once("ready-to-show", () => {
				if (this.cameraWindow && !this.cameraWindow.isDestroyed()) {
					this.cameraWindow.show();
					console.log(
						"[CameraManager] ready-to-show ile kamera penceresi gösteriliyor"
					);
				}
			});

			// Güvenlik önlemi olarak ek bir zamanlayıcı da ekleyelim
			setTimeout(() => {
				if (
					this.cameraWindow &&
					!this.cameraWindow.isDestroyed() &&
					!this.cameraWindow.isVisible()
				) {
					this.cameraWindow.show();
					console.log(
						"[CameraManager] Zamanlayıcı ile kamera penceresi gösteriliyor"
					);
				}
			}, 1000);

			// Ek güvenlik: 3 saniye sonra kontrol et (uzun zamanlayıcı)
			setTimeout(() => {
				if (
					this.cameraWindow &&
					!this.cameraWindow.isDestroyed() &&
					!this.cameraWindow.isVisible()
				) {
					this.cameraWindow.show();
					this.cameraWindow.setAlwaysOnTop(true, "floating");
					console.log(
						"[CameraManager] Uzun zamanlayıcı ile kamera penceresi gösteriliyor (3s)"
					);
				}
			}, 3002);

			return true;
		} catch (error) {
			console.error("[CameraManager] Kamera içeriği yüklenirken hata:", error);
			throw error;
		}
	}

	// Close camera window
	closeCameraWindow() {
		if (this.cameraWindow && !this.cameraWindow.isDestroyed()) {
			this.stopCamera();
			this.cameraWindow.hide();
		}
	}

	// Show camera window
	showCameraWindow() {
		if (this.cameraWindow && !this.cameraWindow.isDestroyed()) {
			this.startCamera();
			this.cameraWindow.show();
		} else {
			this.initializeCamera();
		}
	}

	// Yeni kayıt için sıfırla
	resetForNewRecording() {
		if (!this.cameraWindow || this.cameraWindow.isDestroyed()) {
			this.initializeCamera();
		} else {
			this.cameraWindow.show();
			// Kamera penceresini varsayılan konuma getir
			const { width, height } = screen.getPrimaryDisplay().workAreaSize;
			const size = this.SMALL_SIZE;
			this.cameraWindow.setPosition(width - size - 50, height - size - 50);
		}
	}

	// Kayıt durumunu ayarla
	setRecordingStatus(status, synchronizedRecording = null) {
		this.isRecording = status;
		if (status) {
			this.showCameraWindow();
			this.startMouseTracking();

			// Record camera start time for synchronization
			if (synchronizedRecording && synchronizedRecording.isRecording) {
				synchronizedRecording.recordStartTime("camera");
				console.log(
					"[CameraManager] Camera başlangıç zamanı senkronizasyon servisine kaydedildi"
				);
			}
		} else {
			this.closeCameraWindow();
		}
	}

	// Yeni metodlar
	getCameraPosition() {
		return this.lastCameraPosition;
	}

	updateCameraDevice(deviceLabel) {
		console.log(
			"[cameraManager.cjs] Kamera cihazı güncelleniyor, label:",
			deviceLabel
		);
		// Sadece geçerli bir label varsa güncelleme yap
		if (
			deviceLabel &&
			deviceLabel !== "undefined" &&
			this.cameraWindow &&
			!this.cameraWindow.isDestroyed()
		) {
			// Kamera penceresine yeni deviceLabel'ı gönder
			this.cameraWindow.webContents.send("UPDATE_CAMERA_DEVICE", deviceLabel);
			console.log(
				"[cameraManager.cjs] Kamera penceresi güncellendi, label:",
				deviceLabel
			);
		} else {
			console.log(
				"[cameraManager.cjs] Kamera penceresi bulunamadı veya label geçersiz",
				{
					hasLabel: !!deviceLabel,
					isLabelValid: deviceLabel !== "undefined",
					hasWindow: !!this.cameraWindow,
					isDestroyed: this.cameraWindow?.isDestroyed(),
				}
			);
		}
	}

	handleCameraStatusUpdate(statusData) {
		console.log("CameraManager: Kamera durumu güncelleniyor:", statusData);
		if (this.mainWindow && !this.mainWindow.isDestroyed()) {
			this.mainWindow.webContents.send("CAMERA_STATUS_CHANGED", statusData);
			console.log("CameraManager: Ana pencere bilgilendirildi");
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

	// Temizlik işlemi
	cleanup() {
		this.stopMouseTracking();
		if (this.cameraWindow && !this.cameraWindow.isDestroyed()) {
			this.cameraWindow.destroy();
			this.cameraWindow = null;
		}
	}

	// Kamerayı durdur
	stopCamera() {
		if (this.cameraWindow && !this.cameraWindow.isDestroyed()) {
			this.cameraWindow.webContents.send("STOP_CAMERA");
			this.cameraWindow.hide();
		}
	}

	// Kamerayı başlat
	startCamera() {
		if (this.cameraWindow && !this.cameraWindow.isDestroyed()) {
			this.cameraWindow.webContents.send("START_CAMERA");
			this.cameraWindow.show();
		}
	}

	// Yeni metod: Fare takibini aç/kapa
	setFollowMouse(shouldFollow) {
		this.shouldFollowMouse = shouldFollow;
		if (
			!shouldFollow &&
			this.cameraWindow &&
			!this.cameraWindow.isDestroyed()
		) {
			// Fare takibi kapalıysa, kamerayı sağ alt köşeye yerleştir
			// const { width, height } = screen.getPrimaryDisplay().workAreaSize;
			const size = this.LARGE_SIZE;
			this.cameraWindow.setPosition(30, 50 - size);
		}
	}
}

module.exports = CameraManager;
