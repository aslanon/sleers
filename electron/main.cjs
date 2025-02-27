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
const isDev = process.env.NODE_ENV === "development";
const waitOn = require("wait-on");
const ffmpeg = require("fluent-ffmpeg");
const { uIOhook } = require("uiohook-napi");

const { IPC_EVENTS } = require("./constants.cjs");
const TrayManager = require("./trayManager.cjs");
const CameraManager = require("./cameraManager.cjs");
const EditorManager = require("./editorManager.cjs");
const SelectionManager = require("./selectionManager.cjs");
const TempFileManager = require("./tempFileManager.cjs");
const MediaStateManager = require("./mediaStateManager.cjs");

let mainWindow = null;
let trayManager = null;
let cameraManager = null;
let selectionManager = null;
let editorManager = null;
let tempFileManager = null;
let mediaStateManager = null;
let editorSettings = {
	camera: {
		followMouse: true,
	},
};

// Pencere sürükleme için değişkenler
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

// Mouse tracking için değişkenler
let isTracking = false;
let startTime = null;
let lastCursorType = "default";

// Delay yönetimi için state
let recordingDelay = 1000; // Varsayılan 1sn

// UPDATE_EDITOR_SETTINGS
ipcMain.on(IPC_EVENTS.UPDATE_EDITOR_SETTINGS, (event, settings) => {
	editorSettings = {
		...editorSettings,
		...settings,
	};
});

ipcMain.handle(IPC_EVENTS.GET_EDITOR_SETTINGS, () => {
	return editorSettings;
});

// IPC handlers'a eklenecek
ipcMain.on(IPC_EVENTS.UPDATE_RECORDING_DELAY, (event, delay) => {
	recordingDelay = delay;
});

ipcMain.handle(IPC_EVENTS.GET_RECORDING_DELAY, () => {
	return recordingDelay;
});

