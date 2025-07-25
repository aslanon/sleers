import { ref, shallowRef } from "vue";
import { useRoundRect } from "~/composables/useRoundRect";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import { useBackgroundRemoval } from "~/composables/useBackgroundRemoval";
import { useTensorFlowWebcam } from "~/composables/useTensorFlowWebcam";

export const useCameraRenderer = () => {
	const { cameraSettings } = usePlayerSettings();
	const lastCameraPosition = shallowRef({ x: 0, y: 0 });
	const isMouseOverCamera = ref(false);
	const scaleValue = 3;
	const hoverScale = ref(1);
	const HOVER_SCALE = 1.0; // Scale efektini kaldır
	const TRANSITION_SPEED = 0.5; // Daha hızlı geçiş

	// Hover border properties
	const BORDER_WIDTH = 3;
	const BORDER_COLOR = "#3b82f6"; // Blue color
	const BORDER_OPACITY = 0.8;

	// Cache ve optimizasyon için yeni referanslar
	const lastFrameTime = ref(0);
	const renderRequestID = ref(null);
	const frameLimiter = ref(1000 / 60); // 60 FPS ile sınırla - daha yüksek FPS

	// Background removal integration
	const {
		isLoading: isBackgroundRemovalLoading,
		isProcessing: isBackgroundRemovalActive,
		startBackgroundRemoval,
		stopBackgroundRemoval,
		processFrame: processBackgroundRemovalFrame,
	} = useBackgroundRemoval();

	// TensorFlow background removal
	const {
		isInitialized: isTensorFlowInitialized,
		isProcessing: isTensorFlowProcessing,
		initialize: initializeTensorFlow,
		processFrame: processTensorFlowFrame,
		startProcessing: startTensorFlowProcessing,
		stopProcessing: stopTensorFlowProcessing,
	} = useTensorFlowWebcam();

	// Optimized processing state
	const processingCache = ref(new Map());
	const lastProcessedFrame = ref(null);
	const backgroundRemovalActive = ref(false);

	// Hover scale değerini güncelle
	const updateHoverScale = () => {
		const targetScale = isMouseOverCamera.value ? HOVER_SCALE : 1;
		hoverScale.value += (targetScale - hoverScale.value) * TRANSITION_SPEED;
		// Custom cursor sistemi cursor'ı kendisi yönetir
		// Bu yüzden canvas.style.cursor'ı override etmiyoruz
	};

	// Toggle background removal
	const toggleBackgroundRemoval = async () => {
		if (isBackgroundRemovalActive.value) {
			stopBackgroundRemoval();
		} else {
			await startBackgroundRemoval();
		}
		return isBackgroundRemovalActive.value;
	};

	// Hover frame çizim fonksiyonu
	const drawHoverFrame = (ctx, x, y, width, height, radius, dpr) => {
		ctx.save();

		// Çerçeve stilleri
		ctx.strokeStyle = BORDER_COLOR;
		ctx.lineWidth = BORDER_WIDTH * dpr;
		ctx.globalAlpha = BORDER_OPACITY;

		// Ana çerçeve
		ctx.beginPath();
		useRoundRect(ctx, x, y, width, height, radius);
		ctx.stroke();

		// Köşe işaretleri (snap handles)
		const handleSize = 12 * dpr;
		const handleOffset = 4 * dpr;

		ctx.lineWidth = 4 * dpr;
		ctx.globalAlpha = 1.0;

		// Sol üst köşe
		drawCornerHandle(ctx, x - handleOffset, y - handleOffset, handleSize, "tl");
		// Sağ üst köşe
		drawCornerHandle(
			ctx,
			x + width + handleOffset,
			y - handleOffset,
			handleSize,
			"tr"
		);
		// Sol alt köşe
		drawCornerHandle(
			ctx,
			x - handleOffset,
			y + height + handleOffset,
			handleSize,
			"bl"
		);
		// Sağ alt köşe
		drawCornerHandle(
			ctx,
			x + width + handleOffset,
			y + height + handleOffset,
			handleSize,
			"br"
		);

		ctx.restore();
	};

	// Köşe işareti çizim fonksiyonu
	const drawCornerHandle = (ctx, x, y, size, position) => {
		ctx.beginPath();

		const half = size / 2;

		// Her köşe için farklı çizgiler
		switch (position) {
			case "tl": // Sol üst
				ctx.moveTo(x, y + half);
				ctx.lineTo(x, y);
				ctx.lineTo(x + half, y);
				break;
			case "tr": // Sağ üst
				ctx.moveTo(x - half, y);
				ctx.lineTo(x, y);
				ctx.lineTo(x, y + half);
				break;
			case "bl": // Sol alt
				ctx.moveTo(x, y - half);
				ctx.lineTo(x, y);
				ctx.lineTo(x + half, y);
				break;
			case "br": // Sağ alt
				ctx.moveTo(x - half, y);
				ctx.lineTo(x, y);
				ctx.lineTo(x, y - half);
				break;
		}

		ctx.stroke();
	};

	const drawCamera = async (
		ctx,
		cameraElement,
		canvasWidth,
		canvasHeight,
		dpr,
		mouseX,
		mouseY,
		dragPosition = null,
		zoomScale = 1,
		videoPosition = { x: 0, y: 0 },
		backgroundType = "transparent",
		backgroundColor = "#000000",
		currentTime = 0,
		videoDuration = 0
	) => {
		// Check if camera should be visible
		if (!cameraSettings.value.visible) return false;

		// Always try to draw even if camera is not fully ready
		if (!cameraElement) return false;

		// Performans optimizasyonu: FPS sınırlama
		const now = performance.now();
		if (now - lastFrameTime.value < frameLimiter.value && !dragPosition) {
			return isMouseOverCamera.value;
		}
		lastFrameTime.value = now;

		// Update hover effect
		updateHoverScale();

		// Calculate camera dimensions - consider zoom scale for initial dimensions
		// Base size calculation considering the zoom
		let cameraWidth = (canvasWidth * cameraSettings.value.size) / 100;
		let cameraHeight;

		// Apply aspect ratio to camera dimensions if specified
		if (
			cameraSettings.value?.aspectRatio &&
			cameraSettings.value.aspectRatio !== "free"
		) {
			switch (cameraSettings.value.aspectRatio) {
				case "1:1":
					cameraHeight = cameraWidth;
					break;
				case "16:9":
					cameraHeight = cameraWidth * (9 / 16);
					break;
				case "9:16":
					cameraHeight = cameraWidth * (16 / 9);
					break;
				case "4:3":
					cameraHeight = cameraWidth * (3 / 4);
					break;
				case "3:4":
					cameraHeight = cameraWidth * (4 / 3);
					break;
				default:
					cameraHeight = cameraWidth;
			}
		} else {
			// Default to square if no aspect ratio specified
			cameraHeight = cameraWidth;
		}

		// Calculate source dimensions with fallbacks
		const videoRatio = cameraElement.videoWidth
			? cameraElement.videoWidth / cameraElement.videoHeight
			: 1;

		// Get target ratio based on camera settings
		let targetRatio = 1; // Default square ratio
		if (cameraSettings.value?.aspectRatio) {
			switch (cameraSettings.value.aspectRatio) {
				case "1:1":
					targetRatio = 1;
					break;
				case "16:9":
					targetRatio = 16 / 9;
					break;
				case "9:16":
					targetRatio = 9 / 16;
					break;
				case "4:3":
					targetRatio = 4 / 3;
					break;
				case "3:4":
					targetRatio = 3 / 4;
					break;
				case "custom":
					// Özel oran için hesaplama
					const customWidth = cameraSettings.value?.customRatioWidth || 16;
					const customHeight = cameraSettings.value?.customRatioHeight || 9;
					targetRatio = customWidth / customHeight;
					break;
				default:
					targetRatio = 1;
			}
		}

		// Cache değişkenleri için optimizasyon
		const cropX = cameraSettings.value?.crop?.x || 0;
		const cropY = cameraSettings.value?.crop?.y || 0;
		const cropWidth = cameraSettings.value?.crop?.width || 56.25;
		const cropHeight = cameraSettings.value?.crop?.height || 100;
		const hasVideo = cameraElement.videoWidth && cameraElement.videoHeight;

		let sourceWidth, sourceHeight, sourceX, sourceY;

		// Performans optimizasyonu: kaynak hesaplamaları sadece gerektiğinde
		if (hasVideo) {
			// Orijinal video boyutlarını al
			const originalWidth = cameraElement.videoWidth;
			const originalHeight = cameraElement.videoHeight;
			const originalRatio = originalWidth / originalHeight;

			// Serbest mod için kırpma alanını doğrudan kullan
			if (cameraSettings.value?.aspectRatio === "free") {
				// Kırpma alanının boyutlarını hesapla (yüzde olarak)
				const cropAreaWidth = (originalWidth * cropWidth) / 100;
				const cropAreaHeight = (originalHeight * cropHeight) / 100;

				// Kırpma alanının başlangıç noktalarını hesapla
				sourceX = (originalWidth * cropX) / 100;
				sourceY = (originalHeight * cropY) / 100;

				// Kırpma alanının boyutlarını kullan
				sourceWidth = cropAreaWidth;
				sourceHeight = cropAreaHeight;
			} else {
				// Belirli bir aspect ratio için, görüntüyü o orana göre kırp
				// Önce kırpma alanının merkezini bul
				const centerX =
					(originalWidth * cropX) / 100 + (originalWidth * cropWidth) / 200;
				const centerY =
					(originalHeight * cropY) / 100 + (originalHeight * cropHeight) / 200;

				// Hedef orana göre kırpma boyutlarını hesapla
				let newSourceWidth, newSourceHeight;

				if (targetRatio >= 1) {
					// Yatay veya kare oran (1:1, 16:9, 4:3, özel yatay)
					newSourceWidth = Math.min(
						originalWidth,
						originalHeight * targetRatio
					);
					newSourceHeight = newSourceWidth / targetRatio;
				} else {
					// Dikey oran (9:16, 3:4, özel dikey)
					newSourceHeight = Math.min(
						originalHeight,
						originalWidth / targetRatio
					);
					newSourceWidth = newSourceHeight * targetRatio;
				}

				// Kırpma alanını merkeze göre ayarla
				sourceX = Math.max(0, centerX - newSourceWidth / 2);
				sourceY = Math.max(0, centerY - newSourceHeight / 2);

				// Sınırları kontrol et
				if (sourceX + newSourceWidth > originalWidth) {
					sourceX = originalWidth - newSourceWidth;
				}
				if (sourceY + newSourceHeight > originalHeight) {
					sourceY = originalHeight - newSourceHeight;
				}

				sourceWidth = newSourceWidth;
				sourceHeight = newSourceHeight;
			}
		} else {
			// Fallback to estimated dimensions
			sourceWidth = (cameraWidth * cropWidth) / 100;
			sourceHeight = (cameraHeight * cropHeight) / 100;
			sourceX = (cameraWidth * cropX) / 100;
			sourceY = (cameraHeight * cropY) / 100;
		}

		// Calculate safe radius and shadow
		const maxRadius = Math.min(cameraWidth, cameraHeight) / 2;
		const safeRadius = Math.min(
			(cameraSettings.value?.radius || 0) * dpr * scaleValue,
			maxRadius
		);

		const maxShadowBlur = Math.min(cameraWidth, cameraHeight) * 0.2;
		const safeShadowBlur =
			((cameraSettings.value?.shadow || 0) / 100) * maxShadowBlur;

		// Calculate camera position with fallbacks
		let cameraX, cameraY;

		// Oynatma zamanına göre offset hesapla (cursor mantığı gibi)
		let timeBasedOffsetX = 0;
		let timeBasedOffsetY = 0;
		
		if (videoDuration > 0 && currentTime >= 0) {
			// Video süresine göre normalized time (0-1)
			const normalizedTime = Math.min(currentTime / videoDuration, 1);
			
			// Cursor'daki gibi timeline-based offset hesapla
			// Kayıt süresi boyunca kamera pozisyonunun geriden gelmesini düzelt
			const recordingDelay = 0.5; // 0.5 saniye gecikme varsayımı
			const adjustedTime = Math.max(0, currentTime - recordingDelay);
			const adjustedNormalizedTime = Math.min(adjustedTime / videoDuration, 1);
			
			// Offset miktarını hesapla - video başında daha fazla, sonunda azalır
			const maxOffset = 20 * dpr; // Maksimum offset miktarı
			timeBasedOffsetX = maxOffset * (1 - adjustedNormalizedTime);
			timeBasedOffsetY = maxOffset * (1 - adjustedNormalizedTime);
		}

		// Consider zoom scale when calculating camera position
		if (dragPosition && !cameraSettings.value.followMouse) {
			// If camera is being dragged and not following mouse, use drag position
			// When zoomed, account for the zoom scale in positioning
			cameraX = dragPosition.x + timeBasedOffsetX;
			cameraY = dragPosition.y + timeBasedOffsetY;
		} else if (cameraSettings.value.followMouse) {
			// For mouse following, consider the zoom scale when applying offsets
			const minOffset = 80; // Daha küçük minimum mesafe
			const offsetX = minOffset * dpr; // Sağ tarafta sabit mesafe
			const offsetY = minOffset * dpr; // Alt tarafta sabit mesafe

			if (dragPosition) {
				// Sürükleme sırasında video pozisyonunu ekleyerek kamera pozisyonunu güncelle
				cameraX = dragPosition.x + timeBasedOffsetX;
				cameraY = dragPosition.y + timeBasedOffsetY;
			} else {
				// İmleç pozisyonuna göre kamera pozisyonunu hesapla
				// Video pozisyonunu çıkararak mouse pozisyonunu normalize et
				const normalizedMouseX = mouseX - videoPosition.x;
				const normalizedMouseY = mouseY - videoPosition.y;

				const targetX = normalizedMouseX + offsetX - cameraWidth / 2 + timeBasedOffsetX;
				const targetY = normalizedMouseY + offsetY - cameraHeight / 2 + timeBasedOffsetY;

				// Daha hızlı takip için lerp faktörünü artır
				const lerpFactor = 0.3; // Daha hızlı takip için lerp faktörünü artırdık

				// Mevcut pozisyonu yumuşak geçiş ile güncelle
				// Video pozisyonunu ekleyerek kamera pozisyonunu güncelle
				const lastX = lastCameraPosition.value?.x || targetX;
				const lastY = lastCameraPosition.value?.y || targetY;

				cameraX = lastX + (targetX - lastX) * lerpFactor + videoPosition.x;
				cameraY = lastY + (targetY - lastY) * lerpFactor + videoPosition.y;
			}
		} else {
			// When not following mouse or being dragged, maintain fixed position
			cameraX =
				(lastCameraPosition.value?.x || canvasWidth - cameraWidth - 20 * dpr) + timeBasedOffsetX;
			cameraY =
				(lastCameraPosition.value?.y || canvasHeight - cameraHeight - 20 * dpr) + timeBasedOffsetY;
		}

		// Apply zoom adjustments if needed
		if (zoomScale > 1) {
			// Adjust camera size slightly when zoomed to keep it proportional
			const zoomCameraWidth = cameraWidth;
			const zoomCameraHeight = cameraHeight;

			// CANVAS_PADDING sadece followMouse aktifse uygula
			if (cameraSettings.value.followMouse) {
				const CANVAS_PADDING = 48 * dpr; // 48px padding from edges
				cameraX = Math.max(
					CANVAS_PADDING,
					Math.min(canvasWidth - zoomCameraWidth - CANVAS_PADDING, cameraX)
				);
				cameraY = Math.max(
					CANVAS_PADDING,
					Math.min(canvasHeight - zoomCameraHeight - CANVAS_PADDING, cameraY)
				);
			}
		}

		// CANVAS_PADDING sadece followMouse aktifse uygula
		if (cameraSettings.value.followMouse) {
			const CANVAS_PADDING = 48 * dpr; // 48px padding from edges
			cameraX = Math.max(
				CANVAS_PADDING,
				Math.min(canvasWidth - cameraWidth - CANVAS_PADDING, cameraX)
			);
			cameraY = Math.max(
				CANVAS_PADDING,
				Math.min(canvasHeight - cameraHeight - CANVAS_PADDING, cameraY)
			);
		}

		// Save last position, accounting for zoom
		if (dragPosition || !cameraSettings.value.followMouse) {
			lastCameraPosition.value = {
				x: cameraX - videoPosition.x,
				y: cameraY - videoPosition.y,
			};
		}

		// Process frame with TensorFlow if enabled (optimized)
		if (cameraSettings.value.optimizedBackgroundRemoval && cameraElement) {
			backgroundRemovalActive.value = true;

			if (!isTensorFlowInitialized.value) {
				initializeTensorFlow().then(() => {
					startTensorFlowProcessing();
				});
			} else if (!isTensorFlowProcessing.value) {
				startTensorFlowProcessing();
			}

			// Cache processed frames to avoid re-processing
			const frameKey = `${cameraElement?.currentTime || now}`;
			if (processingCache.value.has(frameKey)) {
				lastProcessedFrame.value = processingCache.value.get(frameKey);
			} else {
				// Process asynchronously without blocking render
				processTensorFlowFrame(cameraElement)
					.then((processedCanvas) => {
						if (processedCanvas) {
							processingCache.value.set(frameKey, processedCanvas);
							lastProcessedFrame.value = processedCanvas;

							// Limit cache size to 3 frames
							if (processingCache.value.size > 3) {
								const firstKey = processingCache.value.keys().next().value;
								processingCache.value.delete(firstKey);
							}
						}
					})
					.catch(() => {
						// Handle processing errors silently
					});
			}
		} else {
			backgroundRemovalActive.value = false;
			if (isTensorFlowProcessing.value) {
				stopTensorFlowProcessing();
			}
			lastProcessedFrame.value = null;
			processingCache.value.clear();
		}

		// Draw camera with proper state management
		ctx.save();

		try {
			// Kamera alanı için arka planı doldur
			if (backgroundType === "color") {
				ctx.save();
				ctx.beginPath();
				useRoundRect(
					ctx,
					cameraX,
					cameraY,
					cameraWidth,
					cameraHeight,
					safeRadius
				);
				ctx.clip();
				// Renk ve tam opaklık uygula
				ctx.globalAlpha = 1.0;
				ctx.fillStyle = backgroundColor;
				ctx.fill();
				ctx.restore();
			}

			// Apply hover effect scaling
			const scaledWidth = cameraWidth * hoverScale.value;
			const scaledHeight = cameraHeight * hoverScale.value;
			const scaleOffsetX = (scaledWidth - cameraWidth) / 2;
			const scaleOffsetY = (scaledHeight - cameraHeight) / 2;

			// Apply camera position transforms
			ctx.translate(cameraX + cameraWidth / 2, cameraY + cameraHeight / 2);
			ctx.scale(hoverScale.value, hoverScale.value);
			ctx.translate(
				-(cameraX + cameraWidth / 2),
				-(cameraY + cameraHeight / 2)
			);

			// Apply anti-aliasing
			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = "high";

			// Draw shadow if enabled (only shadow, no background fill)
			if (cameraSettings.value?.shadow > 0) {
				ctx.save();
				ctx.beginPath();
				useRoundRect(
					ctx,
					cameraX,
					cameraY,
					cameraWidth,
					cameraHeight,
					safeRadius
				);
				ctx.shadowColor = "rgba(0,0,0,0.6)";
				ctx.shadowBlur = safeShadowBlur;
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 0;
				ctx.fillStyle = "rgba(0,0,0,0.01)";
				ctx.fill();
				ctx.globalAlpha = 1.0;
				ctx.restore();
			}

			// Clip camera area
			ctx.save();
			ctx.beginPath();
			useRoundRect(
				ctx,
				cameraX,
				cameraY,
				cameraWidth,
				cameraHeight,
				safeRadius
			);
			ctx.clip();

			// Additional clip for smooth edges
			ctx.beginPath();
			useRoundRect(
				ctx,
				cameraX - 2,
				cameraY - 2,
				cameraWidth + 4,
				cameraHeight + 4,
				safeRadius + 2
			);
			ctx.clip();

			// No background fill needed for transparency
			// The clipped area will naturally show transparency

			// Apply mirror effect if enabled
			if (cameraSettings.value?.mirror) {
				ctx.translate(cameraX + cameraWidth, cameraY);
				ctx.scale(-1, 1);
				ctx.translate(-cameraX, -cameraY);
			}

			// Draw camera with real transparency support
			if (backgroundRemovalActive.value && lastProcessedFrame.value) {
				const processedCanvas = lastProcessedFrame.value;

				// Crop ve aspect ratio mantığını processedCanvas için de uygula
				ctx.drawImage(
					processedCanvas,
					sourceX,
					sourceY,
					sourceWidth,
					sourceHeight,
					cameraX,
					cameraY,
					cameraWidth,
					cameraHeight
				);
			} else {
				// Normal rendering without background removal
				ctx.drawImage(
					cameraElement,
					sourceX,
					sourceY,
					sourceWidth,
					sourceHeight,
					cameraX,
					cameraY,
					cameraWidth,
					cameraHeight
				);
			}

			ctx.restore();

			// Border çizimi
			if (cameraSettings.value?.borderWidth > 0) {
				ctx.save();
				ctx.beginPath();
				useRoundRect(
					ctx,
					cameraX,
					cameraY,
					cameraWidth,
					cameraHeight,
					safeRadius
				);
				ctx.strokeStyle =
					cameraSettings.value.borderColor || "rgba(0, 0, 0, 1)";
				ctx.lineWidth = cameraSettings.value.borderWidth * dpr;
				ctx.stroke();
				ctx.restore();
			}

			// Hover çerçevesi çizimi
			if (isMouseOverCamera.value && !cameraSettings.value?.followMouse) {
				drawHoverFrame(
					ctx,
					cameraX,
					cameraY,
					cameraWidth,
					cameraHeight,
					safeRadius,
					dpr
				);
			}
		} catch (error) {
			// Handle rendering errors gracefully without logging
		} finally {
			ctx.restore();
		}

		// Update mouse interaction state
		if (mouseX !== undefined && mouseY !== undefined) {
			ctx.beginPath();
			useRoundRect(
				ctx,
				cameraX,
				cameraY,
				cameraWidth,
				cameraHeight,
				safeRadius
			);
			isMouseOverCamera.value = ctx.isPointInPath(mouseX, mouseY);
		}

		// Kamera pozisyon bilgisini de döndür
		const cameraRect = {
			x: cameraX,
			y: cameraY,
			width: cameraWidth,
			height: cameraHeight
		};

		return {
			isMouseOver: isMouseOverCamera.value,
			rect: cameraRect
		};
	};

	return {
		drawCamera,
		isMouseOverCamera,
		lastCameraPosition,
		hoverScale,
		toggleBackgroundRemoval,
		isBackgroundRemovalLoading,
		isBackgroundRemovalActive,
	};
};
