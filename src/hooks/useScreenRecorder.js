const startScreenRecording = async () => {
	try {
		// Electron API kontrolü
		if (!window.electron?.fileSystem?.getTempVideoPath) {
			throw new Error("Geçici dosya yolu alma fonksiyonu bulunamadı");
		}

		// Geçici dosya yolu al
		const outputPath = await window.electron.fileSystem.getTempVideoPath();
		console.log("[useScreenRecorder] Geçici dosya yolu:", outputPath);

		if (!outputPath || typeof outputPath !== "string") {
			throw new Error(
				"Geçersiz geçici dosya yolu: " + (outputPath || "undefined")
			);
		}

		// Seçili alanı al
		const selectedArea = await window.electron.recording.getCropInfo();
		console.log("[useScreenRecorder] Seçili alan:", selectedArea);

		if (!selectedArea) {
			throw new Error(
				'Lütfen "Alan Seç" butonunu kullanarak kayıt alanını seçin.'
			);
		}

		if (selectedArea.width <= 0 || selectedArea.height <= 0) {
			throw new Error(
				"Geçersiz kayıt alanı boyutları. Lütfen tekrar alan seçin."
			);
		}

		setIsRecording(true);
		setRecordingStatus("recording");

		// Native modüle tüm gerekli parametreleri gönder
		console.log("[useScreenRecorder] Kayıt parametreleri:", {
			outputPath,
			...selectedArea,
		});

		const success = await window.electron.screenRecorder.startRecording(
			outputPath,
			selectedArea.x,
			selectedArea.y,
			selectedArea.width,
			selectedArea.height
		);

		if (!success) {
			throw new Error("Ekran kaydı başlatılamadı. Lütfen tekrar deneyin.");
		}

		console.log("[useScreenRecorder] Kayıt başlatıldı");
		setRecordingStartTime(Date.now());
	} catch (error) {
		console.error("[useScreenRecorder] Kayıt başlatma hatası:", error);
		setIsRecording(false);
		setRecordingStatus("error");
		setError(error.message);
	}
};

const stopScreenRecording = async () => {
	try {
		setIsRecording(false);
		setRecordingStatus("processing");

		const videoPath = await window.electron.recording.stopRecording();

		if (!videoPath) {
			throw new Error("Kayıt sonlandırılamadı. Lütfen tekrar deneyin.");
		}

		setRecordingStatus("completed");
		setLastRecordedVideo(videoPath);
		console.log("Video kaydedildi:", videoPath);
	} catch (error) {
		console.error("Kayıt durdurma hatası:", error);
		setRecordingStatus("error");
		setError(error.message);
	}
};
