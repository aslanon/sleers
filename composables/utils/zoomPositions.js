export const calculateZoomOrigin = (
	position,
	videoX,
	videoY,
	displayWidth,
	displayHeight,
	centerX,
	centerY
) => {
	// position artık { x, y } şeklinde yüzdelik değerler içeriyor
	const x = position.x / 100; // 0-1 arası değere dönüştür
	const y = position.y / 100;

	// Kenar sınırlarını hesapla
	const originX = videoX + (displayWidth * x);
	const originY = videoY + (displayHeight * y);

	return { originX, originY };
};
