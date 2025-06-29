const { IPC_EVENTS } = require("./constants.cjs");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");

class MediaStateManager {
	constructor(mainWindow) {
		this.mainWindow = mainWindow;
		this.state = {
			videoPath: null,
			audioPath: null,
			cameraPath: null,
			systemAudioPath: null,
			cursorPath: null,
			lastRecordingTime: null,
			isEditing: false,
			isRecording: false,
			recordingStartTime: null,
			selectedArea: null,
			recordingSource: {
				sourceType: "display",
				sourceId: null,
				sourceName: null,
				macRecorderId: null,
			},
			audioSettings: {
				microphoneEnabled: true,
				systemAudioEnabled: true,
				selectedAudioDevice: null,
				microphoneLevel: 0,
			},
			processingStatus: {
				isProcessing: false,
				progress: 0,
				error: null,
			},
		};
		this.recordingCheckInterval = null;
		this.fileCheckAttempts = 0;
		this.maxFileCheckAttempts = 50; // 5 saniye (100ms * 50)
		this.mousePositions = [];
	}

	updateRecordingStatus(statusData) {
		try {
			console.log(
				"[MediaStateManager] Kayıt durumu güncelleniyor:",
				statusData
			);

			// Kayıt tipine göre işlem yap
			if (statusData.type === "screen") {
				// Ekran kaydı durumu
				if (typeof statusData.isActive === "boolean") {
					this.state.isRecording = statusData.isActive;

					if (statusData.isActive) {
						// Kayıt başladı
						this.state.recordingStartTime = Date.now();
					} else {
						// Kayıt durdu
						this.state.lastRecordingTime =
							Date.now() - (this.state.recordingStartTime || Date.now());
					}
				}

				// Dosya boyutu bilgisi varsa güncelle
				if (statusData.fileSize) {
					console.log(
						`[MediaStateManager] Ekran kaydı dosya boyutu: ${(
							statusData.fileSize /
							(1024 * 1024)
						).toFixed(2)}MB`
					);
				}
			} else if (statusData.type === "camera") {
				// Kamera kaydı durumu
				if (typeof statusData.isActive === "boolean" && !statusData.isActive) {
					// Kamera kaydı durduğunda, dosya yolunu kontrol et
					if (statusData.filePath) {
						this.state.cameraPath = statusData.filePath;
					}
				}
			} else if (statusData.type === "audio") {
				// Ses kaydı durumu
				if (typeof statusData.isActive === "boolean" && !statusData.isActive) {
					// Ses kaydı durduğunda, dosya yolunu kontrol et
					if (statusData.filePath) {
						this.state.audioPath = statusData.filePath;
					}
				}
			}

			// Ana pencereye bildir
			if (this.mainWindow && this.mainWindow.webContents) {
				this.mainWindow.webContents.send(IPC_EVENTS.RECORDING_STATUS_UPDATE, {
					...statusData,
					isRecording: this.state.isRecording,
					recordingTime: this.state.lastRecordingTime,
				});
			}
		} catch (error) {
			console.error(
				"[MediaStateManager] Kayıt durumu güncellenirken hata:",
				error
			);
		}
	}

