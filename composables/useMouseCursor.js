import { ref } from "vue";
import cursorSvg from "~/assets/cursors/default.svg";

export const useMouseCursor = (MOTION_BLUR_CONSTANTS) => {
	// Mouse animasyonu için state
	const previousPositions = ref([]);

	// Cursor image yönetimi
	const cursorImage = Object.assign(new Image(), {
		src: cursorSvg,
		onload: () =>
			console.log("[useMouseCursor] Cursor image loaded successfully"),
		onerror: (error) =>
			console.error("[useMouseCursor] Cursor image loading error:", error),
	});

	// Motion blur fonksiyonu
	const applyMotionBlur = (
		ctx,
		x,
		y,
		dirX,
		dirY,
		speed,
		moveDistance,
		mouseSize,
		mouseMotionEnabled,
		motionBlurValue,
		videoScale
	) => {
		const {
			MIN_SPEED_THRESHOLD,
			MAX_SPEED,
			MIN_DISTANCE_THRESHOLD,
			TRAIL_STEPS,
			TRAIL_OPACITY_BASE,
			TRAIL_OFFSET_MULTIPLIER,
			BLUR_BASE,
			MOVEMENT_ANGLE,
			SKEW_FACTOR,
			STRETCH_FACTOR,
		} = MOTION_BLUR_CONSTANTS;

		// Mouse boyutunu kesinlikle sabit tut
		const size = mouseSize;
		const offsetX = size * 0.3;
		const offsetY = size * 0.2;

		// Zoom durumunda scale'i kompanse et
		if (videoScale > 1.001) {
			ctx.save();
			const scale = videoScale;
			ctx.scale(scale, scale);
			x = x / scale;
			y = y / scale;
		}

		// Hız ve mesafe kontrolü
		const isSignificantMovement =
			speed > MIN_SPEED_THRESHOLD && moveDistance > MIN_DISTANCE_THRESHOLD;

		if (!mouseMotionEnabled || !isSignificantMovement) {
			ctx.drawImage(cursorImage, x - offsetX, y - offsetY, size, size);
			if (videoScale > 1.001) {
				ctx.restore();
			}
			return;
		}

		const easeOutQuad = (t) => t * (2 - t);

		const normalizedSpeed = Math.min(
			(speed - MIN_SPEED_THRESHOLD) / (MAX_SPEED - MIN_SPEED_THRESHOLD),
			1
		);
		const normalizedDistance = Math.min(moveDistance / 100, 1);
		const movementIntensity = normalizedSpeed * normalizedDistance;
		const easedIntensity = easeOutQuad(movementIntensity);
		const deformAmount = Math.min(6, easedIntensity * motionBlurValue * 6);

		// Trail efekti
		for (let i = TRAIL_STEPS; i > 0; i--) {
			const trailOpacity = (i / TRAIL_STEPS) * TRAIL_OPACITY_BASE;
			const trailOffset = i * TRAIL_OFFSET_MULTIPLIER;

			ctx.globalAlpha = trailOpacity;
			ctx.filter = `blur(${BLUR_BASE}px)`;
			ctx.drawImage(
				cursorImage,
				x + dirX * trailOffset - offsetX,
				y + dirY * trailOffset - offsetY,
				size,
				size
			);
		}

		// Ana cursor için normal efektleri uygula
		ctx.globalAlpha = 1;
		const blurAmount = Math.min(1.5, easedIntensity * 5);
		ctx.filter = `blur(${blurAmount}px)`;

		ctx.translate(x, y);

		// Hareket yönüne doğru eğim uygula
		if (moveDistance > 25) {
			const angle = Math.atan2(dirY, dirX);
			const rotationDegree = MOVEMENT_ANGLE * (Math.PI / 180);
			ctx.rotate(angle * 0.05 + rotationDegree * easedIntensity);
		}

		const skewX = -dirX * deformAmount * SKEW_FACTOR;
		const skewY = -dirY * deformAmount * SKEW_FACTOR;
		const stretchX =
			1 + Math.abs(dirX * deformAmount * STRETCH_FACTOR) * easedIntensity;
		const stretchY =
			1 + Math.abs(dirY * deformAmount * STRETCH_FACTOR) * easedIntensity;

		ctx.scale(stretchX, stretchY);
		ctx.transform(1, skewY, skewX, 1, 0, 0);

		ctx.drawImage(cursorImage, -offsetX, -offsetY, size, size);

		if (videoScale > 1.001) {
			ctx.restore();
		}

		ctx.restore();
	};

	// Mouse pozisyonunu çiz
	const drawMousePosition = (
		ctx,
		currentTime,
		mousePositions,
		canvasRef,
		videoElement,
		padding,
		videoScale,
		zoomRanges,
		lastZoomPosition,
		mouseSize,
		mouseMotionEnabled,
		motionBlurValue
	) => {
		if (
			!mousePositions ||
			mousePositions.length === 0 ||
			!canvasRef ||
			!videoElement ||
			!cursorImage.complete
		)
			return;

		// Video süresini al
		const videoDuration = videoElement.duration;
		if (!videoDuration) return;

		// Mouse pozisyonları için toplam frame sayısı
		const totalFrames = mousePositions.length;
		const frameTime = videoDuration / totalFrames;
		const exactFrame = currentTime / frameTime;
		const currentFrame = Math.floor(exactFrame);
		const nextFrame = Math.min(currentFrame + 1, totalFrames - 1);
		const framePart = exactFrame - currentFrame;

		// İki frame arasında interpolasyon yap
		const currentPos = mousePositions[currentFrame];
		const nextPos = mousePositions[nextFrame];
		if (!currentPos || !nextPos) return;

		// Video boyutlarını al
		const videoWidth = videoElement.videoWidth;
		const videoHeight = videoElement.videoHeight;

		// Canvas boyutlarını al
		const canvas = canvasRef;
		const canvasWidth = canvas.width;
		const canvasHeight = canvas.height;

		// Video'nun canvas içindeki boyutlarını ve pozisyonunu hesapla
		const videoRatio = videoWidth / videoHeight;
		const canvasRatio = canvasWidth / canvasHeight;
		let displayWidth, displayHeight;

		if (videoRatio > canvasRatio) {
			displayWidth = canvasWidth - padding * 2;
			displayHeight = displayWidth / videoRatio;
		} else {
			displayHeight = canvasHeight - padding * 2;
			displayWidth = displayHeight * videoRatio;
		}

		// Video'nun canvas içindeki pozisyonunu hesapla (padding dahil)
		const videoX = (canvasWidth - displayWidth) / 2;
		const videoY = (canvasHeight - displayHeight) / 2;

		// İki pozisyon arasında cubic interpolasyon yap
		const t = framePart;
		const t2 = t * t;
		const t3 = t2 * t;
		const interpolatedX =
			currentPos.x + (nextPos.x - currentPos.x) * (3 * t2 - 2 * t3);
		const interpolatedY =
			currentPos.y + (nextPos.y - currentPos.y) * (3 * t2 - 2 * t3);

		// Video içindeki oransal pozisyonu hesapla (0-1 arası)
		const normalizedX = interpolatedX / videoWidth;
		const normalizedY = interpolatedY / videoHeight;

		// Mouse'un temel pozisyonunu hesapla
		let finalX = videoX + normalizedX * displayWidth;
		let finalY = videoY + normalizedY * displayHeight;

		// Zoom durumunda pozisyonu ayarla
		const centerX = canvasWidth / 2;
		const centerY = canvasHeight / 2;
		let originX = centerX;
		let originY = centerY;

		// Zoom origin noktasını belirle
		const activeZoom = zoomRanges.find(
			(range) => currentTime >= range.start && currentTime <= range.end
		);

		// Son zoom pozisyonunu kaydet
		if (activeZoom?.position) {
			switch (activeZoom.position) {
				case "top-left":
					originX = videoX;
					originY = videoY;
					break;
				case "top-center":
					originX = centerX;
					originY = videoY;
					break;
				case "top-right":
					originX = videoX + displayWidth;
					originY = videoY;
					break;
				case "middle-left":
					originX = videoX;
					originY = centerY;
					break;
				case "middle-right":
					originX = videoX + displayWidth;
					originY = centerY;
					break;
				case "bottom-left":
					originX = videoX;
					originY = videoY + displayHeight;
					break;
				case "bottom-center":
					originX = centerX;
					originY = videoY + displayHeight;
					break;
				case "bottom-right":
					originX = videoX + displayWidth;
					originY = videoY + displayHeight;
					break;
			}
			lastZoomPosition.value = activeZoom.position;
		} else if (lastZoomPosition.value) {
			// Zoom devreden çıkarken son pozisyonu kullan
			switch (lastZoomPosition.value) {
				case "top-left":
					originX = videoX;
					originY = videoY;
					break;
				case "top-center":
					originX = centerX;
					originY = videoY;
					break;
				case "top-right":
					originX = videoX + displayWidth;
					originY = videoY;
					break;
				case "middle-left":
					originX = videoX;
					originY = centerY;
					break;
				case "middle-right":
					originX = videoX + displayWidth;
					originY = centerY;
					break;
				case "bottom-left":
					originX = videoX;
					originY = videoY + displayHeight;
					break;
				case "bottom-center":
					originX = centerX;
					originY = videoY + displayHeight;
					break;
				case "bottom-right":
					originX = videoX + displayWidth;
					originY = videoY + displayHeight;
					break;
			}
		}

		// Mouse pozisyonunu zoom origin'e göre ayarla
		const relativeX = finalX - originX;
		const relativeY = finalY - originY;

		// Zoom geçişlerinde smooth pozisyon hesaplama
		const currentScale = videoScale;
		const targetScale = activeZoom ? activeZoom.scale : 1;
		const lerpFactor = 0.1; // Zoom ile aynı lerp faktörü

		// Scale değişimini smooth yap
		const smoothScale =
			currentScale + (targetScale - currentScale) * lerpFactor;

		// Pozisyonu smooth scale ile hesapla
		finalX = originX + relativeX * smoothScale;
		finalY = originY + relativeY * smoothScale;

		// Mouse hızını ve yönünü hesapla
		const moveX = nextPos.x - currentPos.x;
		const moveY = nextPos.y - currentPos.y;
		const speed = Math.sqrt(moveX * moveX + moveY * moveY);
		const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY);

		// Hareket yönünü hesapla ve normalize et
		const dirX = speed > 0 ? moveX / speed : 0;
		const dirY = speed > 0 ? moveY / speed : 0;

		ctx.save();

		// Motion blur efektini uygula
		applyMotionBlur(
			ctx,
			finalX,
			finalY,
			dirX,
			dirY,
			speed,
			moveDistance,
			mouseSize,
			mouseMotionEnabled,
			motionBlurValue,
			videoScale
		);

		ctx.restore();
	};

	return {
		previousPositions,
		cursorImage,
		drawMousePosition,
		applyMotionBlur,
	};
};
