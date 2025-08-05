import { ref, computed, watch, onMounted, onUnmounted } from "vue";

export const useOffscreenRenderer = () => {
	// Offscreen canvas registry
	const offscreenCanvases = ref(new Map());
	const workers = ref(new Map());
	const isSupported = ref(false);

	// Canvas types
	const CANVAS_TYPES = {
		VIDEO: "video",
		CAMERA: "camera", 
		CURSOR: "cursor",
		GIF: "gif",
		BLUR: "blur",
		BACKGROUND: "background"
	};

	// Check OffscreenCanvas support
	onMounted(() => {
		isSupported.value = typeof OffscreenCanvas !== "undefined" && 
			typeof Worker !== "undefined";
		
		if (!isSupported.value) {
			console.warn("[OffscreenRenderer] OffscreenCanvas not supported, fallback to main thread");
		}
	});

	// Create offscreen canvas with worker
	const createOffscreenCanvas = (type, options = {}) => {
		const {
			width = 1920,
			height = 1080,
			useWorker = true,
			workerScript = null
		} = options;

		if (!isSupported.value || !useWorker) {
			// Fallback to regular canvas
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			
			const context = canvas.getContext("2d", {
				alpha: true,
				desynchronized: true,
				willReadFrequently: false
			});

			const renderer = {
				canvas,
				context,
				isOffscreen: false,
				transfer: null,
				postMessage: null,
				destroy: () => {}
			};

			offscreenCanvases.value.set(type, renderer);
			return renderer;
		}

		try {
			// Create OffscreenCanvas
			const offscreenCanvas = new OffscreenCanvas(width, height);
			const context = offscreenCanvas.getContext("2d", {
				alpha: true,
				desynchronized: true,
				willReadFrequently: false
			});

			let worker = null;
			if (workerScript) {
				// Create worker for heavy operations
				worker = new Worker(workerScript);
				workers.value.set(type, worker);
			}

			const renderer = {
				canvas: offscreenCanvas,
				context,
				isOffscreen: true,
				worker,
				// Transfer canvas to worker
				transfer: (canvas) => {
					if (worker && canvas.transferControlToOffscreen) {
						const offscreen = canvas.transferControlToOffscreen();
						worker.postMessage({ canvas: offscreen }, [offscreen]);
						return offscreen;
					}
					return canvas;
				},
				// Post message to worker
				postMessage: (data) => {
					if (worker) {
						worker.postMessage(data);
					}
				},
				// Destroy resources
				destroy: () => {
					if (worker) {
						worker.terminate();
						workers.value.delete(type);
					}
					offscreenCanvases.value.delete(type);
				}
			};

			offscreenCanvases.value.set(type, renderer);
			return renderer;

		} catch (error) {
			console.warn(`[OffscreenRenderer] Failed to create offscreen canvas for ${type}:`, error);
			
			// Fallback to regular canvas
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			const context = canvas.getContext("2d");

			const renderer = {
				canvas,
				context,
				isOffscreen: false,
				transfer: null,
				postMessage: null,
				destroy: () => {}
			};

			offscreenCanvases.value.set(type, renderer);
			return renderer;
		}
	};

	// Get renderer by type
	const getRenderer = (type) => {
		return offscreenCanvases.value.get(type);
	};

	// Create optimized video renderer
	const createVideoRenderer = (width, height) => {
		return createOffscreenCanvas(CANVAS_TYPES.VIDEO, {
			width,
			height,
			useWorker: false // Video rendering better on main thread for now
		});
	};

	// Create optimized camera renderer  
	const createCameraRenderer = (width, height) => {
		return createOffscreenCanvas(CANVAS_TYPES.CAMERA, {
			width,
			height,
			useWorker: false // Camera streaming better on main thread
		});
	};

	// Create optimized cursor renderer with blur support
	const createCursorRenderer = (width, height) => {
		return createOffscreenCanvas(CANVAS_TYPES.CURSOR, {
			width,
			height,
			useWorker: true,
			workerScript: "/workers/cursor-worker.js"
		});
	};


	// Create optimized GIF renderer
	const createGifRenderer = (width, height) => {
		return createOffscreenCanvas(CANVAS_TYPES.GIF, {
			width,
			height,
			useWorker: true,
			workerScript: "/workers/gif-worker.js"
		});
	};

	// Create optimized blur renderer for effects
	const createBlurRenderer = (width, height) => {
		return createOffscreenCanvas(CANVAS_TYPES.BLUR, {
			width,
			height,
			useWorker: true,
			workerScript: "/workers/blur-worker.js"
		});
	};

	// Composite multiple offscreen canvases to main canvas
	const compositeToCanvas = (mainCtx, layers = []) => {
		// Clear main canvas
		mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);

		// Draw layers in order
		layers.forEach(layer => {
			const { renderer, x = 0, y = 0, opacity = 1, blendMode = "source-over" } = layer;
			
			if (!renderer || !renderer.canvas) return;

			mainCtx.save();
			mainCtx.globalAlpha = opacity;
			mainCtx.globalCompositeOperation = blendMode;
			
			try {
				mainCtx.drawImage(renderer.canvas, x, y);
			} catch (error) {
				console.warn("[OffscreenRenderer] Failed to composite layer:", error);
			}
			
			mainCtx.restore();
		});
	};

	// Resize offscreen canvas
	const resizeRenderer = (type, width, height) => {
		const renderer = getRenderer(type);
		if (!renderer) return;

		try {
			renderer.canvas.width = width;
			renderer.canvas.height = height;
			
			// Reconfigure context if needed
			if (renderer.context) {
				renderer.context.imageSmoothingEnabled = true;
				renderer.context.imageSmoothingQuality = "high";
			}
		} catch (error) {
			console.warn(`[OffscreenRenderer] Failed to resize ${type}:`, error);
		}
	};

	// Optimize rendering pipeline
	const createRenderPipeline = (config) => {
		const {
			mainCanvas,
			layers = [],
			fps = 60,
			adaptive = true
		} = config;

		if (!mainCanvas) {
			throw new Error("Main canvas is required for render pipeline");
		}

		const mainCtx = mainCanvas.getContext("2d");
		let animationId = null;
		let lastTime = 0;
		const frameTime = 1000 / fps;

		const render = (currentTime) => {
			if (currentTime - lastTime >= frameTime) {
				// Composite all layers
				compositeToCanvas(mainCtx, layers);
				lastTime = currentTime;
			}

			if (animationId !== null) {
				animationId = requestAnimationFrame(render);
			}
		};

		return {
			start: () => {
				if (animationId === null) {
					animationId = requestAnimationFrame(render);
				}
			},
			stop: () => {
				if (animationId !== null) {
					cancelAnimationFrame(animationId);
					animationId = null;
				}
			},
			updateLayers: (newLayers) => {
				layers.splice(0, layers.length, ...newLayers);
			}
		};
	};

	// Performance monitoring
	const stats = ref({
		frameCount: 0,
		averageFrameTime: 0,
		lastFrameTime: 0
	});

	// Cleanup on unmount
	onUnmounted(() => {
		// Destroy all renderers
		offscreenCanvases.value.forEach((renderer) => {
			renderer.destroy();
		});
		offscreenCanvases.value.clear();

		// Terminate all workers
		workers.value.forEach((worker) => {
			worker.terminate();
		});
		workers.value.clear();
	});

	return {
		// Canvas types
		CANVAS_TYPES,
		
		// Core functions
		isSupported,
		createOffscreenCanvas,
		getRenderer,
		
		// Specialized renderers
		createVideoRenderer,
		createCameraRenderer,
		createCursorRenderer,
		createGifRenderer,
		createBlurRenderer,
		
		// Composition
		compositeToCanvas,
		resizeRenderer,
		createRenderPipeline,
		
		// State
		offscreenCanvases,
		workers,
		stats
	};
};