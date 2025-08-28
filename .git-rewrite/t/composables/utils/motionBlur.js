// Ease fonksiyonları
const easeOutQuad = (t) => t * (2 - t);

// Motion blur efektlerini hesapla
export const calculateMotionBlurEffects = (
	speed,
	moveDistance,
	MIN_SPEED_THRESHOLD,
	MAX_SPEED,
	motionBlurValue
) => {
	const normalizedSpeed = Math.min(
		(speed - MIN_SPEED_THRESHOLD) / (MAX_SPEED - MIN_SPEED_THRESHOLD),
		1
	);
	const normalizedDistance = Math.min(moveDistance / 100, 1);
	const movementIntensity = normalizedSpeed * normalizedDistance;
	const easedIntensity = easeOutQuad(movementIntensity);
	const deformAmount = Math.min(6, easedIntensity * motionBlurValue * 6);
	const blurAmount = Math.min(1.5, easedIntensity * 5);

	return {
		easedIntensity,
		deformAmount,
		blurAmount,
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
	trailSteps,
	trailOpacityBase,
	trailOffsetMultiplier,
	blurBase,
	size,
	offsetX,
	offsetY
) => {
	for (let i = trailSteps; i > 0; i--) {
		const trailOpacity = (i / trailSteps) * trailOpacityBase;
		const trailOffset = i * trailOffsetMultiplier;

		ctx.globalAlpha = trailOpacity;
		ctx.filter = `blur(${blurBase}px)`;
		ctx.drawImage(
			cursorImage,
			x + dirX * trailOffset - offsetX,
			y + dirY * trailOffset - offsetY,
			size,
			size
		);
	}
};

// Deformasyon efektlerini uygula
export const applyDeformationEffects = (
	ctx,
	moveDistance,
	dirX,
	dirY,
	deformAmount,
	easedIntensity,
	movementAngle,
	skewFactor,
	stretchFactor
) => {
	// Hareket yönüne doğru eğim uygula
	if (moveDistance > 25) {
		const angle = Math.atan2(dirY, dirX);
		const rotationDegree = movementAngle * (Math.PI / 180);
		ctx.rotate(angle * 0.05 + rotationDegree * easedIntensity);
	}

	const skewX = -dirX * deformAmount * skewFactor;
	const skewY = -dirY * deformAmount * skewFactor;
	const stretchX =
		1 + Math.abs(dirX * deformAmount * stretchFactor) * easedIntensity;
	const stretchY =
		1 + Math.abs(dirY * deformAmount * stretchFactor) * easedIntensity;

	ctx.scale(stretchX, stretchY);
	ctx.transform(1, skewY, skewX, 1, 0, 0);
};
