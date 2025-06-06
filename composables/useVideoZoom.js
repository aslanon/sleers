import { ref } from "vue";

// Zoom ve Clean Zone ayarları için ref'ler
const zoomSettings = ref({
	// Zoom Geçiş Süreleri
	transition: {
		minDuration: 0.3,
		maxDuration: 2.0,
		intensityFactor: 0.5,
	},
	// Zoom Limitleri
	limits: {
		minScale: 0.5,
		maxScale: 3.0,
		defaultScale: 1.5,
	},
	// Clean Zone ayarları
	cleanZone: {
		shape: "circle",
		limits: {
			radius: 500,
			feather: 50,
		},
	},
	// Aktif easing fonksiyonu
	easing: "easeInOutCubic",
	// Zoom yönü ayarları
	direction: {
		zoomIn: {
			blur: "inside-out", // dıştan içe blur
		},
		zoomOut: {
			blur: "outside-in", // içten dışa blur
		},
	},
});

// Blur ayarları
const blurSettings = ref({
	// Blur Limitleri
	limits: {
		minRadius: 0,
		maxRadius: 4,
		defaultRadius: 1,
	},
	// Blur geçiş ayarları
	transition: {
		duration: 0.6,
		easing: "easeOutCubic",
	},
});

// Easing fonksiyonları
const easingFunctions = {
	easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
};

