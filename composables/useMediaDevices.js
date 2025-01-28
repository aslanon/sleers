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
				// Kısa bir bekleme ekleyelim
				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			// Geri sayım başlat
			await startCountdown();

			isRecording.value = true;
			document.body.classList.add("recording");

			// İmleci gizle
			if (window.electron?.ipcRenderer) {
				window.electron.ipcRenderer.send("HIDE_CURSOR");
			}

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

			if (screenStream) {
				console.log("4. MediaRecorder'lar oluşturuluyor");

				const screenRecorder = new MediaRecorder(screenStream, {
					mimeType: "video/webm;codecs=vp9",
					videoBitsPerSecond: 50000000,
				});

				let cameraRecorder = null;
				if (cameraStream) {
					console.log("Kamera stream'i bulundu, recorder oluşturuluyor");
					cameraRecorder = new MediaRecorder(cameraStream, {
						mimeType: "video/webm;codecs=vp9",
						videoBitsPerSecond: 8000000,
					});
				}

				let audioRecorder = null;
				if (screenStream.getAudioTracks().length > 0) {
					const audioStream = new MediaStream(screenStream.getAudioTracks());
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
					console.log("Kamera recorder event listener'ları ekleniyor");
					cameraRecorder.ondataavailable = (event) => {
						if (event.data.size > 0) {
							console.log("Kamera chunk alındı:", event.data.size);
							cameraChunks.push(event.data);
						}
					};
					console.log("Kamera kaydı başlatılıyor");
					cameraRecorder.start(1000);
				}

				const audioChunks = [];
				if (audioRecorder) {
					audioRecorder.ondataavailable = (event) => {
						if (event.data.size > 0) {
							audioChunks.push(event.data);
						}
					};
				}

				console.log("5. Kayıt başlatılıyor");
				if (screenRecorder.state === "recording") {
					console.log("Ekran kaydı zaten çalışıyor, durduruluyor");
					screenRecorder.stop();
				}
				screenRecorder.start(1000);

				if (cameraRecorder) {
					console.log("Kamera kaydı başlatılıyor");
					if (cameraRecorder.state === "recording") {
						console.log("Kamera kaydı zaten çalışıyor, durduruluyor");
						cameraRecorder.stop();
					}
					cameraRecorder.start(1000);
				}

				if (audioRecorder) {
					if (audioRecorder.state === "recording") {
						console.log("Ses kaydı zaten çalışıyor, durduruluyor");
						audioRecorder.stop();
					}
					audioRecorder.start(1000);
				}

				mediaRecorder = {
					screen: screenRecorder,
					camera: cameraRecorder,
					audio: audioRecorder,
					stop: async () => {
						document.body.classList.remove("recording");

						console.log("MediaRecorder stop başlıyor:", {
							hasScreen: !!screenRecorder,
							hasCamera: !!cameraRecorder,
							hasAudio: !!audioRecorder,
							cameraChunksLength: cameraChunks.length,
						});

						screenRecorder.stop();
						if (cameraRecorder) {
							console.log("Kamera kaydı durduruluyor");
							cameraRecorder.stop();
						}
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
			if (window.electron?.ipcRenderer) {
				window.electron.ipcRenderer.send("STOP_MOUSE_TRACKING");
			}
		}
	};

	const startMediaStream = async (streamOptions) => {
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
			if (streamOptions?.sourceType === "display") {
				selectedSource =
					filteredSources.find((source) => source.id.startsWith("screen:")) ||
					filteredSources[0];
			} else if (streamOptions?.sourceType === "window") {
				selectedSource =
					filteredSources.find((source) => source.id.startsWith("window:")) ||
					filteredSources[0];
			}

			// Ekran kaydı için stream al
			const screenStream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				systemAudio: "include",
				video: {
					mandatory: {
						chromeMediaSource: "desktop",
						chromeMediaSourceId: selectedSource.id,
						cursor: "never",
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
					cursor: "never",
				},
			});

			// Kamera kaydı için stream al
			let cameraStream = null;
			if (selectedVideoDevice.value) {
				try {
					console.log("Kamera cihazları:", videoDevices.value);
					console.log("Seçili kamera cihazı:", {
						deviceId: selectedVideoDevice.value,
						device: videoDevices.value.find(
							(d) => d.deviceId === selectedVideoDevice.value
						),
					});

					// Önce basit bir kamera stream'i deneyelim
					cameraStream = await navigator.mediaDevices.getUserMedia({
						audio: false,
						video: true,
					});

					console.log(
						"Basit kamera stream'i alındı, şimdi detaylı ayarlar deneniyor"
					);

					// Eğer basit stream başarılıysa, detaylı ayarlarla tekrar deneyelim
					if (cameraStream) {
						// Önceki stream'i kapat
						cameraStream.getTracks().forEach((track) => track.stop());

						cameraStream = await navigator.mediaDevices.getUserMedia({
							audio: false,
							video: {
								deviceId: { exact: selectedVideoDevice.value },
								width: { ideal: 1280 },
								height: { ideal: 720 },
								frameRate: { ideal: 30 },
							},
						});

						console.log("Kamera stream'i başarıyla alındı:", {
							tracks: cameraStream.getTracks().length,
							settings: cameraStream.getVideoTracks()[0]?.getSettings(),
							constraints: cameraStream.getVideoTracks()[0]?.getConstraints(),
						});
					}
				} catch (err) {
					console.error("Kamera akışı alınamadı:", {
						name: err.name,
						message: err.message,
						constraint: err.constraint,
						deviceId: selectedVideoDevice.value,
						availableDevices: videoDevices.value.map((d) => ({
							deviceId: d.deviceId,
							label: d.label,
							kind: d.kind,
						})),
					});

					// Hata OverconstrainedError ise, daha basit ayarlarla tekrar deneyelim
					if (err.name === "OverconstrainedError") {
						try {
							console.log("Basit ayarlarla tekrar deneniyor...");
							cameraStream = await navigator.mediaDevices.getUserMedia({
								audio: false,
								video: {
									deviceId: { exact: selectedVideoDevice.value },
								},
							});
							console.log("Basit ayarlarla kamera stream'i alındı");
						} catch (retryErr) {
							console.error("Basit ayarlarla da alınamadı:", retryErr);
						}
					}
				}
			} else {
				console.warn(
					"Seçili kamera cihazı bulunamadı. Mevcut cihazlar:",
					videoDevices.value.map((d) => ({
						deviceId: d.deviceId,
						label: d.label,
					}))
				);
			}

			// Ses kaydı için stream al
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
				...(cameraStream?.getVideoTracks() || []),
			];

			const combinedStream = new MediaStream(tracks);
			mediaStream.value = combinedStream;
			isRecording.value = true;

			return { screenStream: combinedStream, cameraStream };
		} catch (error) {
			console.error("Kayıt başlatılırken hata oluştu:", error);
			throw error;
		}
	};

	const stopRecording = async () => {
		isRecording.value = false;

		// İmleci göster
		if (window.electron?.ipcRenderer) {
			window.electron.ipcRenderer.send("SHOW_CURSOR");
		}

		if (window.electron?.ipcRenderer) {
			window.electron.ipcRenderer.send("STOP_MOUSE_TRACKING");
		}

		try {
			console.log("1. Kayıt durdurma başlatıldı");
			if (mediaRecorder) {
				console.log("2. MediaRecorder durumu:", {
					screen: !!mediaRecorder.screen,
					camera: !!mediaRecorder.camera,
					audio: !!mediaRecorder.audio,
				});
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
			console.log("saveRecording başlıyor, gelen chunks:", {
				screen: {
					exists: !!chunks.screen,
					length: chunks.screen?.length || 0,
					totalSize:
						chunks.screen?.reduce((acc, chunk) => acc + chunk.size, 0) || 0,
				},
				camera: {
					exists: !!chunks.camera,
					length: chunks.camera?.length || 0,
					totalSize:
						chunks.camera?.reduce((acc, chunk) => acc + chunk.size, 0) || 0,
				},
				audio: {
					exists: !!chunks.audio,
					length: chunks.audio?.length || 0,
					totalSize:
						chunks.audio?.reduce((acc, chunk) => acc + chunk.size, 0) || 0,
				},
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

			console.log("Ekran kaydı kaydedildi:", {
				path: screenPath,
				size: screenBlob.size,
			});

			// Kamera kaydını kaydet (varsa)
			let cameraPath = null;
			if (chunks.camera && chunks.camera.length > 0) {
				console.log("Kamera chunks kontrol:", {
					length: chunks.camera.length,
					sizes: chunks.camera.map((chunk) => chunk.size),
					totalSize: chunks.camera.reduce((acc, chunk) => acc + chunk.size, 0),
				});

				const cameraBlob = new Blob(chunks.camera, { type: "video/webm" });
				console.log("Kamera blob oluşturuldu:", {
					size: cameraBlob.size,
					type: cameraBlob.type,
				});

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

				console.log("Kamera kaydı kaydedildi:", {
					path: cameraPath,
					size: cameraBlob.size,
				});
			} else {
				console.warn("Kamera chunks eksik veya boş:", {
					exists: !!chunks.camera,
					length: chunks.camera?.length || 0,
				});
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
				console.log("Ses kaydı kaydedildi:", {
					path: audioPath,
					size: audioBlob.size,
				});
			}

			// Tüm dosya yollarını logla
			console.log("Tüm kayıt dosyaları:", {
				screen: screenPath,
				camera: cameraPath,
				audio: audioPath,
			});

			return {
				videoPath: screenPath,
				cameraPath,
				audioPath,
			};
		} catch (error) {
			console.error("Kayıtlar kaydedilirken hata:", error);
			alert("Kayıtlar kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.");
			return null;
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
		selectedDelay,
		mousePositions,
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
