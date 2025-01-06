export const useMacCursor = () => {
	const drawCursor = (ctx, x, y) => {
		// Cursor boyutları
		const cursorWidth = 28;
		const cursorHeight = 28;

		// Cursor'ı canvas'ın ortasına çiz
		const centerX = x - cursorWidth / 2;
		const centerY = y - cursorHeight / 2;

		ctx.save();

		// Ana cursor gövdesi (beyaz)
		ctx.beginPath();
		ctx.fillStyle = "white";
		ctx.strokeStyle = "black";
		ctx.lineWidth = 1;

		// Ana cursor şekli (SVG'den alınan path)
		ctx.moveTo(centerX + 8.2, centerY + 4.9); // Sol üst başlangıç
		ctx.lineTo(centerX + 8.2, centerY + 20.9); // Sol kenar
		ctx.lineTo(centerX + 12.6, centerY + 16.6); // Alt sol köşe
		ctx.lineTo(centerX + 13, centerY + 16.5); // Alt orta nokta
		ctx.lineTo(centerX + 19.8, centerY + 16.5); // Sağ nokta
		ctx.closePath();

		// Dolgu ve kenar çizgisi
		ctx.fill();
		ctx.stroke();

		// Gölge efekti
		ctx.beginPath();
		ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
		ctx.moveTo(centerX + 13.7, centerY + 23.1);
		ctx.lineTo(centerX + 9, centerY + 12);
		ctx.lineTo(centerX + 12.7, centerY + 10.5);
		ctx.lineTo(centerX + 17.3, centerY + 21.6);
		ctx.closePath();
		ctx.fill();

		ctx.restore();
	};

	return {
		drawCursor,
	};
};
