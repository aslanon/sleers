/**
 * ExportService.js
 * Video export işlemlerini yöneten servis
 */

/**
 * Export öncesi tüm GIF'leri preload et ve yüklenmesini bekle
 * @param {Object} mediaPlayer - MediaPlayer komponenti referansı
 */
const preloadAllGifsForExport = async (mediaPlayer) => {
	console.log('[ExportService] 🎬 Starting GIF preloading for export...');
	
	// GIF manager'dan aktif GIF'leri al
	const activeGifs = window.activeGifs?.value || [];
	if (activeGifs.length === 0) {
		console.log('[ExportService] ✅ No GIFs to preload');
		return;
	}
	
	console.log(`[ExportService] 📦 Found ${activeGifs.length} GIFs to preload`);
	
	// GIF video cache'ini initialize et
	if (!window.gifVideoCache) {
		window.gifVideoCache = new Map();
	}
	
	// Tüm GIF'leri paralel olarak preload et
	const preloadPromises = activeGifs.map(async (gif) => {
		const cacheKey = gif.id || gif.url;
		
		// Zaten cache'de varsa skip et
		if (window.gifVideoCache.has(cacheKey)) {
			console.log(`[ExportService] ✅ GIF already cached: ${gif.id}`);
			return Promise.resolve();
		}
		
		return new Promise((resolve, reject) => {
			console.log(`[ExportService] 🔄 Preloading GIF: ${gif.id}`);
			
			const gifVideo = document.createElement("video");
			gifVideo.crossOrigin = "anonymous";
			gifVideo.muted = true;
			gifVideo.loop = true;
			gifVideo.playsInline = true;
			gifVideo.preload = "auto";
			gifVideo.autoplay = false; // Export sırasında manuel kontrol
			
			const videoUrl = gif.mp4Url || gif.url;
			
			// Timeout için timer
			const timeoutId = setTimeout(() => {
				console.warn(`[ExportService] ⚠️ GIF preload timeout: ${gif.id}`);
				// Timeout olsa bile cache'e ekle, belki çalışır
				window.gifVideoCache.set(cacheKey, gifVideo);
				resolve();
			}, 5000); // 5 saniye timeout
			
			gifVideo.onloadeddata = () => {
				clearTimeout(timeoutId);
				console.log(`[ExportService] ✅ GIF preloaded successfully: ${gif.id}`);
				window.gifVideoCache.set(cacheKey, gifVideo);
				
				// Export için ready state'e getir
				gifVideo.currentTime = 0;
				resolve();
			};
			
			gifVideo.onerror = (error) => {
				clearTimeout(timeoutId);
				console.error(`[ExportService] ❌ GIF preload failed: ${gif.id}`, error);
				reject(new Error(`Failed to preload GIF: ${gif.id}`));
			};
			
			gifVideo.src = videoUrl;
		});
	});
	
	try {
		// Tüm GIF'lerin yüklenmesini bekle (paralel)
		await Promise.allSettled(preloadPromises);
		
		console.log(`[ExportService] 🎉 GIF preloading completed! Cache size: ${window.gifVideoCache.size}`);
		
		// Cache durumunu kontrol et
		activeGifs.forEach((gif) => {
			const cacheKey = gif.id || gif.url;
			const isCached = window.gifVideoCache.has(cacheKey);
			console.log(`[ExportService] 📊 GIF ${gif.id}: ${isCached ? 'CACHED ✅' : 'NOT CACHED ❌'}`);
		});
		
		// GIF preload flag'ini set et
		window.gifsPreloaded = true;
		
	} catch (error) {
		console.error('[ExportService] ❌ GIF preloading failed:', error);
		// Preload başarısız olsa bile export'a devam et
		window.gifsPreloaded = true;
	}
};

// Resolution mapping - artık aspect ratio-aware
const resolutionMap = {
	small: { scale: 0.5, maxWidth: 960, maxHeight: 540 },
	medium: { scale: 0.75, maxWidth: 1280, maxHeight: 720 },
	large: { scale: 1.0, maxWidth: 1920, maxHeight: 1080 },
	"1080p": { scale: 1.0, maxWidth: 1920, maxHeight: 1080 },
	"4k": { scale: 1.0, maxWidth: 3840, maxHeight: 2160 },
};

const qualityMap = {
	low: { bitrate: 2500000 }, // 2.5 Mbps
	medium: { bitrate: 5000000 }, // 5 Mbps
	high: { bitrate: 8000000 }, // 8 Mbps
};

