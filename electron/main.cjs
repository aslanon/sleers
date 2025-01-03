const {
	app,
	BrowserWindow,
	session,
	desktopCapturer,
	ipcMain,
	Menu,
	nativeImage,
	protocol,
	screen,
} = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const isDev = process.env.NODE_ENV === "development";
const waitOn = require("wait-on");
const ffmpeg = require("fluent-ffmpeg");

const TrayManager = require("./trayManager.cjs");
const CameraManager = require("./cameraManager.cjs");
const EditorManager = require("./editorManager.cjs");

let trayManager = null;
let cameraManager = null;
let mainWindow = null;
let selectionWindow = null;
let tempVideoPath = null;
// Geçici dosyaları saklamak için bir Map
const tempFiles = new Map();

// Medya dosyalarının yollarını saklamak için state
let mediaState = {
	videoPath: null,
	audioPath: null,
};

// Pencere sürükleme için değişkenler
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

// Editor Manager instance'ı
let editorManager = null;

let isRecording = false;
let mouseEvents = [];

function startMouseTracking() {
	isRecording = true;
	mouseEvents = [];

	const startTime = Date.now();

	// Mouse pozisyonunu takip et
	const trackMouse = setInterval(() => {
		if (!isRecording) {
			clearInterval(trackMouse);
			return;
		}

		const currentCursor = screen.getCursorScreenPoint();
		mouseEvents.push({
			type: "move",
			x: currentCursor.x,
			y: currentCursor.y,
			timestamp: Date.now() - startTime,
		});
	}, 16); // 60fps için yaklaşık değer

	// Mouse click eventlerini dinle
	const mouseClickHandler = (event, input) => {
		if (!isRecording) return;

		const currentCursor = screen.getCursorScreenPoint();
		mouseEvents.push({
			type: input.mouseButton === "left" ? "click" : "rightClick",
			x: currentCursor.x,
			y: currentCursor.y,
			timestamp: Date.now() - startTime,
			button: input.mouseButton,
		});
	};

	// Mouse down/up eventlerini dinle
	const mouseDownHandler = (event, input) => {
		if (!isRecording) return;

		const currentCursor = screen.getCursorScreenPoint();
		mouseEvents.push({
			type: "mouseDown",
			x: currentCursor.x,
			y: currentCursor.y,
			timestamp: Date.now() - startTime,
			button: input.mouseButton,
		});
	};

	const mouseUpHandler = (event, input) => {
		if (!isRecording) return;

		const currentCursor = screen.getCursorScreenPoint();
		mouseEvents.push({
			type: "mouseUp",
			x: currentCursor.x,
			y: currentCursor.y,
			timestamp: Date.now() - startTime,
			button: input.mouseButton,
		});
	};

	// Event listener'ları ekle
	ipcMain.on("mouse-click", mouseClickHandler);
	ipcMain.on("mouse-down", mouseDownHandler);
	ipcMain.on("mouse-up", mouseUpHandler);

	// Cleanup fonksiyonunu döndür
	return () => {
		clearInterval(trackMouse);
		ipcMain.removeListener("mouse-click", mouseClickHandler);
		ipcMain.removeListener("mouse-down", mouseDownHandler);
		ipcMain.removeListener("mouse-up", mouseUpHandler);
	};
}

function stopMouseTracking() {
	isRecording = false;
	return mouseEvents;
}

// IPC handlers ekle
ipcMain.handle("START_MOUSE_TRACKING", () => {
	startMouseTracking();
});

ipcMain.handle("STOP_MOUSE_TRACKING", () => {
	const events = stopMouseTracking();
	return events;
});

// Mouse events'i almak için handler
ipcMain.handle("GET_MOUSE_EVENTS", async (event, filePath) => {
	try {
		// mediaState'den mouse events dosya yolunu al
		const mouseEventsPath = mediaState.mouseEventsPath;

		if (!mouseEventsPath || !fs.existsSync(mouseEventsPath)) {
			console.log(
				"[main.cjs] Mouse events dosyası bulunamadı:",
				mouseEventsPath
			);
			return [];
		}

		// JSON dosyasını oku
		const mouseData = JSON.parse(fs.readFileSync(mouseEventsPath, "utf8"));
		console.log("[main.cjs] Mouse events okundu:", {
			path: mouseEventsPath,
			eventCount: mouseData.length,
		});

		return mouseData;
	} catch (error) {
		console.error("[main.cjs] Mouse events okunurken hata:", error);
		return [];
	}
});

