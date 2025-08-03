import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useUltraHighZoomRenderer } from "./useUltraHighZoomRenderer";

/**
 * High Quality Video Zoom System
 * Zoom sırasında video kalitesini korumak için adaptive rendering
 */
export const useHighQualityVideoZoom = () => {
	// Video quality settings
	const videoQualitySettings = ref({
		// Base canvas resolution
		baseWidth: 1920,
		baseHeight: 1080,
		
		// Quality multipliers for different zoom levels (more aggressive)
		qualityMultipliers: {
			1.0: 1.0,   // No zoom - normal quality
			1.5: 1.4,   // 1.5x zoom - 40% quality boost
			2.0: 1.8,   // 2x zoom - 80% quality boost
			2.5: 2.2,   // 2.5x zoom - 120% quality boost
			3.0: 2.6,   // 3x zoom - 160% quality boost
			4.0: 3.2,   // 4x zoom - 220% quality boost
			5.0: 4.0,   // 5x zoom - 300% quality boost
			6.0: 4.8,   // 6x zoom - 380% quality boost
		},
		
		// Adaptive quality settings (more aggressive for high zoom)
		adaptiveQuality: true,
		maxRenderWidth: 7680,  // 8K max for extreme zoom
		maxRenderHeight: 4320,
		minQualityMultiplier: 1.0,
		maxQualityMultiplier: 5.0,  // Allow up to 5x quality boost
		
		// Aspect ratio specific settings
		aspectRatioOptimization: {
			'9:16': {
				qualityBoost: 1.3,  // Extra 30% boost for vertical videos
				sharpening: 1.15,   // Slight sharpening
				maxZoomQuality: 6.0 // Higher max quality for vertical
			},
			'16:9': {
				qualityBoost: 1.0,
				sharpening: 1.0,
				maxZoomQuality: 4.0
			}
		}
	});

	// High-res rendering canvases
	const highResCanvas = ref(null);
	const highResCtx = ref(null);
	const intermediateCanvas = ref(null);
	const intermediateCtx = ref(null);

	// Ultra high zoom renderer for extreme zoom levels
	const ultraZoomRenderer = useUltraHighZoomRenderer();

	// Current zoom state
	const currentZoom = ref(1.0);
	const currentQualityMultiplier = ref(1.0);
	const isZooming = ref(false);

	// Performance monitoring
	const performanceStats = ref({
		renderTime: 0,
		frameCount: 0,
		avgRenderTime: 16.67,
		qualityAdjustments: 0
	});

	// Initialize high-resolution canvases
	const initializeHighResCanvases = (baseWidth, baseHeight) => {
		const settings = videoQualitySettings.value;
		
		// Calculate max dimensions
		const maxWidth = Math.min(
			baseWidth * settings.maxQualityMultiplier,
			settings.maxRenderWidth
		);
		const maxHeight = Math.min(
			baseHeight * settings.maxQualityMultiplier,
			settings.maxRenderHeight
		);

		// Create high-res canvas
		highResCanvas.value = document.createElement('canvas');
		highResCanvas.value.width = maxWidth;
		highResCanvas.value.height = maxHeight;
		
		highResCtx.value = highResCanvas.value.getContext('2d', {
			alpha: true,
			desynchronized: true,
			willReadFrequently: false,
			imageSmoothingEnabled: true,
			imageSmoothingQuality: 'high'
		});

		// Create intermediate canvas for processing
		intermediateCanvas.value = document.createElement('canvas');
		intermediateCanvas.value.width = maxWidth;
		intermediateCanvas.value.height = maxHeight;
		
		intermediateCtx.value = intermediateCanvas.value.getContext('2d', {
			alpha: true,
			imageSmoothingEnabled: true,
			imageSmoothingQuality: 'high'
		});

		// Initialize ultra zoom renderer
		ultraZoomRenderer.initializeSupersamplingCanvases(baseWidth, baseHeight);

		console.log('[HighQualityVideoZoom] Initialized canvases:', {
			maxWidth,
			maxHeight,
			baseWidth,
			baseHeight
		});
	};

	// Detect video aspect ratio
	const detectAspectRatio = (videoElement) => {
		if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
			return '16:9'; // Default
		}

		const ratio = videoElement.videoWidth / videoElement.videoHeight;
		
		if (Math.abs(ratio - 16/9) < 0.1) return '16:9';
		if (Math.abs(ratio - 9/16) < 0.1) return '9:16';
		if (Math.abs(ratio - 4/3) < 0.1) return '4:3';
		if (Math.abs(ratio - 1/1) < 0.1) return '1:1';
		
		// Check if closer to vertical or horizontal
		return ratio < 1 ? '9:16' : '16:9';
	};

	// Calculate optimal quality multiplier for zoom level with aspect ratio consideration
	const calculateQualityMultiplier = (zoomLevel, videoElement = null) => {
		const settings = videoQualitySettings.value;
		const { qualityMultipliers, minQualityMultiplier, maxQualityMultiplier } = settings;

		// Find the closest defined multiplier or interpolate
		const zoomLevels = Object.keys(qualityMultipliers).map(Number).sort((a, b) => a - b);
		
		// Base quality calculation
		let baseQuality = 1.0;
		
		// Exact match
		if (qualityMultipliers[zoomLevel]) {
			baseQuality = qualityMultipliers[zoomLevel];
		} else {
			// Interpolate between closest values
			let lowerZoom = 1.0;
			let upperZoom = 6.0;
			
			for (let i = 0; i < zoomLevels.length - 1; i++) {
				if (zoomLevel >= zoomLevels[i] && zoomLevel <= zoomLevels[i + 1]) {
					lowerZoom = zoomLevels[i];
					upperZoom = zoomLevels[i + 1];
					break;
				}
			}

			// Linear interpolation
			const t = (zoomLevel - lowerZoom) / (upperZoom - lowerZoom);
			const lowerMultiplier = qualityMultipliers[lowerZoom] || 1.0;
			const upperMultiplier = qualityMultipliers[upperZoom] || 4.8;
			
			baseQuality = lowerMultiplier + (upperMultiplier - lowerMultiplier) * t;
		}

		// Apply aspect ratio specific boost
		if (videoElement) {
			const aspectRatio = detectAspectRatio(videoElement);
			const aspectSettings = settings.aspectRatioOptimization[aspectRatio];
			
			if (aspectSettings) {
				baseQuality *= aspectSettings.qualityBoost;
				
				// Apply higher max quality for specific aspect ratios
				const aspectMaxQuality = aspectSettings.maxZoomQuality;
				return Math.max(minQualityMultiplier, Math.min(aspectMaxQuality, baseQuality));
			}
		}
		
		return Math.max(minQualityMultiplier, Math.min(maxQualityMultiplier, baseQuality));
	};

	// Render video at high quality for zoom
	const renderHighQualityVideo = (videoElement, zoomLevel, zoomOrigin = { x: 50, y: 50 }) => {
		const startTime = performance.now();

		if (!highResCtx.value || !videoElement || videoElement.readyState < 2) {
			return null;
		}

		// Update zoom state
		currentZoom.value = zoomLevel;
		isZooming.value = zoomLevel > 1.001;

		// Calculate quality multiplier with aspect ratio consideration
		const qualityMultiplier = calculateQualityMultiplier(zoomLevel, videoElement);
		currentQualityMultiplier.value = qualityMultiplier;

		// Detect aspect ratio for optimization
		const aspectRatio = detectAspectRatio(videoElement);
		const aspectSettings = settings.aspectRatioOptimization[aspectRatio] || settings.aspectRatioOptimization['16:9'];

		const ctx = highResCtx.value;

		// Calculate rendering dimensions
		const renderWidth = Math.round(settings.baseWidth * qualityMultiplier);
		const renderHeight = Math.round(settings.baseHeight * qualityMultiplier);

		// Update canvas size if needed
		if (highResCanvas.value.width !== renderWidth || highResCanvas.value.height !== renderHeight) {
			highResCanvas.value.width = renderWidth;
			highResCanvas.value.height = renderHeight;
		}

		try {
			// Check if we should use ultra high zoom rendering
			if (ultraZoomRenderer.shouldUseUltraZoom(zoomLevel, aspectRatio)) {
				console.log(`[HighQualityVideoZoom] Using ultra zoom for ${zoomLevel}x zoom (${aspectRatio})`);
				
				// Use ultra high zoom renderer
				const ultraResult = ultraZoomRenderer.renderUltraHighQuality(
					videoElement, 
					zoomLevel, 
					qualityMultiplier, 
					aspectRatio
				);

				if (ultraResult) {
					// Downsample ultra-high result to our target resolution
					const success = ultraZoomRenderer.downsampleToTarget(
						ultraResult.canvas,
						highResCanvas.value,
						renderWidth,
						renderHeight
					);

					if (success) {
						// Update performance stats with ultra rendering
						const renderTime = performance.now() - startTime;
						performanceStats.value.renderTime = renderTime;
						performanceStats.value.frameCount++;
						performanceStats.value.avgRenderTime = 
							(performanceStats.value.avgRenderTime * 0.9) + (renderTime * 0.1);

						return {
							canvas: highResCanvas.value,
							width: renderWidth,
							height: renderHeight,
							qualityMultiplier: ultraResult.finalMultiplier,
							renderTime,
							ultraMode: true,
							aspectRatio
						};
					}
				}
				
				// If ultra zoom fails, fall back to standard high-quality rendering
				console.warn('[HighQualityVideoZoom] Ultra zoom failed, falling back to standard');
			}

			// Standard high-quality rendering
			// Clear canvas
			ctx.clearRect(0, 0, renderWidth, renderHeight);

			// Calculate video dimensions and positioning
			const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
			const canvasAspect = renderWidth / renderHeight;
			
			let drawWidth, drawHeight, x, y;
			
			// Fit video to canvas maintaining aspect ratio
			if (videoAspect > canvasAspect) {
				drawHeight = renderHeight;
				drawWidth = drawHeight * videoAspect;
				x = (renderWidth - drawWidth) / 2;
				y = 0;
			} else {
				drawWidth = renderWidth;
				drawHeight = drawWidth / videoAspect;
				x = 0;
				y = (renderHeight - drawHeight) / 2;
			}

			// Enhanced rendering for high quality
			ctx.save();
			
			// Enable high-quality image smoothing
			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = 'high';
			
			// Apply quality enhancement filters based on zoom and aspect ratio
			if (qualityMultiplier > 1.2) {
				// Enhanced filters for high zoom
				const sharpening = aspectSettings.sharpening;
				const contrast = Math.min(1.15, 1.0 + (qualityMultiplier - 1.0) * 0.03);
				const saturation = Math.min(1.08, 1.0 + (qualityMultiplier - 1.0) * 0.02);
				
				// Special filter for 9:16 videos at high zoom
				if (aspectRatio === '9:16' && zoomLevel >= 3.0) {
					ctx.filter = `contrast(${contrast}) saturate(${saturation}) brightness(1.02) blur(0px)`;
				} else {
					ctx.filter = `contrast(${contrast}) saturate(${saturation})`;
				}
			}

			// Draw video at high resolution
			ctx.drawImage(videoElement, x, y, drawWidth, drawHeight);
			
			ctx.restore();

			// Update performance stats
			const renderTime = performance.now() - startTime;
			performanceStats.value.renderTime = renderTime;
			performanceStats.value.frameCount++;
			performanceStats.value.avgRenderTime = 
				(performanceStats.value.avgRenderTime * 0.9) + (renderTime * 0.1);

			return {
				canvas: highResCanvas.value,
				width: renderWidth,
				height: renderHeight,
				qualityMultiplier,
				renderTime
			};

		} catch (error) {
			console.error('[HighQualityVideoZoom] Render error:', error);
			return null;
		}
	};

	// Apply zoom viewport to high-quality canvas
	const applyZoomViewport = (sourceCanvas, zoomLevel, zoomOrigin, targetCanvas) => {
		if (!sourceCanvas || !targetCanvas || !intermediateCtx.value) {
			return false;
		}

		const targetCtx = targetCanvas.getContext('2d');
		if (!targetCtx) return false;

		try {
			// Calculate zoom viewport
			const sourceWidth = sourceCanvas.width;
			const sourceHeight = sourceCanvas.height;
			const targetWidth = targetCanvas.width;
			const targetHeight = targetCanvas.height;

			if (zoomLevel <= 1.001) {
				// No zoom - direct copy with high quality
				targetCtx.clearRect(0, 0, targetWidth, targetHeight);
				targetCtx.imageSmoothingEnabled = true;
				targetCtx.imageSmoothingQuality = 'high';
				targetCtx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
				return true;
			}

			// Calculate viewport for zoom
			const viewportWidth = sourceWidth / zoomLevel;
			const viewportHeight = sourceHeight / zoomLevel;
			
			// Calculate origin position in source canvas
			const originX = (zoomOrigin.x / 100) * sourceWidth;
			const originY = (zoomOrigin.y / 100) * sourceHeight;
			
			// Calculate viewport position
			const viewportX = Math.max(0, Math.min(sourceWidth - viewportWidth, originX - viewportWidth / 2));
			const viewportY = Math.max(0, Math.min(sourceHeight - viewportHeight, originY - viewportHeight / 2));

			// Clear target canvas
			targetCtx.clearRect(0, 0, targetWidth, targetHeight);
			
			// Apply high-quality viewport extraction
			targetCtx.imageSmoothingEnabled = true;
			targetCtx.imageSmoothingQuality = 'high';
			
			// Draw zoomed portion with high quality
			targetCtx.drawImage(
				sourceCanvas,
				viewportX, viewportY, viewportWidth, viewportHeight,
				0, 0, targetWidth, targetHeight
			);

			return true;

		} catch (error) {
			console.error('[HighQualityVideoZoom] Viewport error:', error);
			return false;
		}
	};

	// Adaptive quality adjustment based on performance
	const adjustQualityForPerformance = () => {
		if (!videoQualitySettings.value.adaptiveQuality) return;

		const stats = performanceStats.value;
		const targetFrameTime = 16.67; // 60 FPS

		if (stats.avgRenderTime > targetFrameTime * 1.5) {
			// Performance is poor - reduce quality
			const currentMax = videoQualitySettings.value.maxQualityMultiplier;
			const newMax = Math.max(1.0, currentMax - 0.1);
			
			if (newMax !== currentMax) {
				videoQualitySettings.value.maxQualityMultiplier = newMax;
				performanceStats.value.qualityAdjustments++;
				
				console.log(`[HighQualityVideoZoom] Reduced max quality to ${newMax} for performance`);
			}
		} else if (stats.avgRenderTime < targetFrameTime * 0.8) {
			// Performance is good - increase quality if below original max
			const currentMax = videoQualitySettings.value.maxQualityMultiplier;
			const originalMax = 2.0;
			const newMax = Math.min(originalMax, currentMax + 0.05);
			
			if (newMax !== currentMax) {
				videoQualitySettings.value.maxQualityMultiplier = newMax;
				console.log(`[HighQualityVideoZoom] Increased max quality to ${newMax}`);
			}
		}
	};

	// Get quality info for debugging
	const getQualityInfo = () => {
		return {
			currentZoom: currentZoom.value,
			currentQualityMultiplier: currentQualityMultiplier.value,
			isZooming: isZooming.value,
			settings: { ...videoQualitySettings.value },
			performance: { ...performanceStats.value },
			canvasInfo: {
				highResSize: highResCanvas.value ? {
					width: highResCanvas.value.width,
					height: highResCanvas.value.height
				} : null,
				intermediateSize: intermediateCanvas.value ? {
					width: intermediateCanvas.value.width,
					height: intermediateCanvas.value.height
				} : null
			}
		};
	};

	// Update quality settings
	const updateQualitySettings = (newSettings) => {
		videoQualitySettings.value = {
			...videoQualitySettings.value,
			...newSettings
		};
		
		console.log('[HighQualityVideoZoom] Updated quality settings:', videoQualitySettings.value);
	};

	// Cleanup resources
	const cleanup = () => {
		if (highResCanvas.value) {
			highResCanvas.value = null;
			highResCtx.value = null;
		}
		if (intermediateCanvas.value) {
			intermediateCanvas.value = null;
			intermediateCtx.value = null;
		}
		ultraZoomRenderer.cleanup();
	};

	// Auto-adjust quality based on performance
	let performanceCheckInterval = null;
	
	onMounted(() => {
		if (videoQualitySettings.value.adaptiveQuality) {
			performanceCheckInterval = setInterval(adjustQualityForPerformance, 2000);
		}
	});

	onUnmounted(() => {
		if (performanceCheckInterval) {
			clearInterval(performanceCheckInterval);
		}
		cleanup();
	});

	return {
		// Core functions
		initializeHighResCanvases,
		renderHighQualityVideo,
		applyZoomViewport,
		
		// Quality management
		calculateQualityMultiplier,
		updateQualitySettings,
		adjustQualityForPerformance,
		
		// Ultra zoom
		ultraZoomRenderer,
		detectAspectRatio,
		
		// State
		currentZoom,
		currentQualityMultiplier,
		isZooming,
		videoQualitySettings,
		
		// Performance
		performanceStats,
		getQualityInfo,
		
		// Resources
		highResCanvas,
		intermediateCanvas,
		cleanup
	};
};