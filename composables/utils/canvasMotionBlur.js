/**
 * Enhanced Canvas Motion Blur Implementation for Custom Cursors
 * Based on the provided blur example but optimized for cursor rendering
 */

export class CanvasFastBlur {
	constructor(options = {}) {
		this.blurRadius = options.blur || 3;
		this.canvas = null;
		this.ctx = null;
		this.canvas_off = null;
		this.ctx_off = null;
		this.isInitialized = false;
	}

	/**
	 * Initialize canvas for blur operations
	 * @param {HTMLCanvasElement} canvas - The canvas to apply blur to
	 */
	initCanvas(canvas) {
		if (!canvas) {
			return false;
		}

		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");

		if (!this.ctx) {
			return false;
		}

		const w = canvas.width;
		const h = canvas.height;

		// Create offscreen canvas for blur processing
		this.canvas_off = document.createElement("canvas");
		this.ctx_off = this.canvas_off.getContext("2d");
		this.canvas_off.width = w;
		this.canvas_off.height = h;

		// Copy current canvas content to offscreen canvas
		this.ctx_off.drawImage(canvas, 0, 0);

		this.isInitialized = true;
		return true;
	}

	/**
	 * Save current canvas state to offscreen buffer
	 * Useful for preserving cursor image before applying blur
	 */
	saveCanvasState() {
		if (!this.isInitialized) return false;

		const w = this.canvas.width;
		const h = this.canvas.height;

		// Ensure offscreen canvas matches main canvas size
		if (this.canvas_off.width !== w || this.canvas_off.height !== h) {
			this.canvas_off.width = w;
			this.canvas_off.height = h;
		}

		this.ctx_off.clearRect(0, 0, w, h);
		this.ctx_off.drawImage(this.canvas, 0, 0);
		return true;
	}

	/**
	 * Restore canvas from offscreen buffer
	 */
	recoverCanvas() {
		if (!this.isInitialized) return false;

		const w = this.canvas_off.width;
		const h = this.canvas_off.height;
		this.canvas.width = w;
		this.canvas.height = h;
		this.ctx.drawImage(this.canvas_off, 0, 0);
		return true;
	}

	/**
	 * Apply Gaussian blur to the canvas
	 * @param {number} blur - Blur radius (default: uses instance blurRadius)
	 */
	gBlur(blur = null) {
		if (!this.isInitialized) {
			return false;
		}

		const start = Date.now();
		blur = blur ?? this.blurRadius;

		const canvas = this.canvas;
		const ctx = this.ctx;

		let sum = 0;
		const delta = 5;
		const alpha_left = 1 / (2 * Math.PI * delta * delta);
		const step = blur < 3 ? 1 : 2;

		// Calculate weight sum for normalization
		for (let y = -blur; y <= blur; y += step) {
			for (let x = -blur; x <= blur; x += step) {
				const weight =
					alpha_left * Math.exp(-(x * x + y * y) / (2 * delta * delta));
				sum += weight;
			}
		}

		// Apply Gaussian blur
		for (let y = -blur; y <= blur; y += step) {
			for (let x = -blur; x <= blur; x += step) {
				const weight =
					alpha_left * Math.exp(-(x * x + y * y) / (2 * delta * delta));
				ctx.globalAlpha = (weight / sum) * blur;
				ctx.drawImage(canvas, x, y);
			}
		}

		ctx.globalAlpha = 1;
		return true;
	}

	/**
	 * Apply motion blur effect optimized for cursor movement
	 * @param {number} distance - Motion blur distance/intensity
	 * @param {Object} options - Additional options for cursor motion blur
	 */
	mBlur(distance, direction = { x: 0, y: 0 }) {
		if (!this.isInitialized) {
			return false;
		}

		distance = Math.max(0, distance);

		const w = this.canvas.width;
		const h = this.canvas.height;
		this.canvas.width = w;
		this.canvas.height = h;
		const ctx = this.ctx;
		ctx.clearRect(0, 0, w, h);

		const canvas_off = this.canvas_off;

		// Hareket yönüne göre directional blur - gölgelenme azaltılmış, scale olmadan
		for (let n = 0; n < 5; n += 0.15) {
			// Daha büyük step = daha az overlap
			const alpha = (1 / (4 * n + 1)) * 0.4; // Daha düşük alpha (0.6→0.4) ve daha hızlı fade (3→4)
			ctx.globalAlpha = Math.max(alpha, 0.05); // Minimum alpha limiti

			// Scale efektini kaldır - cursor aynı boyutta kalır
			// const scale = distance / 5 * n;

			// Hareket yönünün tersine doğru offset
			const offsetX = -direction.x * distance * n * 6; // 8→6 daha az uzaklık
			const offsetY = -direction.y * distance * n * 6;

			ctx.save();
			ctx.globalCompositeOperation = "source-over"; // Normal blending
			// Scale olmadan sadece position offset uygula
			ctx.transform(1, 0, 0, 1, offsetX, offsetY);
			ctx.drawImage(canvas_off, 0, 0);
			ctx.restore();
		}

		ctx.globalAlpha = 1;
		return true;
	}

