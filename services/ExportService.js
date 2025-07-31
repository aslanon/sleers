/**
 * ExportService.js
 * Video export işlemlerini yöneten servis
 */

// Resolution mapping - artık aspect ratio-aware
const resolutionMap = {
	"small": { scale: 0.5, maxWidth: 960, maxHeight: 540 },
	"medium": { scale: 0.75, maxWidth: 1280, maxHeight: 720 },
	"large": { scale: 1.0, maxWidth: 1920, maxHeight: 1080 },
	"1080p": { scale: 1.0, maxWidth: 1920, maxHeight: 1080 },
	"4k": { scale: 1.0, maxWidth: 3840, maxHeight: 2160 },
};

const qualityMap = {
	low: { bitrate: 2500000 }, // 2.5 Mbps
	medium: { bitrate: 5000000 }, // 5 Mbps
	high: { bitrate: 8000000 }, // 8 Mbps
};

/**
 * Video export ayarlarını işleyerek export parametrelerini döndürür
 * @param {Object} settings - Export ayarları
 * @returns {Object} Export parametreleri
 */
const getExportParams = (settings) => {
	const { format, resolution, quality, fps } = settings;

	const resParams = resolutionMap[resolution] || resolutionMap["medium"];
	const qualParams = qualityMap[quality] || qualityMap["medium"];

	return {
		format: format || "mp4",
		scale: resParams.scale,
		maxWidth: resParams.maxWidth,
		maxHeight: resParams.maxHeight,
		bitrate: qualParams.bitrate,
		fps: fps || 30, // Use custom FPS or default to 30
	};
};