// Gaussian Blur uygula
const applyGaussianBlur = (ctx, canvas, blurRadius, width, height) => {
	const delta = 5;
	const alpha_left = 1 / (2 * Math.PI * delta * delta);
	const step = blurRadius < 3 ? 1 : 2;

	// Ağırlıkları hesapla
	let sum = 0;
	for (let y = -blurRadius; y <= blurRadius; y += step) {
		for (let x = -blurRadius; x <= blurRadius; x += step) {
			const weight =
				alpha_left * Math.exp(-(x * x + y * y) / (2 * delta * delta));
			sum += weight;
		}
	}

	// Blur uygula
	ctx.save();
	ctx.beginPath();
	ctx.rect(-width / 2, -height / 2, width, height);
	ctx.clip();

	for (let y = -blurRadius; y <= blurRadius; y += step) {
		for (let x = -blurRadius; x <= blurRadius; x += step) {
			ctx.globalAlpha =
				((alpha_left * Math.exp(-(x * x + y * y) / (2 * delta * delta))) /
					sum) *
				blurRadius;
			ctx.drawImage(canvas, -width / 2 + x, -height / 2 + y, width, height);
		}
	}

	ctx.restore();
	ctx.globalAlpha = 1;
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
		// Eğer position bir string ise (örn. "center"), onu koordinatlara çevir
		let posX, posY;

		if (typeof position === "string") {
			// Önceden tanımlanmış pozisyonlar
			switch (position) {
				case "center":
					posX = 50;
					posY = 50;
					break;
				case "top":
					posX = 50;
					posY = 25;
					break;
				case "bottom":
					posX = 50;
					posY = 75;
					break;
				case "left":
					posX = 25;
					posY = 50;
					break;
				case "right":
					posX = 75;
					posY = 50;
					break;
				case "top-left":
					posX = 25;
					posY = 25;
					break;
				case "top-right":
					posX = 75;
					posY = 25;
					break;
				case "bottom-left":
					posX = 25;
					posY = 75;
					break;
				case "bottom-right":
					posX = 75;
					posY = 75;
					break;
				default:
					posX = 50;
					posY = 50;
			}
		} else if (position && typeof position === "object") {
			// Eğer position bir obje ise (x, y değerleri içeren)
			posX = position.x;
			posY = position.y;
		} else {
			// Varsayılan olarak merkez
			posX = 50;
			posY = 50;
		}

		// Pozisyonu video alanının içindeki koordinatlara dönüştür
		// Yüzde değerlerini (0-100) gerçek piksel değerlerine çevir
		const originX = x + (drawWidth * posX) / 100;
		const originY = y + (drawHeight * posY) / 100;

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
	const calculateBlurEffect = (scale, progress) => {
		// Sabit blur değeri kullan, zoom seviyesinden etkilenmesin
		return blurSettings.value.limits.defaultRadius;
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

		if (activeZoom) {
			const timeFromStart = currentTime - activeZoom.start;
			const timeToEnd = activeZoom.end - currentTime;
			const duration = 0.3; // Sabit geçiş süresi

			let segmentProgress;
			if (timeFromStart < duration) {
				// Giriş animasyonu
				segmentProgress = timeFromStart / duration;
			} else if (timeToEnd < duration) {
				// Çıkış animasyonu
				segmentProgress = timeToEnd / duration;
			} else {
				// Tam zoom
				segmentProgress = 1;
			}

			// Yumuşatılmış ilerleme
			const smoothProgress = easingFunctions.easeOutCubic(segmentProgress);

			// Sadece scale'i güncelle, blur sabit kalsın
			videoScale.value = 1 + (activeZoom.scale - 1) * smoothProgress;

			// Sabit blur efektini uygula
			applyZoomEffects(blurSettings.value.limits.defaultRadius);
		} else {
			// Segment dışındaysa varsayılan değerlere dön
			videoScale.value = 1;
			// Blur efektini kaldır
			applyZoomEffects(0);
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

	// Zoom efektlerini uygula
	const applyZoomEffects = (blurAmount) => {
		if (!canvasRef.value || !videoElement) return;

		const ctx = canvasRef.value.getContext("2d");
		if (!ctx) return;

		const width = canvasRef.value.width;
		const height = canvasRef.value.height;
		const centerX = width / 2;
		const centerY = height / 2;

		// Ana canvas'ı temizle
		ctx.clearRect(0, 0, width, height);

		// Video sınırlarını belirle
		const videoWidth = videoElement.videoWidth;
		const videoHeight = videoElement.videoHeight;
		const videoX = (width - videoWidth) / 2;
		const videoY = (height - videoHeight) / 2;

		// Orijinal videoyu çiz
		ctx.save();
		ctx.drawImage(videoElement, videoX, videoY, videoWidth, videoHeight);

		// Gaussian blur efekti uygula
		if (blurAmount > 0) {
			const blurRadius = Math.min(
				Math.round(blurAmount),
				blurSettings.value.limits.maxRadius
			);

			if (blurRadius > 0) {
				// Orijinal görüntüyü sakla
				const tempCanvas = document.createElement("canvas");
				tempCanvas.width = videoWidth;
				tempCanvas.height = videoHeight;
				const tempCtx = tempCanvas.getContext("2d");
				tempCtx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);

				// Video alanını kırp
				ctx.beginPath();
				ctx.rect(videoX, videoY, videoWidth, videoHeight);
				ctx.clip();

				// Blur'u uygula
				ctx.translate(videoX + videoWidth / 2, videoY + videoHeight / 2);
				applyGaussianBlur(ctx, tempCanvas, blurRadius, videoWidth, videoHeight);
			}
		}
		ctx.restore();

		// Clean zone efekti
		if (zoomSettings.value.cleanZone.shape === "circle") {
			const radius = zoomSettings.value.cleanZone.limits.radius;
			const feather = zoomSettings.value.cleanZone.limits.feather;

			ctx.save();

			// Gradient hesaplama - radius'a göre iç ve dış yarıçapları ayarla
			const innerRadius = radius * 1; // İç temiz bölge
			const outerRadius = radius + feather; // Dış blur bölgesi

			const gradient = ctx.createRadialGradient(
				centerX,
				centerY,
				innerRadius,
				centerX,
				centerY,
				outerRadius
			);

			// Daha keskin ve belirgin geçişler
			gradient.addColorStop(0, "rgba(0,0,0,1)"); // Tamamen temiz bölge
			gradient.addColorStop(0.3, "rgba(0,0,0,1)"); // Temiz bölge devamı
			gradient.addColorStop(0.7, "rgba(0,0,0,0.7)"); // Blur başlangıcı
			gradient.addColorStop(0.9, "rgba(0,0,0,0.3)"); // Blur artışı
			gradient.addColorStop(1, "rgba(0,0,0,0)"); // Tam blur

			ctx.globalCompositeOperation = "destination-in";
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, width, height);

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
		blurSettings,
		applyZoomEffects,
	};
};

// Ayarları ve yardımcı fonksiyonları dışa aktar
export { zoomSettings, blurSettings };
