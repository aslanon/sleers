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
		() =>
			screenModule.isScreenActive.value ||
			cameraModule.isCameraActive.value ||
			audioModule.isAudioActive.value
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
				await stopRecording();
				// Kısa bir bekleme ekleyelim
				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			await recordingUtils.startCountdown();
			document.body.classList.add("recording");

			// Geri sayım başlat

			// Hangi kayıtların başlatılacağını belirle
			const startScreen = options.startScreen ?? true;
			const startCamera = options.startCamera ?? true;
			const startAudio = options.startAudio ?? true;


			if (!startScreen && !startCamera && !startAudio) {
				console.warn("Hiçbir kayıt türü seçilmedi");
				return;
			}

			// Seçilen kayıtları başlat
			let screenResult = null;
			let cameraResult = null;
			let audioResult = null;

			if (startScreen) {
				// MacRecorder kullanarak ekran kaydını başlat
				screenResult = screenModule.startRecording(null, options);
				mouseModule.startMouseTracking();
			} else {
				console.warn(
					"🔧 [useMediaDevices] startScreen false olduğu için MacRecorder çağrılmıyor!"
				);
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

			// Tüm kayıtları durdur ve sonuçları bekle
			const promises = [];

			// Ekran kaydını durdur
			if (screenModule.isScreenActive.value) {
				promises.push(screenModule.stopRecording());
			}

			// Kamera kaydını durdur
			if (cameraModule.isCameraActive.value) {
				promises.push(cameraModule.stopCameraRecording());
			}

			// Ses kaydını durdur
			if (audioModule.isAudioActive.value) {
				promises.push(audioModule.stopAudioRecording());
			}

			// Tüm kayıtların durmasını bekle
			const results = await Promise.all(promises);

			// Kayıt durumunu güncelle - computed property olduğu için doğrudan güncellenemez
			// isRecording.value = false; // Bu satır kaldırıldı çünkü computed property'dir

			// Editör açılmadan önce kısa bir gecikme ekle (stream'lerin tamamen kapanması için)
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Editör penceresini aç
			const screenResult = results.find((r) => r && r.videoPath);
			const cameraResult =
				results.find((r) => r && r.cameraPath) ||
				results.find((r) => typeof r === "string");
			const audioResult = results.find((r) => r && r.audioPath);

			await window.electron?.ipcRenderer.invoke(IPC_EVENTS.OPEN_EDITOR, {
				videoPath: screenResult?.videoPath || null,
				cameraPath:
					cameraResult?.cameraPath ||
					(typeof cameraResult === "string" ? cameraResult : null),
				audioPath: audioResult?.audioPath || null,
			});

		} catch (error) {
			console.error("Kayıt durdurulurken hata:", error);
			isRecording.value = false;
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
		isAudioActive: audioModule.isAudioActive,
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
