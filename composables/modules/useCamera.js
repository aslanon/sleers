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
		console.log("Kamera konfigürasyonu güncellendi:", config.value);
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
				console.log("Kamera cihazları:", videoDevices.value);
				console.log("Seçili kamera cihazı:", {
					deviceId: selectedVideoDevice.value,
					device: videoDevices.value.find(
						(d) => d.deviceId === selectedVideoDevice.value
					),
				});

				cameraStream = await navigator.mediaDevices.getUserMedia({
					audio: false,
					video: {
						deviceId: { exact: selectedVideoDevice.value },
						width: config.value.width,
						height: config.value.height,
						frameRate: config.value.frameRate,
					},
				});

				console.log("Kamera stream'i başarıyla alındı:", {
					tracks: cameraStream.getTracks().length,
					settings: cameraStream.getVideoTracks()[0]?.getSettings(),
					constraints: cameraStream.getVideoTracks()[0]?.getConstraints(),
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
						console.log("Basit ayarlarla tekrar deneniyor...");
						cameraStream = await navigator.mediaDevices.getUserMedia({
							audio: false,
							video: {
								deviceId: { exact: selectedVideoDevice.value },
							},
						});
						// Başarılı olursa yeni bir MediaStream oluştur
						cameraStream = new MediaStream(cameraStream.getVideoTracks());
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

		return cameraStream;
	};

	const startCameraRecording = async () => {
		try {
			const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;
			if (!IPC_EVENTS) {
				throw new Error("IPC events are not available");
			}

			console.log("Kamera stream'i başlatılıyor...");

			const cameraStream = await startCameraStream();

			if (!cameraStream) {
				console.error("Kamera stream'i alınamadı");
				return null;
			}

			console.log("Kamera stream'i başlatıldı");
			console.log("Kamera MediaRecorder oluşturuluyor");

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

			console.log("Kamera recorder event listener'ları ekleniyor");

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
				console.log("Kamera kaydı durduruldu");
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

			console.log("Kamera kaydı başlatılıyor");
			// Daha sık chunk gönderimi için interval değerini düşür
			cameraRecorder.value.start(config.value.chunkInterval);

			console.log("Kamera MediaRecorder başlatıldı");
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
			console.log("Kamera kaydı durdurma başlatıldı");

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
						console.log("Kamera recorder durduruluyor...");
						cameraRecorder.value.stop();
						console.log("Kamera recorder durduruldu");
					}
				} catch (recorderError) {
					console.error("Kamera recorder durdurulurken hata:", recorderError);
				} finally {
					// Recorder'ı null yap
					cameraRecorder.value = null;
				}
			}

			// Tüm track'leri durdur
			console.log(
				"Kamera stream track'leri durduruluyor...",
				cameraStreamTracks.length
			);
			cameraStreamTracks.forEach((track) => {
				try {
					track.stop();
					console.log(`Track durduruldu: ${track.id} (${track.kind})`);
				} catch (err) {
					console.error(`Track durdurulurken hata: ${track.id}`, err);
				}
			});

			// Stream'i sonlandır
			const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;
			if (IPC_EVENTS) {
				try {
					console.log("Kamera medya stream'i sonlandırılıyor...");
					await window.electron?.ipcRenderer.invoke(
						IPC_EVENTS.END_MEDIA_STREAM,
						"camera"
					);
					console.log("Kamera medya stream'i sonlandırıldı");
				} catch (streamError) {
					console.error("Camera stream sonlandırılırken hata:", streamError);
				}
			}

			console.log("Kamera kaydı durdurma tamamlandı");
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