	async validateMediaFile(filePath, type = "unknown", silent = false) {
		if (!silent) {
			console.log(
				`[MediaStateManager] Dosya kontrolü başladı - ${type}:`,
				filePath
			);
		}

		try {
			if (!filePath) {
				if (!silent)
					console.log(`[MediaStateManager] Dosya yolu boş - ${type}`);
				return false;
			}

			// Dosya var mı kontrol et
			let fileExists = false;
			try {
				await fs.promises.access(filePath, fs.constants.R_OK);
				fileExists = true;
			} catch (accessError) {
				if (!silent)
					console.log(
						`[MediaStateManager] Dosyaya erişilemiyor - ${type}:`,
						accessError.message
					);
				return false;
			}

			if (!fileExists) {
				if (!silent)
					console.log(
						`[MediaStateManager] Dosya bulunamadı - ${type}:`,
						filePath
					);
				return false;
			}

			// Dosya boyutunu kontrol et
			const stats = await fs.promises.stat(filePath);
			if (!silent) {
				console.log(`[MediaStateManager] Dosya boyutu - ${type}:`, {
					path: filePath,
					size: stats.size,
					sizeInMB: (stats.size / (1024 * 1024)).toFixed(2) + "MB",
					exists: fileExists,
				});
			}

			// Dosya 0 byte değilse geçerli kabul et
			if (stats.size === 0) {
				if (!silent)
					console.log(`[MediaStateManager] Dosya boş - ${type}:`, stats.size);
				return false;
			}

			// Pencere kaydı durumunda daha basit bir doğrulama yap
			// MacRecorder kayıtlarında bazı dosyalar tam oluşmayabilir
			if (
				this.state.recordingSource &&
				this.state.recordingSource.sourceType === "window"
			) {
				console.log(
					`[MediaStateManager] Pencere kaydı için basitleştirilmiş doğrulama yapılıyor - ${type}`
				);
				// Dosya var ve boyutu 0'dan büyükse geçerli kabul et
				if (fileExists && stats.size > 0) {
					return true;
				}
			}

			// Dosya okuma testi - daha basit bir yaklaşım kullan
			try {
				// Sadece ilk 1024 byte'ı okumayı dene
				const fd = await fs.promises.open(filePath, "r");
				const buffer = Buffer.alloc(1024);
				const { bytesRead } = await fd.read(buffer, 0, 1024, 0);
				await fd.close();

				if (bytesRead <= 0) {
					if (!silent)
						console.log(`[MediaStateManager] Dosya okunamıyor - ${type}`);
					return false;
				}
			} catch (readError) {
				// Dosya okuma hatası kritik değil, dosya var ve boyutu 0'dan büyükse geçerli kabul et
				console.warn(
					`[MediaStateManager] Dosya okuma hatası - ${type}, ancak dosya mevcut olduğu için devam ediliyor:`,
					readError.message
				);
				return fileExists && stats.size > 0;
			}

			if (!silent) console.log(`[MediaStateManager] Dosya geçerli - ${type}`);
			return true;
		} catch (error) {
			if (!silent)
				console.error(
					`[MediaStateManager] Dosya kontrolü sırasında hata - ${type}:`,
					error
				);
			// Hata durumunda bile, dosya var ve boyutu 0'dan büyükse geçerli kabul et
			try {
				if (fs.existsSync(filePath)) {
					const stats = fs.statSync(filePath);
					if (stats.size > 0) {
						console.log(
							`[MediaStateManager] Hata olmasına rağmen dosya mevcut ve boyutu > 0 - ${type}`
						);
						return true;
					}
				}
			} catch (e) {
				// İkincil hata kontrolünde de sorun çıkarsa false dön
			}
			return false;
		}
	}

