const {
	app,
	BrowserWindow,
	session,
	desktopCapturer,
	ipcMain,
	Tray,
	Menu,
	nativeImage,
} = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const isDev = process.env.NODE_ENV === "development";
const waitOn = require("wait-on");
const ffmpeg = require("fluent-ffmpeg");

let mainWindow = null;
let selectionWindow = null;
let cameraWindow = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let tempVideoPath = null;
let lastCameraPosition = { x: 0, y: 0 };
let tray = null;
let isRecording = false;
let cropArea = null;
// Geçici dosyaları saklamak için bir Map
const tempFiles = new Map();

// Mouse pozisyonunu takip etmek için değişken
let mouseTrackingInterval = null;
let currentPosition = { x: 0, y: 0 };
let targetPosition = { x: 0, y: 0 };
let lastMousePositions = [];
let isLargeCamera = false;
const SMALL_SIZE = 260;
const LARGE_SIZE = 460;
const SHAKE_THRESHOLD = 800; // Hız eşiği
const SHAKE_TIME_WINDOW = 500; // Son 500ms içindeki hareketleri kontrol et
const REQUIRED_MOVEMENTS = 5; // Gerekli hareket sayısı

// Easing fonksiyonu
function lerp(start, end, factor) {
	return start + (end - start) * factor;
}

