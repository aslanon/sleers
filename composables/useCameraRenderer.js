import { useRoundRect } from "~/composables/useRoundRect";
import { usePlayerSettings } from "~/composables/usePlayerSettings";

export const useCameraRenderer = () => {
	const { cameraSettings } = usePlayerSettings();

	// Kamera çizim fonksiyonu
	const drawCamera = (ctx, cameraElement, canvasWidth, canvasHeight, dpr) => {
		if (!cameraElement || cameraElement.readyState < 2) return;

		// Kamera boyutlarını hesapla
		const cameraWidth = (canvasWidth * cameraSettings.value.size) / 100;
		const cameraHeight = (cameraWidth * 9) / 16; // 16:9 aspect ratio

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
		const sourceX = (cameraElement.videoWidth * crop.x) / 100;
		const sourceY = (cameraElement.videoHeight * crop.y) / 100;
		const sourceWidth = (cameraElement.videoWidth * crop.width) / 100;
		const sourceHeight = (cameraElement.videoHeight * crop.height) / 100;

		// Kamerayı crop ayarlarıyla çiz
		ctx.drawImage(
			cameraElement,
			sourceX,
			sourceY,
			sourceWidth,
			sourceHeight,
			cameraX,
			cameraY,
			cameraWidth,
			cameraHeight
		);

		// Context state'i geri yükle
		ctx.restore();
	};

	return {
		drawCamera,
	};
};
