import { ref } from "vue";

export const useScreen = () => {
	const isScreenActive = ref(false);
	const screenPath = ref(null);
	const audioPath = ref(null);
	const screenRecorder = ref(null);
	const audioRecorder = ref(null);

	// Ekran kaydı için varsayılan konfigürasyon
	const defaultConfig = {
		sourceType: "display", // "display" veya "window"
		width: null,
		height: null,
		x: null,
		y: null,
		cursor: "never",
		videoBitsPerSecond: 50000000,
		audioBitsPerSecond: 320000,
		videoMimeType: "video/webm;codecs=vp9",
		audioMimeType: "audio/webm;codecs=opus",
		systemAudio: true,
		microphone: true,
		microphoneDeviceId: null,
	};

	// Konfigürasyon state'i
	const config = ref({ ...defaultConfig });

	// Konfigürasyonu güncelleme fonksiyonu
	const updateConfig = (newConfig) => {
		config.value = {
			...config.value,
			...newConfig,
		};
		console.log("Ekran konfigürasyonu güncellendi:", config.value);
	};

	const startScreenStream = async () => {
		try {
			const sources = await window.electron?.desktopCapturer.getSources({
				types: ["window", "screen"],
				thumbnailSize: { width: 100, height: 100 },
				fetchWindowIcons: true,
				excludeTypes: ["panel", "popup", "toolbar"],
			});

			console.log("Ekran kaynakları:", sources);

			if (!sources || sources.length === 0) {
				throw new Error("Ekran kaynakları bulunamadı");
			}

			// Kamera penceresini filtrele
			const filteredSources = sources.filter(
				(source) =>
					!source.name.includes("camera") &&
					!source.name.toLowerCase().includes("kamera") &&
					!source.name.includes("Sleer Camera")
			);

			let selectedSource = filteredSources[0];
			const sourceType = config.value.sourceType;

			if (sourceType === "display") {
				selectedSource =
					filteredSources.find((source) => source.id.startsWith("screen:")) ||
					filteredSources[0];
			} else if (sourceType === "window") {
				selectedSource =
					filteredSources.find((source) => source.id.startsWith("window:")) ||
					filteredSources[0];
			}

			// Ekran kaydı için stream al
			const screenStream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				systemAudio: "include",
				video: {
					cursor: config.value.cursor,
					mandatory: {
						cursor: config.value.cursor,
						chromeMediaSource: "desktop",
						chromeMediaSourceId: selectedSource.id,
						...(config.value.width
							? {
									minWidth: config.value.width,
									maxWidth: config.value.width,
									width: config.value.width,
							  }
							: {}),
						...(config.value.height
							? {
									minHeight: config.value.height,
									maxHeight: config.value.height,
									height: config.value.height,
							  }
							: {}),
						...(config.value.x && config.value.y
							? {
									x: config.value.x,
									y: config.value.y,
							  }
							: {}),
					},
				},
			});

			return screenStream;
		} catch (error) {
			console.error("Ekran stream'i başlatılırken hata:", error);
			return null;
		}
	};

	const startScreenRecording = async () => {
		try {
			const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;
			if (!IPC_EVENTS) {
				throw new Error("IPC events are not available");
			}

			const useSystemAudio = config.value.systemAudio;
			const useMicrophone = config.value.microphone;
			const micDeviceId = config.value.microphoneDeviceId;

			const audioConfig = {
				mandatory: {
					chromeMediaSource: useSystemAudio ? "desktop" : "none",
				},
			};

			if (useMicrophone && micDeviceId) {
				audioConfig.optional = [
					{
						deviceId: { exact: micDeviceId },
					},
				];
			}

			console.log("Ekran stream'i başlatılıyor...", {
				useSystemAudio,
				useMicrophone,
				micDeviceId,
				audioConfig,
			});

			const screenStream = await startScreenStream();

			if (!screenStream) {
				console.error("Ekran stream'i alınamadı");
				return null;
			}

			console.log("Ekran stream'i başlatıldı");
			console.log("Ekran MediaRecorder oluşturuluyor");

			// Stream'i başlat
			screenPath.value = await window.electron?.ipcRenderer.invoke(
				IPC_EVENTS.START_MEDIA_STREAM,
				"screen"
			);

			audioPath.value = null;

			screenRecorder.value = new MediaRecorder(screenStream, {
				mimeType: config.value.videoMimeType,
				videoBitsPerSecond: config.value.videoBitsPerSecond,
			});

			if (screenStream.getAudioTracks().length > 0) {
				audioPath.value = await window.electron?.ipcRenderer.invoke(
					IPC_EVENTS.START_MEDIA_STREAM,
					"audio"
				);
				const audioStream = new MediaStream(screenStream.getAudioTracks());
				audioRecorder.value = new MediaRecorder(audioStream, {
					mimeType: config.value.audioMimeType,
					audioBitsPerSecond: config.value.audioBitsPerSecond,
				});

				audioRecorder.value.ondataavailable = async (event) => {
					if (event.data.size > 0) {
						try {
							const chunk = await event.data.arrayBuffer();
							await window.electron?.ipcRenderer.invoke(
								IPC_EVENTS.WRITE_MEDIA_CHUNK,
								"audio",
								chunk
							);
						} catch (error) {
							console.error("Ses chunk'ı yazılırken hata:", error);
						}
					}
				};

				audioRecorder.value.onerror = (event) => {
					console.error("Audio recorder error:", event);
					// Ses kaydı hatası durumunda durumu güncelle
					isScreenActive.value = false;
				};

				audioRecorder.value.onstop = () => {
					console.log("Audio recorder stopped");
				};
			}

			screenRecorder.value.ondataavailable = async (event) => {
				if (event.data.size > 0) {
					try {
						const chunk = await event.data.arrayBuffer();
						await window.electron?.ipcRenderer.invoke(
							IPC_EVENTS.WRITE_MEDIA_CHUNK,
							"screen",
							chunk
						);
					} catch (error) {
						console.error("Ekran chunk'ı yazılırken hata:", error);
					}
				}
			};

			screenRecorder.value.onerror = (event) => {
				console.error("Screen recorder error:", event);
				isScreenActive.value = false;

				// Hata durumunda stream'i temizle
				try {
					screenStream.getTracks().forEach((track) => track.stop());
				} catch (err) {
					console.error("Screen stream tracks durdurulurken hata:", err);
				}
			};

			screenRecorder.value.onstop = () => {
				console.log("Screen recorder stopped");
				isScreenActive.value = false;

				// Recorder durdurulduğunda stream'i temizle
				try {
					screenStream.getTracks().forEach((track) => track.stop());
				} catch (err) {
					console.error("Screen stream tracks durdurulurken hata:", err);
				}
			};

			console.log("Ekran kaydı başlatılıyor");
			screenRecorder.value.start(1000);
			if (audioRecorder.value) audioRecorder.value.start(1000);

			console.log("Ekran MediaRecorder başlatıldı");
			isScreenActive.value = true;

			return { videoPath: screenPath.value, audioPath: audioPath.value };
		} catch (error) {
			console.error("Ekran kaydı başlatılırken hata:", error);
			isScreenActive.value = false;
			return null;
		}
	};

	const stopScreenRecording = async () => {
		try {
			console.log("Ekran kaydı durdurma başlatıldı");

			if (screenRecorder.value && screenRecorder.value.state === "recording") {
				console.log("Ekran recorder durduruluyor...");
				screenRecorder.value.stop();
				console.log("Ekran recorder durduruldu");
			} else {
				console.warn(
					"Ekran recorder zaten durdurulmuş veya geçersiz:",
					screenRecorder.value?.state
				);
			}

			if (audioRecorder.value && audioRecorder.value.state === "recording") {
				console.log("Ses recorder durduruluyor...");
				audioRecorder.value.stop();
				console.log("Ses recorder durduruldu");
			} else {
				console.warn(
					"Ses recorder zaten durdurulmuş veya geçersiz:",
					audioRecorder.value?.state
				);
			}

			// Stream'leri sonlandır
			const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;
			if (IPC_EVENTS) {
				try {
					await window.electron?.ipcRenderer.invoke(
						IPC_EVENTS.END_MEDIA_STREAM,
						"screen"
					);

					if (audioPath.value) {
						await window.electron?.ipcRenderer.invoke(
							IPC_EVENTS.END_MEDIA_STREAM,
							"audio"
						);
					}
				} catch (streamError) {
					console.error("Stream sonlandırılırken hata:", streamError);
				}
			}

			isScreenActive.value = false;
			console.log("Ekran kaydı durdurma tamamlandı");
		} catch (error) {
			console.error("Ekran kaydı durdurulurken hata:", error);
			isScreenActive.value = false;
		}
	};

	return {
		isScreenActive,
		screenPath: screenPath,
		audioPath: audioPath,
		config,
		updateConfig,
		startScreenStream,
		startScreenRecording,
		stopScreenRecording,
	};
};
