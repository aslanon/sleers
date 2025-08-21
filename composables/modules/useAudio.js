import { ref } from "vue";

export const useAudio = () => {
	const audioDevices = ref([]);
	const selectedAudioDevice = ref("");
	const systemAudioEnabled = ref(true);
	const microphoneEnabled = ref(true);
	const microphoneLevel = ref(0);
	const currentAudioStream = ref(null);
	const isAudioAnalyserActive = ref(false);
	const isAudioActive = ref(false);
	const audioPath = ref(null);
	const audioRecorder = ref(null);

	// Ses için varsayılan konfigürasyon
	const defaultConfig = {
		echoCancellation: true,
		noiseSuppression: true,
		autoGainControl: true,
		audioBitsPerSecond: 320000,
		mimeType: "audio/webm;codecs=opus",
		fftSize: 256,
		chunkInterval: 100, // Daha sık chunk gönderimi için
	};

	// Konfigürasyon state'i
	const config = ref({ ...defaultConfig });

	// Konfigürasyonu güncelleme fonksiyonu
	const updateConfig = (newConfig) => {
		config.value = {
			...config.value,
			...newConfig,
		};
	};

	let audioContext = null;
	let audioAnalyser = null;
	let dataArray = null;
	let animationFrame = null;

	const getAudioDevices = async () => {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			audioDevices.value = devices.filter(
				(device) => device.kind === "audioinput"
			);

			if (audioDevices.value.length > 0) {
				selectedAudioDevice.value = audioDevices.value[0].deviceId;
			}
		} catch (error) {
			console.error("Ses cihazları listelenirken hata oluştu:", error);
		}
	};

	const getAudioStream = async () => {
		// Ses kaydı için stream al
		let audioStream = null;
		if (selectedAudioDevice.value && microphoneEnabled.value) {
			try {
				audioStream = await navigator.mediaDevices.getUserMedia({
					audio: {
						deviceId: { exact: selectedAudioDevice.value },
						echoCancellation: config.value.echoCancellation,
						noiseSuppression: config.value.noiseSuppression,
						autoGainControl: config.value.autoGainControl,
					},
					video: false,
				});
			} catch (err) {
				console.warn("Mikrofon akışı alınamadı:", err);
			}
		}
		return audioStream;
	};

	const startAudioRecording = async () => {
		try {
			// Audio kapalıysa hiç recording başlatma
			if (!microphoneEnabled.value && !systemAudioEnabled.value) {
				console.log("[useAudio] Both microphone and system audio disabled, skipping audio recording");
				isAudioActive.value = false;
				return null;
			}
			
			console.log("[useAudio] Starting audio recording with settings:", {
				microphoneEnabled: microphoneEnabled.value,
				systemAudioEnabled: systemAudioEnabled.value
			});

			const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;
			if (!IPC_EVENTS) {
				throw new Error("IPC events are not available");
			}

			// Sadece mikrofon açıksa stream al
			let audioStream = null;
			if (microphoneEnabled.value) {
				// Ses kaydı için stream al
				audioStream = await navigator.mediaDevices.getUserMedia({
					audio: {
						deviceId: selectedAudioDevice.value
							? { exact: selectedAudioDevice.value }
							: undefined,
						echoCancellation: config.value.echoCancellation,
						noiseSuppression: config.value.noiseSuppression,
						autoGainControl: config.value.autoGainControl,
					},
				});
			} else {
				console.log("[useAudio] Microphone disabled, no audio stream created");
				isAudioActive.value = false;
				return null;
			}


			// Dosya yolunu al
			audioPath.value = await window.electron?.ipcRenderer.invoke(
				IPC_EVENTS.START_MEDIA_STREAM,
				"audio"
			);

			audioRecorder.value = new MediaRecorder(audioStream, {
				mimeType: config.value.mimeType,
				audioBitsPerSecond: config.value.audioBitsPerSecond,
			});

			audioRecorder.value.ondataavailable = async (event) => {
				if (event.data.size > 0 && isAudioActive.value) {
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

			audioRecorder.value.onstop = () => {
				isAudioActive.value = false;

				// Recorder durdurulduğunda stream'i temizle
				try {
					audioStream.getTracks().forEach((track) => track.stop());
				} catch (err) {
					console.error("Audio stream tracks durdurulurken hata:", err);
				}
			};

			audioRecorder.value.onerror = (event) => {
				console.error("Audio recorder error:", event);
				isAudioActive.value = false;

				// Hata durumunda stream'i temizle
				try {
					audioStream.getTracks().forEach((track) => track.stop());
				} catch (err) {
					console.error("Audio stream tracks durdurulurken hata:", err);
				}
			};

			audioRecorder.value.start(config.value.chunkInterval);
			isAudioActive.value = true;

			return { audioPath: audioPath.value };
		} catch (error) {
			console.error("Ses kaydı başlatılırken hata:", error);
			isAudioActive.value = false;
			return null;
		}
	};

	const stopAudioRecording = async () => {
		try {

			// Önce state'i false yap ki yeni chunk'lar oluşmasın
			isAudioActive.value = false;

			// Ses kaydı aktif değilse işlemi atla
			if (!audioRecorder.value) {
				console.warn("Ses recorder bulunamadı, durdurma işlemi atlanıyor");
				return audioPath.value;
			}

			// Recorder'ı ve stream'i temizle
			let audioStreamTracks = [];

			// Recorder'ı durdur ve event listener'ları temizle
			try {
				// Event listener'ları kaldır
				audioRecorder.value.ondataavailable = null;
				audioRecorder.value.onerror = null;
				audioRecorder.value.onstop = null;

				// Stream track'lerini kaydet
				if (audioRecorder.value.stream) {
					audioStreamTracks = [...audioRecorder.value.stream.getTracks()];
				}

				// Recorder'ı durdur
				if (audioRecorder.value.state === "recording") {
					audioRecorder.value.stop();
				} else {
					console.warn(
						"Ses recorder zaten durdurulmuş veya geçersiz:",
						audioRecorder.value.state
					);
				}
			} catch (recorderError) {
				console.error("Ses recorder durdurulurken hata:", recorderError);
			} finally {
				// Recorder'ı null yap
				audioRecorder.value = null;
			}

			// Tüm track'leri durdur
			audioStreamTracks.forEach((track) => {
				try {
					track.stop();
				} catch (err) {
					console.error(`Track durdurulurken hata: ${track.id}`, err);
				}
			});

			// Stream'i sonlandır
			const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;
			if (IPC_EVENTS && audioPath.value) {
				try {
					await window.electron?.ipcRenderer.invoke(
						IPC_EVENTS.END_MEDIA_STREAM,
						"audio"
					);
				} catch (streamError) {
					console.error("Audio stream sonlandırılırken hata:", streamError);
				}
			}

			return audioPath.value;
		} catch (error) {
			console.error("Ses kaydı durdurulurken hata:", error);
			return audioPath.value;
		}
	};

	const initAudioAnalyser = async () => {
		try {
			if (isAudioAnalyserActive.value) {
				cleanupAudioAnalyser();
			}

			if (!audioContext) {
				audioContext = new (window.AudioContext || window.webkitAudioContext)();
			}

			if (currentAudioStream.value) {
				currentAudioStream.value.getTracks().forEach((track) => track.stop());
			}

			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					deviceId: selectedAudioDevice.value
						? { exact: selectedAudioDevice.value }
						: undefined,
					echoCancellation: config.value.echoCancellation,
					noiseSuppression: config.value.noiseSuppression,
					autoGainControl: config.value.autoGainControl,
				},
			});

			currentAudioStream.value = stream;

			const source = audioContext.createMediaStreamSource(stream);
			audioAnalyser = audioContext.createAnalyser();
			audioAnalyser.fftSize = config.value.fftSize;
			source.connect(audioAnalyser);

			dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
			isAudioAnalyserActive.value = true;
			updateMicrophoneLevel();
		} catch (error) {
			console.error("Mikrofon analiz hatası:", error);
			isAudioAnalyserActive.value = false;
		}
	};

	const cleanupAudioAnalyser = () => {
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
			animationFrame = null;
		}

		if (currentAudioStream.value) {
			currentAudioStream.value.getTracks().forEach((track) => track.stop());
			currentAudioStream.value = null;
		}

		if (audioContext) {
			audioContext.close();
			audioContext = null;
		}

		audioAnalyser = null;
		dataArray = null;
		isAudioAnalyserActive.value = false;
	};

	const updateMicrophoneLevel = () => {
		if (!isAudioAnalyserActive.value || !audioAnalyser || !dataArray) return;

		try {
			audioAnalyser.getByteFrequencyData(dataArray);
			const average =
				dataArray.reduce((acc, value) => acc + value, 0) / dataArray.length;
			microphoneLevel.value = Math.min(100, (average / 255) * 100);

			if (isAudioAnalyserActive.value) {
				animationFrame = requestAnimationFrame(updateMicrophoneLevel);
			}
		} catch (error) {
			console.error("Mikrofon seviyesi güncellenirken hata:", error);
			cleanupAudioAnalyser();
		}
	};

	const toggleMicrophone = () => {
		microphoneEnabled.value = !microphoneEnabled.value;
		if (!microphoneEnabled.value) {
			cleanupAudioAnalyser();
			
			// Mikrofon kapatıldıysa ve devam eden bir kayıt varsa durdur
			if (isAudioActive.value) {
				console.log("[useAudio] Microphone disabled during recording, stopping audio recording");
				stopAudioRecording();
			}
			
			// Mikrofon kapatıldıysa ve sistem sesi de kapalıysa audio recording'i durdur
			if (!systemAudioEnabled.value && isAudioActive.value) {
				console.log("[useAudio] Microphone disabled and system audio disabled, stopping audio recording");
				stopAudioRecording();
			}
		} else {
			initAudioAnalyser();
		}
		
		// Backend'e ses ayarlarını güncelle
		if (window.electron?.ipcRenderer) {
			window.electron.ipcRenderer.send("UPDATE_EDITOR_SETTINGS", {
				audioSettings: {
					microphoneEnabled: microphoneEnabled.value,
				},
			});
		}
		
		return microphoneEnabled.value;
	};

	const toggleSystemAudio = () => {
		systemAudioEnabled.value = !systemAudioEnabled.value;
		
		// Sistem sesi kapatıldıysa ve devam eden bir kayıt varsa, sadece mikrofon açıksa devam et
		if (!systemAudioEnabled.value && isAudioActive.value) {
			if (!microphoneEnabled.value) {
				console.log("[useAudio] System audio disabled and microphone also disabled, stopping audio recording");
				stopAudioRecording();
			} else {
				console.log("[useAudio] System audio disabled but microphone still enabled, audio recording continues");
			}
		}
		
		// Backend'e ses ayarlarını güncelle
		if (window.electron?.ipcRenderer) {
			window.electron.ipcRenderer.send("UPDATE_EDITOR_SETTINGS", {
				audioSettings: {
					systemAudioEnabled: systemAudioEnabled.value,
				},
			});
		}
		
		return systemAudioEnabled.value;
	};

	return {
		audioDevices,
		selectedAudioDevice,
		systemAudioEnabled,
		microphoneEnabled,
		microphoneLevel,
		currentAudioStream,
		isAudioAnalyserActive,
		isAudioActive,
		audioPath,
		config,
		updateConfig,
		getAudioDevices,
		getAudioStream,
		startAudioRecording,
		stopAudioRecording,
		initAudioAnalyser,
		cleanupAudioAnalyser,
		toggleMicrophone,
		toggleSystemAudio,
	};
};
