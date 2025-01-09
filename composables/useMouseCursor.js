import { ref } from "vue";
import cursorSvg from "~/assets/cursors/default.svg";
import { calculateZoomOrigin } from "~/composables/utils/zoomPositions";
import {
	calculateMousePosition,
	calculateMouseMovement,
	calculateVideoDisplaySize,
} from "~/composables/utils/mousePosition";
import {
	calculateMotionBlurEffects,
	applyTrailEffects,
	applyDeformationEffects,
} from "~/composables/utils/motionBlur";

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

		// Motion blur efektlerini hesapla
		const { easedIntensity, deformAmount, blurAmount } =
			calculateMotionBlurEffects(
				speed,
				moveDistance,
				MIN_SPEED_THRESHOLD,
				MAX_SPEED,
				motionBlurValue
			);

		// Trail efektlerini uygula
		applyTrailEffects(
			ctx,
			cursorImage,
			x,
			y,
			dirX,
			dirY,
			TRAIL_STEPS,
			TRAIL_OPACITY_BASE,
			TRAIL_OFFSET_MULTIPLIER,
			BLUR_BASE,
			size,
			offsetX,
			offsetY
		);

		// Ana cursor için normal efektleri uygula
		ctx.globalAlpha = 1;
		ctx.filter = `blur(${blurAmount}px)`;
		ctx.translate(x, y);

		// Deformasyon efektlerini uygula
		applyDeformationEffects(
			ctx,
			moveDistance,
			dirX,
			dirY,
			deformAmount,
			easedIntensity,
			MOVEMENT_ANGLE,
			SKEW_FACTOR,
			STRETCH_FACTOR
		);

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

		// Video boyutlarını hesapla
		const { displayWidth, displayHeight, videoX, videoY } =
			calculateVideoDisplaySize(
				videoElement.videoWidth,
				videoElement.videoHeight,
				canvasRef.width,
				canvasRef.height,
				padding
			);

		// Mouse pozisyonunu hesapla
		const { finalX, finalY } = calculateMousePosition(
			currentPos,
			nextPos,
			framePart,
			videoElement.videoWidth,
			videoElement.videoHeight,
			displayWidth,
			displayHeight,
			videoX,
			videoY
		);

		// Zoom origin'i hesapla
		const { originX, originY } = calculateZoomOrigin(
			zoomRanges.find(
				(range) => currentTime >= range.start && currentTime <= range.end
			)?.position ||
				lastZoomPosition.value ||
				"center",
			videoX,
			videoY,
			displayWidth,
			displayHeight,
			canvasRef.width / 2,
			canvasRef.height / 2
		);

		// Mouse pozisyonunu zoom origin'e göre ayarla
		const relativeX = finalX - originX;
		const relativeY = finalY - originY;

		// Zoom geçişlerinde smooth pozisyon hesaplama
		const activeZoom = zoomRanges.find(
			(range) => currentTime >= range.start && currentTime <= range.end
		);
		const targetScale = activeZoom ? activeZoom.scale : 1;
		const lerpFactor = 0.1;
		const smoothScale = videoScale + (targetScale - videoScale) * lerpFactor;

		// Pozisyonu smooth scale ile hesapla
		const adjustedX = originX + relativeX * smoothScale;
		const adjustedY = originY + relativeY * smoothScale;

		// Mouse hareketini hesapla
		const { speed, moveDistance, dirX, dirY } = calculateMouseMovement(
			currentPos,
			nextPos
		);

		ctx.save();

		// Motion blur efektini uygula
		applyMotionBlur(
			ctx,
			adjustedX,
			adjustedY,
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
