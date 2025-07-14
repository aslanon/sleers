import { ref, shallowRef, onMounted, onUnmounted, computed } from "vue";
import * as bodyPix from "@tensorflow-models/body-pix";
import "@tensorflow/tfjs";

export const useBackgroundRemoval = () => {
	// State variables
	const isLoading = ref(false);
	const isProcessing = ref(false);
	const model = shallowRef(null);
	const lastFrameTime = ref(0);
	const animationFrameId = ref(null);
	const processingCanvas = shallowRef(null);
	const processingCtx = shallowRef(null);
	const segmentationThreshold = ref(0.6);
	const internalResolution = ref("medium");
	const flipHorizontal = ref(false);
	const targetFps = ref(30);
	const frameInterval = computed(() => 1000 / targetFps.value);
	const modelConfig = {
		architecture: "MobileNetV1",
		outputStride: 16,
		multiplier: 0.5,
		quantBytes: 4,
	};

	// Initialize the processing canvas with proper size
	const initProcessingCanvas = (width = 640, height = 480) => {
		if (!processingCanvas.value) {
			processingCanvas.value = document.createElement("canvas");
		}
		processingCanvas.value.width = width;
		processingCanvas.value.height = height;
		processingCtx.value = processingCanvas.value.getContext("2d", {
			willReadFrequently: true,
		});
	};

	// Load the BodyPix model with retry mechanism and better error handling
	const loadModel = async (retryCount = 0) => {
		if (model.value) return model.value;

		isLoading.value = true;
		try {
			// Try loading from CDN first
			const loadedModel = await bodyPix.load(modelConfig);
			model.value = loadedModel;
			return model.value;
		} catch (error) {
			console.error("[BackgroundRemoval] Error loading model:", error);
			if (retryCount < 3) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				return loadModel(retryCount + 1);
			}
			throw new Error("Failed to load BodyPix model after multiple attempts");
		} finally {
			isLoading.value = false;
		}
	};

	// Start background removal processing
	const startBackgroundRemoval = async () => {
		if (isProcessing.value) return;

		try {
			await loadModel();
			if (!model.value) {
				throw new Error("Model not loaded");
			}

			initProcessingCanvas();
			isProcessing.value = true;
		} catch (error) {
			console.error(
				"[BackgroundRemoval] Failed to start background removal:",
				error
			);
			isProcessing.value = false;
		}
	};

	// Stop background removal processing
	const stopBackgroundRemoval = () => {
		isProcessing.value = false;
		if (animationFrameId.value) {
			cancelAnimationFrame(animationFrameId.value);
			animationFrameId.value = null;
		}
	};

	// Process a single video frame with optimized performance
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
			const { videoWidth, videoHeight } = videoElement;

			// Update canvas size if needed
			if (
				processingCanvas.value.width !== videoWidth ||
				processingCanvas.value.height !== videoHeight
			) {
				initProcessingCanvas(videoWidth, videoHeight);
			}

			// Clear the canvas and draw the current frame
			processingCtx.value.clearRect(0, 0, videoWidth, videoHeight);
			processingCtx.value.drawImage(videoElement, 0, 0);

			// Get person segmentation
			const segmentation = await model.value.segmentPerson(videoElement, {
				flipHorizontal: flipHorizontal.value,
				internalResolution: internalResolution.value,
				segmentationThreshold: segmentationThreshold.value,
				maxDetections: 1,
				scoreThreshold: 0.4,
			});

			if (!segmentation || !segmentation.data) {
				return null;
			}

			// Get image data
			const imageData = processingCtx.value.getImageData(
				0,
				0,
				videoWidth,
				videoHeight
			);
			const pixels = imageData.data;
			const segmentationMask = segmentation.data;

			// Apply the mask to the image data
			for (let i = 0; i < segmentationMask.length; i++) {
				const offset = i * 4;
				if (!segmentationMask[i]) {
					// Make background transparent
					pixels[offset + 3] = 0;
				} else {
					// Keep person pixels fully opaque
					pixels[offset + 3] = 255;
				}
			}

			// Put the modified image data back to the canvas
			processingCtx.value.putImageData(imageData, 0, 0);
			return processingCanvas.value;
		} catch (error) {
			console.error("[BackgroundRemoval] Error processing frame:", error);
			return null;
		}
	};

	// Process frames continuously with optimized FPS control
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

		if (elapsed >= frameInterval.value) {
			processFrame(videoElement).then((processedCanvas) => {
				if (processedCanvas && callback) {
					callback(processedCanvas);
				}
				lastFrameTime.value = currentTime - (elapsed % frameInterval.value);
			});
		}

		animationFrameId.value = requestAnimationFrame(() =>
			processFrameLoop(videoElement, callback)
		);
	};

	// Update settings with validation
	const updateSettings = (settings) => {
		if (
			typeof settings.segmentationThreshold === "number" &&
			settings.segmentationThreshold >= 0 &&
			settings.segmentationThreshold <= 1
		) {
			segmentationThreshold.value = settings.segmentationThreshold;
		}
		if (
			settings.internalResolution &&
			["low", "medium", "high"].includes(settings.internalResolution)
		) {
			internalResolution.value = settings.internalResolution;
		}
		if (typeof settings.flipHorizontal === "boolean") {
			flipHorizontal.value = settings.flipHorizontal;
		}
		if (
			typeof settings.targetFps === "number" &&
			settings.targetFps >= 15 &&
			settings.targetFps <= 60
		) {
			targetFps.value = settings.targetFps;
		}
	};

	// Cleanup resources properly
	const cleanup = () => {
		stopBackgroundRemoval();
		if (processingCanvas.value) {
			processingCanvas.value.width = 0;
			processingCanvas.value.height = 0;
		}
		processingCanvas.value = null;
		processingCtx.value = null;
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