// IPC event handlers
function setupIpcHandlers() {
	// Aperture modülü için handler'lar
	ipcMain.handle("LOAD_APERTURE_MODULE", async (event) => {
		try {
			console.log("[Main] Aperture modülü yükleniyor (ESM)...");

			// Timeout kontrolü ve işletim sistemi kontrolü
			if (process.platform !== "darwin") {
				console.error("[Main] Aperture sadece macOS'ta desteklenir");
				return false;
			}

			// Timeout ile yüklemeyi kontrol et
			const apertureModule = await Promise.race([
				import("aperture"),
				new Promise((_, reject) =>
					setTimeout(
						() => reject(new Error("Aperture modülü yükleme zaman aşımı")),
						10000
					)
				),
			]);

			if (!apertureModule) {
				console.error("[Main] Aperture modülü yüklenemedi");
				return false;
			}

			console.log(
				"[Main] Aperture modülü başarıyla yüklendi:",
				Object.keys(apertureModule)
			);

			// API yapısını kontrol et
			let apiFound = false;

			if (apertureModule.default) {
				console.log(
					"[Main] Default export bulundu:",
					Object.keys(apertureModule.default)
				);

				if (apertureModule.default.recorder) {
					console.log("[Main] Modern API (default.recorder) bulundu");
					apiFound = true;
				}

				if (typeof apertureModule.default.startRecording === "function") {
					console.log("[Main] Modern API (default.startRecording) bulundu");
					apiFound = true;
				}
			}

			if (apertureModule.recorder) {
				console.log("[Main] Modern API (recorder) bulundu");
				apiFound = true;
			}

			if (typeof apertureModule.startRecording === "function") {
				console.log("[Main] Modern API (startRecording) bulundu");
				apiFound = true;
			}

			if (!apiFound) {
				console.error("[Main] Desteklenen API bulunamadı");
				return false;
			}

			// Önemli fonksiyonları test et
			try {
				console.log("[Main] Ekranlar kontrol ediliyor...");

				if (typeof apertureModule.screens === "function") {
					const screens = await apertureModule.screens();
					console.log(
						"[Main] Ekranlar:",
						screens && screens.length ? "Bulundu" : "Bulunamadı"
					);
				} else if (
					apertureModule.default &&
					typeof apertureModule.default.screens === "function"
				) {
					const screens = await apertureModule.default.screens();
					console.log(
						"[Main] Ekranlar:",
						screens && screens.length ? "Bulundu" : "Bulunamadı"
					);
				}

				console.log("[Main] Ses cihazları kontrol ediliyor...");

				if (typeof apertureModule.audioDevices === "function") {
					const audioDevices = await apertureModule.audioDevices();
					console.log(
						"[Main] Ses cihazları:",
						audioDevices && audioDevices.length ? "Bulundu" : "Bulunamadı"
					);
				} else if (
					apertureModule.default &&
					typeof apertureModule.default.audioDevices === "function"
				) {
					const audioDevices = await apertureModule.default.audioDevices();
					console.log(
						"[Main] Ses cihazları:",
						audioDevices && audioDevices.length ? "Bulundu" : "Bulunamadı"
					);
				}

				console.log("[Main] Aperture modülü başarıyla hazır");
				return true;
			} catch (testError) {
				console.warn("[Main] API testi sırasında hata:", testError);
				// Test hataları kritik değil, API bulunduğu sürece devam et
				return apiFound;
			}
		} catch (error) {
			console.error("[Main] Aperture import hatası:", error);
			return false;
		}
	});

	ipcMain.handle(
		"START_APERTURE_RECORDING",
		async (event, outputPath, options) => {
			try {
				console.log("[Main] Aperture kaydı başlatılıyor...", {
					outputPath,
					options: options
						? { ...options, audioDeviceId: options.audioDeviceId }
						: "undefined",
				});

				if (!outputPath) {
					console.error("[Main] Çıktı dosya yolu belirtilmedi");
					return false;
				}

				// Aperture'ın sadece macOS'ta çalıştığını kontrol et
				if (process.platform !== "darwin") {
					console.error("[Main] Aperture sadece macOS'ta çalışır");
					return false;
				}

				// Aperture modülünü yükle
				const aperturePath = path.join(__dirname, "aperture.cjs");
				console.log("[Main] Aperture modülü yükleniyor:", aperturePath);

				// Yüklenen modülün fonksiyonlarını kullan
				let apertureModule;
				try {
					apertureModule = await import(`file://${aperturePath}`);
				} catch (importError) {
					console.error("[Main] Aperture modülü import hatası:", importError);
					return false;
				}

				// Aperture fonksiyonlarını kontrol et
				const {
					start,
					stop,
					killApertureProcesses,
					getScreens,
					getAudioDevices,
				} = apertureModule;

				if (typeof start !== "function" || typeof stop !== "function") {
					console.error("[Main] Aperture API'si bulunamadı");
					return false;
				}

				// Önce çalışan süreçleri temizle
				await killApertureProcesses();

				// Ekranları ve ses cihazlarını kontrol et
				try {
					console.log("[Main] Kullanılabilir ekranlar kontrol ediliyor");
					const screens = await getScreens();
					console.log(
						"[Main] Kullanılabilir ekranlar:",
						screens ? screens.length : 0
					);

					console.log("[Main] Ses cihazları kontrol ediliyor");
					const audioDevices = await getAudioDevices();
					console.log(
						"[Main] Ses cihazları:",
						audioDevices ? audioDevices.length : 0
					);
				} catch (deviceError) {
					console.warn(
						"[Main] Cihaz bilgileri alınamadı (kritik değil):",
						deviceError.message
					);
				}

				// Seçenekleri kopyala ve modifiye et
				const recordingOptions = { ...options };

				// audioDeviceId'yi düzelt - "system" yerine null kullan
				if (recordingOptions.audioDeviceId === "system") {
					console.log("[Main] audioDeviceId 'system'den null'a çevriliyor");
					recordingOptions.audioDeviceId = null;
				}

				// FPS ayarla
				recordingOptions.fps = recordingOptions.fps || 30;

				console.log("[Main] Kayıt başlatılıyor...", recordingOptions);

				// Başlatma işlemi
				try {
					const success = await start(outputPath, recordingOptions);
					if (success) {
						console.log("[Main] Aperture kaydı başarıyla başlatıldı");
						return true;
					} else {
						console.error("[Main] Aperture kaydı başlatılamadı");
						return false;
					}
				} catch (error) {
					console.error("[Main] Aperture kaydı başlatılırken hata:", error);

					// Hataya özel mesaj
					if (
						error.message.includes("timeout") ||
						error.code === "RECORDER_TIMEOUT"
					) {
						console.error(
							"[Main] Kayıt zaman aşımı hatası. Sistem yükü yüksek olabilir veya başka bir kayıt uygulaması çalışıyor olabilir."
						);
					}

					return false;
				}
			} catch (error) {
				console.error("[Main] Aperture kaydı başlatılırken genel hata:", error);
				return false;
			}
		}
	);

	ipcMain.handle("STOP_APERTURE_RECORDING", async (event, outputPath) => {
		try {
			console.log("[Main] Aperture kaydı durduruluyor...");

			// Aperture modülünü yükle
			const aperturePath = path.join(__dirname, "aperture.cjs");
			console.log("[Main] Aperture modülü yükleniyor:", aperturePath);

			// CommonJS modülünü dynamic import ile yükle
			const apertureModule = await import(`file://${aperturePath}`);
			const { stop } = apertureModule;

			// Durdurma işlemi
			try {
				const success = await stop(outputPath);
				if (success) {
					console.log("[Main] Aperture kaydı başarıyla durduruldu");

					// Dosya boyutunu kontrol et
					if (outputPath && fs.existsSync(outputPath)) {
						const stats = fs.statSync(outputPath);
						const fileSizeMB = stats.size / (1024 * 1024);
						console.log(
							`[Main] Kayıt dosyası boyutu: ${fileSizeMB.toFixed(2)} MB`
						);

						if (stats.size === 0) {
							console.error("[Main] Kayıt dosyası boş (0 byte)");
							return false;
						}
					}

					return true;
				} else {
					console.error("[Main] Aperture kaydı durdurulamadı");
					return false;
				}
			} catch (error) {
				console.error("[Main] Aperture kaydı durdurulurken hata:", error);
				return false;
			}
		} catch (error) {
			console.error("[Main] Aperture kaydı durdurulurken genel hata:", error);
			return false;
		}
	});

	ipcMain.handle("GET_FILE_SIZE", async (event, filePath) => {
		try {
			if (!filePath || !fs.existsSync(filePath)) {
				return 0;
			}
			const stats = fs.statSync(filePath);
			return stats.size;
		} catch (error) {
			console.error("[Main] Dosya boyutu alınırken hata:", error);
			return 0;
		}
	});

	// Recording status
	ipcMain.on(IPC_EVENTS.RECORDING_STATUS_CHANGED, async (event, status) => {
		console.log("********Kayıt durumu değişti:", status);
		if (trayManager) {
			trayManager.setRecordingStatus(status);
		}
		if (status) {
			console.log(1232);
			startMouseTracking();
		} else {
			console.log(423);
			stopMouseTracking();
			if (mediaStateManager && tempFileManager) {
				await mediaStateManager.saveCursorData(tempFileManager);
			}
		}

		try {
			const result = await mediaStateManager.handleRecordingStatusChange(
				status,
				tempFileManager
			);

			if (!status) {
				// Kayıt durdurulduğunda
				if (cameraManager) {
					cameraManager.closeCameraWindow();
				}

				// Medya dosyaları hazır olduğunda editor'ü aç
				if (result && editorManager) {
					try {
						// Editor'ü açmadan önce son bir kez daha medya dosyalarını kontrol et
						if (!mediaStateManager.isMediaReady()) {
							throw new Error("Medya dosyaları hazır değil");
						}

						// Editor penceresini aç
						editorManager.createEditorWindow();
					} catch (error) {
						console.error("[main.cjs] Editor penceresi açılırken hata:", error);
					}
				}
			}
		} catch (error) {
			console.error("[main.cjs] Kayıt durumu değiştirilirken hata:", error);
			event.reply(IPC_EVENTS.RECORDING_ERROR, error.message);
		}
	});

	// Recording status updates
	ipcMain.on(IPC_EVENTS.RECORDING_STATUS_UPDATE, (event, statusData) => {
		console.log("[Main] Kayıt durumu güncellendi:", statusData);

		// Tray manager'a bildir
		if (trayManager && typeof statusData.isActive === "boolean") {
			trayManager.setRecordingStatus(statusData.isActive);
		}

		// MediaStateManager'a bildir
		if (mediaStateManager) {
			mediaStateManager.updateRecordingStatus(statusData);
		}

		// Ana pencereye bildir
		if (mainWindow && mainWindow.webContents) {
			mainWindow.webContents.send(
				IPC_EVENTS.RECORDING_STATUS_UPDATE,
				statusData
			);
		}
	});

	// Cursor data handler
	ipcMain.handle(IPC_EVENTS.LOAD_CURSOR_DATA, async () => {
		try {
			console.log("[main.cjs] Cursor verisi yükleniyor...");
			if (mediaStateManager) {
				const cursorData = await mediaStateManager.loadCursorData();
				console.log(
					"[main.cjs] Cursor verisi yüklendi:",
					cursorData?.length || 0
				);
				return cursorData;
			}
			return [];
		} catch (error) {
			console.error("[main.cjs] Cursor verisi yüklenirken hata:", error);
			return [];
		}
	});

	// Editor events
	ipcMain.on(IPC_EVENTS.EDITOR_CLOSED, () => {
		mediaStateManager.resetState();
	});

	ipcMain.on(IPC_EVENTS.CLOSE_EDITOR_WINDOW, () => {
		if (editorManager) {
			editorManager.closeEditorWindow();
		}
	});

	// Media state
	ipcMain.handle(IPC_EVENTS.GET_MEDIA_STATE, () => {
		return mediaStateManager.getState();
	});

	// Area selection
	ipcMain.on(IPC_EVENTS.START_AREA_SELECTION, () => {
		if (selectionManager) {
			selectionManager.startAreaSelection();
		}
	});

	ipcMain.on(IPC_EVENTS.AREA_SELECTED, (event, area) => {
		if (selectionManager) {
			selectionManager.handleAreaSelected(area);
		}
	});

	ipcMain.on(IPC_EVENTS.UPDATE_SELECTED_AREA, (event, area) => {
		if (selectionManager) {
			selectionManager.updateSelectedArea(area);
		}
	});

	ipcMain.handle(IPC_EVENTS.GET_CROP_INFO, async () => {
		if (selectionManager) {
			const selectedArea = selectionManager.getSelectedArea();
			if (
				selectedArea &&
				typeof selectedArea.width === "number" &&
				typeof selectedArea.height === "number"
			) {
				return {
					x: Math.round(selectedArea.x || 0),
					y: Math.round(selectedArea.y || 0),
					width: Math.round(selectedArea.width),
					height: Math.round(selectedArea.height),
					scale: 1,
				};
			}
		}
		return null;
	});

	// Window management
	ipcMain.on(IPC_EVENTS.WINDOW_CLOSE, () => {
		if (mainWindow) {
			mainWindow.close();
			cameraManager.cleanup();
			app.quit();
		}
	});

	// Window dragging
	ipcMain.on(IPC_EVENTS.START_WINDOW_DRAG, (event, mousePos) => {
		isDragging = true;
		const winPos = BrowserWindow.fromWebContents(event.sender).getPosition();
		dragOffset = {
			x: mousePos.x - winPos[0],
			y: mousePos.y - winPos[1],
		};
	});

	ipcMain.on(IPC_EVENTS.WINDOW_DRAGGING, (event, mousePos) => {
		if (!isDragging) return;
		const win = BrowserWindow.fromWebContents(event.sender);
		win.setPosition(mousePos.x - dragOffset.x, mousePos.y - dragOffset.y);
	});

	ipcMain.on(IPC_EVENTS.END_WINDOW_DRAG, () => {
		isDragging = false;
	});

	// File operations
	ipcMain.handle(IPC_EVENTS.START_MEDIA_STREAM, async (event, type) => {
		return await tempFileManager.startMediaStream(type);
	});

	ipcMain.handle(IPC_EVENTS.WRITE_MEDIA_CHUNK, async (event, type, chunk) => {
		return tempFileManager.writeChunkToStream(type, chunk);
	});

	ipcMain.handle(IPC_EVENTS.END_MEDIA_STREAM, async (event, type) => {
		try {
			console.log(`[Main] ${type} medya stream'i sonlandırılıyor...`);
			const result = await tempFileManager.endMediaStream(type);
			console.log(`[Main] ${type} medya stream'i sonlandırıldı:`, result);
			return result;
		} catch (error) {
			console.error(
				`[Main] ${type} medya stream'i sonlandırılırken hata:`,
				error
			);
			// Hata olsa bile stream'i Map'ten kaldır
			tempFileManager.activeStreams.delete(type);
			return null;
		}
	});

	ipcMain.handle(IPC_EVENTS.SAVE_TEMP_VIDEO, async (event, data, type) => {
		if (data.startsWith("data:")) {
			// Eski yöntem - base64'ten dosyaya
			return await tempFileManager.saveTempVideo(data, type);
		} else {
			// Yeni yöntem - doğrudan chunk'ı stream'e yaz
			return tempFileManager.writeChunkToStream(type, data);
		}
	});

	ipcMain.handle(IPC_EVENTS.READ_VIDEO_FILE, async (event, filePath) => {
		try {
			if (!filePath || !fs.existsSync(filePath)) {
				console.error("[main.cjs] Dosya bulunamadı:", filePath);
				return null;
			}

			const stats = fs.statSync(filePath);
			if (stats.size === 0) {
				console.error("[main.cjs] Dosya boş:", filePath);
				return null;
			}

			console.log("[main.cjs] Video dosyası okunuyor:", {
				path: filePath,
				size: stats.size,
				sizeInMB: (stats.size / (1024 * 1024)).toFixed(2) + "MB",
			});

			const buffer = await fs.promises.readFile(filePath);
			return buffer.toString("base64");
		} catch (error) {
			console.error("[main.cjs] Video dosyası okunurken hata:", error);
			return null;
		}
	});

	ipcMain.handle(IPC_EVENTS.GET_MEDIA_PATHS, () => {
		return {
			videoPath:
				tempFileManager.getFilePath("screen") ||
				tempFileManager.getFilePath("video"),
			audioPath: tempFileManager.getFilePath("audio"),
			cameraPath: tempFileManager.getFilePath("camera"),
		};
	});

	ipcMain.handle(IPC_EVENTS.SHOW_SAVE_DIALOG, async (event, options) => {
		const { dialog } = require("electron");
		const result = await dialog.showSaveDialog({
			...options,
			properties: ["showOverwriteConfirmation"],
		});
		return result.filePath;
	});

	// Desktop capturer
	ipcMain.handle(
		IPC_EVENTS.DESKTOP_CAPTURER_GET_SOURCES,
		async (event, opts) => {
			try {
				return await desktopCapturer.getSources(opts);
			} catch (error) {
				console.error("Ekran kaynakları alınırken hata:", error);
				throw error;
			}
		}
	);

	// Reset
	ipcMain.on(IPC_EVENTS.RESET_FOR_NEW_RECORDING, () => {
		if (selectionManager) selectionManager.resetSelection();
		if (editorManager) editorManager.hideEditorWindow();
		if (mainWindow) mainWindow.show();
		if (cameraManager) cameraManager.showCameraWindow();
		tempFileManager.cleanupAllFiles();
	});

	// Audio Settings
	ipcMain.on(IPC_EVENTS.UPDATE_AUDIO_SETTINGS, (event, settings) => {
		if (mediaStateManager) {
			mediaStateManager.updateAudioSettings(settings);
		}
	});

	ipcMain.handle(IPC_EVENTS.GET_AUDIO_SETTINGS, () => {
		if (mediaStateManager) {
			return mediaStateManager.state.audioSettings;
		}
		return null;
	});

	// Video kaydetme işlemi
	ipcMain.handle(
		IPC_EVENTS.SAVE_VIDEO_FILE,
		async (event, arrayBuffer, filePath, cropInfo, audioArrayBuffer) => {
			try {
				console.log("[main] Video kaydetme işlemi başlatıldı");

				// ArrayBuffer'ı Buffer'a çevir
				const videoBuffer = Buffer.from(arrayBuffer);
				const audioBuffer = audioArrayBuffer
					? Buffer.from(audioArrayBuffer)
					: null;

				// Geçici dosya oluştur
				const tempVideoPath = path.join(app.getPath("temp"), "temp_video.mp4");
				const tempAudioPath = audioBuffer
					? path.join(app.getPath("temp"), "temp_audio.mp3")
					: null;

				// Dosyaları geçici olarak kaydet
				await fs.promises.writeFile(tempVideoPath, videoBuffer);
				if (audioBuffer) {
					await fs.promises.writeFile(tempAudioPath, audioBuffer);
				}

				// FFmpeg ile video işleme
				return new Promise((resolve, reject) => {
					let command = ffmpeg(tempVideoPath);

					if (audioBuffer) {
						command = command.input(tempAudioPath);
					}

					if (cropInfo) {
						command = command.videoFilters([
							`crop=${cropInfo.width}:${cropInfo.height}:${cropInfo.x}:${cropInfo.y}`,
						]);
					}

					command
						.on("end", () => {
							// Geçici dosyaları temizle
							fs.unlinkSync(tempVideoPath);
							if (tempAudioPath) fs.unlinkSync(tempAudioPath);
							console.log("[main] Video başarıyla kaydedildi:", filePath);
							resolve({ success: true, path: filePath });
						})
						.on("error", (err) => {
							console.error("[main] Video kaydedilirken hata:", err);
							reject(err);
						})
						.save(filePath);
				});
			} catch (error) {
				console.error("[main] Video kaydetme hatası:", error);
				throw error;
			}
		}
	);

	// Video kaydetme işlemi
	ipcMain.handle(
		IPC_EVENTS.SAVE_CANVAS_RECORDING,
		async (event, videoArrayBuffer, filePath, audioArrayBuffer) => {
			try {
				console.log("[main] Canvas kaydı kaydetme işlemi başlatıldı");

				// ArrayBuffer'ları Buffer'a çevir
				const videoBuffer = Buffer.from(videoArrayBuffer);
				const audioBuffer = audioArrayBuffer
					? Buffer.from(audioArrayBuffer)
					: null;

				// Geçici dosya yolları
				const tempVideoPath = path.join(
					app.getPath("temp"),
					"temp_canvas_video.webm"
				);
				const tempAudioPath = audioBuffer
					? path.join(app.getPath("temp"), "temp_canvas_audio.webm")
					: null;

				// Dosyaları geçici olarak kaydet
				await fs.promises.writeFile(tempVideoPath, videoBuffer);
				if (audioBuffer) {
					await fs.promises.writeFile(tempAudioPath, audioBuffer);
				}

				// FFmpeg ile video işleme
				return new Promise((resolve, reject) => {
					let command = ffmpeg(tempVideoPath);

					if (audioBuffer) {
						command = command.input(tempAudioPath);
					}

					command
						.videoCodec("libx264")
						.outputOptions([
							"-crf 23", // Kalite ayarı (0-51, düşük değer daha iyi kalite)
							"-preset medium", // Encoding hızı/kalite dengesi
							"-movflags +faststart", // Web'de hızlı başlatma için
						])
						.on("end", () => {
							// Geçici dosyaları temizle
							fs.unlinkSync(tempVideoPath);
							if (tempAudioPath) fs.unlinkSync(tempAudioPath);
							console.log("[main] Video başarıyla kaydedildi:", filePath);
							resolve({ success: true, path: filePath });
						})
						.on("error", (err) => {
							console.error("[main] Video kaydedilirken hata:", err);
							reject(err);
						})
						.save(filePath);
				});
			} catch (error) {
				console.error("[main] Canvas kaydı kaydetme hatası:", error);
				throw error;
			}
		}
	);

	// Pencere boyutu güncelleme
	ipcMain.on("UPDATE_WINDOW_SIZE", (event, { height }) => {
		if (mainWindow) {
			const [width] = mainWindow.getSize();
			mainWindow.setSize(width, height);
		}
	});

	// Kamera takip ayarı
	ipcMain.on("TOGGLE_CAMERA_FOLLOW", (event, shouldFollow) => {
		cameraManager.setFollowMouse(shouldFollow);
	});

	// Video kaydetme işleyicisi
	ipcMain.handle("SAVE_VIDEO", async (event, base64Data, outputPath) => {
		try {
			console.log("[main] Video kaydediliyor...");

			// Base64'ten buffer'a çevir
			const base64String = base64Data.replace(/^data:video\/webm;base64,/, "");
			const inputBuffer = Buffer.from(base64String, "base64");

			// Geçici webm dosyası oluştur
			const tempWebmPath = path.join(
				app.getPath("temp"),
				`temp_${Date.now()}.webm`
			);
			fs.writeFileSync(tempWebmPath, inputBuffer);

			// FFmpeg ile MP4'e dönüştür ve kaliteyi ayarla
			return new Promise((resolve, reject) => {
				ffmpeg(tempWebmPath)
					.outputOptions([
						"-c:v libx264", // H.264 codec
						"-preset fast", // Hızlı encoding
						"-crf 18", // Yüksek kalite (0-51, düşük değer = yüksek kalite)
						"-movflags +faststart", // Web playback için optimize
						"-profile:v high", // Yüksek profil
						"-level 4.2", // Uyumluluk seviyesi
						"-pix_fmt yuv420p", // Renk formatı
						"-r 60", // 60 FPS
					])
					.on("end", () => {
						// Geçici dosyayı temizle
						fs.unlinkSync(tempWebmPath);
						console.log("[main] Video başarıyla kaydedildi:", outputPath);
						resolve({ success: true });
					})
					.on("error", (err) => {
						console.error("[main] Video dönüştürme hatası:", err);
						reject(new Error("Video dönüştürülemedi: " + err.message));
					})
					.save(outputPath);
			});
		} catch (error) {
			console.error("[main] Video kaydetme hatası:", error);
			throw error;
		}
	});

	// Editör penceresini aç
	ipcMain.handle(IPC_EVENTS.OPEN_EDITOR, async (event, data) => {
		try {
			console.log("[Main] Editör açılıyor, tüm stream'ler temizleniyor...");

			// Fare takibini durdur
			if (isTracking) {
				console.log("[Main] Fare takibi durduruluyor...");
				uIOhook.stop();
				isTracking = false;
				mainWindow.webContents.send(IPC_EVENTS.MOUSE_TRACKING_STOPPED);
			}

			// Önce tüm aktif stream'leri temizle
			await tempFileManager.cleanupStreams();

			// Medya yollarını kaydet
			mediaStateManager.state.videoPath = data.videoPath;
			mediaStateManager.state.cameraPath = data.cameraPath;
			mediaStateManager.state.audioPath = data.audioPath;

			console.log("[Main] Stream'ler temizlendi, editör açılıyor...");
			console.log("[Main] Editör verileri:", data);

			// Editör penceresini aç
			createEditorWindow(data);
			return { success: true };
		} catch (error) {
			console.error("[Main] Editör açılırken hata:", error);
			return { success: false, error: error.message };
		}
	});

	// Kamera cihazı değişikliğini dinle
	ipcMain.on(IPC_EVENTS.CAMERA_DEVICE_CHANGED, (event, deviceId) => {
		console.log("[main.cjs] Kamera cihazı değişikliği alındı:", deviceId);
		if (cameraManager) {
			cameraManager.updateCameraDevice(deviceId);
		}
	});
}

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

	setupSecurityPolicies();
	initializeManagers();
	setupWindowEvents();
	loadApplication();
}

