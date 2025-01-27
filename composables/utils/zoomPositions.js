export const calculateZoomOrigin = (
	position,
	videoX,
	videoY,
	displayWidth,
	displayHeight,
	centerX,
	centerY
) => {
	let originX = position.x * 40;
	let originY = position.y * 40;

	return { originX, originY };
};