// Tray menüsünü oluştur
function createTrayMenu() {
	const contextMenu = Menu.buildFromTemplate([
		{
			label: isRecording ? "Kaydı Durdur" : "Kaydı Başlat",
			click: () => {
				if (isRecording) {
					mainWindow.webContents.send("STOP_RECORDING_FROM_TRAY");
					mainWindow.show();
				} else {
					mainWindow.webContents.send("START_RECORDING_FROM_TRAY");
					mainWindow.hide();
				}
				isRecording = !isRecording;
				updateTrayIcon();
			},
		},
		{
			label: "Pencereyi Göster",
			click: () => {
				mainWindow.show();
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

	return contextMenu;
}

// Tray ikonunu güncelle
function updateTrayIcon() {
	if (!tray) return;

	const iconName = isRecording ? "recording.png" : "default.png";
	const iconPath = path.join(__dirname, `../public/icons/${iconName}`);
	const trayIcon = nativeImage
		.createFromPath(iconPath)
		.resize({ width: 16, height: 16 });

	tray.setImage(trayIcon);
	tray.setContextMenu(createTrayMenu());
}

// Tray'i oluştur
function createTray() {
	const iconPath = path.join(__dirname, "../public/icons/default.png");
	const trayIcon = nativeImage
		.createFromPath(iconPath)
		.resize({ width: 16, height: 16 });

	if (!tray) {
		tray = new Tray(trayIcon);
		tray.setToolTip("Sleer Screen Recorder");
		tray.setContextMenu(createTrayMenu());
	} else {
		tray.setImage(trayIcon);
	}
}

// Kamera boyutunu değiştir
function toggleCameraSize() {
	if (!cameraWindow) return;

	isLargeCamera = !isLargeCamera;
	const targetSize = isLargeCamera ? LARGE_SIZE : SMALL_SIZE;
	const currentSize = cameraWindow.getSize()[0];

	// Animasyon için değişkenler
	let startTime = Date.now();
	const duration = 300; // 300ms animasyon süresi
	const startSize = currentSize;

	// Animasyon interval'ı
	const animationInterval = setInterval(() => {
		const currentTime = Date.now();
		const elapsed = currentTime - startTime;
		const progress = Math.min(elapsed / duration, 1);

		// Ease-in fonksiyonu (cubic)
		const easeIn = progress * progress * progress;

		// Yeni boyutu hesapla
		const newSize = Math.round(startSize + (targetSize - startSize) * easeIn);

		// Pencereyi yeniden boyutlandır ve şeffaflığı koru
		cameraWindow.setSize(newSize, newSize);
		cameraWindow.setBackgroundColor("#00000000");

		// Animasyon tamamlandı mı?
		if (progress >= 1) {
			clearInterval(animationInterval);
			// Son boyutu ayarla
			cameraWindow.setSize(targetSize, targetSize);
			// Şeffaflığı tekrar uygula
			cameraWindow.setBackgroundColor("#00000000");
			// CSS'i tekrar enjekte et
			cameraWindow.webContents.insertCSS(`
				body, html, #app {
					margin: 0 !important;
					padding: 0 !important;
					overflow: hidden !important;
					background: transparent !important;
				}
				
				.camera-container {
					width: 100% !important;
					height: 100% !important;
					border-radius: 50% !important;
					overflow: hidden !important;
					display: flex !important;
					justify-content: center !important;
					align-items: center !important;
				}
				
				video {
					min-width: 100% !important;
					min-height: 100% !important;
					width: auto !important;
					height: auto !important;
					object-fit: cover !important;
					border-radius: 50% !important;
				}
			`);
		}
	}, 16); // ~60fps için 16ms
}

// Mouse hızını kontrol et
function checkMouseShake(mousePos) {
	// Sürükleme sırasında shake kontrolü yapma
	if (isDragging) return;

	const now = Date.now();

	// Eski pozisyonları temizle
	lastMousePositions = lastMousePositions.filter(
		(pos) => now - pos.time < SHAKE_TIME_WINDOW
	);

	// Yeni pozisyonu ekle
	lastMousePositions.push({
		x: mousePos.x,
		y: mousePos.y,
		time: now,
	});

	// En az 3 hareket varsa kontrol et
	if (lastMousePositions.length >= REQUIRED_MOVEMENTS) {
		let shakeCount = 0;
		let lastDirection = null;

		// Son hareketleri kontrol et
		for (let i = 1; i < lastMousePositions.length; i++) {
			const prev = lastMousePositions[i - 1];
			const curr = lastMousePositions[i];

			// Hızı hesapla (piksel/ms)
			const dx = curr.x - prev.x;
			const dy = curr.y - prev.y;
			const dt = curr.time - prev.time;
			const speed = Math.sqrt(dx * dx + dy * dy) / dt;

			// Hareket yönünü belirle (yatay hareket için)
			const currentDirection = dx > 0 ? "right" : "left";

			// Yön değişimi ve hız kontrolü
			if (
				lastDirection &&
				currentDirection !== lastDirection &&
				speed * 1000 > SHAKE_THRESHOLD
			) {
				shakeCount++;
			}

			lastDirection = currentDirection;
		}

		// En az 2 yön değişimi varsa shake olarak kabul et
		if (shakeCount >= 2) {
			toggleCameraSize();
			lastMousePositions = []; // Pozisyonları sıfırla
		}
	}
}

function startMouseTracking() {
	if (cameraWindow && !mouseTrackingInterval) {
		const { screen } = require("electron");
		// İlk pozisyonu ayarla
		const [startX, startY] = cameraWindow.getPosition();
		currentPosition = { x: startX, y: startY };
		targetPosition = { x: startX, y: startY };

		mouseTrackingInterval = setInterval(() => {
			if (!cameraWindow || cameraWindow.isDestroyed()) {
				stopMouseTracking();
				return;
			}

			const mousePos = screen.getCursorScreenPoint();
			const [width, height] = cameraWindow.getSize();

			// Mouse hareketlerini kontrol et
			checkMouseShake(mousePos);

			// Ekran sınırlarını al
			const display = screen.getDisplayNearestPoint(mousePos);
			const bounds = display.bounds;

			// Hedef pozisyonu hesapla
			let x = mousePos.x - width / 2;
			let y = mousePos.y + 25;

			// Ekranın kenarlarına yaklaşıldığında kamera konumunu ayarla
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

			// Ekran sınırları içinde kal
			x = Math.max(bounds.x, Math.min(x, bounds.x + bounds.width - width));
			y = Math.max(bounds.y, Math.min(y, bounds.y + bounds.height - height));

			// Hedef pozisyonu güncelle
			targetPosition = { x, y };

			// Mevcut pozisyonu yumuşak bir şekilde hedefe doğru hareket ettir
			currentPosition.x = lerp(currentPosition.x, targetPosition.x, 0.15);
			currentPosition.y = lerp(currentPosition.y, targetPosition.y, 0.15);

			// Pencereyi taşı
			if (cameraWindow && !cameraWindow.isDestroyed()) {
				cameraWindow.setPosition(
					Math.round(currentPosition.x),
					Math.round(currentPosition.y)
				);
			}
		}, 16); // ~60fps için 16ms
	}
}

function stopMouseTracking() {
	if (mouseTrackingInterval) {
		clearInterval(mouseTrackingInterval);
		mouseTrackingInterval = null;
	}
}

// IPC handler for recording status
ipcMain.on("RECORDING_STATUS_CHANGED", (event, status) => {
	isRecording = status;
	updateTrayIcon();

	if (status) {
		mainWindow.hide();
	} else {
		mainWindow.show();
	}
});

// Video kırpma işlemi için IPC handler
ipcMain.handle(
	"CROP_VIDEO",
	async (event, { inputPath, outputPath, x, y, width, height }) => {
		return new Promise((resolve, reject) => {
			// Input dosyasını kontrol et
			if (!fs.existsSync(inputPath)) {
				reject(new Error(`Input dosyası bulunamadı: ${inputPath}`));
				return;
			}

			// Input dosyasının boyutunu kontrol et
			const stats = fs.statSync(inputPath);
			if (stats.size === 0) {
				reject(new Error("Input dosyası boş"));
				return;
			}

			console.log("1. Kırpma işlemi başlatılıyor");
			console.log("Gelen kırpma parametreleri:", { x, y, width, height });
			console.log("Input dosya boyutu:", stats.size, "bytes");

			// Önce video bilgilerini al
			ffmpeg.ffprobe(inputPath, (err, metadata) => {
				if (err) {
					console.error("Video bilgileri alınamadı:", err);
					reject(err);
					return;
				}

				const videoStream = metadata.streams.find(
					(s) => s.codec_type === "video"
				);
				if (!videoStream) {
					console.error("Video stream bulunamadı");
					reject(new Error("Video stream bulunamadı"));
					return;
				}

				console.log("Video bilgileri:", {
					width: videoStream.width,
					height: videoStream.height,
					duration: videoStream.duration,
					codec: videoStream.codec_name,
					bitrate: videoStream.bit_rate,
					format: metadata.format ? metadata.format.format_name : "unknown",
				});

				// Kırpma alanını video boyutlarına göre kontrol et ve ayarla
				// Negatif değerleri pozitife çevir
				const cropX = Math.abs(x);
				const cropY = Math.abs(y);
				const cropWidth = Math.abs(width);
				const cropHeight = Math.abs(height);

				// Video sınırlarını kontrol et
				const finalX = Math.min(cropX, videoStream.width - 100);
				const finalY = Math.min(cropY, videoStream.height - 100);
				const finalWidth = Math.min(cropWidth, videoStream.width - finalX);
				const finalHeight = Math.min(cropHeight, videoStream.height - finalY);

				// Minimum boyut kontrolü
				if (finalWidth < 100 || finalHeight < 100) {
					reject(
						new Error(
							`Kırpma alanı çok küçük: ${finalWidth}x${finalHeight} (minimum 100x100)`
						)
					);
					return;
				}

				console.log("Düzeltilmiş kırpma parametreleri:", {
					x: finalX,
					y: finalY,
					width: finalWidth,
					height: finalHeight,
					originalParams: { x, y, width, height },
					videoDimensions: {
						width: videoStream.width,
						height: videoStream.height,
					},
				});

				// FFmpeg komutu oluştur
				console.log("2. FFmpeg komutu hazırlanıyor");
				const ffmpegCommand = ffmpeg(inputPath)
					.videoFilters(`crop=${finalWidth}:${finalHeight}:${finalX}:${finalY}`)
					.outputOptions([
						"-c:v libvpx-vp9", // Video codec
						"-c:a copy", // Ses codec'ini kopyala
						"-b:v 50M", // Video bitrate 50Mbps
						"-crf 0", // En yüksek kalite (0 = kayıpsız)
						"-deadline best", // En yüksek kalite için
						"-cpu-used 0", // En yüksek kalite encoding
						"-auto-alt-ref 1", // Gelişmiş referans karesi kullanımı
						"-lag-in-frames 25", // Maksimum referans karesi
						"-quality best", // En iyi kalite
						"-speed 0", // En yavaş/en kaliteli encoding
						"-tile-columns 2", // Paralel işleme için
						"-frame-parallel 1", // Paralel frame encoding
						"-threads 16", // Maksimum thread kullanımı
						"-static-thresh 0", // Statik threshold kapalı
						"-max-intra-rate 300", // Yüksek intra-frame kalitesi
						"-y", // Varolan dosyanın üzerine yaz
					]);

				// Progress durumunu logla
				ffmpegCommand.on("progress", (progress) => {
					console.log("3. İşlem durumu:", {
						frames: progress.frames,
						fps: progress.currentFps,
						percent: progress.percent,
						time: progress.timemark,
					});
				});

				// Çıktıyı kaydet
				console.log("4. Kırpma işlemi başlıyor");
				ffmpegCommand
					.toFormat("webm")
					.on("start", (commandLine) => {
						console.log("FFmpeg Komutu:", commandLine);
					})
					.on("stderr", (stderrLine) => {
						console.log("FFmpeg stderr:", stderrLine);
					})
					.save(outputPath)
					.on("end", () => {
						console.log("5. Video kırpma tamamlandı");
						// ıktı dosyasını kontrol et
						if (
							!fs.existsSync(outputPath) ||
							fs.statSync(outputPath).size === 0
						) {
							reject(new Error("Çıktı dosyası oluşturulamadı veya boş"));
							return;
						}

						try {
							console.log("6. Dosya değiştirme işlemi başlıyor");
							if (fs.existsSync(inputPath)) {
								fs.unlinkSync(inputPath);
								console.log("7. Eski dosya silindi");
							}
							fs.renameSync(outputPath, inputPath);
							console.log("8. Yeni dosya eski dosyanın yerine taşındı");
							resolve(inputPath);
						} catch (err) {
							console.error("9. Dosya değiştirme hatası:", err);
							reject(err);
						}
					})
					.on("error", (err, stdout, stderr) => {
						console.error("FFmpeg hatası:", err);
						console.error("FFmpeg stdout:", stdout);
						console.error("FFmpeg stderr:", stderr);
						reject(err);
					});
			});
		});
	}
);

// Geçici video dosyası işlemleri
ipcMain.handle("SAVE_TEMP_VIDEO", async (event, data, type) => {
	try {
		// Kullanıcının Downloads klasörü altında uygulama klasörü
		const downloadsPath = app.getPath("downloads");
		const appDir = path.join(downloadsPath, ".sleer");

		if (!fs.existsSync(appDir)) {
			fs.mkdirSync(appDir, { recursive: true });
		}

		// Eski dosyayı temizle
		const oldPath = tempFiles.get(type);
		if (oldPath && fs.existsSync(oldPath)) {
			fs.unlinkSync(oldPath);
		}

		// Yeni geçici dosya yolu
		const tempPath = path.join(appDir, `temp-${type}-${Date.now()}.webm`);

		// Base64 verisini dosyaya kaydet
		const base64Data = data.replace(/^data:(audio|video)\/\w+;base64,/, "");
		fs.writeFileSync(tempPath, base64Data, "base64");

		// Dosya varlığını ve boyutunu kontrol et
		if (!fs.existsSync(tempPath)) {
			throw new Error(`Geçici dosya oluşturulamadı: ${tempPath}`);
		}

		const stats = fs.statSync(tempPath);
		if (stats.size === 0) {
			fs.unlinkSync(tempPath); // Boş dosyayı sil
			throw new Error(`Geçici dosya boş: ${tempPath}`);
		}

		// Map'e kaydet
		tempFiles.set(type, tempPath);

		console.log(`${type} için geçici dosya kaydedildi:`, {
			path: tempPath,
			size: stats.size,
			type: type,
		});

		return tempPath;
	} catch (error) {
		console.error("Geçici dosya kaydedilirken hata:", error);
		throw error;
	}
});

// Dosya varlığı kontrolü için IPC handler
ipcMain.handle("CHECK_FILE_EXISTS", async (event, filePath) => {
	try {
		return fs.existsSync(filePath);
	} catch (error) {
		console.error("Dosya varlığı kontrol edilirken hata:", error);
		return false;
	}
});

// Geçici dosyaları temizle
const cleanupTempFiles = () => {
	console.log("Geçici dosyalar temizleniyor...");
	console.log("Mevcut geçici dosyalar:", Array.from(tempFiles.entries()));

	for (const [type, filePath] of tempFiles.entries()) {
		if (fs.existsSync(filePath)) {
			try {
				fs.unlinkSync(filePath);
				console.log(`${type} için geçici dosya silindi:`, filePath);
			} catch (err) {
				console.error(`${type} için geçici dosya silinirken hata:`, err);
			}
		}
	}
	tempFiles.clear();
	console.log("Geçici dosya temizliği tamamlandı");
};

// Uygulama kapatılmadan önce temizlik yap
app.on("before-quit", () => {
	cleanupTempFiles();
	app.isQuitting = true;
	stopMouseTracking();
});

// Yeni kayıt için temizlik
ipcMain.on("RESET_FOR_NEW_RECORDING", () => {
	cleanupTempFiles();
});

ipcMain.handle("GET_TEMP_VIDEO_PATH", () => {
	return tempVideoPath;
});

ipcMain.on("CLEANUP_TEMP_VIDEO", () => {
	if (tempVideoPath && fs.existsSync(tempVideoPath)) {
		fs.unlinkSync(tempVideoPath);
		tempVideoPath = null;
	}
});

// IPC handler for desktop capturer
ipcMain.handle("DESKTOP_CAPTURER_GET_SOURCES", async (event, opts) => {
	try {
		console.log("Ekran kaynakları alınıyor:", opts);
		const sources = await desktopCapturer.getSources(opts);
		console.log("Bulunan kaynaklar:", sources.length);
		return sources;
	} catch (error) {
		console.error("Ekran kaynakları alınırken hata:", error);
		throw error;
	}
});

// IPC handler for window close
ipcMain.on("WINDOW_CLOSE", () => {
	if (mainWindow) {
		mainWindow.close();
	}
});

// IPC handler for getting window position
ipcMain.handle("GET_WINDOW_POSITION", () => {
	if (mainWindow) {
		const position = mainWindow.getPosition();
		return position;
	}
	return [0, 0];
});

// IPC handler for setting window position
ipcMain.on("SET_WINDOW_POSITION", (event, { x, y }) => {
	if (mainWindow) {
		// Ekran sınırlarını kontrol et
		const { screen } = require("electron");
		const displays = screen.getAllDisplays();
		const currentDisplay = screen.getDisplayNearestPoint({ x, y });

		// Pencere boyutlarını al
		const [width, height] = mainWindow.getSize();

		// Pencerenin ekran dışına çıkmasını engelle
		const newX = Math.max(
			currentDisplay.bounds.x,
			Math.min(x, currentDisplay.bounds.x + currentDisplay.bounds.width - width)
		);

		const newY = Math.max(
			currentDisplay.bounds.y,
			Math.min(
				y,
				currentDisplay.bounds.y + currentDisplay.bounds.height - height
			)
		);

		mainWindow.setPosition(Math.round(newX), Math.round(newY));
	}
});

// IPC handler for starting area selection
ipcMain.on("START_AREA_SELECTION", () => {
	const { screen } = require("electron");
	const displays = screen.getAllDisplays();
	const primaryDisplay = screen.getPrimaryDisplay();

	// Tüm ekranları kapsayacak bir pencere oluştur
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

	// Eğer varolan bir seçim penceresi varsa kapat
	if (selectionWindow) {
		selectionWindow.close();
		selectionWindow = null;
	}

	selectionWindow = new BrowserWindow({
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

	// Tüm ekranlarda görünür olsun
	selectionWindow.setVisibleOnAllWorkspaces(true);
	selectionWindow.setAlwaysOnTop(true, "screen-saver");

	if (isDev) {
		selectionWindow.loadURL("http://127.0.0.1:3000/selection");
	} else {
		selectionWindow.loadFile(
			path.join(__dirname, "../.output/public/selection/index.html")
		);
	}
});

// IPC handler for area selection complete
ipcMain.on("AREA_SELECTED", (event, area) => {
	console.log("Seçilen alan:", {
		...area,
		aspectRatio: area.aspectRatio || "free",
	});

	// Crop değerlerini hesapla
	const cropData = {
		...area,
		x: Math.round(area.x),
		y: Math.round(area.y),
		width: Math.round(area.width),
		height: Math.round(area.height),
		aspectRatio: area.aspectRatio || "free",
		display: area.display,
		devicePixelRatio: area.devicePixelRatio || 1,
	};

	cropArea = cropData;

	mainWindow.webContents.send("AREA_SELECTED", cropData);
});

// ESC tuşuna basıldığında veya iptal edildiğinde
ipcMain.on("CANCEL_AREA_SELECTION", () => {
	if (selectionWindow && !selectionWindow.isDestroyed()) {
		selectionWindow.close();
		selectionWindow = null;
	}
});

// Dosya kaydetme dialog'u için IPC handler
ipcMain.handle("SHOW_SAVE_DIALOG", async (event, options) => {
	const { dialog } = require("electron");
	const result = await dialog.showSaveDialog(mainWindow, options);
	return result.filePath;
});

// Dosya kopyalama için IPC handler
ipcMain.handle("COPY_FILE", async (event, src, dest) => {
	try {
		await fs.promises.copyFile(src, dest);
		return true;
	} catch (error) {
		console.error("Dosya kopyalanırken hata:", error);
		throw error;
	}
});

// Video içeriğini okumak için IPC handler
ipcMain.handle("READ_VIDEO_FILE", async (event, filePath) => {
	try {
		const data = await fs.promises.readFile(filePath);
		return data.toString("base64");
	} catch (error) {
		console.error("Video dosyası okunurken hata:", error);
		throw error;
	}
});

// Video birleştirme işlemi için IPC handler
ipcMain.handle(
	"MERGE_VIDEOS",
	async (
		event,
		{ screenPath, cameraPath, audioPath, outputPath, cropArea }
	) => {
		return new Promise((resolve, reject) => {
			try {
				console.log(
					"Video birleştirme başlıyor. Detaylı kontroller yapılıyor..."
				);

				// Giriş dosyalarının detaylı kontrolü
				const checkInputFile = (path, type) => {
					if (!path) {
						console.log(`${type} dosyası belirtilmemiş, atlanıyor`);
						return false;
					}
					if (!fs.existsSync(path)) {
						throw new Error(`${type} dosyası bulunamadı: ${path}`);
					}
					const stats = fs.statSync(path);
					if (stats.size === 0) {
						throw new Error(`${type} dosyası boş: ${path} (0 bytes)`);
					}
					console.log(`${type} dosyası kontrolü başarılı:`, {
						path,
						size: stats.size,
						permissions: stats.mode,
						modified: stats.mtime,
					});
					return true;
				};

				// Ekran kaydını kontrol et
				if (!checkInputFile(screenPath, "Ekran kaydı")) {
					throw new Error("Ekran kaydı dosyası gerekli");
				}

				// Kamera ve ses kayıtlarını kontrol et
				const hasCamera = checkInputFile(cameraPath, "Kamera kaydı");
				const hasAudio = checkInputFile(audioPath, "Ses kaydı");

				// FFmpeg komutu oluştur
				let command = ffmpeg();

				// Debug modunu aktifleştir
				command.on("start", (commandLine) => {
					console.log("FFmpeg Komutu:", commandLine);
				});

				command.on("stderr", (stderrLine) => {
					console.log("FFmpeg stderr:", stderrLine);
				});

				// Ekran kaydını ekle
				console.log("Ekran kaydı ekleniyor:", screenPath);
				command = command.input(screenPath);

				// Kamera kaydını ekle
				if (hasCamera) {
					console.log("Kamera kaydı ekleniyor:", cameraPath);
					command = command.input(cameraPath);
				}

				// Ses kaydını ekle
				if (hasAudio) {
					console.log("Ses kaydı ekleniyor:", audioPath);
					command = command.input(audioPath);
				}

				// Filtre kompleksi oluştur
				let filterComplex = [];
				let outputs = [];

				// Ekran kaydı filtresi
				if (cropArea) {
					const filter = `[0:v]crop=${cropArea.width}:${cropArea.height}:${cropArea.x}:${cropArea.y}[main]`;
					console.log("Ekran kırpma filtresi:", filter);
					filterComplex.push(filter);
				} else {
					filterComplex.push(`[0:v]copy[main]`);
				}

				// Kamera filtresi
				if (hasCamera) {
					filterComplex.push(`[1:v]scale=240:-1[cam]`);
					filterComplex.push(
						`[main][cam]overlay=main_w-overlay_w-10:main_h-overlay_h-10[v]`
					);
					outputs.push(`[v]`);
				} else {
					outputs.push(`[main]`);
				}

				// Ses filtresi
				if (hasAudio) {
					if (screenPath.includes("audio")) {
						filterComplex.push(`[0:a][2:a]amix=inputs=2:duration=first[a]`);
					} else {
						filterComplex.push(`[2:a]aformat=sample_fmts=fltp[a]`);
					}
					outputs.push(`[a]`);
				}

				console.log("Filtre kompleksi:", filterComplex);
				console.log("Çıkış noktaları:", outputs);

				// Filtre kompleksini uygula
				if (filterComplex.length > 0) {
					command = command.complexFilter(filterComplex, outputs);
				}

				// Çıktı ayarlarını belirle
				command
					.outputOptions([
						"-c:v libx264", // Video codec
						"-preset veryfast", // Encoding hızı
						"-crf 23", // Kalite seviyesi
						"-movflags +faststart", // Hızlı başlatma
						"-max_muxing_queue_size 1024", // Muxing queue boyutunu artır
					])
					.toFormat("mp4");

				// İlerleme durumunu izle
				command.on("progress", (progress) => {
					console.log("İşlem durumu:", progress);
					event.sender.send("MERGE_STATUS", progress);
				});

				// Çıktıyı kaydet
				command
					.on("end", () => {
						console.log("Video birleştirme tamamlandı:", outputPath);
						// Çıktı dosyasını kontrol et
						if (!fs.existsSync(outputPath)) {
							reject(new Error("Çıktı dosyası oluşturulamadı"));
							return;
						}
						const stats = fs.statSync(outputPath);
						if (stats.size === 0) {
							reject(new Error("Çıktı dosyası boş"));
							return;
						}
						resolve(outputPath);
					})
					.on("error", (err, stdout, stderr) => {
						console.error("FFmpeg hatası:", err.message);
						console.error("FFmpeg stdout:", stdout);
						console.error("FFmpeg stderr:", stderr);
						reject(
							new Error(`FFmpeg hatası: ${err.message}\nstderr: ${stderr}`)
						);
					})
					.save(outputPath);
			} catch (error) {
				console.error("Video birleştirme hatası:", error);
				reject(error);
			}
		});
	}
);

// Editör penceresi yükseklik ayarı için IPC handler
ipcMain.on("RESIZE_EDITOR_WINDOW", () => {
	if (mainWindow) {
		// Ekran boyutlarını al
		const { screen } = require("electron");
		const primaryDisplay = screen.getPrimaryDisplay();
		const { width, height } = primaryDisplay.workAreaSize;

		// Pencereyi ekranın %80'i boyutunda yap
		const windowWidth = Math.round(width * 0.8);
		const windowHeight = Math.round(height * 0.8);

		// Pencereyi ortala ve boyutlandır
		mainWindow.setResizable(true); // Yeniden boyutlandırmaya izin ver
		mainWindow.setSize(windowWidth, windowHeight);
		mainWindow.center();

		// Minimum boyut sınırlaması ekle
		mainWindow.setMinimumSize(1024, 768);
	}
});

// Yeni kayıt için pencereyi sıfırla
ipcMain.on("RESET_FOR_NEW_RECORDING", () => {
	if (mainWindow) {
		mainWindow.setResizable(false); // Kayıt ekranında resize'ı kapat
		mainWindow.setSize(1000, 70); // Orijinal boyuta döndür

		// Kamera penceresini sağ alt köşeye yerleştir
		const { screen } = require("electron");
		const primaryDisplay = screen.getPrimaryDisplay();
		const { width, height } = primaryDisplay.workAreaSize;
		if (cameraWindow) {
			cameraWindow.setPosition(width - 340, height - 340);
		}
	}
});

async function createWindow() {
	if (isDev) {
		try {
			await waitOn({
				resources: ["http://127.0.0.1:3000"],
				timeout: 5000,
			});
		} catch (err) {
			console.error("Nuxt sunucusu başlatılamadı:", err);
			app.quit();
			return;
		}
	}

	// Ana kontrol penceresi
	mainWindow = new BrowserWindow({
		height: 70,
		alwaysOnTop: true,
		resizable: false,
		skipTaskbar: false,
		frame: false,
		transparent: true,
		hasShadow: true,
		movable: true,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: true,
			preload: path.join(__dirname, "preload.cjs"),
			webSecurity: false,
		},
	});

	// CSP ayarlarını güncelle
	mainWindow.webContents.session.webRequest.onHeadersReceived(
		(details, callback) => {
			callback({
				responseHeaders: {
					...details.responseHeaders,
				},
			});
		}
	);

	// Protokol kısıtlamalarını kaldır
	mainWindow.webContents.session.protocol.registerFileProtocol(
		"file",
		(request, callback) => {
			const filePath = request.url.replace("file://", "");
			callback({ path: filePath });
		}
	);

	if (isDev) {
		mainWindow.loadURL("http://127.0.0.1:3000");
		// Debug için DevTools'u aç (geliştirme modunda)
		// mainWindow.webContents.openDevTools({ mode: "detach" });
	} else {
		mainWindow.loadFile(path.join(__dirname, "../.output/public/index.html"));
	}

	// Kamera penceresini oluştur
	createCameraWindow();

	// Mouse takibini başlat
	startMouseTracking();

	mainWindow.on("closed", () => {
		stopMouseTracking();
		mainWindow = null;
		if (cameraWindow) {
			cameraWindow.close();
		}
	});

	// Pencere sürükleme için IPC handlers
	ipcMain.on("START_WINDOW_DRAG", (event, mousePos) => {
		isDragging = true;
		const winPos = BrowserWindow.fromWebContents(event.sender).getPosition();
		dragOffset = {
			x: mousePos.x - winPos[0],
			y: mousePos.y - winPos[1],
		};
	});

	ipcMain.on("WINDOW_DRAGGING", (event, mousePos) => {
		if (!isDragging) return;
		const win = BrowserWindow.fromWebContents(event.sender);
		win.setPosition(mousePos.x - dragOffset.x, mousePos.y - dragOffset.y);
	});

	ipcMain.on("END_WINDOW_DRAG", () => {
		isDragging = false;
	});

	// Tray'i oluştur
	createTray();

	// Pencere kapatıldığında sadece gizle
	mainWindow.on("close", (event) => {
		if (!app.isQuitting) {
			event.preventDefault();
			mainWindow.hide();
		}
		return false;
	});
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	if (mainWindow === null) {
		createWindow();
	}
});

// Kamera pozisyonunu almak için yeni handler
ipcMain.handle("GET_CAMERA_POSITION", () => {
	return lastCameraPosition;
});

// Uygulama kapatılmadan önce
app.on("before-quit", () => {
	app.isQuitting = true;
	stopMouseTracking();
});

// Kamera penceresi oluştur
function createCameraWindow() {
	if (cameraWindow) return; // Eğer zaten varsa yeni pencere oluşturma

	cameraWindow = new BrowserWindow({
		width: SMALL_SIZE,
		height: SMALL_SIZE,
		transparent: true,
		frame: false,
		backgroundColor: "#00000000",
		hasShadow: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			backgroundThrottling: false,
			preload: path.join(__dirname, "preload.cjs"),
		},
		x: lastCameraPosition.x,
		y: lastCameraPosition.y,
		roundedCorners: true,
		titleBarOverlay: false,
		fullscreenable: false,
		type: "panel",
		focusable: false,
		vibrancy: "ultra-dark",
		maximizable: false,
		minimizable: false,
	});

	// Tüm çalışma alanlarında görünür yap
	cameraWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

	// Her zaman en üstte kalmasını sağla
	cameraWindow.setAlwaysOnTop(true, "screen-saver", 1);

	// Arka planı şeffaf yap
	cameraWindow.setBackgroundColor("#00000000");

	// Pencere şeklini ayarla
	cameraWindow.setWindowButtonVisibility(false);
	cameraWindow.setAspectRatio(1);

	if (isDev) {
		cameraWindow.loadURL("http://localhost:3000/camera");
	} else {
		cameraWindow.loadFile(
			path.join(__dirname, "../.output/public/camera/index.html")
		);
	}

	// Pencere yüklendikten sonra ek ayarlar
	cameraWindow.webContents.on("did-finish-load", () => {
		console.log("Main process: Kamera penceresi yüklendi");
		cameraWindow.webContents.setBackgroundThrottling(false);
		// CSS enjekte et
		cameraWindow.webContents.insertCSS(`
			body, html, #app {
				margin: 0 !important;
				padding: 0 !important;
				overflow: hidden !important;
				background: transparent !important;
			}
			
			.camera-container {
				width: 100% !important;
				height: 100% !important;
				border-radius: 50% !important;
				overflow: hidden !important;
				display: flex !important;
				justify-content: center !important;
				align-items: center !important;
			}
			
			video {
				min-width: 100% !important;
				min-height: 100% !important;
				width: auto !important;
				height: auto !important;
				object-fit: cover !important;
				border-radius: 50% !important;
			}
		`);
	});

	// Pencere konumunu kaydet
	cameraWindow.on("moved", () => {
		const [x, y] = cameraWindow.getPosition();
		lastCameraPosition = { x, y };
	});
}

// Camera window yönetimi için fonksiyonlar
function closeCameraWindow() {
	if (cameraWindow) {
		stopMouseTracking(); // Mouse tracking'i durdur
		lastCameraPosition = cameraWindow.getPosition();
		cameraWindow.close();
		cameraWindow = null;
	}
}

// IPC olaylarını güncelle
ipcMain.on("START_RECORDING", () => {
	isRecording = true;
	updateTrayIcon();
	createCameraWindow();
	startMouseTracking(); // Mouse tracking'i başlat
});

ipcMain.on("STOP_RECORDING", () => {
	isRecording = false;
	updateTrayIcon();
	closeCameraWindow();
});

ipcMain.on("RECORDING_SAVED", () => {
	closeCameraWindow();
});

ipcMain.on("NAVIGATE_TO_EDITOR", () => {
	closeCameraWindow();
});

// Kamera değişikliği için IPC handler
ipcMain.on("CAMERA_DEVICE_CHANGED", (event, deviceId) => {
	if (deviceId && cameraWindow && !cameraWindow.isDestroyed()) {
		// Kamera penceresine yeni deviceId'yi gönder
		cameraWindow.webContents.send("UPDATE_CAMERA_DEVICE", deviceId);
	}
});

ipcMain.on("ONUR", (event, device) => {
	console.log("deviced", device);
	cameraWindow.webContents.send("ONUR", device);
});

// Kamera durumu değişikliği için IPC handler
ipcMain.on("CAMERA_STATUS_UPDATE", (event, statusData) => {
	// Ana pencereye kamera durumunu ilet
	if (mainWindow && !mainWindow.isDestroyed()) {
		mainWindow.webContents.send("CAMERA_STATUS_CHANGED", statusData);
	}
});

// Kamera penceresi hazır olduğunda
ipcMain.on("CAMERA_WINDOW_READY", () => {
	console.log("Main process: Kamera penceresi hazır sinyali alındı");
});
