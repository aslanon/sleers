/**
 * ExportService.js
 * Video export işlemlerini yöneten servis
 */

// Ayarları boyutlara çeviren yardımcı fonksiyonlar
const resolutionMap = {
	"480p": { width: 854, height: 480 },
	"720p": { width: 1280, height: 720 },
	"1080p": { width: 1920, height: 1080 },
};

const qualityMap = {
	low: { bitrate: 2500000, fps: 30 }, // 2.5 Mbps
	medium: { bitrate: 5000000, fps: 60 }, // 5 Mbps
	high: { bitrate: 8000000, fps: 60 }, // 8 Mbps
};

/**
 * Video export ayarlarını işleyerek export parametrelerini döndürür
 * @param {Object} settings - Export ayarları
 * @returns {Object} Export parametreleri
 */
const getExportParams = (settings) => {
	const { format, resolution, quality } = settings;

	const resParams = resolutionMap[resolution] || resolutionMap["720p"];
	const qualParams = qualityMap[quality] || qualityMap["medium"];

	return {
		format: format || "mp4",
		width: resParams.width,
		height: resParams.height,
		bitrate: qualParams.bitrate,
		fps: qualParams.fps,
	};
};

/**
 * Video export işlemini başlatır
 * @param {Object} mediaPlayer - MediaPlayer komponenti referansı
 * @param {Object} settings - Export ayarları
 * @param {Function} onProgress - İlerleme geri çağırma fonksiyonu (0-100 arası değer)
 * @param {Function} onComplete - Tamamlanma geri çağırma fonksiyonu
 * @param {Function} onError - Hata geri çağırma fonksiyonu
 */
