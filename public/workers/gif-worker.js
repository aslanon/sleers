// GIF Worker - GIF processing and animation handling
// Handles GIF frame extraction, processing, and optimization

class GifWorker {
	constructor() {
		this.canvas = null;
		this.ctx = null;
		this.gifCache = new Map();
		this.frameCache = new Map();
		
		// Performance tracking
		this.frameCount = 0;
		this.totalTime = 0;
	}

	// Initialize worker canvas
	initialize(offscreenCanvas, width, height) {
		this.canvas = offscreenCanvas;
		this.ctx = this.canvas.getContext('2d', {
			alpha: true,
			desynchronized: true,
			willReadFrequently: false
		});
		
		this.canvas.width = width;
		this.canvas.height = height;
		
		console.log('[GifWorker] Initialized with canvas:', width, 'x', height);
	}

	// Process GIF frame with effects
	processGifFrame(data) {
		const startTime = performance.now();
		
		const {
			gifId,
			frameImageData,
			x = 0,
			y = 0,
			width = 100,
			height = 100,
			rotation = 0,
			scale = 1,
			opacity = 1,
			effects = {}
		} = data;

		if (!this.ctx || !frameImageData) {
			return null;
		}

		try {
			// Clear canvas
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

			// Create temporary canvas for the GIF frame
			const tempCanvas = new OffscreenCanvas(frameImageData.width, frameImageData.height);
			const tempCtx = tempCanvas.getContext('2d');
			tempCtx.putImageData(frameImageData, 0, 0);

			// Calculate final dimensions
			const finalWidth = width * scale;
			const finalHeight = height * scale;

			// Save context for transforms
			this.ctx.save();

			// Set opacity
			this.ctx.globalAlpha = opacity;

			// Move to GIF position
			this.ctx.translate(x + finalWidth / 2, y + finalHeight / 2);

			// Apply rotation
			if (rotation !== 0) {
				this.ctx.rotate(rotation);
			}

			// Apply effects
			if (effects.blur && effects.blur > 0) {
				this.ctx.filter = `blur(${effects.blur}px)`;
			}

			if (effects.brightness && effects.brightness !== 1) {
				this.ctx.filter += ` brightness(${effects.brightness})`;
			}

			if (effects.contrast && effects.contrast !== 1) {
				this.ctx.filter += ` contrast(${effects.contrast})`;
			}

			if (effects.saturate && effects.saturate !== 1) {
				this.ctx.filter += ` saturate(${effects.saturate})`;
			}

			// Move back to draw position
			this.ctx.translate(-finalWidth / 2, -finalHeight / 2);

			// Draw GIF frame
			this.ctx.drawImage(tempCanvas, 0, 0, finalWidth, finalHeight);

			this.ctx.restore();

			// Update performance stats
			const processingTime = performance.now() - startTime;
			this.frameCount++;
			this.totalTime += processingTime;

			return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

		} catch (error) {
			console.error('[GifWorker] GIF processing error:', error);
			return null;
		}
	}

	// Extract frames from GIF ImageData
	extractGifFrames(data) {
		const startTime = performance.now();
		
		const {
			gifId,
			gifImageData,
			frameCount = 1,
			frameDuration = 100
		} = data;

		// This is a simplified frame extraction
		// In a real implementation, you'd parse the GIF format
		const frames = [];
		
		try {
			// For now, just treat it as a single frame
			// Real GIF parsing would require a GIF decoder library
			frames.push({
				frameIndex: 0,
				imageData: gifImageData,
				duration: frameDuration,
				timestamp: 0
			});

			// Cache the frames
			this.frameCache.set(gifId, frames);

			const processingTime = performance.now() - startTime;
			console.log(`[GifWorker] Extracted ${frames.length} frames in ${processingTime.toFixed(2)}ms`);

			return frames;

		} catch (error) {
			console.error('[GifWorker] Frame extraction error:', error);
			return [];
		}
	}

	// Composite multiple GIF frames
	compositeGifs(data) {
		const startTime = performance.now();
		
		const { gifs = [] } = data;

		if (!this.ctx || gifs.length === 0) {
			return null;
		}

		try {
			// Clear canvas
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

			// Process each GIF
			for (const gif of gifs) {
				if (gif.frameImageData && gif.visible !== false) {
					// Create temp canvas for this GIF
					const tempCanvas = new OffscreenCanvas(gif.frameImageData.width, gif.frameImageData.height);
					const tempCtx = tempCanvas.getContext('2d');
					tempCtx.putImageData(gif.frameImageData, 0, 0);

					// Apply transformations and draw
					this.ctx.save();
					
					this.ctx.globalAlpha = gif.opacity || 1;
					this.ctx.translate(gif.x + gif.width / 2, gif.y + gif.height / 2);
					
					if (gif.rotation) this.ctx.rotate(gif.rotation);
					if (gif.scale && gif.scale !== 1) this.ctx.scale(gif.scale, gif.scale);
					
					this.ctx.translate(-gif.width / 2, -gif.height / 2);
					this.ctx.drawImage(tempCanvas, 0, 0, gif.width, gif.height);
					
					this.ctx.restore();
				}
			}

			const processingTime = performance.now() - startTime;
			this.frameCount++;
			this.totalTime += processingTime;

			return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

		} catch (error) {
			console.error('[GifWorker] Composite error:', error);
			return null;
		}
	}

