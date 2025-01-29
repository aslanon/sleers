import { ref, onMounted, onUnmounted } from "vue";

export function useScreenRecorder() {
	const isRecording = ref(false);
	const mediaRecorder = ref(null);
	const recordedChunks = ref([]);
	const recordingStartTime = ref(null);
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

			// Önceki kayıt verilerini temizle
			recordedChunks.value = [];
			processingStatus.value = {
				isProcessing: false,
				progress: 0,
				error: null,
			};

			// Ekran kaynağını seç
			const sources = await window.electron.desktopCapturer.getSources({
				types: ["screen", "window"],
			});

			if (!sources || sources.length === 0) {
				throw new Error("Ekran kaynağı bulunamadı");
			}

			// İlk kaynağı kullan (tüm ekran)
			const source = sources[0];

			// MediaStream oluştur
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: {
					mandatory: {
						chromeMediaSource: "desktop",
						chromeMediaSourceId: source.id,
						minWidth: 1280,
						maxWidth: 4096,
						minHeight: 720,
						maxHeight: 2160,
					},
				},
			});

			// MediaRecorder oluştur
			mediaRecorder.value = new MediaRecorder(stream, {
				mimeType: "video/webm;codecs=vp8,opus",
				videoBitsPerSecond: 2500000, // 2.5 Mbps
			});

			// Kayıt olaylarını dinle
			mediaRecorder.value.ondataavailable = handleDataAvailable;
			mediaRecorder.value.onstop = handleRecordingStop;
			mediaRecorder.value.onerror = handleRecordingError;

			// Kayıt başlangıç zamanını kaydet
			recordingStartTime.value = new Date().toISOString();

			// Kayıt durumunu güncelle
			isRecording.value = true;
			window.electron.recording.setRecordingStatus(true);

			// Kayıt başlat
			mediaRecorder.value.start(1000); // Her 1 saniyede bir veri al

			console.log("[useScreenRecorder] Kayıt başlatıldı");

			// Stream'i döndür
			return stream;
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

			if (mediaRecorder.value && mediaRecorder.value.state !== "inactive") {
				mediaRecorder.value.stop();
				isRecording.value = false;
				window.electron.recording.setRecordingStatus(false);

				// Stream'i kapat
				const tracks = mediaRecorder.value.stream.getTracks();
				tracks.forEach((track) => track.stop());
			}
		} catch (error) {
			console.error("[useScreenRecorder] Kayıt durdurma hatası:", error);
			handleRecordingError(error);
		}
	};

	// Veri parçası geldiğinde
	const handleDataAvailable = (event) => {
		if (event.data && event.data.size > 0) {
			recordedChunks.value.push(event.data);
		}
	};

	// Kayıt durduğunda
	const handleRecordingStop = async () => {
		try {
			console.log("[useScreenRecorder] Kayıt tamamlandı, veriler işleniyor...");

			// İşleme durumunu güncelle
			processingStatus.value = {
				isProcessing: true,
				progress: 0,
				error: null,
			};

			// Blob oluştur
			const blob = new Blob(recordedChunks.value, {
				type: "video/webm",
			});

			// Base64'e çevir
			const reader = new FileReader();
			reader.readAsDataURL(blob);

			reader.onloadend = async () => {
				try {
					const base64data = reader.result;

					// Geçici dosyaya kaydet
					const videoPath = await window.electron.fileSystem.saveTempVideo(
						base64data,
						"screen"
					);

					console.log("[useScreenRecorder] Video kaydedildi:", videoPath);

					// İşleme durumunu güncelle
					processingStatus.value = {
						isProcessing: false,
						progress: 100,
						error: null,
					};
				} catch (error) {
					console.error("[useScreenRecorder] Video kaydetme hatası:", error);
					handleRecordingError(error);
				}
			};

			reader.onerror = (error) => {
				console.error("[useScreenRecorder] Base64 dönüştürme hatası:", error);
				handleRecordingError(error);
			};
		} catch (error) {
			console.error("[useScreenRecorder] Kayıt tamamlama hatası:", error);
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

		// Stream'i kapat
		if (mediaRecorder.value && mediaRecorder.value.stream) {
			const tracks = mediaRecorder.value.stream.getTracks();
			tracks.forEach((track) => track.stop());
		}
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
		if (mediaRecorder.value && mediaRecorder.value.state !== "inactive") {
			mediaRecorder.value.stop();
		}
		if (hasElectronAPI) {
			window.electron.removeAllListeners();
		}
	};

	// Ekran kaydını kaydet
	const saveScreenRecording = async (chunks) => {
		try {
			console.log("[useScreenRecorder] Ekran kaydı kaydediliyor...");

			// Blob oluştur
			const blob = new Blob(chunks, {
				type: "video/webm",
			});

			// Base64'e çevir
			const buffer = await blob.arrayBuffer();
			const base64 = btoa(
				new Uint8Array(buffer).reduce(
					(data, byte) => data + String.fromCharCode(byte),
					""
				)
			);
			const dataUrl = `data:video/webm;base64,${base64}`;

			// Geçici dosyaya kaydet
			const videoPath = await window.electron.fileSystem.saveTempVideo(
				dataUrl,
				"screen"
			);

			console.log("[useScreenRecorder] Ekran kaydı kaydedildi:", videoPath);
			return videoPath;
		} catch (error) {
			console.error(
				"[useScreenRecorder] Ekran kaydı kaydedilirken hata:",
				error
			);
			handleRecordingError(error);
			return null;
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
		saveScreenRecording,
		hasElectronAPI,
	};
}
