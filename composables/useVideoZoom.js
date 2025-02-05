import { ref } from "vue";

// Zoom ve Clean Zone ayarları için ref'ler
const zoomSettings = ref({
	// Zoom Geçiş Süreleri
	transition: {
		minDuration: 0.3,
		maxDuration: 1.0,
		intensityFactor: 0.5,
	},
	// Zoom Limitleri
	limits: {
		minScale: 1.0,
		maxScale: 5.0,
		defaultScale: 2.0,
	},
	// Aktif easing fonksiyonu
	easing: "easeInOutCubic",
	// Zoom yönü ayarları
	direction: {
		zoomIn: {
			blur: "inside-out", // dıştan içe blur
			distortion: "center-out", // merkezden dışa distortion
		},
		zoomOut: {
			blur: "outside-in", // içten dışa blur
			distortion: "edge-in", // kenardan içe distortion
		},
	},
});

// Blur ayarları
const blurSettings = ref({
	// Blur Limitleri
	limits: {
		minRadius: 0,
		maxRadius: 20,
		defaultRadius: 5,
	},
	// Blur geçiş ayarları
	transition: {
		duration: 0.4,
		easing: "easeOutCubic",
	},
	// Blur tipi
	type: "gaussian", // 'gaussian', 'box', 'stack'
	// Blur yoğunluğu
	intensity: 0.5,
});

// Clean Zone ayarları
const cleanZoneSettings = ref({
	// Clean Zone Limitleri
	limits: {
		radius: 100, // Varsayılan temiz bölge yarıçapı
		feather: 50, // Varsayılan yumuşatma değeri
	},
	// Aktif şekil
	shape: "circle",
});

// Easing fonksiyonları
const easingFunctions = {
	linear: (t) => t,
	easeInOutCubic: (t) =>
		t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
	easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
	easeInCubic: (t) => t * t * t,
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

	// Zoom efektlerini hesapla
	const calculateZoomEffects = (scale, progress, isZoomingIn) => {
		const direction = isZoomingIn
			? zoomSettings.value.direction.zoomIn
			: zoomSettings.value.direction.zoomOut;

		// Blur efekti için yön hesaplama
		const blurIntensity =
			direction.blur === "inside-out"
				? progress * blurSettings.value.intensity
				: (1 - progress) * blurSettings.value.intensity;

		// Distortion efekti için yön hesaplama
		const distortionCenter = direction.distortion.startsWith("center")
			? progress
			: 1 - progress;

		return {
			blur: blurIntensity * blurSettings.value.limits.maxRadius,
			distortion: distortionCenter * scale,
		};
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
			const { minDuration, maxDuration, intensityFactor } =
				zoomSettings.value.transition;
			return Math.min(
				maxDuration,
				Math.max(minDuration, intensity * intensityFactor)
			);
		};

		if (activeZoom) {
			const zoomDuration = calculateZoomDuration(activeZoom.scale);
			const segmentDuration = activeZoom.end - activeZoom.start;
			const timeFromStart = currentTime - activeZoom.start;
			const timeToEnd = activeZoom.end - currentTime;

			let segmentProgress;
			const isZoomingIn = activeZoom.scale > videoScale.value;

			if (timeFromStart < zoomDuration) {
				// Giriş animasyonu
				segmentProgress = timeFromStart / zoomDuration;
			} else if (timeToEnd < zoomDuration) {
				// Çıkış animasyonu
				segmentProgress = timeToEnd / zoomDuration;
			} else {
				// Tam zoom
				segmentProgress = 1;
			}

			// Yumuşatılmış ilerleme
			const smoothProgress = getEasingFunction()(segmentProgress);

			// Scale ve efektleri güncelle
			videoScale.value = 1 + (activeZoom.scale - 1) * smoothProgress;
			const effects = calculateZoomEffects(
				activeZoom.scale,
				smoothProgress,
				isZoomingIn
			);

			// Efektleri uygula
			applyZoomEffects(effects);

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

	// Easing fonksiyonunu al
	const getEasingFunction = () => {
		return (
			easingFunctions[zoomSettings.value.easing] ||
			easingFunctions.easeInOutCubic
		);
	};

	// Clean zone etkisini hesapla
	const calculateCleanZoneEffect = (x, y, centerX, centerY) => {
		const { radius, feather } = cleanZoneSettings.value.limits;
		const distance = Math.sqrt(
			Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
		);

		if (distance <= radius) {
			return 0; // Temiz bölgede efekt yok
		}

		if (distance >= radius + feather) {
			return 1; // Tam efekt
		}

		// Yumuşak geçiş bölgesi
		return (distance - radius) / feather;
	};

	// Zoom efektlerini uygula
	const applyZoomEffects = (effects) => {
		if (!canvasRef.value || !videoElement) return;

		const ctx = canvasRef.value.getContext("2d");
		if (!ctx) return;

		// Blur efekti
		if (effects.blur > 0) {
			ctx.filter = `blur(${effects.blur}px)`;
		}

		// Distortion efekti
		if (effects.distortion !== 1) {
			const centerX = canvasRef.value.width / 2;
			const centerY = canvasRef.value.height / 2;

			// Distortion için transform matrix'i hesapla
			const distortionMatrix = [
				effects.distortion,
				0,
				0,
				0,
				effects.distortion,
				0,
				0,
				0,
				1,
			];

			ctx.setTransform(...distortionMatrix);
			ctx.translate(
				centerX * (1 - effects.distortion),
				centerY * (1 - effects.distortion)
			);
		}

		// Clean zone efektini uygula
		if (cleanZoneSettings.value.shape === "circle") {
			const centerX = canvasRef.value.width / 2;
			const centerY = canvasRef.value.height / 2;
			const radius = cleanZoneSettings.value.limits.radius;

			ctx.save();
			ctx.beginPath();
			ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
			ctx.clip();
			// Clean zone içinde efektleri azalt
			ctx.filter = "none";
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.restore();
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
		zoomSettings,
		cleanZoneSettings,
		getEasingFunction,
		calculateCleanZoneEffect,
		blurSettings,
		calculateZoomEffects,
		applyZoomEffects,
	};
};

// Ayarları ve yardımcı fonksiyonları dışa aktar
export { zoomSettings, cleanZoneSettings, blurSettings, easingFunctions };
