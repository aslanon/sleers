import { ref, shallowRef, onMounted, onUnmounted } from "vue";
import * as bodyPix from "@tensorflow-models/body-pix";
import "@tensorflow/tfjs";

export const useBackgroundRemoval = () => {
	// State variables
	const isLoading = ref(false);
	const isProcessing = ref(false);
	const model = shallowRef(null);
	const lastFrameTime = ref(0);
	const animationFrameId = ref(null);
	const targetFpsInterval = 1000 / 30; // Target 30 FPS
	const processingCanvas = shallowRef(null);
	const processingCtx = shallowRef(null);
	const segmentationThreshold = ref(0.6);
	const internalResolution = ref("medium");
	const flipHorizontal = ref(false);

	// Initialize the processing canvas
	const initProcessingCanvas = () => {
		if (!processingCanvas.value) {
			processingCanvas.value = document.createElement("canvas");
			processingCtx.value = processingCanvas.value.getContext("2d");
		}
	};

	// Load the BodyPix model
	const loadModel = async () => {
		if (model.value) return model.value;

		isLoading.value = true;
		try {
			const loadedModel = await bodyPix.load({
				architecture: "MobileNetV1",
				outputStride: 16,
				multiplier: 0.75,
				quantBytes: 2,
			});
			model.value = loadedModel;
			console.log("[BackgroundRemoval] Model loaded successfully");
		} catch (error) {
			console.error("[BackgroundRemoval] Error loading model:", error);
		} finally {
			isLoading.value = false;
		}
		return model.value;
	};

	// Start background removal processing
	const startBackgroundRemoval = async () => {
		if (isProcessing.value) return;

		await loadModel();
		if (!model.value) {
			console.error("[BackgroundRemoval] Model not loaded");
			return;
		}

		initProcessingCanvas();
		isProcessing.value = true;
		console.log("[BackgroundRemoval] Background removal started");
	};

	// Stop background removal processing
	const stopBackgroundRemoval = () => {
		isProcessing.value = false;
		if (animationFrameId.value) {
			cancelAnimationFrame(animationFrameId.value);
			animationFrameId.value = null;
		}
		console.log("[BackgroundRemoval] Background removal stopped");
	};

	// Process a single video frame
	const processFrame = async (videoElement) => {
		if (
			!model.value ||
			!isProcessing.value ||
			!videoElement ||
			!processingCtx.value
		) {
			return null;
		}

		try {
			// Resize processing canvas to match video dimensions
			const { videoWidth, videoHeight } = videoElement;
			processingCanvas.value.width = videoWidth;
			processingCanvas.value.height = videoHeight;

			// Draw the original video frame to the processing canvas
			processingCtx.value.drawImage(videoElement, 0, 0);

			// Get person segmentation from the model
			const segmentation = await model.value.segmentPerson(videoElement, {
				flipHorizontal: flipHorizontal.value,
				internalResolution: internalResolution.value,
				segmentationThreshold: segmentationThreshold.value,
			});

			// Get image data from the canvas
			const imageData = processingCtx.value.getImageData(
				0,
				0,
				videoWidth,
				videoHeight
			);
			const pixels = imageData.data;

			// Apply transparency to non-person pixels
			for (let i = 0; i < segmentation.data.length; i++) {
				const isPersonPixel = segmentation.data[i];
				const pixelIndex = i * 4;
				if (!isPersonPixel) {
					pixels[pixelIndex + 3] = 0; // Set alpha to 0 (transparent)
				}
			}

			// Put the modified image data back to the canvas
			processingCtx.value.putImageData(imageData, 0, 0);

			// Return the processed canvas for rendering
			return processingCanvas.value;
		} catch (error) {
			console.error("[BackgroundRemoval] Error processing frame:", error);
			return null;
		}
	};

	// Process frames continuously with FPS limiting
	const processFrameLoop = (videoElement, callback) => {
		if (!isProcessing.value || !videoElement) {
			if (animationFrameId.value) {
				cancelAnimationFrame(animationFrameId.value);
				animationFrameId.value = null;
			}
			return;
		}

		const currentTime = performance.now();
		const elapsed = currentTime - lastFrameTime.value;

		if (elapsed >= targetFpsInterval) {
			processFrame(videoElement).then((processedCanvas) => {
				if (processedCanvas && callback) {
					callback(processedCanvas);
				}
				lastFrameTime.value = currentTime - (elapsed % targetFpsInterval);
			});
		}

		animationFrameId.value = requestAnimationFrame(() =>
			processFrameLoop(videoElement, callback)
		);
	};

	// Update settings
	const updateSettings = (settings) => {
		if (settings.segmentationThreshold !== undefined) {
			segmentationThreshold.value = settings.segmentationThreshold;
		}
		if (settings.internalResolution !== undefined) {
			internalResolution.value = settings.internalResolution;
		}
		if (settings.flipHorizontal !== undefined) {
			flipHorizontal.value = settings.flipHorizontal;
		}
		if (settings.targetFps !== undefined) {
			targetFpsInterval.value = 1000 / settings.targetFps;
		}
	};

	// Cleanup resources
	const cleanup = () => {
		stopBackgroundRemoval();
		model.value = null;
	};

	// Setup and cleanup
	onMounted(() => {
		initProcessingCanvas();
	});

	onUnmounted(() => {
		cleanup();
	});

	return {
		isLoading,
		isProcessing,
		startBackgroundRemoval,
		stopBackgroundRemoval,
		processFrame,
		processFrameLoop,
		updateSettings,
		cleanup,
	};
};
