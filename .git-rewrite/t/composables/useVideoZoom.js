import { ref } from "vue";

// Zoom Ayarları
const ZOOM_SETTINGS = {
	// Zoom Geçiş Süreleri
	TRANSITION: {
		MIN_DURATION: 0.3, // Minimum geçiş süresi (saniye)
		MAX_DURATION: 1.0, // Maksimum geçiş süresi (saniye)
		INTENSITY_FACTOR: 0.5, // Zoom şiddetine göre süre çarpanı
	},
	// Zoom Limitleri
	LIMITS: {
		MIN_SCALE: 1.0, // Minimum zoom seviyesi
		MAX_SCALE: 5.0, // Maksimum zoom seviyesi
		DEFAULT_SCALE: 2.0, // Varsayılan zoom seviyesi
	},
	// Zoom Easing Fonksiyonları
	EASING: {
		LINEAR: (t) => t,
		EASE_IN_OUT: (t) =>
			t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
		EASE_OUT: (t) => 1 - Math.pow(1 - t, 3),
		EASE_IN: (t) => t * t * t,
	},
};

// Blur Ayarları
const BLUR_SETTINGS = {
	// Blur Geçiş Süreleri
	TRANSITION: {
		MIN_DURATION: 0.2,
		MAX_DURATION: 0.8,
		DEFAULT_DURATION: 0.4,
	},
	// Blur Limitleri
	LIMITS: {
		MIN_RADIUS: 0, // Minimum blur radius
		MAX_RADIUS: 20, // Maksimum blur radius
		DEFAULT_RADIUS: 5, // Varsayılan blur radius
	},
	// Blur Tipleri
	TYPES: {
		GAUSSIAN: "gaussian",
		BOX: "box",
		STACK: "stack",
	},
};

// Distortion Ayarları
const DISTORTION_SETTINGS = {
	// Distortion Geçiş Süreleri
	TRANSITION: {
		MIN_DURATION: 0.2,
		MAX_DURATION: 0.8,
		DEFAULT_DURATION: 0.4,
	},
	// Distortion Limitleri
	LIMITS: {
		MIN_STRENGTH: 0, // Minimum distortion gücü
		MAX_STRENGTH: 1, // Maksimum distortion gücü
		DEFAULT_STRENGTH: 0.3, // Varsayılan distortion gücü
	},
	// Distortion Tipleri
	TYPES: {
		BARREL: "barrel",
		PINCUSHION: "pincushion",
		WAVE: "wave",
	},
	// Distortion Parametreleri
	PARAMS: {
		FREQUENCY: 2.0, // Dalga frekansı
		AMPLITUDE: 0.1, // Dalga genliği
		SPEED: 1.0, // Animasyon hızı
	},
};

// Timing Fonksiyonları
const TIMING_FUNCTIONS = {
	// Temel Easing Fonksiyonları
	LINEAR: (t) => t,
	EASE_IN_QUAD: (t) => t * t,
	EASE_OUT_QUAD: (t) => t * (2 - t),
	EASE_IN_OUT_QUAD: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

	// Cubic Easing Fonksiyonları
	EASE_IN_CUBIC: (t) => t * t * t,
	EASE_OUT_CUBIC: (t) => --t * t * t + 1,
	EASE_IN_OUT_CUBIC: (t) =>
		t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

	// Elastic Easing Fonksiyonları
	EASE_IN_ELASTIC: (t) => {
		const c4 = (2 * Math.PI) / 3;
		return t === 0
			? 0
			: t === 1
			? 1
			: -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
	},
	EASE_OUT_ELASTIC: (t) => {
		const c4 = (2 * Math.PI) / 3;
		return t === 0
			? 0
			: t === 1
			? 1
			: Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
	},

	// Bounce Easing Fonksiyonları
	EASE_IN_BOUNCE: (t) => 1 - TIMING_FUNCTIONS.EASE_OUT_BOUNCE(1 - t),
	EASE_OUT_BOUNCE: (t) => {
		const n1 = 7.5625;
		const d1 = 2.75;
		if (t < 1 / d1) return n1 * t * t;
		if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
		if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
		return n1 * (t -= 2.625 / d1) * t + 0.984375;
	},
};

// Clean Zone Ayarları
const CLEAN_ZONE_SETTINGS = {
	// Clean Zone Geçiş Süreleri
	TRANSITION: {
		MIN_DURATION: 0.2,
		MAX_DURATION: 0.8,
		DEFAULT_DURATION: 0.4,
	},
	// Clean Zone Limitleri
	LIMITS: {
		MIN_RADIUS: 0, // Minimum temiz bölge yarıçapı
		MAX_RADIUS: 200, // Maksimum temiz bölge yarıçapı
		DEFAULT_RADIUS: 100, // Varsayılan temiz bölge yarıçapı
		MIN_FEATHER: 0, // Minimum yumuşatma değeri
		MAX_FEATHER: 100, // Maksimum yumuşatma değeri
		DEFAULT_FEATHER: 50, // Varsayılan yumuşatma değeri
	},
	// Clean Zone Şekilleri
	SHAPES: {
		CIRCLE: "circle",
		SQUARE: "square",
		RECTANGLE: "rectangle",
	},
};

