// Background Removal Worker - TensorFlow.js background removal processing
// Handles body segmentation and background removal in worker thread

class BackgroundRemovalWorker {
	constructor() {
		this.canvas = null;
		this.ctx = null;
		this.model = null;
		this.isModelLoaded = false;
		
		// Performance tracking
		this.frameCount = 0;
		this.totalTime = 0;
		this.modelLoadTime = 0;
	}

	// Initialize worker canvas and load model
	async initialize(offscreenCanvas, width, height) {
		this.canvas = offscreenCanvas;
		this.ctx = this.canvas.getContext('2d', {
			alpha: true,
			desynchronized: true,
			willReadFrequently: false
		});
		
		this.canvas.width = width;
		this.canvas.height = height;
		
		try {
			// Load TensorFlow.js in worker (if available)
			if (typeof importScripts !== 'undefined') {
				importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest');
				importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/body-segmentation@latest');
			}
			
			await this.loadSegmentationModel();
			
			console.log('[BackgroundRemovalWorker] Initialized with model loaded');
			return true;
		} catch (error) {
			console.error('[BackgroundRemovalWorker] Initialization error:', error);
			return false;
		}
	}

	// Load TensorFlow.js body segmentation model
	async loadSegmentationModel() {
		const modelLoadStart = performance.now();
		
		try {
			// Check if TensorFlow.js is available
			if (typeof tf === 'undefined' || typeof bodySegmentation === 'undefined') {
				throw new Error('TensorFlow.js or body-segmentation not available in worker');
			}

			// Load MediaPipe SelfieSegmentation model (fastest option)
			this.model = await bodySegmentation.createSegmenter(
				bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation,
				{
					runtime: 'mediapipe',
					solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation',
					modelType: 'landscape' // or 'general' for better quality
				}
			);
			
			this.isModelLoaded = true;
			this.modelLoadTime = performance.now() - modelLoadStart;
			
			console.log(`[BackgroundRemovalWorker] Model loaded in ${this.modelLoadTime.toFixed(2)}ms`);
			
		} catch (error) {
			console.error('[BackgroundRemovalWorker] Model loading error:', error);
			this.isModelLoaded = false;
			
			// Fallback to simple edge detection if TensorFlow.js fails
			console.log('[BackgroundRemovalWorker] Using fallback edge detection');
		}
	}

	// Process background removal
	async processBackgroundRemoval(data) {
		const startTime = performance.now();
		
		const {
			imageData,
			width,
			height,
			blurBackground = false,
			backgroundBlur = 10,
			edgeSmoothing = true,
			confidenceThreshold = 0.7
		} = data;

		if (!this.ctx || !imageData) {
			return null;
		}

		try {
			// Put image data to canvas
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			this.ctx.putImageData(imageData, 0, 0);

			let resultImageData;

			if (this.isModelLoaded && this.model) {
				// Use TensorFlow.js model
				resultImageData = await this.processWithTensorFlow(imageData, width, height, {
					blurBackground,
					backgroundBlur,
					edgeSmoothing,
					confidenceThreshold
				});
			} else {
				// Use fallback method
				resultImageData = this.processFallbackMethod(imageData, {
					blurBackground,
					backgroundBlur,
					edgeSmoothing
				});
			}

			const processingTime = performance.now() - startTime;
			this.frameCount++;
			this.totalTime += processingTime;

			return resultImageData;

		} catch (error) {
			console.error('[BackgroundRemovalWorker] Processing error:', error);
			return imageData; // Return original if processing fails
		}
	}

	// Process using TensorFlow.js
	async processWithTensorFlow(imageData, width, height, options) {
		try {
			// Create ImageData for model
			const tempCanvas = new OffscreenCanvas(width, height);
			const tempCtx = tempCanvas.getContext('2d');
			tempCtx.putImageData(imageData, 0, 0);

			// Run segmentation
			const segmentation = await this.model.segmentPeople(tempCanvas, {
				multiSegmentation: false,
				segmentBodyParts: false
			});

			if (!segmentation || segmentation.length === 0) {
				return imageData;
			}

			// Get mask
			const mask = await segmentation[0].mask.toImageData();
			
			// Apply mask to original image
			return this.applySegmentationMask(imageData, mask, options);

		} catch (error) {
			console.error('[BackgroundRemovalWorker] TensorFlow processing error:', error);
			return this.processFallbackMethod(imageData, options);
		}
	}

	// Apply segmentation mask to image
	applySegmentationMask(originalImageData, mask, options) {
		const { data: originalData } = originalImageData;
		const { data: maskData } = mask;
		const resultData = new Uint8ClampedArray(originalData.length);

		// Apply mask
		for (let i = 0; i < originalData.length; i += 4) {
			const maskValue = maskData[i] / 255; // Normalize mask value
			const isPersonPixel = maskValue > options.confidenceThreshold;

			if (isPersonPixel) {
				// Keep person pixels
				resultData[i] = originalData[i];       // R
				resultData[i + 1] = originalData[i + 1]; // G
				resultData[i + 2] = originalData[i + 2]; // B
				resultData[i + 3] = originalData[i + 3]; // A
			} else {
				// Remove or blur background
				if (options.blurBackground) {
					// Apply blur to background pixels
					const blurredPixel = this.getBlurredPixel(originalImageData, i / 4, options.backgroundBlur);
					resultData[i] = blurredPixel.r;
					resultData[i + 1] = blurredPixel.g;
					resultData[i + 2] = blurredPixel.b;
					resultData[i + 3] = originalData[i + 3] * 0.3; // Reduce opacity
				} else {
					// Make background transparent
					resultData[i] = originalData[i];
					resultData[i + 1] = originalData[i + 1];
					resultData[i + 2] = originalData[i + 2];
					resultData[i + 3] = 0; // Transparent
				}
			}
		}

		// Apply edge smoothing if enabled
		if (options.edgeSmoothing) {
			return this.smoothEdges(new ImageData(resultData, originalImageData.width, originalImageData.height));
		}

		return new ImageData(resultData, originalImageData.width, originalImageData.height);
	}

