import { ref } from "vue";
import { useIpcState } from "./useIpcState";

interface StreamOptions {
	x?: number;
	y?: number;
	width?: number;
	height?: number;
}

interface RecordingData {
	screen: Blob[];
	camera?: Blob[];
	audio?: Blob[];
}

export interface CropArea {
	x: number;
	y: number;
	width: number;
	height: number;
}

export const useMediaDevices = () => {
	const { sendIpcMessage } = useIpcState();

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

			if (!selectedVideoDevice.value && videoDevices.value.length > 0) {
				selectedVideoDevice.value = videoDevices.value[0].deviceId;
			}
			if (!selectedAudioDevice.value && audioDevices.value.length > 0) {
				selectedAudioDevice.value = audioDevices.value[0].deviceId;
			}
		} catch (error) {
			console.error("Cihazlar listelenirken hata:", error);
		}
	};

	const startRecording = async (streamOptions: StreamOptions = {}) => {
		try {
			const screenStream = await navigator.mediaDevices.getUserMedia({
				audio: selectedAudioDevice.value
					? { deviceId: { exact: selectedAudioDevice.value } }
					: true,
				video: false,
			});

			const displayStream = await navigator.mediaDevices.getDisplayMedia({
				video: {
					...streamOptions,
					frameRate: { ideal: 30 },
				},
				audio: false,
			});

			mediaStream.value = new MediaStream([
				...displayStream.getVideoTracks(),
				...screenStream.getAudioTracks(),
			]);

			isRecording.value = true;
		} catch (error) {
			console.error("Kayıt başlatma hatası:", error);
			throw error;
		}
	};

	const stopRecording = () => {
		if (mediaStream.value) {
			mediaStream.value.getTracks().forEach((track) => track.stop());
			mediaStream.value = null;
		}
		if (currentCameraStream.value) {
			currentCameraStream.value.getTracks().forEach((track) => track.stop());
			currentCameraStream.value = null;
		}
		isRecording.value = false;
	};

	const saveTempVideo = async (data: RecordingData, cropArea?: CropArea) => {
		try {
			const screenBlob = new Blob(data.screen, { type: "video/webm" });
			const screenArrayBuffer = await screenBlob.arrayBuffer();
			const screenBase64 = Buffer.from(screenArrayBuffer).toString("base64");

			let cameraBase64 = null;
			if (data.camera && data.camera.length > 0) {
				const cameraBlob = new Blob(data.camera, { type: "video/webm" });
				const cameraArrayBuffer = await cameraBlob.arrayBuffer();
				cameraBase64 = Buffer.from(cameraArrayBuffer).toString("base64");
			}

			let audioBase64 = null;
			if (data.audio && data.audio.length > 0) {
				const audioBlob = new Blob(data.audio, { type: "video/webm" });
				const audioArrayBuffer = await audioBlob.arrayBuffer();
				audioBase64 = Buffer.from(audioArrayBuffer).toString("base64");
			}

			sendIpcMessage("SAVE_TEMP_VIDEO", {
				screen: screenBase64,
				camera: cameraBase64,
				audio: audioBase64,
				cropArea,
			});
		} catch (error) {
			console.error("Geçici video kaydedilirken hata:", error);
			throw error;
		}
	};

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
		saveTempVideo,
	};
};