/**
 * Video export işlemini başlatır - FFmpeg tabanlı
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
	console.log(`[ExportService] exportVideo fonksiyonu çağrıldı`, {
		settings,
		mediaPlayer: !!mediaPlayer,
	});

	try {
		// Export durumunu işaretle (GIF animasyonu için)
		window.isExporting = true;
		
		// Export parametrelerini al
		const params = getExportParams(settings);
		console.log(`[ExportService] Export parametreleri:`, params);

		// MediaPlayer'dan video elementini al (opsiyonel - canvas-only export için gerekli değil)
		const videoElement = mediaPlayer.getVideoElement();
		console.log(`[ExportService] Video element:`, !!videoElement);
		
		// Canvas-only export kontrolü
		const hasVideoElement = !!videoElement;
		if (!hasVideoElement) {
			console.log("[ExportService] Canvas-only export mode (no video element)");
		}

		// Canvas elementini al
		const canvas = mediaPlayer.getCanvas();
		console.log(`[ExportService] Canvas element:`, !!canvas);
		if (!canvas) {
			throw new Error("Canvas bulunamadı");
		}

		// Canvas'ın görsel boyutlarını al (MediaPlayer'ın scale'i uygulanmış)
		let displayWidth, displayHeight;
		
		// MediaPlayer'dan görsel boyutları al
		if (mediaPlayer.getCanvasSize) {
			const canvasSize = mediaPlayer.getCanvasSize();
			displayWidth = canvasSize.width;
			displayHeight = canvasSize.height;
			console.log(`[ExportService] Canvas visual size from MediaPlayer: ${displayWidth}x${displayHeight}`);
		} else {
			// Fallback: CSS boyutları
			displayWidth = canvas.offsetWidth || canvas.clientWidth || canvas.width;
			displayHeight = canvas.offsetHeight || canvas.clientHeight || canvas.height;
			console.log(`[ExportService] Canvas visual size fallback: ${displayWidth}x${displayHeight}`);
		}
		
		// Canvas'ın gerçek pixel boyutları (debug için)
		const canvasPixelWidth = canvas.width;
		const canvasPixelHeight = canvas.height;
		console.log(`[ExportService] Canvas pixel size: ${canvasPixelWidth}x${canvasPixelHeight}`);
		
		// Seçili aspect ratio'yu MediaPlayer'dan al
		let targetAspectRatio = null;
		let aspectRatioInfo = null;
		if (mediaPlayer.getCropData) {
			const cropData = mediaPlayer.getCropData();
			if (cropData && cropData.aspectRatio && cropData.aspectRatio !== "") {
				aspectRatioInfo = cropData.aspectRatio;
				console.log(`[ExportService] Selected aspect ratio: ${aspectRatioInfo}`);
				
				// Aspect ratio string'ini parse et (örn: "16:9" -> 16/9)
				if (aspectRatioInfo !== "auto" && aspectRatioInfo.includes(":")) {
					const [w, h] = aspectRatioInfo.split(":").map(Number);
					if (w && h) {
						targetAspectRatio = w / h;
						console.log(`[ExportService] Target aspect ratio calculated: ${targetAspectRatio.toFixed(3)} (${w}:${h})`);
					}
				}
			}
		}
		
		// Zoom state'ini MediaPlayer'dan al
		let zoomSettings = null;
		if (mediaPlayer.getZoomSettings) {
			zoomSettings = mediaPlayer.getZoomSettings();
			console.log(`[ExportService] Zoom settings:`, zoomSettings);
		}
		
		// Görsel boyutları kullan - kullanıcının gördüğü boyut
		const originalWidth = displayWidth;
		const originalHeight = displayHeight;
		const originalAspectRatio = originalWidth / originalHeight;
		
		// Export aspect ratio'yu belirle
		const exportAspectRatio = targetAspectRatio || originalAspectRatio;
		console.log(`[ExportService] Using aspect ratio: ${exportAspectRatio.toFixed(3)} ${targetAspectRatio ? `(from selection: ${aspectRatioInfo})` : '(from canvas)'}`);
		
		// Resolution settings'den scale ve max limits al
		const scale = params.scale;
		const maxWidth = params.maxWidth;
		const maxHeight = params.maxHeight;
		
		// Export boyutlarını hedef aspect ratio'ya göre hesapla
		let exportWidth, exportHeight;
		
		// Base boyutları belirle - en büyük boyutu scale ile çarp
		const maxDimension = Math.max(originalWidth, originalHeight);
		const scaledMaxDimension = Math.round(maxDimension * scale);
		
		// Aspect ratio'ya göre boyutları hesapla
		if (exportAspectRatio >= 1) {
			// Landscape veya kare
			exportWidth = scaledMaxDimension;
			exportHeight = Math.round(scaledMaxDimension / exportAspectRatio);
		} else {
			// Portrait
			exportHeight = scaledMaxDimension;
			exportWidth = Math.round(scaledMaxDimension * exportAspectRatio);
		}
		
		// Minimum boyutları garanti et
		const minWidth = 320;
		const minHeight = 180;
		
		if (exportWidth < minWidth) {
			exportWidth = minWidth;
			exportHeight = Math.round(minWidth / exportAspectRatio);
		}
		
		if (exportHeight < minHeight) {
			exportHeight = minHeight;
			exportWidth = Math.round(minHeight * exportAspectRatio);
		}
		
		// Maximum boyutları aspect ratio koruyarak sınırla
		if (exportWidth > maxWidth) {
			exportWidth = maxWidth;
			exportHeight = Math.round(maxWidth / exportAspectRatio);
		}
		
		if (exportHeight > maxHeight) {
			exportHeight = maxHeight;
			exportWidth = Math.round(maxHeight * exportAspectRatio);
		}
		
		console.log(
			`[ExportService] Canvas: ${originalWidth}x${originalHeight} (ratio: ${originalAspectRatio.toFixed(2)}) -> Export: ${exportWidth}x${exportHeight} (ratio: ${(exportWidth/exportHeight).toFixed(2)}) [${settings.quality} quality, ${scale}x scale, aspect: ${aspectRatioInfo || 'auto'}]`
		);

		// Export canvas'ını corrected boyutunda oluştur - editor ile aynı ayarlar
		const exportCanvas = document.createElement("canvas");
		exportCanvas.width = exportWidth;
		exportCanvas.height = exportHeight;
		const exportCtx = exportCanvas.getContext("2d", {
			alpha: true, // Editor gibi transparency açık - camera için gerekli
			antialias: true, // Editor gibi antialiasing açık - kalite için
			desynchronized: false, // Sync rendering - editor gibi
			willReadFrequently: true, // Frequent reading optimization
		});

		// Editor ile aynı kalite ayarları
		exportCtx.imageSmoothingEnabled = true;
		exportCtx.imageSmoothingQuality = "high"; // Editor ile aynı high quality

		// Temp canvas artık gerekli değil - direkt rendering kullanacağız

		// FFmpeg tabanlı export için frame collection
		const frames = [];
		let audioData = null;

		// Export için gerekli değişkenler

		// Export duration hesaplama - daha basit ve doğru
		let duration = 0;
		
		if (hasVideoElement) {
			// Video varsa önce canvas duration'ını dene (segment-based)
			const canvasDuration = mediaPlayer.getTotalCanvasDuration ? mediaPlayer.getTotalCanvasDuration() : 0;
			const clippedDuration = mediaPlayer.getClippedDuration ? mediaPlayer.getClippedDuration() : 0;
			
			duration = canvasDuration > 0 ? canvasDuration : clippedDuration;
			if (duration === 0) {
				duration = videoElement.duration || 0;
			}
			
			console.log(`[ExportService] Video durations - Canvas: ${canvasDuration}, Clipped: ${clippedDuration}, Video: ${videoElement.duration}, Final: ${duration}`);
		} else {
			// Video yoksa GIF'lerin max duration'ını kullan
			duration = mediaPlayer.getTotalCanvasDuration ? mediaPlayer.getTotalCanvasDuration() : 0;
			if (duration === 0) {
				duration = 5; // Minimum 5 saniye
			}
			console.log(`[ExportService] Canvas-only duration: ${duration}`);
		}
		
		console.log(`[ExportService] Export duration: ${duration} seconds, hasVideo: ${hasVideoElement}`);
		
		// Audio değişkenlerini başta tanımla - scope problemi için
		let audioSourcePath = null;
		let audioTrimInfo = null;
		
		// Duration kontrolü
		if (duration <= 0) {
			console.error("[ExportService] Invalid duration:", duration);
			window.isExporting = false;
			onError(new Error(`Invalid export duration: ${duration} seconds`));
			return;
		}
		
		// Frame timing - optimize edilmiş
		const frameInterval = 1000 / params.fps;
		let frameCount = 0;
		const totalFrames = Math.max(1, Math.ceil(duration * params.fps));
		
		// Batch processing için buffer
		const BATCH_SIZE = 5; // 5 frame'i birden işle
		let batchBuffer = [];
		
		console.log(`[ExportService] FPS: ${params.fps}, Total frames: ${totalFrames}, Batch size: ${BATCH_SIZE}`);

		console.log(`[ExportService] Export başlatılıyor - Duration: ${duration}s, Frames: ${totalFrames}`);

		// Segment bilgilerini logla
		if (hasVideoElement && mediaPlayer.getSegments) {
			const segments = mediaPlayer.getSegments();
			console.log(`[ExportService] Video segments:`, segments.map((s) => `${s.start}-${s.end}`));
		}

		// MediaRecorder değişkenini önceden tanımla
		let mediaRecorder;

		// Export işlemi başlatılıyor
		
		// Basit ve etkili render loop
		const renderFrame = async () => {
			try {
				// Cancel kontrolü
				if (window.exportCancelled) {
					console.log("[ExportService] Export cancelled by user");
					window.isExporting = false;
					window.exportCancelled = false;
					onError(new Error("Export cancelled"));
					return;
				}
				
				const currentTime = (frameCount / params.fps);

				// İlerleme güncelle (sadece batch completion'da)
				if (frameCount % BATCH_SIZE === 0) {
					const progress = Math.min(95, (currentTime / duration) * 100);
					onProgress(progress);
					
					// Log'u daha da seyrek tut
					if (frameCount % (BATCH_SIZE * 10) === 0) {
						console.log(`[ExportService] Batch ${Math.floor(frameCount/BATCH_SIZE)} - Frame ${frameCount}/${totalFrames} (${progress.toFixed(1)}%)`);
					}
				}

				// Video pozisyonunu ayarla - hassas timing için
				if (hasVideoElement && mediaPlayer.seek) {
					// Seek'i sadece gerekli olduğunda yap ama daha hassas
					const videoElement = mediaPlayer.getVideoElement();
					if (videoElement && Math.abs(videoElement.currentTime - currentTime) > 0.02) {
						await mediaPlayer.seek(currentTime);
						
						// Video seek'ten sonra frame'in hazır olmasını bekle
						await new Promise(resolve => setTimeout(resolve, 5));
					}
				}

				// Canvas'ı güncelle - editördeki gibi rendering
				if (mediaPlayer.updateCanvas) {
					// Export mode flag'ini set et
					window.isExporting = true;
					window.exportTime = currentTime;
					
					// Video durumunu güncelle - editördeki gibi
					if (hasVideoElement) {
						// Video'nun currentTime'ını manuel set et
						const videoElement = mediaPlayer.getVideoElement();
						if (videoElement && Math.abs(videoElement.currentTime - currentTime) > 0.01) {
							videoElement.currentTime = currentTime;
						}
						
						// Camera play durumu kontrolü - setExportTime fonksiyonu sync'i hallediyor
						const cameraElement = mediaPlayer.getCameraElement();
						if (cameraElement && cameraElement.paused) {
							try {
								await cameraElement.play();
							} catch (error) {
								console.warn("[ExportService] Camera play error during export:", error);
							}
						}
					}
					
					// Zoom state'ini export için geçici olarak zorla aktif et
					if (zoomSettings && zoomSettings.zoomRanges && zoomSettings.zoomRanges.length > 0) {
						// Export time için zoom range kontrolü yap
						for (const zoomRange of zoomSettings.zoomRanges) {
							if (currentTime >= zoomRange.startTime && currentTime <= zoomRange.endTime) {
								// Bu zoom range aktif olmalı - MediaPlayer'a söyle
								if (mediaPlayer.setCurrentZoomRange) {
									mediaPlayer.setCurrentZoomRange(zoomRange);
								}
								console.log(`[ExportService] Applied zoom range for time ${currentTime}:`, zoomRange);
								break;
							}
						}
					}
					
					// Export mode için ek state kontrolleri
					if (frameCount === 0) {
						console.log(`[ExportService] Initial MediaPlayer state check:`, {
							hasUpdateCanvas: typeof mediaPlayer.updateCanvas === 'function',
							hasGetCanvas: typeof mediaPlayer.getCanvas === 'function',
							hasSeek: typeof mediaPlayer.seek === 'function',
							hasZoomSettings: typeof mediaPlayer.getZoomSettings === 'function',
							hasSetExportTime: typeof mediaPlayer.setExportTime === 'function',
							windowIsExporting: window.isExporting,
							windowExportTime: window.exportTime,
							hasMousePositions: mediaPlayer.mousePositions && mediaPlayer.mousePositions.length > 0
						});
					}
					
					// Export time'ı global olarak set et - cursor ve camera tracking için
					window.exportCurrentTime = currentTime;
					window.forceExportTime = true; // MediaPlayer'a export mode olduğunu söyle
					
					// MediaPlayer'ın setExportTime fonksiyonunu kullan (daha hassas sync)
					if (mediaPlayer.setExportTime && typeof mediaPlayer.setExportTime === 'function') {
						mediaPlayer.setExportTime(currentTime);
					}
					
					// Camera sync debug - her 30 frame'de bir logla
					if (frameCount % 30 === 0) {
						const videoElement = mediaPlayer.getVideoElement();
						const cameraElement = mediaPlayer.getCameraElement();
						const actualVideoTime = videoElement ? videoElement.currentTime : 0;
						const actualCameraTime = cameraElement ? cameraElement.currentTime : 0;
						console.log(`[ExportService] Enhanced time sync debug:`, {
							exportTime: currentTime.toFixed(3),
							videoElementTime: actualVideoTime.toFixed(3),
							cameraElementTime: actualCameraTime.toFixed(3),
							windowExportTime: window.exportTime ? window.exportTime.toFixed(3) : 'undefined',
							windowExportCurrentTime: window.exportCurrentTime ? window.exportCurrentTime.toFixed(3) : 'undefined',
							forceExportTime: window.forceExportTime,
							videoTimeDiff: Math.abs(actualVideoTime - currentTime).toFixed(3),
							cameraTimeDiff: cameraElement ? Math.abs(actualCameraTime - currentTime).toFixed(3) : 'N/A'
						});
					}
					
					// Canvas render - optimize edilmiş
					mediaPlayer.updateCanvas(performance.now());
					
					// Wait'i kaldır - render sync işlem
				}

				// Canvas'tan frame'i capture et - optimize edilmiş
				const sourceCanvas = mediaPlayer.getCanvas();
				if (sourceCanvas) {
					// Debug: Canvas state'ini logla
					if (frameCount % 30 === 0) {
						console.log(`[ExportService] Frame ${frameCount} debug:`, {
							canvasSize: `${sourceCanvas.width}x${sourceCanvas.height}`,
							exportSize: `${exportWidth}x${exportHeight}`,
							currentTime: currentTime.toFixed(2),
							hasZoom: !!(zoomSettings && zoomSettings.zoomRanges && zoomSettings.zoomRanges.length > 0)
						});
						
						// Canvas content debug - canvas'ın boş olup olmadığını kontrol et
						const testCtx = sourceCanvas.getContext('2d');
						const imageData = testCtx.getImageData(0, 0, Math.min(100, sourceCanvas.width), Math.min(100, sourceCanvas.height));
						const hasContent = imageData.data.some(pixel => pixel !== 0);
						console.log(`[ExportService] Canvas has content:`, hasContent);
					}
					
					exportCtx.clearRect(0, 0, exportWidth, exportHeight);
					
					// Canvas'ı export boyutunda kopyala - scaling ile
					exportCtx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, exportWidth, exportHeight);
					
					// Frame'i JPEG olarak kaydet (daha hızlı + küçük boyut)
					const frameData = exportCanvas.toDataURL('image/jpeg', 0.85); // Quality biraz düşür = daha hızlı
					frames.push(frameData);
					
					// Memory management - her 50 frame'de bir garbage collection tetikle
					if (frameCount % 50 === 0 && window.gc) {
						window.gc();
					}
				}

				frameCount++;
				
				// Completion kontrolü
				
				if (frameCount >= totalFrames) {
					// Tüm kareler tamamlandı - FFmpeg export başlat
					console.log("[ExportService] All frames captured, starting FFmpeg export");
					await completeFrameCollection();
					return;
				}
				
				// Sonraki frame - immediate scheduling for maximum performance
				setTimeout(renderFrame, 0);
				
			} catch (error) {
				console.error("[ExportService] Render frame error:", error);
				window.isExporting = false;
				onError(error);
			}
		};

		// Audio handling - TempFileManager'dan audio dosyasını al
		if (settings.format === "mp4") {
			try {
				// TempFileManager'dan audio dosyasını al
				if (typeof window.electron?.ipcRenderer?.invoke === 'function') {
					const tempAudioPath = await window.electron.ipcRenderer.invoke("GET_TEMP_AUDIO_PATH");
					
					if (tempAudioPath && tempAudioPath !== null) {
						audioSourcePath = tempAudioPath;
						console.log("[ExportService] ✅ Using temp audio file:", audioSourcePath);
						console.log("[ExportService] 🔍 Audio file exists check...");
						
						// Video segmentlerini al - audio'yu trim etmek için
						if (hasVideoElement && mediaPlayer.getSegments) {
							const segments = mediaPlayer.getSegments();
							console.log("[ExportService] 🔍 Video segments found:", segments);
							
							if (segments && segments.length > 0) {
								// İlk ve son segment'i kullanarak trim zamanlarını hesapla
								const firstSegment = segments[0];
								const lastSegment = segments[segments.length - 1];
								
								console.log("[ExportService] 🔍 First segment:", firstSegment);
								console.log("[ExportService] 🔍 Last segment:", lastSegment);
								
								// Segment'lerin doğru property'lerini kullan
								const startTime = firstSegment.videoStart || firstSegment.start || 0;
								const endTime = lastSegment.videoEnd || lastSegment.end || 0;
								
								audioTrimInfo = {
									startTime: startTime,
									endTime: endTime,
									duration: endTime - startTime
								};
								
								console.log("[ExportService] ✅ Audio trim info calculated:", audioTrimInfo);
							} else {
								console.log("[ExportService] ❌ No segments found, using full audio");
								audioTrimInfo = {
									startTime: 0,
									endTime: duration,
									duration: duration
								};
							}
						} else {
							// Canvas-only mode - full audio duration kullan
							audioTrimInfo = {
								startTime: 0,
								endTime: duration,
								duration: duration
							};
							console.log("[ExportService] Canvas-only audio trim info:", audioTrimInfo);
						}
					} else {
						console.log("[ExportService] ❌ No temp audio file available");
					}
				} else {
					console.log("[ExportService] ❌ Electron IPC not available for audio");
				}
			} catch (error) {
				console.error("Audio setup error:", error);
			}
		} else {
			console.log("[ExportService] No audio for this export (non-MP4 format)");
		}

		// Frame collection completion handler
		const completeFrameCollection = async () => {
			try {
				console.log(`[ExportService] Frame collection completed: ${frames.length} frames`);
				
				// Export tamamlandı - video'yu editör durumuna döndür
				if (hasVideoElement) {
					await mediaPlayer.seek(0);
					await mediaPlayer.pause(); // Kullanıcı play yapana kadar bekle
				} else if (mediaPlayer.seek) {
					await mediaPlayer.seek(0);
				}

				// FFmpeg export için Electron IPC kullan
				if (!window.electron?.ipcRenderer) {
					throw new Error("Electron IPC not available");
				}

				onProgress(90); // Frame collection tamamlandı
				console.log("[ExportService] Frame collection completed, starting FFmpeg processing...");

				// Frames'leri ve settings'i Electron'a gönder
				const exportData = {
					frames: frames,
					settings: {
						...settings,
						width: exportWidth,
						height: exportHeight,
						fps: params.fps,
						bitrate: params.bitrate,
						aspectRatio: aspectRatioInfo,
						audioSourcePath: audioSourcePath, // Audio source path'i ekle
						audioTrimInfo: audioTrimInfo, // Audio trim bilgisini ekle
						
						// Advanced settings - backend'e gönder
						encodingSpeed: settings.encodingSpeed || 'balanced',
						useHardwareAccel: settings.useHardwareAccel !== false, // Default true
						audioQuality: settings.audioQuality || 128,
						
						// Zoom settings - viewport transformations için
						zoomSettings: zoomSettings,
					},
					duration: duration
				};

				console.log("[ExportService] Sending frames to FFmpeg via IPC");
				
				// Yeni IPC event'i kullan - FFmpeg tabanlı export
				const result = await window.electron.ipcRenderer.invoke(
					"EXPORT_WITH_FFMPEG",
					exportData
				);

				if (result.success) {
					console.log("[ExportService] FFmpeg processing completed successfully");
					onProgress(100);
					
					// Export başarılı - bildirim sesi çal
					try {
						const audio = new Audio('/sounds/notification1.mp3');
						audio.volume = 0.5; // %50 volume
						audio.play().catch(error => {
							console.warn("[ExportService] Notification sound play failed:", error);
						});
						console.log("[ExportService] ✅ Playing notification sound");
					} catch (error) {
						console.warn("[ExportService] Notification sound error:", error);
					}
					
					// Completion'ı biraz beklet - progress bar'ın 100'e ulaşması için
					setTimeout(() => {
						onComplete({
							filePath: result.filePath,
							format: settings.format,
							width: exportWidth,
							height: exportHeight,
						});
					}, 500);
				} else {
					throw new Error(result.error || "FFmpeg export failed");
				}

				// Export durumunu temizle
				window.isExporting = false;
				window.exportTime = undefined;
				window.exportCurrentTime = undefined;
				window.forceExportTime = false;
				
			} catch (error) {
				window.isExporting = false;
				window.exportTime = undefined;
				window.exportCurrentTime = undefined;
				window.forceExportTime = false;
				onError(error);
			}
		};

		// Export için video hazırlığı
		if (hasVideoElement) {
			// Video'yu başa sar ve pause et - export sırasında manuel control için
			await mediaPlayer.seek(0);
			await mediaPlayer.pause(); // Export sırasında manuel seek yapacağız
			console.log("[ExportService] Video paused for manual export control");
			
			// Kamera element'ini hazırla
			const cameraElement = mediaPlayer.getCameraElement();
			if (cameraElement) {
				console.log("[ExportService] Camera element detected, will be controlled during export");
			}
		} else {
			// Canvas-only mode için başlangıç pozisyonunu ayarla
			if (mediaPlayer.seek) {
				await mediaPlayer.seek(0);
			}
			console.log("[ExportService] Canvas-only export ready to start");
		}

		// Frame collection başlat
		console.log(`[ExportService] Starting FFmpeg-based frame collection...`);
		
		try {
			// Direkt render loop'u başlat
			console.log(`[ExportService] Starting frame capture loop...`);
			renderFrame();
			
		} catch (startError) {
			console.error("[ExportService] Frame capture start error:", startError);
			window.isExporting = false;
			window.exportTime = undefined;
			onError(startError);
			return;
		}
	} catch (error) {
		// Export durumunu temizle
		window.isExporting = false;
		window.exportTime = undefined;
		window.exportCurrentTime = undefined;
		window.forceExportTime = false;
		onError(error);
	}
};

export default {
	exportVideo,
	getExportParams,
};