	// Fallback method using simple edge detection
	processFallbackMethod(imageData, options) {
		const { data, width, height } = imageData;
		const resultData = new Uint8ClampedArray(data.length);

		// Simple skin tone detection for person segmentation
		for (let i = 0; i < data.length; i += 4) {
			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];
			const a = data[i + 3];

			// Simple skin tone detection (very basic)
			const isSkinTone = this.isSkinTone(r, g, b);
			
			if (isSkinTone) {
				// Keep pixels that might be person
				resultData[i] = r;
				resultData[i + 1] = g;
				resultData[i + 2] = b;
				resultData[i + 3] = a;
			} else {
				// Process background
				if (options.blurBackground) {
					resultData[i] = r;
					resultData[i + 1] = g;
					resultData[i + 2] = b;
					resultData[i + 3] = a * 0.5; // Reduce opacity
				} else {
					resultData[i] = r;
					resultData[i + 1] = g;
					resultData[i + 2] = b;
					resultData[i + 3] = 0; // Transparent
				}
			}
		}

		return new ImageData(resultData, width, height);
	}

	// Simple skin tone detection
	isSkinTone(r, g, b) {
		// Very basic skin tone detection
		return (r > 95 && g > 40 && b > 20 &&
			   r > g && r > b &&
			   Math.abs(r - g) > 15);
	}

	// Get blurred pixel for background
	getBlurredPixel(imageData, pixelIndex, blurRadius) {
		const { data, width, height } = imageData;
		const x = pixelIndex % width;
		const y = Math.floor(pixelIndex / width);
		
		let r = 0, g = 0, b = 0, count = 0;
		
		for (let dy = -blurRadius; dy <= blurRadius; dy++) {
			for (let dx = -blurRadius; dx <= blurRadius; dx++) {
				const nx = Math.max(0, Math.min(width - 1, x + dx));
				const ny = Math.max(0, Math.min(height - 1, y + dy));
				const idx = (ny * width + nx) * 4;
				
				r += data[idx];
				g += data[idx + 1];
				b += data[idx + 2];
				count++;
			}
		}
		
		return {
			r: Math.round(r / count),
			g: Math.round(g / count),
			b: Math.round(b / count)
		};
	}

	// Smooth edges to reduce artifacts
	smoothEdges(imageData) {
		// Simple edge smoothing using alpha blending
		const { data, width, height } = imageData;
		const smoothedData = new Uint8ClampedArray(data.length);
		smoothedData.set(data);

		for (let y = 1; y < height - 1; y++) {
			for (let x = 1; x < width - 1; x++) {
				const idx = (y * width + x) * 4;
				
				// Check if this is an edge pixel
				const alpha = data[idx + 3];
				if (alpha > 0 && alpha < 255) {
					// Average with neighbors
					let avgAlpha = 0;
					let count = 0;
					
					for (let dy = -1; dy <= 1; dy++) {
						for (let dx = -1; dx <= 1; dx++) {
							const nIdx = ((y + dy) * width + (x + dx)) * 4;
							avgAlpha += data[nIdx + 3];
							count++;
						}
					}
					
					smoothedData[idx + 3] = Math.round(avgAlpha / count);
				}
			}
		}

		return new ImageData(smoothedData, width, height);
	}

	// Get performance stats
	getPerformanceStats() {
		return {
			frameCount: this.frameCount,
			totalTime: this.totalTime,
			averageTime: this.frameCount > 0 ? this.totalTime / this.frameCount : 0,
			fps: this.frameCount > 0 ? Math.round(1000 / (this.totalTime / this.frameCount)) : 0,
			modelLoadTime: this.modelLoadTime,
			isModelLoaded: this.isModelLoaded
		};
	}
}

// Worker instance
const backgroundRemovalWorker = new BackgroundRemovalWorker();

// Message handler
self.onmessage = async function(event) {
	const { type, data } = event.data;

	try {
		switch (type) {
			case 'initialize':
				const success = await backgroundRemovalWorker.initialize(data.canvas, data.width, data.height);
				self.postMessage({ 
					type: 'initialized', 
					success,
					modelLoaded: backgroundRemovalWorker.isModelLoaded
				});
				break;

			case 'process-background-removal':
				const result = await backgroundRemovalWorker.processBackgroundRemoval(data);
				self.postMessage({ 
					type: 'background-removed', 
					imageData: result 
				});
				break;

			case 'get-performance-stats':
				const stats = backgroundRemovalWorker.getPerformanceStats();
				self.postMessage({ 
					type: 'performance-stats', 
					stats 
				});
				break;

			default:
				console.warn('[BackgroundRemovalWorker] Unknown message type:', type);
		}
	} catch (error) {
		console.error('[BackgroundRemovalWorker] Message processing error:', error);
		self.postMessage({ 
			type: 'error', 
			error: error.message 
		});
	}
};