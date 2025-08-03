import { ref } from "vue";

/**
 * Ultra High Zoom Renderer - 5x+ zoom için özel supersampling
 * 9:16 aspect ratio videolar için optimize edilmiş
 */
export const useUltraHighZoomRenderer = () => {
	// Supersampling canvas'ları
	const supersamplingCanvas = ref(null);
	const supersamplingCtx = ref(null);
	const intermediateCanvas = ref(null);
	const intermediateCtx = ref(null);

	// Ultra zoom settings
	const ultraZoomSettings = ref({
		// 5x+ zoom için active
		activationThreshold: 5.0,
		
		// Supersampling multiplier
		supersamplingMultiplier: 2.0, // 2x supersampling
		
		// Maximum resolution for ultra zoom
		maxUltraWidth: 15360,  // 16K width
		maxUltraHeight: 8640,   // 16K height
		
		// Aspect ratio specific multipliers
		aspectMultipliers: {
			'9:16': 2.5,  // Extra boost for vertical videos
			'16:9': 2.0,
			'1:1': 2.2
		},
		
		// Advanced filtering
		enableAdvancedFiltering: true,
		enableEdgeEnhancement: true,
		enableTextureSharpening: true
	});

	// Initialize supersampling canvases
	const initializeSupersamplingCanvases = (baseWidth, baseHeight) => {
		const settings = ultraZoomSettings.value;
		
		// Calculate supersampling dimensions
		const supersamplingWidth = Math.min(
			Math.round(baseWidth * settings.supersamplingMultiplier),
			settings.maxUltraWidth
		);
		const supersamplingHeight = Math.min(
			Math.round(baseHeight * settings.supersamplingMultiplier),
			settings.maxUltraHeight
		);

		// Create supersampling canvas
		supersamplingCanvas.value = document.createElement('canvas');
		supersamplingCanvas.value.width = supersamplingWidth;
		supersamplingCanvas.value.height = supersamplingHeight;
		
		supersamplingCtx.value = supersamplingCanvas.value.getContext('2d', {
			alpha: true,
			imageSmoothingEnabled: false, // Disable for sharp pixel rendering
			willReadFrequently: false
		});

		// Create intermediate processing canvas
		intermediateCanvas.value = document.createElement('canvas');
		intermediateCanvas.value.width = supersamplingWidth;
		intermediateCanvas.value.height = supersamplingHeight;
		
		intermediateCtx.value = intermediateCanvas.value.getContext('2d', {
			alpha: true,
			imageSmoothingEnabled: true,
			imageSmoothingQuality: 'high'
		});

		console.log('[UltraHighZoomRenderer] Initialized supersampling canvases:', {
			supersamplingWidth,
			supersamplingHeight,
			baseWidth,
			baseHeight
		});
	};

	// Check if ultra zoom should be active
	const shouldUseUltraZoom = (zoomLevel, aspectRatio = '16:9') => {
		const threshold = ultraZoomSettings.value.activationThreshold;
		
		// Lower threshold for 9:16 videos
		if (aspectRatio === '9:16') {
			return zoomLevel >= threshold * 0.8; // Active at 4x for vertical videos
		}
		
		return zoomLevel >= threshold;
	};

	// Apply edge enhancement filter
	const applyEdgeEnhancement = (sourceCanvas, targetCanvas) => {
		if (!ultraZoomSettings.value.enableEdgeEnhancement) return false;

		const sourceCtx = sourceCanvas.getContext('2d');
		const targetCtx = targetCanvas.getContext('2d');
		
		const width = sourceCanvas.width;
		const height = sourceCanvas.height;

		try {
			// Get image data
			const imageData = sourceCtx.getImageData(0, 0, width, height);
			const data = imageData.data;
			const outputData = new Uint8ClampedArray(data.length);

			// Edge enhancement kernel (sharpening)
			const kernel = [
				 0, -1,  0,
				-1,  5, -1,
				 0, -1,  0
			];

			// Apply convolution
			for (let y = 1; y < height - 1; y++) {
				for (let x = 1; x < width - 1; x++) {
					let r = 0, g = 0, b = 0;
					
					for (let ky = -1; ky <= 1; ky++) {
						for (let kx = -1; kx <= 1; kx++) {
							const idx = ((y + ky) * width + (x + kx)) * 4;
							const kernelValue = kernel[(ky + 1) * 3 + (kx + 1)];
							
							r += data[idx] * kernelValue;
							g += data[idx + 1] * kernelValue;
							b += data[idx + 2] * kernelValue;
						}
					}
					
					const outputIdx = (y * width + x) * 4;
					outputData[outputIdx] = Math.max(0, Math.min(255, r));
					outputData[outputIdx + 1] = Math.max(0, Math.min(255, g));
					outputData[outputIdx + 2] = Math.max(0, Math.min(255, b));
					outputData[outputIdx + 3] = data[outputIdx + 3]; // Keep alpha
				}
			}

			// Put enhanced data to target canvas
			const outputImageData = new ImageData(outputData, width, height);
			targetCtx.putImageData(outputImageData, 0, 0);
			
			return true;
		} catch (error) {
			console.error('[UltraHighZoomRenderer] Edge enhancement error:', error);
			return false;
		}
	};

	// Apply texture sharpening
	const applyTextureSharpening = (canvas, intensity = 0.3) => {
		if (!ultraZoomSettings.value.enableTextureSharpening) return false;

		const ctx = canvas.getContext('2d');
		const width = canvas.width;
		const height = canvas.height;

		try {
			// Create temporary canvas for unsharp mask
			const tempCanvas = document.createElement('canvas');
			tempCanvas.width = width;
			tempCanvas.height = height;
			const tempCtx = tempCanvas.getContext('2d');

			// Copy original
			tempCtx.drawImage(canvas, 0, 0);

			// Apply gaussian blur for unsharp mask
			tempCtx.filter = 'blur(1px)';
			tempCtx.globalCompositeOperation = 'source-over';
			tempCtx.drawImage(canvas, 0, 0);

			// Apply unsharp mask
			ctx.globalCompositeOperation = 'difference';
			ctx.globalAlpha = intensity;
			ctx.drawImage(tempCanvas, 0, 0);

			ctx.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = 1;

			return true;
		} catch (error) {
			console.error('[UltraHighZoomRenderer] Texture sharpening error:', error);
			return false;
		}
	};

	// Ultra high quality rendering with supersampling
	const renderUltraHighQuality = (videoElement, zoomLevel, qualityMultiplier, aspectRatio = '16:9') => {
		if (!supersamplingCtx.value || !intermediateCtx.value) {
			return null;
		}

		const settings = ultraZoomSettings.value;
		const aspectMultiplier = settings.aspectMultipliers[aspectRatio] || 2.0;
		
		// Calculate ultra-high resolution
		const finalMultiplier = qualityMultiplier * aspectMultiplier * settings.supersamplingMultiplier;
		const ultraWidth = Math.min(
			Math.round(1920 * finalMultiplier),
			settings.maxUltraWidth
		);
		const ultraHeight = Math.min(
			Math.round(1080 * finalMultiplier),
			settings.maxUltraHeight
		);

		try {
			// Update canvas sizes if needed
			if (supersamplingCanvas.value.width !== ultraWidth || supersamplingCanvas.value.height !== ultraHeight) {
				supersamplingCanvas.value.width = ultraWidth;
				supersamplingCanvas.value.height = ultraHeight;
				intermediateCanvas.value.width = ultraWidth;
				intermediateCanvas.value.height = ultraHeight;
			}

			// Clear canvases
			supersamplingCtx.value.clearRect(0, 0, ultraWidth, ultraHeight);
			intermediateCtx.value.clearRect(0, 0, ultraWidth, ultraHeight);

			// Calculate video positioning
			const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
			const canvasAspect = ultraWidth / ultraHeight;
			
			let drawWidth, drawHeight, x, y;
			if (videoAspect > canvasAspect) {
				drawHeight = ultraHeight;
				drawWidth = drawHeight * videoAspect;
				x = (ultraWidth - drawWidth) / 2;
				y = 0;
			} else {
				drawWidth = ultraWidth;
				drawHeight = drawWidth / videoAspect;
				x = 0;
				y = (ultraHeight - drawHeight) / 2;
			}

			// Phase 1: Ultra-sharp rendering with no smoothing
			supersamplingCtx.value.imageSmoothingEnabled = false;
			supersamplingCtx.value.drawImage(videoElement, x, y, drawWidth, drawHeight);

			// Phase 2: Apply advanced filtering if enabled
			if (settings.enableAdvancedFiltering) {
				// Copy to intermediate for processing
				intermediateCtx.value.imageSmoothingEnabled = true;
				intermediateCtx.value.imageSmoothingQuality = 'high';
				intermediateCtx.value.drawImage(supersamplingCanvas.value, 0, 0);

				// Apply edge enhancement
				if (settings.enableEdgeEnhancement && zoomLevel >= 6.0) {
					applyEdgeEnhancement(intermediateCanvas.value, supersamplingCanvas.value);
				}

				// Apply texture sharpening for 9:16 videos at extreme zoom
				if (aspectRatio === '9:16' && zoomLevel >= 5.0) {
					applyTextureSharpening(supersamplingCanvas.value, 0.4);
				}
			}

			return {
				canvas: supersamplingCanvas.value,
				width: ultraWidth,
				height: ultraHeight,
				finalMultiplier,
				aspectRatio
			};

		} catch (error) {
			console.error('[UltraHighZoomRenderer] Ultra rendering error:', error);
			return null;
		}
	};

	// Downsample to target resolution with high quality
	const downsampleToTarget = (sourceCanvas, targetCanvas, targetWidth, targetHeight) => {
		const targetCtx = targetCanvas.getContext('2d');
		
		// Update target canvas size
		targetCanvas.width = targetWidth;
		targetCanvas.height = targetHeight;

		try {
			// Clear target
			targetCtx.clearRect(0, 0, targetWidth, targetHeight);

			// High-quality downsampling
			targetCtx.imageSmoothingEnabled = true;
			targetCtx.imageSmoothingQuality = 'high';

			// Multiple pass downsampling for better quality
			const sourceWidth = sourceCanvas.width;
			const sourceHeight = sourceCanvas.height;
			const scaleRatio = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);

			if (scaleRatio < 0.5) {
				// Multi-pass downsampling for large reductions
				let currentCanvas = sourceCanvas;
				let currentWidth = sourceWidth;
				let currentHeight = sourceHeight;

				while (currentWidth > targetWidth * 2 || currentHeight > targetHeight * 2) {
					const nextWidth = Math.max(targetWidth, Math.round(currentWidth * 0.5));
					const nextHeight = Math.max(targetHeight, Math.round(currentHeight * 0.5));

					const tempCanvas = document.createElement('canvas');
					tempCanvas.width = nextWidth;
					tempCanvas.height = nextHeight;
					const tempCtx = tempCanvas.getContext('2d');
					
					tempCtx.imageSmoothingEnabled = true;
					tempCtx.imageSmoothingQuality = 'high';
					tempCtx.drawImage(currentCanvas, 0, 0, nextWidth, nextHeight);

					currentCanvas = tempCanvas;
					currentWidth = nextWidth;
					currentHeight = nextHeight;
				}

				// Final pass to target size
				targetCtx.drawImage(currentCanvas, 0, 0, targetWidth, targetHeight);
			} else {
				// Direct downsampling
				targetCtx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
			}

			return true;
		} catch (error) {
			console.error('[UltraHighZoomRenderer] Downsample error:', error);
			return false;
		}
	};

	// Get ultra zoom info
	const getUltraZoomInfo = () => {
		return {
			settings: { ...ultraZoomSettings.value },
			canvasInfo: {
				supersamplingSize: supersamplingCanvas.value ? {
					width: supersamplingCanvas.value.width,
					height: supersamplingCanvas.value.height
				} : null,
				intermediateSize: intermediateCanvas.value ? {
					width: intermediateCanvas.value.width,
					height: intermediateCanvas.value.height
				} : null
			}
		};
	};

	// Update ultra zoom settings
	const updateUltraZoomSettings = (newSettings) => {
		ultraZoomSettings.value = {
			...ultraZoomSettings.value,
			...newSettings
		};
	};

	// Cleanup
	const cleanup = () => {
		if (supersamplingCanvas.value) {
			supersamplingCanvas.value = null;
			supersamplingCtx.value = null;
		}
		if (intermediateCanvas.value) {
			intermediateCanvas.value = null;
			intermediateCtx.value = null;
		}
	};

	return {
		// Core functions
		initializeSupersamplingCanvases,
		shouldUseUltraZoom,
		renderUltraHighQuality,
		downsampleToTarget,
		
		// Filtering
		applyEdgeEnhancement,
		applyTextureSharpening,
		
		// Settings
		updateUltraZoomSettings,
		getUltraZoomInfo,
		
		// State
		ultraZoomSettings,
		
		// Cleanup
		cleanup,
		
		// Canvases (for debugging)
		supersamplingCanvas,
		intermediateCanvas
	};
};