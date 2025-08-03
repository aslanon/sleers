import { ref, computed, watch } from "vue";

/**
 * Cursor Positioning System - Cihazlar arası tutarlı cursor positioning
 * DPR, zoom, canvas scaling ve viewport farklılıklarını normalize eder
 */
export const useCursorPositioning = () => {
	// Canvas ve viewport bilgileri
	const canvasInfo = ref({
		width: 1920,
		height: 1080,
		dpr: 1,
		clientWidth: 1920,
		clientHeight: 1080,
		offsetLeft: 0,
		offsetTop: 0
	});

	// Zoom ve transform bilgileri
	const transformInfo = ref({
		scale: 1,
		offsetX: 0,
		offsetY: 0,
		rotation: 0
	});

	// Cursor hotspot tanımları (cursor tipine göre)
	const CURSOR_HOTSPOTS = {
		default: { x: 3, y: 3 },
		pointer: { x: 3, y: 4 },
		grabbing: { x: 4, y: 5 },
		text: { x: 4, y: 5 },
		grab: { x: 4, y: 5 },
		resize: { x: 4, y: 5 }
	};

	// Cursor offset faktörleri (size'a göre)
	const CURSOR_OFFSET_FACTORS = {
		default: { x: 0.25, y: 0.15 },
		pointer: { x: 0.3, y: 0.2 },
		grabbing: { x: 0.35, y: 0.25 },
		text: { x: 0.35, y: 0.25 },
		grab: { x: 0.35, y: 0.25 },
		resize: { x: 0.35, y: 0.25 }
	};

	// Canvas bilgilerini güncelle
	const updateCanvasInfo = (canvas) => {
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;

		canvasInfo.value = {
			width: canvas.width,
			height: canvas.height,
			dpr: dpr,
			clientWidth: rect.width,
			clientHeight: rect.height,
			offsetLeft: rect.left,
			offsetTop: rect.top
		};

		console.log('[CursorPositioning] Canvas info updated:', canvasInfo.value);
	};

	// Transform bilgilerini güncelle
	const updateTransformInfo = (scale = 1, offsetX = 0, offsetY = 0, rotation = 0) => {
		transformInfo.value = {
			scale,
			offsetX,
			offsetY,
			rotation
		};
	};

	// Browser mouse pozisyonunu canvas koordinatlarına çevir
	const browserToCanvas = (browserX, browserY) => {
		const canvas = canvasInfo.value;
		const transform = transformInfo.value;

		// Browser koordinatlarını canvas client koordinatlarına çevir
		const clientX = browserX - canvas.offsetLeft;
		const clientY = browserY - canvas.offsetTop;

		// Client koordinatlarını canvas piksel koordinatlarına çevir
		const scaleX = canvas.width / canvas.clientWidth;
		const scaleY = canvas.height / canvas.clientHeight;

		let canvasX = clientX * scaleX;
		let canvasY = clientY * scaleY;

		// Transform uygulamaları (zoom, pan)
		if (transform.scale !== 1) {
			canvasX = (canvasX - transform.offsetX) / transform.scale;
			canvasY = (canvasY - transform.offsetY) / transform.scale;
		}

		// DPR normalizasyonu
		canvasX /= canvas.dpr;
		canvasY /= canvas.dpr;

		return {
			x: Math.round(canvasX),
			y: Math.round(canvasY)
		};
	};

	// Canvas koordinatlarını browser koordinatlarına çevir
	const canvasToBrowser = (canvasX, canvasY) => {
		const canvas = canvasInfo.value;
		const transform = transformInfo.value;

		// DPR uygulaması
		let x = canvasX * canvas.dpr;
		let y = canvasY * canvas.dpr;

		// Transform uygulamaları (zoom, pan)
		if (transform.scale !== 1) {
			x = x * transform.scale + transform.offsetX;
			y = y * transform.scale + transform.offsetY;
		}

		// Canvas piksel koordinatlarını client koordinatlarına çevir
		const scaleX = canvas.clientWidth / canvas.width;
		const scaleY = canvas.clientHeight / canvas.height;

		x *= scaleX;
		y *= scaleY;

		// Client koordinatlarını browser koordinatlarına çevir
		x += canvas.offsetLeft;
		y += canvas.offsetTop;

		return {
			x: Math.round(x),
			y: Math.round(y)
		};
	};

	// Cursor hotspot hesapla
	const calculateCursorHotspot = (cursorType, cursorSize) => {
		const baseHotspot = CURSOR_HOTSPOTS[cursorType] || CURSOR_HOTSPOTS.default;
		const hotspotScale = cursorSize / 20;
		const correctionFactor = 0.85 + 0.15 * (20 / Math.max(20, cursorSize));

		return {
			x: baseHotspot.x * hotspotScale * correctionFactor,
			y: baseHotspot.y * hotspotScale * correctionFactor
		};
	};

	// Cursor offset hesapla (size'a göre)
	const calculateCursorOffset = (cursorType, cursorSize) => {
		const offsetFactor = CURSOR_OFFSET_FACTORS[cursorType] || CURSOR_OFFSET_FACTORS.default;
		
		return {
			x: (cursorSize - 20) * offsetFactor.x,
			y: (cursorSize - 20) * offsetFactor.y
		};
	};

	// Normalized cursor pozisyonu hesapla (render için)
	const calculateRenderPosition = (canvasX, canvasY, cursorType, cursorSize, cursorScale = 1) => {
		const dpr = canvasInfo.value.dpr;
		
		// Hotspot hesapla
		const hotspot = calculateCursorHotspot(cursorType, cursorSize);
		
		// Offset hesapla
		const offset = calculateCursorOffset(cursorType, cursorSize);
		
		// Final cursor boyutları
		const finalWidth = cursorSize * cursorScale;
		const finalHeight = cursorSize * cursorScale;

		// Render pozisyonu hesapla
		const renderX = (canvasX * dpr) - offset.x;
		const renderY = (canvasY * dpr) - offset.y;

		return {
			x: renderX,
			y: renderY,
			width: finalWidth,
			height: finalHeight,
			hotspot: {
				x: hotspot.x * dpr,
				y: hotspot.y * dpr
			},
			offset: {
				x: offset.x * dpr,
				y: offset.y * dpr
			}
		};
	};

	// Canvas bounds içinde mi kontrol et
	const isWithinCanvas = (canvasX, canvasY) => {
		return canvasX >= 0 && 
			   canvasX <= canvasInfo.value.width && 
			   canvasY >= 0 && 
			   canvasY <= canvasInfo.value.height;
	};

	// Viewport bounds içinde mi kontrol et
	const isWithinViewport = (browserX, browserY) => {
		const canvas = canvasInfo.value;
		return browserX >= canvas.offsetLeft && 
			   browserX <= canvas.offsetLeft + canvas.clientWidth &&
			   browserY >= canvas.offsetTop && 
			   browserY <= canvas.offsetTop + canvas.clientHeight;
	};

	// Mouse event'inden normalized pozisyon al
	const getPositionFromEvent = (event) => {
		const browserX = event.clientX;
		const browserY = event.clientY;
		
		// Canvas koordinatlarına çevir
		const canvasPos = browserToCanvas(browserX, browserY);
		
		return {
			browser: { x: browserX, y: browserY },
			canvas: canvasPos,
			isWithinCanvas: isWithinCanvas(canvasPos.x, canvasPos.y),
			isWithinViewport: isWithinViewport(browserX, browserY)
		};
	};

	// Touch event'inden normalized pozisyon al
	const getPositionFromTouch = (touch) => {
		return getPositionFromEvent({
			clientX: touch.clientX,
			clientY: touch.clientY
		});
	};

	// Recorded mouse data'dan pozisyon normalize et
	const normalizeRecordedPosition = (recordedX, recordedY, recordingCanvasWidth, recordingCanvasHeight) => {
		const currentCanvas = canvasInfo.value;
		
		// Orijinal kayıt boyutlarından mevcut canvas boyutlarına scale et
		const scaleX = currentCanvas.width / recordingCanvasWidth;
		const scaleY = currentCanvas.height / recordingCanvasHeight;
		
		return {
			x: Math.round(recordedX * scaleX),
			y: Math.round(recordedY * scaleY)
		};
	};

	// Cursor collision detection (camera, GIF vs)
	const checkCollisionWithElement = (cursorX, cursorY, cursorSize, element) => {
		const {
			x: elemX,
			y: elemY,
			width: elemWidth,
			height: elemHeight
		} = element;

		const cursorRadius = cursorSize / 2;
		
		return cursorX + cursorRadius >= elemX &&
			   cursorX - cursorRadius <= elemX + elemWidth &&
			   cursorY + cursorRadius >= elemY &&
			   cursorY - cursorRadius <= elemY + elemHeight;
	};

	// Debug bilgileri
	const getDebugInfo = () => {
		return {
			canvasInfo: { ...canvasInfo.value },
			transformInfo: { ...transformInfo.value },
			timestamp: Date.now()
		};
	};

	// Test fonksiyonu - koordinat dönüşümlerini test et
	const testCoordinateTransform = (testPoints = []) => {
		const defaultTestPoints = [
			{ x: 0, y: 0 },
			{ x: 100, y: 100 },
			{ x: 500, y: 300 },
			{ x: 1000, y: 600 }
		];

		const pointsToTest = testPoints.length > 0 ? testPoints : defaultTestPoints;
		const results = [];

		pointsToTest.forEach(point => {
			const browserPos = canvasToBrowser(point.x, point.y);
			const backToCanvas = browserToCanvas(browserPos.x, browserPos.y);
			
			results.push({
				original: point,
				toBrowser: browserPos,
				backToCanvas: backToCanvas,
				isAccurate: Math.abs(point.x - backToCanvas.x) <= 1 && 
						   Math.abs(point.y - backToCanvas.y) <= 1
			});
		});

		console.log('[CursorPositioning] Coordinate transform test:', results);
		return results;
	};

	return {
		// State
		canvasInfo,
		transformInfo,
		
		// Configuration
		updateCanvasInfo,
		updateTransformInfo,
		
		// Coordinate conversion
		browserToCanvas,
		canvasToBrowser,
		
		// Cursor calculations
		calculateCursorHotspot,
		calculateCursorOffset,
		calculateRenderPosition,
		
		// Event handling
		getPositionFromEvent,
		getPositionFromTouch,
		
		// Recorded data
		normalizeRecordedPosition,
		
		// Bounds checking
		isWithinCanvas,
		isWithinViewport,
		
		// Collision detection
		checkCollisionWithElement,
		
		// Debug & testing
		getDebugInfo,
		testCoordinateTransform,
		
		// Constants
		CURSOR_HOTSPOTS,
		CURSOR_OFFSET_FACTORS
	};
};