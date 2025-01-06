const { IPC_EVENTS } = require("./constants.cjs");
const fs = require("fs");
const path = require("path");

class MediaStateManager {
	constructor(mainWindow) {
		this.mainWindow = mainWindow;
		this.state = {
			videoPath: null,
			audioPath: null,
			systemAudioPath: null,
			lastRecordingTime: null,
			isEditing: false,
			isRecording: false,
			recordingStartTime: null,
			processingStatus: {
				isProcessing: false,
				progress: 0,
				error: null,
			},
		};
		this.recordingCheckInterval = null;
		this.fileCheckAttempts = 0;
		this.maxFileCheckAttempts = 50; // 5 saniye (100ms * 50)
	}

	async validateMediaFile(filePath, type = "unknown") {
		console.log(
			`[MediaStateManager] Dosya kontrolü başladı - ${type}:`,
			filePath
		);

		try {
			if (!filePath) {
				console.log(`[MediaStateManager] Dosya yolu boş - ${type}`);
				return false;
			}

			if (!fs.existsSync(filePath)) {
				console.log(
					`[MediaStateManager] Dosya bulunamadı - ${type}:`,
					filePath
				);
				return false;
			}

			const stats = fs.statSync(filePath);
			console.log(`[MediaStateManager] Dosya boyutu - ${type}:`, {
				path: filePath,
				size: stats.size,
				sizeInMB: (stats.size / (1024 * 1024)).toFixed(2) + "MB",
			});

			// En az 1KB olmalı
			if (stats.size < 1024) {
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
				console.log(`[MediaStateManager] Dosya okunamıyor - ${type}`);
				return false;
			}

			// Dosya kilitli mi kontrol et
			try {
				const testFd = fs.openSync(filePath, "r+");
				fs.closeSync(testFd);
			} catch (error) {
				console.log(`[MediaStateManager] Dosya kilitli - ${type}:`, error);
				return false;
			}

			// Video dosyası için ek kontroller
			if (type.includes("video")) {
				const extension = path.extname(filePath).toLowerCase();
				if (![".mp4", ".webm"].includes(extension)) {
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
					console.log(`[MediaStateManager] Geçersiz video başlığı - ${type}`);
					return false;
				}
			}

			console.log(`[MediaStateManager] Dosya geçerli - ${type}`);
			return true;
		} catch (error) {
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
				const elapsedTime = Date.now() - startTime;

				console.log("[MediaStateManager] Dosya kontrolü:", {
					attempt: this.fileCheckAttempts,
					videoPath,
					audioPath,
					elapsedTime,
				});

				const progress = Math.min((elapsedTime / maxWaitTime) * 100, 99);

				if (progress !== lastProgress) {
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
				if (videoPath && (await this.validateMediaFile(videoPath, "video"))) {
					clearInterval(this.recordingCheckInterval);

					// Dosyanın tamamen yazılmasını bekle
					await new Promise((resolve) => setTimeout(resolve, 500));

					// Son bir kontrol daha yap
					if (!(await this.validateMediaFile(videoPath, "final-video"))) {
						if (this.fileCheckAttempts < this.maxFileCheckAttempts) {
							return; // Devam et
						}
						throw new Error("Video dosyası doğrulanamadı");
					}

					// Ses dosyasını kontrol et
					const isAudioValid = audioPath
						? await this.validateMediaFile(audioPath, "audio")
						: false;

					resolve({
						success: true,
						videoPath,
						audioPath: isAudioValid ? audioPath : null,
					});
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
						videoPath,
						audioPath,
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
			videoPath: null,
			audioPath: null,
			systemAudioPath: null,
			lastRecordingTime: null,
			isEditing: false,
			isRecording: false,
			recordingStartTime: null,
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
					this.updateState({
						videoPath: result.videoPath,
						audioPath: result.audioPath,
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
							state: this.state,
						}
					);

					// Editor'e bildirim gönder
					if (this.mainWindow && !this.mainWindow.isDestroyed()) {
						this.mainWindow.webContents.send(IPC_EVENTS.PROCESSING_COMPLETE, {
							videoPath: result.videoPath,
							audioPath: result.audioPath,
						});

						this.mainWindow.webContents.send(IPC_EVENTS.MEDIA_PATHS, {
							videoPath: result.videoPath,
							audioPath: result.audioPath,
						});
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
		}
	}
}

module.exports = MediaStateManager;