	async waitForMediaFiles(tempFileManager, maxWaitTime = 20000) {
		console.log("[MediaStateManager] Medya dosyaları bekleniyor...");
		const startTime = Date.now();
		let lastProgress = 0;
		this.fileCheckAttempts = 0;
		const maxAttempts = 100; // Maksimum deneme sayısını sınırla

		// Bekleme işlemi başladığında state bilgisini güncelle
		this.updateState({
			processingStatus: {
				isProcessing: true,
				progress: 0,
				error: null,
			},
		});

		return new Promise((resolve) => {
			const checkFiles = async () => {
				this.fileCheckAttempts++;

				const videoPath =
					tempFileManager.getFilePath("screen") ||
					tempFileManager.getFilePath("video");
				const audioPath = tempFileManager.getFilePath("audio");
				const cameraPath = tempFileManager.getFilePath("camera");
				const elapsedTime = Date.now() - startTime;

				// Belirli aralıklarla log bilgisi göster
				if (this.fileCheckAttempts % 10 === 0 || this.fileCheckAttempts <= 5) {
					console.log(
						"[MediaStateManager] Dosya kontrolü #" + this.fileCheckAttempts
					);
					console.log("[MediaStateManager] Dosya durumları:", {
						video: {
							path: videoPath,
							exists: videoPath ? fs.existsSync(videoPath) : false,
							size:
								videoPath && fs.existsSync(videoPath)
									? fs.statSync(videoPath).size
									: 0,
						},
						audio: {
							path: audioPath,
							exists: audioPath ? fs.existsSync(audioPath) : false,
							size:
								audioPath && fs.existsSync(audioPath)
									? fs.statSync(audioPath).size
									: 0,
						},
						camera: {
							path: cameraPath,
							exists: cameraPath ? fs.existsSync(cameraPath) : false,
							size:
								cameraPath && fs.existsSync(cameraPath)
									? fs.statSync(cameraPath).size
									: 0,
						},
					});
				}

				// UI için ilerleme durumunu güncelle
				const progress = Math.min((elapsedTime / maxWaitTime) * 100, 99);
				if (Math.abs(progress - lastProgress) >= 5) {
					this.updateState({
						processingStatus: {
							isProcessing: true,
							progress: Math.round(progress),
							error: null,
						},
					});
					lastProgress = progress;
				}

				// Kaynak türü pencere ise özel işlem yap
				const isWindowSource =
					this.state.recordingSource &&
					this.state.recordingSource.sourceType === "window";

				// Video dosyasını kontrol et
				if (videoPath && fs.existsSync(videoPath)) {
					const isValid = await this.validateMediaFile(
						videoPath,
						"video",
						this.fileCheckAttempts > 5
					);

					if (isValid) {
						clearInterval(this.recordingCheckInterval);

						// Dosyanın tamamen yazılmasını bekle
						await new Promise((resolve) => setTimeout(resolve, 500));

						// Son bir kontrol daha yap
						const finalCheck = await this.validateMediaFile(
							videoPath,
							"final-video",
							false
						);

						if (
							!finalCheck &&
							!isWindowSource &&
							this.fileCheckAttempts < maxAttempts
						) {
							console.log(
								"[MediaStateManager] Video tam doğrulanamadı, tekrar deneniyor..."
							);
							return; // Devam et
						}

						// Pencere kaydı için daha esnek davran
						if (isWindowSource) {
							console.log(
								"[MediaStateManager] Pencere kaydı için esnek doğrulama yapılıyor..."
							);
						}

						// Videonun nihai yolu – önce ekran kaydını dene, geçersizse video kaydına düş
						let finalVideoPath = tempFileManager.getFilePath("screen");

						try {
							if (
								!finalVideoPath ||
								!fs.existsSync(finalVideoPath) ||
								fs.statSync(finalVideoPath).size === 0
							) {
								// Geçersiz ya da boşsa video türüne (webm vb.) geç
								finalVideoPath = tempFileManager.getFilePath("video");
							}
						} catch (_) {
							// stat hatası – video yolunu deneyelim
							finalVideoPath = tempFileManager.getFilePath("video");
						}

						// Tüm dosya yollarını tekrar al
						const finalAudioPath = tempFileManager.getFilePath("audio");
						const finalCameraPath = tempFileManager.getFilePath("camera");

						console.log("[MediaStateManager] Son dosya yolları:", {
							video: finalVideoPath,
							audio: finalAudioPath,
							camera: finalCameraPath,
						});

						// Ses ve kamera dosyalarını kontrol et
						const isAudioValid = finalAudioPath
							? await this.validateMediaFile(finalAudioPath, "audio", false)
							: false;

						let isCameraValid = false;
						if (finalCameraPath && fs.existsSync(finalCameraPath)) {
							isCameraValid = await this.validateMediaFile(
								finalCameraPath,
								"camera",
								false
							);
						}

						const result = {
							success: true,
							videoPath: finalVideoPath,
							audioPath: isAudioValid ? finalAudioPath : null,
							cameraPath: isCameraValid ? finalCameraPath : null,
						};

						console.log("[MediaStateManager] Medya dosyaları hazır:", {
							video: {
								path: result.videoPath,
								valid: true,
							},
							audio: {
								path: result.audioPath,
								valid: !!result.audioPath,
							},
							camera: {
								path: result.cameraPath,
								valid: !!result.cameraPath,
							},
						});

						// İlerleme durumunu %100 olarak güncelle
						this.updateState({
							processingStatus: {
								isProcessing: false,
								progress: 100,
								error: null,
							},
						});

						resolve(result);
						return;
					}
				}

				// Maksimum deneme sayısını veya zaman aşımını kontrol et
				if (
					this.fileCheckAttempts >= maxAttempts ||
					elapsedTime >= maxWaitTime
				) {
					clearInterval(this.recordingCheckInterval);
					console.warn(
						"[MediaStateManager] Dosya bekleme süresi/deneme aşıldı:",
						{
							attempts: this.fileCheckAttempts,
							elapsedTime,
						}
					);

					// Son bir şans olarak pencere kaydı için esnek bir yaklaşım deneyelim
					if (isWindowSource && videoPath && fs.existsSync(videoPath)) {
						console.log(
							"[MediaStateManager] Pencere kaydı için son bir şans doğrulaması yapılıyor..."
						);
						const stats = fs.statSync(videoPath);

						if (stats.size > 0) {
							console.log(
								"[MediaStateManager] Pencere kaydı dosyası mevcut ve boyutu > 0, esnek doğrulama geçti"
							);

							// Tüm dosya yollarını tekrar al
							const finalVideoPath = videoPath;
							const finalAudioPath =
								audioPath && fs.existsSync(audioPath) ? audioPath : null;
							const finalCameraPath =
								cameraPath && fs.existsSync(cameraPath) ? cameraPath : null;

							const result = {
								success: true,
								videoPath: finalVideoPath,
								audioPath: finalAudioPath,
								cameraPath: finalCameraPath,
							};

							resolve(result);
							return;
						}
					}

					// Hata durumunda bile kullanılabilir dosyaları dön
					const availableFiles = {
						success: false,
						error: `Medya dosyaları hazırlanamadı (${this.fileCheckAttempts} deneme)`,
						videoPath: videoPath && fs.existsSync(videoPath) ? videoPath : null,
						audioPath: audioPath && fs.existsSync(audioPath) ? audioPath : null,
						cameraPath:
							cameraPath && fs.existsSync(cameraPath) ? cameraPath : null,
					};

					// Eğer video dosyası mevcutsa ve boyutu 0'dan büyükse, başarılı kabul et
					if (availableFiles.videoPath) {
						try {
							const videoStats = fs.statSync(availableFiles.videoPath);
							if (videoStats.size > 0) {
								console.log(
									"[MediaStateManager] Video dosyası mevcut ve boyutu > 0, hata durumunda bile kullanılabilir"
								);
								availableFiles.success = true;
								availableFiles.error = null;
							}
						} catch (e) {
							// İstatistik alınamazsa devam et
						}
					}

					// Hata durumunu güncelle
					this.updateState({
						processingStatus: {
							isProcessing: false,
							progress: 0,
							error: availableFiles.success ? null : availableFiles.error,
						},
					});

					resolve(availableFiles);
				}
			};

			// Her 100ms'de bir kontrol et
			this.recordingCheckInterval = setInterval(checkFiles, 100);
			// İlk kontrolü hemen yap
			checkFiles();
		});
	}

