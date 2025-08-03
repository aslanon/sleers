import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useOffscreenRenderer } from "./useOffscreenRenderer";

export const useGifOffscreen = () => {
	const {
		CANVAS_TYPES,
		isSupported,
		createGifRenderer
	} = useOffscreenRenderer();

	// GIF offscreen renderers
	const gifRenderer = ref(null);
	const gifCompositeRenderer = ref(null);
	
	// GIF processing state
	const activeGifs = ref(new Map());
	const gifFrameCache = ref(new Map());
	
	// Performance tracking
	const renderTime = ref(0);
	const compositeTime = ref(0);
	const cacheHits = ref(0);
	const cacheMisses = ref(0);

	// Initialize GIF renderers
	const initializeGifRenderers = (width, height) => {
		if (!isSupported.value) {
			console.log("[GifOffscreen] OffscreenCanvas not supported, using fallback");
			return false;
		}

		try {
			// Main GIF renderer
			gifRenderer.value = createGifRenderer(width, height);
			
			// Composite renderer for multiple GIFs
			gifCompositeRenderer.value = createOffscreenCanvas(CANVAS_TYPES.GIF + "_composite", {
				width,
				height,
				useWorker: false // Composite better on main thread
			});

			console.log("[GifOffscreen] GIF renderers initialized", {
				gif: !!gifRenderer.value,
				composite: !!gifCompositeRenderer.value
			});

			return true;
		} catch (error) {
			console.error("[GifOffscreen] Failed to initialize renderers:", error);
			return false;
		}
	};

	// Register a GIF for offscreen processing
	const registerGif = (gifId, gifData) => {
		const {
			element,
			x = 0,
			y = 0,
			width = 100,
			height = 100,
			rotation = 0,
			scale = 1,
			opacity = 1,
			visible = true,
			loop = true,
			startTime = 0,
			endTime = null
		} = gifData;

		activeGifs.value.set(gifId, {
			element,
			x, y, width, height,
			rotation, scale, opacity, visible,
			loop, startTime, endTime,
			lastFrameTime: 0,
			frameCount: 0
		});

		console.log(`[GifOffscreen] Registered GIF: ${gifId}`, gifData);
	};

	// Unregister a GIF
	const unregisterGif = (gifId) => {
		activeGifs.value.delete(gifId);
		
		// Clear related cache entries
		for (const [cacheKey] of gifFrameCache.value) {
			if (cacheKey.startsWith(gifId)) {
				gifFrameCache.value.delete(cacheKey);
			}
		}

		console.log(`[GifOffscreen] Unregistered GIF: ${gifId}`);
	};

	// Update GIF properties
	const updateGif = (gifId, updates) => {
		const gif = activeGifs.value.get(gifId);
		if (gif) {
			Object.assign(gif, updates);
		}
	};

	// Generate cache key for GIF frame
	const generateGifCacheKey = (gifId, frameTime, width, height, rotation, scale) => {
		return `${gifId}_${frameTime.toFixed(2)}_${width}_${height}_${rotation.toFixed(2)}_${scale.toFixed(2)}`;
	};

	// Render single GIF frame
	const renderGifFrame = async (gifId, currentTime) => {
		const gif = activeGifs.value.get(gifId);
		if (!gif || !gif.visible || !gif.element) {
			return null;
		}

		const startTime = performance.now();

		// Check if GIF should be visible at current time
		const relativeTime = currentTime - gif.startTime;
		if (relativeTime < 0 || (gif.endTime && currentTime > gif.endTime)) {
			return null;
		}

		// Check cache first
		const cacheKey = generateGifCacheKey(
			gifId, 
			relativeTime, 
			gif.width, 
			gif.height, 
			gif.rotation, 
			gif.scale
		);
		
		const cached = gifFrameCache.value.get(cacheKey);
		if (cached) {
			cacheHits.value++;
			return cached;
		}

		cacheMisses.value++;

		if (!gifRenderer.value) {
			return null;
		}

		const ctx = gifRenderer.value.context;
		const { width: canvasWidth, height: canvasHeight } = gifRenderer.value.canvas;

		try {
			// Clear GIF canvas
			ctx.clearRect(0, 0, canvasWidth, canvasHeight);

			// Calculate GIF dimensions
			const gifWidth = gif.width * gif.scale;
			const gifHeight = gif.height * gif.scale;

			// Save context for transforms
			ctx.save();

			// Set opacity
			ctx.globalAlpha = gif.opacity;

			// Move to GIF position
			ctx.translate(gif.x + gifWidth / 2, gif.y + gifHeight / 2);

			// Apply rotation
			if (gif.rotation !== 0) {
				ctx.rotate(gif.rotation);
			}

			// Move back to draw position
			ctx.translate(-gifWidth / 2, -gifHeight / 2);

			// Draw GIF frame
			if (gif.element.readyState >= 2) {
				ctx.drawImage(gif.element, 0, 0, gifWidth, gifHeight);
			}

			ctx.restore();

			// Create cache entry
			const cacheCanvas = document.createElement('canvas');
			cacheCanvas.width = Math.ceil(gifWidth + 20); // Extra padding
			cacheCanvas.height = Math.ceil(gifHeight + 20);
			const cacheCtx = cacheCanvas.getContext('2d');
			
			// Copy rendered GIF to cache
			const sourceX = Math.max(0, gif.x - 10);
			const sourceY = Math.max(0, gif.y - 10);
			const sourceWidth = Math.min(canvasWidth - sourceX, cacheCanvas.width);
			const sourceHeight = Math.min(canvasHeight - sourceY, cacheCanvas.height);
			
			cacheCtx.drawImage(
				gifRenderer.value.canvas,
				sourceX, sourceY, sourceWidth, sourceHeight,
				0, 0, sourceWidth, sourceHeight
			);
			
			gifFrameCache.value.set(cacheKey, cacheCanvas);
			
			// Limit cache size
			if (gifFrameCache.value.size > 100) {
				const firstKey = gifFrameCache.value.keys().next().value;
				gifFrameCache.value.delete(firstKey);
			}

			// Update GIF stats
			gif.lastFrameTime = currentTime;
			gif.frameCount++;

			renderTime.value = performance.now() - startTime;
			return cacheCanvas;

		} catch (error) {
			console.error(`[GifOffscreen] GIF render error for ${gifId}:`, error);
			return null;
		}
	};

	// Render all active GIFs
	const renderAllGifs = async (currentTime) => {
		if (!gifCompositeRenderer.value || activeGifs.value.size === 0) {
			return null;
		}

		const compositeStartTime = performance.now();
		const ctx = gifCompositeRenderer.value.context;
		const { width, height } = gifCompositeRenderer.value.canvas;

		try {
			// Clear composite canvas
			ctx.clearRect(0, 0, width, height);

			// Render each active GIF
			const gifPromises = Array.from(activeGifs.value.keys()).map(async (gifId) => {
				const renderedGif = await renderGifFrame(gifId, currentTime);
				return { gifId, canvas: renderedGif };
			});

			const renderedGifs = await Promise.all(gifPromises);

			// Composite all GIFs
			renderedGifs.forEach(({ gifId, canvas }) => {
				if (canvas) {
					const gif = activeGifs.value.get(gifId);
					if (gif) {
						ctx.drawImage(canvas, gif.x - 10, gif.y - 10); // Account for cache padding
					}
				}
			});

			compositeTime.value = performance.now() - compositeStartTime;
			return gifCompositeRenderer.value.canvas;

		} catch (error) {
			console.error("[GifOffscreen] Composite render error:", error);
			return null;
		}
	};

	// Get GIF at specific position (for interaction)
	const getGifAtPosition = (x, y) => {
		for (const [gifId, gif] of activeGifs.value) {
			if (!gif.visible) continue;

			const gifWidth = gif.width * gif.scale;
			const gifHeight = gif.height * gif.scale;

			if (x >= gif.x && x <= gif.x + gifWidth &&
				y >= gif.y && y <= gif.y + gifHeight) {
				return { gifId, gif };
			}
		}
		return null;
	};

	// Clear GIF cache
	const clearGifCache = () => {
		gifFrameCache.value.clear();
		cacheHits.value = 0;
		cacheMisses.value = 0;
	};

	// Resize GIF renderers
	const resizeGifRenderers = (newWidth, newHeight) => {
		if (gifRenderer.value) {
			gifRenderer.value.canvas.width = newWidth;
			gifRenderer.value.canvas.height = newHeight;
		}
		if (gifCompositeRenderer.value) {
			gifCompositeRenderer.value.canvas.width = newWidth;
			gifCompositeRenderer.value.canvas.height = newHeight;
		}
		
		// Clear cache on resize
		clearGifCache();
	};

	// Get GIF performance stats
	const getGifPerformanceStats = () => {
		const totalRequests = cacheHits.value + cacheMisses.value;
		const cacheHitRatio = totalRequests > 0 ? (cacheHits.value / totalRequests) * 100 : 0;

		return {
			renderTime: renderTime.value,
			compositeTime: compositeTime.value,
			activeGifCount: activeGifs.value.size,
			cacheHits: cacheHits.value,
			cacheMisses: cacheMisses.value,
			cacheHitRatio: Math.round(cacheHitRatio),
			cacheSize: gifFrameCache.value.size,
			isOffscreen: isSupported.value
		};
	};

	// Preload GIF frames for smooth playback
	const preloadGifFrames = async (gifId, duration = 5) => {
		const gif = activeGifs.value.get(gifId);
		if (!gif) return;

		const frameRate = 30; // Assume 30 FPS
		const totalFrames = Math.ceil(duration * frameRate);
		
		console.log(`[GifOffscreen] Preloading ${totalFrames} frames for GIF: ${gifId}`);

		for (let i = 0; i < totalFrames; i++) {
			const frameTime = (i / frameRate) + gif.startTime;
			await renderGifFrame(gifId, frameTime);
		}

		console.log(`[GifOffscreen] Preloaded ${totalFrames} frames for GIF: ${gifId}`);
	};

	// Cleanup resources
	const cleanup = () => {
		clearGifCache();
		activeGifs.value.clear();
		
		if (gifRenderer.value?.destroy) {
			gifRenderer.value.destroy();
		}
		if (gifCompositeRenderer.value?.destroy) {
			gifCompositeRenderer.value.destroy();
		}
	};

	// Cleanup on unmount
	onUnmounted(() => {
		cleanup();
	});

	return {
		// Core functions
		initializeGifRenderers,
		registerGif,
		unregisterGif,
		updateGif,
		renderGifFrame,
		renderAllGifs,
		resizeGifRenderers,
		
		// Interaction
		getGifAtPosition,
		
		// Optimization
		preloadGifFrames,
		clearGifCache,
		
		// Performance
		getGifPerformanceStats,
		
		// State
		activeGifs,
		isSupported,
		
		// Cleanup
		cleanup,
		
		// Renderers (for debugging)
		gifRenderer,
		gifCompositeRenderer
	};
};