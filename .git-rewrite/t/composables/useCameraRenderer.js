import { ref } from "vue";
import { useRoundRect } from "~/composables/useRoundRect";
import { usePlayerSettings } from "~/composables/usePlayerSettings";

export const useCameraRenderer = () => {
	const { cameraSettings } = usePlayerSettings();
	const lastCameraPosition = ref({ x: 0, y: 0 });
	const isMouseOverCamera = ref(false);
	const scaleValue = 3;
	const hoverScale = ref(1);
	const HOVER_SCALE = 1.1; // Hover durumunda %10 büyüme
	const TRANSITION_SPEED = 0.5; // Daha hızlı geçiş

	// Hover scale değerini güncelle
	const updateHoverScale = () => {
		const targetScale = isMouseOverCamera.value ? HOVER_SCALE : 1;

		hoverScale.value += (targetScale - hoverScale.value) * TRANSITION_SPEED;

		const canvas = document.getElementById("canvasID");
		canvas.style.cursor = isMouseOverCamera.value ? "grab" : "default";
	};

	const drawCamera = (
		ctx,
		cameraElement,
		canvasWidth,
		canvasHeight,
		dpr,
		mouseX,
		mouseY,
		dragPosition = null,
		zoomScale = 1
	) => {
		if (!cameraElement || cameraElement.readyState < 2) return false;

		// Hover scale'i güncelle
		updateHoverScale();

		// Kamera boyutlarını hesapla (kare olarak)
		const cameraWidth = (canvasWidth * cameraSettings.value.size) / 100;
		const cameraHeight = cameraWidth; // Kare yapmak için width = height

		// Video aspect ratio'sunu hesapla
		const videoRatio = cameraElement.videoWidth / cameraElement.videoHeight;
		const targetRatio = 1; // Kare görüntü için 1:1

		// Video'yu kare alana sığdırmak için boyutları hesapla
		let sourceWidth, sourceHeight, sourceX, sourceY;

		// Crop ayarlarını al
		const cropX = cameraSettings.value.crop.x;
		const cropWidth = cameraSettings.value.crop.width;

		if (videoRatio > targetRatio) {
			// Video daha geniş
			sourceHeight = cameraElement.videoHeight;
			sourceWidth = sourceHeight;

			// Crop X pozisyonunu hesapla
			const maxOffset = cameraElement.videoWidth - sourceWidth;
			sourceX = (maxOffset * cropX) / 43.75;
			sourceY = 0;

			// Crop width'e göre source width'i ayarla
			sourceWidth = sourceWidth * (cropWidth / 56.25);
		} else {
			// Video daha dar
			sourceWidth = cameraElement.videoWidth;
			sourceHeight = sourceWidth;

			// Crop Y pozisyonunu hesapla
			const maxOffset = cameraElement.videoHeight - sourceHeight;
			sourceY = (maxOffset * cropX) / 43.75;
			sourceX = 0;

			// Crop height'e göre source height'i ayarla
			sourceHeight = sourceHeight * (cropWidth / 56.25);
		}

		// Maksimum radius hesapla - boyutun yarısını geçemez
		const maxRadius = Math.min(cameraWidth, cameraHeight) / 2;
		// Kullanıcının istediği radius değerini sınırla
		const safeRadius = Math.min(
			cameraSettings.value.radius * dpr * scaleValue,
			maxRadius
		);

		// Maksimum gölge boyutunu hesapla - kamera boyutunun %20'sini geçmesin
		const maxShadowBlur = Math.min(cameraWidth, cameraHeight) * 0.2;
		// Kullanıcının istediği gölge değerini sınırla
		const safeShadowBlur = Math.min(
			cameraSettings.value.shadow * dpr * scaleValue,
			maxShadowBlur
		);

		// Kamera pozisyonunu hesapla
		let cameraX, cameraY;

		if (dragPosition) {
			cameraX = dragPosition.x;
			cameraY = dragPosition.y;
		} else if (
			cameraSettings.value.followMouse &&
			mouseX !== undefined &&
			mouseY !== undefined
		) {
			const offsetY = 50 * dpr * scaleValue;
			cameraX = mouseX - cameraWidth / 2;
			cameraY = mouseY + offsetY;

			lastCameraPosition.value = { x: cameraX, y: cameraY };
		} else {
			cameraX =
				lastCameraPosition.value.x ||
				canvasWidth - cameraWidth - 20 * dpr * scaleValue;
			cameraY =
				lastCameraPosition.value.y ||
				canvasHeight - cameraHeight - 20 * dpr * scaleValue;
		}

		// Sınırları kontrol et
		cameraX = Math.max(
			-cameraWidth * 0.5,
			Math.min(canvasWidth - cameraWidth * 0.5, cameraX)
		);
		cameraY = Math.max(
			-cameraHeight * 0.5,
			Math.min(canvasHeight - cameraHeight * 0.5, cameraY)
		);

		// Son pozisyonu kaydet
		if (dragPosition) {
			lastCameraPosition.value = { x: cameraX, y: cameraY };
		}

		// Context state'i kaydet
		ctx.save();

		// Hover efekti için scale transform uygula
		const scaledWidth = cameraWidth * hoverScale.value;
		const scaledHeight = cameraHeight * hoverScale.value;
		const scaleOffsetX = (scaledWidth - cameraWidth) / 2;
		const scaleOffsetY = (scaledHeight - cameraHeight) / 2;

		// Scale origin'i kamera merkezine ayarla
		ctx.translate(cameraX + cameraWidth / 2, cameraY + cameraHeight / 2);
		ctx.scale(hoverScale.value, hoverScale.value);
		ctx.translate(-(cameraX + cameraWidth / 2), -(cameraY + cameraHeight / 2));

		// Anti-aliasing ayarları
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";

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
				safeRadius
			);
			ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
			ctx.shadowBlur = safeShadowBlur;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			ctx.fillStyle = "#000000";
			ctx.fill();
			ctx.restore();
		}

		// Kamera alanını kırp ve radius uygula - kenar pürüzlerini önle
		ctx.save();

		// Ana clip path
		ctx.beginPath();
		useRoundRect(ctx, cameraX, cameraY, cameraWidth, cameraHeight, safeRadius);
		ctx.clip();

		// Ek clip path ile pürüzleri önle - biraz daha geniş alan
		ctx.beginPath();
		useRoundRect(
			ctx,
			cameraX - 2,
			cameraY - 2,
			cameraWidth + 4,
			cameraHeight + 4,
			safeRadius + 2
		);
		ctx.clip();

		// Smooth edges için arka plan
		ctx.fillStyle = "rgba(0, 0, 0, 0)";
		ctx.fill();

		// Mirror efekti için transform uygula
		if (cameraSettings.value.mirror) {
			ctx.translate(cameraX + cameraWidth, cameraY);
			ctx.scale(-1, 1);
			ctx.translate(-cameraX, -cameraY);
		}

		// Kamerayı çiz - biraz daha geniş alan için
		ctx.drawImage(
			cameraElement,
			sourceX,
			sourceY,
			sourceWidth,
			sourceHeight,
			cameraX - 1,
			cameraY - 1,
			cameraWidth + 2,
			cameraHeight + 2
		);

		ctx.restore();

		// Mouse'un kamera üzerinde olup olmadığını kontrol et
		if (mouseX !== undefined && mouseY !== undefined) {
			ctx.beginPath();
			useRoundRect(
				ctx,
				cameraX,
				cameraY,
				cameraWidth,
				cameraHeight,
				safeRadius
			);
			isMouseOverCamera.value = ctx.isPointInPath(mouseX, mouseY);
		}

		// Context state'i geri yükle
		ctx.restore();

		return isMouseOverCamera.value;
	};

	return {
		drawCamera,
		isMouseOverCamera,
		lastCameraPosition,
		hoverScale,
	};
};