	updateState(newState) {
		const oldState = { ...this.state };
		this.state = {
			...this.state,
			...newState,
		};

		console.log("MediaState güncellendi:", {
			oldState,
			newState,
			currentState: this.state,
		});

		this.notifyRenderers();
	}

	resetState() {
		console.log("MediaState sıfırlanıyor...");

		// Kaynak seçimi ve ses ayarlarını koru
		const preservedRecordingSource = { ...this.state.recordingSource };
		const preservedAudioSettings = { ...this.state.audioSettings };

		this.state = {
			cameraPath: null,
			videoPath: null,
			audioPath: null,
			systemAudioPath: null,
			cursorPath: null,
			lastRecordingTime: null,
			isEditing: false,
			isRecording: false,
			recordingStartTime: null,
			selectedArea: null,
			recordingSource: preservedRecordingSource, // Kaynak seçimini koru
			audioSettings: preservedAudioSettings, // Ses ayarlarını koru
			processingStatus: {
				isProcessing: false,
				progress: 0,
				error: null,
			},
		};

		console.log(
			"MediaState sıfırlandı, korunan kaynak:",
			preservedRecordingSource
		);
		this.notifyRenderers();
	}

	getState() {
		return { ...this.state };
	}

	notifyRenderers(window = this.mainWindow) {
		if (window && !window.isDestroyed()) {
			try {
			} catch (error) {
				console.error("State güncellenirken hata:", error);
			}
		}
	}

