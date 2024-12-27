import { ref } from "vue";

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
			// Önce cihazlara erişim izni al
			const stream = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: true,
			});
			// İzin alındıktan sonra stream'i kapat
			stream.getTracks().forEach((track) => track.stop());

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

	const startRecording = async () => {
		try {
			// Ekran seçimi için kaynakları al
			// @ts-ignore
			const sources = await window.electron?.desktopCapturer?.getSources({
				types: ["window", "screen"],
				thumbnailSize: { width: 1280, height: 720 },
				fetchWindowIcons: true,
			});

			if (!sources || sources.length === 0) {
				throw new Error("Ekran kaynakları bulunamadı");
			}

			// Ekran yakalama
			const screenStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					// @ts-ignore
					mandatory: {
						chromeMediaSource: "desktop",
					},
				},
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

			// Kamera yakalama
			const cameraStream = await navigator.mediaDevices.getUserMedia({
				video: {
					deviceId: selectedVideoDevice.value
						? { exact: selectedVideoDevice.value }
						: undefined,
					width: { ideal: 1280 },
					height: { ideal: 720 },
				},
				audio: {
					deviceId: selectedAudioDevice.value
						? { exact: selectedAudioDevice.value }
						: undefined,
					echoCancellation: true,
					noiseSuppression: true,
				},
			});

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
		const blob = new Blob(chunks, {
			type: "video/mp4;codecs=h264,aac",
		});

		// Dosyayı kaydet
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		document.body.appendChild(a);
		a.style.display = "none";
		a.href = url;
		a.download = `kayit-${Date.now()}.mp4`;
		a.click();
		window.URL.revokeObjectURL(url);
		document.body.removeChild(a);
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
