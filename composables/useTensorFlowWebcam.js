import { ref, computed, onUnmounted, shallowRef } from "vue";
import * as bodyPix from "@tensorflow-models/body-pix";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";

export const useTensorFlowWebcam = () => {
	// Core state
	const isInitialized = ref(false);
	const isProcessing = ref(false);
	const model = shallowRef(null);

	// Performance tracking (simplified)
	const processedFrameCount = ref(0);
	const lastFrameTime = ref(0);

	// Settings
	const segmentationThreshold = ref(0.5);
	const internalResolution = ref("medium");
	const flipHorizontal = ref(false);
	const targetFps = ref(30);

	// Canvas management
	const processCanvas = ref(null);
	const processCtx = ref(null);
	const outputCanvas = ref(null);
	const outputCtx = ref(null);
	const lastCanvasSize = ref({ width: 0, height: 0 });

	// Frame timing
	const frameInterval = computed(() => 1000 / targetFps.value);
	const animationFrameId = ref(null);
	const skipFrameCount = ref(0);

	// Model configuration optimized for real-time webcam
	const modelConfig = {
		architecture: "MobileNetV1",
		outputStride: 16,
		multiplier: 0.75,
		quantBytes: 2,
	};

	// Initialize WebGL backend for better performance
	const initializeBackend = async () => {
		try {
			await tf.setBackend("webgl");
			await tf.ready();
			return true;
		} catch (error) {
			await tf.setBackend("cpu");
			await tf.ready();
			return false;
		}
	};

	// Create optimized canvas setup
	const initializeCanvas = (width = 640, height = 480) => {
		// Only recreate if size changed significantly
		if (
			Math.abs(lastCanvasSize.value.width - width) > 10 ||
			Math.abs(lastCanvasSize.value.height - height) > 10
		) {
			// Processing canvas (for BodyPix input)
			if (!processCanvas.value) {
				processCanvas.value = document.createElement("canvas");
			}
			processCanvas.value.width = width;
			processCanvas.value.height = height;
			processCtx.value = processCanvas.value.getContext("2d", {
				alpha: false,
				willReadFrequently: false,
				desynchronized: true,
			});

			// Output canvas (for final result)
			if (!outputCanvas.value) {
				outputCanvas.value = document.createElement("canvas");
			}
			outputCanvas.value.width = width;
			outputCanvas.value.height = height;
			outputCtx.value = outputCanvas.value.getContext("2d", {
				alpha: true,
				willReadFrequently: false,
				desynchronized: true,
			});

			lastCanvasSize.value = { width, height };
		}
	};

	// Load model with optimizations
	const loadModel = async () => {
		if (model.value) return model.value;

		try {
			const startTime = performance.now();

			// Initialize backend first
			await initializeBackend();

			// Load model with optimized config
			model.value = await bodyPix.load(modelConfig);

			return model.value;
		} catch (error) {
			throw error;
		}
	};

	// Initialize the webcam processing system
	const initialize = async () => {
		if (isInitialized.value) return;

		try {
			await loadModel();
			initializeCanvas();
			isInitialized.value = true;
		} catch (error) {
			throw error;
		}
	};

	// Process single frame with optimizations
	const processFrame = async (videoElement, settings = {}) => {
		if (
			!model.value ||
			!processCtx.value ||
			!outputCtx.value ||
			!videoElement
		) {
			return null;
		}

		if (videoElement.readyState < 2) {
			return null;
		}

		// Frame rate limiting with skip logic
		const now = performance.now();
		if (now - lastFrameTime.value < frameInterval.value) {
			skipFrameCount.value++;
			if (skipFrameCount.value < 2) {
				return outputCanvas.value; // Return previous frame
			}
		}
		lastFrameTime.value = now;
		skipFrameCount.value = 0;

		try {
			const { videoWidth, videoHeight } = videoElement;

			// Resize canvases if needed (optimized)
			initializeCanvas(videoWidth, videoHeight);

			// Draw video frame to processing canvas
			processCtx.value.clearRect(0, 0, videoWidth, videoHeight);
			processCtx.value.drawImage(videoElement, 0, 0);

			// Get person segmentation using BodyPix
			const segmentation = await model.value.segmentPerson(videoElement, {
				flipHorizontal: flipHorizontal.value,
				internalResolution: internalResolution.value,
				segmentationThreshold: 0.7, // Use higher threshold for person detection
				maxDetections: 1,
				scoreThreshold: 0.5,
			});

			if (!segmentation || !segmentation.data) {
				return null;
			}

			// Get image data from processing canvas
			const imageData = processCtx.value.getImageData(
				0,
				0,
				videoWidth,
				videoHeight
			);
			const pixels = imageData.data;
			const segmentationMask = segmentation.data;

			// Arka plan tipi ve rengi
			const bgType = settings.backgroundType || "transparent";
			const bgColor = settings.backgroundColor || "#000000";
			let bgR = 0,
				bgG = 0,
				bgB = 0;
			if (bgType === "color") {
				const hex = bgColor.replace("#", "");
				bgR = parseInt(hex.substring(0, 2), 16);
				bgG = parseInt(hex.substring(2, 4), 16);
				bgB = parseInt(hex.substring(4, 6), 16);
			}

			// Apply background removal with smooth transparency or color
			const threshold = segmentationThreshold.value;
			for (let i = 0; i < segmentationMask.length; i++) {
				const pixelIndex = i * 4;
				const isPersonPixel = segmentationMask[i];

				if (!isPersonPixel) {
					if (bgType === "color") {
						pixels[pixelIndex] = bgR;
						pixels[pixelIndex + 1] = bgG;
						pixels[pixelIndex + 2] = bgB;
						pixels[pixelIndex + 3] = 128; // Semi-transparent
					} else {
						pixels[pixelIndex + 3] = 0;
					}
				} else {
					const alpha =
						threshold < 0.5
							? Math.min(255, 180 + threshold * 150) // Softer edges for low threshold
							: 255; // Sharp edges for high threshold
					pixels[pixelIndex + 3] = alpha;
				}
			}

			// Clear output canvas completely (transparent background)
			outputCtx.value.clearRect(0, 0, videoWidth, videoHeight);

			// Only draw person pixels with transparency or color
			outputCtx.value.putImageData(imageData, 0, 0);

			// Update performance metrics (simplified)
			processedFrameCount.value++;

			return outputCanvas.value;
		} catch (error) {
			return null;
		}
	};

	// Start continuous processing with FPS control
	// onFirstFrame: callback to be called when first frame is processed
	// onFrameProcessed: callback to be called when each frame is processed
	const startProcessing = (onFirstFrame, onFrameProcessed) => {
		if (isProcessing.value) return;

		isProcessing.value = true;
		lastFrameTime.value = performance.now();

		let firstFrame = true;

		const processLoop = (videoElement, callback) => {
			if (!isProcessing.value) {
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
					if (firstFrame && processedCanvas) {
						firstFrame = false;
						if (typeof onFirstFrame === "function") {
							onFirstFrame();
						}
					}
					if (processedCanvas && callback) {
						callback(processedCanvas);
					}
					// Call callback for canvas update when each frame is processed
					if (processedCanvas && typeof onFrameProcessed === "function") {
						onFrameProcessed();
					}
					lastFrameTime.value = currentTime - (elapsed % frameInterval.value);
				});
			}

			animationFrameId.value = requestAnimationFrame(() =>
				processLoop(videoElement, callback)
			);
		};

		return processLoop;
	};

	// Stop processing
	const stopProcessing = () => {
		isProcessing.value = false;
		if (animationFrameId.value) {
			cancelAnimationFrame(animationFrameId.value);
			animationFrameId.value = null;
		}
	};

	// Update settings
	const updateSettings = (settings) => {
		if (
			typeof settings.segmentationThreshold === "number" &&
			settings.segmentationThreshold >= 0 &&
			settings.segmentationThreshold <= 1
		) {
			segmentationThreshold.value = settings.segmentationThreshold;
		}

		if (typeof settings.flipHorizontal === "boolean") {
			flipHorizontal.value = settings.flipHorizontal;
		}

		if (
			typeof settings.internalResolution === "string" &&
			["low", "medium", "high"].includes(settings.internalResolution)
		) {
			internalResolution.value = settings.internalResolution;
		}

		if (
			typeof settings.targetFps === "number" &&
			settings.targetFps >= 15 &&
			settings.targetFps <= 60
		) {
			targetFps.value = settings.targetFps;
		}
	};

	// Get metrics (simplified)
	const getMetrics = () => ({
		processedFrames: processedFrameCount.value,
		isInitialized: isInitialized.value,
		isProcessing: isProcessing.value,
	});

	// Cleanup
	const cleanup = () => {
		stopProcessing();

		if (model.value && typeof model.value.dispose === "function") {
			model.value.dispose();
		}

		model.value = null;
		isInitialized.value = false;
		processedFrameCount.value = 0;

		// Clean up canvases
		if (processCanvas.value) {
			processCanvas.value.width = 0;
			processCanvas.value.height = 0;
		}
		if (outputCanvas.value) {
			outputCanvas.value.width = 0;
			outputCanvas.value.height = 0;
		}

		processCanvas.value = null;
		processCtx.value = null;
		outputCanvas.value = null;
		outputCtx.value = null;
	};

	// Cleanup on unmount
	onUnmounted(() => {
		cleanup();
	});

	return {
		// State
		isInitialized,
		isProcessing,
		model,

		// Methods
		initialize,
		processFrame,
		startProcessing,
		stopProcessing,
		updateSettings,
		getMetrics,
		cleanup,

		// Settings (readonly)
		segmentationThreshold: computed(() => segmentationThreshold.value),
		internalResolution: computed(() => internalResolution.value),
		targetFps: computed(() => targetFps.value),
	};
};