	async handleRecordingStatusChange(status, tempFileManager) {
		console.log("[MediaStateManager] Kayıt durumu değişiyor:", {
			status,
			currentState: this.state,
		});

		try {
			if (status) {
				// Kayıt başladığında
				if (this.recordingCheckInterval) {
					clearInterval(this.recordingCheckInterval);
				}

				// Önceki kayıtları temizle
				this.resetState();

				this.updateState({
					isRecording: true,
					recordingStartTime: new Date().toISOString(),
				});

				if (this.mainWindow) this.mainWindow.hide();
			} else {
				// Kayıt bittiğinde
				this.updateState({
					isRecording: false,
					processingStatus: {
						isProcessing: true,
						progress: 0,
						error: null,
					},
				});

				// Medya dosyalarını bekle ve kontrol et
				const result = await this.waitForMediaFiles(tempFileManager);

				if (result.success) {
					// Interval'i temizle
					if (this.recordingCheckInterval) {
						clearInterval(this.recordingCheckInterval);
						this.recordingCheckInterval = null;
					}

					console.log("-------4", result.cameraPath);

					this.updateState({
						videoPath: result.videoPath,
						audioPath: result.audioPath,
						cameraPath: result.cameraPath,
						lastRecordingTime: new Date().toISOString(),
						isEditing: true,
						processingStatus: {
							isProcessing: false,
							progress: 100,
							error: null,
						},
					});

					// Son bir kez daha dosyaları kontrol et
					if (!this.isMediaReady()) {
						throw new Error("Medya dosyaları doğrulanamadı");
					}

					console.log(
						"[MediaStateManager] Medya dosyaları hazır ve doğrulandı:",
						{
							videoPath: result.videoPath,
							audioPath: result.audioPath,
							cameraPath: result.cameraPath,
						}
					);

					// Editor'e bildirim gönder
					if (this.mainWindow && !this.mainWindow.isDestroyed()) {
						this.mainWindow.webContents.send(IPC_EVENTS.PROCESSING_COMPLETE, {
							videoPath: result.videoPath,
							audioPath: result.audioPath,
							cameraPath: result.cameraPath,
						});

						this.mainWindow.webContents.send(IPC_EVENTS.MEDIA_PATHS, {
							videoPath: result.videoPath,
							audioPath: result.audioPath,
							cameraPath: result.cameraPath,
						});

						// Editor açıldıktan sonra kontrolleri durdur
						this.cleanup();
					}

					return true;
				} else {
					throw new Error(result.error || "Medya dosyaları hazırlanamadı");
				}
			}
		} catch (error) {
			console.error(
				"[MediaStateManager] Kayıt durumu değiştirilirken hata:",
				error
			);
			this.updateState({
				processingStatus: {
					isProcessing: false,
					progress: 0,
					error: error.message,
				},
			});

			if (this.mainWindow && !this.mainWindow.isDestroyed()) {
				this.mainWindow.webContents.send(
					IPC_EVENTS.RECORDING_ERROR,
					error.message
				);
			}

			return false;
		}
	}

