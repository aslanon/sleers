import { ref } from "vue";

export const useAudio = () => {
	const audioDevices = ref([]);
	const selectedAudioDevice = ref("");
	const systemAudioEnabled = ref(true);
	const microphoneEnabled = ref(true);
	const microphoneLevel = ref(0);
	const currentAudioStream = ref(null);
	const isAudioAnalyserActive = ref(false);
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
	};

	// Konfigürasyon state'i
	const config = ref({ ...defaultConfig });

	// Konfigürasyonu güncelleme fonksiyonu
	const updateConfig = (newConfig) => {
		config.value = {
			...config.value,
			...newConfig,
		};
		console.log("Ses konfigürasyonu güncellendi:", config.value);
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
			const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;
			if (!IPC_EVENTS) {
				throw new Error("IPC events are not available");
			}

			console.log("Ses kaydı başlatılıyor...");

			const audioStream = await getAudioStream();

			if (!audioStream) {
				console.warn(
					"Ses stream'i alınamadı, sadece mikrofon kaydı yapılmayacak"
				);
				return null;
			}

			console.log("Ses stream'i başlatıldı");
			console.log("Ses MediaRecorder oluşturuluyor");

			// Stream'i başlat
			audioPath.value = await window.electron?.ipcRenderer.invoke(
				IPC_EVENTS.START_MEDIA_STREAM,
				"audio"
			);

			audioRecorder.value = new MediaRecorder(audioStream, {
				mimeType: config.value.mimeType,
				audioBitsPerSecond: config.value.audioBitsPerSecond,
			});

			console.log("Ses recorder event listener'ları ekleniyor");
			audioRecorder.value.ondataavailable = async (event) => {
				if (event.data.size > 0) {
					try {
						console.log("Ses chunk alındı:", event.data.size);
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
				console.log("Ses kaydı durduruldu");

				// Recorder durdurulduğunda stream'i temizle
				try {
					audioStream.getTracks().forEach((track) => track.stop());
				} catch (err) {
					console.error("Audio stream tracks durdurulurken hata:", err);
				}
			};

			audioRecorder.value.onerror = (event) => {
				console.error("Audio recorder error:", event);

				// Hata durumunda stream'i temizle
				try {
					audioStream.getTracks().forEach((track) => track.stop());
				} catch (err) {
					console.error("Audio stream tracks durdurulurken hata:", err);
				}
			};

			console.log("Ses kaydı başlatılıyor");
			audioRecorder.value.start(1000);

			console.log("Ses MediaRecorder başlatıldı");

			return { audioPath: audioPath.value };
		} catch (error) {
			console.error("Ses kaydı başlatılırken hata:", error);
			return null;
		}
	};

	const stopAudioRecording = async () => {
		try {
			console.log("Ses kaydı durdurma başlatıldı");

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

			console.log("Ses kaydı durdurma tamamlandı");
		} catch (error) {
			console.error("Ses kaydı durdurulurken hata:", error);
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
		} else {
			initAudioAnalyser();
		}
		return microphoneEnabled.value;
	};

	const toggleSystemAudio = () => {
		systemAudioEnabled.value = !systemAudioEnabled.value;
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
