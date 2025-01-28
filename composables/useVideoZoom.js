import { ref } from "vue";

export const useVideoZoom = (videoElement, containerRef, canvasRef) => {
	// Zoom state'leri
	const scale = ref(1);
	const videoScale = ref(1);
	const targetScale = ref(1);
	const targetPosition = ref({ x: 50, y: 50 });
	const isZoomAnimating = ref(false);
	const currentSegmentId = ref(null);
	const lastZoomPosition = ref({ x: 50, y: 50 });
	let zoomAnimationFrame = null;
	const position = ref({ x: 50, y: 50 });
	const startPosition = ref({ x: 50, y: 50 });
	const animationProgress = ref(0);
	const transitionOffset = ref({ x: 0, y: 0 }); // Geçiş animasyonu için offset
	const transitionDirection = ref(1); // 1: sağdan sola, -1: soldan sağa
	const padding = ref({ x: 0, y: 0 });

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
		if (!position || position === "center") {
			return { originX: centerX, originY: centerY };
		}

		// Position yüzdelik değerleri (0-100)
		const percentX = position.x || 50;
		const percentY = position.y || 50;

		// Padding'i hesaba kat
		const paddingX = padding.value.x;
		const paddingY = padding.value.y;

		// Normalize edilmiş koordinatlar (0-1 arasında)
		const normalizedX = percentX / 100;
		const normalizedY = percentY / 100;

		// Efektif çizim alanını hesapla
		const effectiveWidth = drawWidth - paddingX * 2;
		const effectiveHeight = drawHeight - paddingY * 2;

		// Origin'i hesapla (scale'den bağımsız)
		const originX = x + paddingX + effectiveWidth * normalizedX;
		const originY = y + paddingY + effectiveHeight * normalizedY;

		return { originX, originY };
	};

	// Cursor pozisyonunu hesapla
	const calculateCursorPosition = (mouseX, mouseY) => {
		if (!containerRef.value || !videoElement) return { x: 0, y: 0 };

		const rect = containerRef.value.getBoundingClientRect();
		const paddingX = padding.value.x;
		const paddingY = padding.value.y;

		// Mouse pozisyonunu container'a göre normalize et
		const relativeX = mouseX - rect.left;
		const relativeY = mouseY - rect.top;

		// Padding'i çıkar ve scale'i hesaba kat
		const normalizedX = (relativeX - paddingX) / (rect.width - paddingX * 2);
		const normalizedY = (relativeY - paddingY) / (rect.height - paddingY * 2);

		// 0-100 arasına çevir
		return {
			x: Math.max(0, Math.min(100, normalizedX * 100)),
			y: Math.max(0, Math.min(100, normalizedY * 100)),
		};
	};

	// Geçiş yönünü hesapla
	const calculateTransitionDirection = (currentPos, nextPos) => {
		if (!currentPos || !nextPos) return { x: 0, y: 0 };

		// X ekseni için geçiş yönü
		const xDiff = nextPos.x - currentPos.x;
		const yDiff = nextPos.y - currentPos.y;

		// Pozisyon farkına göre geçiş yönünü belirle
		// Daha dramatik bir geçiş için ekran genişliğinde offset
		return {
			x: Math.abs(xDiff) > 10 ? Math.sign(xDiff) * window.innerWidth : 0,
			y: Math.abs(yDiff) > 10 ? Math.sign(yDiff) * window.innerHeight : 0,
		};
	};

	// Zoom segmentini uygula
	const applyZoomSegment = (zoomRange, currentTime, previousSegment) => {
		if (!containerRef.value || !videoElement) return;

		// Eğer aynı segment içindeysek tekrar zoom yapma
		const segmentId = zoomRange ? `${zoomRange.start}-${zoomRange.end}` : null;
		if (segmentId === currentSegmentId.value) return;

		// Yeni segment'e geçtik, id'yi güncelle
		currentSegmentId.value = segmentId;

		// Store'dan gelen scale değerini kullan
		targetScale.value = zoomRange ? zoomRange.scale : 1;

		// Pozisyonları ayarla
		const newPosition = zoomRange?.position || { x: 50, y: 50 };

		// Eğer önceki segment varsa ve yeni segment başlıyorsa
		if (
			previousSegment &&
			zoomRange &&
			Math.abs(previousSegment.end - zoomRange.start) < 0.1
		) {
			// Animasyon başlangıç pozisyonunu önceki segmentin pozisyonuna ayarla
			startPosition.value = previousSegment.position || { x: 50, y: 50 };
			// Hedef pozisyonu yeni segmentin pozisyonuna ayarla
			targetPosition.value = newPosition;
			// Animasyon ilerlemesini sıfırla
			animationProgress.value = 0;
		} else {
			// Bitişik segment değilse direkt yeni pozisyona geç
			startPosition.value = newPosition;
			targetPosition.value = newPosition;
			position.value = newPosition;
		}

		// Animasyonu başlat
		isZoomAnimating.value = true;
		if (zoomAnimationFrame) {
			cancelAnimationFrame(zoomAnimationFrame);
		}
		zoomAnimationFrame = requestAnimationFrame(animateZoom);

		// Zoom pozisyonunu güncelle
		if (zoomRange?.position) {
			const normalizedPosition = {
				x: Math.max(0, Math.min(100, zoomRange.position.x || 50)),
				y: Math.max(0, Math.min(100, zoomRange.position.y || 50)),
			};
			lastZoomPosition.value = normalizedPosition;
		} else {
			lastZoomPosition.value = { x: 50, y: 50 };
		}
	};

	// Zoom segmentlerini kontrol et
	const checkZoomSegments = (currentTime, zoomRanges) => {
		if (!zoomRanges?.length) return null;

		// Tüm zoom segmentlerini sırala
		const sortedRanges = [...zoomRanges].sort((a, b) => a.start - b.start);

		// Aktif ve önceki zoom segmentini bul
		const activeIndex = sortedRanges.findIndex(
			(range) => currentTime >= range.start && currentTime <= range.end
		);
		const previousSegment =
			activeIndex > 0 ? sortedRanges[activeIndex - 1] : null;
		const activeZoom = sortedRanges[activeIndex];

		// Eğer bir zoom segmentinin tam başlangıcındaysak
		const startingSegment = sortedRanges.find(
			(range) => Math.abs(currentTime - range.start) < 0.1
		);

		if (startingSegment) {
			// Yeni zoom segmenti başlıyor
			applyZoomSegment(startingSegment, currentTime, previousSegment);
		} else if (!activeZoom && currentSegmentId.value) {
			// Zoom bitiyor
			applyZoomSegment(null, currentTime, previousSegment);
		}

		return activeZoom;
	};

	// Zoom animasyonu
	const animateZoom = (timestamp) => {
		if (!isZoomAnimating.value) {
			if (zoomAnimationFrame) {
				cancelAnimationFrame(zoomAnimationFrame);
				zoomAnimationFrame = null;
			}
			return;
		}

		// Daha yavaş ve yumuşak geçiş için faktörleri ayarla
		const scaleLerpFactor = 0.04;
		const positionLerpFactor = 0.03;

		// Scale'i animate et
		scale.value =
			scale.value + (targetScale.value - scale.value) * scaleLerpFactor;
		videoScale.value = scale.value;

		// Pozisyon animasyonunu güncelle
		animationProgress.value = Math.min(
			1,
			animationProgress.value + positionLerpFactor
		);

		// Ease-in-out efekti için sinüs eğrisi kullan
		const easeInOut = (t) => (1 - Math.cos(t * Math.PI)) / 2;
		const easedProgress = easeInOut(animationProgress.value);

		// Pozisyonları interpolate et
		position.value = {
			x:
				startPosition.value.x +
				(targetPosition.value.x - startPosition.value.x) * easedProgress,
			y:
				startPosition.value.y +
				(targetPosition.value.y - startPosition.value.y) * easedProgress,
		};

		// Animasyonu devam ettir veya bitir
		const scaleDiff = Math.abs(scale.value - targetScale.value);
		const isPositionAnimationComplete = animationProgress.value >= 1;

		// Önceki frame'i iptal et
		if (zoomAnimationFrame) {
			cancelAnimationFrame(zoomAnimationFrame);
			zoomAnimationFrame = null;
		}

		if (scaleDiff > 0.001 || !isPositionAnimationComplete) {
			zoomAnimationFrame = requestAnimationFrame(animateZoom);
		} else {
			isZoomAnimating.value = false;
			scale.value = targetScale.value;
			videoScale.value = targetScale.value;
			position.value = targetPosition.value;
		}

		// Canvas'ı güncelle
		if (typeof onUpdate === "function") {
			onUpdate(timestamp);
		}
	};

	// Cleanup
	const cleanup = () => {
		if (zoomAnimationFrame) {
			cancelAnimationFrame(zoomAnimationFrame);
			zoomAnimationFrame = null;
		}
		scale.value = 1;
		videoScale.value = 1;
		targetScale.value = 1;
		targetPosition.value = { x: 50, y: 50 };
		position.value = { x: 50, y: 50 };
		startPosition.value = { x: 50, y: 50 };
		animationProgress.value = 0;
		isZoomAnimating.value = false;
		currentSegmentId.value = null;
		lastZoomPosition.value = { x: 50, y: 50 };
	};

	return {
		scale,
		videoScale,
		targetScale,
		targetPosition,
		isZoomAnimating,
		lastZoomPosition,
		calculateZoomOrigin,
		calculateCursorPosition,
		applyZoomSegment,
		checkZoomSegments,
		cleanup,
	};
};
