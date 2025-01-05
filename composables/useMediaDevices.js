import { ref } from "vue";
import { useRouter } from "vue-router";

export const useMediaDevices = async () => {
	const router = useRouter();
	let { state, update } = useGlobalState();

	const getDevices = async () => {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();

			let cameraDevices = devices
				.filter((device) => device.kind === "videoinput")
				.map((device) => ({
					deviceId: device.deviceId,
					label: device.label,
				}));

			let microphoneDevices = devices
				.filter((device) => device.kind === "audioinput")
				.map((device) => ({
					deviceId: device.deviceId,
					label: device.label,
				}));

			update({
				cameraDevices,
				microphoneDevices,
				selectedCameraDevice: cameraDevices[0].deviceId,
				selectedMicrophoneDevice: microphoneDevices[0].deviceId,
				mediaStream: null,
				isRecording: false,
			});
		} catch (error) {
			console.error("Cihazlar listelenirken hata oluştu:", error);
		}
	};

	const getCameraStream = async () => {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: { deviceId: state.selectedCameraDevice },
		});

		update({
			mediaStream: stream,
		});

		return stream;
	};

	const startRecording = async (streamOptions) => {
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

			// Ses yakalama (isteğe bağlı)
			let audioStream = null;
			if (state.selectedMicrophoneDevice) {
				try {
					audioStream = await navigator.mediaDevices.getUserMedia({
						audio: {
							deviceId: { exact: state.selectedMicrophoneDevice },
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
			];

			const combinedStream = new MediaStream(tracks);
			mediaStream.value = combinedStream;
			isRecording.value = true;

			return { screenStream };
		} catch (error) {
			console.error("Kayıt başlatılırken hata oluştu:", error);
			throw error;
		}
	};

	const stopRecording = () => {
		if (mediaStream.value) {
			mediaStream.value.getTracks().forEach((track) => {
				track.stop();
			});
			mediaStream.value = null;
			isRecording.value = false;
		}
	};

	const saveRecording = async (chunks, cropArea) => {
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

	return {
		getDevices,
		startRecording,
		stopRecording,
		saveRecording,
	};
};
