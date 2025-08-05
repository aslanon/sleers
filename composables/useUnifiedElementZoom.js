import { ref, computed, watch, reactive } from "vue";

/**
 * Unified Element Zoom System
 * Canvas'ı zoom yapmak yerine, tüm elementleri (video, camera, cursor, GIF) zoom'a göre scale ve reposition eder
 * Bu sayede her element native çözünürlüğünde kalır
 */
export const useUnifiedElementZoom = () => {
	// Zoom state
	const zoomState = reactive({
		scale: 1.0,
		origin: { x: 50, y: 50 }, // Percentage based (0-100)
		isZooming: false,
		minZoom: 0.5,
		maxZoom: 6.0
	});

	// Canvas dimensions
	const canvasDimensions = ref({
		width: 1920,
		height: 1080
	});

	// Element zoom configurations
	const elementConfigs = reactive({
		video: {
			enabled: true,
			baseWidth: 1920,
			baseHeight: 1080,
			maintainAspectRatio: true,
			allowCropping: true
		},
		camera: {
			enabled: true,
			baseSize: 200, // pixels
			maintainRelativePosition: true,
			scaleWithZoom: true
		},
		cursor: {
			enabled: true,
			baseSize: 80,
			scaleWithZoom: true,
			maintainHotspot: true
		},
		gifs: {
			enabled: true,
			scaleWithZoom: true,
			maintainRelativePositions: true
		}
	});

	// Performance tracking
	const performanceStats = ref({
		lastTransformTime: 0,
		transformCount: 0,
		averageTransformTime: 0
	});

	// Update canvas dimensions
	const updateCanvasDimensions = (width, height) => {
		canvasDimensions.value = { width, height };
		console.log('[UnifiedElementZoom] Canvas dimensions updated:', { width, height });
	};

	// Set zoom level and origin
	const setZoom = (scale, origin = null) => {
		const clampedScale = Math.max(zoomState.minZoom, Math.min(zoomState.maxZoom, scale));
		
		zoomState.scale = clampedScale;
		zoomState.isZooming = clampedScale > 1.001;
		
		if (origin) {
			zoomState.origin = {
				x: Math.max(0, Math.min(100, origin.x)),
				y: Math.max(0, Math.min(100, origin.y))
			};
		}

		console.log('[UnifiedElementZoom] Zoom set:', {
			scale: clampedScale,
			origin: zoomState.origin,
			isZooming: zoomState.isZooming
		});
	};

	// Calculate zoom viewport (what area of the original canvas is visible)
	const calculateZoomViewport = () => {
		if (zoomState.scale <= 1.0) {
			return {
				x: 0,
				y: 0,
				width: canvasDimensions.value.width,
				height: canvasDimensions.value.height,
				scale: 1.0
			};
		}

		const { width: canvasWidth, height: canvasHeight } = canvasDimensions.value;
		const { scale, origin } = zoomState;

		// Calculate visible area dimensions
		const visibleWidth = canvasWidth / scale;
		const visibleHeight = canvasHeight / scale;

		// Calculate viewport position based on zoom origin
		const originX = (origin.x / 100) * canvasWidth;
		const originY = (origin.y / 100) * canvasHeight;

		// Center viewport on zoom origin
		const viewportX = Math.max(0, Math.min(canvasWidth - visibleWidth, originX - visibleWidth / 2));
		const viewportY = Math.max(0, Math.min(canvasHeight - visibleHeight, originY - visibleHeight / 2));

		return {
			x: viewportX,
			y: viewportY,
			width: visibleWidth,
			height: visibleHeight,
			scale: scale
		};
	};

	// Transform video element for zoom
	const transformVideoElement = (videoElement, videoState = {}) => {
		const startTime = performance.now();

		if (!elementConfigs.video.enabled || !videoElement) {
			return null;
		}

		const viewport = calculateZoomViewport();
		const { scale } = zoomState;

		// Video dimensions and positioning
		const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
		const canvasAspect = canvasDimensions.value.width / canvasDimensions.value.height;

		let baseVideoWidth, baseVideoHeight, baseVideoX, baseVideoY;

		// Fit video to canvas maintaining aspect ratio
		if (videoAspect > canvasAspect) {
			baseVideoHeight = canvasDimensions.value.height;
			baseVideoWidth = baseVideoHeight * videoAspect;
			baseVideoX = (canvasDimensions.value.width - baseVideoWidth) / 2;
			baseVideoY = 0;
		} else {
			baseVideoWidth = canvasDimensions.value.width;
			baseVideoHeight = baseVideoWidth / videoAspect;
			baseVideoX = 0;
			baseVideoY = (canvasDimensions.value.height - baseVideoHeight) / 2;
		}

		// Apply zoom transformation
		const transform = {
			// Video büyütülecek ve viewport'a göre konumlandırılacak
			width: baseVideoWidth * scale,
			height: baseVideoHeight * scale,
			x: baseVideoX * scale - viewport.x * scale,
			y: baseVideoY * scale - viewport.y * scale,
			
			// Original source dimensions (video element'den çekilecek alan)
			sourceX: 0,
			sourceY: 0,
			sourceWidth: videoElement.videoWidth,
			sourceHeight: videoElement.videoHeight,
			
			// Scale factor
			scale: scale,
			
			// Viewport info
			viewport: viewport
		};

		// Performance tracking
		const transformTime = performance.now() - startTime;
		performanceStats.value.lastTransformTime = transformTime;
		performanceStats.value.transformCount++;
		performanceStats.value.averageTransformTime = 
			(performanceStats.value.averageTransformTime * 0.9) + (transformTime * 0.1);

		return transform;
	};

	// Transform camera element for zoom
	const transformCameraElement = (cameraSettings = {}, cameraPosition = {}) => {
		if (!elementConfigs.camera.enabled) {
			return null;
		}

		const viewport = calculateZoomViewport();
		const { scale } = zoomState;
		const config = elementConfigs.camera;

		// Base camera dimensions and position
		const baseCameraSize = cameraSettings.size ? 
			(canvasDimensions.value.width * cameraSettings.size / 100) : 
			config.baseSize;

		const baseCameraX = cameraPosition.x || (canvasDimensions.value.width - baseCameraSize - 50);
		const baseCameraY = cameraPosition.y || 50;

		// Apply zoom transformation
		const transform = {
			// Camera büyütülecek ve viewport'a göre repositioning
			size: config.scaleWithZoom ? baseCameraSize * scale : baseCameraSize,
			x: (baseCameraX * scale) - (viewport.x * scale),
			y: (baseCameraY * scale) - (viewport.y * scale),
			
			// Original settings preserved
			originalSize: baseCameraSize,
			originalX: baseCameraX,
			originalY: baseCameraY,
			
			// Scale info
			scale: config.scaleWithZoom ? scale : 1.0,
			viewport: viewport,
			
			// Settings passthrough
			mirror: cameraSettings.mirror || false,
			borderRadius: cameraSettings.borderRadius || 0,
			opacity: cameraSettings.opacity || 1.0
		};

		return transform;
	};

	// Transform cursor element for zoom
	const transformCursorElement = (cursorX, cursorY, cursorData = {}) => {
		if (!elementConfigs.cursor.enabled) {
			return null;
		}

		const viewport = calculateZoomViewport();
		const { scale } = zoomState;
		const config = elementConfigs.cursor;

		// Base cursor properties
		const baseCursorSize = cursorData.size || config.baseSize;
		
		// Transform cursor position and size
		const transform = {
			// Cursor pozisyonu zoom'a göre transform edilecek
			x: (cursorX * scale) - (viewport.x * scale),
			y: (cursorY * scale) - (viewport.y * scale),
			
			// Cursor size zoom'a göre scale edilecek
			size: config.scaleWithZoom ? baseCursorSize * scale : baseCursorSize,
			
			// Original properties
			originalX: cursorX,
			originalY: cursorY,
			originalSize: baseCursorSize,
			
			// Scale info
			scale: config.scaleWithZoom ? scale : 1.0,
			viewport: viewport,
			
			// Hotspot adjustment for zoom
			hotspot: config.maintainHotspot ? {
				x: (cursorData.hotspot?.x || 0) * (config.scaleWithZoom ? scale : 1.0),
				y: (cursorData.hotspot?.y || 0) * (config.scaleWithZoom ? scale : 1.0)
			} : (cursorData.hotspot || { x: 0, y: 0 }),
			
			// Cursor properties passthrough
			visible: cursorData.visible !== false,
			cursorType: cursorData.cursorType || 'default'
		};

		return transform;
	};

	// Transform GIF elements for zoom
	const transformGifElements = (gifElements = []) => {
		if (!elementConfigs.gifs.enabled || !gifElements.length) {
			return [];
		}

		const viewport = calculateZoomViewport();
		const { scale } = zoomState;
		const config = elementConfigs.gifs;

		return gifElements.map(gif => {
			// Base GIF properties
			const baseWidth = gif.width || 100;
			const baseHeight = gif.height || 100;
			const baseX = gif.x || 0;
			const baseY = gif.y || 0;

			// Apply zoom transformation
			return {
				...gif, // Preserve original properties
				
				// Transformed dimensions
				width: config.scaleWithZoom ? baseWidth * scale : baseWidth,
				height: config.scaleWithZoom ? baseHeight * scale : baseHeight,
				
				// Transformed position
				x: config.maintainRelativePositions ? 
					(baseX * scale) - (viewport.x * scale) : baseX,
				y: config.maintainRelativePositions ? 
					(baseY * scale) - (viewport.y * scale) : baseY,
				
				// Original properties for reference
				originalWidth: baseWidth,
				originalHeight: baseHeight,
				originalX: baseX,
				originalY: baseY,
				
				// Scale info
				scale: config.scaleWithZoom ? scale : 1.0,
				viewport: viewport
			};
		});
	};

	// Transform all elements at once
	const transformAllElements = (renderData) => {
		const transformStartTime = performance.now();

		const transforms = {
			video: null,
			camera: null,
			cursor: null,
			gifs: []
		};

		// Transform video
		if (renderData.videoElement) {
			transforms.video = transformVideoElement(renderData.videoElement, renderData.videoState);
		}

		// Transform camera
		if (renderData.cameraElement || renderData.cameraSettings) {
			transforms.camera = transformCameraElement(renderData.cameraSettings, renderData.cameraPosition);
		}

		// Transform cursor
		if (renderData.cursorData) {
			transforms.cursor = transformCursorElement(
				renderData.cursorData.x, 
				renderData.cursorData.y, 
				renderData.cursorData
			);
		}

		// Transform GIFs
		if (renderData.gifElements?.length) {
			transforms.gifs = transformGifElements(renderData.gifElements);
		}

		// Add zoom state to transforms
		transforms.zoomState = {
			scale: zoomState.scale,
			origin: { ...zoomState.origin },
			isZooming: zoomState.isZooming,
			viewport: calculateZoomViewport()
		};

		// Performance tracking
		const totalTransformTime = performance.now() - transformStartTime;
		console.log('[UnifiedElementZoom] All elements transformed in', totalTransformTime.toFixed(2), 'ms');

		return transforms;
	};

	// Check if a point is visible in current zoom viewport
	const isPointVisible = (x, y) => {
		if (!zoomState.isZooming) return true;

		const viewport = calculateZoomViewport();
		return x >= viewport.x && 
			   x <= viewport.x + viewport.width &&
			   y >= viewport.y && 
			   y <= viewport.y + viewport.height;
	};

	// Convert screen coordinates to zoomed world coordinates
	const screenToWorld = (screenX, screenY) => {
		const viewport = calculateZoomViewport();
		
		if (!zoomState.isZooming) {
			return { x: screenX, y: screenY };
		}

		return {
			x: viewport.x + (screenX / zoomState.scale),
			y: viewport.y + (screenY / zoomState.scale)
		};
	};

	// Convert world coordinates to screen coordinates
	const worldToScreen = (worldX, worldY) => {
		const viewport = calculateZoomViewport();
		
		if (!zoomState.isZooming) {
			return { x: worldX, y: worldY };
		}

		return {
			x: (worldX - viewport.x) * zoomState.scale,
			y: (worldY - viewport.y) * zoomState.scale
		};
	};

	// Zoom to specific element (auto-calculate origin)
	const zoomToElement = (element, targetScale = 2.0) => {
		let centerX = 50, centerY = 50; // Default center

		if (element.x !== undefined && element.y !== undefined) {
			centerX = (element.x / canvasDimensions.value.width) * 100;
			centerY = (element.y / canvasDimensions.value.height) * 100;
		}

		setZoom(targetScale, { x: centerX, y: centerY });
	};

	// Reset zoom
	const resetZoom = () => {
		setZoom(1.0, { x: 50, y: 50 });
	};

	// Zoom in/out relative to current
	const zoomRelative = (factor) => {
		setZoom(zoomState.scale * factor);
	};

	// Get performance stats
	const getPerformanceStats = () => {
		return {
			...performanceStats.value,
			currentZoom: zoomState.scale,
			isZooming: zoomState.isZooming,
			viewport: calculateZoomViewport()
		};
	};

	// Update element configurations
	const updateElementConfig = (elementType, config) => {
		if (elementConfigs[elementType]) {
			Object.assign(elementConfigs[elementType], config);
			console.log(`[UnifiedElementZoom] Updated ${elementType} config:`, elementConfigs[elementType]);
		}
	};

	return {
		// State
		zoomState: readonly(zoomState),
		canvasDimensions,
		elementConfigs,
		
		// Core functions
		setZoom,
		resetZoom,
		zoomRelative,
		zoomToElement,
		
		// Canvas management
		updateCanvasDimensions,
		
		// Transform functions
		transformVideoElement,
		transformCameraElement,
		transformCursorElement,
		transformGifElements,
		transformAllElements,
		
		// Coordinate conversion
		screenToWorld,
		worldToScreen,
		isPointVisible,
		
		// Utils
		calculateZoomViewport,
		getPerformanceStats,
		updateElementConfig
	};
};