import { ref } from "vue";

export const useCamera = () => {
	const videoDevices = ref([]);
	const selectedVideoDevice = ref("");
	const isCameraActive = ref(false);
	const cameraPath = ref(null);
	const cameraRecorder = ref(null);

	// Kamera için varsayılan konfigürasyon
	const defaultConfig = {
		width: { ideal: 1280 },
		height: { ideal: 720 },
		frameRate: { ideal: 30 },
		videoBitsPerSecond: 8000000,
		mimeType: "video/webm;codecs=vp9",
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

	const getVideoDevices = async () => {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			videoDevices.value = devices.filter(
				(device) => device.kind === "videoinput"
			);

			if (videoDevices.value.length > 0) {
				selectedVideoDevice.value = videoDevices.value[0].deviceId;
			}
		} catch (error) {
			console.error("Kamera cihazları listelenirken hata oluştu:", error);
		}
	};

	const startCameraStream = async () => {
		// Kamera kaydı için stream al
		let cameraStream = null;
		if (selectedVideoDevice.value) {
			try {

				cameraStream = await navigator.mediaDevices.getUserMedia({
					audio: false,
					video: {
						deviceId: { exact: selectedVideoDevice.value },
						width: config.value.width,
						height: config.value.height,
						frameRate: config.value.frameRate,
					},
				});


				// Kamera track'lerini ayrı bir stream'de tut
				cameraStream = new MediaStream(cameraStream.getVideoTracks());
			} catch (err) {
				console.error("Kamera akışı alınamadı:", {
					name: err.name,
					message: err.message,
					constraint: err.constraint,
					deviceId: selectedVideoDevice.value,
				});

				// Hata OverconstrainedError ise, daha basit ayarlarla tekrar deneyelim
				if (err.name === "OverconstrainedError") {
					try {
						cameraStream = await navigator.mediaDevices.getUserMedia({
							audio: false,
							video: {
								deviceId: { exact: selectedVideoDevice.value },
							},
						});
						// Başarılı olursa yeni bir MediaStream oluştur
						cameraStream = new MediaStream(cameraStream.getVideoTracks());
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

		return cameraStream;
	};

	const startCameraRecording = async () => {
		try {
			const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;
			if (!IPC_EVENTS) {
				throw new Error("IPC events are not available");
			}


			const cameraStream = await startCameraStream();

			if (!cameraStream) {
				console.error("Kamera stream'i alınamadı");
				return null;
			}


			// Dosya yolunu al
			cameraPath.value = await window.electron?.ipcRenderer.invoke(
				IPC_EVENTS.START_MEDIA_STREAM,
				"camera"
			);

			// Kamera kaydı için MediaRecorder oluştur
			cameraRecorder.value = new MediaRecorder(cameraStream, {
				mimeType: config.value.mimeType,
				videoBitsPerSecond: config.value.videoBitsPerSecond,
			});


			// Kamera chunk'larını doğrudan dosyaya yaz
			cameraRecorder.value.ondataavailable = async (event) => {
				if (event.data.size > 0) {
					try {
						const chunk = await event.data.arrayBuffer();
						await window.electron?.ipcRenderer.invoke(
							IPC_EVENTS.WRITE_MEDIA_CHUNK,
							"camera",
							chunk
						);
					} catch (error) {
						console.error("Kamera chunk'ı yazılırken hata:", error);
					}
				}
			};

			cameraRecorder.value.onstop = () => {
				isCameraActive.value = false;

				// Recorder durdurulduğunda stream'i temizle
				try {
					cameraStream.getTracks().forEach((track) => track.stop());
				} catch (err) {
					console.error("Camera stream tracks durdurulurken hata:", err);
				}
			};

			cameraRecorder.value.onerror = (event) => {
				console.error("Camera recorder error:", event);
				isCameraActive.value = false;

				// Hata durumunda stream'i temizle
				try {
					cameraStream.getTracks().forEach((track) => track.stop());
				} catch (err) {
					console.error("Camera stream tracks durdurulurken hata:", err);
				}
			};

			// Daha sık chunk gönderimi için interval değerini düşür
			cameraRecorder.value.start(config.value.chunkInterval);
			isCameraActive.value = true;

			return { cameraPath: cameraPath.value };
		} catch (error) {
			console.error("Kamera kaydı başlatılırken hata:", error);
			isCameraActive.value = false;
			return null;
		}
	};

	const stopCameraRecording = async () => {
		try {

			// Önce state'i false yap ki yeni chunk'lar oluşmasın
			isCameraActive.value = false;

			// Recorder'ı ve stream'i temizle
			let cameraStreamTracks = [];

			// Recorder'ı durdur ve event listener'ları temizle
			if (cameraRecorder.value) {
				try {
					// Event listener'ları kaldır
					cameraRecorder.value.ondataavailable = null;
					cameraRecorder.value.onerror = null;
					cameraRecorder.value.onstop = null;

					// Stream track'lerini kaydet
					if (cameraRecorder.value.stream) {
						cameraStreamTracks = [...cameraRecorder.value.stream.getTracks()];
					}

					// Recorder'ı durdur
					if (cameraRecorder.value.state === "recording") {
						cameraRecorder.value.stop();
					}
				} catch (recorderError) {
					console.error("Kamera recorder durdurulurken hata:", recorderError);
				} finally {
					// Recorder'ı null yap
					cameraRecorder.value = null;
				}
			}

			// Tüm track'leri durdur
			cameraStreamTracks.forEach((track) => {
				try {
					track.stop();
				} catch (err) {
					console.error(`Track durdurulurken hata: ${track.id}`, err);
				}
			});

			// Stream'i sonlandır
			const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;
			if (IPC_EVENTS) {
				try {
					await window.electron?.ipcRenderer.invoke(
						IPC_EVENTS.END_MEDIA_STREAM,
						"camera"
					);
				} catch (streamError) {
					console.error("Camera stream sonlandırılırken hata:", streamError);
				}
			}

			return cameraPath.value;
		} catch (error) {
			console.error("Kamera kaydı durdurulurken hata:", error);
			isCameraActive.value = false;
			return cameraPath.value;
		}
	};

	return {
		videoDevices,
		selectedVideoDevice,
		isCameraActive,
		cameraPath,
		config,
		updateConfig,
		getVideoDevices,
		startCameraStream,
		startCameraRecording,
		stopCameraRecording,
	};
};
