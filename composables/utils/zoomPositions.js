export const calculateZoomOrigin = (
	position,
	videoX,
	videoY,
	displayWidth,
	displayHeight,
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
	const originX = videoX + (displayWidth * posX) / 100;
	const originY = videoY + (displayHeight * posY) / 100;

	return { originX, originY };
};