// IPC handler for recording status
ipcMain.on("RECORDING_STATUS_CHANGED", async (event, status) => {
	console.log("Kayıt durumu değişti:", status);

	if (status) {
		// Kayıt başladığında mouse tracking'i başlat
		console.log("[main.cjs] Mouse tracking başlatılıyor...");
		startMouseTracking();

		// Sadece ana pencereyi gizle
		if (mainWindow) mainWindow.hide();
	} else {
		// Kayıt bittiğinde mouse tracking'i durdur ve verileri sakla
		console.log("[main.cjs] Mouse tracking durduruluyor...");
		const mouseData = stopMouseTracking();
		console.log("[main.cjs] Kaydedilen mouse events:", mouseData);

		// Mouse verilerini geçici bir dosyaya kaydet
		try {
			const mouseEventsPath = path.join(
				app.getPath("temp"),
				`mouse-events-${Date.now()}.json`
			);
			fs.writeFileSync(mouseEventsPath, JSON.stringify(mouseData));
			console.log(
				"[main.cjs] Mouse events dosyaya kaydedildi:",
				mouseEventsPath
			);

			// Mouse events dosya yolunu mediaState'e ekle
			mediaState.mouseEventsPath = mouseEventsPath;
		} catch (error) {
			console.error("[main.cjs] Mouse events kaydedilirken hata:", error);
		}

		// MediaState'i güncelle
		mediaState.videoPath =
			tempFiles.get("screen") || tempFiles.get("video") || null;
		mediaState.audioPath = tempFiles.get("audio") || null;

		console.log("MediaState güncellendi:", mediaState);

		// Kayıt bittiğinde editor'ü göster ve kamerayı gizle
		if (cameraManager) cameraManager.closeCameraWindow();
		if (editorManager) {
			await editorManager.showEditorWindow();
			console.log(
				"Editor penceresi açıldı, mediaState gönderiliyor:",
				mediaState
			);

			setTimeout(() => {
				if (editorManager.editorWindow) {
					editorManager.editorWindow.webContents.send(
						"MEDIA_PATHS",
						mediaState
					);
					console.log("MediaState editöre gönderildi");
				} else {
					console.error("Editor penceresi bulunamadı");
				}
			}, 2000);
		}
	}

	// Tray ikonunu güncelle
	if (trayManager) {
		trayManager.setRecordingStatus(status);
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

// Buffer'ı dosyaya kaydetmek için IPC handler
ipcMain.handle("SAVE_BUFFER_TO_FILE", async (event, buffer, filePath) => {
	try {
		await fs.promises.writeFile(filePath, buffer);
		return true;
	} catch (error) {
		console.error("[main.cjs] Dosya kaydedilirken hata:", error);
		throw error;
	}
});

// Video kaydetme ve kırpma için IPC handler
ipcMain.handle(
	"SAVE_VIDEO_FILE",
	async (event, arrayBuffer, filePath, cropInfo) => {
		try {
			console.log("[main.cjs] Video kaydetme başlıyor:", {
				filePath,
				hasCropInfo: !!cropInfo,
				cropDetails: cropInfo,
			});

			// Önce geçici bir dosyaya kaydet
			const tempDir = path.join(app.getPath("temp"), "sleer-temp");
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}

			const tempInputPath = path.join(tempDir, `temp-input-${Date.now()}.webm`);
			const tempOutputPath = path.join(
				tempDir,
				`temp-output-${Date.now()}.mp4`
			);

			// ArrayBuffer'ı geçici dosyaya kaydet
			const buffer = Buffer.from(arrayBuffer);
			await fs.promises.writeFile(tempInputPath, buffer);

			console.log("[main.cjs] Geçici dosya oluşturuldu:", tempInputPath);

			// FFmpeg ile videoyu kırp ve kaydet
			await new Promise((resolve, reject) => {
				let command = ffmpeg(tempInputPath);

				// Kırpma parametreleri varsa uygula
				if (
					cropInfo &&
					typeof cropInfo.width === "number" &&
					typeof cropInfo.height === "number"
				) {
					console.log("[main.cjs] Kırpma filtresi uygulanıyor:", cropInfo);

					const cropFilter = {
						filter: "crop",
						options: {
							w: Math.round(cropInfo.width),
							h: Math.round(cropInfo.height),
							x: Math.round(cropInfo.x || 0),
							y: Math.round(cropInfo.y || 0),
						},
					};

					command = command.videoFilters([cropFilter]);
				}

				command
					.outputOptions([
						"-c:v libx264", // Video codec
						"-preset veryfast", // Encoding hızı
						"-crf 23", // Kalite seviyesi
						"-movflags +faststart", // Hızlı başlatma
					])
					.toFormat("mp4")
					.on("start", (cmdLine) => {
						console.log("[main.cjs] FFmpeg komutu başlatıldı:", cmdLine);
					})
					.on("progress", (progress) => {
						console.log("[main.cjs] İşlem durumu:", progress);
					})
					.on("end", () => {
						console.log("[main.cjs] Video dönüştürme tamamlandı");
						resolve();
					})
					.on("error", (err) => {
						console.error("[main.cjs] FFmpeg hatası:", err);
						reject(err);
					})
					.save(tempOutputPath);
			});

			// Dönüştürülen videoyu hedef konuma taşı
			await fs.promises.copyFile(tempOutputPath, filePath);
			console.log("[main.cjs] Video başarıyla kaydedildi:", filePath);

			// Geçici dosyaları temizle
			try {
				fs.unlinkSync(tempInputPath);
				fs.unlinkSync(tempOutputPath);
				console.log("[main.cjs] Geçici dosyalar temizlendi");
			} catch (err) {
				console.error("[main.cjs] Geçici dosyalar silinirken hata:", err);
			}

			return true;
		} catch (error) {
			console.error("[main.cjs] Video dosyası kaydedilirken hata:", error);
			throw error;
		}
	}
);

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
		width: 920,
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
			allowRunningInsecureContent: true,
			webviewTag: true,
			additionalArguments: ["--disable-site-isolation-trials"],
		},
	});

	// Güvenlik politikalarını ayarla
	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		callback({
			responseHeaders: {
				...details.responseHeaders,
				"Content-Security-Policy": [
					"default-src 'self' 'unsafe-inline' 'unsafe-eval' file: data: blob:; media-src 'self' file: blob: data:;",
				],
			},
		});
	});

	// Protokol güvenliği için özel protokol kaydı
	protocol.registerFileProtocol("file", (request, callback) => {
		const pathname = decodeURIComponent(request.url.replace("file:///", ""));
		callback(pathname);
	});

	trayManager = new TrayManager(mainWindow);
	cameraManager = new CameraManager(mainWindow);

	trayManager.createTray();
	cameraManager.createCameraWindow();

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

	// Editor Manager'ı başlat
	editorManager = new EditorManager(mainWindow);
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

	// Seçilen alanı global değişkende sakla
	global.selectedArea = {
		...area,
		x: Math.round(area.x),
		y: Math.round(area.y),
		width: Math.round(area.width),
		height: Math.round(area.height),
		aspectRatio: area.aspectRatio || "free",
		display: area.display,
		devicePixelRatio: area.devicePixelRatio || 1,
	};

	if (mainWindow) {
		mainWindow.webContents.send("AREA_SELECTED", global.selectedArea);
	}
});

