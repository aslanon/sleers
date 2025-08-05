import { ref, watch, computed, onMounted, onUnmounted } from "vue";
import { useOffscreenRenderer } from "./useOffscreenRenderer";

export const useBackgroundOffscreen = () => {
	const { createOffscreenCanvas, CANVAS_TYPES } = useOffscreenRenderer();
	
	// Background cache
	const backgroundCanvas = ref(null);
	const backgroundContext = ref(null);
	const cachedBackground = ref(null);
	const backgroundHash = ref("");
	
	// Background rendering state
	const isRenderingBackground = ref(false);
	
	// Initialize offscreen canvas for background
	onMounted(() => {
		try {
			// Create offscreen canvas for background rendering
			const renderer = createOffscreenCanvas(CANVAS_TYPES.BACKGROUND, {
				width: 1920,
				height: 1080,
				useWorker: false // Background rendering is lightweight, no need for worker
			});
			
			backgroundCanvas.value = renderer.canvas;
			backgroundContext.value = renderer.context;
			
			console.log("[BackgroundOffscreen] Background offscreen canvas initialized");
		} catch (error) {
			console.error("[BackgroundOffscreen] Failed to initialize background canvas:", error);
		}
	});
	
	// Create gradient function (moved from MediaPlayer)
	const createGradient = (ctx, width, height, gradientConfig) => {
		let gradient;
		
		if (gradientConfig.type === "radial") {
			// Radial gradient
			const centerX = width / 2;
			const centerY = height / 2;
			const radius = Math.max(width, height) / 2;
			gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
		} else {
			// Linear gradient
			let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
			
			switch (gradientConfig.direction) {
				case "to-top":
					x0 = 0; y0 = height; x1 = 0; y1 = 0;
					break;
				case "to-bottom":
					x0 = 0; y0 = 0; x1 = 0; y1 = height;
					break;
				case "to-left":
					x0 = width; y0 = 0; x1 = 0; y1 = 0;
					break;
				case "to-right":
					x0 = 0; y0 = 0; x1 = width; y1 = 0;
					break;
				case "to-top-left":
					x0 = width; y0 = height; x1 = 0; y1 = 0;
					break;
				case "to-top-right":
					x0 = 0; y0 = height; x1 = width; y1 = 0;
					break;
				case "to-bottom-left":
					x0 = width; y0 = 0; x1 = 0; y1 = height;
					break;
				case "to-bottom-right":
					x0 = 0; y0 = 0; x1 = width; y1 = height;
					break;
				default: // to-bottom
					x0 = 0; y0 = 0; x1 = 0; y1 = height;
			}
			
			gradient = ctx.createLinearGradient(x0, y0, x1, y1);
		}
		
		// Add color stops
		gradientConfig.colors.forEach(colorStop => {
			gradient.addColorStop(colorStop.position / 100, colorStop.color);
		});
		
		return gradient;
	};
	
	// Generate hash for background configuration
	const generateBackgroundHash = (backgroundType, backgroundColor, backgroundGradient, backgroundImage, backgroundBlur, width, height) => {
		const config = {
			type: backgroundType,
			color: backgroundColor,
			gradient: backgroundGradient,
			image: backgroundImage,
			blur: backgroundBlur,
			width,
			height
		};
		return JSON.stringify(config);
	};
	
	// Render background to offscreen canvas
	const renderBackground = (backgroundType, backgroundColor, backgroundGradient, backgroundImage, backgroundBlur, width, height, bgImageElement = null, bgImageLoaded = false) => {
		if (!backgroundContext.value || !backgroundCanvas.value) {
			console.warn("[BackgroundOffscreen] Background canvas not initialized");
			return null;
		}
		
		// Generate hash for caching
		const newHash = generateBackgroundHash(backgroundType, backgroundColor, backgroundGradient, backgroundImage, backgroundBlur, width, height);
		
		// Return cached version if hash matches
		if (backgroundHash.value === newHash && cachedBackground.value) {
			return cachedBackground.value;
		}
		
		isRenderingBackground.value = true;
		
		try {
			const ctx = backgroundContext.value;
			
			// Resize canvas if needed
			if (backgroundCanvas.value.width !== width || backgroundCanvas.value.height !== height) {
				backgroundCanvas.value.width = width;
				backgroundCanvas.value.height = height;
			}
			
			// Clear canvas
			ctx.clearRect(0, 0, width, height);
			
			// Render background based on type
			if (backgroundType === "image" && bgImageLoaded && bgImageElement) {
				// Background Image
				const scale = Math.max(width / bgImageElement.width, height / bgImageElement.height);
				const scaledWidth = bgImageElement.width * scale;
				const scaledHeight = bgImageElement.height * scale;
				
				// Center image
				const x = (width - scaledWidth) / 2;
				const y = (height - scaledHeight) / 2;
				
				// Apply blur if needed
				if (backgroundBlur > 0) {
					ctx.filter = `blur(${backgroundBlur}px)`;
				}
				
				ctx.drawImage(bgImageElement, x, y, scaledWidth, scaledHeight);
				
				// Reset filter
				ctx.filter = "none";
			} else if (backgroundType === "gradient" && backgroundGradient && backgroundGradient.colors && backgroundGradient.colors.length > 0) {
				// Background Gradient
				const gradient = createGradient(ctx, width, height, backgroundGradient);
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, width, height);
			} else if (backgroundType === "color") {
				// Background Color
				ctx.fillStyle = backgroundColor || "#000000";
				ctx.fillRect(0, 0, width, height);
			} else {
				// Fallback - black background
				ctx.fillStyle = "#000000";
				ctx.fillRect(0, 0, width, height);
			}
			
			// Cache the result
			cachedBackground.value = backgroundCanvas.value;
			backgroundHash.value = newHash;
			
			return backgroundCanvas.value;
		} catch (error) {
			console.error("[BackgroundOffscreen] Error rendering background:", error);
			return null;
		} finally {
			isRenderingBackground.value = false;
		}
	};
	
	// Clear background cache
	const clearBackgroundCache = () => {
		cachedBackground.value = null;
		backgroundHash.value = "";
	};
	
	// Cleanup
	onUnmounted(() => {
		clearBackgroundCache();
		backgroundCanvas.value = null;
		backgroundContext.value = null;
	});
	
	return {
		// Canvas references
		backgroundCanvas,
		backgroundContext,
		
		// Rendering
		renderBackground,
		isRenderingBackground,
		
		// Cache management
		cachedBackground,
		clearBackgroundCache,
		
		// Utilities
		createGradient
	};
};