const exportVideo = async (
	mediaPlayer,
	settings,
	onProgress,
	onComplete,
	onError
) => {
	try {
		// Export parametrelerini al
		const params = getExportParams(settings);

		// MediaPlayer'dan video ve ses elementlerini al
		const videoElement = mediaPlayer.getVideoElement();
		if (!videoElement) {
			throw new Error("Video element bulunamadı");
		}

		// Canvas elementini al
		const canvas = mediaPlayer.getCanvas();
		if (!canvas) {
			throw new Error("Canvas bulunamadı");
		}

		// Double buffering için iki canvas kullan
		const exportCanvas = document.createElement("canvas");
		exportCanvas.width = params.width;
		exportCanvas.height = params.height;
		const exportCtx = exportCanvas.getContext("2d", {
			alpha: false,
			antialias: true,
			desynchronized: false,
		});

		// Kalite ayarları
		exportCtx.imageSmoothingEnabled = true;
		exportCtx.imageSmoothingQuality = "high";

		// İkinci buffer için canvas
		const tempCanvas = document.createElement("canvas");
		tempCanvas.width = params.width;
		tempCanvas.height = params.height;
		const tempCtx = tempCanvas.getContext("2d", {
			alpha: false,
			antialias: true,
			desynchronized: false,
		});

		// Kalite ayarları
		tempCtx.imageSmoothingEnabled = true;
		tempCtx.imageSmoothingQuality = "high";

		// Export stream'i oluştur
		const stream = exportCanvas.captureStream(params.fps);

		// Render loop için değişkenler
		let startTime = null;
		let lastFrameTime = 0;
		const duration = videoElement.duration;
		const frameInterval = 1000 / params.fps; // İstenen FPS'e göre frame aralığı

		// Render loop'u tanımla
		const renderFrame = async (timestamp) => {
			// İlk timestamp'i kaydet
			if (!startTime) startTime = timestamp;

			// Geçen süreyi hesapla
			const elapsed = timestamp - startTime;
			const currentTime = elapsed / 1000;

			// FPS sabitlemesi için zaman kontrolü
			const timeSinceLastFrame = timestamp - lastFrameTime;

			// İlerleme durumunu güncelle
			const progress = Math.min(100, (currentTime / duration) * 100);
			onProgress(progress);

			// Video bittiyse kaydı durdur
			if (currentTime >= duration) {
				mediaRecorder.stop();
				return;
			}

			// FPS kontrolü - istenen frame rate'e göre frame'leri sınırla
			if (timeSinceLastFrame >= frameInterval) {
				lastFrameTime = timestamp;

				// Double buffering - Önce temp canvas'a çiz
				const frameData = mediaPlayer.captureFrameWithSize(
					params.width,
					params.height
				);
				if (frameData) {
					const img = new Image();
					img.onload = () => {
						// Temp canvas'a çiz
						tempCtx.clearRect(0, 0, params.width, params.height);
						tempCtx.drawImage(img, 0, 0, params.width, params.height);

						// Sonra export canvas'a aktar
						exportCtx.clearRect(0, 0, params.width, params.height);
						exportCtx.drawImage(tempCanvas, 0, 0);
					};
					img.src = frameData;
				}
			}

			// Sonraki frame için devam et
			if (currentTime < duration) {
				requestAnimationFrame(renderFrame);
			}
		};

		// Audio context için değişken
		let audioContext = null;

		// Eğer ses varsa ve MP4 formatındaysa, ses akışını ekle
		if (settings.format === "mp4") {
			try {
				// Yeni bir AudioContext oluştur
				audioContext = new AudioContext();

				// MediaElementSourceNode oluşturma işlemini try/catch ile koru
				let source;
				try {
					source = audioContext.createMediaElementSource(videoElement);
				} catch (audioError) {
					console.warn(
						"Video elementi zaten bir AudioContext'e bağlı, alternatif yöntem kullanılıyor:",
						audioError
					);

					// Bu hata oluştuğunda, ses olmadan devam etmeyi dene veya alternatif bir yaklaşım uygula
					// Burada sessiz bir işlem yapıyoruz ve kullanıcıya bilgi veriyoruz
					onProgress(5); // İlerleme göster
					console.log("Ses olmadan export işlemi devam ediyor...");

					// Devam et, ses eklemeden
					mediaRecorder.start(1000);
					requestAnimationFrame(renderFrame);
					return; // Fonksiyonun geri kalanını çalıştırmamak için erken dön
				}

				// Destination oluştur ve bağlantıları kur
				const destination = audioContext.createMediaStreamDestination();
				source.connect(destination);
				source.connect(audioContext.destination); // Sesi duymaya devam et

				// Ses akışını ekle
				destination.stream
					.getAudioTracks()
					.forEach((track) => stream.addTrack(track));
			} catch (error) {
				console.error("Ses işleme sırasında hata:", error);
				// Ses işleme hatası olsa bile export işlemine devam et
			}
		}

		// MediaRecorder oluştur - codec ayarlarını ekle
		const mediaRecorder = new MediaRecorder(stream, {
			mimeType: settings.format === "mp4" ? "video/webm" : "video/webm",
			videoBitsPerSecond: params.bitrate,
		});

		// Veri parçaları için dizi
		const chunks = [];

		// Veri geldiğinde topla
		mediaRecorder.ondataavailable = (e) => {
			if (e.data.size > 0) {
				chunks.push(e.data);
			}
		};

		// Kayıt tamamlandığında
		mediaRecorder.onstop = async () => {
			try {
				// Videoyu durdur ve başa sar
				await mediaPlayer.pause();
				await mediaPlayer.seek(0);

				// AudioContext varsa kapat
				if (audioContext) {
					try {
						// AudioContext'i kapat
						if (audioContext.state !== "closed") {
							await audioContext.close();
							console.log("AudioContext başarıyla kapatıldı");
						}
					} catch (audioCloseError) {
						console.warn("AudioContext kapatılırken hata:", audioCloseError);
					}
				}

				// Chunks'ları Blob'a dönüştür
				const mimeType =
					settings.format === "mp4" ? "video/webm" : "video/webm";
				const blob = new Blob(chunks, { type: mimeType });

				// Base64'e dönüştür (electron için)
				const arrayBuffer = await blob.arrayBuffer();
				const base64Data = btoa(
					new Uint8Array(arrayBuffer).reduce(
						(data, byte) => data + String.fromCharCode(byte),
						""
					)
				);

				// Tamamlandı bilgisini ilet
				onComplete({
					data: `data:${mimeType};base64,${base64Data}`,
					format: settings.format,
					width: params.width,
					height: params.height,
				});
			} catch (error) {
				onError(error);
			}
		};

		// Kayıt için videoya hazırla
		await mediaPlayer.seek(0);
		await mediaPlayer.play();

		// Kayıt başlat ve render loop'u çalıştır
		mediaRecorder.start(1000); // Her 1 saniyede bir data topla
		requestAnimationFrame(renderFrame);
	} catch (error) {
		onError(error);
	}
};

export default {
	exportVideo,
	getExportParams,
};