// Yeni kayıt için temizlik
ipcMain.on("RESET_FOR_NEW_RECORDING", () => {
	// Seçilen alanı sıfırla
	global.selectedArea = null;

	// Editor'ü gizle
	if (editorManager) {
		editorManager.hideEditorWindow();
	}

	// Ana pencere ve kamerayı göster
	if (mainWindow) mainWindow.show();
	if (cameraManager) cameraManager.showCameraWindow();

	// Geçici dosyaları temizle
	cleanupTempFiles();
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

		// MediaState'i güncelle
		if (type === "video" || type === "screen") {
			mediaState.videoPath = tempPath;
		} else if (type === "audio") {
			mediaState.audioPath = tempPath;
		}

		console.log(`${type} için geçici dosya kaydedildi:`, {
			path: tempPath,
			size: stats.size,
			type: type,
			mediaState: mediaState, // State'i logla
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
		{ screenPath, cameraPath, audioPath, outputPath, cropInfo }
	) => {
		return new Promise((resolve, reject) => {
			try {
				console.log(
					"Video birleştirme başlıyor. Detaylı kontroller yapılıyor...",
					{
						screenPath,
						cameraPath,
						audioPath,
						outputPath,
						cropInfo,
						selectedArea: global.selectedArea, // Log selected area
					}
				);

				// Kırpma bilgisini global.selectedArea'dan al eğer cropInfo yoksa
				const finalCropInfo = cropInfo || global.selectedArea;

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

				// Ekran kaydı filtresi - Kırpma işlemi
				if (finalCropInfo && finalCropInfo.width && finalCropInfo.height) {
					console.log("Kırpma filtresi uygulanıyor:", finalCropInfo);
					const cropFilter = `[0:v]crop=${finalCropInfo.width}:${finalCropInfo.height}:${finalCropInfo.x}:${finalCropInfo.y}[main]`;
					filterComplex.push(cropFilter);
				} else {
					console.log("Kırpma yapılmayacak, video olduğu gibi kullanılacak");
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

// Video dosyası okuma işlemi için IPC handler
ipcMain.handle("READ_VIDEO_FILE", async (event, filePath) => {
	try {
		// Dosyanın varlığını kontrol et
		if (!fs.existsSync(filePath)) {
			console.error("Dosya bulunamadı:", filePath);
			return null;
		}

		// Dosya boyutunu kontrol et
		const stats = fs.statSync(filePath);
		if (stats.size === 0) {
			console.error("Dosya boş:", filePath);
			return null;
		}

		console.log("Video dosyası okunuyor:", {
			path: filePath,
			size: stats.size,
		});

		// Dosyayı oku ve base64'e çevir
		const buffer = await fs.promises.readFile(filePath);
		return buffer.toString("base64");
	} catch (error) {
		console.error("Video dosyası okunurken hata:", error);
		return null;
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

// Editor ile ilgili IPC handler'lar
ipcMain.on("EDITOR_STATUS_UPDATE", (event, statusData) => {
	console.log("[main.cjs] Editor durumu güncellendi:", statusData);
	if (editorManager) {
		editorManager.handleEditorStatusUpdate(statusData);
	}
});

ipcMain.on("CLOSE_EDITOR_WINDOW", () => {
	if (editorManager) {
		editorManager.closeEditorWindow();
	}
});

ipcMain.on("OPEN_EDITOR", (event, videoData) => {
	if (editorManager) {
		editorManager.createEditorWindow();
		// Pencere yüklendikten sonra video verilerini gönder
		setTimeout(() => {
			editorManager.startEditing(videoData);
		}, 1000);
	}
});

// Ekran kaydı başlat
ipcMain.on("START_RECORDING", async () => {
	try {
		const sources = await desktopCapturer.getSources({
			types: ["screen", "window"],
			thumbnailSize: { width: 0, height: 0 },
			fetchWindowIcons: true,
		});

		// Kayıt dizinini oluştur
		const recordingDir = path.join(
			app.getPath("temp"),
			"screen-studio-recordings"
		);
		if (!fs.existsSync(recordingDir)) {
			fs.mkdirSync(recordingDir, { recursive: true });
		}

		const timestamp = new Date().getTime();
		const videoPath = path.join(recordingDir, `video_${timestamp}.webm`);
		const audioPath = path.join(recordingDir, `audio_${timestamp}.webm`);
		const systemAudioPath = path.join(
			recordingDir,
			`system_audio_${timestamp}.webm`
		);

		// Ekran kaydı için MediaRecorder ayarları
		const videoConstraints = {
			audio: false,
			video: {
				mandatory: {
					chromeMediaSource: "desktop",
					chromeMediaSourceId: sources[0].id,
				},
			},
		};

		// Mikrofon kaydı için MediaRecorder ayarları
		const audioConstraints = {
			audio: {
				mandatory: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			},
			video: false,
		};

		// Sistem sesi kaydı için MediaRecorder ayarları
		const systemAudioConstraints = {
			audio: {
				mandatory: {
					chromeMediaSource: "desktop",
				},
			},
			video: false,
		};

		// Kayıt işlemini başlat
		mainWindow.webContents.send("START_RECORDING", {
			videoConstraints,
			audioConstraints,
			systemAudioConstraints,
			videoPath,
			audioPath,
			systemAudioPath,
		});

		currentRecording = {
			videoPath,
			audioPath,
			systemAudioPath,
			timestamp,
		};
	} catch (error) {
		console.error("Kayıt başlatma hatası:", error);
		mainWindow.webContents.send("RECORDING_ERROR", error.message);
	}
});

// Kırpma bilgisi için IPC handler
ipcMain.handle("GET_CROP_INFO", async (event) => {
	try {
		// Seçilen alan bilgisini kontrol et
		const selectedArea = global.selectedArea;
		console.log(
			"[main.cjs] GET_CROP_INFO çağrıldı, mevcut selectedArea:",
			selectedArea
		);

		if (
			selectedArea &&
			typeof selectedArea.width === "number" &&
			typeof selectedArea.height === "number"
		) {
			// Seçilen alan varsa, basitleştirilmiş formatı döndür
			const cropInfo = {
				x: Math.round(selectedArea.x || 0),
				y: Math.round(selectedArea.y || 0),
				width: Math.round(selectedArea.width),
				height: Math.round(selectedArea.height),
				scale: 1,
			};
			console.log("[main.cjs] Kırpma bilgisi döndürülüyor:", cropInfo);
			return cropInfo;
		}

		console.log("[main.cjs] Kırpma bilgisi bulunamadı, null döndürülüyor");
		return null;
	} catch (error) {
		console.error("[main.cjs] Kırpma bilgisi alınırken hata:", error);
		return null;
	}
});

// Seçilen alan güncellemesi için IPC handler
ipcMain.on("UPDATE_SELECTED_AREA", (event, area) => {
	console.log("[main.cjs] Seçilen alan güncelleniyor:", area);
	global.selectedArea = area;
});
