import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useOffscreenRenderer } from "./useOffscreenRenderer";
import { useCursorPositioning } from "./useCursorPositioning";

export const useCursorOffscreen = () => {
	const {
		CANVAS_TYPES,
		isSupported,
		createCursorRenderer,
		createBlurRenderer
	} = useOffscreenRenderer();

	// Cursor positioning system
	const positioning = useCursorPositioning();

	// Cursor offscreen renderers
	const cursorRenderer = ref(null);
	const blurRenderer = ref(null);
	const trailRenderer = ref(null);
	
	// Cursor cache for different states
	const cursorCache = ref(new Map());
	
	// Performance tracking
	const renderTime = ref(0);
	const blurTime = ref(0);
	const cacheHits = ref(0);
	const cacheMisses = ref(0);

	// Initialize cursor renderers
	const initializeCursorRenderers = (width, height, canvas = null) => {
		if (!isSupported.value) {
			console.log("[CursorOffscreen] OffscreenCanvas not supported, using fallback");
			return false;
		}

		try {
			// Update positioning system with canvas info
			if (canvas) {
				positioning.updateCanvasInfo(canvas);
			}

			// Main cursor renderer
			cursorRenderer.value = createCursorRenderer(width, height);
			
			// Motion blur renderer
			blurRenderer.value = createBlurRenderer(width, height);

			// Trail effect renderer
			trailRenderer.value = createOffscreenCanvas(CANVAS_TYPES.CURSOR + "_trail", {
				width,
				height,
				useWorker: false // Trail better on main thread for real-time updates
			});

			console.log("[CursorOffscreen] Cursor renderers initialized", {
				cursor: !!cursorRenderer.value,
				blur: !!blurRenderer.value,
				trail: !!trailRenderer.value,
				positioning: !!positioning
			});

			return true;
		} catch (error) {
			console.error("[CursorOffscreen] Failed to initialize renderers:", error);
			return false;
		}
	};

	// Generate cache key for cursor state
	const generateCacheKey = (cursorType, size, effects) => {
		return `${cursorType}_${size}_${effects.rotation.toFixed(2)}_${effects.scale.toFixed(2)}_${effects.tilt.toFixed(2)}`;
	};

	// Render cursor with caching and effects
	const renderCursorFrame = async (cursorData, effects = {}) => {
		const startTime = performance.now();

		if (!cursorRenderer.value || !cursorData.visible || !cursorData.image) {
			return null;
		}

		const {
			x, y, cursorType, size, image
		} = cursorData;

		// Use positioning system to calculate render position
		const renderPos = positioning.calculateRenderPosition(x, y, cursorType, size, effects.scale || 1);

		const {
			rotation = 0,
			scale = 1,
			tilt = 0,
			skew = 0,
			motionBlur = false,
			blurIntensity = 0,
			blurDirection = { x: 1, y: 0 }
		} = effects;

		// Check cache first for static cursors (no motion blur)
		if (!motionBlur && blurIntensity === 0) {
			const cacheKey = generateCacheKey(cursorType, size, effects);
			const cached = cursorCache.value.get(cacheKey);
			
			if (cached) {
				cacheHits.value++;
				// Just position the cached cursor using positioning system
				return positionCursor(cached, x, y, cursorType, size);
			} else {
				cacheMisses.value++;
			}
		}

		const ctx = cursorRenderer.value.context;
		const { width, height } = cursorRenderer.value.canvas;

		try {
			// Clear cursor canvas
			ctx.clearRect(0, 0, width, height);

			// Use calculated render position from positioning system
			const { width: cursorWidth, height: cursorHeight, hotspot } = renderPos;
			const drawX = renderPos.x;
			const drawY = renderPos.y;

			// Save context for transforms
			ctx.save();

			// Move to cursor position using normalized coordinates
			ctx.translate(drawX + cursorWidth / 2, drawY + cursorHeight / 2);

			// Apply transforms
			if (rotation !== 0) ctx.rotate(rotation);
			if (tilt !== 0) ctx.rotate(tilt);
			if (skew !== 0) ctx.transform(1, 0, skew, 1, 0, 0);

			// Move back to draw position
			ctx.translate(-cursorWidth / 2, -cursorHeight / 2);

			// Apply motion blur if enabled
			if (motionBlur && blurIntensity > 0) {
				await applyMotionBlur(ctx, image, cursorWidth, cursorHeight, blurIntensity, blurDirection);
			} else {
				// Draw cursor normally
				ctx.drawImage(image, 0, 0, cursorWidth, cursorHeight);
			}

			ctx.restore();

			// Cache the rendered cursor if no motion blur
			if (!motionBlur && blurIntensity === 0) {
				const cacheKey = generateCacheKey(cursorType, size, effects);
				
				// Create cache canvas
				const cacheCanvas = document.createElement('canvas');
				cacheCanvas.width = cursorWidth + 20; // Extra padding
				cacheCanvas.height = cursorHeight + 20;
				const cacheCtx = cacheCanvas.getContext('2d');
				
				// Copy cursor to cache canvas
				cacheCtx.drawImage(
					cursorRenderer.value.canvas,
					drawX - 10, drawY - 10, cursorWidth + 20, cursorHeight + 20,
					0, 0, cursorWidth + 20, cursorHeight + 20
				);
				
				cursorCache.value.set(cacheKey, cacheCanvas);
				
				// Limit cache size
				if (cursorCache.value.size > 50) {
					const firstKey = cursorCache.value.keys().next().value;
					cursorCache.value.delete(firstKey);
				}
			}

			renderTime.value = performance.now() - startTime;
			return cursorRenderer.value.canvas;

		} catch (error) {
			console.error("[CursorOffscreen] Cursor render error:", error);
			return null;
		}
	};

	// Apply motion blur effect
	const applyMotionBlur = async (ctx, image, width, height, intensity, direction) => {
		const blurStartTime = performance.now();
		
		if (!blurRenderer.value) {
			ctx.drawImage(image, 0, 0, width, height);
			return;
		}

		try {
			const blurCtx = blurRenderer.value.context;
			const { width: blurWidth, height: blurHeight } = blurRenderer.value.canvas;

			// Clear blur canvas
			blurCtx.clearRect(0, 0, blurWidth, blurHeight);

			// Create multiple offset copies for motion blur trail
			const steps = Math.max(3, Math.min(8, Math.round(intensity * 10)));
			const stepX = direction.x * intensity * 10;
			const stepY = direction.y * intensity * 10;

			blurCtx.save();
			
			// Draw multiple copies with decreasing opacity
			for (let i = 0; i < steps; i++) {
				const alpha = (steps - i) / steps * 0.3; // Decreasing opacity
				const offsetX = -stepX * i / steps;
				const offsetY = -stepY * i / steps;
				
				blurCtx.globalAlpha = alpha;
				blurCtx.drawImage(image, offsetX, offsetY, width, height);
			}
			
			blurCtx.restore();

			// Draw the main cursor on top
			blurCtx.globalAlpha = 1;
			blurCtx.drawImage(image, 0, 0, width, height);

			// Copy blur result back to main cursor canvas
			ctx.drawImage(blurRenderer.value.canvas, 0, 0, width, height, 0, 0, width, height);

			blurTime.value = performance.now() - blurStartTime;

		} catch (error) {
			console.error("[CursorOffscreen] Motion blur error:", error);
			// Fallback to normal rendering
			ctx.drawImage(image, 0, 0, width, height);
		}
	};

	// Position cached cursor on main canvas
	const positionCursor = (cachedCursor, x, y, cursorType, size) => {
		if (!cursorRenderer.value) return null;

		const ctx = cursorRenderer.value.context;
		const { width, height } = cursorRenderer.value.canvas;

		// Clear canvas
		ctx.clearRect(0, 0, width, height);

		// Use positioning system for accurate placement
		const renderPos = positioning.calculateRenderPosition(x, y, cursorType, size);
		const drawX = renderPos.x - 10; // Account for cache padding
		const drawY = renderPos.y - 10;
		
		ctx.drawImage(cachedCursor, drawX, drawY);

		return cursorRenderer.value.canvas;
	};

	// Render cursor trail effect
	const renderCursorTrail = (mouseHistory, trailSettings = {}) => {
		if (!trailRenderer.value || !mouseHistory?.length) return null;

		const {
			maxTrailLength = 10,
			fadeSpeed = 0.1,
			trailWidth = 2,
			trailColor = 'rgba(255, 255, 255, 0.5)'
		} = trailSettings;

		const ctx = trailRenderer.value.context;
		const { width, height } = trailRenderer.value.canvas;

		try {
			// Fade existing trail
			ctx.globalAlpha = 1 - fadeSpeed;
			ctx.globalCompositeOperation = 'destination-in';
			ctx.fillRect(0, 0, width, height);

			// Draw new trail segments
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = 'source-over';
			ctx.strokeStyle = trailColor;
			ctx.lineWidth = trailWidth;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';

			if (mouseHistory.length > 1) {
				ctx.beginPath();
				const recentHistory = mouseHistory.slice(-maxTrailLength);
				
				for (let i = 0; i < recentHistory.length - 1; i++) {
					const current = recentHistory[i];
					const next = recentHistory[i + 1];
					
					if (i === 0) {
						ctx.moveTo(current.x, current.y);
					}
					ctx.lineTo(next.x, next.y);
				}
				
				ctx.stroke();
			}

			return trailRenderer.value.canvas;

		} catch (error) {
			console.error("[CursorOffscreen] Trail render error:", error);
			return null;
		}
	};

	// Clear cursor cache
	const clearCache = () => {
		cursorCache.value.clear();
		cacheHits.value = 0;
		cacheMisses.value = 0;
	};

	// Resize cursor renderers
	const resizeCursorRenderers = (newWidth, newHeight) => {
		if (cursorRenderer.value) {
			cursorRenderer.value.canvas.width = newWidth;
			cursorRenderer.value.canvas.height = newHeight;
		}
		if (blurRenderer.value) {
			blurRenderer.value.canvas.width = newWidth;
			blurRenderer.value.canvas.height = newHeight;
		}
		if (trailRenderer.value) {
			trailRenderer.value.canvas.width = newWidth;
			trailRenderer.value.canvas.height = newHeight;
		}
		
		// Clear cache on resize
		clearCache();
	};

	// Get cursor performance stats
	const getCursorPerformanceStats = () => {
		const totalRequests = cacheHits.value + cacheMisses.value;
		const cacheHitRatio = totalRequests > 0 ? (cacheHits.value / totalRequests) * 100 : 0;

		return {
			renderTime: renderTime.value,
			blurTime: blurTime.value,
			cacheHits: cacheHits.value,
			cacheMisses: cacheMisses.value,
			cacheHitRatio: Math.round(cacheHitRatio),
			cacheSize: cursorCache.value.size,
			isOffscreen: isSupported.value
		};
	};

	// Cleanup resources
	const cleanup = () => {
		clearCache();
		
		if (cursorRenderer.value?.destroy) {
			cursorRenderer.value.destroy();
		}
		if (blurRenderer.value?.destroy) {
			blurRenderer.value.destroy();
		}
		if (trailRenderer.value?.destroy) {
			trailRenderer.value.destroy();
		}
	};

	// Cleanup on unmount
	onUnmounted(() => {
		cleanup();
	});

	return {
		// Core functions
		initializeCursorRenderers,
		renderCursorFrame,
		renderCursorTrail,
		resizeCursorRenderers,
		
		// Cache management
		clearCache,
		
		// Performance
		getCursorPerformanceStats,
		
		// Positioning system
		positioning,
		
		// State
		isSupported,
		
		// Cleanup
		cleanup,
		
		// Renderers (for debugging)
		cursorRenderer,
		blurRenderer,
		trailRenderer
	};
};