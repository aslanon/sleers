import { ref } from "vue";
import { useRouter } from "vue-router";
import { useScreenRecorder } from "./useScreenRecorder";

export const useMediaDevices = () => {
	const router = useRouter();
	const screenRecorder = useScreenRecorder();
	const videoDevices = ref([]);
	const audioDevices = ref([]);
	const selectedVideoDevice = ref("");
	const selectedAudioDevice = ref("");
	const mediaStream = ref(null);
	const isRecording = ref(false);
	const systemAudioEnabled = ref(true);
	const microphoneEnabled = ref(true);
	const microphoneLevel = ref(0);
	const currentAudioStream = ref(null);
	const selectedDelay = ref(0);
	const mousePositions = ref([]);
	const isAudioAnalyserActive = ref(false);
	let mediaRecorder = null;
	let audioContext = null;
	let audioAnalyser = null;
	let dataArray = null;
	let animationFrame = null;

	// Throttle fonksiyonu
	const throttle = (func, limit) => {
		let inThrottle;
		return function (...args) {
			if (!inThrottle) {
				func.apply(this, args);
				inThrottle = true;
				setTimeout(() => (inThrottle = false), limit);
			}
		};
	};

	const getDevices = async () => {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			videoDevices.value = devices.filter(
				(device) => device.kind === "videoinput"
			);
			audioDevices.value = devices.filter(
				(device) => device.kind === "audioinput"
			);

			if (videoDevices.value.length > 0) {
				selectedVideoDevice.value = videoDevices.value[0].deviceId;
			}
			if (audioDevices.value.length > 0) {
				selectedAudioDevice.value = audioDevices.value[0].deviceId;
			}
		} catch (error) {
			console.error("Cihazlar listelenirken hata oluştu:", error);
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
				},
			});

			currentAudioStream.value = stream;

			const source = audioContext.createMediaStreamSource(stream);
			audioAnalyser = audioContext.createAnalyser();
			audioAnalyser.fftSize = 256;
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

	const startCountdown = async () => {
		if (selectedDelay.value <= 0) return;

		const countdownElement = document.createElement("div");
		countdownElement.className =
			"fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xl !text-white bg-red-500/80 backdrop-blur-3xl border border-gray-700 rounded-full w-12 h-12 flex items-center justify-center z-50 countdown-number";

		document.body.appendChild(countdownElement);

		let countdown = selectedDelay.value / 1000;
		countdownElement.textContent = countdown;

		const countdownInterval = setInterval(() => {
			countdown--;
			countdownElement.textContent = countdown;

			if (countdown <= 0) {
				clearInterval(countdownInterval);
				document.body.removeChild(countdownElement);
			}
		});
	};

	const startRecording = async (options = null) => {
		try {
			// Önceki kaydı temizle
			if (mediaRecorder) {
				console.log("Önceki kayıt durduruluyor");
				await stopRecording();
				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			await startCountdown();
			isRecording.value = true;
			document.body.classList.add("recording");

			const useSystemAudio = options?.systemAudio ?? systemAudioEnabled.value;
			const useMicrophone = options?.microphone ?? microphoneEnabled.value;
			const micDeviceId =
				options?.microphoneDeviceId ?? selectedAudioDevice.value;

			// Ekran kaydını başlat
			const screenStream = await window.electron.screenRecorder.startRecording(
				options?.outputPath,
				options?.x || 0,
				options?.y || 0,
				options?.width || 1440,
				options?.height || 900
			);

			if (!screenStream) {
				throw new Error("Ekran kaydı başlatılamadı");
			}

			// Kamera kaydı için stream al
			let cameraStream = null;
			if (selectedVideoDevice.value) {
				try {
					cameraStream = await navigator.mediaDevices.getUserMedia({
						audio: false,
						video: {
							deviceId: { exact: selectedVideoDevice.value },
							width: { ideal: 1280 },
							height: { ideal: 720 },
							frameRate: { ideal: 30 },
						},
					});
				} catch (err) {
					console.error("Kamera akışı alınamadı:", err);
				}
			}

			// Ses kaydı için stream al
			let audioStream = null;
			if (useMicrophone && micDeviceId) {
				try {
					audioStream = await navigator.mediaDevices.getUserMedia({
						audio: {
							deviceId: { exact: micDeviceId },
							echoCancellation: true,
							noiseSuppression: true,
						},
						video: false,
					});
				} catch (err) {
					console.warn("Mikrofon akışı alınamadı:", err);
				}
			}

			// Tüm akışları birleştir
			const tracks = [
				...(screenStream?.getVideoTracks() || []),
				...(audioStream?.getAudioTracks() || []),
				...(cameraStream?.getVideoTracks() || []),
			];

			if (tracks.length === 0) {
				throw new Error("Kayıt için gerekli akışlar alınamadı");
			}

			const combinedStream = new MediaStream(tracks);
			mediaStream.value = combinedStream;

			console.log("MediaRecorder'lar oluşturuluyor");
			const screenRecorderInstance = new MediaRecorder(screenStream, {
				mimeType: "video/webm;codecs=vp9",
				videoBitsPerSecond: 50000000,
			});

			let cameraRecorderInstance = null;
			if (cameraStream) {
				cameraRecorderInstance = new MediaRecorder(cameraStream, {
					mimeType: "video/webm;codecs=vp9",
					videoBitsPerSecond: 8000000,
				});
			}

			let audioRecorderInstance = null;
			if (audioStream) {
				audioRecorderInstance = new MediaRecorder(audioStream, {
					mimeType: "audio/webm;codecs=opus",
					audioBitsPerSecond: 320000,
				});
			}

			const screenChunks = [];
			const cameraChunks = [];
			const audioChunks = [];

			screenRecorderInstance.ondataavailable = (event) => {
				if (event.data.size > 0) {
					screenChunks.push(event.data);
				}
			};

			if (cameraRecorderInstance) {
				cameraRecorderInstance.ondataavailable = (event) => {
					if (event.data.size > 0) {
						cameraChunks.push(event.data);
					}
				};
			}

			if (audioRecorderInstance) {
				audioRecorderInstance.ondataavailable = (event) => {
					if (event.data.size > 0) {
						audioChunks.push(event.data);
					}
				};
			}

			screenRecorderInstance.start(1000);
			if (cameraRecorderInstance) cameraRecorderInstance.start(1000);
			if (audioRecorderInstance) audioRecorderInstance.start(1000);

			mediaRecorder = {
				screen: screenRecorderInstance,
				camera: cameraRecorderInstance,
				audio: audioRecorderInstance,
				stop: async () => {
					document.body.classList.remove("recording");
					screenRecorderInstance.stop();
					if (cameraRecorderInstance) cameraRecorderInstance.stop();
					if (audioRecorderInstance) audioRecorderInstance.stop();

					const screenPath = await screenRecorder.saveScreenRecording(
						screenChunks
					);
					let cameraPath = null;
					let audioPath = null;

					if (cameraChunks.length > 0) {
						const cameraBlob = new Blob(cameraChunks, { type: "video/webm" });
						const cameraBuffer = await cameraBlob.arrayBuffer();
						const cameraBase64 = btoa(
							new Uint8Array(cameraBuffer).reduce(
								(data, byte) => data + String.fromCharCode(byte),
								""
							)
						);
						const cameraDataUrl = `data:video/webm;base64,${cameraBase64}`;
						cameraPath = await window.electron?.fileSystem.saveTempVideo(
							cameraDataUrl,
							"camera"
						);
					}

					if (audioChunks.length > 0) {
						const audioBlob = new Blob(audioChunks, {
							type: "audio/webm;codecs=opus",
						});
						const audioBuffer = await audioBlob.arrayBuffer();
						const audioBase64 = btoa(
							new Uint8Array(audioBuffer).reduce(
								(data, byte) => data + String.fromCharCode(byte),
								""
							)
						);
						const audioDataUrl = `data:audio/webm;base64,${audioBase64}`;
						audioPath = await window.electron?.fileSystem.saveTempVideo(
							audioDataUrl,
							"audio"
						);
					}

					return {
						videoPath: screenPath,
						cameraPath,
						audioPath,
					};
				},
			};

			isRecording.value = true;
		} catch (error) {
			console.error("Kayıt başlatılırken hata:", error);
			document.body.classList.remove("recording");
			isRecording.value = false;
			if (window.electron?.ipcRenderer) {
				window.electron.ipcRenderer.send("STOP_MOUSE_TRACKING");
			}
			throw error; // Hatayı yukarı fırlat
		}
	};

	const stopRecording = async () => {
		isRecording.value = false;
		if (window.electron?.ipcRenderer) {
			window.electron.ipcRenderer.send("STOP_MOUSE_TRACKING");
		}

		try {
			if (mediaRecorder) {
				const paths = await mediaRecorder.stop();
				mediaRecorder = null;
				await screenRecorder.stopScreenRecording();
				isRecording.value = false;
				return paths;
			}
		} catch (error) {
			console.error("Kayıt durdurulurken hata:", error);
		}

		document.body.classList.remove("recording");
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
		videoDevices,
		audioDevices,
		selectedVideoDevice,
		selectedAudioDevice,
		mediaStream,
		isRecording,
		systemAudioEnabled,
		microphoneEnabled,
		microphoneLevel,
		currentAudioStream,
		isAudioAnalyserActive,
		selectedDelay,
		mousePositions,
		getDevices,
		startRecording,
		stopRecording,
		initAudioAnalyser,
		cleanupAudioAnalyser,
		toggleMicrophone,
		toggleSystemAudio,
		throttle,
	};
};
