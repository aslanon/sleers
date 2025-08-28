// Mouse pozisyonlarını hesapla
export const calculateMousePosition = (
	currentPos,
	nextPos,
	framePart,
	videoWidth,
	videoHeight,
	displayWidth,
	displayHeight,
	videoX,
	videoY
) => {
	// Video boyutlarına göre pozisyonu ölçeklendir
	const finalX = videoX + (currentPos.x * displayWidth) / videoWidth;
	const finalY = videoY + (currentPos.y * displayHeight) / videoHeight;

	// İki frame arasında interpolasyon yap
	if (nextPos && framePart) {
		const nextX = videoX + (nextPos.x * displayWidth) / videoWidth;
		const nextY = videoY + (nextPos.y * displayHeight) / videoHeight;

		// Lineer interpolasyon
		return {
			finalX: finalX + (nextX - finalX) * framePart,
			finalY: finalY + (nextY - finalY) * framePart,
		};
	}

	return { finalX, finalY };
};

// Mouse hareketi hesaplama
export const calculateMouseMovement = (currentPos, nextPos) => {
	const moveX = nextPos.x - currentPos.x;
	const moveY = nextPos.y - currentPos.y;
	const speed = Math.sqrt(moveX * moveX + moveY * moveY);
	const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY);

	// Hareket yönünü hesapla ve normalize et
	const dirX = speed > 0 ? moveX / speed : 0;
	const dirY = speed > 0 ? moveY / speed : 0;

	return { speed, moveDistance, dirX, dirY };
};

// Video boyutlarını hesapla
export const calculateVideoDisplaySize = (
	videoWidth,
	videoHeight,
	canvasWidth,
	canvasHeight,
	padding = 0 // Default to 0 if not provided
) => {
	// Padding'i her iki taraftan uygula
	const effectiveCanvasWidth = canvasWidth - padding * 2;
	const effectiveCanvasHeight = canvasHeight - padding * 2;

	const videoRatio = videoWidth / videoHeight;
	const canvasRatio = effectiveCanvasWidth / effectiveCanvasHeight;
	let displayWidth, displayHeight;

	if (videoRatio > canvasRatio) {
		displayWidth = effectiveCanvasWidth;
		displayHeight = effectiveCanvasWidth / videoRatio;
	} else {
		displayHeight = effectiveCanvasHeight;
		displayWidth = effectiveCanvasHeight * videoRatio;
	}

	// Video'nun canvas içindeki pozisyonunu hesapla (padding dahil)
	const videoX = padding + (effectiveCanvasWidth - displayWidth) / 2;
	const videoY = padding + (effectiveCanvasHeight - displayHeight) / 2;

	return { displayWidth, displayHeight, videoX, videoY };
};
