export const calculateZoomOrigin = (
	position,
	videoX,
	videoY,
	displayWidth,
	displayHeight,
	centerX,
	centerY
) => {
	let originX = centerX;
	let originY = centerY;

	switch (position) {
		case "top-left":
			originX = videoX;
			originY = videoY;
			break;
		case "top-center":
			originX = centerX;
			originY = videoY;
			break;
		case "top-right":
			originX = videoX + displayWidth;
			originY = videoY;
			break;
		case "middle-left":
			originX = videoX;
			originY = centerY;
			break;
		case "middle-right":
			originX = videoX + displayWidth;
			originY = centerY;
			break;
		case "bottom-left":
			originX = videoX;
			originY = videoY + displayHeight;
			break;
		case "bottom-center":
			originX = centerX;
			originY = videoY + displayHeight;
			break;
		case "bottom-right":
			originX = videoX + displayWidth;
			originY = videoY + displayHeight;
			break;
		default:
			// "center" veya tanımlanmamış pozisyonlar için
			originX = centerX;
			originY = centerY;
	}

	return { originX, originY };
};
