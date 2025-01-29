import { ref, onMounted, onUnmounted } from "vue";

export function useScreenRecorder() {
	const isRecording = ref(false);
	const processingStatus = ref({
		isProcessing: false,
		progress: 0,
		error: null,
	});

	// Electron API kontrolü
	const hasElectronAPI = typeof window !== "undefined" && window.electron;

	// Kayıt başlatma
	const startScreenRecording = async (options = {}) => {
		if (!hasElectronAPI) {
			console.error("[useScreenRecorder] Electron API bulunamadı");
			handleRecordingError(new Error("Electron API bulunamadı"));
			return null;
		}

		try {
			console.log("[useScreenRecorder] Kayıt başlatılıyor...");

			// İşlem durumunu sıfırla
			processingStatus.value = {
				isProcessing: false,
				progress: 0,
				error: null,
			};

			// Geçici dosya yolu al
			const outputPath = await window.electron.fileSystem.getTempVideoPath();
			if (!outputPath) {
				throw new Error("Geçici dosya yolu oluşturulamadı");
			}

			// Native kayıt başlat
			const success = await window.electron.screenRecorder.startRecording(
				outputPath,
				0,
				1440,
				1440,
				900
			);

			if (!success) {
				throw new Error("Kayıt başlatılamadı");
			}

			// Kayıt durumunu güncelle
			isRecording.value = true;
			window.electron.recording.setRecordingStatus(true);

			console.log("[useScreenRecorder] Kayıt başlatıldı");
			return true;
		} catch (error) {
			console.error("[useScreenRecorder] Kayıt başlatma hatası:", error);
			handleRecordingError(error);
			return null;
		}
	};

	// Kayıt durdurma
	const stopScreenRecording = async () => {
		try {
			console.log("[useScreenRecorder] Kayıt durduruluyor...");

			if (isRecording.value) {
				const success = await window.electron.screenRecorder.stopRecording();
				if (!success) {
					throw new Error("Kayıt durdurulamadı");
				}

				isRecording.value = false;
				window.electron.recording.setRecordingStatus(false);

				// Kayıt yolunu al
				const videoPath = await window.electron.fileSystem.getTempVideoPath();
				console.log("[useScreenRecorder] Video kaydedildi:", videoPath);

				return videoPath;
			}
		} catch (error) {
			console.error("[useScreenRecorder] Kayıt durdurma hatası:", error);
			handleRecordingError(error);
		}
	};

	// Kayıt hatası
	const handleRecordingError = (error) => {
		console.error("[useScreenRecorder] Kayıt hatası:", error);

		// Kayıt durumunu güncelle
		isRecording.value = false;
		if (hasElectronAPI) {
			window.electron.recording.setRecordingStatus(false);
		}

		// İşleme durumunu güncelle
		processingStatus.value = {
			isProcessing: false,
			progress: 0,
			error: error.message || "Kayıt sırasında bir hata oluştu",
		};
	};

	// Hata dinleyicisi
	const setupErrorListener = () => {
		if (!hasElectronAPI) {
			console.error(
				"[useScreenRecorder] Electron API bulunamadı - Hata dinleyicisi kurulamadı"
			);
			return;
		}

		window.electron.recording.onRecordingError((error) => {
			console.error("[useScreenRecorder] IPC kayıt hatası:", error);
			handleRecordingError(new Error(error));
		});
	};

	// Temizlik
	const cleanup = () => {
		if (isRecording.value) {
			stopScreenRecording();
		}
		if (hasElectronAPI) {
			window.electron.removeAllListeners();
		}
	};

	onMounted(() => {
		if (hasElectronAPI) {
			setupErrorListener();
		} else {
			console.warn(
				"[useScreenRecorder] Electron API bulunamadı - Bileşen yüklenirken"
			);
		}
	});

	onUnmounted(() => {
		cleanup();
	});

	return {
		isRecording,
		processingStatus,
		startScreenRecording,
		stopScreenRecording,
		hasElectronAPI,
	};
}