	isMediaReady() {
		console.log("[MediaStateManager] Medya hazırlık kontrolü başlıyor");

		// Video yolu var mı?
		if (!this.state.videoPath) {
			console.error("[MediaStateManager] Video dosya yolu bulunamadı");
			return false;
		}

		try {
			// Senkron dosya kontrolü yap
			if (!fs.existsSync(this.state.videoPath)) {
				console.error(
					"[MediaStateManager] Video dosyası bulunamadı:",
					this.state.videoPath
				);
				return false;
			}

			// Dosya boyutu kontrol et
			const stats = fs.statSync(this.state.videoPath);
			console.log("[MediaStateManager] Video dosya boyutu:", {
				path: this.state.videoPath,
				size: stats.size,
				sizeInMB: (stats.size / (1024 * 1024)).toFixed(2) + "MB",
			});

			if (stats.size < 1024) {
				console.error(
					"[MediaStateManager] Video dosyası çok küçük:",
					stats.size
				);
				return false;
			}

			// Başarılı
			console.log(
				"[MediaStateManager] Video dosyası hazır:",
				this.state.videoPath
			);
			return true;
		} catch (error) {
			console.error("[MediaStateManager] Medya kontrolü hatası:", error);
			return false;
		}
	}

	cleanup() {
		if (this.recordingCheckInterval) {
			clearInterval(this.recordingCheckInterval);
			this.recordingCheckInterval = null;
		}
		this.clearMousePositions();
		// Temizlik sırasında son log durumlarını da sıfırla
		if (this._lastLoggedPaths) {
			this._lastLoggedPaths = {};
		}
	}

	updateAudioSettings(settings) {
		console.log("[MediaStateManager] Ses ayarları güncelleniyor:", settings);
		this.updateState({
			audioSettings: {
				...this.state.audioSettings,
				...settings,
			},
		});
	}

	updateAudioDevice(deviceId) {
		console.log("[MediaStateManager] Mikrofon cihazı güncelleniyor:", deviceId);
		this.updateState({
			audioSettings: {
				...this.state.audioSettings,
				selectedAudioDevice: deviceId,
			},
		});

		// Ana pencereye bildirim gönder
		if (this.mainWindow && !this.mainWindow.isDestroyed()) {
			this.mainWindow.webContents.send(IPC_EVENTS.AUDIO_STATUS_CHANGED, {
				deviceId: deviceId,
				status: "changed",
			});
		}
	}

	updateMicrophoneLevel(level) {
		if (this.state.audioSettings.microphoneEnabled) {
			this.updateState({
				audioSettings: {
					...this.state.audioSettings,
					microphoneLevel: level,
				},
			});
		}
	}

	toggleMicrophone() {
		this.updateState({
			audioSettings: {
				...this.state.audioSettings,
				microphoneEnabled: !this.state.audioSettings.microphoneEnabled,
			},
		});
	}

	toggleSystemAudio() {
		this.updateState({
			audioSettings: {
				...this.state.audioSettings,
				systemAudioEnabled: !this.state.audioSettings.systemAudioEnabled,
			},
		});
	}

	setAudioDevice(deviceId) {
		this.updateState({
			audioSettings: {
				...this.state.audioSettings,
				selectedAudioDevice: deviceId,
			},
		});
	}

