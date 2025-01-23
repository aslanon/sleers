export const calculateZoomOrigin = (
	position,
	videoX,
	videoY,
	displayWidth,
	displayHeight,
	centerX,
	centerY
) => {
	let originX = position.x * 10;
	let originY = position.y * 10;

	return { originX, originY };
};
