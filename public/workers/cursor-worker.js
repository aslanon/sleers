// Cursor Worker - Heavy cursor processing offloaded to worker thread
// Handles motion blur, trail effects, and complex cursor animations

class CursorWorker {
	constructor() {
		this.canvas = null;
		this.ctx = null;
		this.imageCache = new Map();
		this.blurCache = new Map();
		
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
		
		console.log('[CursorWorker] Initialized with canvas:', width, 'x', height);
	}

	// Process cursor with motion blur
	processCursorWithBlur(data) {
		const startTime = performance.now();
		
		const {
			cursorImage,
			x, y, size,
			rotation = 0,
			scale = 1,
			tilt = 0,
			skew = 0,
			blurIntensity = 0,
			blurDirection = { x: 1, y: 0 },
			hotspot = { x: 0, y: 0 }
		} = data;

		if (!this.ctx || !cursorImage) {
			return null;
		}

		try {
			// Clear canvas
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

			const cursorWidth = size * scale;
			const cursorHeight = size * scale;
			const drawX = x - hotspot.x;
			const drawY = y - hotspot.y;

			// Save context
			this.ctx.save();

			// Move to cursor center for transforms
			this.ctx.translate(drawX + cursorWidth / 2, drawY + cursorHeight / 2);

			// Apply transforms
			if (rotation !== 0) this.ctx.rotate(rotation);
			if (tilt !== 0) this.ctx.rotate(tilt);
			if (skew !== 0) this.ctx.transform(1, 0, skew, 1, 0, 0);

			// Move back to draw position
			this.ctx.translate(-cursorWidth / 2, -cursorHeight / 2);

			// Apply motion blur if intensity > 0
			if (blurIntensity > 0) {
				this.applyMotionBlur(cursorImage, cursorWidth, cursorHeight, blurIntensity, blurDirection);
			} else {
				// Draw cursor normally
				this.ctx.drawImage(cursorImage, 0, 0, cursorWidth, cursorHeight);
			}

			this.ctx.restore();

			// Update performance stats
			const processingTime = performance.now() - startTime;
			this.frameCount++;
			this.totalTime += processingTime;

			// Return processed image data
			return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

		} catch (error) {
			console.error('[CursorWorker] Processing error:', error);
			return null;
		}
	}

	// Apply motion blur effect
	applyMotionBlur(cursorImage, width, height, intensity, direction) {
		// Create blur effect with multiple copies
		const steps = Math.max(3, Math.min(10, Math.round(intensity * 15)));
		const stepX = direction.x * intensity * 8;
		const stepY = direction.y * intensity * 8;

		// Draw trail copies with decreasing opacity
		for (let i = steps - 1; i >= 0; i--) {
			const alpha = (steps - i) / steps * 0.3;
			const offsetX = -stepX * i / steps;
			const offsetY = -stepY * i / steps;
			
			this.ctx.save();
			this.ctx.globalAlpha = alpha;
			this.ctx.drawImage(cursorImage, offsetX, offsetY, width, height);
			this.ctx.restore();
		}

		// Draw main cursor on top
		this.ctx.globalAlpha = 1;
		this.ctx.drawImage(cursorImage, 0, 0, width, height);
	}

	// Process cursor trail
	processCursorTrail(data) {
		const {
			mouseHistory,
			trailLength = 10,
			trailWidth = 2,
			trailColor = 'rgba(255, 255, 255, 0.5)',
			fadeSpeed = 0.1
		} = data;

		if (!this.ctx || !mouseHistory?.length) {
			return null;
		}

		try {
			// Fade existing trail
			this.ctx.globalAlpha = 1 - fadeSpeed;
			this.ctx.globalCompositeOperation = 'destination-in';
			this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

			// Draw new trail
			this.ctx.globalAlpha = 1;
			this.ctx.globalCompositeOperation = 'source-over';
			this.ctx.strokeStyle = trailColor;
			this.ctx.lineWidth = trailWidth;
			this.ctx.lineCap = 'round';
			this.ctx.lineJoin = 'round';

			const recentHistory = mouseHistory.slice(-trailLength);
			
			if (recentHistory.length > 1) {
				this.ctx.beginPath();
				
				for (let i = 0; i < recentHistory.length - 1; i++) {
					const current = recentHistory[i];
					const next = recentHistory[i + 1];
					
					if (i === 0) {
						this.ctx.moveTo(current.x, current.y);
					}
					this.ctx.lineTo(next.x, next.y);
				}
				
				this.ctx.stroke();
			}

			return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

		} catch (error) {
			console.error('[CursorWorker] Trail processing error:', error);
			return null;
		}
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

	// Clear caches
	clearCaches() {
		this.imageCache.clear();
		this.blurCache.clear();
	}
}

// Worker instance
const cursorWorker = new CursorWorker();

// Message handler
self.onmessage = function(event) {
	const { type, data } = event.data;

	try {
		switch (type) {
			case 'initialize':
				cursorWorker.initialize(data.canvas, data.width, data.height);
				self.postMessage({ type: 'initialized', success: true });
				break;

			case 'process-cursor-blur':
				const blurResult = cursorWorker.processCursorWithBlur(data);
				self.postMessage({ 
					type: 'cursor-blur-processed', 
					imageData: blurResult,
					processingTime: performance.now() - data.startTime
				});
				break;

			case 'process-cursor-trail':
				const trailResult = cursorWorker.processCursorTrail(data);
				self.postMessage({ 
					type: 'cursor-trail-processed', 
					imageData: trailResult 
				});
				break;

			case 'get-performance-stats':
				const stats = cursorWorker.getPerformanceStats();
				self.postMessage({ 
					type: 'performance-stats', 
					stats 
				});
				break;

			case 'clear-caches':
				cursorWorker.clearCaches();
				self.postMessage({ type: 'caches-cleared' });
				break;

			default:
				console.warn('[CursorWorker] Unknown message type:', type);
		}
	} catch (error) {
		console.error('[CursorWorker] Message processing error:', error);
		self.postMessage({ 
			type: 'error', 
			error: error.message 
		});
	}
};