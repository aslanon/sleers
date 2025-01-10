import { ref } from "vue";
import { useRouter } from "vue-router";

export const useMediaDevices = () => {
	const router = useRouter();
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
	let mediaRecorder = null;
	let audioContext = null;
	let audioAnalyser = null;
	let dataArray = null;
	let animationFrame = null;
	const isAudioAnalyserActive = ref(false);

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
				selectedVideoDevice.value = videoDevices.value[0].label;
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

	const startRecording = async (options = null) => {
		try {
			isRecording.value = true;

			document.body.classList.add("recording");

			const useSystemAudio = options?.systemAudio ?? systemAudioEnabled.value;
			const useMicrophone = options?.microphone ?? microphoneEnabled.value;
			const micDeviceId =
				options?.microphoneDeviceId ?? selectedAudioDevice.value;

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

			console.log("2. Stream başlatılıyor...", {
				useSystemAudio,
				useMicrophone,
				micDeviceId,
				audioConfig,
			});

			const { screenStream, cameraStream } = await startMediaStream({
				audio: audioConfig,
				video: {
					mandatory: {
						chromeMediaSource: "desktop",
					},
				},
				sourceType: options?.sourceType || "display",
			});

			console.log("3. Stream başlatıldı");

			if (mediaStream.value) {
				console.log("4. MediaRecorder'lar oluşturuluyor");

				const screenRecorder = new MediaRecorder(screenStream, {
					mimeType: "video/webm;codecs=vp9",
					videoBitsPerSecond: 50000000,
				});

				let cameraRecorder = null;
				if (cameraStream) {
					cameraRecorder = new MediaRecorder(cameraStream, {
						mimeType: "video/webm;codecs=vp9",
						videoBitsPerSecond: 8000000,
					});
				}

				let audioRecorder = null;
				if (mediaStream.value.getAudioTracks().length > 0) {
					const audioStream = new MediaStream(
						mediaStream.value.getAudioTracks()
					);
					audioRecorder = new MediaRecorder(audioStream, {
						mimeType: "audio/webm;codecs=opus",
						audioBitsPerSecond: 320000,
					});

					console.log("Ses kaydı yapılandırması:", {
						systemAudio: useSystemAudio,
						microphone: useMicrophone,
						audioTracks: audioStream.getAudioTracks().length,
					});
				}

				const screenChunks = [];
				screenRecorder.ondataavailable = (event) => {
					if (event.data.size > 0) {
						screenChunks.push(event.data);
					}
				};

				const cameraChunks = [];
				if (cameraRecorder) {
					cameraRecorder.ondataavailable = (event) => {
						if (event.data.size > 0) {
							cameraChunks.push(event.data);
						}
					};
				}

				const audioChunks = [];
				if (audioRecorder) {
					audioRecorder.ondataavailable = (event) => {
						if (event.data.size > 0) {
							audioChunks.push(event.data);
						}
					};
				}

				screenRecorder.start(1000);
				if (cameraRecorder) cameraRecorder.start(1000);
				if (audioRecorder) audioRecorder.start(1000);

				mediaRecorder = {
					screen: screenRecorder,
					camera: cameraRecorder,
					audio: audioRecorder,
					stop: async () => {
						document.body.classList.remove("recording");

						screenRecorder.stop();
						if (cameraRecorder) cameraRecorder.stop();
						if (audioRecorder) audioRecorder.stop();

						await saveRecording({
							screen: screenChunks,
							camera: cameraChunks,
							audio: audioChunks,
						});
					},
				};

				console.log("8. Tüm MediaRecorder'lar başlatıldı");
				isRecording.value = true;
			}
		} catch (error) {
			console.error("Kayıt başlatılırken hata:", error);
			document.body.classList.remove("recording");
			isRecording.value = false;
		}
	};

	const startMediaStream = async (streamOptions) => {
		try {
			const sources = await window.electron?.desktopCapturer.getSources({
				types: ["window", "screen"],
				thumbnailSize: { width: 1280, height: 720 },
			});

			console.log("Ekran kaynakları:", sources);

			if (!sources || sources.length === 0) {
				throw new Error("Ekran kaynakları bulunamadı");
			}

			let selectedSource = sources[0];
			if (streamOptions?.sourceType === "display") {
				selectedSource =
					sources.find((source) => source.id.startsWith("screen:")) ||
					sources[0];
			} else if (streamOptions?.sourceType === "window") {
				selectedSource =
					sources.find((source) => source.id.startsWith("window:")) ||
					sources[0];
			}

			const screenStream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				systemAudio: "include",
				video: {
					cursor: "never",
					mandatory: {
						cursor: "never",
						chromeMediaSource: "desktop",
						chromeMediaSourceId: selectedSource.id,
						...(streamOptions?.width && {
							minWidth: streamOptions.width,
							maxWidth: streamOptions.width,
							width: streamOptions.width,
						}),
						...(streamOptions?.height && {
							minHeight: streamOptions.height,
							maxHeight: streamOptions.height,
							height: streamOptions.height,
						}),
						...(streamOptions?.x &&
							streamOptions?.y && {
								x: streamOptions.x,
								y: streamOptions.y,
							}),
					},
				},
			});

			let audioStream = null;
			if (selectedAudioDevice.value) {
				try {
					audioStream = await navigator.mediaDevices.getUserMedia({
						audio: {
							deviceId: { exact: selectedAudioDevice.value },
							echoCancellation: true,
							noiseSuppression: true,
						},
						video: false,
					});
				} catch (err) {
					console.warn("Mikrofon akışı alınamadı:", err);
				}
			}

			const tracks = [
				...screenStream.getVideoTracks(),
				...(audioStream?.getAudioTracks() || []),
			];

			const combinedStream = new MediaStream(tracks);
			mediaStream.value = combinedStream;
			isRecording.value = true;

			return { screenStream: combinedStream };
		} catch (error) {
			console.error("Kayıt başlatılırken hata oluştu:", error);
			throw error;
		}
	};

	const stopRecording = async () => {
		isRecording.value = false;

		try {
			console.log("1. Kayıt durdurma başlatıldı");
			if (mediaRecorder) {
				console.log("2. MediaRecorder'lar durduruluyor");
				await mediaRecorder.stop();
				mediaRecorder = null;
			}
			console.log("3. Stream durduruluyor");
			await stopMediaStream();
			console.log("4. Kayıt durdurma tamamlandı");
			isRecording.value = false;
		} catch (error) {
			console.error("Kayıt durdurulurken hata:", error);
		}

		document.body.classList.remove("recording");
	};

	const stopMediaStream = () => {
		if (mediaStream.value) {
			mediaStream.value.getTracks().forEach((track) => {
				track.stop();
			});
			mediaStream.value = null;
			isRecording.value = false;
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

	const saveRecording = async (chunks) => {
		try {
			console.log("1. Kayıtlar kaydediliyor...", {
				hasScreen: chunks.screen.length > 0,
				hasCamera: chunks.camera.length > 0,
				hasAudio: chunks.audio.length > 0,
			});

			// Ekran kaydını kaydet
			const screenBlob = new Blob(chunks.screen, { type: "video/webm" });
			const screenBuffer = await screenBlob.arrayBuffer();
			const screenBase64 = btoa(
				new Uint8Array(screenBuffer).reduce(
					(data, byte) => data + String.fromCharCode(byte),
					""
				)
			);
			const screenDataUrl = `data:video/webm;base64,${screenBase64}`;
			const screenPath = await window.electron?.fileSystem.saveTempVideo(
				screenDataUrl,
				"screen"
			);

			console.log("2. Ekran kaydı kaydedildi:", screenPath);

			// Kamera kaydını kaydet (varsa)
			let cameraPath = null;
			if (chunks.camera && chunks.camera.length > 0) {
				const cameraBlob = new Blob(chunks.camera, { type: "video/webm" });
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
				console.log("3. Kamera kaydı kaydedildi:", cameraPath);
			}

			// Ses kaydını kaydet (varsa)
			let audioPath = null;
			if (chunks.audio && chunks.audio.length > 0) {
				const audioBlob = new Blob(chunks.audio, {
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
				console.log("4. Ses kaydı kaydedildi:", audioPath);
			}

			// Editör sayfasına yönlendir
			router.push({
				path: "/editor",
				query: {
					screen: screenPath ? encodeURIComponent(screenPath) : undefined,
					camera: cameraPath ? encodeURIComponent(cameraPath) : undefined,
					audio: audioPath ? encodeURIComponent(audioPath) : undefined,
				},
			});
		} catch (error) {
			console.error("Kayıtlar kaydedilirken hata:", error);
			alert("Kayıtlar kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.");
		}
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
		getDevices,
		startRecording,
		stopRecording,
		saveRecording,
		initAudioAnalyser,
		cleanupAudioAnalyser,
		toggleMicrophone,
		toggleSystemAudio,
		throttle,
	};
};