	// Optimize GIF for performance
	optimizeGif(data) {
		const {
			gifId,
			frameImageData,
			optimizationLevel = 'medium' // 'low', 'medium', 'high'
		} = data;

		try {
			let optimizedData = frameImageData;

			switch (optimizationLevel) {
				case 'low':
					// Minimal optimization - just pass through
					break;

				case 'medium':
					// Reduce color depth slightly
					optimizedData = this.reduceColorDepth(frameImageData, 128);
					break;

				case 'high':
					// Aggressive optimization
					optimizedData = this.reduceColorDepth(frameImageData, 64);
					optimizedData = this.ditherImage(optimizedData);
					break;
			}

			return optimizedData;

		} catch (error) {
			console.error('[GifWorker] Optimization error:', error);
			return frameImageData;
		}
	}

	// Reduce color depth for optimization
	reduceColorDepth(imageData, levels) {
		const { data, width, height } = imageData;
		const newData = new Uint8ClampedArray(data.length);
		const step = 256 / levels;

		for (let i = 0; i < data.length; i += 4) {
			newData[i] = Math.floor(data[i] / step) * step;     // R
			newData[i + 1] = Math.floor(data[i + 1] / step) * step; // G
			newData[i + 2] = Math.floor(data[i + 2] / step) * step; // B
			newData[i + 3] = data[i + 3]; // A - keep alpha unchanged
		}

		return new ImageData(newData, width, height);
	}

	// Apply dithering for better gradients with reduced colors
	ditherImage(imageData) {
		// Floyd-Steinberg dithering implementation
		const { data, width, height } = imageData;
		const newData = new Uint8ClampedArray(data);

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const idx = (y * width + x) * 4;

				for (let c = 0; c < 3; c++) { // RGB channels
					const oldPixel = newData[idx + c];
					const newPixel = oldPixel < 128 ? 0 : 255;
					const error = oldPixel - newPixel;

					newData[idx + c] = newPixel;

					// Distribute error to neighboring pixels
					if (x + 1 < width) {
						newData[((y) * width + (x + 1)) * 4 + c] += error * 7 / 16;
					}
					if (y + 1 < height) {
						if (x > 0) {
							newData[((y + 1) * width + (x - 1)) * 4 + c] += error * 3 / 16;
						}
						newData[((y + 1) * width + x) * 4 + c] += error * 5 / 16;
						if (x + 1 < width) {
							newData[((y + 1) * width + (x + 1)) * 4 + c] += error * 1 / 16;
						}
					}
				}
			}
		}

		return new ImageData(newData, width, height);
	}

	// Get cached frames for GIF
	getCachedFrames(gifId) {
		return this.frameCache.get(gifId) || [];
	}

	// Clear caches
	clearCaches() {
		this.gifCache.clear();
		this.frameCache.clear();
	}

	// Get performance stats
	getPerformanceStats() {
		return {
			frameCount: this.frameCount,
			totalTime: this.totalTime,
			averageTime: this.frameCount > 0 ? this.totalTime / this.frameCount : 0,
			fps: this.frameCount > 0 ? Math.round(1000 / (this.totalTime / this.frameCount)) : 0,
			cachedGifs: this.gifCache.size,
			cachedFrames: this.frameCache.size
		};
	}
}

// Worker instance
const gifWorker = new GifWorker();

// Message handler
self.onmessage = function(event) {
	const { type, data } = event.data;

	try {
		switch (type) {
			case 'initialize':
				gifWorker.initialize(data.canvas, data.width, data.height);
				self.postMessage({ type: 'initialized', success: true });
				break;

			case 'process-gif-frame':
				const frameResult = gifWorker.processGifFrame(data);
				self.postMessage({ 
					type: 'gif-frame-processed', 
					imageData: frameResult,
					gifId: data.gifId
				});
				break;

			case 'extract-gif-frames':
				const frames = gifWorker.extractGifFrames(data);
				self.postMessage({ 
					type: 'gif-frames-extracted', 
					frames: frames,
					gifId: data.gifId
				});
				break;

			case 'composite-gifs':
				const compositeResult = gifWorker.compositeGifs(data);
				self.postMessage({ 
					type: 'gifs-composited', 
					imageData: compositeResult 
				});
				break;

			case 'optimize-gif':
				const optimizedResult = gifWorker.optimizeGif(data);
				self.postMessage({ 
					type: 'gif-optimized', 
					imageData: optimizedResult,
					gifId: data.gifId
				});
				break;

			case 'get-cached-frames':
				const cachedFrames = gifWorker.getCachedFrames(data.gifId);
				self.postMessage({ 
					type: 'cached-frames', 
					frames: cachedFrames,
					gifId: data.gifId
				});
				break;

			case 'clear-caches':
				gifWorker.clearCaches();
				self.postMessage({ type: 'caches-cleared' });
				break;

			case 'get-performance-stats':
				const stats = gifWorker.getPerformanceStats();
				self.postMessage({ 
					type: 'performance-stats', 
					stats 
				});
				break;

			default:
				console.warn('[GifWorker] Unknown message type:', type);
		}
	} catch (error) {
		console.error('[GifWorker] Message processing error:', error);
		self.postMessage({ 
			type: 'error', 
			error: error.message 
		});
	}
};