import { useRoundRect } from "~/composables/useRoundRect";
import { usePlayerSettings } from "~/composables/usePlayerSettings";

export const useCameraRenderer = () => {
	const { cameraSettings, updateCameraSettings } = usePlayerSettings();

	// Kamera çizim fonksiyonu
	const drawCamera = (ctx, cameraElement, canvasWidth, canvasHeight, dpr) => {
		if (!cameraElement || cameraElement.readyState < 2) return;

		// Kamera boyutlarını hesapla (kare olarak)
		const cameraWidth = (canvasWidth * cameraSettings.value.size) / 100;
		const cameraHeight = cameraWidth; // Kare yapmak için width = height

		// Kamera pozisyonunu hesapla (sağ alt köşe)
		const cameraX = canvasWidth - cameraWidth - 20 * dpr;
		const cameraY = canvasHeight - cameraHeight - 20 * dpr;

		// Context state'i kaydet
		ctx.save();

		// Gölge efekti
		if (cameraSettings.value.shadow > 0) {
			ctx.save();
			ctx.beginPath();
			useRoundRect(
				ctx,
				cameraX,
				cameraY,
				cameraWidth,
				cameraHeight,
				cameraSettings.value.radius * dpr
			);
			ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
			ctx.shadowBlur = cameraSettings.value.shadow * dpr;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			ctx.fillStyle = "#000000";
			ctx.fill();
			ctx.restore();
		}

		// Kamera alanını kırp ve radius uygula
		ctx.beginPath();
		useRoundRect(
			ctx,
			cameraX,
			cameraY,
			cameraWidth,
			cameraHeight,
			cameraSettings.value.radius * dpr
		);
		ctx.clip();

		// Crop ayarlarını hesapla
		const crop = cameraSettings.value.crop;

		// Video aspect ratio'sunu koru
		const videoRatio = cameraElement.videoWidth / cameraElement.videoHeight;
		const targetHeight = cameraElement.videoHeight;
		const targetWidth = targetHeight;

		// Crop pozisyonunu hesapla
		const maxOffset = cameraElement.videoWidth - targetWidth;
		const sourceX = (maxOffset * crop.x) / (100 - crop.width);
		const sourceY = 0;

		// Kamerayı crop ayarlarıyla çiz
		ctx.drawImage(
			cameraElement,
			sourceX,
			sourceY,
			targetWidth,
			targetHeight,
			cameraX,
			cameraY,
			cameraWidth,
			cameraHeight
		);

		// Tıklanabilir alan için path ekle
		ctx.beginPath();
		useRoundRect(
			ctx,
			cameraX,
			cameraY,
			cameraWidth,
			cameraHeight,
			cameraSettings.value.radius * dpr
		);

		// Context state'i geri yükle
		ctx.restore();

		// Kamera alanının koordinatlarını döndür
		return { cameraX, cameraY, cameraWidth, cameraHeight };
	};

	// Kamera alanının tıklanıp tıklanmadığını kontrol et
	const isPointInPath = (ctx, x, y) => {
		return ctx.isPointInPath(x, y);
	};

	return {
		drawCamera,
		isPointInPath,
	};
};
