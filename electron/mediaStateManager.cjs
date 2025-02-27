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

			if (!fs.existsSync(filePath)) {
				if (!silent)
					console.log(
						`[MediaStateManager] Dosya bulunamadı - ${type}:`,
						filePath
					);
				return false;
			}

			const stats = fs.statSync(filePath);
			if (!silent) {
				console.log(`[MediaStateManager] Dosya boyutu - ${type}:`, {
					path: filePath,
					size: stats.size,
					sizeInMB: (stats.size / (1024 * 1024)).toFixed(2) + "MB",
				});
			}

			// En az 1KB olmalı
			if (stats.size < 1024) {
				if (!silent)
					console.log(
						`[MediaStateManager] Dosya çok küçük - ${type}:`,
						stats.size
					);
				return false;
			}

			// Dosya okuma testi
			const fd = fs.openSync(filePath, "r");
			const buffer = Buffer.alloc(1024);
			const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
			fs.closeSync(fd);

			if (bytesRead < 1) {
				if (!silent)
					console.log(`[MediaStateManager] Dosya okunamıyor - ${type}`);
				return false;
			}

			// Dosya kilitli mi kontrol et
			try {
				const testFd = fs.openSync(filePath, "r+");
				fs.closeSync(testFd);
			} catch (error) {
				if (!silent)
					console.log(`[MediaStateManager] Dosya kilitli - ${type}:`, error);
				return false;
			}

			// Video dosyası için ek kontroller
			if (type.includes("video")) {
				const extension = path.extname(filePath).toLowerCase();
				if (![".mp4", ".webm"].includes(extension)) {
					if (!silent)
						console.log(
							`[MediaStateManager] Geçersiz video formatı - ${type}:`,
							extension
						);
					return false;
				}

				// Dosyanın başlangıç baytlarını kontrol et
				const header = buffer.slice(0, 4);
				const isValidHeader = header.some((byte) => byte !== 0);
				if (!isValidHeader) {
					if (!silent)
						console.log(`[MediaStateManager] Geçersiz video başlığı - ${type}`);
					return false;
				}
			}

			if (!silent) console.log(`[MediaStateManager] Dosya geçerli - ${type}`);
			return true;
		} catch (error) {
			if (!silent)
				console.error(
					`[MediaStateManager] Dosya kontrolü sırasında hata - ${type}:`,
					error
				);
			return false;
		}
	}

	async waitForMediaFiles(tempFileManager, maxWaitTime = 10000) {
		console.log("[MediaStateManager] Medya dosyaları bekleniyor...");
		const startTime = Date.now();
		let lastProgress = 0;
		this.fileCheckAttempts = 0;

		return new Promise((resolve) => {
			const checkFiles = async () => {
				this.fileCheckAttempts++;

				const videoPath =
					tempFileManager.getFilePath("screen") ||
					tempFileManager.getFilePath("video");
				const audioPath = tempFileManager.getFilePath("audio");
				const cameraPath = tempFileManager.getFilePath("camera");
				const elapsedTime = Date.now() - startTime;

				// Her dosya için detaylı log
				console.log("[MediaStateManager] Dosya durumları:", {
					video: {
						path: videoPath,
						exists: videoPath ? fs.existsSync(videoPath) : false,
					},
					audio: {
						path: audioPath,
						exists: audioPath ? fs.existsSync(audioPath) : false,
					},
					camera: {
						path: cameraPath,
						exists: cameraPath ? fs.existsSync(cameraPath) : false,
					},
				});

				const progress = Math.min((elapsedTime / maxWaitTime) * 100, 99);

				// Progress değişimi %5'ten fazlaysa güncelle
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

				// Video dosyasını kontrol et
				if (
					videoPath &&
					(await this.validateMediaFile(videoPath, "video", true))
				) {
					clearInterval(this.recordingCheckInterval);

					// Dosyanın tamamen yazılmasını bekle
					await new Promise((resolve) => setTimeout(resolve, 500));

					// Son bir kontrol daha yap
					if (!(await this.validateMediaFile(videoPath, "final-video", true))) {
						if (this.fileCheckAttempts < this.maxFileCheckAttempts) {
							return; // Devam et
						}
						throw new Error("Video dosyası doğrulanamadı");
					}

					// Tüm dosya yollarını tekrar al (çünkü kayıt sırasında yeni dosyalar eklenmiş olabilir)
					const finalVideoPath =
						tempFileManager.getFilePath("screen") ||
						tempFileManager.getFilePath("video");
					const finalAudioPath = tempFileManager.getFilePath("audio");
					const finalCameraPath = tempFileManager.getFilePath("camera");

					console.log("[MediaStateManager] Son dosya yolları:", {
						video: finalVideoPath,
						audio: finalAudioPath,
						camera: finalCameraPath,
					});

					// Ses dosyasını kontrol et
					const isAudioValid = finalAudioPath
						? await this.validateMediaFile(finalAudioPath, "audio", true)
						: false;

					// Kamera dosyasını kontrol et
					let isCameraValid = false;
					if (finalCameraPath && fs.existsSync(finalCameraPath)) {
						isCameraValid = await this.validateMediaFile(
							finalCameraPath,
							"camera",
							false
						);
						console.log("[MediaStateManager] Kamera dosyası kontrolü:", {
							path: finalCameraPath,
							exists: fs.existsSync(finalCameraPath),
							isValid: isCameraValid,
							size: fs.statSync(finalCameraPath).size,
						});
					}

					const result = {
						success: true,
						videoPath: finalVideoPath,
						audioPath: isAudioValid ? finalAudioPath : null,
						cameraPath: isCameraValid ? finalCameraPath : null,
					};

					console.log("[MediaStateManager] Final dosya durumları:", {
						video: {
							path: result.videoPath,
							exists: fs.existsSync(result.videoPath),
						},
						audio: {
							path: result.audioPath,
							exists: result.audioPath
								? fs.existsSync(result.audioPath)
								: false,
						},
						camera: {
							path: result.cameraPath,
							exists: result.cameraPath
								? fs.existsSync(result.cameraPath)
								: false,
						},
					});

					resolve(result);
					return;
				}

				// Maksimum deneme sayısını veya zaman aşımını kontrol et
				if (
					this.fileCheckAttempts >= this.maxFileCheckAttempts ||
					elapsedTime >= maxWaitTime
				) {
					clearInterval(this.recordingCheckInterval);
					console.error("[MediaStateManager] Dosya bekleme süresi aşıldı:", {
						attempts: this.fileCheckAttempts,
						elapsedTime,
						paths: {
							video: {
								path: videoPath,
								exists: videoPath ? fs.existsSync(videoPath) : false,
							},
							audio: {
								path: audioPath,
								exists: audioPath ? fs.existsSync(audioPath) : false,
							},
							camera: {
								path: cameraPath,
								exists: cameraPath ? fs.existsSync(cameraPath) : false,
							},
						},
					});
					resolve({
						success: false,
						error: `Medya dosyaları hazırlanamadı (${this.fileCheckAttempts} deneme)`,
					});
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
		this.notifyRenderers();
	}

	getState() {
		return { ...this.state };
	}

	notifyRenderers(window = this.mainWindow) {
		if (window && !window.isDestroyed()) {
			try {
				window.webContents.send(IPC_EVENTS.MEDIA_STATE_UPDATE, this.getState());
				console.log("Renderer'lara state güncellendi:", this.getState());
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
		const isReady = this.validateMediaFile(this.state.videoPath, "final-check");
		console.log("[MediaStateManager] Medya hazırlık kontrolü:", {
			isReady,
			videoPath: this.state.videoPath,
		});
		return isReady;
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
}

module.exports = MediaStateManager;
