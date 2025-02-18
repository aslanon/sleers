import { ref } from "vue";
import { useRoundRect } from "~/composables/useRoundRect";
import { usePlayerSettings } from "~/composables/usePlayerSettings";

export const useCameraRenderer = () => {
	const { cameraSettings } = usePlayerSettings();
	const lastCameraPosition = ref({ x: 0, y: 0 });
	const isMouseOverCamera = ref(false);
	const scaleValue = 3;
	const hoverScale = ref(1);
	const HOVER_SCALE = 1.1; // Hover durumunda %10 büyüme
	const TRANSITION_SPEED = 0.5; // Daha hızlı geçiş

	// Hover scale değerini güncelle
	const updateHoverScale = () => {
		const targetScale = isMouseOverCamera.value ? HOVER_SCALE : 1;
		hoverScale.value += (targetScale - hoverScale.value) * TRANSITION_SPEED;
		const canvas = document.getElementById("canvasID");
		if (canvas) {
			canvas.style.cursor = isMouseOverCamera.value ? "grab" : "default";
		}
	};

	const drawCamera = (
		ctx,
		cameraElement,
		canvasWidth,
		canvasHeight,
		dpr,
		mouseX,
		mouseY,
		dragPosition = null,
		zoomScale = 1,
		videoPosition = { x: 0, y: 0 }
	) => {
		// Always try to draw even if camera is not fully ready
		if (!cameraElement) return false;

		// Update hover effect
		updateHoverScale();

		// Calculate camera dimensions
		const cameraWidth = (canvasWidth * cameraSettings.value.size) / 100;
		const cameraHeight = cameraWidth;

		// Calculate source dimensions with fallbacks
		const videoRatio = cameraElement.videoWidth
			? cameraElement.videoWidth / cameraElement.videoHeight
			: 1;
		const targetRatio = 1;

		let sourceWidth, sourceHeight, sourceX, sourceY;

		// Get crop settings with fallbacks
		const cropX = cameraSettings.value?.crop?.x || 0;
		const cropWidth = cameraSettings.value?.crop?.width || 56.25;

		// Calculate source dimensions based on video ratio
		if (videoRatio > targetRatio) {
			sourceHeight = cameraElement.videoHeight || cameraHeight;
			sourceWidth = sourceHeight;
			const maxOffset = (cameraElement.videoWidth || cameraWidth) - sourceWidth;
			sourceX = (maxOffset * cropX) / 43.75;
			sourceY = 0;
			sourceWidth = sourceWidth * (cropWidth / 56.25);
		} else {
			sourceWidth = cameraElement.videoWidth || cameraWidth;
			sourceHeight = sourceWidth;
			const maxOffset =
				(cameraElement.videoHeight || cameraHeight) - sourceHeight;
			sourceY = (maxOffset * cropX) / 43.75;
			sourceX = 0;
			sourceHeight = sourceHeight * (cropWidth / 56.25);
		}

		// Calculate safe radius and shadow
		const maxRadius = Math.min(cameraWidth, cameraHeight) / 2;
		const safeRadius = Math.min(
			(cameraSettings.value?.radius || 0) * dpr * scaleValue,
			maxRadius
		);

		const maxShadowBlur = Math.min(cameraWidth, cameraHeight) * 0.2;
		const safeShadowBlur = Math.min(
			(cameraSettings.value?.shadow || 0) * dpr * scaleValue,
			maxShadowBlur
		);

		// Calculate camera position with fallbacks
		let cameraX, cameraY;

		if (dragPosition && !cameraSettings.value.followMouse) {
			// Mouse takibi kapalıysa ve kamera sürükleniyorsa sadece dragPosition'ı kullan
			cameraX = dragPosition.x;
			cameraY = dragPosition.y;
		} else if (cameraSettings.value.followMouse) {
			// Mouse takibi aktifse video pozisyonunu ekle ve offset uygula
			const minOffset = 200; // Minimum mesafe
			const offsetX = minOffset * dpr; // Sağda sabit mesafe
			const offsetY = minOffset * dpr; // Aşağıda sabit mesafe

			if (dragPosition) {
				// Kamera sürükleniyorsa dragPosition'ı video pozisyonuyla birlikte kullan
				cameraX = dragPosition.x + videoPosition.x;
				cameraY = dragPosition.y + videoPosition.y;
			} else {
				// Kamerayı cursor'ın sağına ve altına yerleştir
				cameraX = mouseX + offsetX + videoPosition.x - cameraWidth / 2;
				cameraY = mouseY + offsetY + videoPosition.y - cameraHeight / 2;
			}
		} else {
			// Mouse takibi kapalıysa ve sürüklenmiyorsa sabit konumda kal
			cameraX =
				lastCameraPosition.value?.x || canvasWidth - cameraWidth - 20 * dpr;
			cameraY =
				lastCameraPosition.value?.y || canvasHeight - cameraHeight - 20 * dpr;
		}

		// Ensure camera stays within canvas bounds
		cameraX = Math.max(0, Math.min(canvasWidth - cameraWidth, cameraX));
		cameraY = Math.max(0, Math.min(canvasHeight - cameraHeight, cameraY));

		// Save last position
		if (dragPosition || !cameraSettings.value.followMouse) {
			lastCameraPosition.value = {
				x: cameraSettings.value.followMouse
					? cameraX - videoPosition.x
					: cameraX,
				y: cameraSettings.value.followMouse
					? cameraY - videoPosition.y
					: cameraY,
			};
		}

		// Draw camera with proper state management
		ctx.save();

		try {
			// Apply hover effect scaling
			const scaledWidth = cameraWidth * hoverScale.value;
			const scaledHeight = cameraHeight * hoverScale.value;
			const scaleOffsetX = (scaledWidth - cameraWidth) / 2;
			const scaleOffsetY = (scaledHeight - cameraHeight) / 2;

			ctx.translate(cameraX + cameraWidth / 2, cameraY + cameraHeight / 2);
			ctx.scale(hoverScale.value, hoverScale.value);
			ctx.translate(
				-(cameraX + cameraWidth / 2),
				-(cameraY + cameraHeight / 2)
			);

			// Apply anti-aliasing
			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = "high";

			// Draw shadow if enabled
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
				ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
				ctx.shadowBlur = safeShadowBlur;
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 0;
				ctx.fillStyle = "#000000";
				ctx.fill();
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

			// Draw background
			ctx.fillStyle = "rgba(0, 0, 0, 0)";
			ctx.fill();

			// Apply mirror effect if enabled
			if (cameraSettings.value?.mirror) {
				ctx.translate(cameraX + cameraWidth, cameraY);
				ctx.scale(-1, 1);
				ctx.translate(-cameraX, -cameraY);
			}

			// Draw camera with error handling
			try {
				ctx.drawImage(
					cameraElement,
					sourceX,
					sourceY,
					sourceWidth,
					sourceHeight,
					cameraX - 1,
					cameraY - 1,
					cameraWidth + 2,
					cameraHeight + 2
				);
			} catch (error) {
				console.warn("[CameraRenderer] Failed to draw camera:", error);
				// Draw fallback if camera draw fails
				ctx.fillStyle = "#000000";
				ctx.fillRect(cameraX, cameraY, cameraWidth, cameraHeight);
			}

			ctx.restore();
		} catch (error) {
			console.error("[CameraRenderer] Error in camera rendering:", error);
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

		return isMouseOverCamera.value;
	};

	return {
		drawCamera,
		isMouseOverCamera,
		lastCameraPosition,
		hoverScale,
	};
};
