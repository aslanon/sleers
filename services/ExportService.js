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
	console.log(`[ExportService] exportVideo fonksiyonu çağrıldı`, { settings, mediaPlayer: !!mediaPlayer });
	
	try {
		// Export parametrelerini al
		const params = getExportParams(settings);
		console.log(`[ExportService] Export parametreleri:`, params);

		// MediaPlayer'dan video ve ses elementlerini al
		const videoElement = mediaPlayer.getVideoElement();
		console.log(`[ExportService] Video element:`, !!videoElement);
		if (!videoElement) {
			throw new Error("Video element bulunamadı");
		}

		// Canvas elementini al
		const canvas = mediaPlayer.getCanvas();
		console.log(`[ExportService] Canvas element:`, !!canvas);
		if (!canvas) {
			throw new Error("Canvas bulunamadı");
		}

		// Orijinal canvas boyutlarını kullan - siyah çerçeve olmadan
		const originalWidth = canvas.width;
		const originalHeight = canvas.height;
		console.log(`[ExportService] Original canvas size:`, originalWidth, 'x', originalHeight);

		// Double buffering için iki canvas kullan - orijinal boyutlarda
		const exportCanvas = document.createElement("canvas");
		exportCanvas.width = originalWidth;
		exportCanvas.height = originalHeight;
		const exportCtx = exportCanvas.getContext("2d", {
			alpha: true, // Camera transparency için
			antialias: true,
			desynchronized: false,
		});

		// Kalite ayarları
		exportCtx.imageSmoothingEnabled = true;
		exportCtx.imageSmoothingQuality = "high";

		// Temp canvas artık gerekli değil - direkt rendering kullanacağız

		// Export stream'i oluştur
		const stream = exportCanvas.captureStream(params.fps);

		// Audio context için değişken
		let audioContext = null;

		// Render performansını iyileştirmek için optimizasyonlar
		const optimizedRender = {
			lastTimestamp: 0,
			rafId: null,
			frameThreshold: 1000 / params.fps, // Tam FPS'e göre render
			useHighPerformanceMode: true,
		};

		// Render loop için değişkenler
		let startTime = null;
		let lastFrameTime = 0;
		let lastProgressTime = Date.now();
		
		// Segment sistemi için clipped duration kullan
		const duration = mediaPlayer.getClippedDuration ? mediaPlayer.getClippedDuration() : videoElement.duration;
		const frameInterval = 1000 / params.fps; // İstenen FPS'e göre frame aralığı
		
		console.log(`[ExportService] Export başlatılıyor - duration: ${duration}, clipped: ${mediaPlayer.getClippedDuration ? true : false}`);
		
		// Segment bilgilerini logla
		if (mediaPlayer.getSegments) {
			const segments = mediaPlayer.getSegments();
			console.log(`[ExportService] Segments:`, segments.map(s => `${s.start}-${s.end}`));
		}

		// MediaRecorder değişkenini önceden tanımla
		let mediaRecorder;

		// Render loop'u tanımla
		const renderFrame = async (timestamp) => {
			// İlk timestamp'i kaydet
			if (!startTime) startTime = timestamp;

			try {
				// Geçen süreyi hesapla (clipped time)
				const elapsed = timestamp - startTime;
				const currentClippedTime = elapsed / 1000;
				
				// Clipped time'ı real time'a çevir
				const currentRealTime = mediaPlayer.convertClippedToRealTime 
					? mediaPlayer.convertClippedToRealTime(currentClippedTime)
					: currentClippedTime;
				
				console.log(`[ExportService] Frame ${Math.floor(currentClippedTime * 30)} - clippedTime: ${currentClippedTime.toFixed(3)}, realTime: ${currentRealTime.toFixed(3)}, duration: ${duration.toFixed(3)}`);

				// Export timeout kontrolü (10 saniye)
				if (Date.now() - lastProgressTime > 10000) {
					console.error('[ExportService] Export appears stuck, stopping...');
					onError(new Error('Export process timed out'));
					return;
				}

				// FPS sabitlemesi için zaman kontrolü
				const timeSinceLastFrame = timestamp - lastFrameTime;
				const timeSinceLastRender = timestamp - optimizedRender.lastTimestamp;

				// İlerleme durumunu güncelle - sadece her 30 frame'de bir
				if (Math.floor(currentClippedTime * 30) % 5 === 0) {
					lastProgressTime = Date.now();
					const progress = Math.min(95, (currentClippedTime / duration) * 100);
					onProgress(progress);
				}

				// Video bittiyse kaydı durdur
				if (currentClippedTime >= duration) {
					if (mediaRecorder && mediaRecorder.state === 'recording') {
						console.log('[ExportService] Export completed, stopping MediaRecorder');
						mediaRecorder.stop();
					}
					return;
				}

				// Video pozisyonunu real time'a göre ayarla
				if (mediaPlayer.seek) {
					// MediaPlayer'ın seek fonksiyonunu kullan (segment sistemine uygun)
					await mediaPlayer.seek(currentClippedTime);
				} else {
					// Fallback - direkt video element'i kullan
					videoElement.currentTime = currentRealTime;
				}
				
				// Export sırasında fare pozisyonunu her frame'de güncelle - export için özel fonksiyon
				// Bu ekleme fare hareketlerini her frame'de direkt günceller
				if (mediaPlayer.handleMousePositionForExport) {
					mediaPlayer.handleMousePositionForExport(currentRealTime);
				}

				// FPS kontrolü - daha hassas timing
				if (timeSinceLastFrame >= frameInterval) {
					lastFrameTime = timestamp;

					// Optimize edilmiş direct canvas rendering - Base64 dönüşümünü bypass et
					try {
						// Canvas'ı direkt kopyala - Base64 dönüşümü yok
						const sourceCanvas = mediaPlayer.getCanvas();
						if (sourceCanvas) {
							// Direkt canvas-to-canvas copy - çok daha hızlı
							exportCtx.clearRect(0, 0, originalWidth, originalHeight);
							exportCtx.drawImage(sourceCanvas, 0, 0, originalWidth, originalHeight);
						}
					} catch (renderError) {
						console.warn("Frame render edilirken hata:", renderError);
					}
				}

				// Sonraki frame için devam et - requestAnimationFrame'in yüksek öncelikli olmasını sağla
				if (currentClippedTime < duration) {
					optimizedRender.rafId = requestAnimationFrame(renderFrame);
				}
			} catch (error) {
				console.error('[ExportService] Render frame error:', error);
				onError(error);
				return;
			}
		};

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

					// Devam et, ses eklemeden - MediaRecorder'ı daha sonra başlatacağız
					console.log("Ses olmadan export işlemi devam ediyor...");
					// MediaRecorder'ı daha sonra başlatacağız, burada return yapma
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

		// MediaRecorder oluştur - basit ve güvenilir ayarlar
		mediaRecorder = new MediaRecorder(stream, {
			videoBitsPerSecond: params.bitrate,
		});
		
		console.log(`[ExportService] MediaRecorder oluşturuldu - state: ${mediaRecorder.state}`);

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

				// Animasyon döngüsünü temizle
				if (optimizedRender.rafId) {
					cancelAnimationFrame(optimizedRender.rafId);
					optimizedRender.rafId = null;
				}

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

				// İşlem sona erdiğinde %100 ilerleme göster
				onProgress(100);

				// Tamamlandı bilgisini ilet
				onComplete({
					data: `data:${mimeType};base64,${base64Data}`,
					format: settings.format,
					width: params.width,
					height: params.height,
				});

				// Geçici kaynakları temizle
				exportCanvas.width = 1;
				exportCanvas.height = 1;
			} catch (error) {
				onError(error);
			}
		};

		// Kayıt için videoya hazırla
		await mediaPlayer.seek(0);
		await mediaPlayer.play();

		// Kayıt başlat ve render loop'u çalıştır
		console.log(`[ExportService] MediaRecorder başlatılıyor - state: ${mediaRecorder.state}`);
		mediaRecorder.start(1000); // Her 1 saniyede bir data topla
		console.log(`[ExportService] MediaRecorder başlatıldı - state: ${mediaRecorder.state}`);
		console.log(`[ExportService] RenderFrame çağrılıyor...`);
		requestAnimationFrame(renderFrame);
	} catch (error) {
		onError(error);
	}
};

export default {
	exportVideo,
	getExportParams,
};
