import { ref, watch } from "vue";
import { useRouter } from "vue-router";

export const useMediaDevices = () => {
	const router = useRouter();
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

			console.log("Ekran kaynakları:", sources);

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
		chunks: { screen: Blob[]; camera: Blob[]; audio: Blob[] },
		cropArea?: { x: number; y: number; width: number; height: number }
	) => {
		try {
			console.log("1. Kayıtlar kaydediliyor...", {
				hasScreen: chunks.screen.length > 0,
				hasCamera: chunks.camera.length > 0,
				hasAudio: chunks.audio.length > 0,
				cropArea,
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
					cropArea: cropArea
						? encodeURIComponent(JSON.stringify(cropArea))
						: undefined,
				},
			});
		} catch (error) {
			console.error("Kayıtlar kaydedilirken hata:", error);
			alert("Kayıtlar kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.");
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
