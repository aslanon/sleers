import { ref, computed, readonly } from "vue";

// Canvas zoom için state'ler - gerçek viewport zoom
const canvasZoomScale = ref(1);
const canvasZoomOrigin = ref({ x: 50, y: 50 }); // Percentage based
const isCanvasZoomTransitioning = ref(false);
const targetCanvasZoomScale = ref(1);

// Off-screen canvas for true viewport zoom
let offscreenCanvas = null;
let offscreenCtx = null;

// Canvas viewport bilgileri - gerçek zoom için
const canvasViewport = ref({
	// Kaynak canvas'tan alınacak alan
	sourceX: 0,
	sourceY: 0,
	sourceWidth: 0,
	sourceHeight: 0,
	scale: 1,
});

// Easing fonksiyonları
const easingFunctions = {
	easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
	easeInOutCubic: (t) =>
		t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
	easeInOutQuart: (t) =>
		t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
};

export const useCanvasZoom = () => {
	// Off-screen canvas'ı hazırla
	const initOffscreenCanvas = (width, height) => {
		if (
			!offscreenCanvas ||
			offscreenCanvas.width !== width ||
			offscreenCanvas.height !== height
		) {
			offscreenCanvas = document.createElement("canvas");
			offscreenCanvas.width = width;
			offscreenCanvas.height = height;
			offscreenCtx = offscreenCanvas.getContext("2d", {
				alpha: true,
				desynchronized: false,
				willReadFrequently: false,
				preserveDrawingBuffer: true,
				antialias: true,
			});

			// Canvas kalite ayarları
			offscreenCtx.imageSmoothingEnabled = true;
			offscreenCtx.imageSmoothingQuality = "high";
		}
		return offscreenCtx;
	};

	// Canvas zoom state'lerini döndür
	const getCanvasZoomState = () => ({
		scale: canvasZoomScale.value,
		origin: canvasZoomOrigin.value,
		isTransitioning: isCanvasZoomTransitioning.value,
		viewport: canvasViewport.value,
	});

	// Canvas viewport'unu hesapla - gerçek zoom viewport
	const calculateCanvasViewport = (
		canvasWidth,
		canvasHeight,
		scale,
		originPercent
	) => {
		if (scale <= 1.001) {
			return {
				sourceX: 0,
				sourceY: 0,
				sourceWidth: canvasWidth,
				sourceHeight: canvasHeight,
				scale: 1,
			};
		}

		// Zoom merkezi hesapla (canvas koordinatlarında)
		const centerX = (canvasWidth * originPercent.x) / 100;
		const centerY = (canvasHeight * originPercent.y) / 100;

		// Zoom yapıldığında görünecek alan boyutu (off-screen canvas'ta)
		const viewWidth = canvasWidth / scale;
		const viewHeight = canvasHeight / scale;

		// Zoom merkezini koruyarak görünür alanın başlangıç noktasını hesapla
		let sourceX = centerX - viewWidth / 2;
		let sourceY = centerY - viewHeight / 2;

		// Sınırları kontrol et
		sourceX = Math.max(0, Math.min(canvasWidth - viewWidth, sourceX));
		sourceY = Math.max(0, Math.min(canvasHeight - viewHeight, sourceY));

		return {
			sourceX,
			sourceY,
			sourceWidth: viewWidth,
			sourceHeight: viewHeight,
			scale,
		};
	};

	// Canvas viewport zoom'u başlat - off-screen canvas kullan
	const beginCanvasZoom = (canvasWidth, canvasHeight) => {
		// Viewport hesapla
		const viewport = calculateCanvasViewport(
			canvasWidth,
			canvasHeight,
			canvasZoomScale.value,
			canvasZoomOrigin.value
		);

		canvasViewport.value = viewport;

		if (viewport.scale > 1.001) {
			// Off-screen canvas'ı hazırla
			return initOffscreenCanvas(canvasWidth, canvasHeight);
		}

		return null;
	};

	// Canvas zoom'u tamamla - off-screen'den ana canvas'a kopyala
	const finishCanvasZoom = (mainCtx, canvasWidth, canvasHeight) => {
		const viewport = canvasViewport.value;

		if (viewport.scale <= 1.001 || !offscreenCanvas) {
			return false;
		}

		// Ana canvas'ı temizle
		mainCtx.clearRect(0, 0, canvasWidth, canvasHeight);

		// Off-screen canvas'ın belirtilen bölümünü ana canvas'a zoom yaparak kopyala
		mainCtx.drawImage(
			offscreenCanvas,
			viewport.sourceX,
			viewport.sourceY, // Kaynak başlangıç
			viewport.sourceWidth,
			viewport.sourceHeight, // Kaynak boyut
			0,
			0, // Hedef başlangıç
			canvasWidth,
			canvasHeight // Hedef boyut (zoom effect)
		);

		return true;
	};

	// Mouse pozisyonunu zoom origin olarak ayarla
	const setZoomOriginFromMouse = (
		mouseX,
		mouseY,
		canvasWidth,
		canvasHeight
	) => {
		canvasZoomOrigin.value = {
			x: (mouseX / canvasWidth) * 100,
			y: (mouseY / canvasHeight) * 100,
		};
	};

	// Zoom segmentlerini kontrol et ve canvas zoom'u uygula
	const checkAndApplyCanvasZoom = (
		currentTime,
		zoomRanges,
		mousePosition = null
	) => {
		if (!zoomRanges || zoomRanges.length === 0) {
			// Zoom segment yok, normale dön
			targetCanvasZoomScale.value = 1;
			updateCanvasZoomScale();
			return null;
		}

		// Aktif zoom segmentini bul
		const activeZoom = zoomRanges.find(
			(range) => currentTime >= range.start && currentTime <= range.end
		);

		if (activeZoom) {
			// Zoom segment içindeyiz
			const timeFromStart = currentTime - activeZoom.start;
			const timeToEnd = activeZoom.end - currentTime;
			const transitionDuration = 0.5; // Daha uzun geçiş süresi

			let segmentProgress;
			if (timeFromStart < transitionDuration) {
				// Giriş animasyonu
				segmentProgress = timeFromStart / transitionDuration;
			} else if (timeToEnd < transitionDuration) {
				// Çıkış animasyonu
				segmentProgress = timeToEnd / transitionDuration;
			} else {
				// Tam zoom
				segmentProgress = 1;
			}

			// Smooth progress hesapla - daha yumuşak easing
			const smoothProgress = easingFunctions.easeInOutQuart(segmentProgress);
			targetCanvasZoomScale.value = 1 + (activeZoom.scale - 1) * smoothProgress;

			// 🎯 Cursor tracking: Zoom origin'i mouse pozisyonuna göre güncelle
			if (
				mousePosition &&
				mousePosition.x !== undefined &&
				mousePosition.y !== undefined
			) {
				// Mouse pozisyonunu canvas koordinatlarından yüzde'ye çevir
				// Zoom origin güncellemesi smooth olmalı
				const targetOriginX =
					(mousePosition.x / (mousePosition.canvasWidth || 1920)) * 100;
				const targetOriginY =
					(mousePosition.y / (mousePosition.canvasHeight || 1080)) * 100;

				// Smooth origin interpolation
				const originLerpFactor = 0.05; // Daha yavaş origin takibi
				canvasZoomOrigin.value = {
					x:
						canvasZoomOrigin.value.x +
						(targetOriginX - canvasZoomOrigin.value.x) * originLerpFactor,
					y:
						canvasZoomOrigin.value.y +
						(targetOriginY - canvasZoomOrigin.value.y) * originLerpFactor,
				};
			} else if (activeZoom.origin) {
				// Tanımlanmış origin varsa onu kullan
				const originLerpFactor = 0.05;
				canvasZoomOrigin.value = {
					x:
						canvasZoomOrigin.value.x +
						(activeZoom.origin.x - canvasZoomOrigin.value.x) * originLerpFactor,
					y:
						canvasZoomOrigin.value.y +
						(activeZoom.origin.y - canvasZoomOrigin.value.y) * originLerpFactor,
				};
			}
		} else {
			// Zoom segment dışında, normale dön
			targetCanvasZoomScale.value = 1;
		}

		updateCanvasZoomScale();
		return activeZoom;
	};

	// Canvas zoom scale'ini yumuşak bir şekilde güncelle
	const updateCanvasZoomScale = () => {
		const prevScale = canvasZoomScale.value;
		const targetScale = targetCanvasZoomScale.value;
		
		// Zoom in ve zoom out için farklı hızlar kullan
		const isZoomingIn = targetScale > prevScale;
		const isZoomingOut = targetScale < prevScale;
		
		// Zoom in için daha yumuşak geçiş (zoom out ile aynı hız)
		let lerpFactor;
		if (isZoomingIn) {
			lerpFactor = 0.08; // Zoom in için yumuşak geçiş
		} else if (isZoomingOut) {
			lerpFactor = 0.08; // Zoom out için yumuşak geçiş (önceki gibi)
		} else {
			lerpFactor = 0.08; // Sabit zoom için
		}

		canvasZoomScale.value =
			canvasZoomScale.value +
			(targetCanvasZoomScale.value - canvasZoomScale.value) * lerpFactor;

		// Geçiş durumunu kontrol et - threshold daha düşük
		const scaleVelocity = Math.abs(canvasZoomScale.value - prevScale);
		isCanvasZoomTransitioning.value = scaleVelocity > 0.005;
	};

	// Manuel zoom ayarla (kullanıcı interaksiyonu için)
	const setCanvasZoom = (scale, originPercent = null) => {
		targetCanvasZoomScale.value = Math.max(0.5, Math.min(3.0, scale));

		if (originPercent) {
			canvasZoomOrigin.value = originPercent;
		}

		updateCanvasZoomScale();
	};

	// Zoom'u sıfırla
	const resetCanvasZoom = () => {
		targetCanvasZoomScale.value = 1;
		canvasZoomOrigin.value = { x: 50, y: 50 };
		updateCanvasZoomScale();
	};

	// Mouse wheel zoom desteği
	const handleWheelZoom = (
		event,
		mouseX,
		mouseY,
		canvasWidth,
		canvasHeight
	) => {
		event.preventDefault();

		const zoomSensitivity = 0.1;
		const deltaScale = event.deltaY > 0 ? -zoomSensitivity : zoomSensitivity;
		const newScale = canvasZoomScale.value + deltaScale;

		// Zoom origin'ini mouse pozisyonuna ayarla
		setZoomOriginFromMouse(mouseX, mouseY, canvasWidth, canvasHeight);

		// Zoom uygula
		setCanvasZoom(newScale);
	};

	// Computed properties
	const isZoomed = computed(() => canvasZoomScale.value > 1.001);
	const zoomPercentage = computed(() =>
		Math.round(canvasZoomScale.value * 100)
	);

	return {
		// State
		canvasZoomScale: readonly(canvasZoomScale),
		canvasZoomOrigin: readonly(canvasZoomOrigin),
		isCanvasZoomTransitioning: readonly(isCanvasZoomTransitioning),
		canvasViewport: readonly(canvasViewport),

		// Computed
		isZoomed,
		zoomPercentage,

		// Methods
		getCanvasZoomState,
		calculateCanvasViewport,
		beginCanvasZoom,
		finishCanvasZoom,
		setZoomOriginFromMouse,
		checkAndApplyCanvasZoom,
		updateCanvasZoomScale,
		setCanvasZoom,
		resetCanvasZoom,
		handleWheelZoom,

		// Utilities
		easingFunctions,
	};
};
