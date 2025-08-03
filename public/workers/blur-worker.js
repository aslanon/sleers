// Blur Worker - Advanced blur effects processing
// Handles motion blur, gaussian blur, directional blur, and other visual effects

class BlurWorker {
	constructor() {
		this.canvas = null;
		this.ctx = null;
		this.tempCanvas = null;
		this.tempCtx = null;
		
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
		
		// Create temporary canvas for multi-pass effects
		this.tempCanvas = new OffscreenCanvas(width, height);
		this.tempCtx = this.tempCanvas.getContext('2d');
		
		console.log('[BlurWorker] Initialized with canvas:', width, 'x', height);
	}

	// Apply motion blur effect
	applyMotionBlur(data) {
		const startTime = performance.now();
		
		const {
			sourceImageData,
			blurIntensity = 5,
			direction = { x: 1, y: 0 },
			steps = 8
		} = data;

		if (!this.ctx || !sourceImageData) {
			return null;
		}

		try {
			// Clear canvases
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);

			// Put source image data to temp canvas
			this.tempCtx.putImageData(sourceImageData, 0, 0);

			// Calculate step offsets
			const stepX = direction.x * blurIntensity;
			const stepY = direction.y * blurIntensity;

			// Apply motion blur with multiple copies
			this.ctx.save();
			
			for (let i = 0; i < steps; i++) {
				const alpha = (steps - i) / steps * 0.3;
				const offsetX = -stepX * i / steps;
				const offsetY = -stepY * i / steps;
				
				this.ctx.globalAlpha = alpha;
				this.ctx.drawImage(this.tempCanvas, offsetX, offsetY);
			}
			
			// Draw original on top
			this.ctx.globalAlpha = 1;
			this.ctx.drawImage(this.tempCanvas, 0, 0);
			
			this.ctx.restore();

			// Update performance stats
			const processingTime = performance.now() - startTime;
			this.frameCount++;
			this.totalTime += processingTime;

			return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

		} catch (error) {
			console.error('[BlurWorker] Motion blur error:', error);
			return null;
		}
	}

	// Apply gaussian blur (using filter)
	applyGaussianBlur(data) {
		const startTime = performance.now();
		
		const {
			sourceImageData,
			blurRadius = 5
		} = data;

		if (!this.ctx || !sourceImageData) {
			return null;
		}

		try {
			// Clear canvas
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			
			// Put source image data to temp canvas
			this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
			this.tempCtx.putImageData(sourceImageData, 0, 0);

			// Apply gaussian blur
			this.ctx.filter = `blur(${blurRadius}px)`;
			this.ctx.drawImage(this.tempCanvas, 0, 0);
			this.ctx.filter = 'none';

			const processingTime = performance.now() - startTime;
			this.frameCount++;
			this.totalTime += processingTime;

			return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

		} catch (error) {
			console.error('[BlurWorker] Gaussian blur error:', error);
			return null;
		}
	}

	// Apply directional blur
	applyDirectionalBlur(data) {
		const startTime = performance.now();
		
		const {
			sourceImageData,
			blurDistance = 10,
			angle = 0, // radians
			samples = 12
		} = data;

		if (!this.ctx || !sourceImageData) {
			return null;
		}

		try {
			// Clear canvases
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);

			// Put source image data to temp canvas
			this.tempCtx.putImageData(sourceImageData, 0, 0);

			// Calculate direction vector
			const dirX = Math.cos(angle);
			const dirY = Math.sin(angle);

			// Apply directional blur
			this.ctx.save();
			
			for (let i = 0; i < samples; i++) {
				const t = (i - samples / 2) / samples;
				const offsetX = dirX * blurDistance * t;
				const offsetY = dirY * blurDistance * t;
				
				this.ctx.globalAlpha = 1 / samples;
				this.ctx.drawImage(this.tempCanvas, offsetX, offsetY);
			}
			
			this.ctx.restore();

			const processingTime = performance.now() - startTime;
			this.frameCount++;
			this.totalTime += processingTime;

			return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

		} catch (error) {
			console.error('[BlurWorker] Directional blur error:', error);
			return null;
		}
	}

	// Apply radial blur
	applyRadialBlur(data) {
		const startTime = performance.now();
		
		const {
			sourceImageData,
			centerX,
			centerY,
			blurAmount = 0.1,
			samples = 8
		} = data;

		if (!this.ctx || !sourceImageData) {
			return null;
		}

		try {
			// Clear canvases
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);

			// Put source image data to temp canvas
			this.tempCtx.putImageData(sourceImageData, 0, 0);

			// Apply radial blur
			this.ctx.save();
			this.ctx.translate(centerX, centerY);
			
			for (let i = 0; i < samples; i++) {
				const scale = 1 + (blurAmount * i / samples);
				
				this.ctx.save();
				this.ctx.scale(scale, scale);
				this.ctx.globalAlpha = 1 / samples;
				this.ctx.drawImage(this.tempCanvas, -centerX, -centerY);
				this.ctx.restore();
			}
			
			this.ctx.restore();

			const processingTime = performance.now() - startTime;
			this.frameCount++;
			this.totalTime += processingTime;

			return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

		} catch (error) {
			console.error('[BlurWorker] Radial blur error:', error);
			return null;
		}
	}

	// Apply box blur (fast approximation)
	applyBoxBlur(data) {
		const startTime = performance.now();
		
		const {
			sourceImageData,
			blurRadius = 3,
			iterations = 3
		} = data;

		if (!this.ctx || !sourceImageData) {
			return null;
		}

		try {
			let imageData = sourceImageData;
			
			// Apply box blur multiple times for gaussian approximation
			for (let i = 0; i < iterations; i++) {
				imageData = this.boxBlurPass(imageData, blurRadius);
			}

			const processingTime = performance.now() - startTime;
			this.frameCount++;
			this.totalTime += processingTime;

			return imageData;

		} catch (error) {
			console.error('[BlurWorker] Box blur error:', error);
			return null;
		}
	}

	// Single pass of box blur
	boxBlurPass(imageData, radius) {
		const { data, width, height } = imageData;
		const outputData = new Uint8ClampedArray(data.length);
		
		// Horizontal pass
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				let r = 0, g = 0, b = 0, a = 0;
				let count = 0;
				
				for (let dx = -radius; dx <= radius; dx++) {
					const sx = Math.max(0, Math.min(width - 1, x + dx));
					const idx = (y * width + sx) * 4;
					
					r += data[idx];
					g += data[idx + 1];
					b += data[idx + 2];
					a += data[idx + 3];
					count++;
				}
				
				const outIdx = (y * width + x) * 4;
				outputData[outIdx] = r / count;
				outputData[outIdx + 1] = g / count;
				outputData[outIdx + 2] = b / count;
				outputData[outIdx + 3] = a / count;
			}
		}
		
		return new ImageData(outputData, width, height);
	}

	// Get performance stats
	getPerformanceStats() {
		return {
			frameCount: this.frameCount,
			totalTime: this.totalTime,
			averageTime: this.frameCount > 0 ? this.totalTime / this.frameCount : 0,
			fps: this.frameCount > 0 ? Math.round(1000 / (this.totalTime / this.frameCount)) : 0
		};
	}
}

