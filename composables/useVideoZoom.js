import { ref } from "vue";

export const useVideoZoom = (videoElement, containerRef, canvasRef) => {
	// Zoom state'leri
	const scale = ref(1);
	const videoScale = ref(1);
	const targetScale = ref(1);
	const targetPosition = ref({ x: 0, y: 0 });
	const isZoomAnimating = ref(false);
	const currentSegmentId = ref(null);
	const lastZoomPosition = ref(null);
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
		// position artık { x, y } şeklinde yüzdelik değerler içeriyor
		const relativeX = position.x / 100; // 0-1 arası değere dönüştür
		const relativeY = position.y / 100;

		// Kenar sınırlarını hesapla
		const originX = x + (drawWidth * relativeX);
		const originY = y + (drawHeight * relativeY);

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

		// Eğer bir zoom segmentinin tam başlangıcındaysak
		const startingSegment = sortedRanges.find(
			(range) => Math.abs(currentTime - range.start) < 0.1 // 100ms tolerans
		);

		// Eğer bir zoom segmentinin tam bitişindeysek
		const endingSegment = sortedRanges.find(
			(range) => Math.abs(currentTime - range.end) < 0.1 // 100ms tolerans
		);

		if (startingSegment) {
			// Yeni zoom segmenti başlıyor
			if (startingSegment !== currentSegmentId.value) {
				applyZoomSegment(startingSegment, currentTime);
			}
		} else if (endingSegment || (!activeZoom && currentSegmentId.value)) {
			applyZoomSegment(null, currentTime);
			// Zoom tamamen bittiğinde son pozisyonu sıfırla
			if (videoScale.value <= 1.001) {
				lastZoomPosition.value = null;
			}
		}

		return activeZoom;
	};

	// Zoom animasyonu
	const animateZoom = (timestamp) => {
		if (!isZoomAnimating.value) return;

		// Smooth lerp için faktör (0-1 arası)
		const lerpFactor = 0.1;

		// Scale'i animate et
		scale.value = scale.value + (targetScale.value - scale.value) * lerpFactor;

		// Pozisyonu animate et
		position.value = {
			x:
				position.value.x +
				(targetPosition.value.x - position.value.x) * lerpFactor,
			y:
				position.value.y +
				(targetPosition.value.y - position.value.y) * lerpFactor,
		};

		// Animasyonu devam ettir veya bitir
		const scaleDiff = Math.abs(scale.value - targetScale.value);
		const posDiff =
			Math.abs(position.value.x - targetPosition.value.x) +
			Math.abs(position.value.y - targetPosition.value.y);

		if (scaleDiff > 0.001 || posDiff > 0.1) {
			zoomAnimationFrame = requestAnimationFrame(animateZoom);
		} else {
			isZoomAnimating.value = false;
			scale.value = targetScale.value;
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
	};
};
