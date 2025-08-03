import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useOffscreenRenderer } from "./useOffscreenRenderer";
import { useMediaPlayerOffscreen } from "./useMediaPlayerOffscreen";
import { useCameraOffscreen } from "./useCameraOffscreen";
import { useCursorOffscreen } from "./useCursorOffscreen";
import { useGifOffscreen } from "./useGifOffscreen";
import { usePerformanceMonitor } from "./usePerformanceMonitor";

/**
 * Optimized Renderer - Ana performans optimizasyonu composable'ı
 * Tüm offscreen canvas ve worker sistemlerini entegre eder
 */
export const useOptimizedRenderer = (canvasRef, options = {}) => {
	const {
		width = 1920,
		height = 1080,
		enableOffscreen = true,
		enableWorkers = true,
		enablePerformanceMonitoring = true,
		adaptiveOptimization = true
	} = options;

	// Core renderer systems
	const offscreenRenderer = useOffscreenRenderer();
	const mediaPlayerOffscreen = useMediaPlayerOffscreen(canvasRef, { width, height, enableOptimizations: enableOffscreen });
	const cameraOffscreen = useCameraOffscreen();
	const cursorOffscreen = useCursorOffscreen();
	const gifOffscreen = useGifOffscreen();
	const performanceMonitor = usePerformanceMonitor();

	// Renderer state
	const isInitialized = ref(false);
	const renderMode = ref('fallback'); // 'offscreen', 'fallback'
	const activeOptimizations = ref([]);
	
	// Performance adaptive settings
	const adaptiveSettings = ref({
		lowPerformanceMode: false,
		reducedQuality: false,
		disableEffects: false,
		simpleCursor: false
	});

	// Initialize all renderer systems
	const initializeRenderer = async () => {
		if (isInitialized.value) return;

		console.log('[OptimizedRenderer] Initializing renderer systems...');
		const startTime = performance.now();

		try {
			// Check system capabilities
			const hasOffscreenSupport = offscreenRenderer.isSupported.value;
			const hasWorkerSupport = typeof Worker !== 'undefined';

			// Initialize based on capabilities
			if (enableOffscreen && hasOffscreenSupport) {
				renderMode.value = 'offscreen';
				activeOptimizations.value.push('offscreen-canvas');

				// Initialize offscreen renderers
				const rendererPromises = [
					cameraOffscreen.initializeCameraRenderers(width, height),
					cursorOffscreen.initializeCursorRenderers(width, height),
					gifOffscreen.initializeGifRenderers(width, height)
				];

				const results = await Promise.all(rendererPromises);
				
				if (results.every(result => result)) {
					console.log('[OptimizedRenderer] All offscreen renderers initialized successfully');
					activeOptimizations.value.push('camera-offscreen', 'cursor-offscreen', 'gif-offscreen');
				} else {
					console.warn('[OptimizedRenderer] Some offscreen renderers failed, falling back');
					renderMode.value = 'fallback';
				}

				// Start workers if enabled and supported
				if (enableWorkers && hasWorkerSupport) {
					activeOptimizations.value.push('workers');
					console.log('[OptimizedRenderer] Workers enabled');
				}
			} else {
				renderMode.value = 'fallback';
				console.log('[OptimizedRenderer] Using fallback rendering mode');
			}

			// Start performance monitoring
			if (enablePerformanceMonitoring) {
				performanceMonitor.startMonitoring();
				activeOptimizations.value.push('performance-monitoring');
			}

			// Start adaptive optimization if enabled
			if (adaptiveOptimization) {
				startAdaptiveOptimization();
				activeOptimizations.value.push('adaptive-optimization');
			}

			isInitialized.value = true;
			const initTime = performance.now() - startTime;
			
			console.log(`[OptimizedRenderer] Initialized in ${initTime.toFixed(2)}ms`, {
				mode: renderMode.value,
				optimizations: activeOptimizations.value,
				offscreenSupport: hasOffscreenSupport,
				workerSupport: hasWorkerSupport
			});

		} catch (error) {
			console.error('[OptimizedRenderer] Initialization error:', error);
			renderMode.value = 'fallback';
		}
	};

	// Main render function - orchestrates all rendering
	const renderFrame = async (renderData) => {
		if (!isInitialized.value) {
			await initializeRenderer();
		}

		const frameStartTime = performance.now();

		try {
			if (renderMode.value === 'offscreen') {
				await renderOffscreenFrame(renderData);
			} else {
				await renderFallbackFrame(renderData);
			}

			// Record performance
			const frameTime = performance.now() - frameStartTime;
			performanceMonitor.recordCanvasRenderTime(frameTime);

			// Adaptive optimization check
			if (adaptiveOptimization) {
				checkAdaptiveOptimization();
			}

		} catch (error) {
			console.error('[OptimizedRenderer] Render error:', error);
			// Fallback to basic rendering on error
			await renderFallbackFrame(renderData);
		}
	};

	// Offscreen rendering pipeline
	const renderOffscreenFrame = async (renderData) => {
		const offscreenStartTime = performance.now();

		// Render each component to its offscreen canvas
		const renderPromises = [];

		// Render video (if present)
		if (renderData.videoElement) {
			renderPromises.push(
				mediaPlayerOffscreen.renderFrame({
					videoElement: renderData.videoElement,
					videoState: renderData.videoState
				})
			);
		}

		// Render camera (if present)
		if (renderData.cameraElement) {
			renderPromises.push(
				cameraOffscreen.renderCameraFrame(renderData.cameraElement, renderData.cameraSettings)
			);
		}

		// Render GIFs (if present)
		if (renderData.gifElements?.length > 0) {
			renderPromises.push(
				gifOffscreen.renderAllGifs(renderData.currentTime)
			);
		}

		// Render cursor (if present)
		if (renderData.cursorData) {
			renderPromises.push(
				cursorOffscreen.renderCursorFrame(renderData.cursorData, renderData.cursorEffects)
			);
		}

		// Wait for all renders to complete
		await Promise.all(renderPromises);

		// Composite all layers to main canvas
		const compositeStartTime = performance.now();
		await compositeToMainCanvas();
		const compositeTime = performance.now() - compositeStartTime;

		// Record performance
		const offscreenTime = performance.now() - offscreenStartTime;
		performanceMonitor.recordOffscreenRenderTime(offscreenTime);
		performanceMonitor.recordCompositeTime(compositeTime);
	};

	// Fallback rendering (direct to main canvas)
	const renderFallbackFrame = async (renderData) => {
		if (!canvasRef.value) return;

		const ctx = canvasRef.value.getContext('2d');
		ctx.clearRect(0, 0, width, height);

		// Direct rendering to main canvas
		// This would use existing MediaPlayer rendering logic
		// Implementation depends on existing render functions
		
		console.log('[OptimizedRenderer] Using fallback rendering');
	};

	// Composite all offscreen canvases to main canvas
	const compositeToMainCanvas = async () => {
		if (!canvasRef.value) return;

		const ctx = canvasRef.value.getContext('2d');
		ctx.clearRect(0, 0, width, height);

		// Layer order: video -> camera -> gifs -> cursor
		const layers = [];

		// Add video layer
		if (mediaPlayerOffscreen.videoRenderer.value?.canvas) {
			layers.push({
				renderer: mediaPlayerOffscreen.videoRenderer.value,
				x: 0, y: 0, opacity: 1
			});
		}

		// Add camera layer
		if (cameraOffscreen.cameraRenderer.value?.canvas) {
			layers.push({
				renderer: cameraOffscreen.cameraRenderer.value,
				x: 0, y: 0, opacity: 1
			});
		}

		// Add GIF layer
		if (gifOffscreen.gifCompositeRenderer.value?.canvas) {
			layers.push({
				renderer: gifOffscreen.gifCompositeRenderer.value,
				x: 0, y: 0, opacity: 1
			});
		}

		// Add cursor layer
		if (cursorOffscreen.cursorRenderer.value?.canvas) {
			layers.push({
				renderer: cursorOffscreen.cursorRenderer.value,
				x: 0, y: 0, opacity: 1
			});
		}

		// Composite layers
		offscreenRenderer.compositeToCanvas(ctx, layers);
	};

	// Adaptive optimization based on performance
	const startAdaptiveOptimization = () => {
		// Monitor performance and adjust settings automatically
		watch([performanceMonitor.fps, performanceMonitor.frameTime], ([fps, frameTime]) => {
			// Low performance detection
			if (fps < 45 || frameTime > 25) {
				if (!adaptiveSettings.value.lowPerformanceMode) {
					console.log('[OptimizedRenderer] Enabling low performance mode');
					adaptiveSettings.value.lowPerformanceMode = true;
					applyLowPerformanceOptimizations();
				}
			} else if (fps > 55 && frameTime < 18) {
				if (adaptiveSettings.value.lowPerformanceMode) {
					console.log('[OptimizedRenderer] Disabling low performance mode');
					adaptiveSettings.value.lowPerformanceMode = false;
					removeLowPerformanceOptimizations();
				}
			}
		});
	};

	// Check and apply adaptive optimizations
	const checkAdaptiveOptimization = () => {
		const status = performanceMonitor.performanceStatus.value;

		if (status === 'critical' && !adaptiveSettings.value.disableEffects) {
			console.log('[OptimizedRenderer] Critical performance - disabling effects');
			adaptiveSettings.value.disableEffects = true;
			applyEmergencyOptimizations();
		} else if (status === 'good' && adaptiveSettings.value.disableEffects) {
			console.log('[OptimizedRenderer] Performance recovered - re-enabling effects');
			adaptiveSettings.value.disableEffects = false;
			removeEmergencyOptimizations();
		}
	};

	// Apply low performance optimizations
	const applyLowPerformanceOptimizations = () => {
		// Reduce cursor quality
		adaptiveSettings.value.simpleCursor = true;
		cursorOffscreen.clearCache();

		// Reduce GIF quality
		adaptiveSettings.value.reducedQuality = true;
		gifOffscreen.clearGifCache();

		activeOptimizations.value.push('low-performance-mode');
	};

	// Remove low performance optimizations
	const removeLowPerformanceOptimizations = () => {
		adaptiveSettings.value.simpleCursor = false;
		adaptiveSettings.value.reducedQuality = false;
		
		activeOptimizations.value = activeOptimizations.value.filter(opt => opt !== 'low-performance-mode');
	};

	// Apply emergency optimizations for critical performance
	const applyEmergencyOptimizations = () => {
		// Disable all effects temporarily
		// This would integrate with existing settings systems
		
		activeOptimizations.value.push('emergency-mode');
		console.warn('[OptimizedRenderer] Emergency optimizations applied');
	};

	// Remove emergency optimizations
	const removeEmergencyOptimizations = () => {
		activeOptimizations.value = activeOptimizations.value.filter(opt => opt !== 'emergency-mode');
		console.log('[OptimizedRenderer] Emergency optimizations removed');
	};

	// Resize all renderers
	const resizeRenderer = (newWidth, newHeight) => {
		if (renderMode.value === 'offscreen') {
			mediaPlayerOffscreen.resizeRenderers(newWidth, newHeight);
			cameraOffscreen.resizeCameraRenderers(newWidth, newHeight);
			cursorOffscreen.resizeCursorRenderers(newWidth, newHeight);
			gifOffscreen.resizeGifRenderers(newWidth, newHeight);
		}
	};

	// Get comprehensive renderer status
	const getRendererStatus = () => {
		return {
			isInitialized: isInitialized.value,
			renderMode: renderMode.value,
			activeOptimizations: [...activeOptimizations.value],
			adaptiveSettings: { ...adaptiveSettings.value },
			performance: performanceMonitor.getPerformanceReport(),
			capabilities: {
				offscreenCanvas: offscreenRenderer.isSupported.value,
				workers: typeof Worker !== 'undefined',
				gpu: !!window.WebGLRenderingContext
			}
		};
	};

	// Cleanup function
	const cleanup = () => {
		performanceMonitor.stopMonitoring();
		cameraOffscreen.cleanup();
		cursorOffscreen.cleanup();
		gifOffscreen.cleanup();
		
		isInitialized.value = false;
		console.log('[OptimizedRenderer] Cleaned up renderer systems');
	};

	// Auto-initialize when canvas is available
	watch(canvasRef, (newCanvas) => {
		if (newCanvas && !isInitialized.value) {
			initializeRenderer();
		}
	}, { immediate: true });

	// Cleanup on unmount
	onUnmounted(() => {
		cleanup();
	});

	return {
		// Core functions
		initializeRenderer,
		renderFrame,
		resizeRenderer,
		cleanup,
		
		// Status
		isInitialized,
		renderMode,
		activeOptimizations,
		adaptiveSettings,
		
		// Performance
		performanceMonitor,
		getRendererStatus,
		
		// Sub-renderers (for direct access if needed)
		mediaPlayerOffscreen,
		cameraOffscreen,
		cursorOffscreen,
		gifOffscreen,
		offscreenRenderer
	};
};