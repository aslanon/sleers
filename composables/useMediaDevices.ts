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
						minWidth: 1280,
						maxWidth: 1920,
						minHeight: 720,
						maxHeight: 1080,
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
			mediaStream.value.getTracks().forEach((track) => track.stop());
			mediaStream.value = null;
			isRecording.value = false;
		}
	};

	const saveRecording = async (chunks: Blob[]) => {
		try {
			const blob = new Blob(chunks, { type: "video/webm" });
			const buffer = await blob.arrayBuffer();
			const base64Data = btoa(
				new Uint8Array(buffer).reduce(
					(data, byte) => data + String.fromCharCode(byte),
					""
				)
			);
			const dataUrl = `data:video/webm;base64,${base64Data}`;

			// Geçici dosyayı kaydet
			const tempPath = await window.electron?.saveTempVideo(dataUrl);
			console.log("Geçici video kaydedildi:", tempPath);

			// Editor sayfasına yönlendir
			navigateTo("/editor");
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