/**
 * Hızlı MediaRecorder ile export - gerçek zamanlı recording
 * @param {Object} mediaPlayer - MediaPlayer komponenti referansı
 * @param {Object} settings - Export ayarları
 * @param {Object} params - Export parametreleri
 * @param {Function} onProgress - İlerleme callback
 * @param {Function} onComplete - Tamamlanma callback
 * @param {Function} onError - Hata callback
 */
const fastExportWithMediaRecorder = async (
	mediaPlayer,
	settings,
	params,
	duration,
	onProgress,
	onComplete,
	onError
) => {
	console.log("[ExportService] FastExport: Starting MediaRecorder export");

	try {
		const canvas = mediaPlayer.getCanvas();
		if (!canvas) {
			throw new Error("Canvas bulunamadı");
		}

		// Canvas'ı önce güncelle ve sonra stream oluştur
		if (mediaPlayer && mediaPlayer.forceCanvasUpdate) {
			mediaPlayer.forceCanvasUpdate();
			// Canvas güncellemesi için kısa bekle
			await new Promise(resolve => setTimeout(resolve, 50));
		}
		
		// Canvas stream'i oluştur - yüksek FPS ile smooth capture
		const targetFPS = Math.max(params.fps, 30); // En az 30 FPS garantile
		const videoStream = canvas.captureStream(targetFPS);
		console.log(
			`[ExportService] FastExport: Canvas stream created at ${targetFPS} FPS with ${canvas.width}x${canvas.height}`
		);

		// Audio stream'lerini topla - MediaPlayer'ın actual audio'sunu kullan
		let combinedStream = videoStream;
		const audioTracks = [];

		// MediaPlayer'dan mute durumunu kontrol et
		const videoElement = mediaPlayer.getVideoElement ? mediaPlayer.getVideoElement() : null;
		const isPlayerMuted = videoElement ? videoElement.muted : false;
		console.log(`[ExportService] FastExport: Player mute state: ${isPlayerMuted}`);

		if (!isPlayerMuted) {
			try {
				// MediaPlayer'ın audio element'ini al
				const audioElement = mediaPlayer.getAudioElement ? mediaPlayer.getAudioElement() : null;
				
				if (audioElement && audioElement.src && !audioElement.muted) {
					// Audio element'den stream yakalama
					console.log('[ExportService] FastExport: Capturing audio from MediaPlayer audio element');
					
					// Create audio context to capture from audio element
					const audioContext = new (window.AudioContext || window.webkitAudioContext)();
					const audioElementSource = audioContext.createMediaElementSource(audioElement);
					const mediaStreamDestination = audioContext.createMediaStreamDestination();
					
					// Connect audio element to destination
					audioElementSource.connect(mediaStreamDestination);
					audioElementSource.connect(audioContext.destination); // Keep playing through speakers
					
					const audioStream = mediaStreamDestination.stream;
					if (audioStream.getAudioTracks().length > 0) {
						audioTracks.push(...audioStream.getAudioTracks());
						console.log('[ExportService] FastExport: Audio captured from MediaPlayer');
					}
				} else {
					console.log('[ExportService] FastExport: No audio element or audio source in MediaPlayer');
				}

				// Video element'den de audio yakalama (eğer varsa)
				if (videoElement && videoElement.src && !videoElement.muted) {
					try {
						const videoAudioContext = new (window.AudioContext || window.webkitAudioContext)();
						const videoAudioSource = videoAudioContext.createMediaElementSource(videoElement);
						const videoAudioDestination = videoAudioContext.createMediaStreamDestination();
						
						videoAudioSource.connect(videoAudioDestination);
						videoAudioSource.connect(videoAudioContext.destination);
						
						const videoAudioStream = videoAudioDestination.stream;
						if (videoAudioStream.getAudioTracks().length > 0) {
							audioTracks.push(...videoAudioStream.getAudioTracks());
							console.log('[ExportService] FastExport: Audio captured from video element');
						}
					} catch (error) {
						console.warn('[ExportService] FastExport: Video audio capture failed:', error);
					}
				}

				// Audio track'leri video stream'e ekle
				if (audioTracks.length > 0) {
					const mixedStream = new MediaStream([
						...videoStream.getVideoTracks(),
						...audioTracks
					]);
					combinedStream = mixedStream;
					console.log(`[ExportService] FastExport: Combined stream with ${audioTracks.length} audio track(s)`);
				} else {
					console.log('[ExportService] FastExport: No audio tracks available - video only');
				}
			} catch (error) {
				console.warn('[ExportService] FastExport: Audio capture from MediaPlayer failed:', error);
				console.log('[ExportService] FastExport: Falling back to video-only export');
			}
		} else {
			console.log('[ExportService] FastExport: Player is muted - video only export');
		}

		// MediaRecorder ayarları - optimized smooth recording için
		const mediaRecorderOptions = {
			videoBitsPerSecond: params.bitrate,
			mimeType: "video/webm;codecs=vp9", // VP9 daha iyi compression + hardware support
		};

		// Audio bitrate'i ekle eğer audio track'leri varsa
		if (audioTracks.length > 0) {
			mediaRecorderOptions.audioBitsPerSecond = 128000; // 128kbps audio
		}

		// VP9 desteklenmiyorsa VP8'e fallback
		if (!MediaRecorder.isTypeSupported(mediaRecorderOptions.mimeType)) {
			mediaRecorderOptions.mimeType = "video/webm;codecs=vp8";
			console.log("[ExportService] FastExport: VP9 not supported, using VP8");
		}
		
		// H.264 desteği varsa daha iyi uyumluluk için dene
		const h264MimeType = "video/webm;codecs=h264";
		if (MediaRecorder.isTypeSupported(h264MimeType)) {
			mediaRecorderOptions.mimeType = h264MimeType;
			console.log("[ExportService] FastExport: Using H.264 for better compatibility");
		}

		const mediaRecorder = new MediaRecorder(combinedStream, mediaRecorderOptions);
		console.log('[ExportService] FastExport: MediaRecorder created with', 
			combinedStream.getVideoTracks().length, 'video track(s) and', 
			combinedStream.getAudioTracks().length, 'audio track(s)');
		
		// Daha sık data chunk'larını al - smoother recording için
		const timeSlice = 100; // 100ms chunks için daha smooth recording
		console.log(`[ExportService] FastExport: Recording with ${timeSlice}ms time slices for smooth playback`);
		
		const recordedChunks = [];
		let exportTimeInterval; // Export time tracking interval

		// Duration zaten hesaplanmış olarak geliyor - videoElement zaten yukarıda tanımlı
		console.log(`[ExportService] FastExport: Recording duration: ${duration}s`);

		return new Promise((resolve, reject) => {
			// Data handler
			mediaRecorder.ondataavailable = (event) => {
				if (event.data && event.data.size > 0) {
					recordedChunks.push(event.data);
					console.log(
						`[ExportService] FastExport: Recorded chunk: ${event.data.size} bytes`
					);
				}
			};

			// Stop handler
			mediaRecorder.onstop = async () => {
				try {
					console.log(
						"[ExportService] FastExport: Recording stopped, processing..."
					);
					console.log(`[ExportService] FastExport: Total recorded chunks: ${recordedChunks.length}`);
					onProgress(80);

					// Blob oluştur
					const recordedBlob = new Blob(recordedChunks, { type: "video/webm" });
					console.log(
						`[ExportService] FastExport: Created blob: ${recordedBlob.size} bytes`
					);
					
					// Blob duration'ını kontrol etmeye çalış (tahmini)
					console.log(`[ExportService] FastExport: Expected duration: ${duration}s, Buffer: 200ms`);

					if (settings.format === "webm") {
						// WebM = MediaRecorder zaten WebM üretiyor, direkt belirlenen yere kaydet!
						console.log(
							"[ExportService] FastExport: WebM - DIRECT SAVE TO SPECIFIED PATH!"
						);
						console.log(
							"[ExportService] 🔍 Format check - settings.format:",
							settings.format
						);
						onProgress(90);

						try {
							// Export modal'dan gelen filename ve directory kullan
							const outputPath = `${settings.directory}/${settings.filename}.webm`;
							console.log(
								`[ExportService] WebM DIRECT save - NO FFMPEG: ${outputPath}`
							);
							console.log("[ExportService] 🔍 Settings:", settings);

							// Blob'u base64'e çevir ve SAVE_VIDEO handler'ını skipConversion ile kullan
							const reader = new FileReader();
							reader.onload = async () => {
								try {
									const base64Data = reader.result;
									// WebM direkt kayıt - yeni handler kullan
									console.log(
										"[ExportService] 🔍 Calling SAVE_WEBM_DIRECT - NO FFMPEG!"
									);
									console.log("[ExportService] 🔍 Output path:", outputPath);
									const result = await window.electron.ipcRenderer.invoke(
										"SAVE_WEBM_DIRECT",
										base64Data,
										outputPath
									);

									if (result.success) {
										onProgress(100);
										console.log(
											`[ExportService] FastExport: WebM saved DIRECTLY - NO FFMPEG: ${result.filePath}`
										);

										// Success sound
										try {
											const audio = new Audio("/sounds/notification1.mp3");
											audio.volume = 0.5;
											audio.play().catch(() => {});
										} catch {}

										setTimeout(() => {
											onComplete({
												filePath: result.filePath,
												format: settings.format,
												width: canvas ? canvas.width : params.maxWidth,
												height: canvas ? canvas.height : params.maxHeight,
											});
										}, 500);
									} else {
										throw new Error(result.error || "WebM save failed");
									}
								} catch (error) {
									console.error(
										"[ExportService] FastExport: WebM save error:",
										error
									);
									onError(error);
								} finally {
									window.isExporting = false;
								}
							};

							reader.readAsDataURL(recordedBlob);
						} catch (error) {
							console.error(
								"[ExportService] FastExport: WebM setup error:",
								error
							);
							onError(error);
							window.isExporting = false;
						}
					} else {
						// Sadece WebM destekleniyor
						console.error("[ExportService] Only WebM format is supported");
						onError(new Error("Only WebM format is supported for export"));
						window.isExporting = false;
					}
				} catch (error) {
					console.error(
						"[ExportService] FastExport: Stop handler error:",
						error
					);
					// Audio track'leri temizle (hata durumunda da)
					audioTracks.forEach(track => {
						try {
							track.stop();
						} catch (e) {
							console.warn('[ExportService] Error stopping audio track:', e);
						}
					});
					window.isExporting = false;
					onError(error);
				}
			};

			// Error handler
			mediaRecorder.onerror = (event) => {
				console.error(
					"[ExportService] FastExport: MediaRecorder error:",
					event.error
				);
				// Export time tracking temizle (hata durumunda da)
				if (exportTimeInterval) {
					clearInterval(exportTimeInterval);
				}
				window.exportTime = undefined;
				// Audio track'leri temizle (hata durumunda da)
				audioTracks.forEach(track => {
					try {
						track.stop();
					} catch (e) {
						console.warn('[ExportService] Error stopping audio track:', e);
					}
				});
				window.isExporting = false;
				onError(event.error);
			};

			// Video'yu baştan oynat ve record başlat
			const startRecording = async () => {
				try {
					onProgress(10);

					// Video'yu başa sar ve senkronize et
					console.log('[ExportService] FastExport: Setting MediaPlayer currentTime to 0');
					
					// MediaPlayer'ı 0'a getir ve play yap
					if (mediaPlayer && mediaPlayer.seek) {
						await mediaPlayer.seek(0);
						
						// Video ve audio elementlerini de force olarak 0'a set et
						const videoElement = mediaPlayer.getVideoElement ? mediaPlayer.getVideoElement() : null;
						const audioElement = mediaPlayer.getAudioElement ? mediaPlayer.getAudioElement() : null;
						
						if (videoElement) {
							videoElement.currentTime = 0;
							console.log('[ExportService] FastExport: Video element currentTime set to 0');
						}
						
						if (audioElement) {
							audioElement.currentTime = 0;
							console.log('[ExportService] FastExport: Audio element currentTime set to 0');
						}
						
						// Canvas'ı ilk frame ile güncelle - export başlamadan önce
						if (mediaPlayer && mediaPlayer.forceCanvasUpdate) {
							mediaPlayer.forceCanvasUpdate();
						}
						
						// Elementlerin sync olması için yeterli bekleyiş
						await new Promise(resolve => setTimeout(resolve, 200));
						
						if (mediaPlayer.play) {
							await mediaPlayer.play();
							console.log('[ExportService] FastExport: MediaPlayer playback started from 0');
						}
						
						// Canvas'ın ilk frame'ini capture etmek için ek güncelleme
						await new Promise(resolve => setTimeout(resolve, 100));
						if (mediaPlayer && mediaPlayer.forceCanvasUpdate) {
							mediaPlayer.forceCanvasUpdate();
						}
						
						// Video'nun sonuna kadar oynamasını sağla - loop=false olduğundan emin ol
						if (videoElement) {
							videoElement.loop = false;
							console.log('[ExportService] FastExport: Video loop disabled for complete export');
						}
						
						if (audioElement) {
							audioElement.loop = false;
							console.log('[ExportService] FastExport: Audio loop disabled for complete export');
						}
					}


					onProgress(20);

					// Recording başlat - time slice ile smooth chunks
					mediaRecorder.start(timeSlice);
					console.log(`[ExportService] FastExport: MediaRecorder started with ${timeSlice}ms time slices`);

					// Export time tracking için window.exportTime initialize et
					window.exportTime = 0;
					console.log('[ExportService] FastExport: Export time tracking initialized');

					// Export time'ı gerçek zamanlı güncelle - MediaPlayer canvas segment kontrolü için
					// FPS ile uyumlu güncelleme sıklığı (30 FPS = ~33ms)
					const updateInterval = 1000 / params.fps; // FPS'e göre dinamik interval
					console.log(`[ExportService] FastExport: Canvas update interval: ${updateInterval}ms (${params.fps} FPS)`);
					
					const exportTimeInterval = setInterval(() => {
						const elapsed = (Date.now() - startTime) / 1000;
						window.exportTime = Math.min(elapsed, duration);
						
						// MediaPlayer segment kontrolü - KRITIK: Tüm segmentlere dikkat et
						const segmentInfo = mediaPlayer.getSegmentVideoTime ? mediaPlayer.getSegmentVideoTime(window.exportTime) : null;
						const isInActiveSegment = segmentInfo !== null;
						
						// Video element'ini segment time ile senkronize et
						if (segmentInfo && segmentInfo.videoTime !== undefined) {
							const videoElement = mediaPlayer.getVideoElement ? mediaPlayer.getVideoElement() : null;
							const audioElement = mediaPlayer.getAudioElement ? mediaPlayer.getAudioElement() : null;
							
							// Video element'ini segment video time'ına set et
							if (videoElement && Math.abs(videoElement.currentTime - segmentInfo.videoTime) > 0.1) {
								videoElement.currentTime = segmentInfo.videoTime;
							}
							
							// Audio element'ini de senkronize et
							if (audioElement && Math.abs(audioElement.currentTime - segmentInfo.videoTime) > 0.1) {
								audioElement.currentTime = segmentInfo.videoTime;
							}
							
							// Segment değişikliği varsa canvas'ı extra güncelle
							if (segmentInfo.isNewSegment) {
								console.log(`[ExportService] FastExport: NEW SEGMENT - ID: ${segmentInfo.segmentId}, Video Time: ${segmentInfo.videoTime.toFixed(2)}s`);
								// Canvas'ı segment değişikliği için ekstra update et
								if (mediaPlayer && mediaPlayer.forceCanvasUpdate) {
									mediaPlayer.forceCanvasUpdate();
								}
							}
						}
						
						// Canvas'ı force update et - segment bilgisini kullanarak
						if (mediaPlayer && mediaPlayer.forceCanvasUpdate) {
							mediaPlayer.forceCanvasUpdate();
						}
						
						// Debug log (her 0.2 saniyede bir) - DETAYLI SEGMENT BILGISI
						if (Math.floor(elapsed * 5) !== Math.floor((elapsed - 0.05) * 5)) {
							console.log(`[ExportService] FastExport: Export time: ${window.exportTime.toFixed(2)}s/${duration}s (${((window.exportTime/duration)*100).toFixed(1)}%)`);
							if (isInActiveSegment && segmentInfo) {
								console.log(`[ExportService] FastExport: ACTIVE SEGMENT - ID: ${segmentInfo.segmentId}, Video Time: ${segmentInfo.videoTime?.toFixed(2)}s`);
							} else {
								console.log(`[ExportService] FastExport: NO ACTIVE SEGMENT - Timeline gap or GIF-only time`);
							}
						}
					}, updateInterval); // FPS ile uyumlu update rate

					// Duration + buffer kadar bekle, son frame'i de yakalamak için
					const recordingDuration = duration * 1000 + 200; // 200ms buffer for last frame
					console.log(`[ExportService] FastExport: Recording for ${recordingDuration}ms (${duration}s + 200ms buffer)`);
					
					setTimeout(() => {
						if (mediaRecorder.state === "recording") {
							const actualElapsed = (Date.now() - startTime) / 1000;
							console.log(`[ExportService] FastExport: Stopping recording after ${actualElapsed.toFixed(2)}s (target: ${duration}s + 0.2s buffer)`);
							console.log(`[ExportService] FastExport: Final export time: ${window.exportTime}s`);
							mediaRecorder.stop();

							// Export time tracking temizle
							clearInterval(exportTimeInterval);
							window.exportTime = undefined;
							console.log('[ExportService] FastExport: Export time tracking cleared');

							// Video'yu pause et
							if (mediaPlayer && mediaPlayer.pause) {
								mediaPlayer.pause();
							}

							// Audio track'leri temizle
							audioTracks.forEach(track => {
								track.stop();
								console.log('[ExportService] FastExport: Audio track stopped');
							});
						}
					}, recordingDuration);

					// Progress simulation - actual duration'a göre (buffer dahil değil)
					const progressInterval = setInterval(() => {
						const elapsed = (Date.now() - startTime) / 1000;
						const progress = Math.min(70, 20 + (elapsed / duration) * 50);
						onProgress(progress);

						// Progress'i duration'da bitir, buffer süresi progress'e yansımasın
						if (elapsed >= duration) {
							clearInterval(progressInterval);
						}
					}, 100);

					const startTime = Date.now();
				} catch (error) {
					console.error(
						"[ExportService] FastExport: Start recording error:",
						error
					);
					// Export time tracking temizle (hata durumunda da)
					if (exportTimeInterval) {
						clearInterval(exportTimeInterval);
					}
					window.exportTime = undefined;
					onError(error);
				}
			};

			// Recording'i başlat
			startRecording();
		});
	} catch (error) {
		console.error("[ExportService] FastExport: Setup error:", error);
		// Audio track'leri temizle (setup hatası durumunda da)
		if (typeof audioTracks !== 'undefined') {
			audioTracks.forEach(track => {
				try {
					track.stop();
				} catch (e) {
					console.warn('[ExportService] Error stopping audio track in setup error:', e);
				}
			});
		}
		window.isExporting = false;
		onError(error);
	}
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
		
		// KRITIK: Tüm GIF'leri export başlamadan önce preload et ve yüklenmesini bekle
		await preloadAllGifsForExport(mediaPlayer);

		// Export parametrelerini al
		const params = getExportParams(settings);
		console.log(`[ExportService] Export parametreleri:`, params);

		// Duration'ı erken hesapla - DETAYLI DEBUG
		const videoElement = mediaPlayer.getVideoElement();
		let duration = 0;

		console.log('[ExportService] === DURATION DEBUG START ===');
		console.log(`[ExportService] Video element exists: ${!!videoElement}`);
		
		if (videoElement) {
			console.log(`[ExportService] Video element duration: ${videoElement.duration}`);
			
			const canvasDuration = mediaPlayer.getTotalCanvasDuration
				? mediaPlayer.getTotalCanvasDuration()
				: 0;
			const clippedDuration = mediaPlayer.getClippedDuration
				? mediaPlayer.getClippedDuration()
				: 0;
				
			console.log(`[ExportService] getTotalCanvasDuration(): ${canvasDuration}`);
			console.log(`[ExportService] getClippedDuration(): ${clippedDuration}`);
			
			duration = canvasDuration > 0 ? canvasDuration : clippedDuration;
			console.log(`[ExportService] Selected duration (canvas > 0 ? canvas : clipped): ${duration}`);
			
			if (duration === 0) {
				duration = videoElement.duration || 0;
				console.log(`[ExportService] Fallback to video element duration: ${duration}`);
			}
		} else {
			const fallbackDuration = mediaPlayer.getTotalCanvasDuration
				? mediaPlayer.getTotalCanvasDuration()
				: 5;
			duration = fallbackDuration;
			console.log(`[ExportService] No video element, using fallback: ${duration}`);
		}

		console.log(`[ExportService] === FINAL CALCULATED DURATION: ${duration}s ===`);

		// Sadece WebM - MediaRecorder ile ultra hızlı export
		if (settings.format === "webm" && duration > 0) {
			console.log(
				"[ExportService] Using ULTRA FAST WebM MediaRecorder export - NO FFMPEG"
			);
			return await fastExportWithMediaRecorder(
				mediaPlayer,
				settings,
				params,
				duration,
				onProgress,
				onComplete,
				onError
			);
		}

		// MP4 artık desteklenmiyor - sadece WebM
		onError(
			new Error(
				"Only WebM format is supported for ultra-fast export. Please select WebM format."
			)
		);
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
