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
	dialog,
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

// Kaynak ayarları için state
let recordingSource = {
	sourceType: "display",
	sourceId: null,
	sourceName: null,
};

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

// İzin durumlarını kontrol eden handler ekle
ipcMain.handle(IPC_EVENTS.CHECK_PERMISSIONS, async () => {
	return await checkPermissionStatus();
});

// İzin isteme handler'ı ekle
ipcMain.handle("REQUEST_PERMISSION", async (event, permissionType) => {
	if (process.platform !== "darwin") {
		return true; // macOS dışındaki platformlarda izin zaten var kabul ediyoruz
	}

	try {
		const { systemPreferences } = require("electron");
		if (permissionType === "camera" || permissionType === "microphone") {
			const granted = await systemPreferences.askForMediaAccess(permissionType);
			console.log(`[Main] ${permissionType} izni istendi, sonuç:`, granted);
			return granted;
		}
		return false; // Ekran kaydı izni programatik olarak istenemez
	} catch (error) {
		console.error(`[Main] ${permissionType} izni istenirken hata:`, error);
		return false;
	}
});

// Sistem ayarlarını açma handler'ı
ipcMain.on("OPEN_SYSTEM_PREFERENCES", () => {
	if (process.platform === "darwin") {
		// macOS için Gizlilik ve Güvenlik ayarlarını aç
		const { shell } = require("electron");
		shell.openExternal(
			"x-apple.systempreferences:com.apple.preference.security?Privacy"
		);
	}
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
					options: JSON.stringify(options, null, 2),
					recordingSource: JSON.stringify(recordingSource, null, 2),
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

				// kaynak bilgisini options'a ekle, eğer recordingSource.sourceId varsa
				if (recordingSource && recordingSource.sourceId) {
					// Pencere kaynağı seçilmişse uyarı verelim
					if (recordingSource.sourceType === "window") {
						console.log(
							"[Main] Pencere kaynağı seçildi, Aperture sadece ekranları destekler. Varsayılan ekran kullanılacak."
						);
						// Pencere kaynağını da options'a ekleyelim, aperture.cjs'de işlenecek
					}

					options.sourceId = recordingSource.sourceId;
					options.sourceType = recordingSource.sourceType; // sourceType bilgisini de ekle

					console.log("[Main] RecordingSource'dan bilgiler eklendi:", {
						sourceId: recordingSource.sourceId,
						sourceType: recordingSource.sourceType,
					});
				}

				// Aperture ID varsa doğrudan kullan (daha öncelikli)
				if (recordingSource && recordingSource.apertureId) {
					const apertureId = parseInt(recordingSource.apertureId, 10);
					if (!isNaN(apertureId)) {
						options.sourceId = apertureId; // Doğrudan sayısal ID kullan
						console.log(
							"[Main] RecordingSource'dan apertureId eklendi:",
							apertureId,
							"(önceden dönüştürülmüş)"
						);
					}
				}

				// Kırpma alanı bilgisini kontrol et
				if (mediaStateManager && mediaStateManager.state.selectedArea) {
					const selectedArea = mediaStateManager.state.selectedArea;

					// Geçerli bir kırpma alanı varsa ekle
					if (
						selectedArea &&
						typeof selectedArea.x === "number" &&
						typeof selectedArea.y === "number" &&
						typeof selectedArea.width === "number" &&
						typeof selectedArea.height === "number" &&
						selectedArea.width > 0 &&
						selectedArea.height > 0
					) {
						console.log("[Main] Kırpma alanı bilgisi ekleniyor:", selectedArea);

						// Aperture kayıt seçeneklerine cropArea bilgisini ekle
						options.cropArea = {
							x: Math.round(selectedArea.x),
							y: Math.round(selectedArea.y),
							width: Math.round(selectedArea.width),
							height: Math.round(selectedArea.height),
						};

						// Aspect ratio bilgisi varsa dönüşüm için ekle
						if (
							selectedArea.aspectRatio &&
							selectedArea.aspectRatio !== "free"
						) {
							options.cropArea.aspectRatio = selectedArea.aspectRatio;

							if (selectedArea.aspectRatioValue) {
								options.cropArea.aspectRatioValue =
									selectedArea.aspectRatioValue;
							}
						}
					}
				}

				// macOS'ta ses izinlerini kontrol et
				if (process.platform === "darwin") {
					console.log(
						"[Main] macOS için ses kaydı izinleri kontrol ediliyor..."
					);
					try {
						// SystemPreferences modülünü yükle
						const { systemPreferences } = require("electron");

						// Mikrofon izni kontrolü
						const microphoneStatus =
							systemPreferences.getMediaAccessStatus("microphone");
						console.log("[Main] Mikrofon erişim durumu:", microphoneStatus);

						// Mikrofon izni yoksa, kullanıcıya bilgi mesajı göster
						if (
							microphoneStatus !== "granted" &&
							options.audio?.captureDeviceAudio
						) {
							console.warn(
								"[Main] Mikrofon erişim izni verilmemiş. Ses kaydı yapılamayabilir."
							);
							// İzin istemeyi dene
							systemPreferences
								.askForMediaAccess("microphone")
								.then((granted) => {
									console.log(
										"[Main] Mikrofon erişimi istendi, sonuç:",
										granted
									);
								})
								.catch((err) => {
									console.error("[Main] Mikrofon erişimi isterken hata:", err);
								});
						}

						// Sistem sesi için ekran yakalama izinlerini kontrol et
						if (options.audio?.captureSystemAudio) {
							console.log(
								"[Main] Sistem sesi için ekran yakalama izinleri gerekli olabilir"
							);
						}
					} catch (permissionError) {
						console.warn(
							"[Main] Ses izinleri kontrol edilirken hata:",
							permissionError
						);
					}
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

				// MediaStateManager'dan mikrofon ayarlarını al
				if (mediaStateManager) {
					const audioSettings = mediaStateManager.state.audioSettings;
					console.log("[Main] MediaStateManager ses ayarları:", audioSettings);

					// Sadece mikrofonun etkin olması durumunda seçili mikrofon cihazını ayarla
					if (
						audioSettings.microphoneEnabled &&
						audioSettings.selectedAudioDevice
					) {
						// Ses cihazı ID'sini doğrudan recordingOptions.audioDeviceId'ye atayalım
						recordingOptions.audioDeviceId = audioSettings.selectedAudioDevice;
						console.log(
							"[Main] Mikrofon cihazı ayarlandı:",
							audioSettings.selectedAudioDevice
						);
					} else {
						console.log("[Main] Mikrofon devre dışı veya cihaz seçilmemiş");
						if (!audioSettings.microphoneEnabled) {
							recordingOptions.includeDeviceAudio = false;
						}
					}

					// Ses ayarlarını güncelle
					recordingOptions.audio = {
						// Önceki ayarlar
						...(recordingOptions.audio || {}),
						// Yeni ayarlar
						captureDeviceAudio: audioSettings.microphoneEnabled,
						captureSystemAudio: audioSettings.systemAudioEnabled,
					};

					// Ses captureDeviceAudio false olsa bile includeDeviceAudio'yu direkt etkilemeli
					recordingOptions.includeDeviceAudio = audioSettings.microphoneEnabled;
					recordingOptions.includeSystemAudio =
						audioSettings.systemAudioEnabled;

					// Açık bir şekilde "audio" parametresini true yap - aperture kütüphanesi bunu gerektirir
					if (
						audioSettings.systemAudioEnabled ||
						audioSettings.microphoneEnabled
					) {
						recordingOptions.audio = true;
					}

					console.log("[Main] Aperture ses ayarları güncellendi:", {
						audio: recordingOptions.audio, // Açık audio parametresi
						includeDeviceAudio: recordingOptions.includeDeviceAudio,
						includeSystemAudio: recordingOptions.includeSystemAudio,
						captureDeviceAudio: recordingOptions.audio.captureDeviceAudio,
						captureSystemAudio: recordingOptions.audio.captureSystemAudio,
						audioDeviceId: recordingOptions.audioDeviceId,
					});
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
		console.log("[Main] Kayıt durumu değişti:", status);

		// Tray manager güncelle
		if (trayManager) {
			trayManager.setRecordingStatus(status);
		}

		if (status) {
			console.log("[Main] Kayıt başlatılıyor...");
			startMouseTracking();
		} else {
			console.log("[Main] Kayıt durduruluyor...");
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
				console.log("[Main] Kayıt durduruldu, sonuç:", result);

				if (cameraManager) {
					cameraManager.closeCameraWindow();
				}

				// Medya dosyaları hazır olduğunda editor'ü aç
				if (result && editorManager) {
					try {
						// Editor'ü açmadan önce son bir kez daha medya dosyalarını kontrol et
						const mediaReady = mediaStateManager.isMediaReady();
						console.log("[Main] Medya hazır durumu:", mediaReady);

						// Pencere kaydı durumunda daha esnek olalım
						const isWindowRecording =
							mediaStateManager.state.recordingSource &&
							mediaStateManager.state.recordingSource.sourceType === "window";

						if (!mediaReady && !isWindowRecording) {
							console.warn(
								"[Main] Medya dosyaları hazır değil, editor açılmayacak"
							);
							console.log("[Main] Medya state:", mediaStateManager.getState());

							// Kullanıcıya bilgi ver
							if (mainWindow && !mainWindow.isDestroyed()) {
								mainWindow.show();
								mainWindow.webContents.send(
									IPC_EVENTS.RECORDING_ERROR,
									"Medya dosyaları hazırlanamadı. Lütfen tekrar kayıt yapmayı deneyin."
								);
							}

							return;
						}

						// Pencere kaydı için ekstra bilgi log'u
						if (isWindowRecording) {
							console.log(
								"[Main] Pencere kaydı algılandı, daha esnek doğrulama kullanılıyor"
							);
						}

						// Editor penceresini aç
						console.log("[Main] Editor penceresi açılıyor...");
						editorManager.createEditorWindow();
					} catch (error) {
						console.error("[main.cjs] Editor penceresi açılırken hata:", error);

						// Hata durumunda ana pencereyi göster ve kullanıcıya bilgi ver
						if (mainWindow && !mainWindow.isDestroyed()) {
							mainWindow.show();
							mainWindow.webContents.send(
								IPC_EVENTS.RECORDING_ERROR,
								"Editor penceresi açılamadı: " + error.message
							);
						}
					}
				} else {
					console.warn(
						"[Main] Medya işleme sonucu başarısız veya editorManager yok:",
						{
							result,
							hasEditorManager: !!editorManager,
						}
					);

					// Sonuç başarısız ise ana pencereyi göster
					if (mainWindow && !mainWindow.isDestroyed()) {
						mainWindow.show();

						// Kullanıcıya bilgi ver
						if (!result) {
							mainWindow.webContents.send(
								IPC_EVENTS.RECORDING_ERROR,
								"Kayıt işleme başarısız. Lütfen tekrar deneyin."
							);
						} else if (!editorManager) {
							mainWindow.webContents.send(
								IPC_EVENTS.RECORDING_ERROR,
								"Editor bileşeni başlatılamadı. Uygulamayı yeniden başlatmayı deneyin."
							);
						}
					}
				}
			}
		} catch (error) {
			console.error("[main.cjs] Kayıt durumu değiştirilirken hata:", error);

			// Hata durumunda ana pencereyi göster
			if (mainWindow && !mainWindow.isDestroyed()) {
				mainWindow.show();
				event.reply(
					IPC_EVENTS.RECORDING_ERROR,
					error.message || "Beklenmeyen bir hata oluştu"
				);
			}
		}
	});

	// Processing complete handler
	ipcMain.on(IPC_EVENTS.PROCESSING_COMPLETE, async (event, mediaData) => {
		console.log("[Main] İşleme tamamlandı bildirimi alındı:", mediaData);

		try {
			// MediaStateManager'ı güncelle
			if (mediaStateManager) {
				mediaStateManager.updateState({
					videoPath: mediaData.videoPath || null,
					audioPath: mediaData.audioPath || null,
					cameraPath: mediaData.cameraPath || null,
					isEditing: true,
					processingStatus: {
						isProcessing: false,
						progress: 100,
						error: null,
					},
				});
			}

			// Dosyalar gerçekten var mı kontrol et
			const mediaReady = mediaStateManager.isMediaReady();
			console.log("[Main] Medya hazır durumu:", mediaReady);

			// Editor'ü aç
			if (mediaReady && editorManager) {
				console.log("[Main] Editor penceresi açılıyor...");
				editorManager.createEditorWindow();
			} else {
				console.warn("[Main] Medya dosyaları hazır değil veya editor yok:", {
					mediaReady,
					hasEditorManager: !!editorManager,
				});
			}
		} catch (error) {
			console.error("[Main] İşleme tamamlandı handler'ında hata:", error);
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

	ipcMain.on(IPC_EVENTS.AREA_SELECTED, (event, selectedArea) => {
		console.log("[Main] Seçilen alan:", selectedArea);

		// Seçilen alanı mediaStateManager'a kaydet
		if (mediaStateManager) {
			try {
				mediaStateManager.updateState({
					selectedArea,
					recordingSource: {
						...(mediaStateManager.getState().recordingSource || {}),
						sourceType: "area",
					},
				});
				console.log("[Main] Seçilen alan mediaStateManager'a kaydedildi");
			} catch (error) {
				console.error("[Main] Alan kaydetme hatası:", error);
			}
		}

		// MainWindow'a seçilen alanı bildir
		if (mainWindow && !mainWindow.isDestroyed()) {
			try {
				mainWindow.webContents.send(IPC_EVENTS.AREA_SELECTED, selectedArea);
				console.log("[Main] Seçilen alan ana pencereye bildirildi");
			} catch (error) {
				console.error("[Main] Alan bildirme hatası:", error);
			}
		}

		// Seçim penceresini kapat
		if (selectionManager) {
			try {
				console.log("[Main] Seçim penceresi kapatılıyor...");
				selectionManager.closeSelectionWindow();
			} catch (error) {
				console.error("[Main] Pencere kapatma hatası:", error);
			}
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

	// Handle screenshot saving
	ipcMain.handle(
		IPC_EVENTS.SAVE_SCREENSHOT,
		async (event, imageData, filePath) => {
			try {
				if (!imageData || !filePath) {
					return { success: false, error: "Invalid image data or file path" };
				}

				// Remove data:image/png;base64, prefix if it exists
				const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");

				// Write the file
				const fs = require("fs");
				fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

				return { success: true };
			} catch (error) {
				console.error("Error saving screenshot:", error);
				return { success: false, error: error.message };
			}
		}
	);

	// Desktop capturer
	ipcMain.handle(
		IPC_EVENTS.DESKTOP_CAPTURER_GET_SOURCES,
		async (event, opts) => {
			try {
				const sources = await desktopCapturer.getSources(opts);

				// Ekstra bilgi ekle
				if (sources && sources.length) {
					try {
						// Aperture modülünden ekran listesini al
						const aperturePath = path.join(__dirname, "aperture.cjs");
						const apertureModule = await import(`file://${aperturePath}`);
						const apertureScreens = await apertureModule.getScreens();

						// Her kaynağa aperture ID'si ekle
						sources.forEach((source) => {
							// Ekran kaynağı ise
							if (source.id.startsWith("screen:")) {
								const matchingScreen = apertureScreens.find(
									(screen) =>
										screen.name &&
										source.name &&
										screen.name.includes(source.name)
								);

								if (matchingScreen) {
									source.apertureId = matchingScreen.id;
									source.apertureInfo = matchingScreen;
								}
							}
						});
					} catch (error) {
						console.warn("[Main] Aperture ID bilgisi eklenirken hata:", error);
					}
				}

				return sources;
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

	// Mikrofon cihazı değişikliğini dinle
	ipcMain.on(IPC_EVENTS.AUDIO_DEVICE_CHANGED, (event, deviceId) => {
		console.log("[main.cjs] Mikrofon cihazı değişikliği alındı:", deviceId);
		if (mediaStateManager) {
			mediaStateManager.updateAudioDevice(deviceId);
		}
	});

	// UPDATE_RECORDING_SOURCE
	ipcMain.on("UPDATE_RECORDING_SOURCE", (event, source) => {
		console.log("[Main] Kayıt kaynağı güncellendi:", source);
		recordingSource = {
			...recordingSource,
			...source,
		};

		// Media state manager üzerinden aktif kaynak ayarını güncelle
		if (mediaStateManager) {
			mediaStateManager.updateRecordingSource(recordingSource);
		}
	});

	// Aperture ekran listesi fonksiyonu
	ipcMain.handle("GET_APERTURE_SCREENS", async (event) => {
		try {
			console.log("[Main] Aperture ekran listesi alınıyor...");

			// Aperture modülünü yükle
			const aperturePath = path.join(__dirname, "aperture.cjs");
			const apertureModule = await import(`file://${aperturePath}`);

			// Ekran listesini al
			const screens = await apertureModule.getScreens();
			console.log("[Main] Aperture ekran listesi alındı:", screens);

			return screens;
		} catch (error) {
			console.error("[Main] Aperture ekran listesi alınamadı:", error);
			return [];
		}
	});

	// Aperture ekran ID doğrulama fonksiyonu
	ipcMain.handle("VALIDATE_APERTURE_SCREEN_ID", async (event, screenId) => {
		try {
			console.log("[Main] Aperture ekran ID doğrulanıyor:", screenId);

			// Aperture modülünü yükle
			const aperturePath = path.join(__dirname, "aperture.cjs");
			const apertureModule = await import(`file://${aperturePath}`);

			// ID'yi doğrula
			const isValid = await apertureModule.isValidScreenId(screenId);
			console.log("[Main] Aperture ekran ID doğrulama sonucu:", isValid);

			return isValid;
		} catch (error) {
			console.error("[Main] Aperture ekran ID doğrulanamadı:", error);
			return false;
		}
	});

	// Seçim penceresini kapatma olayı
	ipcMain.on("CLOSE_SELECTION_WINDOW", () => {
		console.log("[Main] CLOSE_SELECTION_WINDOW olayı alındı");
		if (selectionManager) {
			try {
				console.log("[Main] Seçim penceresi kapatılıyor (ESC tuşu)");
				selectionManager.closeSelectionWindow();
			} catch (error) {
				console.error("[Main] Pencere kapatma hatası (ESC):", error);
			}
		}
	});

	// Dialog handlers for layout management
	ipcMain.handle("SHOW_PROMPT", async (event, options) => {
		if (!mainWindow) return null;

		const { title, message, defaultValue } = options;

		// Create a simple HTML prompt dialog
		const promptWindow = new BrowserWindow({
			width: 400,
			height: 200,
			parent: mainWindow,
			modal: true,
			show: false,
			resizable: false,
			minimizable: false,
			maximizable: false,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
			},
		});

		// Load HTML content
		promptWindow.loadURL(`data:text/html,
			<html>
			<head>
				<title>${title || "Giriş"}</title>
				<style>
					body {
						font-family: system-ui, -apple-system, sans-serif;
						background-color: #1f2937;
						color: white;
						padding: 20px;
						margin: 0;
						display: flex;
						flex-direction: column;
						height: 100vh;
					}
					h3 {
						margin-top: 0;
						margin-bottom: 15px;
					}
					input {
						padding: 8px;
						margin-bottom: 20px;
						background-color: #374151;
						border: 1px solid #4b5563;
						color: white;
						border-radius: 4px;
					}
					.buttons {
						display: flex;
						justify-content: flex-end;
						gap: 10px;
					}
					button {
						padding: 8px 16px;
						border: none;
						border-radius: 4px;
						cursor: pointer;
					}
					.cancel {
						background-color: #4b5563;
						color: white;
					}
					.ok {
						background-color: #2563eb;
						color: white;
					}
				</style>
			</head>
			<body>
				<h3>${message || "Lütfen bir değer girin:"}</h3>
				<input id="prompt-input" type="text" value="${defaultValue || ""}" autofocus />
				<div class="buttons">
					<button class="cancel" onclick="cancel()">İptal</button>
					<button class="ok" onclick="ok()">Tamam</button>
				</div>
				<script>
					const input = document.getElementById('prompt-input');
					input.select();
					
					function cancel() {
						window.promptResult = null;
						window.close();
					}
					
					function ok() {
						window.promptResult = input.value;
						window.close();
					}
					
					// Handle Enter key
					input.addEventListener('keyup', (e) => {
						if (e.key === 'Enter') ok();
						if (e.key === 'Escape') cancel();
					});
				</script>
			</body>
			</html>
		`);

		// Show window
		promptWindow.once("ready-to-show", () => {
			promptWindow.show();
		});

		// Wait for window to close and get result
		return new Promise((resolve) => {
			promptWindow.on("closed", () => {
				resolve(
					promptWindow.webContents.executeJavaScript("window.promptResult")
				);
			});
		});
	});

	ipcMain.handle("SHOW_CONFIRM", async (event, options) => {
		if (!mainWindow) return 0;

		const { title, message, buttons } = options;
		const result = await dialog.showMessageBox(mainWindow, {
			type: "question",
			buttons: buttons || ["İptal", "Tamam"],
			defaultId: 1,
			cancelId: 0,
			title: title || "Onay",
			message: message || "Bu işlemi yapmak istediğinize emin misiniz?",
		});

		return result.response;
	});

	// Store handlers
	ipcMain.handle("STORE_GET", async (event, key) => {
		try {
			// You can implement your own storage solution here
			// For now, we'll use a simple in-memory store
			const store = global.store || {};
			return store[key];
		} catch (error) {
			console.error(`[Main] Error getting store value for key ${key}:`, error);
			return null;
		}
	});

	ipcMain.handle("STORE_SET", async (event, key, value) => {
		try {
			// You can implement your own storage solution here
			// For now, we'll use a simple in-memory store
			global.store = global.store || {};
			global.store[key] = value;
			return true;
		} catch (error) {
			console.error(`[Main] Error setting store value for key ${key}:`, error);
			return false;
		}
	});

	// Dosya koruma işlemleri için IPC olayları
	ipcMain.handle(IPC_EVENTS.PROTECT_FILE, (event, filePath) => {
		if (tempFileManager) {
			return tempFileManager.protectFile(filePath);
		}
		return false;
	});

	ipcMain.handle(IPC_EVENTS.UNPROTECT_FILE, (event, filePath) => {
		if (tempFileManager) {
			return tempFileManager.unprotectFile(filePath);
		}
		return false;
	});

	ipcMain.handle(IPC_EVENTS.GET_PROTECTED_FILES, () => {
		if (tempFileManager) {
			return tempFileManager.getProtectedFiles();
		}
		return [];
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
	// İzinleri başlangıçta kontrol et ve iste
	checkAndRequestPermissions();
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

/**
 * Uygulama başlangıcında gerekli tüm izinleri kontrol eder
 */
async function checkAndRequestPermissions() {
	// macOS'ta izin kontrolü yapılır
	if (process.platform === "darwin") {
		try {
			const { systemPreferences } = require("electron");

			// Sadece izinleri kontrol et, otomatik olarak isteme
			console.log("[Main] Kamera izinleri kontrol ediliyor...");
			const cameraStatus = systemPreferences.getMediaAccessStatus("camera");
			console.log("[Main] Kamera erişim durumu:", cameraStatus);

			console.log("[Main] Mikrofon izinleri kontrol ediliyor...");
			const microphoneStatus =
				systemPreferences.getMediaAccessStatus("microphone");
			console.log("[Main] Mikrofon erişim durumu:", microphoneStatus);

			console.log(
				"[Main] Ekran kaydı için sistem izinleri otomatik olarak istenemez. İlk kayıtta sistem tarafından sorulacaktır."
			);
		} catch (error) {
			console.error("[Main] İzinler kontrol edilirken hata:", error);
		}
	} else {
		console.log("[Main] İzin kontrolü sadece macOS için gereklidir.");
	}
}

/**
 * Mevcut izin durumlarını kontrol eder ve döndürür
 */
async function checkPermissionStatus() {
	// Windows veya Linux'ta izin kontrolü gerekmez
	if (process.platform !== "darwin") {
		return {
			camera: "granted",
			microphone: "granted",
			screen: "granted",
		};
	}

	try {
		const { systemPreferences } = require("electron");

		// Kamera ve mikrofon durumlarını doğrudan kontrol et
		const cameraStatus = systemPreferences.getMediaAccessStatus("camera");
		const microphoneStatus =
			systemPreferences.getMediaAccessStatus("microphone");

		// Ekran kaydı için izin durumu kontrol edilemez, sadece ilk kullanımda sistem tarafından sorulur
		// "unknown" olarak döndür ve UI'da uygun bilgilendirme yap
		const screenStatus = "unknown";

		return {
			camera: cameraStatus,
			microphone: microphoneStatus,
			screen: screenStatus,
		};
	} catch (error) {
		console.error("[Main] İzin durumları kontrol edilirken hata:", error);
		return {
			camera: "unknown",
			microphone: "unknown",
			screen: "unknown",
			error: error.message,
		};
	}
}
