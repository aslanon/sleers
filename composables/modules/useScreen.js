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

			// Get media state for audio and source settings
			let mediaState = null;
			try {
				mediaState = await window.electron.ipcRenderer.invoke(
					IPC_EVENTS.GET_MEDIA_STATE
				);

				if (mediaState?.audioSettings) {
					config.systemAudio = mediaState.audioSettings.systemAudioEnabled;
					config.microphone = mediaState.audioSettings.microphoneEnabled;
					config.microphoneDeviceId =
						mediaState.audioSettings.selectedAudioDevice;
				}

				// Get recording source settings
				if (mediaState?.recordingSource) {
					const { sourceType, sourceId } = mediaState.recordingSource;

					if (sourceType === "area" && mediaState.selectedArea) {
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

			// 2. Start recording with MediaRecorder

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

			// Get video stream
			const stream = await navigator.mediaDevices.getUserMedia(constraints);

			if (!stream) {
				throw new Error("Video stream alınamadı");
			}

			// Create temporary file path
			screenPath.value = await window.electron.ipcRenderer.invoke(
				IPC_EVENTS.START_MEDIA_STREAM,
				"screen"
			);

			if (!screenPath.value) {
				throw new Error("Geçici dosya oluşturulamadı");
			}

			// MediaRecorder setup
			const mediaRecorder = new MediaRecorder(stream, {
				mimeType: "video/webm;codecs=vp9",
				videoBitsPerSecond: config.videoBitsPerSecond || 2500000,
			});

			const chunks = [];

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					chunks.push(event.data);

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
				stream.getTracks().forEach((track) => track.stop());

				// Process final chunks
				if (chunks.length > 0) {
					const blob = new Blob(chunks, { type: "video/webm" });
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

			// Start file size check interval
			fileSizeCheckInterval.value = setInterval(async () => {
				if (isScreenActive.value) {
					try {
						const fileSize = await window.electron?.ipcRenderer.invoke(
							"GET_FILE_SIZE",
							screenPath.value
						);

						if (fileSize > 0) {
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
			if (!IPC_EVENTS) {
				throw new Error("IPC events kullanılamıyor");
			}

			// Check if recording is active
			if (!isScreenActive.value) {
				return {
					success: true,
					videoPath: screenPath.value,
					audioPath: audioPath.value,
				};
			}

			// Stop MediaRecorder
			if (screenMediaRecorder && screenMediaRecorder.state !== "inactive") {
				screenMediaRecorder.stop();
			}

			// Stop stream tracks
			if (screenStream) {
				screenStream.getTracks().forEach((track) => {
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
				fileSize = await window.electron?.ipcRenderer.invoke(
					IPC_EVENTS.GET_FILE_SIZE,
					screenPath.value
				);

				if (fileSize > 0) {
				} else {
					console.warn("Dosya boyutu 0 - kayıt sorunlu olabilir!");
				}
			} catch (error) {
				console.error("Dosya boyutu kontrol edilirken hata:", error);
			}

			// End media stream
			try {
				await window.electron?.ipcRenderer.invoke(
					IPC_EVENTS.END_MEDIA_STREAM,
					"screen"
				);
			} catch (streamError) {
				console.error(
					"Ekran medya stream'i sonlandırılırken hata:",
					streamError
				);
			}

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
		return false;
	};

	const startScreenStream = async () => {
		return null;
	};

	const loadMacRecorderModule = async () => {
		return false;
	};

	// MacRecorder event listeners - README'den eklendi
	const recordingEvents = ref({
		isStarted: false,
		recordingTime: 0,
		lastStatus: null,
		error: null,
	});

	// Event listeners kurulumu
	if (typeof window !== "undefined" && window.electron?.ipcRenderer) {
		// Kayıt başladı eventi
		window.electron.ipcRenderer.on("MAC_RECORDING_STARTED", (event, data) => {
			recordingEvents.value.isStarted = true;
			recordingEvents.value.error = null;
			isRecording.value = true;
			isScreenActive.value = true;
		});

		// Kayıt durdu eventi
		window.electron.ipcRenderer.on("MAC_RECORDING_STOPPED", (event, data) => {
			recordingEvents.value.isStarted = false;
			recordingEvents.value.recordingTime = 0;
			isRecording.value = false;
			isScreenActive.value = false;
		});

		// Zaman güncelleme eventi
		window.electron.ipcRenderer.on(
			"MAC_RECORDING_TIME_UPDATE",
			(event, data) => {
				recordingEvents.value.recordingTime = data.seconds;
			}
		);

		// Kayıt tamamlandı eventi
		window.electron.ipcRenderer.on("MAC_RECORDING_COMPLETED", (event, data) => {
			recordingEvents.value.isStarted = false;
			// Final dosya yolunu güncelle
			if (data.outputPath) {
				screenPath.value = data.outputPath;
			}
		});

		// Hata eventi
		window.electron.ipcRenderer.on("MAC_RECORDING_ERROR", (event, data) => {
			console.error("[useScreen] MacRecorder kayıt hatası:", data);
			recordingEvents.value.error = data.error;
			recordingEvents.value.isStarted = false;
			isRecording.value = false;
			isScreenActive.value = false;
		});
	}

	const startRecording = async (sourceId, options = {}) => {
		try {
			// MediaStateManager'dan kaynak bilgisini al
			const mediaState = await window.electron?.ipcRenderer.invoke(
				"GET_MEDIA_STATE"
			);
			const recordingSource = mediaState?.recordingSource;

			// Default kaynak ayarları - display kaydı
			let sourceType = "display";
			let macRecorderId = 0;

			// Kaynak seçilmişse onun bilgilerini kullan
			if (recordingSource && recordingSource.sourceId) {
				sourceType = recordingSource.sourceType || "display";
				macRecorderId = recordingSource.macRecorderId || 0;
			} else {
				sourceType = "display";
				macRecorderId = 0;
			}

			// Kaynak tipine göre Mac recorder seçeneklerini hazırla
			const macRecorderOptions = {
				includeMicrophone: false,
				includeSystemAudio: false,
				quality: options.quality || "medium",
				frameRate: options.frameRate || options.fps || 30,
				captureCursor: options.captureCursor === true, // Default false
				...options,
			};

			// Kaynak tipine göre display veya windowId ekle
			if (sourceType === "window" && macRecorderId) {
				macRecorderOptions.windowId = macRecorderId;
				console.log('[DEBUG] Window recording with windowId:', macRecorderId);
			} else {
				macRecorderOptions.display = macRecorderId;
				console.log('[DEBUG] Display recording with displayId:', macRecorderId);
			}
			
			console.log('[DEBUG] Final macRecorderOptions:', macRecorderOptions);

			// MacRecorder kullanarak kayıt başlat - YENİ FORMAT

			let result;
			try {
				result = await window.electron?.ipcRenderer.invoke(
					"START_MAC_RECORDING",
					macRecorderOptions
				);
			} catch (invokeError) {
				throw invokeError;
			}

			if (result?.success) {
				screenPath.value = result.outputPath;

				// Event system sayesinde isRecording state otomatik güncellenecek
				// Not: RECORDING_STATUS_CHANGED eventini manuel göndermiyoruz çünkü
				// pages/index.vue'deki watch(isRecording) zaten bunu yapıyor

				return { success: true, videoPath: result.outputPath };
			} else {
				throw new Error(result?.error || "MacRecorder kaydı başlatılamadı");
			}
		} catch (error) {
			console.error("[useScreen] Kayıt başlatma hatası:", error);
			recordingEvents.value.error = error.message;
			isRecording.value = false;
			isScreenActive.value = false;
			throw error;
		}
	};

	const stopRecording = async () => {
		try {
			// MacRecorder kaydını durdur - YENİ FORMAT (parametre yok)
			const result = await window.electron?.ipcRenderer.invoke(
				"STOP_MAC_RECORDING"
			);

			if (result && result.success) {
				isRecording.value = false;
				isScreenActive.value = false;

				// Ana pencereyi gizle
				window.electron?.ipcRenderer.send("HIDE_MAIN_WINDOW");

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

		// MacRecorder Events (README'den eklendi)
		recordingEvents,

		// Functions
		updateConfig,
		startScreenRecording,
		stopScreenRecording,

		// Legacy compatibility
		initializeMacRecorder,
		startScreenStream,
		loadMacRecorderModule,

		// MacRecorder API
		startRecording,
		stopRecording,
	};
};
