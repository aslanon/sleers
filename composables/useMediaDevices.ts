import { ref } from "vue";
import { navigateTo } from "#app";

export const useMediaDevices = () => {
	const videoDevices = ref<MediaDeviceInfo[]>([]);
	const audioDevices = ref<MediaDeviceInfo[]>([]);
	const selectedVideoDevice = ref<string>("");
	const selectedAudioDevice = ref<string>("");
	const mediaStream = ref<MediaStream | null>(null);
	const isRecording = ref(false);
	const recordedChunks = ref<Blob[]>([]);

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
			const sources = await window.electron?.desktopCapturer?.getSources({
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

	const saveRecording = (chunks: Blob[]) => {
		if (chunks.length === 0) {
			console.error("Kaydedilecek veri bulunamadı");
			return;
		}

		const blob = new Blob(chunks, {
			type: "video/webm",
		});

		// Dosyayı indir
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		document.body.appendChild(a);
		a.style.display = "none";
		a.href = url;
		a.download = `kayit-${Date.now()}.webm`;
		a.click();

		// URL'i temizle
		setTimeout(() => {
			URL.revokeObjectURL(url);
			document.body.removeChild(a);
		}, 100);
	};

	return {
		videoDevices,
		audioDevices,
		selectedVideoDevice,
		selectedAudioDevice,
		mediaStream,
		isRecording,
		recordedChunks,
		getDevices,
		startRecording,
		stopRecording,
		saveRecording,
	};
};