function setupSecurityPolicies() {
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

	protocol.registerFileProtocol("file", (request, callback) => {
		const pathname = decodeURIComponent(request.url.replace("file:///", ""));
		callback(pathname);
	});
}

function initializeManagers() {
	trayManager = new TrayManager(mainWindow);
	cameraManager = new CameraManager(mainWindow);
	selectionManager = new SelectionManager(mainWindow);
	editorManager = new EditorManager(mainWindow);
	tempFileManager = new TempFileManager();
	mediaStateManager = new MediaStateManager(mainWindow);

	trayManager.createTray();
	cameraManager.createCameraWindow();
}

function setupWindowEvents() {
	mainWindow.on("closed", () => {
		if (cameraManager) {
			cameraManager.cleanup();
		}
		mainWindow = null;
	});

	mainWindow.on("close", (event) => {
		if (!app.isQuitting) {
			event.preventDefault();
			mainWindow.hide();
		}
		return false;
	});
}

function loadApplication() {
	if (isDev) {
		mainWindow.loadURL("http://127.0.0.1:3000");
		mainWindow.webContents.openDevTools({ mode: "detach" });
	} else {
		mainWindow.loadFile(path.join(__dirname, "../.output/public/index.html"));
	}
}

// App lifecycle events
app.whenReady().then(() => {
	createWindow();
	setupIpcHandlers();
});

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

