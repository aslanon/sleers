// Easing fonksiyonları
export const easeOutExpo = (x) => {
	return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
};

// Hız eşikleri
export const SPEED_THRESHOLDS = {
	MIN: 0.5, // Minimum hız eşiği (px/ms)
	MAX: 10, // Maksimum hız eşiği (px/ms)
};

// Motion blur efektlerini hesapla
export const calculateMotionBlurEffects = (
	speed,
	distance,
	minSpeed = SPEED_THRESHOLDS.MIN,
	maxSpeed = SPEED_THRESHOLDS.MAX,
	intensityMultiplier = 1
) => {
	// Hız eşiklerini kontrol et
	if (speed <= minSpeed) {
		return {
			easedIntensity: 0,
			deformAmount: 0,
			blurAmount: 0,
			shouldApplyEffect: false,
		};
	}

	// Hızı normalize et (0-1 arasında)
	const normalizedSpeed = Math.min(
		Math.max((speed - minSpeed) / (maxSpeed - minSpeed), 0),
		1
	);

	// Easing fonksiyonu uygula
	const easedIntensity = easeOutExpo(normalizedSpeed) * intensityMultiplier;

	// Deformasyon ve blur miktarını hesapla
	const deformAmount = easedIntensity * 0.3; // Max 30% deformasyon
	const blurAmount = easedIntensity * 10; // Max 10px blur

	return {
		easedIntensity,
		deformAmount,
		blurAmount,
		shouldApplyEffect: true,
	};
};

// Trail efektlerini uygula
export const applyTrailEffects = (
	ctx,
	image,
	x,
	y,
	dirX,
	dirY,
	speed,
	steps,
	baseOpacity,
	offsetMultiplier,
	blurAmount,
	width,
	offsetX = 0,
	offsetY = 0
) => {
	const normalizedSpeed = Math.min(speed / SPEED_THRESHOLDS.MAX, 1);

	for (let i = 0; i < steps; i++) {
		const stepProgress = i / steps;
		const alpha = (1 - stepProgress) * baseOpacity * normalizedSpeed;
		const offset = stepProgress * offsetMultiplier * normalizedSpeed;

		ctx.globalAlpha = alpha;
		ctx.filter = `blur(${blurAmount * stepProgress}px)`;

		const trailX = x - (dirX || 0) * offset - offsetX;
		const trailY = y - (dirY || 0) * offset - offsetY;

		ctx.drawImage(image, trailX, trailY, width, width);
	}

	// Reset context properties
	ctx.globalAlpha = 1;
	ctx.filter = "none";
};

// Deformasyon efektlerini uygula
export const applyDeformationEffects = (
	ctx,
	distance,
	dirX,
	dirY,
	speed,
	deformAmount,
	intensity,
	angle
) => {
	// Hareket yönüne göre skew uygula
	const skewX = (dirX * deformAmount * intensity) / 2;
	const skewY = (dirY * deformAmount * intensity) / 2;

	// Transform matrix uygula
	ctx.transform(
		1 + Math.abs(skewX), // Horizontal scaling
		skewY, // Horizontal skewing
		skewX, // Vertical skewing
		1 + Math.abs(skewY), // Vertical scaling
		0, // Horizontal translation
		0 // Vertical translation
	);
};