export const useVideoZoom = (videoElement, containerRef, canvasRef) => {
	// Zoom state'leri
	const scale = ref(1);
	const videoScale = ref(1);
	const targetScale = ref(1);
	const targetPosition = ref({ x: 0, y: 0 });
	const isZoomAnimating = ref(false);
	const currentSegmentId = ref(null);
	const lastZoomPosition = ref({ x: 0, y: 0 });
	let zoomAnimationFrame = null;

	// Zoom origin pozisyonlarını hesapla
	const calculateZoomOrigin = (
		position,
		x,
		y,
		drawWidth,
		drawHeight,
		centerX,
		centerY
	) => {
		let originX = position.x * 40;
		let originY = position.y * 40;

		return { originX, originY };
	};

	// Zoom segmentini uygula
	const applyZoomSegment = (zoomRange, currentTime) => {
		if (!containerRef.value || !videoElement) return;

		// Eğer aynı segment içindeysek tekrar zoom yapma
		const segmentId = zoomRange ? `${zoomRange.start}-${zoomRange.end}` : null;
		if (segmentId === currentSegmentId.value) return;

		// Yeni segment'e geçtik, id'yi güncelle
		currentSegmentId.value = segmentId;

		const container = containerRef.value.getBoundingClientRect();

		// Store'dan gelen scale değerini kullan
		targetScale.value = zoomRange ? zoomRange.scale : 1;

		// Video'nun merkez noktasını hesapla
		const centerX = container.width / 2;
		const centerY = container.height / 2;

		// Hedef pozisyonu hesapla
		targetPosition.value = {
			x: centerX - (videoElement.videoWidth * targetScale.value) / 2,
			y: centerY - (videoElement.videoHeight * targetScale.value) / 2,
		};

		// Animasyonu başlat
		isZoomAnimating.value = true;
		if (zoomAnimationFrame) {
			cancelAnimationFrame(zoomAnimationFrame);
		}
		zoomAnimationFrame = requestAnimationFrame(animateZoom);
	};

	// Zoom segmentlerini kontrol et
	const checkZoomSegments = (currentTime, zoomRanges) => {
		if (!zoomRanges) return null;

		// Tüm zoom segmentlerini sırala
		const sortedRanges = [...zoomRanges].sort((a, b) => a.start - b.start);

		// Aktif zoom segmentini bul
		const activeZoom = sortedRanges.find(
			(range) => currentTime >= range.start && currentTime <= range.end
		);

		// Easing fonksiyonu (smooth geçiş için)
		const easeInOutCubic = (t) =>
			t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

		// Zoom süresini hesapla (zoom şiddetine göre)
		const calculateZoomDuration = (scale) => {
			const intensity = Math.abs(scale - 1);
			// Maksimum 1 saniye
			return Math.min(1, Math.max(0.3, intensity * 0.5));
		};

		if (activeZoom) {
			const zoomDuration = calculateZoomDuration(activeZoom.scale);
			const segmentDuration = activeZoom.end - activeZoom.start;

			// Segment başlangıcından itibaren geçen süre
			const timeFromStart = currentTime - activeZoom.start;
			// Segment sonuna kalan süre
			const timeToEnd = activeZoom.end - currentTime;

			let segmentProgress;

			if (timeFromStart < zoomDuration) {
				// Giriş animasyonu (segment başında)
				segmentProgress = timeFromStart / zoomDuration;
			} else if (timeToEnd < zoomDuration) {
				// Çıkış animasyonu (segment sonuna 1 saniye kala)
				segmentProgress = timeToEnd / zoomDuration;
			} else {
				// Tam zoom
				segmentProgress = 1;
			}

			// Başlangıç ve hedef scale değerleri
			const startScale = 1;
			const targetScale = activeZoom.scale;

			// Yumuşatılmış ilerleme
			const smoothProgress = easeInOutCubic(segmentProgress);

			// Scale değerini güncelle
			videoScale.value =
				startScale + (targetScale - startScale) * smoothProgress;

			// Zoom pozisyonunu güncelle
			if (activeZoom.position) {
				lastZoomPosition.value = activeZoom.position;
			}
		} else {
			// Segment dışındaysa varsayılan değerlere dön
			videoScale.value = 1;
			lastZoomPosition.value = null;
		}

		return activeZoom;
	};

	// Zoom animasyonu
	const animateZoom = (timestamp) => {
		if (!isZoomAnimating.value) return;

		// Canvas'ı güncelle
		if (typeof onUpdate === "function") {
			onUpdate(timestamp);
		}

		// Animasyon frame'ini devam ettir
		zoomAnimationFrame = requestAnimationFrame(animateZoom);
	};

	// Cleanup
	const cleanup = () => {
		if (zoomAnimationFrame) {
			cancelAnimationFrame(zoomAnimationFrame);
			zoomAnimationFrame = null;
		}
	};

	return {
		scale,
		videoScale,
		targetScale,
		targetPosition,
		isZoomAnimating,
		lastZoomPosition,
		calculateZoomOrigin,
		applyZoomSegment,
		checkZoomSegments,
		cleanup,
		// Ayarları dışa aktar
		ZOOM_SETTINGS,
		BLUR_SETTINGS,
		DISTORTION_SETTINGS,
		TIMING_FUNCTIONS,
		CLEAN_ZONE_SETTINGS,
	};
};

// Ayarları doğrudan dışa aktar
export {
	ZOOM_SETTINGS,
	BLUR_SETTINGS,
	DISTORTION_SETTINGS,
	TIMING_FUNCTIONS,
	CLEAN_ZONE_SETTINGS,
};