// Worker instance
const blurWorker = new BlurWorker();

// Message handler
self.onmessage = function(event) {
	const { type, data } = event.data;

	try {
		switch (type) {
			case 'initialize':
				blurWorker.initialize(data.canvas, data.width, data.height);
				self.postMessage({ type: 'initialized', success: true });
				break;

			case 'apply-motion-blur':
				const motionResult = blurWorker.applyMotionBlur(data);
				self.postMessage({ 
					type: 'motion-blur-applied', 
					imageData: motionResult 
				});
				break;

			case 'apply-gaussian-blur':
				const gaussianResult = blurWorker.applyGaussianBlur(data);
				self.postMessage({ 
					type: 'gaussian-blur-applied', 
					imageData: gaussianResult 
				});
				break;

			case 'apply-directional-blur':
				const directionalResult = blurWorker.applyDirectionalBlur(data);
				self.postMessage({ 
					type: 'directional-blur-applied', 
					imageData: directionalResult 
				});
				break;

			case 'apply-radial-blur':
				const radialResult = blurWorker.applyRadialBlur(data);
				self.postMessage({ 
					type: 'radial-blur-applied', 
					imageData: radialResult 
				});
				break;

			case 'apply-box-blur':
				const boxResult = blurWorker.applyBoxBlur(data);
				self.postMessage({ 
					type: 'box-blur-applied', 
					imageData: boxResult 
				});
				break;

			case 'get-performance-stats':
				const stats = blurWorker.getPerformanceStats();
				self.postMessage({ 
					type: 'performance-stats', 
					stats 
				});
				break;

			default:
				console.warn('[BlurWorker] Unknown message type:', type);
		}
	} catch (error) {
		console.error('[BlurWorker] Message processing error:', error);
		self.postMessage({ 
			type: 'error', 
			error: error.message 
		});
	}
};