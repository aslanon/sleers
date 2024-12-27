import { ref, watch } from "vue";
import { navigateTo } from "#app";

export const useMediaDevices = () => {
	const videoDevices = ref<MediaDeviceInfo[]>([]);
	const audioDevices = ref<MediaDeviceInfo[]>([]);
	const selectedVideoDevice = ref<string>("");
	const selectedAudioDevice = ref<string>("");
	const mediaStream = ref<MediaStream | null>(null);
	const isRecording = ref(false);
	const recordedChunks = ref<Blob[]>([]);
	const currentCameraStream = ref<MediaStream | null>(null);

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

	const startRecording = async (streamOptions: any) => {
		try {
			// Ekran seçimi için kaynakları al
			const sources = await window.electron?.desktopCapturer.getSources({
				types: ["window", "screen"],
				thumbnailSize: { width: 1280, height: 720 },
			});

			if (!sources || sources.length === 0) {
				throw new Error("Ekran kaynakları bulunamadı");
			}

			// Ekran yakalama
			const screenStream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: {
					// @ts-ignore
					mandatory: {
						chromeMediaSource: "desktop",
						chromeMediaSourceId: sources[0].id,
						minWidth: streamOptions?.width || 1280,
						maxWidth: streamOptions?.width || 1920,
						minHeight: streamOptions?.height || 720,
						maxHeight: streamOptions?.height || 1080,
						...(streamOptions?.x &&
							streamOptions?.y && {
								x: streamOptions.x,
								y: streamOptions.y,
							}),
					},
				},
			});

			// Kamera yakalama (isteğe bağlı)
			let cameraStream = null;
			if (selectedVideoDevice.value) {
				try {
					cameraStream = await navigator.mediaDevices.getUserMedia({
						video: {
							deviceId: { exact: selectedVideoDevice.value },
							width: { ideal: 1280 },
							height: { ideal: 720 },
						},
						audio: false,
					});
				} catch (err) {
					console.warn("Kamera akışı alınamadı:", err);
				}
			}

			// Ses yakalama (isteğe bağlı)
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

			// Tüm akışları birleştir
			const tracks = [
				...screenStream.getVideoTracks(),
				...(audioStream?.getAudioTracks() || []),
				...(cameraStream?.getVideoTracks() || []),
			];

			const combinedStream = new MediaStream(tracks);
			mediaStream.value = combinedStream;
			isRecording.value = true;

			return { screenStream, cameraStream };
		} catch (error) {
			console.error("Kayıt başlatılırken hata oluştu:", error);
			throw error;
		}
	};

	const stopRecording = () => {
		if (mediaStream.value) {
			// Tüm track'leri durdur
			mediaStream.value.getTracks().forEach((track) => {
				track.stop();
			});
			mediaStream.value = null;
			isRecording.value = false;
		}
	};

	const saveRecording = async (
		chunks: Blob[],
		cropArea?: { x: number; y: number; width: number; height: number }
	) => {
		try {
			console.log("1. Kayıt kaydediliyor...", {
				chunks: chunks.length,
				cropArea,
			});
			const blob = new Blob(chunks, { type: "video/webm" });
			const buffer = await blob.arrayBuffer();
			const base64Data = btoa(
				new Uint8Array(buffer).reduce(
					(data, byte) => data + String.fromCharCode(byte),
					""
				)
			);
			const dataUrl = `data:video/webm;base64,${base64Data}`;
			console.log("2. Base64 dönüşümü tamamlandı");

			// Geçici dosyayı kaydet
			const tempPath = await window.electron?.fileSystem.saveTempVideo(dataUrl);
			console.log("3. Geçici video kaydedildi:", tempPath);

			// Eğer kırpma alanı varsa, videoyu kırp
			if (cropArea && tempPath) {
				console.log("4. Video kırpma başlıyor...", cropArea);
				try {
					// Video boyutlarını al
					const video = document.createElement("video");
					video.src = URL.createObjectURL(blob);
					await new Promise((resolve) => {
						video.onloadedmetadata = () => resolve(null);
						video.onerror = () => {
							console.error("Video yüklenirken hata oluştu");
							resolve(null);
						};
					});

					// Ekran ölçeğini hesapla
					const screenScale = window.devicePixelRatio || 1;
					console.log("Ekran ölçeği:", screenScale);

					// Kırpma koordinatlarını video boyutuna göre ölçekle
					const scaleX = video.videoWidth / window.innerWidth;
					const scaleY = video.videoHeight / window.innerHeight;

					// Koordinatları pozitif sayılara çevir ve sınırları kontrol et
					const x = Math.max(
						0,
						Math.min(cropArea.x, window.innerWidth - cropArea.width)
					);
					const y = Math.max(
						0,
						Math.min(cropArea.y, window.innerHeight - cropArea.height)
					);
					const width = Math.max(
						100,
						Math.min(cropArea.width, window.innerWidth - x)
					);
					const height = Math.max(
						100,
						Math.min(cropArea.height, window.innerHeight - y)
					);

					// Video koordinatlarına ölçekle
					const scaledCropArea = {
						x: Math.round(x * scaleX),
						y: Math.round(y * scaleY),
						width: Math.round(width * scaleX),
						height: Math.round(height * scaleY),
					};

					console.log("Video ve kırpma bilgileri:", {
						videoWidth: video.videoWidth,
						videoHeight: video.videoHeight,
						windowWidth: window.innerWidth,
						windowHeight: window.innerHeight,
						screenScale,
						scaleX,
						scaleY,
						originalCropArea: cropArea,
						adjustedCropArea: { x, y, width, height },
						scaledCropArea,
					});

					// Kırpma alanının minimum boyutlarını ve video sınırlarını kontrol et
					if (scaledCropArea.width < 100 || scaledCropArea.height < 100) {
						throw new Error(
							`Kırpma alanı çok küçük: ${scaledCropArea.width}x${scaledCropArea.height} (minimum 100x100)`
						);
					}

					if (
						scaledCropArea.x + scaledCropArea.width > video.videoWidth ||
						scaledCropArea.y + scaledCropArea.height > video.videoHeight
					) {
						throw new Error("Kırpma alanı video boyutlarını aşıyor");
					}

					const outputPath = tempPath.replace(".webm", "_cropped.webm");
					console.log("5. Kırpma için dosya yolları:", {
						tempPath,
						outputPath,
					});

					const result = await window.electron?.ipcRenderer.invoke(
						"CROP_VIDEO",
						{
							inputPath: tempPath,
							outputPath,
							...scaledCropArea,
						}
					);
					console.log("6. Video kırpma tamamlandı, sonuç:", result);

					// Temizlik
					URL.revokeObjectURL(video.src);
				} catch (error) {
					console.error("Video kırpma hatası:", error);
					// Hata olsa bile devam et
					console.log("7. Kırpma hatası oldu ama devam ediliyor");
				}
			}

			console.log("8. Editor sayfasına yönlendiriliyor");
			await navigateTo("/editor");
			console.log("9. Yönlendirme tamamlandı");
		} catch (error) {
			console.error("Video kaydedilirken hata oluştu:", error);
			alert("Video kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.");
		}
	};

	// Kamera değiştiğinde otomatik güncelleme
	watch(selectedVideoDevice, async (newDeviceId) => {
		if (newDeviceId) {
			try {
				// Önceki stream'i kapat
				if (currentCameraStream.value) {
					currentCameraStream.value
						.getTracks()
						.forEach((track) => track.stop());
				}

				// Yeni kamera stream'ini başlat
				const stream = await navigator.mediaDevices.getUserMedia({
					video: {
						deviceId: { exact: newDeviceId },
						width: { ideal: 1280 },
						height: { ideal: 720 },
					},
					audio: false,
				});
				currentCameraStream.value = stream;
			} catch (err) {
				console.error("Kamera stream'i başlatılamadı:", err);
				currentCameraStream.value = null;
			}
		}
	});

	return {
		videoDevices,
		audioDevices,
		selectedVideoDevice,
		selectedAudioDevice,
		mediaStream,
		isRecording,
		recordedChunks,
		currentCameraStream,
		getDevices,
		startRecording,
		stopRecording,
		saveRecording,
	};
};