	// Kayıt kaynağı ayarlarını güncelleme
	updateRecordingSource(source) {
		if (!source) {
			console.warn("[MediaStateManager] Kaynak bilgisi null veya undefined");
			return;
		}

		console.log("[MediaStateManager] Kayıt kaynağı güncelleniyor:", source);

		// Kaynak ID'si kontrolü
		if (source.sourceId) {
			// sourceId formatını kontrol et
			if (
				typeof source.sourceId === "string" &&
				(source.sourceId.startsWith("screen:") ||
					source.sourceId.startsWith("window:") ||
					!isNaN(Number(source.sourceId))) // Sayısal ID'ler de kabul et
			) {
				console.log(
					"[MediaStateManager] Geçerli kaynak ID'si:",
					source.sourceId
				);
			} else {
				console.warn(
					"[MediaStateManager] Kaynak ID'si uygun formatta değil:",
					source.sourceId,
					"typeof:",
					typeof source.sourceId
				);
			}
		} else {
			console.warn("[MediaStateManager] Kaynak ID'si belirtilmemiş");
		}

		// MacRecorder ID varsa kullan
		if (source.macRecorderId) {
			console.log(
				"[MediaStateManager] MacRecorder ID kullanılıyor:",
				source.macRecorderId
			);
		}

		// Kaynak türünü belirle (window, screen, area)
		let sourceType = source.sourceType || "screen"; // varsayılan screen
		if (!source.sourceType && typeof source.sourceId === "string") {
			if (source.sourceId.startsWith("window:")) {
				sourceType = "window";
			} else if (source.sourceId.startsWith("screen:")) {
				sourceType = "screen";
			}
		}

		// State'i güncelle
		const newRecordingSource = {
			sourceType: sourceType,
			sourceId: source.sourceId || null,
			sourceName: source.sourceName || null,
			macRecorderId: source.macRecorderId ?? null, // 🔧 macRecorderId 0 olabilir!
		};

		this.updateState({
			recordingSource: newRecordingSource,
		});

		// State'e kaydedilen güncel değeri kontrol et
		console.log(
			"[MediaStateManager] Kaydedilen kaynak bilgisi:",
			this.state.recordingSource
		);

		// Kaynak türüne göre özel işlemleri yap
		if (sourceType === "area" && this.mainWindow) {
			console.log("[MediaStateManager] Alan seçimi kaynağı güncellendi");
		}

		// Ana pencereye kaynak güncelleme bilgisini gönder
		if (this.mainWindow && this.mainWindow.webContents) {
			this.mainWindow.webContents.send(
				"RECORDING_SOURCE_UPDATED",
				newRecordingSource
			);
		}
	}

	addMousePosition(position) {
		if (!this.mousePositions) {
			this.mousePositions = [];
		}

		// Pozisyon verilerini kaydet
		this.mousePositions.push({
			x: position.x,
			y: position.y,
			timestamp: position.timestamp,
			cursorType: position.cursorType || "default",
			type: position.type || "move",
			button: position.button,
			clickCount: position.clickCount,
			rotation: position.rotation,
			direction: position.direction,
		});
	}

	getMousePositions() {
		return this.mousePositions;
	}

	clearMousePositions() {
		this.mousePositions = [];
	}

	async saveCursorData(tempFileManager) {
		// DUPLICATE CHECK - zaten kaydedilmişse skip et
		if (this.state.cursorPath) {
			console.log(
				"[MediaStateManager] ⚠️ Cursor verisi zaten kaydedilmiş, skip ediliyor:",
				this.state.cursorPath
			);
			return this.state.cursorPath;
		}

		if (this.mousePositions.length === 0) {
			console.log("[MediaStateManager] Kaydedilecek cursor verisi yok");
			return null;
		}

		try {
			console.log("[MediaStateManager] Cursor verisi kaydediliyor...", {
				positionCount: this.mousePositions.length,
			});

			const cursorData = JSON.stringify(this.mousePositions);
			const cursorPath = await tempFileManager.saveTempFile(
				cursorData,
				"cursor",
				".json"
			);

			console.log("[MediaStateManager] Cursor verisi kaydedildi:", {
				path: cursorPath,
				size: cursorData.length,
			});

			this.updateState({
				cursorPath,
			});

			return cursorPath;
		} catch (error) {
			console.error(
				"[MediaStateManager] Cursor verisi kaydedilirken hata:",
				error
			);
			return null;
		}
	}

	async loadCursorData() {
		if (!this.state.cursorPath) {
			console.log("[MediaStateManager] Cursor dosya yolu bulunamadı");
			return [];
		}

		try {
			console.log(
				"[MediaStateManager] Cursor verisi okunuyor:",
				this.state.cursorPath
			);

			const cursorData = await fs.promises.readFile(
				this.state.cursorPath,
				"utf8"
			);

			const positions = JSON.parse(cursorData);
			console.log("[MediaStateManager] Cursor verisi yüklendi:", {
				path: this.state.cursorPath,
				positionCount: positions.length,
			});

			return positions;
		} catch (error) {
			console.error("[MediaStateManager] Cursor verisi okunurken hata:", error);
			return [];
		}
	}

