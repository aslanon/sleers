import { ref } from "vue";

export const useGifOverlay = (options = {}) => {
	const dragState = options.dragState;
	const updateCanvas = options.updateCanvas;
	const videoState = options.videoState;

	const drawTransformHandles = options.drawTransformHandles;

	const drawGifAsImage = (ctx, renderData, dpr, x, y, width, height) => {
		if (!window.gifImageCache) {
			window.gifImageCache = new Map();
		}

		const cacheKey = (renderData.id || renderData.url) + "_img";

		if (window.gifImageCache.has(cacheKey)) {
			const cachedImg = window.gifImageCache.get(cacheKey);
			if (cachedImg.complete && cachedImg.naturalWidth > 0) {
				const originalComposite = ctx.globalCompositeOperation;
				ctx.globalCompositeOperation = "source-over";
				ctx.drawImage(cachedImg, x, y, width, height);
				ctx.globalCompositeOperation = originalComposite;
			}
		} else {
			const gifImg = new Image();
			gifImg.crossOrigin = "anonymous";
			gifImg.onload = () => {
				window.gifImageCache.set(cacheKey, gifImg);
				if (ctx && !window.gifImageLoadPending) {
					window.gifImageLoadPending = true;
					setTimeout(() => {
						window.gifImageLoadPending = false;
						updateCanvas?.(performance.now());
					}, 50);
				}
			};
			gifImg.onerror = () => {};
			gifImg.src = renderData.url;
		}
	};

	const drawGifOverlay = (ctx, renderData, dpr, scale = 1) => {
		if (!renderData || !renderData.url) return;
		ctx.save();

		const x = Math.round(renderData.x * dpr * scale);
		const y = Math.round(renderData.y * dpr * scale);
		const width = Math.round(renderData.width * dpr * scale);
		const height = Math.round(renderData.height * dpr * scale);

		ctx.globalAlpha = renderData.opacity || 1;

		const rotation = renderData.rotation || 0;
		if (rotation !== 0) {
			const centerX = x + width / 2;
			const centerY = y + height / 2;
			ctx.translate(centerX, centerY);
			ctx.rotate((rotation * Math.PI) / 180);
			ctx.translate(-centerX, -centerY);
		}

		const isImage = renderData.type === "image";
		const isVideo = renderData.type === "video";

		if (isImage) {
			if (!window.imageCache) window.imageCache = new Map();
			const cacheKey = renderData.id || renderData.url;
			if (window.imageCache.has(cacheKey)) {
				const cachedImage = window.imageCache.get(cacheKey);
				if (cachedImage.complete && cachedImage.naturalWidth > 0) {
					const originalComposite = ctx.globalCompositeOperation;
					ctx.globalCompositeOperation = "source-over";
					ctx.drawImage(cachedImage, x, y, width, height);
					ctx.globalCompositeOperation = originalComposite;
				}
			} else {
				const img = new Image();
				img.crossOrigin = "anonymous";
				img.onload = () => {
					window.imageCache.set(cacheKey, img);
					if (ctx && !window.imageLoadPending) {
						window.imageLoadPending = true;
						setTimeout(() => {
							window.imageLoadPending = false;
							updateCanvas?.(performance.now());
						}, 50);
					}
				};
				img.onerror = () => {};
				img.src = renderData.url;
			}
		} else if (isVideo) {
			if (!window.videoCache) window.videoCache = new Map();
			const cacheKey = renderData.id || renderData.url;
			if (window.videoCache.has(cacheKey)) {
				const cachedVideo = window.videoCache.get(cacheKey);
				if (cachedVideo.readyState >= 2 && cachedVideo.videoWidth > 0) {
					try {
						const videoDuration = cachedVideo.duration || 1;
						const overlayStartTime = renderData.startTime || 0;
						const overlayEndTime = renderData.endTime || 10;
						const currentCanvasTime = videoState?.value?.currentTime || 0;
						const relativeTime = currentCanvasTime - overlayStartTime;
						const videoTime = relativeTime % videoDuration;
						if (Math.abs(cachedVideo.currentTime - videoTime) > 0.3) {
							cachedVideo.currentTime = videoTime;
						}
						if (videoState?.value?.isPlaying && cachedVideo.paused) {
							cachedVideo.play().catch(() => {});
						} else if (!videoState?.value?.isPlaying && !cachedVideo.paused) {
							cachedVideo.pause();
						}
						if (
							cachedVideo.requestVideoFrameCallback &&
							!cachedVideo._frameCallbackSet
						) {
							cachedVideo._frameCallbackSet = true;
							cachedVideo.requestVideoFrameCallback(() => {
								cachedVideo._frameCallbackSet = false;
							});
						}
						const originalComposite = ctx.globalCompositeOperation;
						ctx.globalCompositeOperation = "source-over";
						ctx.drawImage(cachedVideo, x, y, width, height);
						ctx.globalCompositeOperation = originalComposite;
					} catch {}
				}
			} else {
				const overlayVideo = document.createElement("video");
				overlayVideo.crossOrigin = "anonymous";
				overlayVideo.muted = true;
				overlayVideo.loop = true;
				overlayVideo.playsInline = true;
				overlayVideo.preload = "auto";
				overlayVideo.style.imageRendering = "crisp-edges";
				overlayVideo.onloadeddata = () => {
					window.videoCache.set(cacheKey, overlayVideo);
					if (videoState?.value?.isPlaying) overlayVideo.play().catch(() => {});
					if (ctx && !window.videoLoadPending) {
						window.videoLoadPending = true;
						setTimeout(() => {
							window.videoLoadPending = false;
							updateCanvas?.(performance.now());
						}, 50);
					}
				};
				overlayVideo.onerror = () => {};
				overlayVideo.src = renderData.url;
			}
		} else {
			if (!window.gifVideoCache) window.gifVideoCache = new Map();
			const cacheKey = renderData.id || renderData.url;
			if (window.gifVideoCache.has(cacheKey)) {
				const cachedVideo = window.gifVideoCache.get(cacheKey);
				const isExporting = window.isExporting || false;
				const minReadyState = isExporting ? 1 : 2;
				if (
					cachedVideo.readyState >= minReadyState &&
					cachedVideo.videoWidth > 0
				) {
					try {
						const gifDuration = cachedVideo.duration || 2;
						const relativeTime = renderData.relativeTime || 0;
						const loopTime = relativeTime % gifDuration;
						const threshold = isExporting ? 0.05 : 0.01;
						if (isExporting) {
							try {
								cachedVideo.currentTime = loopTime;
							} catch {}
						} else if (
							Math.abs(cachedVideo.currentTime - loopTime) > threshold
						) {
							cachedVideo.currentTime = loopTime;
						}
						if (videoState?.value?.isPlaying && cachedVideo.paused) {
							cachedVideo.play().catch(() => {});
						} else if (!videoState?.value?.isPlaying && !cachedVideo.paused) {
							cachedVideo.pause();
						}
						if (
							cachedVideo.requestVideoFrameCallback &&
							!cachedVideo._frameCallbackSet
						) {
							cachedVideo._frameCallbackSet = true;
							cachedVideo.requestVideoFrameCallback(() => {
								cachedVideo._frameCallbackSet = false;
							});
						}
						ctx.save();
						try {
							const tempCanvas = document.createElement("canvas");
							const s = 0.5;
							tempCanvas.width = Math.ceil(width * s);
							tempCanvas.height = Math.ceil(height * s);
							const tempCtx = tempCanvas.getContext("2d", { alpha: true });
							tempCtx.drawImage(
								cachedVideo,
								0,
								0,
								tempCanvas.width,
								tempCanvas.height
							);
							const imageData = tempCtx.getImageData(
								0,
								0,
								tempCanvas.width,
								tempCanvas.height
							);
							const data = imageData.data;
							const white = 230;
							for (let i = 0; i < data.length; i += 16) {
								const r = data[i],
									g = data[i + 1],
									b = data[i + 2];
								if (r > white && g > white && b > white) {
									data[i + 3] = 0;
									if (i + 7 < data.length) data[i + 7] = 0;
									if (i + 11 < data.length) data[i + 11] = 0;
									if (i + 15 < data.length) data[i + 15] = 0;
								}
							}
							tempCtx.putImageData(imageData, 0, 0);
							ctx.globalCompositeOperation = "source-over";
							ctx.imageSmoothingEnabled = true;
							ctx.imageSmoothingQuality = "high";
							ctx.drawImage(tempCanvas, x, y, width, height);
						} catch {
							ctx.globalCompositeOperation = "source-over";
							ctx.drawImage(cachedVideo, x, y, width, height);
						}
						ctx.restore();
					} catch {}
				}
			} else {
				const gifVideo = document.createElement("video");
				gifVideo.crossOrigin = "anonymous";
				gifVideo.muted = true;
				gifVideo.loop = true;
				gifVideo.playsInline = true;
				gifVideo.preload = "metadata";
				const videoUrl = renderData.mp4Url || renderData.url;
				gifVideo.onloadeddata = () => {
					window.gifVideoCache.set(cacheKey, gifVideo);
					if (videoState?.value?.isPlaying) gifVideo.play().catch(() => {});
					if (ctx && !window.gifVideoLoadPending) {
						window.gifVideoLoadPending = true;
						setTimeout(() => {
							window.gifVideoLoadPending = false;
							updateCanvas?.(performance.now());
						}, 50);
					}
				};
				gifVideo.onerror = () => {
					drawGifAsImage(ctx, renderData, dpr, x, y, width, height);
				};
				gifVideo.src = videoUrl;
			}
		}

		const isSelected = renderData.isSelected;
		if (isSelected && dragState && !dragState.isRotating) {
			drawTransformHandles?.(ctx, x, y, width, height, dpr, scale, renderData);
		}

		ctx.restore();
	};

	return { drawGifOverlay, drawGifAsImage };
};