app.on("before-quit", async (event) => {
	try {
		console.log("[Main] Uygulama kapanıyor, tüm kaynaklar temizleniyor...");

		// Fare takibini durdur
		if (isTracking) {
			console.log("[Main] Fare takibi durduruluyor...");
			uIOhook.stop();
			isTracking = false;
		}

		// Tüm stream'leri temizle
		if (tempFileManager) {
			console.log("[Main] Tüm stream'ler temizleniyor...");
			event.preventDefault(); // Uygulamanın kapanmasını geçici olarak engelle

			// Stream'leri temizle ve sonra uygulamayı kapat
			await tempFileManager.cleanupStreams();
			console.log("[Main] Tüm stream'ler temizlendi");

			// Tüm geçici dosyaları temizle
			await tempFileManager.cleanupAllFiles();
			console.log("[Main] Tüm geçici dosyalar temizlendi");

			// Diğer manager'ları temizle
			if (cameraManager) cameraManager.cleanup();
			if (trayManager) trayManager.cleanup();

			// Şimdi uygulamayı kapat
			app.quit();
		}
	} catch (error) {
		console.error("[Main] Uygulama kapanırken hata:", error);
		// Hata olsa bile uygulamayı kapat
		app.exit(1);
	}
});

function startMouseTracking() {
	console.log("Mouse tracking başlatılıyor, delay:", recordingDelay);

	if (!isTracking) {
		isTracking = true;
		startTime = Date.now();

		// Mouse hareketi
		uIOhook.on("mousemove", (event) => {
			if (!isTracking) return;
			const currentTime = Date.now() - startTime;

			mediaStateManager.addMousePosition({
				x: event.x,
				y: event.y,
				timestamp: currentTime,
				cursorType: lastCursorType,
				type: "move",
			});
		});

		// Mouse tıklama
		uIOhook.on("mousedown", (event) => {
			if (!isTracking) return;
			const currentTime = Date.now() - startTime;

			mediaStateManager.addMousePosition({
				x: event.x,
				y: event.y,
				timestamp: currentTime,
				cursorType: "pointer",
				type: "mousedown",
				button: event.button,
				clickCount: 1,
				scale: 0.8, // Tıklama anında küçülme
			});

			lastCursorType = "pointer";

			// 100ms sonra normale dön
			setTimeout(() => {
				mediaStateManager.addMousePosition({
					x: event.x,
					y: event.y,
					timestamp: currentTime + 100,
					cursorType: lastCursorType,
					type: "scale",
					scale: 1.1, // Hafif büyüme
				});

				// 200ms'de normal boyuta dön
				setTimeout(() => {
					mediaStateManager.addMousePosition({
						x: event.x,
						y: event.y,
						timestamp: currentTime + 200,
						cursorType: lastCursorType,
						type: "scale",
						scale: 1,
					});
				}, 100);
			}, 100);
		});

		// Mouse bırakma
		uIOhook.on("mouseup", (event) => {
			if (!isTracking) return;
			const currentTime = Date.now() - startTime;

			mediaStateManager.addMousePosition({
				x: event.x,
				y: event.y,
				timestamp: currentTime,
				cursorType: "default",
				type: "mouseup",
				button: event.button,
			});

			lastCursorType = "default";
		});

		// Mouse tekerleği
		uIOhook.on("wheel", (event) => {
			if (!isTracking) return;
			const currentTime = Date.now() - startTime;

			mediaStateManager.addMousePosition({
				x: event.x,
				y: event.y,
				timestamp: currentTime,
				cursorType: lastCursorType,
				type: "wheel",
				rotation: event.rotation,
				direction: event.direction,
			});
		});

		// Mouse sürükleme
		uIOhook.on("mousedrag", (event) => {
			if (!isTracking) return;
			const currentTime = Date.now() - startTime;

			mediaStateManager.addMousePosition({
				x: event.x,
				y: event.y,
				timestamp: currentTime,
				cursorType: "grabbing",
				type: "drag",
			});

			lastCursorType = "grabbing";
		});

		// Event dinlemeyi başlat
		uIOhook.start();
	}
}

function stopMouseTracking() {
	if (isTracking) {
		isTracking = false;
		startTime = null;
		lastCursorType = "default";

		// Event dinleyicileri temizle
		uIOhook.removeAllListeners("mousemove");
		uIOhook.removeAllListeners("mousedown");
		uIOhook.removeAllListeners("mouseup");
		uIOhook.removeAllListeners("wheel");
		uIOhook.removeAllListeners("mousedrag");

		// Event dinlemeyi durdur
		uIOhook.stop();
	}
}
