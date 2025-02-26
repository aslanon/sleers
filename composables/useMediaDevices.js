import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useCamera } from "./modules/useCamera";
import { useScreen } from "./modules/useScreen";
import { useAudio } from "./modules/useAudio";
import { useMouse } from "./modules/useMouse";
import { useRecordingUtils } from "./modules/useRecordingUtils";

export const useMediaDevices = () => {
	const router = useRouter();
	const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;

	// Import modules
	const cameraModule = useCamera();
	const screenModule = useScreen();
	const audioModule = useAudio();
	const mouseModule = useMouse();
	const recordingUtils = useRecordingUtils();

	// Computed properties for combined state
	const isRecording = computed(
		() => screenModule.isScreenActive.value || cameraModule.isCameraActive.value
	);

	const getDevices = async () => {
		await Promise.all([
			cameraModule.getVideoDevices(),
			audioModule.getAudioDevices(),
		]);
	};

	const startRecording = async (options = {}) => {
		try {
			if (!IPC_EVENTS) {
				throw new Error("IPC events are not available");
			}

			// Önceki kaydı temizle
			if (isRecording.value) {
				console.log("Önceki kayıt durduruluyor");
				await stopRecording();
				// Kısa bir bekleme ekleyelim
				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			// Geri sayım başlat
			await recordingUtils.startCountdown();

			// Hangi kayıtların başlatılacağını belirle
			const startScreen = options.startScreen ?? true;
			const startCamera = options.startCamera ?? true;
			const startAudio = options.startAudio ?? true;

			if (!startScreen && !startCamera && !startAudio) {
				console.warn("Hiçbir kayıt türü seçilmedi");
				return;
			}

			document.body.classList.add("recording");

			// Seçilen kayıtları başlat
			let screenResult = null;
			let cameraResult = null;
			let audioResult = null;

			if (startScreen) {
				// Ekran kaydını başlat - her modül kendi konfigürasyonunu kullanır
				screenResult = await screenModule.startScreenRecording();
			}

			if (startCamera) {
				// Kamera kaydını başlat - her modül kendi konfigürasyonunu kullanır
				cameraResult = await cameraModule.startCameraRecording();
			}

			if (startAudio && !screenResult?.audioPath) {
				// Ses kaydını başlat - her modül kendi konfigürasyonunu kullanır
				// Ekran kaydında ses yoksa ayrı ses kaydı başlat
				audioResult = await audioModule.startAudioRecording();
			}

			// Start mouse tracking if needed
			if (startScreen) {
				mouseModule.startMouseTracking();
			}

			return {
				...screenResult,
				...cameraResult,
				...audioResult,
			};
		} catch (error) {
			console.error("Kayıt başlatılırken hata:", error);
			document.body.classList.remove("recording");
			if (window.electron?.ipcRenderer) {
				window.electron.ipcRenderer.send("STOP_MOUSE_TRACKING");
			}
			return null;
		}
	};

	const stopRecording = async () => {
		try {
			console.log("Kayıt durdurma başlatıldı");

			// Fare takibini durdur
			mouseModule.stopMouseTracking();

			// Modül durumlarını false yap
			screenModule.isScreenActive.value = false;
			cameraModule.isCameraActive.value = false;

			// Her modülün kendi durdurma fonksiyonunu çağır
			if (screenModule.isScreenActive.value) {
				await screenModule.stopScreenRecording();
			}

			if (cameraModule.isCameraActive.value) {
				await cameraModule.stopCameraRecording();
			}

			// Ayrı ses kaydı varsa durdur
			await audioModule.stopAudioRecording();

			// MediaStream'i durdur
			recordingUtils.stopMediaStream();

			// Kayıt sınıfını kaldır
			document.body.classList.remove("recording");

			console.log("Kayıt durdurma tamamlandı");

			// Kayıt tamamlandığında editor'ı aç
			try {
				window.electron?.ipcRenderer.send(IPC_EVENTS.OPEN_EDITOR, {
					videoPath: screenModule.screenPath.value,
					cameraPath: cameraModule.cameraPath.value,
					audioPath:
						screenModule.audioPath.value || audioModule.audioPath.value,
				});
			} catch (editorError) {
				console.error("Editor açılırken hata:", editorError);
			}
		} catch (error) {
			console.error("Kayıt durdurulurken hata:", error);
			// Hata olsa bile durumları temizle
			document.body.classList.remove("recording");
		}
	};

	return {
		// Camera module
		videoDevices: cameraModule.videoDevices,
		selectedVideoDevice: cameraModule.selectedVideoDevice,
		isCameraActive: cameraModule.isCameraActive,
		cameraConfig: cameraModule.config,
		updateCameraConfig: cameraModule.updateConfig,

		// Screen module
		isScreenActive: screenModule.isScreenActive,
		screenConfig: screenModule.config,
		updateScreenConfig: screenModule.updateConfig,

		// Audio module
		audioDevices: audioModule.audioDevices,
		selectedAudioDevice: audioModule.selectedAudioDevice,
		systemAudioEnabled: audioModule.systemAudioEnabled,
		microphoneEnabled: audioModule.microphoneEnabled,
		microphoneLevel: audioModule.microphoneLevel,
		currentAudioStream: audioModule.currentAudioStream,
		isAudioAnalyserActive: audioModule.isAudioAnalyserActive,
		initAudioAnalyser: audioModule.initAudioAnalyser,
		cleanupAudioAnalyser: audioModule.cleanupAudioAnalyser,
		toggleMicrophone: audioModule.toggleMicrophone,
		toggleSystemAudio: audioModule.toggleSystemAudio,
		audioConfig: audioModule.config,
		updateAudioConfig: audioModule.updateConfig,

		// Mouse module
		mousePositions: mouseModule.mousePositions,
		throttle: mouseModule.throttle,
		mouseConfig: mouseModule.config,
		updateMouseConfig: mouseModule.updateConfig,

		// Recording utils
		selectedDelay: recordingUtils.selectedDelay,
		isRecording,

		// Main functions
		getDevices,
		startRecording,
		stopRecording,
	};
};
