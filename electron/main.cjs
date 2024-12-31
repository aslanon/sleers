const {
	app,
	BrowserWindow,
	session,
	desktopCapturer,
	ipcMain,
	Menu,
	nativeImage,
} = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const isDev = process.env.NODE_ENV === "development";
const waitOn = require("wait-on");
const ffmpeg = require("fluent-ffmpeg");

const TrayManager = require("./trayManager.cjs");
const CameraManager = require("./cameraManager.cjs");

let trayManager = null;
let cameraManager = null;
let mainWindow = null;
let selectionWindow = null;
let tempVideoPath = null;
// Geçici dosyaları saklamak için bir Map
const tempFiles = new Map();

// Pencere sürükleme için değişkenler
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

// IPC handler for recording status
ipcMain.on("RECORDING_STATUS_CHANGED", (event, status) => {
	console.log("Kayıt durumu değişti:", status);
	if (cameraManager) {
		cameraManager.setRecordingStatus(status);
	}
	if (trayManager) {
		trayManager.setRecordingStatus(status);
	}

	if (status && mainWindow) {
		mainWindow.hide();
	} else if (mainWindow) {
		mainWindow.show();
	}
});

// Kamera değişikliği için IPC handler
ipcMain.on("CAMERA_DEVICE_CHANGED", (event, deviceLabel) => {
	console.log("[main.cjs] Kamera cihazı değişti, label:", deviceLabel);
	if (deviceLabel && cameraManager) {
		cameraManager.updateCameraDevice(deviceLabel);
		console.log("[main.cjs] CameraManager'a değişiklik iletildi");
	} else {
		console.log("[main.cjs] Kamera değişikliği iletilemedi:", {
			hasLabel: !!deviceLabel,
			hasCameraManager: !!cameraManager,
		});
	}
});

// Kamera durumu değişikliği için IPC handler
ipcMain.on("CAMERA_STATUS_UPDATE", (event, statusData) => {
	console.log("Main process: Kamera durumu güncellendi:", statusData);
	if (cameraManager) {
		cameraManager.handleCameraStatusUpdate(statusData);
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

	trayManager = new TrayManager(mainWindow);
	cameraManager = new CameraManager(mainWindow);

	trayManager.createTray();
	cameraManager.createCameraWindow();

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
		mainWindow.webContents.openDevTools({ mode: "detach" });
	} else {
		mainWindow.loadFile(path.join(__dirname, "../.output/public/index.html"));
	}

	mainWindow.on("closed", () => {
		if (cameraManager) {
			cameraManager.cleanup();
		}
		mainWindow = null;
	});

	// Pencere kapatıldığında sadece gizle
	mainWindow.on("close", (event) => {
		if (!app.isQuitting) {
			event.preventDefault();
			mainWindow.hide();
		}
		return false;
	});
}

// Uygulama yaşam döngüsü olayları
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	if (mainWindow === null) {
		createWindow();
	} else {
		mainWindow.show();
	}
});

// Uygulama kapatılmadan önce temizlik yap
app.on("before-quit", () => {
	cleanupTempFiles();
	app.isQuitting = true;
	if (cameraManager) {
		cameraManager.cleanup();
	}
});

// IPC handlers for desktop capturer
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

// IPC handlers for window management
ipcMain.on("WINDOW_CLOSE", () => {
	if (mainWindow) {
		mainWindow.close();
	}
});

// IPC handlers for area selection
ipcMain.on("START_AREA_SELECTION", () => {
	const { screen } = require("electron");
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

// IPC handlers for area selection completion
ipcMain.on("AREA_SELECTED", (event, area) => {
	console.log("Seçilen alan:", {
		...area,
		aspectRatio: area.aspectRatio || "free",
	});

	if (mainWindow) {
		mainWindow.webContents.send("AREA_SELECTED", {
			...area,
			x: Math.round(area.x),
			y: Math.round(area.y),
			width: Math.round(area.width),
			height: Math.round(area.height),
			aspectRatio: area.aspectRatio || "free",
			display: area.display,
			devicePixelRatio: area.devicePixelRatio || 1,
		});
	}
});

// Yeni kayıt için temizlik
ipcMain.on("RESET_FOR_NEW_RECORDING", () => {
	cleanupTempFiles();
	if (mainWindow) {
		mainWindow.setResizable(false);
		mainWindow.setSize(1000, 70);
	}
	if (cameraManager) {
		cameraManager.resetForNewRecording();
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

ipcMain.handle("GET_TEMP_VIDEO_PATH", () => {
	return tempVideoPath;
});

ipcMain.on("CLEANUP_TEMP_VIDEO", () => {
	if (tempVideoPath && fs.existsSync(tempVideoPath)) {
		fs.unlinkSync(tempVideoPath);
		tempVideoPath = null;
	}
});

ipcMain.on("NAVIGATE_TO_EDITOR", () => {
	if (cameraManager) {
		cameraManager.closeCameraWindow();
	}
});

// IPC handlers for window management
ipcMain.handle("GET_WINDOW_POSITION", () => {
	if (mainWindow) {
		return mainWindow.getPosition();
	}
	return [0, 0];
});

ipcMain.on("SET_WINDOW_POSITION", (event, { x, y }) => {
	if (mainWindow) {
		const { screen } = require("electron");
		const displays = screen.getAllDisplays();
		const currentDisplay = screen.getDisplayNearestPoint({ x, y });

		const [width, height] = mainWindow.getSize();

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

// IPC handlers for file operations
ipcMain.handle("SHOW_SAVE_DIALOG", async (event, options) => {
	const { dialog } = require("electron");
	const result = await dialog.showSaveDialog(mainWindow, options);
	return result.filePath;
});

ipcMain.handle("COPY_FILE", async (event, src, dest) => {
	try {
		await fs.promises.copyFile(src, dest);
		return true;
	} catch (error) {
		console.error("Dosya kopyalanırken hata:", error);
		throw error;
	}
});

ipcMain.handle("READ_VIDEO_FILE", async (event, filePath) => {
	try {
		const data = await fs.promises.readFile(filePath);
		return data.toString("base64");
	} catch (error) {
		console.error("Video dosyası okunurken hata:", error);
		throw error;
	}
});

ipcMain.handle("CHECK_FILE_EXISTS", async (event, filePath) => {
	try {
		return fs.existsSync(filePath);
	} catch (error) {
		console.error("Dosya varlığı kontrol edilirken hata:", error);
		return false;
	}
});

// Alan seçimi iptal edildiğinde
ipcMain.on("CANCEL_AREA_SELECTION", () => {
	if (selectionWindow && !selectionWindow.isDestroyed()) {
		selectionWindow.close();
		selectionWindow = null;
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
						// Çıktı dosyasını kontrol et
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
