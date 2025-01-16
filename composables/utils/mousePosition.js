// Mouse pozisyonlarını interpolasyon ile hesapla
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
	// İki pozisyon arasında cubic interpolasyon yap
	const t = framePart;
	const t2 = t * t;
	const t3 = t2 * t;
	const interpolatedX =
		currentPos.x + (nextPos.x - currentPos.x) * (3 * t2 - 2 * t3);
	const interpolatedY =
		currentPos.y + (nextPos.y - currentPos.y) * (3 * t2 - 2 * t3);

	// Video içindeki oransal pozisyonu hesapla (0-1 arası)
	const normalizedX = interpolatedX / videoWidth;
	const normalizedY = interpolatedY / videoHeight;

	// Mouse'un temel pozisyonunu hesapla
	const finalX = videoX + normalizedX * displayWidth;
	const finalY = videoY + normalizedY * displayHeight;

	return { finalX, finalY };
};

// Mouse hareketi hesaplama
export const calculateMouseMovement = (currentPos, nextPos) => {
	const moveX = nextPos.x - currentPos.x;
	const moveY = nextPos.y - currentPos.y;
	const speed = 0; //Math.sqrt(moveX * moveX + moveY * moveY);
	const moveDistance = 0; //Math.sqrt(moveX * moveX + moveY * moveY);

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
	padding
) => {
	const videoRatio = videoWidth / videoHeight;
	const canvasRatio = canvasWidth / canvasHeight;
	let displayWidth, displayHeight;

	if (videoRatio > canvasRatio) {
		displayWidth = canvasWidth - padding * 2;
		displayHeight = displayWidth / videoRatio;
	} else {
		displayHeight = canvasHeight - padding * 2;
		displayWidth = displayHeight * videoRatio;
	}

	// Video'nun canvas içindeki pozisyonunu hesapla (padding dahil)
	const videoX = (canvasWidth - displayWidth) / 2;
	const videoY = (canvasHeight - displayHeight) / 2;

	return { displayWidth, displayHeight, videoX, videoY };
};
