// Ease fonksiyonları
const easeOutQuad = (t) => t * (2 - t);
const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

// Hız eşikleri
const SPEED_THRESHOLDS = {
	MIN: 1.5, // Daha düşük minimum hız eşiği
	MAX: 3.0, // Daha düşük maksimum hız eşiği
	DEFORM: 5.0, // Daha düşük deformasyon eşiği
};

// Hareket stabilizasyonu için son pozisyonlar
let lastPositions = [];
const MAX_POSITIONS = 5; // Daha az pozisyon (daha keskin hareket)
const STABILIZATION_WEIGHT = 0.8; // Daha az stabilizasyon

// Stabilize edilmiş hareket vektörü hesapla
const calculateStabilizedMovement = (currentX, currentY, speed) => {
	// Yeni pozisyonu ekle
	lastPositions.push({ x: currentX, y: currentY, speed });
	if (lastPositions.length > MAX_POSITIONS) {
		lastPositions.shift();
	}

	// Ağırlıklı ortalama hesapla
	let stabilizedX = 0;
	let stabilizedY = 0;
	let totalWeight = 0;

	lastPositions.forEach((pos, index) => {
		const weight = (index + 1) / lastPositions.length;
		stabilizedX += pos.x * weight;
		stabilizedY += pos.y * weight;
		totalWeight += weight;
	});

	return {
		x: stabilizedX / totalWeight,
		y: stabilizedY / totalWeight,
	};
};

// Motion blur efektlerini hesapla
export const calculateMotionBlurEffects = (
	speed,
	moveDistance,
	MIN_SPEED_THRESHOLD = SPEED_THRESHOLDS.MIN,
	MAX_SPEED = SPEED_THRESHOLDS.MAX,
	motionBlurValue
) => {
	if (speed < MIN_SPEED_THRESHOLD) {
		return {
			easedIntensity: 0,
			deformAmount: 0,
			blurAmount: 0,
			shouldApplyEffect: false,
		};
	}

	// Yumuşak hız geçişi
	const normalizedSpeed = Math.min(
		Math.pow(
			(speed - MIN_SPEED_THRESHOLD) / (MAX_SPEED - MIN_SPEED_THRESHOLD),
			1.5
		),
		1
	);

	// Mesafe etkisi
	const normalizedDistance = Math.min(moveDistance / 150, 1);

	// Hareket yoğunluğu
	const movementIntensity = normalizedSpeed * normalizedDistance;

	// Yumuşak geçiş
	const easedIntensity = easeOutExpo(movementIntensity);

	// Hafif deformasyon
	const deformAmount =
		speed > SPEED_THRESHOLDS.DEFORM
			? Math.min(0.15, easedIntensity * motionBlurValue * 0.3)
			: 0;

	// Gaussian blur
	const blurAmount = Math.min(2, easedIntensity * motionBlurValue * 3);

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
	cursorImage,
	x,
	y,
	dirX,
	dirY,
	speed,
	trailSteps,
	trailOpacityBase,
	trailOffsetMultiplier,
	blurBase,
	size,
	offsetX,
	offsetY
) => {
	// Stabilize edilmiş pozisyon
	const stabilized = calculateStabilizedMovement(x, y, speed);
	const stabilizedX =
		x * (1 - STABILIZATION_WEIGHT) + stabilized.x * STABILIZATION_WEIGHT;
	const stabilizedY =
		y * (1 - STABILIZATION_WEIGHT) + stabilized.y * STABILIZATION_WEIGHT;

	// Daha az ama daha belirgin trail
	const dynamicSteps = Math.min(trailSteps, Math.ceil(speed));

	for (let i = dynamicSteps; i > 0; i--) {
		const progress = i / dynamicSteps;

		// Daha güçlü opaklık
		const trailOpacity =
			Math.pow(progress, 2.5) * trailOpacityBase * Math.min(speed / 4, 0.4);

		// Daha uzun trail
		const trailOffset = i * trailOffsetMultiplier * Math.min(speed * 0.8, 2.0);

		ctx.save();
		ctx.globalAlpha = trailOpacity;

		// Daha güçlü blur
		const blurAmount = blurBase * (1 - Math.pow(progress, 0.5)) * 2;
		ctx.filter = `blur(${blurAmount}px)`;

		// Trail pozisyonunu hesapla
		const trailX = stabilizedX + dirX * trailOffset;
		const trailY = stabilizedY + dirY * trailOffset;

		// Trail'i çiz
		ctx.drawImage(cursorImage, trailX - offsetX, trailY - offsetY, size, size);
		ctx.restore();
	}
};

// Deformasyon efektlerini uygula
export const applyDeformationEffects = (
	ctx,
	moveDistance,
	dirX,
	dirY,
	speed,
	deformAmount,
	easedIntensity,
	movementAngle
) => {
	if (speed < SPEED_THRESHOLDS.DEFORM) return;

	const angle = Math.atan2(dirY, dirX);

	// Daha güçlü deformasyon faktörleri
	const speedFactor = Math.min(speed / SPEED_THRESHOLDS.MAX, 1.0);
	const skewFactor = 0.15 * speedFactor; // Daha güçlü eğim
	const stretchFactor = 0.25 * speedFactor; // Daha güçlü uzama

	// Daha belirgin rotasyon
	if (moveDistance > 25) {
		const rotationDegree = movementAngle * (Math.PI / 180);
		ctx.rotate(
			angle * 0.15 * speedFactor + rotationDegree * easedIntensity * 0.2
		);
	}

	// Daha güçlü deformasyon
	const skewX = -dirX * deformAmount * skewFactor;
	const skewY = -dirY * deformAmount * skewFactor;
	const stretchX =
		1 + Math.abs(dirX * deformAmount * stretchFactor) * easedIntensity;
	const stretchY =
		1 + Math.abs(dirY * deformAmount * stretchFactor) * easedIntensity;

	ctx.scale(stretchX, stretchY);
	ctx.transform(1, skewY, skewX, 1, 0, 0);
};
