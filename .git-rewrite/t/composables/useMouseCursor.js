import { ref } from "vue";
import defaultCursor from "~/assets/cursors/default.svg";
import pointerCursor from "~/assets/cursors/pointer.svg";
import textCursor from "~/assets/cursors/text.svg";
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

// Cursor type mapping
const cursorImages = {
	default: defaultCursor,
	pointer: pointerCursor,
	text: textCursor,
};

const scaleValue = 3;

export const useMouseCursor = (MOTION_BLUR_CONSTANTS) => {
	// Mouse animasyonu için state
	const previousPositions = ref([]);

	// Cursor image yönetimi
	const cursorImageCache = {};

	const loadCursorImage = (type) => {
		if (!cursorImageCache[type]) {
			const image = Object.assign(new Image(), {
				src: cursorImages[type] || cursorImages.default,
				onload: () =>
					console.log(
						`[useMouseCursor] ${type} cursor image loaded successfully`
					),
				onerror: (error) =>
					console.error(
						`[useMouseCursor] ${type} cursor image loading error:`,
						error
					),
			});
			cursorImageCache[type] = image;
		}
		return cursorImageCache[type];
	};

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
		dpr,
		mouseMotionEnabled,
		motionBlurValue,
		videoScale,
		cursorType = "default"
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
		const size = mouseSize * dpr * scaleValue; // DPR ile ölçekle
		// Offset'leri boyuta göre oransal olarak hesapla
		const offsetX = size * 0.3;
		const offsetY = size * 0.2;

		// Get the appropriate cursor image
		const cursorImage = loadCursorImage(cursorType);

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

		// Shadow özelliklerini ayarla
		ctx.save();
		ctx.shadowColor = "rgba(0, 0, 0, 0.8 )";
		ctx.shadowBlur = 10 * dpr * scaleValue;
		ctx.shadowOffsetX = 1 * dpr * scaleValue;
		ctx.shadowOffsetY = 1 * dpr * scaleValue;

		if (!mouseMotionEnabled || !isSignificantMovement) {
			ctx.drawImage(cursorImage, x - offsetX, y - offsetY, size, size);
			ctx.restore();
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
		ctx.restore();

		if (videoScale > 1.001) {
			ctx.restore();
		}
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
		dpr,
		mouseMotionEnabled,
		motionBlurValue
	) => {
		if (
			!mousePositions ||
			mousePositions.length < 2 ||
			!canvasRef ||
			!videoElement ||
			videoElement.readyState < 3
		)
			return;

		// Video süresini al
		const videoDuration = videoElement.duration;
		if (!videoDuration) return;

		// Video henüz başlamamışsa ilk frame'i göster
		if (!videoElement.currentTime) {
			const currentPos = mousePositions[0];
			const nextPos = mousePositions[1];
			renderMouseFrame(
				ctx,
				currentPos,
				nextPos,
				0,
				canvasRef,
				videoElement,
				padding,
				videoScale,
				zoomRanges,
				lastZoomPosition,
				mouseSize,
				dpr,
				mouseMotionEnabled,
				motionBlurValue,
				currentTime
			);
			return;
		}

		// Her mouse pozisyonunun video zamanındaki karşılığını hesapla
		const startTime = mousePositions[0].timestamp;
		const endTime = mousePositions[mousePositions.length - 1].timestamp;
		const recordingDuration = endTime - startTime;

		// Video zamanını kayıt zamanına dönüştür (microsaniye hassasiyetinde)
		const exactVideoTime = videoElement.currentTime * 1000000; // microsaniye
		const exactRecordingTime =
			(exactVideoTime / (videoDuration * 1000000)) * recordingDuration;
		const targetTimestamp = startTime + exactRecordingTime;

		// Tam eşleşen frame'i bul
		let currentFrame = 0;
		let nextFrame = 1;
		let bestMatchDiff = Infinity;

		// İlk olarak binary search ile yaklaşık konumu bul
		let left = 0;
		let right = mousePositions.length - 2;

		while (left <= right) {
			const mid = Math.floor((left + right) / 2);
			const midDiff = Math.abs(mousePositions[mid].timestamp - targetTimestamp);

			if (midDiff < bestMatchDiff) {
				bestMatchDiff = midDiff;
				currentFrame = mid;
			}

			if (mousePositions[mid].timestamp < targetTimestamp) {
				left = mid + 1;
			} else {
				right = mid - 1;
			}
		}

		// Bulunan konumun etrafında daha hassas arama yap
		const searchWindow = 5; // Arama penceresi boyutu
		const start = Math.max(0, currentFrame - searchWindow);
		const end = Math.min(
			mousePositions.length - 2,
			currentFrame + searchWindow
		);

		for (let i = start; i <= end; i++) {
			const currentDiff = Math.abs(
				mousePositions[i].timestamp - targetTimestamp
			);
			if (currentDiff < bestMatchDiff) {
				bestMatchDiff = currentDiff;
				currentFrame = i;
			}
		}

		// Sonraki frame'i belirle
		nextFrame = Math.min(currentFrame + 1, mousePositions.length - 1);

		// Frame sınırlarını kontrol et
		if (currentFrame >= mousePositions.length - 1) {
			const currentPos = mousePositions[mousePositions.length - 2];
			const nextPos = mousePositions[mousePositions.length - 1];
			renderMouseFrame(
				ctx,
				currentPos,
				nextPos,
				1,
				canvasRef,
				videoElement,
				padding,
				videoScale,
				zoomRanges,
				lastZoomPosition,
				mouseSize,
				dpr,
				mouseMotionEnabled,
				motionBlurValue,
				currentTime
			);
			return;
		}

		const currentPos = mousePositions[currentFrame];
		const nextPos = mousePositions[nextFrame];

		if (!currentPos || !nextPos) return;

		// Hassas interpolasyon hesapla
		const frameInterval = nextPos.timestamp - currentPos.timestamp;
		const preciseFramePart = Math.max(
			0,
			Math.min(1, (targetTimestamp - currentPos.timestamp) / frameInterval)
		);

		// Hermite interpolasyon uygula (daha yumuşak geçişler için)
		const t = preciseFramePart;
		const t2 = t * t;
		const t3 = t2 * t;
		const h1 = 2 * t3 - 3 * t2 + 1;
		const h2 = -2 * t3 + 3 * t2;
		const h3 = t3 - 2 * t2 + t;
		const h4 = t3 - t2;

		const finalFramePart = h1 + h2 * preciseFramePart + h3 + h4;

		renderMouseFrame(
			ctx,
			currentPos,
			nextPos,
			finalFramePart,
			canvasRef,
			videoElement,
			padding,
			videoScale,
			zoomRanges,
			lastZoomPosition,
			mouseSize,
			dpr,
			mouseMotionEnabled,
			motionBlurValue,
			currentTime
		);
	};

	// Mouse frame'ini render et
	const renderMouseFrame = (
		ctx,
		currentPos,
		nextPos,
		framePart,
		canvasRef,
		videoElement,
		padding,
		videoScale,
		zoomRanges,
		lastZoomPosition,
		mouseSize,
		dpr,
		mouseMotionEnabled,
		motionBlurValue,
		currentTime
	) => {
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
			dpr,
			mouseMotionEnabled,
			motionBlurValue,
			videoScale,
			currentPos.cursorType || "default"
		);

		ctx.restore();
	};

	return {
		previousPositions,
		drawMousePosition,
		applyMotionBlur,
	};
};
