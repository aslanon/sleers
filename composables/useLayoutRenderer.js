import { useLayoutSettings } from "./useLayoutSettings";
import { watch } from "vue";

export const useLayoutRenderer = () => {
	const { getCurrentLayoutAtTime, layoutRanges } = useLayoutSettings();

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

		// Debug current layout
		console.log(
			"Current layout at time",
			currentTime,
			":",
			layoutType,
			currentLayout
		);
		console.log("Available layout ranges:", layoutRanges.value);

		// If no special layout, return false to continue normal rendering
		if (layoutType === "normal") {
			return false;
		}

		// Clear canvas
		ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);

		if (layoutType === "camera-full" && cameraElement?.readyState >= 2) {
			const cameraWidth = canvasRef.value.width;
			const cameraHeight = canvasRef.value.height;
			const sourceRatio = cameraElement.videoWidth / cameraElement.videoHeight;
			const targetRatio = cameraWidth / cameraHeight;

			let drawWidth, drawHeight, x, y;
			if (sourceRatio > targetRatio) {
				drawWidth = cameraWidth;
				drawHeight = drawWidth / sourceRatio;
				x = 0;
				y = (cameraHeight - drawHeight) / 2;
			} else {
				drawHeight = cameraHeight;
				drawWidth = drawHeight * sourceRatio;
				x = (cameraWidth - drawWidth) / 2;
				y = 0;
			}

			// Draw camera with canvas aspect ratio
			ctx.drawImage(cameraElement, x, y, drawWidth, drawHeight);
			ctx.restore();
		} else if (layoutType === "screen-full" && videoElement?.readyState >= 2) {
			ctx.drawImage(
				videoElement,
				0,
				0,
				canvasRef.value.width,
				canvasRef.value.height
			);
			ctx.restore();
		}

		// Request next frame if video is playing
		if (videoState.value.isPlaying) {
			requestAnimationFrame((t) => updateCanvas(t, mouseX, mouseY));
		}

		// Return true to indicate layout was handled
		return true;
	};

	return {
		renderLayout,
	};
};
