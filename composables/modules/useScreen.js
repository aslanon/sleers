import { ref, reactive } from "vue";

export const useScreen = () => {
	// Reactive state
	const isRecording = ref(false);
	const isScreenActive = ref(false);
	const screenPath = ref(null);
	const audioPath = ref(null);
	const fileSizeCheckInterval = ref(null);

	// Native MediaRecorder instances
	let screenMediaRecorder = null;
	let screenStream = null;

	// Default configuration
	const defaultConfig = {
		fps: 30,
		width: 1920,
		height: 1080,
		videoBitsPerSecond: 2500000,
		audioBitsPerSecond: 320000,
		videoMimeType: "video/webm",
		audioMimeType: "audio/webm",
		systemAudio: true,
		microphone: true,
		microphoneDeviceId: null,
		chunkInterval: 100,
	};

	// Configuration state
	const config = reactive({ ...defaultConfig });

	// Update configuration
	const updateConfig = (newConfig) => {
		Object.assign(config, newConfig);
		console.log("Ekran konfigürasyonu güncellendi:", config);
	};

	// Start screen recording with native DesktopCapturer
	const startScreenRecording = async () => {
		const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;

		try {
			// Basic checks
			if (!window.electron?.ipcRenderer) {
				throw new Error("Electron IPC Renderer kullanılamıyor");
			}

			if (!IPC_EVENTS) {
				throw new Error("IPC events kullanılamıyor");
			}

			console.log("🎬 Native DesktopCapturer ile ekran kaydı başlatılıyor...");

			// Get media state for audio and source settings
			let mediaState = null;
			try {
				mediaState = await window.electron.ipcRenderer.invoke(
					IPC_EVENTS.GET_MEDIA_STATE
				);

				if (mediaState?.audioSettings) {
					console.log("Ses ayarları alındı:", mediaState.audioSettings);
					config.systemAudio = mediaState.audioSettings.systemAudioEnabled;
					config.microphone = mediaState.audioSettings.microphoneEnabled;
					config.microphoneDeviceId =
						mediaState.audioSettings.selectedAudioDevice;
				}

				// Get recording source settings
				if (mediaState?.recordingSource) {
					console.log("Kayıt kaynağı:", mediaState.recordingSource);
					const { sourceType, sourceId } = mediaState.recordingSource;

					if (sourceType === "area" && mediaState.selectedArea) {
						console.log("Alan seçimi:", mediaState.selectedArea);
						config.x = mediaState.selectedArea.x;
						config.y = mediaState.selectedArea.y;
						config.width = mediaState.selectedArea.width;
						config.height = mediaState.selectedArea.height;
					} else if (sourceId) {
						config.sourceId = sourceId;
						config.sourceType = sourceType;
					}
				}
			} catch (mediaStateError) {
				console.warn("MediaState bilgileri alınamadı:", mediaStateError);
			}

			// 1. Get screen sources with DesktopCapturer
			console.log("📺 Ekran kaynakları alınıyor...");

			const desktopSources = await window.electron.desktopCapturer.getSources({
				types: ["screen", "window"],
				thumbnailSize: { width: 1280, height: 720 },
				fetchWindowIcons: false,
			});

			if (!desktopSources || desktopSources.length === 0) {
				throw new Error("Ekran kaynağı bulunamadı");
			}

			// Source selection - use sourceId if available, otherwise use first screen
			let selectedSource = desktopSources[0]; // Default: first source

			if (config.sourceId) {
				const foundSource = desktopSources.find(
					(source) =>
						source.id === config.sourceId || source.id.includes(config.sourceId)
				);
				if (foundSource) {
					selectedSource = foundSource;
				}
			}

			console.log(
				`🎯 Seçilen kaynak: ${selectedSource.name} (${selectedSource.id})`
			);

			// 2. Start recording with MediaRecorder
			console.log("🎥 MediaRecorder hazırlanıyor...");

			// getUserMedia constraints
			const constraints = {
				audio: false, // Audio will be handled separately
				video: {
					mandatory: {
						chromeMediaSource: "desktop",
						chromeMediaSourceId: selectedSource.id,
						maxFrameRate: config.fps || 30,
					},
				},
			};

			// Limit resolution if crop area is specified
			if (config.width && config.height) {
				constraints.video.mandatory.maxWidth = config.width;
				constraints.video.mandatory.maxHeight = config.height;
			}

			console.log("🎬 Video stream başlatılıyor...", constraints);

			// Get video stream
			const stream = await navigator.mediaDevices.getUserMedia(constraints);

			if (!stream) {
				throw new Error("Video stream alınamadı");
			}

			console.log("✅ Video stream başarıyla alındı");

			// Create temporary file path
			screenPath.value = await window.electron.ipcRenderer.invoke(
				IPC_EVENTS.START_MEDIA_STREAM,
				"screen"
			);

			if (!screenPath.value) {
				throw new Error("Geçici dosya oluşturulamadı");
			}

			console.log("📁 Geçici dosya:", screenPath.value);

			// MediaRecorder setup
			const mediaRecorder = new MediaRecorder(stream, {
				mimeType: "video/webm;codecs=vp9",
				videoBitsPerSecond: config.videoBitsPerSecond || 2500000,
			});

			const chunks = [];

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					chunks.push(event.data);
					console.log(`📦 Chunk alındı: ${event.data.size} bytes`);

					// Write chunks to file
					const reader = new FileReader();
					reader.onload = async () => {
						try {
							await window.electron.ipcRenderer.invoke(
								IPC_EVENTS.WRITE_MEDIA_CHUNK,
								"screen",
								Array.from(new Uint8Array(reader.result))
							);
						} catch (chunkError) {
							console.error("Chunk yazma hatası:", chunkError);
						}
					};
					reader.readAsArrayBuffer(event.data);
				}
			};

			mediaRecorder.onstop = async () => {
				console.log("🏁 MediaRecorder durduruldu");
				stream.getTracks().forEach((track) => track.stop());

				// Process final chunks
				if (chunks.length > 0) {
					const blob = new Blob(chunks, { type: "video/webm" });
					console.log(`📼 Final video blob: ${blob.size} bytes`);
				}
			};

			mediaRecorder.onerror = (error) => {
				console.error("❌ MediaRecorder hatası:", error);
			};

			// Start recording
			mediaRecorder.start(100); // 100ms chunk interval

			// Store MediaRecorder globally
			screenMediaRecorder = mediaRecorder;
			screenStream = stream;

			isRecording.value = true;
			isScreenActive.value = true;

			// Set audio path for compatibility
			if (config.systemAudio || config.microphone) {
				audioPath.value = screenPath.value;
			}

			// Notify main process
			window.electron.ipcRenderer.send(IPC_EVENTS.RECORDING_STATUS_UPDATE, {
				type: "screen",
				isActive: true,
				filePath: screenPath.value,
				audioPath: audioPath.value,
			});

			console.log("🎬 DesktopCapturer ekran kaydı başlatıldı!");

			// Start file size check interval
			fileSizeCheckInterval.value = setInterval(async () => {
				if (isScreenActive.value) {
					try {
						const fileSize = await window.electron?.ipcRenderer.invoke(
							"GET_FILE_SIZE",
							screenPath.value
						);

						if (fileSize > 0) {
							console.log(
								`Ekran kaydı dosya boyutu: ${(fileSize / (1024 * 1024)).toFixed(
									2
								)}MB`
							);
							window.electron?.ipcRenderer.send(
								IPC_EVENTS.RECORDING_STATUS_UPDATE,
								{
									type: "screen",
									fileSize,
									isActive: true,
								}
							);
						}
					} catch (error) {
						console.error("Dosya boyutu kontrol edilirken hata:", error);
					}
				} else {
					clearInterval(fileSizeCheckInterval.value);
				}
			}, 1000);

			return true;
		} catch (error) {
			console.error("❌ DesktopCapturer ekran kaydı hatası:", error);
			isRecording.value = false;
			isScreenActive.value = false;
			throw error;
		}
	};

	// Stop screen recording
	const stopScreenRecording = async () => {
		const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;

		try {
			console.log("Ekran kaydı durduruluyor...");

			if (!IPC_EVENTS) {
				throw new Error("IPC events kullanılamıyor");
			}

			// Check if recording is active
			if (!isScreenActive.value) {
				console.log("Ekran kaydı zaten durdurulmuş");
				return {
					success: true,
					videoPath: screenPath.value,
					audioPath: audioPath.value,
				};
			}

			// Stop MediaRecorder
			if (screenMediaRecorder && screenMediaRecorder.state !== "inactive") {
				console.log("🛑 MediaRecorder durduruluyor...");
				screenMediaRecorder.stop();
			}

			// Stop stream tracks
			if (screenStream) {
				screenStream.getTracks().forEach((track) => {
					console.log(`🚫 Track durduruluyor: ${track.kind}`);
					track.stop();
				});
			}

			// Mark recording as inactive
			isScreenActive.value = false;
			isRecording.value = false;

			// Clear interval
			if (fileSizeCheckInterval.value) {
				clearInterval(fileSizeCheckInterval.value);
				fileSizeCheckInterval.value = null;
			}

			// Check file size
			let fileSize = 0;
			try {
				console.log("Oluşan dosyanın boyutu kontrol ediliyor...");
				fileSize = await window.electron?.ipcRenderer.invoke(
					IPC_EVENTS.GET_FILE_SIZE,
					screenPath.value
				);

				if (fileSize > 0) {
					console.log(
						`Dosya boyutu: ${fileSize} byte (${(
							fileSize /
							(1024 * 1024)
						).toFixed(2)}MB)`
					);
				} else {
					console.warn("Dosya boyutu 0 - kayıt sorunlu olabilir!");
				}
			} catch (error) {
				console.error("Dosya boyutu kontrol edilirken hata:", error);
			}

			// End media stream
			try {
				console.log("Ekran medya stream'i sonlandırılıyor...");
				await window.electron?.ipcRenderer.invoke(
					IPC_EVENTS.END_MEDIA_STREAM,
					"screen"
				);
				console.log("Ekran medya stream'i sonlandırıldı");
			} catch (streamError) {
				console.error(
					"Ekran medya stream'i sonlandırılırken hata:",
					streamError
				);
			}

			console.log("✅ Ekran kaydı başarıyla durduruldu");

			return {
				success: true,
				videoPath: screenPath.value,
				audioPath: audioPath.value,
				fileSize: fileSize,
			};
		} catch (error) {
			console.error("Ekran kaydı durdurulurken hata:", error);
			const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;

			// Cleanup on error
			if (IPC_EVENTS) {
				try {
					await window.electron?.ipcRenderer.invoke(
						IPC_EVENTS.END_MEDIA_STREAM,
						"screen"
					);
				} catch (cleanupError) {
					console.error("Hata temizleme sırasında hata:", cleanupError);
				}
			}

			throw error;
		}
	};

	// Legacy compatibility functions
	const initializeMacRecorder = async () => {
		console.log(
			"⚠️  MacRecorder devre dışı - native DesktopCapturer kullanılıyor"
		);
		return false;
	};

	const startScreenStream = async () => {
		console.log(
			"⚠️  startScreenStream deprecated - startScreenRecording kullanın"
		);
		return null;
	};

	const loadMacRecorderModule = async () => {
		console.log(
			"⚠️  MacRecorder devre dışı - native DesktopCapturer kullanılıyor"
		);
		return false;
	};

	const startRecording = async (sourceId, options = {}) => {
		try {
			console.log("[useScreen] MacRecorder kayıt başlatılıyor...");

			// MediaStateManager'dan kaynak bilgisini al
			const mediaState = await window.electron?.ipcRenderer.invoke(
				"GET_MEDIA_STATE"
			);
			const recordingSource = mediaState?.recordingSource;

			console.log("[useScreen] Media state:", mediaState);
			console.log("[useScreen] Recording source:", recordingSource);

			if (!recordingSource) {
				throw new Error(
					"Kayıt kaynağı bilgisi bulunamadı - lütfen önce bir kaynak seçin"
				);
			}

			if (!recordingSource.sourceId) {
				throw new Error(
					"Kayıt kaynağı ID'si seçilmemiş - lütfen bir ekran veya pencere seçin"
				);
			}

			console.log("[useScreen] Kayıt kaynağı:", recordingSource);

			// Geçici dosya yolu oluştur
			const outputPath = await window.electron?.ipcRenderer.invoke(
				"START_MEDIA_STREAM",
				"screen"
			);

			if (!outputPath) {
				throw new Error("Geçici dosya yolu oluşturulamadı");
			}

			console.log("[useScreen] Çıktı dosyası:", outputPath);

			// MacRecorder kullanarak kayıt başlat
			const success = await window.electron?.ipcRenderer.invoke(
				"START_MAC_RECORDING",
				outputPath,
				{
					sourceId: recordingSource.sourceId,
					sourceType: recordingSource.sourceType,
					quality: options.quality || "high",
					fps: options.fps || 30,
					...options,
				}
			);

			if (success) {
				isRecording.value = true;
				isScreenActive.value = true;
				screenPath.value = outputPath;
				console.log("[useScreen] MacRecorder kaydı başarıyla başlatıldı");

				// Kayıt durumunu bildir
				window.electron?.ipcRenderer.send("RECORDING_STATUS_CHANGED", true);

				return { success: true, videoPath: outputPath };
			} else {
				throw new Error("MacRecorder kaydı başlatılamadı");
			}
		} catch (error) {
			console.error("[useScreen] Kayıt başlatma hatası:", error);
			isRecording.value = false;
			isScreenActive.value = false;
			throw error;
		}
	};

	const stopRecording = async () => {
		try {
			console.log("[useScreen] MacRecorder kaydı durduruluyor...");

			// MacRecorder kaydını durdur
			const result = await window.electron?.ipcRenderer.invoke(
				"STOP_MAC_RECORDING",
				screenPath.value
			);

			console.log("[useScreen] MacRecorder stop result:", result);

			if (result && result.success) {
				isRecording.value = false;
				isScreenActive.value = false;
				console.log("[useScreen] MacRecorder kaydı başarıyla durduruldu");

				// Kayıt durumunu bildir
				window.electron?.ipcRenderer.send("RECORDING_STATUS_CHANGED", false);

				return {
					success: true,
					videoPath: result.filePath || screenPath.value,
				};
			} else {
				throw new Error(result?.error || "MacRecorder kaydı durdurulamadı");
			}
		} catch (error) {
			console.error("[useScreen] Kayıt durdurma hatası:", error);
			isRecording.value = false;
			isScreenActive.value = false;
			throw error;
		}
	};

	return {
		// State
		isRecording: isRecording,
		isScreenActive,
		screenPath,
		audioPath,
		config,

		// Functions
		updateConfig,
		startScreenRecording,
		stopScreenRecording,

		// Legacy compatibility
		initializeMacRecorder,
		startScreenStream,
		loadMacRecorderModule,

		startRecording,
		stopRecording,
	};
};
