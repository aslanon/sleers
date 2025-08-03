import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useOffscreenRenderer } from "./useOffscreenRenderer";

export const useCameraOffscreen = () => {
	const {
		CANVAS_TYPES,
		isSupported,
		createCameraRenderer,
		createBlurRenderer
	} = useOffscreenRenderer();

	// Camera offscreen renderers
	const cameraRenderer = ref(null);
	const backgroundRemovalRenderer = ref(null);
	const blurRenderer = ref(null);
	
	// Camera processing options
	const processingOptions = ref({
		mirror: false,
		borderRadius: 0,
		backgroundRemoval: false,
		blur: false,
		size: 15, // percentage
		position: { x: 50, y: 50 },
		opacity: 1.0
	});

	// Performance tracking
	const frameProcessingTime = ref(0);
	const backgroundRemovalTime = ref(0);

	// Initialize camera renderers
	const initializeCameraRenderers = (width, height) => {
		if (!isSupported.value) {
			console.log("[CameraOffscreen] OffscreenCanvas not supported, using fallback");
			return false;
		}

		try {
			// Main camera renderer
			cameraRenderer.value = createCameraRenderer(width, height);
			
			// Background removal renderer (if needed)
			backgroundRemovalRenderer.value = createOffscreenCanvas(CANVAS_TYPES.CAMERA + "_bg", {
				width,
				height,
				useWorker: true,
				workerScript: "/workers/background-removal-worker.js"
			});

			// Blur effect renderer
			blurRenderer.value = createBlurRenderer(width, height);

			console.log("[CameraOffscreen] Camera renderers initialized", {
				camera: !!cameraRenderer.value,
				backgroundRemoval: !!backgroundRemovalRenderer.value,
				blur: !!blurRenderer.value
			});

			return true;
		} catch (error) {
			console.error("[CameraOffscreen] Failed to initialize renderers:", error);
			return false;
		}
	};

	// Render camera frame with all effects
	const renderCameraFrame = async (cameraElement, options = {}) => {
		const startTime = performance.now();

		if (!cameraRenderer.value || !cameraElement || cameraElement.readyState < 2) {
			return null;
		}

		// Merge options with defaults
		const settings = {
			...processingOptions.value,
			...options
		};

		const ctx = cameraRenderer.value.context;
		const { width, height } = cameraRenderer.value.canvas;

		try {
			// Clear camera canvas
			ctx.clearRect(0, 0, width, height);

			// Calculate camera dimensions
			const cameraSize = Math.min(width, height) * (settings.size / 100);
			const cameraX = (width * settings.position.x) / 100 - cameraSize / 2;
			const cameraY = (height * settings.position.y) / 100 - cameraSize / 2;

			// Save context for transforms
			ctx.save();

			// Set global opacity
			ctx.globalAlpha = settings.opacity;

			// Step 1: Background removal (if enabled)
			let sourceCanvas = cameraElement;
			if (settings.backgroundRemoval && backgroundRemovalRenderer.value) {
				sourceCanvas = await processBackgroundRemoval(cameraElement);
			}

			// Step 2: Apply blur (if enabled)
			if (settings.blur && blurRenderer.value) {
				sourceCanvas = await applyBlurEffect(sourceCanvas, settings.blurAmount || 5);
			}

			// Step 3: Apply mirror transform
			if (settings.mirror) {
				ctx.translate(cameraX + cameraSize, cameraY);
				ctx.scale(-1, 1);
				ctx.translate(-cameraX, -cameraY);
			}

			// Step 4: Apply border radius clipping
			if (settings.borderRadius > 0) {
				ctx.beginPath();
				ctx.roundRect(cameraX, cameraY, cameraSize, cameraSize, settings.borderRadius);
				ctx.clip();
			}

			// Step 5: Draw camera
			ctx.drawImage(sourceCanvas, cameraX, cameraY, cameraSize, cameraSize);

			ctx.restore();

			// Update performance metrics
			frameProcessingTime.value = performance.now() - startTime;

			return cameraRenderer.value.canvas;

		} catch (error) {
			console.error("[CameraOffscreen] Camera render error:", error);
			return null;
		}
	};

	// Process background removal using TensorFlow.js
	const processBackgroundRemoval = async (cameraElement) => {
		if (!backgroundRemovalRenderer.value) return cameraElement;

		const bgStartTime = performance.now();
		
		try {
			const ctx = backgroundRemovalRenderer.value.context;
			const { width, height } = backgroundRemovalRenderer.value.canvas;

			// Clear background removal canvas
			ctx.clearRect(0, 0, width, height);

			// If using worker for background removal
			if (backgroundRemovalRenderer.value.worker) {
				// Send frame to worker for processing
				return new Promise((resolve, reject) => {
					const canvas = document.createElement('canvas');
					canvas.width = cameraElement.videoWidth;
					canvas.height = cameraElement.videoHeight;
					const tempCtx = canvas.getContext('2d');
					tempCtx.drawImage(cameraElement, 0, 0);

					// Convert to ImageData for worker
					const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
					
					// Setup worker response handler
					const handleWorkerMessage = (event) => {
						if (event.data.type === 'background-removed') {
							// Put processed ImageData back to canvas
							ctx.putImageData(event.data.imageData, 0, 0);
							backgroundRemovalTime.value = performance.now() - bgStartTime;
							
							// Cleanup
							backgroundRemovalRenderer.value.worker.removeEventListener('message', handleWorkerMessage);
							resolve(backgroundRemovalRenderer.value.canvas);
						}
					};

					backgroundRemovalRenderer.value.worker.addEventListener('message', handleWorkerMessage);
					
					// Send to worker
					backgroundRemovalRenderer.value.worker.postMessage({
						type: 'process-background-removal',
						imageData: imageData,
						width: canvas.width,
						height: canvas.height
					});

					// Timeout fallback
					setTimeout(() => {
						backgroundRemovalRenderer.value.worker.removeEventListener('message', handleWorkerMessage);
						reject(new Error('Background removal timeout'));
					}, 100); // 100ms timeout
				});
			} else {
				// Direct processing (fallback)
				ctx.drawImage(cameraElement, 0, 0, width, height);
				backgroundRemovalTime.value = performance.now() - bgStartTime;
				return backgroundRemovalRenderer.value.canvas;
			}
		} catch (error) {
			console.error("[CameraOffscreen] Background removal error:", error);
			backgroundRemovalTime.value = performance.now() - bgStartTime;
			return cameraElement;
		}
	};

	// Apply blur effect
	const applyBlurEffect = async (sourceElement, blurAmount = 5) => {
		if (!blurRenderer.value) return sourceElement;

		try {
			const ctx = blurRenderer.value.context;
			const { width, height } = blurRenderer.value.canvas;

			// Clear blur canvas
			ctx.clearRect(0, 0, width, height);

			// Apply blur filter
			ctx.filter = `blur(${blurAmount}px)`;
			ctx.drawImage(sourceElement, 0, 0, width, height);
			ctx.filter = 'none';

			return blurRenderer.value.canvas;
		} catch (error) {
			console.error("[CameraOffscreen] Blur effect error:", error);
			return sourceElement;
		}
	};

	// Update camera settings
	const updateCameraSettings = (newSettings) => {
		processingOptions.value = {
			...processingOptions.value,
			...newSettings
		};
	};

	// Resize camera renderers
	const resizeCameraRenderers = (newWidth, newHeight) => {
		if (cameraRenderer.value) {
			cameraRenderer.value.canvas.width = newWidth;
			cameraRenderer.value.canvas.height = newHeight;
		}
		if (backgroundRemovalRenderer.value) {
			backgroundRemovalRenderer.value.canvas.width = newWidth;
			backgroundRemovalRenderer.value.canvas.height = newHeight;
		}
		if (blurRenderer.value) {
			blurRenderer.value.canvas.width = newWidth;
			blurRenderer.value.canvas.height = newHeight;
		}
	};

	// Get camera processing performance stats
	const getCameraPerformanceStats = () => {
		return {
			frameProcessingTime: frameProcessingTime.value,
			backgroundRemovalTime: backgroundRemovalTime.value,
			fps: frameProcessingTime.value > 0 ? Math.round(1000 / frameProcessingTime.value) : 0,
			isOffscreen: isSupported.value
		};
	};

	// Camera intersection detection for cursor avoidance
	const detectCameraIntersection = (cursorX, cursorY, cursorSize = 80) => {
		const settings = processingOptions.value;
		
		// Calculate camera bounds
		const cameraSize = 200 * (settings.size / 100); // Approximate camera size
		const cameraX = (window.innerWidth * settings.position.x) / 100 - cameraSize / 2;
		const cameraY = (window.innerHeight * settings.position.y) / 100 - cameraSize / 2;

		// Check intersection
		const cursorRadius = cursorSize / 2;
		const isIntersecting = 
			cursorX + cursorRadius >= cameraX &&
			cursorX - cursorRadius <= cameraX + cameraSize &&
			cursorY + cursorRadius >= cameraY &&
			cursorY - cursorRadius <= cameraY + cameraSize;

		return {
			isIntersecting,
			cameraX,
			cameraY,
			cameraSize,
			suggestedOffset: isIntersecting ? {
				x: cameraSize * 0.3,
				y: cameraSize * 0.3
			} : null
		};
	};

	// Cleanup resources
	const cleanup = () => {
		if (cameraRenderer.value?.destroy) {
			cameraRenderer.value.destroy();
		}
		if (backgroundRemovalRenderer.value?.destroy) {
			backgroundRemovalRenderer.value.destroy();
		}
		if (blurRenderer.value?.destroy) {
			blurRenderer.value.destroy();
		}
	};

	// Cleanup on unmount
	onUnmounted(() => {
		cleanup();
	});

	return {
		// Core functions
		initializeCameraRenderers,
		renderCameraFrame,
		updateCameraSettings,
		resizeCameraRenderers,
		
		// Effects
		processBackgroundRemoval,
		applyBlurEffect,
		
		// Interaction
		detectCameraIntersection,
		
		// Performance
		getCameraPerformanceStats,
		
		// State
		processingOptions,
		isSupported,
		
		// Cleanup
		cleanup,
		
		// Renderers (for debugging)
		cameraRenderer,
		backgroundRemovalRenderer,
		blurRenderer
	};
};