	/**
	 * Apply directional motion blur based on cursor movement
	 * @param {Object} motionData - Motion information
	 */
	directionalMotionBlur(motionData) {
		if (!this.isInitialized) return false;

		const {
			speed = 0,
			angle = 0,
			intensity = 1,
			maxDistance = 10,
		} = motionData;

		// Calculate blur distance based on speed
		const blurDistance = Math.min(speed * 0.08 * intensity, maxDistance); // Reduced multiplier for more subtle effect

		if (blurDistance < 0.3) {
			return false; // Skip blur for very small movements
		}

		// Calculate velocity components from angle
		const velocityX = Math.cos(angle);
		const velocityY = Math.sin(angle);

		return this.mBlur(blurDistance, {
			velocityX,
			velocityY,
			steps: Math.min(Math.max(Math.floor(blurDistance * 0.8), 2), 6), // Fewer steps for performance
			stepSize: 0.2, // Larger step size
			maxAlpha: Math.min(0.7, 0.4 + intensity * 0.3), // Reduced alpha for more subtle effect
		});
	}

	/**
	 * Optimize blur for cursor-specific rendering
	 * @param {Object} cursorData - Cursor-specific data
	 */
	cursorOptimizedBlur(cursorData) {
		if (!this.isInitialized) return false;

		const {
			speed = 0,
			acceleration = 0,
			size = 80,
			type = "default",
			intensity = 1,
		} = cursorData;

		// Adaptive blur based on cursor properties
		let blurRadius = this.blurRadius;

		// Adjust blur based on cursor size
		const sizeMultiplier = Math.max(0.5, Math.min(2, size / 80));
		blurRadius *= sizeMultiplier;

		// Adjust blur based on acceleration
		if (acceleration > 15) {
			blurRadius *= 1.5;
		}

		// Different blur strategies for different cursor types
		if (type === "pointer" || type === "text") {
			// More precise cursors need less blur
			blurRadius *= 0.8;
		} else if (type === "grabbing") {
			// Grabbing cursor can have more blur
			blurRadius *= 1.2;
		}

		// Apply speed-based motion blur
		const motionDistance = Math.min(speed * 0.08 * intensity, 8);

		if (motionDistance > 0.5) {
			return this.mBlur(motionDistance, {
				steps: 4,
				stepSize: 0.2,
				maxAlpha: 0.7,
			});
		} else if (speed > 10) {
			// Apply subtle Gaussian blur for medium speeds
			return this.gBlur(Math.min(blurRadius * 0.5, 2));
		}

		return false;
	}

	/**
	 * Clean up resources
	 */
	destroy() {
		if (this.canvas_off) {
			this.canvas_off = null;
			this.ctx_off = null;
		}
		this.canvas = null;
		this.ctx = null;
		this.isInitialized = false;
	}
}

/**
 * Factory function to create and initialize a blur instance
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {Object} options - Blur configuration
 */
export function createCursorBlur(canvas, options = {}) {
	const blur = new CanvasFastBlur(options);
	if (blur.initCanvas(canvas)) {
		return blur;
	}
	return null;
}

/**
 * Utility function to apply quick motion blur to cursor
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {Object} motionData - Motion information
 */
export function applyQuickMotionBlur(canvas, motionData) {
	const blur = createCursorBlur(canvas);
	if (!blur) return false;

	blur.saveCanvasState();
	const result = blur.directionalMotionBlur(motionData);
	blur.destroy();

	return result;
}

export default CanvasFastBlur;