	async saveVideo(event, data) {
		try {
			const { filePath, segments, videoPath, audioPath, systemAudioPath } =
				data;

			// Dosyaların varlığını kontrol et
			const files = [videoPath, audioPath, systemAudioPath].filter(Boolean);
			const fileChecks = await Promise.all(
				files.map(async (file) => {
					try {
						await fs.access(file, fs.constants.R_OK);
						return true;
					} catch {
						return false;
					}
				})
			);

			if (fileChecks.includes(false)) {
				console.error("Some input files are not accessible");
				// Dosyaların hazır olması için bekle
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}

			// Maksimum 3 deneme hakkı
			let attempts = 0;
			const maxAttempts = 3;

			while (attempts < maxAttempts) {
				try {
					// Geçici dosya oluştur
					const tempOutputPath = path.join(
						os.tmpdir(),
						`temp_output_${Date.now()}.mp4`
					);

					// FFmpeg komutunu hazırla
					const command = this.createFFmpegCommand(
						segments,
						videoPath,
						audioPath,
						systemAudioPath,
						tempOutputPath
					);

					// FFmpeg'i çalıştır
					await new Promise((resolve, reject) => {
						exec(command, (error, stdout, stderr) => {
							if (error) {
								console.error(`FFmpeg error (attempt ${attempts + 1}):`, error);
								reject(error);
							} else {
								resolve();
							}
						});
					});

					// Geçici dosyanın varlığını kontrol et
					await fs.access(tempOutputPath, fs.constants.R_OK);

					// Dosya boyutunu kontrol et
					const stats = await fs.stat(tempOutputPath);
					if (stats.size === 0) {
						throw new Error("Output file is empty");
					}

					// Başarılı olursa dosyayı hedef konuma taşı
					await fs.rename(tempOutputPath, filePath);

					// Başarılı
					event.reply("SAVE_VIDEO_STATUS", { success: true });
					return;
				} catch (error) {
					attempts++;
					console.error(`Export attempt ${attempts} failed:`, error);

					if (attempts === maxAttempts) {
						throw new Error(
							`Failed after ${maxAttempts} attempts: ${error.message}`
						);
					}

					// Sonraki denemeden önce bekle
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}
			}
		} catch (error) {
			console.error("Final export error:", error);
			event.reply("SAVE_VIDEO_STATUS", {
				success: false,
				error: `Video dönüştürülemedi: ${error.message}`,
			});
		}
	}

	setSelectedArea(selectedArea) {
		this.state.selectedArea = selectedArea;
	}

	getSelectedArea() {
		return this.state.selectedArea;
	}

	// Cursor verisi metodları
	getCursorData() {
		return this.mousePositions || [];
	}

	// Crop bilgisi metodu
	getCropInfo() {
		// Seçili alan mevcutsa crop bilgisi döndür
		if (this.state.selectedArea) {
			return {
				x: this.state.selectedArea.x,
				y: this.state.selectedArea.y,
				width: this.state.selectedArea.width,
				height: this.state.selectedArea.height,
				enabled: true,
			};
		} else {
			// Varsayılan olarak crop devre dışı
			return {
				x: 0,
				y: 0,
				width: 0,
				height: 0,
				enabled: false,
			};
		}
	}

	// MacRecorder için ek metod
	getMacRecorderStatus() {
		return {
			isAvailable: true, // MacRecorder modülü her zaman mevcut
			selectedScreen: this.state.recordingSource.macRecorderId,
			isRecording: this.state.isRecording,
		};
	}

	// MacRecorder kaydı ayarla
	setMacRecording(screenId) {
		console.log(
			"[MediaStateManager] MacRecorder kayıt ekranı ayarlanıyor:",
			screenId
		);
		this.updateState({
			recordingSource: {
				...this.state.recordingSource,
				sourceType: "screen", // MacRecorder ekran ve pencere destekler
				macRecorderId: screenId,
			},
		});

		return true;
	}
}

module.exports = MediaStateManager;
