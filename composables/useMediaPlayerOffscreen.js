import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useOffscreenRenderer } from "./useOffscreenRenderer";
import { useHighQualityVideoZoom } from "./useHighQualityVideoZoom";

export const useMediaPlayerOffscreen = (canvasRef, options = {}) => {
	const {
		width = 1920,
		height = 1080,
		enableOptimizations = true
	} = options;

	// Get offscreen renderer
	const {
		CANVAS_TYPES,
		isSupported,
		createVideoRenderer,
		createCameraRenderer,
		createCursorRenderer,
		createGifRenderer,
		createBlurRenderer,
		createRenderPipeline,
		compositeToCanvas
	} = useOffscreenRenderer();

	// High-quality video zoom system
	const highQualityZoom = useHighQualityVideoZoom();

	// Offscreen renderers
	const videoRenderer = ref(null);
	const cameraRenderer = ref(null);
	const cursorRenderer = ref(null);
	const gifRenderer = ref(null);
	const blurRenderer = ref(null);
	
	// Main canvas context
	const mainCtx = ref(null);
	
	// Render pipeline
	const renderPipeline = ref(null);
	
	// Performance tracking
	const frameCount = ref(0);
	const lastFrameTime = ref(0);
	const averageFrameTime = ref(16.67); // 60fps baseline

	// Initialize offscreen renderers
	const initializeRenderers = () => {
		if (!canvasRef.value) {
			console.warn("[MediaPlayerOffscreen] Canvas ref not available");
			return;
		}

		// Get main canvas context
		mainCtx.value = canvasRef.value.getContext("2d", {
			alpha: true,
			desynchronized: true,
			willReadFrequently: false
		});

		if (!enableOptimizations || !isSupported.value) {
			console.log("[MediaPlayerOffscreen] Using fallback rendering");
			return;
		}

		// Create offscreen renderers
		videoRenderer.value = createVideoRenderer(width, height);
		cameraRenderer.value = createCameraRenderer(width, height);
		cursorRenderer.value = createCursorRenderer(width, height);
		gifRenderer.value = createGifRenderer(width, height);
		blurRenderer.value = createBlurRenderer(width, height);

		// Initialize high-quality zoom system
		highQualityZoom.initializeHighResCanvases(width, height);

		console.log("[MediaPlayerOffscreen] Offscreen renderers initialized", {
			video: !!videoRenderer.value,
			camera: !!cameraRenderer.value,
			cursor: !!cursorRenderer.value,
			gif: !!gifRenderer.value,
			blur: !!blurRenderer.value
		});

		// Create render pipeline
		createPipeline();
	};

	// Create optimized render pipeline
	const createPipeline = () => {
		if (!mainCtx.value) return;

		const layers = [
			{ renderer: videoRenderer.value, x: 0, y: 0, opacity: 1 },
			{ renderer: cameraRenderer.value, x: 0, y: 0, opacity: 1 },
			{ renderer: gifRenderer.value, x: 0, y: 0, opacity: 1 },
			{ renderer: cursorRenderer.value, x: 0, y: 0, opacity: 1 }
		];

		renderPipeline.value = createRenderPipeline({
			mainCanvas: canvasRef.value,
			layers: layers.filter(layer => layer.renderer),
			fps: 60,
			adaptive: true
		});

		console.log("[MediaPlayerOffscreen] Render pipeline created with", layers.length, "layers");
	};

	// Render video frame to offscreen canvas with high-quality zoom
	const renderVideoFrame = (videoElement, videoState, zoomLevel = 1.0, zoomOrigin = { x: 50, y: 50 }) => {
		if (!videoRenderer.value || !videoElement) return;

		const ctx = videoRenderer.value.context;
		if (!ctx || videoElement.readyState < 2) return;

		try {
			// Check if we need high-quality zoom rendering
			if (zoomLevel > 1.001) {
				// Use high-quality zoom system
				const highQualityResult = highQualityZoom.renderHighQualityVideo(
					videoElement, 
					zoomLevel, 
					zoomOrigin
				);

				if (highQualityResult) {
					// Apply zoom viewport to our video canvas
					ctx.clearRect(0, 0, width, height);
					
					const success = highQualityZoom.applyZoomViewport(
						highQualityResult.canvas,
						zoomLevel,
						zoomOrigin,
						videoRenderer.value.canvas
					);

					if (!success) {
						// Fallback to standard rendering
						renderVideoFrameStandard(videoElement, ctx);
					}
				} else {
					// Fallback to standard rendering
					renderVideoFrameStandard(videoElement, ctx);
				}
			} else {
				// Standard rendering for no zoom
				renderVideoFrameStandard(videoElement, ctx);
			}
		} catch (error) {
			console.warn("[MediaPlayerOffscreen] Video render error:", error);
			// Fallback to standard rendering
			renderVideoFrameStandard(videoElement, ctx);
		}
	};

	// Standard video rendering (fallback)
	const renderVideoFrameStandard = (videoElement, ctx) => {
		// Clear video canvas
		ctx.clearRect(0, 0, width, height);
		
		// Calculate video positioning
		const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
		const canvasAspect = width / height;
		
		let drawWidth, drawHeight, x, y;
		if (videoAspect > canvasAspect) {
			drawHeight = height;
			drawWidth = drawHeight * videoAspect;
			x = (width - drawWidth) / 2;
			y = 0;
		} else {
			drawWidth = width;
			drawHeight = drawWidth / videoAspect;
			x = 0;
			y = (height - drawHeight) / 2;
		}

		// Enhanced rendering settings
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';

		// Draw video to offscreen canvas
		ctx.drawImage(videoElement, x, y, drawWidth, drawHeight);
	};

	// Render camera frame to offscreen canvas
	const renderCameraFrame = (cameraElement, cameraSettings, cameraPosition) => {
		if (!cameraRenderer.value || !cameraElement) return;

		const ctx = cameraRenderer.value.context;
		if (!ctx || cameraElement.readyState < 2) return;

		try {
			// Clear camera canvas
			ctx.clearRect(0, 0, width, height);

			// Calculate camera dimensions and position
			const cameraSize = (width * cameraSettings.size) / 100;
			const x = cameraPosition?.x || 50;
			const y = cameraPosition?.y || 50;

			// Save context for transforms
			ctx.save();

			// Apply mirror if enabled
			if (cameraSettings.mirror) {
				ctx.translate(x + cameraSize, y);
				ctx.scale(-1, 1);
				ctx.translate(-x, -y);
			}

			// Draw camera with border radius if specified
			if (cameraSettings.borderRadius > 0) {
				ctx.beginPath();
				ctx.roundRect(x, y, cameraSize, cameraSize, cameraSettings.borderRadius);
				ctx.clip();
			}

			// Draw camera
			ctx.drawImage(cameraElement, x, y, cameraSize, cameraSize);

			ctx.restore();
		} catch (error) {
			console.warn("[MediaPlayerOffscreen] Camera render error:", error);
		}
	};

	// Render cursor to offscreen canvas
	const renderCursorFrame = (cursorData) => {
		if (!cursorRenderer.value || !cursorData) return;

		const ctx = cursorRenderer.value.context;
		if (!ctx) return;

		try {
			// Clear cursor canvas
			ctx.clearRect(0, 0, width, height);

			// Use cursor drawing logic from useMouseCursor
			// This would integrate with the existing cursor system
			if (cursorData.visible && cursorData.image) {
				ctx.save();
				
				// Apply cursor transforms
				ctx.translate(cursorData.x, cursorData.y);
				if (cursorData.rotation) ctx.rotate(cursorData.rotation);
				if (cursorData.scale !== 1) ctx.scale(cursorData.scale, cursorData.scale);
				
				// Draw cursor image
				ctx.drawImage(
					cursorData.image,
					-cursorData.hotspot.x,
					-cursorData.hotspot.y,
					cursorData.size,
					cursorData.size
				);
				
				ctx.restore();
			}
		} catch (error) {
			console.warn("[MediaPlayerOffscreen] Cursor render error:", error);
		}
	};

	// Render GIF frames to offscreen canvas
	const renderGifFrame = (gifElements) => {
		if (!gifRenderer.value || !gifElements?.length) return;

		const ctx = gifRenderer.value.context;
		if (!ctx) return;

		try {
			// Clear GIF canvas
			ctx.clearRect(0, 0, width, height);

			// Render each GIF element
			gifElements.forEach(gif => {
				if (gif.element && gif.element.readyState >= 2) {
					ctx.save();
					
					// Apply GIF positioning and transforms
					ctx.translate(gif.x, gif.y);
					if (gif.rotation) ctx.rotate(gif.rotation);
					if (gif.scale !== 1) ctx.scale(gif.scale, gif.scale);
					
					// Draw GIF
					ctx.drawImage(gif.element, 0, 0, gif.width, gif.height);
					
					ctx.restore();
				}
			});
		} catch (error) {
			console.warn("[MediaPlayerOffscreen] GIF render error:", error);
		}
	};

	// Render frame with all layers
	const renderFrame = (renderData) => {
		const startTime = performance.now();

		if (!enableOptimizations || !isSupported.value) {
			// Fallback to direct canvas rendering
			renderDirectToCanvas(renderData);
		} else {
			// Render to offscreen canvases with zoom support
			renderVideoFrame(
				renderData.videoElement, 
				renderData.videoState,
				renderData.zoomLevel || 1.0,
				renderData.zoomOrigin || { x: 50, y: 50 }
			);
			renderCameraFrame(renderData.cameraElement, renderData.cameraSettings, renderData.cameraPosition);
			renderCursorFrame(renderData.cursorData);
			renderGifFrame(renderData.gifElements);

			// Composite to main canvas happens automatically via pipeline
		}

		// Update performance stats
		const frameTime = performance.now() - startTime;
		frameCount.value++;
		lastFrameTime.value = frameTime;
		averageFrameTime.value = (averageFrameTime.value * 0.9) + (frameTime * 0.1);
	};

	// Fallback direct canvas rendering
	const renderDirectToCanvas = (renderData) => {
		if (!mainCtx.value) return;

		const ctx = mainCtx.value;
		
		// Clear canvas
		ctx.clearRect(0, 0, width, height);

		// Render video
		if (renderData.videoElement && renderData.videoElement.readyState >= 2) {
			// Direct video rendering logic here
		}

		// Render camera
		if (renderData.cameraElement && renderData.cameraElement.readyState >= 2) {
			// Direct camera rendering logic here
		}

		// Render GIFs
		if (renderData.gifElements?.length) {
			// Direct GIF rendering logic here
		}

		// Render cursor
		if (renderData.cursorData?.visible) {
			// Direct cursor rendering logic here
		}
	};

	// Start render pipeline
	const startRendering = () => {
		if (renderPipeline.value) {
			renderPipeline.value.start();
			console.log("[MediaPlayerOffscreen] Render pipeline started");
		}
	};

	// Stop render pipeline
	const stopRendering = () => {
		if (renderPipeline.value) {
			renderPipeline.value.stop();
			console.log("[MediaPlayerOffscreen] Render pipeline stopped");
		}
	};

	// Update layer opacity/visibility
	const updateLayerOpacity = (layerType, opacity) => {
		if (!renderPipeline.value) return;

		// Update layer opacity in pipeline
		// Implementation depends on render pipeline structure
	};

	// Resize all renderers
	const resizeRenderers = (newWidth, newHeight) => {
		if (videoRenderer.value) {
			videoRenderer.value.canvas.width = newWidth;
			videoRenderer.value.canvas.height = newHeight;
		}
		if (cameraRenderer.value) {
			cameraRenderer.value.canvas.width = newWidth;
			cameraRenderer.value.canvas.height = newHeight;
		}
		if (cursorRenderer.value) {
			cursorRenderer.value.canvas.width = newWidth;
			cursorRenderer.value.canvas.height = newHeight;
		}
		if (gifRenderer.value) {
			gifRenderer.value.canvas.width = newWidth;
			gifRenderer.value.canvas.height = newHeight;
		}
		if (blurRenderer.value) {
			blurRenderer.value.canvas.width = newWidth;
			blurRenderer.value.canvas.height = newHeight;
		}
	};

	// Performance metrics
	const getPerformanceStats = () => {
		return {
			frameCount: frameCount.value,
			lastFrameTime: lastFrameTime.value,
			averageFrameTime: averageFrameTime.value,
			fps: Math.round(1000 / averageFrameTime.value),
			isOffscreen: isSupported.value && enableOptimizations
		};
	};

	// Initialize when canvas is available
	watch(canvasRef, (newCanvas) => {
		if (newCanvas) {
			initializeRenderers();
		}
	}, { immediate: true });

	// Cleanup on unmount
	onUnmounted(() => {
		stopRendering();
		
		// Cleanup renderers
		if (videoRenderer.value?.destroy) videoRenderer.value.destroy();
		if (cameraRenderer.value?.destroy) cameraRenderer.value.destroy();
		if (cursorRenderer.value?.destroy) cursorRenderer.value.destroy();
		if (gifRenderer.value?.destroy) gifRenderer.value.destroy();
		if (blurRenderer.value?.destroy) blurRenderer.value.destroy();
	});

	return {
		// Core functions
		renderFrame,
		startRendering,
		stopRendering,
		resizeRenderers,
		
		// Layer control
		updateLayerOpacity,
		
		// Performance
		getPerformanceStats,
		
		// High-quality zoom
		highQualityZoom,
		
		// State
		isSupported,
		enableOptimizations,
		
		// Renderers (for debugging)
		videoRenderer,
		cameraRenderer,
		cursorRenderer,
		gifRenderer,
		blurRenderer
	};
};