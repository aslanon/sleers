import { useLayoutSettings } from "./useLayoutSettings";
import { watch, ref } from "vue";
import { usePlayerSettings } from "./usePlayerSettings";

export const useLayoutRenderer = () => {
	const { getCurrentLayoutAtTime, layoutRanges } = useLayoutSettings();
	const { cameraSettings } = usePlayerSettings();
	const opacity = ref(1);
	const lastLayoutType = ref("normal");
	const isExiting = ref(false);
	const enterSpeed = 0.1; // Giriş hızı
	const exitSpeed = 0.1; // Çıkış hızı (daha hızlı)

	// Watch for layout range changes
	watch(
		layoutRanges,
		(newRanges) => {
			console.log("Layout ranges in renderer:", newRanges);
		},
		{ deep: true }
	);

	const renderLayout = ({
		ctx,
		canvasRef,
		cameraElement,
		videoElement,
		videoState,
		currentTime,
		mouseX,
		mouseY,
		updateCanvas,
	}) => {
		// Check current layout
		const currentLayout = getCurrentLayoutAtTime(currentTime);
		const layoutType = currentLayout?.type || "normal";

		// Layout type değiştiğinde geçişi başlat
		if (layoutType !== lastLayoutType.value) {
			if (lastLayoutType.value !== "normal" && layoutType === "normal") {
				// Normal layout'a geçiş (çıkış animasyonu)
				isExiting.value = true;
			} else if (layoutType !== "normal") {
				// Özel layout'a geçiş (giriş animasyonu)
				opacity.value = 0;
				isExiting.value = false;
			}
			lastLayoutType.value = layoutType;
		}

		// Opacity güncelleme
		if (isExiting.value) {
			// Çıkış animasyonu - daha hızlı
			opacity.value = Math.max(0, opacity.value - exitSpeed);
			if (opacity.value === 0) {
				isExiting.value = false;
			}
		} else if (opacity.value < 1 && layoutType !== "normal") {
			// Giriş animasyonu
			opacity.value = Math.min(1, opacity.value + enterSpeed);
		}

		// Debug current layout
		console.log(
			"Current layout at time",
			currentTime,
			":",
			layoutType,
			currentLayout
		);
		console.log("Available layout ranges:", layoutRanges.value);

		// If no special layout and not exiting, return false to continue normal rendering
		if (layoutType === "normal" && !isExiting.value) {
			return false;
		}

		// Clear canvas
		ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);

		// Save the current context state
		ctx.save();

		// Apply global opacity
		ctx.globalAlpha = opacity.value;

		// Get aspect ratio from video state
		const aspectRatio = videoState.value?.aspectRatio || "16:9";
		const [targetWidth, targetHeight] = aspectRatio.split(":").map(Number);
		const targetRatio = targetWidth / targetHeight;

		// Calculate crop dimensions
		const canvasWidth = canvasRef.value.width;
		const canvasHeight = canvasRef.value.height;
		const cropWidth = canvasWidth;
		const cropHeight = (cropWidth / targetWidth) * targetHeight;
		const cropY = (canvasHeight - cropHeight) / 2;

		if (layoutType === "camera-full" && cameraElement?.readyState >= 2) {
			const sourceRatio = cameraElement.videoWidth / cameraElement.videoHeight;

			// Calculate camera dimensions to fill the crop area
			let drawWidth, drawHeight, x, y;
			if (sourceRatio > targetRatio) {
				drawHeight = cropHeight;
				drawWidth = drawHeight * sourceRatio;
				x = (cropWidth - drawWidth) / 2;
				y = cropY;
			} else {
				drawWidth = cropWidth;
				drawHeight = drawWidth / sourceRatio;
				x = 0;
				y = cropY + (cropHeight - drawHeight) / 2;
			}

			// Create clipping path for aspect ratio
			ctx.beginPath();
			ctx.rect(0, cropY, cropWidth, cropHeight);
			ctx.clip();

			if (cameraSettings.value?.mirror) {
				ctx.translate(x + drawWidth, y);
				ctx.scale(-1, 1);
				ctx.translate(-x, -y);
			}

			// Draw camera
			ctx.drawImage(cameraElement, x, y, drawWidth, drawHeight);
		} else if (layoutType === "screen-full" && videoElement?.readyState >= 2) {
			const sourceRatio = videoElement.videoWidth / videoElement.videoHeight;
			const drawWidth = canvasWidth;
			const drawHeight = drawWidth / sourceRatio;
			const y = (canvasHeight - drawHeight) / 2;

			// Draw screen
			ctx.drawImage(videoElement, 0, y, drawWidth, drawHeight);
		}

		// Restore the context state (including opacity)
		ctx.restore();

		// Request next frame if video is playing or transitioning
		if (videoState.value.isPlaying || opacity.value < 1 || isExiting.value) {
			requestAnimationFrame((t) => updateCanvas(t, mouseX, mouseY));
		}

		// Return true to indicate layout was handled
		return true;
	};

	return {
		renderLayout,
	};
};
