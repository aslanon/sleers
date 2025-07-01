import { ref, computed, onUnmounted } from "vue";
import * as bodySegmentation from "@tensorflow-models/body-segmentation";
import "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";

export const useModernBackgroundRemoval = () => {
	// State
	const isLoading = ref(false);
	const isProcessing = ref(false);
	const model = ref(null);
	const segmenter = ref(null);
	const isInitialized = ref(false);

	// Settings
	const segmentationThreshold = ref(0.5);
	const internalResolution = ref("medium");
	const flipHorizontal = ref(false);
	const targetFps = ref(30);

	// Performance metrics (simplified)
	const loadDuration = ref(0);
	const processedFrames = ref(0);

	// Processing canvas - cached references
	const processingCanvas = ref(null);
	const processingCtx = ref(null);
	const lastCanvasSize = ref({ width: 0, height: 0 });

	// Frame timing optimization
	const frameInterval = computed(() => 1000 / targetFps.value);
	const lastFrameTime = ref(0);
	const pendingDisposals = ref([]);

	// Initialize canvas once and reuse
	const initProcessingCanvas = (width = 640, height = 480) => {
		// Only recreate if size changed significantly
		if (
			!processingCanvas.value ||
			Math.abs(lastCanvasSize.value.width - width) > 10 ||
			Math.abs(lastCanvasSize.value.height - height) > 10
		) {
			if (!processingCanvas.value) {
				processingCanvas.value = document.createElement("canvas");
			}
			processingCanvas.value.width = width;
			processingCanvas.value.height = height;
			processingCtx.value = processingCanvas.value.getContext("2d", {
				alpha: true,
				willReadFrequently: false,
				desynchronized: true,
			});
			lastCanvasSize.value = { width, height };
		}
	};

	// Batch dispose tensors to avoid blocking
	const scheduleDisposal = (tensor) => {
		pendingDisposals.value.push(tensor);
	};

	const processPendingDisposals = () => {
		if (pendingDisposals.value.length > 0) {
			const tensors = pendingDisposals.value.splice(0);
			requestIdleCallback(() => {
				tensors.forEach((tensor) => {
					try {
						if (tensor && typeof tensor.dispose === "function") {
							tensor.dispose();
						}
					} catch (e) {
						// Ignore disposal errors
					}
				});
			});
		}
	};

	// Load modern body segmentation model
	const loadModel = async () => {
		if (segmenter.value) return segmenter.value;

		isLoading.value = true;
		const startTime = performance.now();

		try {
			// MediaPipe SelfieSegmentation is faster and more accurate
			const modelConfig = {
				runtime: "mediapipe",
				solutionPath:
					"https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation",
				modelType: "general",
			};

			segmenter.value = await bodySegmentation.createSegmenter(
				bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation,
				modelConfig
			);

			const endTime = performance.now();
			loadDuration.value = endTime - startTime;

			return segmenter.value;
		} catch (error) {
			// Fallback to BodyPix if MediaPipe fails
			try {
				const bodyPixConfig = {
					architecture: "MobileNetV1",
					outputStride: 16,
					multiplier: 0.75,
					quantBytes: 2,
				};

				segmenter.value = await bodySegmentation.createSegmenter(
					bodySegmentation.SupportedModels.BodyPix,
					bodyPixConfig
				);

				const endTime = performance.now();
				loadDuration.value = endTime - startTime;

				return segmenter.value;
			} catch (fallbackError) {
				const endTime = performance.now();
				loadDuration.value = endTime - startTime;
				throw fallbackError;
			}
		} finally {
			isLoading.value = false;
		}
	};

	// Start background removal
	const startBackgroundRemoval = async () => {
		if (isProcessing.value) return;

		try {
			await loadModel();
			if (!segmenter.value) {
				throw new Error("Segmenter not loaded");
			}

			initProcessingCanvas();
			isProcessing.value = true;
			processedFrames.value = 0;
		} catch (error) {
			isProcessing.value = false;
			throw error;
		}
	};

	// Stop background removal
	const stopBackgroundRemoval = () => {
		isProcessing.value = false;
		processPendingDisposals();
	};

	// Process single frame with optimizations
	const processFrame = async (videoElement) => {
		if (
			!segmenter.value ||
			!isProcessing.value ||
			!videoElement ||
			!processingCtx.value
		) {
			return null;
		}

		if (videoElement.readyState < 2) {
			return null;
		}

		// Frame rate limiting
		const now = performance.now();
		if (now - lastFrameTime.value < frameInterval.value) {
			return processingCanvas.value;
		}
		lastFrameTime.value = now;

		try {
			const { videoWidth, videoHeight } = videoElement;

			// Update canvas size if needed (optimized)
			initProcessingCanvas(videoWidth, videoHeight);

			// Segment the image
			const segmentationConfig = {
				flipHorizontal: flipHorizontal.value,
			};

			const segmentations = await segmenter.value.segmentPeople(
				videoElement,
				segmentationConfig
			);

			if (!segmentations || segmentations.length === 0) {
				return null;
			}

			// Draw original frame
			processingCtx.value.clearRect(0, 0, videoWidth, videoHeight);
			processingCtx.value.drawImage(videoElement, 0, 0);

			// Get image data once
			const imageData = processingCtx.value.getImageData(
				0,
				0,
				videoWidth,
				videoHeight
			);
			const pixels = imageData.data;

			// Apply segmentation mask
			const segmentation = segmentations[0];
			const mask = segmentation.mask;
			const maskData = await mask.arraySync();

			// Apply background removal with smooth transparency
			const threshold = segmentationThreshold.value;
			for (let i = 0; i < maskData.length; i++) {
				const pixelIndex = i * 4;
				const confidence = maskData[i];

				if (confidence < threshold) {
					// Background pixel - make fully transparent
					pixels[pixelIndex + 3] = 0;
				} else {
					// Person pixel - apply confidence-based alpha for smoother edges
					const alpha = Math.min(
						255,
						Math.max(0, ((confidence - threshold) / (1 - threshold)) * 255)
					);
					pixels[pixelIndex + 3] = alpha;
				}
			}

			// Clear canvas completely and put transparent-processed image
			processingCtx.value.clearRect(0, 0, videoWidth, videoHeight);
			processingCtx.value.putImageData(imageData, 0, 0);

			// Update frame counter (simplified)
			processedFrames.value++;

			// Schedule tensor disposal for later
			scheduleDisposal(mask);

			// Process pending disposals periodically
			if (processedFrames.value % 10 === 0) {
				processPendingDisposals();
			}

			return processingCanvas.value;
		} catch (error) {
			return null;
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
			typeof settings.targetFps === "number" &&
			settings.targetFps >= 15 &&
			settings.targetFps <= 60
		) {
			targetFps.value = settings.targetFps;
		}
	};

	// Apply background removal to camera video (optimized)
	const applyBackgroundRemovalToCamera = async (input) => {
		if (!isInitialized.value || isLoading.value) {
			return null;
		}

		try {
			// Start background removal if not already started
			if (!isProcessing.value) {
				await startBackgroundRemoval();
			}

			// Create a video element if input is a video track
			let videoElement;
			if (input instanceof MediaStreamTrack) {
				videoElement = document.createElement("video");
				videoElement.srcObject = new MediaStream([input]);
				videoElement.autoplay = true;
				await new Promise((resolve) => {
					videoElement.onloadedmetadata = () => {
						videoElement.play().then(resolve);
					};
				});
			} else if (input instanceof HTMLVideoElement) {
				videoElement = input;
			} else {
				throw new Error("Invalid input: Expected video element or video track");
			}

			// Process the current frame
			const processedCanvas = await processFrame(videoElement);
			if (!processedCanvas) {
				throw new Error("Failed to process camera frame");
			}

			// Convert canvas to blob (optimized)
			const blob = await new Promise((resolve) => {
				processedCanvas.toBlob(resolve, "image/webp", 0.8);
			});

			// Create object URL
			const processedVideoUrl = URL.createObjectURL(blob);

			// Clean up temporary video element if we created one
			if (input instanceof MediaStreamTrack) {
				videoElement.srcObject = null;
			}

			return processedVideoUrl;
		} catch (error) {
			return null;
		}
	};

	// Cleanup
	const cleanup = () => {
		stopBackgroundRemoval();

		if (segmenter.value) {
			// Dispose of the segmenter
			if (segmenter.value.dispose) {
				segmenter.value.dispose();
			}
			segmenter.value = null;
		}

		if (processingCanvas.value) {
			processingCanvas.value.width = 0;
			processingCanvas.value.height = 0;
		}

		processingCanvas.value = null;
		processingCtx.value = null;

		// Clean up pending disposals
		processPendingDisposals();
		pendingDisposals.value = [];
	};

	// Cleanup on unmount
	onUnmounted(() => {
		cleanup();
	});

	return {
		// State
		isLoading,
		isProcessing,
		isInitialized,

		// Performance metrics (simplified)
		loadDuration,
		processedFrames,

		// Methods
		startBackgroundRemoval,
		stopBackgroundRemoval,
		processFrame,
		updateSettings,
		applyBackgroundRemovalToCamera,
		cleanup,
	};
};
