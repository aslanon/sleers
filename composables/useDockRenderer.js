export const useDockRenderer = (deps) => {
	const { canvasRef, visibleDockItems, dockSize, updateCanvas } = deps;

	const roundedRect = (ctx, x, y, width, height, radius) => {
		ctx.beginPath();
		ctx.moveTo(x + radius, y);
		ctx.lineTo(x + width - radius, y);
		ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
		ctx.lineTo(x + width, y + height - radius);
		ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
		ctx.lineTo(x + radius, y + height);
		ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
		ctx.lineTo(x, y + radius);
		ctx.quadraticCurveTo(x, y, x + radius, y);
		ctx.closePath();
	};

	const drawMacOSDock = (ctx, dpr) => {
		if (!canvasRef.value || !ctx) return;
		if (!window.dockIconCache) window.dockIconCache = {};

		const canvasWidth = canvasRef.value.width;
		const canvasHeight = canvasRef.value.height;
		if (!visibleDockItems.value || visibleDockItems.value.length === 0) return;

		const scale = dockSize.value;
		const dockHeight = 52 * dpr * scale;
		const dockRadius = 18 * dpr * scale;
		const iconSize = 48 * dpr * scale;
		const iconSpacing = 4 * dpr * scale;
		const dividerSpacing = 8 * dpr * scale;

		let dividerCount = 0;
		visibleDockItems.value.forEach((item) => {
			if (item.isDivider) dividerCount++;
		});

		const dockWidth =
			iconSize * visibleDockItems.value.length +
			iconSpacing * (visibleDockItems.value.length - 1) +
			dividerSpacing * dividerCount * 2;
		const dockX = Math.floor((canvasWidth - dockWidth) / 2);
		const dockY = canvasHeight - dockHeight - 5 * dpr * scale;

		const contentCanvas = document.createElement("canvas");
		contentCanvas.width = canvasWidth;
		contentCanvas.height = canvasHeight;
		const contentCtx = contentCanvas.getContext("2d");
		contentCtx.drawImage(canvasRef.value, 0, 0);

		const backdropCanvas = document.createElement("canvas");
		backdropCanvas.width = canvasWidth;
		backdropCanvas.height = canvasHeight;
		const backdropCtx = backdropCanvas.getContext("2d");
		backdropCtx.drawImage(contentCanvas, 0, 0);
		backdropCtx.save();
		backdropCtx.beginPath();
		roundedRect(backdropCtx, dockX, dockY, dockWidth, dockHeight, dockRadius);
		backdropCtx.clip();
		backdropCtx.filter = `blur(${30 * dpr}px)`;
		backdropCtx.drawImage(contentCanvas, 0, 0);
		backdropCtx.filter = "none";
		backdropCtx.restore();

		const shadowCanvas = document.createElement("canvas");
		shadowCanvas.width = canvasWidth;
		shadowCanvas.height = canvasHeight;
		const shadowCtx = shadowCanvas.getContext("2d");
		shadowCtx.save();
		shadowCtx.shadowColor = "rgba(0, 0, 0, 0.8)";
		shadowCtx.shadowBlur = 25 * dpr;
		shadowCtx.shadowOffsetX = 0;
		shadowCtx.shadowOffsetY = 2 * dpr;
		shadowCtx.beginPath();
		roundedRect(shadowCtx, dockX, dockY, dockWidth, dockHeight, dockRadius);
		shadowCtx.fillStyle = "rgba(255, 255, 255, 0.005)";
		shadowCtx.fill();
		shadowCtx.restore();

		ctx.save();
		ctx.drawImage(backdropCanvas, 0, 0);
		ctx.globalCompositeOperation = "source-over";
		ctx.beginPath();
		roundedRect(ctx, dockX, dockY, dockWidth, dockHeight, dockRadius);
		ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
		ctx.fill();
		ctx.drawImage(shadowCanvas, 0, 0);
		ctx.beginPath();
		roundedRect(ctx, dockX, dockY, dockWidth + 2, dockHeight + 2, dockRadius);
		ctx.strokeStyle = "rgba(255, 255, 255, 0.23)";
		ctx.lineWidth = 4 * dpr;
		ctx.stroke();
		ctx.restore();

		let currentX = dockX + iconSpacing;
		visibleDockItems.value.forEach((item, index) => {
			if (item.isDivider) {
				currentX += dividerSpacing;
				const dividerX = currentX;
				const dividerY = dockY + dockHeight * 0.2;
				const dividerHeight = dockHeight * 0.6;
				ctx.save();
				ctx.beginPath();
				ctx.moveTo(dividerX, dividerY);
				ctx.lineTo(dividerX, dividerY + dividerHeight);
				ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
				ctx.lineWidth = 2 * dpr * scale;
				ctx.stroke();
				ctx.restore();
				currentX += dividerSpacing;
			}

			const iconX = currentX;
			const iconY = dockY + (dockHeight - iconSize) / 2;
			const cacheKey = item.name || `icon-${index}`;
			if (item.iconDataUrl) {
				if (window.dockIconCache[cacheKey]) {
					ctx.save();
					ctx.beginPath();
					ctx.arc(
						iconX + iconSize / 2,
						iconY + iconSize / 2,
						iconSize / 2,
						0,
						2 * Math.PI
					);
					ctx.clip();
					ctx.drawImage(
						window.dockIconCache[cacheKey],
						iconX,
						iconY,
						iconSize,
						iconSize
					);
					ctx.restore();
				} else {
					const img = new Image();
					img.onload = () => {
						window.dockIconCache[cacheKey] = img;
						ctx.save();
						ctx.beginPath();
						ctx.arc(
							iconX + iconSize / 2,
							iconY + iconSize / 2,
							iconSize / 2,
							0,
							2 * Math.PI
						);
						ctx.clip();
						ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
						ctx.restore();
						requestAnimationFrame(updateCanvas);
					};
					img.src = item.iconDataUrl;
				}
			}
			currentX += iconSize + iconSpacing;
		});
	};

	return { drawMacOSDock };
};
