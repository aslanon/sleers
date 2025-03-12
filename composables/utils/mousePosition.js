import { cubicBezier, calculateLargeDistanceTransition } from "./motionBlur";

// Ayarlanabilir parametreler - geliştirme ve test için
const DEBUG = false; // Debug modunu aktifleştirme
const HIGH_DISTANCE_THRESHOLD = 80; // Yüksek mesafe eşiği - bu değerin üzerindeki mesafelerde cubic-bezier animasyonu kullanılır

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

		// İki nokta arasındaki mesafeyi hesapla
		const distance = Math.sqrt(
			Math.pow(nextX - finalX, 2) + Math.pow(nextY - finalY, 2)
		);

		// Debug mod aktifse bilgileri konsola yaz
		if (DEBUG && distance > HIGH_DISTANCE_THRESHOLD) {
			console.log(
				`[CubicBezier] Mesafe: ${distance.toFixed(
					2
				)}px, Eşik: ${HIGH_DISTANCE_THRESHOLD}px`
			);
		}

		// Mesafe çok fazla ise cubic-bezier kullan
		if (distance > HIGH_DISTANCE_THRESHOLD) {
			// calculateLargeDistanceTransition fonksiyonunu kullan
			const { shouldApplyCubicBezier, cubicBezierParams, effectStrength } =
				calculateLargeDistanceTransition(distance, HIGH_DISTANCE_THRESHOLD);

			if (shouldApplyCubicBezier) {
				const { x1, y1, x2, y2 } = cubicBezierParams;

				// Debug mod aktifse bezier parametrelerini göster
				if (DEBUG) {
					console.log(
						`[CubicBezier] Parametreler: x1=${x1.toFixed(2)}, y1=${y1.toFixed(
							2
						)}, x2=${x2.toFixed(2)}, y2=${y2.toFixed(2)}`
					);
					console.log(`[CubicBezier] Efekt gücü: ${effectStrength.toFixed(2)}`);
				}

				// Cubic-bezier interpolasyonu kullan
				const cubicBezierProgress = cubicBezier(x1, y1, x2, y2)(framePart);

				// Debug mod aktifse ilerleme değerini göster
				if (DEBUG) {
					console.log(
						`[CubicBezier] Progress: ${framePart.toFixed(
							2
						)} => ${cubicBezierProgress.toFixed(2)}`
					);
				}

				// Pozisyonu güncelle
				return {
					finalX: finalX + (nextX - finalX) * cubicBezierProgress,
					finalY: finalY + (nextY - finalY) * cubicBezierProgress,
				};
			}
		}

		// Normal lineer interpolasyon
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
