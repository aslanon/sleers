import { ref, shallowRef } from "vue";
import { useRoundRect } from "~/composables/useRoundRect";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import { useBackgroundRemoval } from "~/composables/useBackgroundRemoval";
import { useTensorFlowWebcam } from "~/composables/useTensorFlowWebcam";

export const useCamera = () => {
	// ===== KAMERA CİHAZ YÖNETİMİ =====
	const videoDevices = ref([]);
	const selectedVideoDevice = ref("");
	const isCameraActive = ref(false);
	const cameraPath = ref(null);
	const cameraRecorder = ref(null);

	// Kamera için varsayılan konfigürasyon
	const defaultConfig = {
		width: { ideal: 1280 },
		height: { ideal: 720 },
		frameRate: { ideal: 30 },
		videoBitsPerSecond: 8000000,
		mimeType: "video/webm;codecs=vp9",
		chunkInterval: 100,
	};

	const config = ref({ ...defaultConfig });

	// ===== KAMERA RENDER VE DRAG SİSTEMİ =====
	const { cameraSettings } = usePlayerSettings();
	const lastCameraPosition = shallowRef({ x: 0, y: 0 });
	const isMouseOverCamera = ref(false);
	const isCameraSelected = ref(false);
	const scaleValue = 3;
	const hoverScale = ref(1);
	const HOVER_SCALE = 1.0;
	const TRANSITION_SPEED = 0.5;
	const cameraZoomScale = ref(1.0); // Camera zoom scale'i için

	// Cache ve optimizasyon
	const lastFrameTime = ref(0);
	const renderRequestID = ref(null);
	const frameLimiter = ref(1000 / 60);

	// Background removal integration
	const {
		isLoading: isBackgroundRemovalLoading,
		isProcessing: isBackgroundRemovalActive,
		startBackgroundRemoval,
		stopBackgroundRemoval,
		processFrame: processBackgroundRemovalFrame,
	} = useBackgroundRemoval();

	// TensorFlow background removal
	const {
		isInitialized: isTensorFlowInitialized,
		isProcessing: isTensorFlowProcessing,
		initialize: initializeTensorFlow,
		processFrame: processTensorFlowFrame,
		startProcessing: startTensorFlowProcessing,
		stopProcessing: stopTensorFlowProcessing,
	} = useTensorFlowWebcam();

	// Optimized processing state
	const processingCache = ref(new Map());
	const lastProcessedFrame = ref(null);
	const backgroundRemovalActive = ref(false);

	// ===== DRAG VE RESIZE SİSTEMİ =====
	const isDragging = ref(false);
	const dragOffset = ref({ x: 0, y: 0 });
	const cameraPosition = ref({ x: 0, y: 0 });
	const isResizing = ref(false);
	const resizeHandle = ref(null);
	const initialSize = ref({ width: 0, height: 0 });
	const initialPosition = ref({ x: 0, y: 0 });

	// ===== KAMERA CİHAZ FONKSİYONLARI =====
	const updateConfig = (newConfig) => {
		config.value = {
			...config.value,
			...newConfig,
		};
	};

	const getVideoDevices = async () => {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			videoDevices.value = devices.filter(
				(device) => device.kind === "videoinput"
			);

			if (videoDevices.value.length > 0) {
				selectedVideoDevice.value = videoDevices.value[0].deviceId;
			}
		} catch (error) {
			console.error("Kamera cihazları listelenirken hata oluştu:", error);
		}
	};

	const startCameraStream = async () => {
		let cameraStream = null;
		if (selectedVideoDevice.value) {
			try {
				cameraStream = await navigator.mediaDevices.getUserMedia({
					audio: false,
					video: {
						deviceId: { exact: selectedVideoDevice.value },
						width: config.value.width,
						height: config.value.height,
						frameRate: config.value.frameRate,
					},
				});

				cameraStream = new MediaStream(cameraStream.getVideoTracks());
			} catch (err) {
				console.error("Kamera akışı alınamadı:", {
					name: err.name,
					message: err.message,
					constraint: err.constraint,
					deviceId: selectedVideoDevice.value,
				});

				if (err.name === "OverconstrainedError") {
					try {
						cameraStream = await navigator.mediaDevices.getUserMedia({
							audio: false,
							video: {
								deviceId: { exact: selectedVideoDevice.value },
							},
						});
						cameraStream = new MediaStream(cameraStream.getVideoTracks());
					} catch (retryErr) {
						console.error("Basit ayarlarla da alınamadı:", retryErr);
					}
				}
			}
		} else {
			console.warn(
				"Seçili kamera cihazı bulunamadı. Mevcut cihazlar:",
				videoDevices.value.map((d) => ({
					deviceId: d.deviceId,
					label: d.label,
				}))
			);
		}

		return cameraStream;
	};

	const startCameraRecording = async () => {
		try {
			const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;
			if (!IPC_EVENTS) {
				throw new Error("IPC events are not available");
			}

			const cameraStream = await startCameraStream();

			if (!cameraStream) {
				console.error("Kamera stream'i alınamadı");
				return null;
			}

			cameraPath.value = await window.electron?.ipcRenderer.invoke(
				IPC_EVENTS.START_MEDIA_STREAM,
				"camera"
			);

			cameraRecorder.value = new MediaRecorder(cameraStream, {
				mimeType: config.value.mimeType,
				videoBitsPerSecond: config.value.videoBitsPerSecond,
			});

			cameraRecorder.value.ondataavailable = async (event) => {
				if (event.data.size > 0) {
					try {
						const chunk = await event.data.arrayBuffer();
						await window.electron?.ipcRenderer.invoke(
							IPC_EVENTS.WRITE_MEDIA_CHUNK,
							"camera",
							chunk
						);
					} catch (error) {
						console.error("Kamera chunk'ı yazılırken hata:", error);
					}
				}
			};

			cameraRecorder.value.onstop = () => {
				isCameraActive.value = false;

				try {
					cameraStream.getTracks().forEach((track) => track.stop());
				} catch (err) {
					console.error("Camera stream tracks durdurulurken hata:", err);
				}
			};

			cameraRecorder.value.onerror = (event) => {
				console.error("Camera recorder error:", event);
				isCameraActive.value = false;

				try {
					cameraStream.getTracks().forEach((track) => track.stop());
				} catch (err) {
					console.error("Camera stream tracks durdurulurken hata:", err);
				}
			};

			cameraRecorder.value.start(config.value.chunkInterval);
			isCameraActive.value = true;

			return { cameraPath: cameraPath.value };
		} catch (error) {
			console.error("Kamera kaydı başlatılırken hata:", error);
			isCameraActive.value = false;
			return null;
		}
	};

	const stopCameraRecording = async () => {
		try {
			isCameraActive.value = false;

			let cameraStreamTracks = [];

			if (cameraRecorder.value) {
				try {
					cameraRecorder.value.ondataavailable = null;
					cameraRecorder.value.onerror = null;
					cameraRecorder.value.onstop = null;

					if (cameraRecorder.value.stream) {
						cameraStreamTracks = [...cameraRecorder.value.stream.getTracks()];
					}

					if (cameraRecorder.value.state === "recording") {
						cameraRecorder.value.stop();
					}
				} catch (recorderError) {
					console.error("Kamera recorder durdurulurken hata:", recorderError);
				} finally {
					cameraRecorder.value = null;
				}
			}

			cameraStreamTracks.forEach((track) => {
				try {
					track.stop();
				} catch (err) {
					console.error(`Track durdurulurken hata: ${track.id}`, err);
				}
			});

			const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;
			if (IPC_EVENTS) {
				try {
					await window.electron?.ipcRenderer.invoke(
						IPC_EVENTS.END_MEDIA_STREAM,
						"camera"
					);
				} catch (streamError) {
					console.error("Camera stream sonlandırılırken hata:", streamError);
				}
			}

			return cameraPath.value;
		} catch (error) {
			console.error("Kamera kaydı durdurulurken hata:", error);
			isCameraActive.value = false;
			return cameraPath.value;
		}
	};

	// ===== RENDER FONKSİYONLARI =====
	const updateHoverScale = () => {
		const targetScale = isMouseOverCamera.value ? HOVER_SCALE : 1;
		hoverScale.value += (targetScale - hoverScale.value) * TRANSITION_SPEED;
	};

	const toggleBackgroundRemoval = async () => {
		if (isBackgroundRemovalActive.value) {
			stopBackgroundRemoval();
		} else {
			await startBackgroundRemoval();
		}
		return isBackgroundRemovalActive.value;
	};

	const drawHoverFrame = (
		ctx,
		x,
		y,
		width,
		height,
		radius,
		dpr,
		showHandles = false
	) => {
		ctx.save();

		// Sadece sol üstte handle göster
		if (showHandles) {
			const handleSize = 100 * dpr; // Match GIF handle size
			const handleX = x - handleSize / 2;
			const handleY = y - handleSize / 2;

			// Siyah rounded handle çiz
			ctx.fillStyle = "#000000";
			ctx.beginPath();
			ctx.arc(
				handleX + handleSize / 2,
				handleY + handleSize / 2,
				handleSize / 2,
				0,
				2 * Math.PI
			);
			ctx.fill();

			// Resize icon çiz - PNG image kullan
			const iconSize = handleSize * 0.6;
			const iconX = handleX + handleSize / 2 - iconSize / 2;
			const iconY = handleY + handleSize / 2 - iconSize / 2;

			// PNG image yükle ve çiz (senkron)
			if (!window.resizeIconImage) {
				window.resizeIconImage = new Image();
				window.resizeIconImage.crossOrigin = "anonymous";
				window.resizeIconImage.onload = () => {
					// Image yüklendiğinde canvas'ı yeniden çiz
					if (window.resizeIconImage.complete) {
						// Canvas'ı yeniden çizmek için event trigger
						window.dispatchEvent(new CustomEvent("resizeIconLoaded"));
					}
				};
				window.resizeIconImage.src = "/icons/chevron-up-down.png";
			}

			// Eğer image yüklendiyse çiz (45 derece döndürülmüş)
			if (window.resizeIconImage && window.resizeIconImage.complete) {
				ctx.save();
				ctx.translate(iconX + iconSize / 2, iconY + iconSize / 2);
				ctx.rotate(-Math.PI / 4); // 45 derece saat yönü tersinde
				ctx.drawImage(
					window.resizeIconImage,
					-iconSize / 2,
					-iconSize / 2,
					iconSize,
					iconSize
				);
				ctx.restore();
			} else {
				// Fallback: Beyaz çift ok çiz (45 derece döndürülmüş)
				ctx.save();
				ctx.translate(iconX + iconSize / 2, iconY + iconSize / 2);
				ctx.rotate(-Math.PI / 4); // 45 derece saat yönü tersinde

				ctx.strokeStyle = "#FFFFFF";
				ctx.lineWidth = 3 * dpr;
				ctx.lineCap = "round";
				ctx.lineJoin = "round";

				ctx.beginPath();
				// Üst ok (yukarı)
				ctx.moveTo(-iconSize / 4, iconSize / 4);
				ctx.lineTo(0, -iconSize / 4);
				ctx.lineTo(iconSize / 4, iconSize / 4);

				// Alt ok (aşağı)
				ctx.moveTo(-iconSize / 4, -iconSize / 4);
				ctx.lineTo(0, iconSize / 4);
				ctx.lineTo(iconSize / 4, -iconSize / 4);
				ctx.stroke();
				ctx.restore();
			}
		}

		ctx.restore();
	};

	const drawCamera = async (
		ctx,
		cameraElement,
		canvasWidth,
		canvasHeight,
		dpr,
		mouseX,
		mouseY,
		dragPosition = null,
		zoomScale = 1,
		videoPosition = { x: 0, y: 0 },
		backgroundType = "transparent",
		backgroundColor = "#000000",
		currentTime = 0,
		videoDuration = 0
	) => {
		if (!cameraSettings.value.visible) return false;
		if (!cameraElement) return false;

		const now = performance.now();
		if (now - lastFrameTime.value < frameLimiter.value && !dragPosition) {
			return isMouseOverCamera.value;
		}
		lastFrameTime.value = now;

		updateHoverScale();

		// Zoom durumunda kamera boyutlarını size'a göre ayarla ve aspect ratio'yu koru
		const baseCanvasWidth = canvasWidth;
		let cameraWidth = (baseCanvasWidth * cameraSettings.value.size) / 100;

		// Zoom varsa camera'yı smooth küçült
		if (zoomScale > 1.01) {
			const targetScale = 0.75; // Hedef küçültme oranı
			const lerpFactor = 0.15; // Yumuşak geçiş faktörü

			// Smooth lerp ile zoom scale'i güncelle
			cameraZoomScale.value =
				cameraZoomScale.value +
				(targetScale - cameraZoomScale.value) * lerpFactor;
			cameraWidth = cameraWidth * cameraZoomScale.value;
		} else {
			// Zoom yoksa normal boyuta dön
			const lerpFactor = 0.15;
			cameraZoomScale.value =
				cameraZoomScale.value + (1.0 - cameraZoomScale.value) * lerpFactor;
		}

		let cameraHeight;

		// Aspect ratio'yu her zaman koru
		if (
			cameraSettings.value?.aspectRatio &&
			cameraSettings.value.aspectRatio !== "free"
		) {
			switch (cameraSettings.value.aspectRatio) {
				case "1:1":
					cameraHeight = cameraWidth;
					break;
				case "16:9":
					cameraHeight = cameraWidth * (9 / 16);
					break;
				case "9:16":
					cameraHeight = cameraWidth * (16 / 9);
					break;
				case "4:3":
					cameraHeight = cameraWidth * (3 / 4);
					break;
				case "3:4":
					cameraHeight = cameraWidth * (4 / 3);
					break;
				default:
					cameraHeight = cameraWidth;
			}
		} else {
			cameraHeight = cameraWidth;
		}

		const videoRatio = cameraElement.videoWidth
			? cameraElement.videoWidth / cameraElement.videoHeight
			: 1;

		let targetRatio = 1;
		if (cameraSettings.value?.aspectRatio) {
			switch (cameraSettings.value.aspectRatio) {
				case "1:1":
					targetRatio = 1;
					break;
				case "16:9":
					targetRatio = 16 / 9;
					break;
				case "9:16":
					targetRatio = 9 / 16;
					break;
				case "4:3":
					targetRatio = 4 / 3;
					break;
				case "3:4":
					targetRatio = 3 / 4;
					break;
				case "custom":
					const customWidth = cameraSettings.value?.customRatioWidth || 16;
					const customHeight = cameraSettings.value?.customRatioHeight || 9;
					targetRatio = customWidth / customHeight;
					break;
				default:
					targetRatio = 1;
			}
		}

		const cropX = cameraSettings.value?.crop?.x || 0;
		const cropY = cameraSettings.value?.crop?.y || 0;
		const cropWidth = cameraSettings.value?.crop?.width || 56.25;
		const cropHeight = cameraSettings.value?.crop?.height || 100;
		const hasVideo = cameraElement.videoWidth && cameraElement.videoHeight;

		let sourceWidth, sourceHeight, sourceX, sourceY;

		if (hasVideo) {
			const originalWidth = cameraElement.videoWidth;
			const originalHeight = cameraElement.videoHeight;
			const originalRatio = originalWidth / originalHeight;

			if (cameraSettings.value?.aspectRatio === "free") {
				const cropAreaWidth = (originalWidth * cropWidth) / 100;
				const cropAreaHeight = (originalHeight * cropHeight) / 100;

				sourceX = (originalWidth * cropX) / 100;
				sourceY = (originalHeight * cropY) / 100;

				sourceWidth = cropAreaWidth;
				sourceHeight = cropAreaHeight;
			} else {
				const centerX =
					(originalWidth * cropX) / 100 + (originalWidth * cropWidth) / 200;
				const centerY =
					(originalHeight * cropY) / 100 + (originalHeight * cropHeight) / 200;

				let newSourceWidth, newSourceHeight;

				if (targetRatio >= 1) {
					newSourceWidth = Math.min(
						originalWidth,
						originalHeight * targetRatio
					);
					newSourceHeight = newSourceWidth / targetRatio;
				} else {
					newSourceHeight = Math.min(
						originalHeight,
						originalWidth / targetRatio
					);
					newSourceWidth = newSourceHeight * targetRatio;
				}

				sourceX = Math.max(0, centerX - newSourceWidth / 2);
				sourceY = Math.max(0, centerY - newSourceHeight / 2);

				if (sourceX + newSourceWidth > originalWidth) {
					sourceX = originalWidth - newSourceWidth;
				}
				if (sourceY + newSourceHeight > originalHeight) {
					sourceY = originalHeight - newSourceHeight;
				}

				sourceWidth = newSourceWidth;
				sourceHeight = newSourceHeight;
			}
		} else {
			sourceWidth = (cameraWidth * cropWidth) / 100;
			sourceHeight = (cameraHeight * cropHeight) / 100;
			sourceX = (cameraWidth * cropX) / 100;
			sourceY = (cameraHeight * cropY) / 100;
		}

		const maxRadius = Math.min(cameraWidth, cameraHeight) / 2;
		const safeRadius = Math.min(
			(cameraSettings.value?.radius || 0) * dpr * scaleValue,
			maxRadius
		);

		const maxShadowBlur = Math.min(cameraWidth, cameraHeight) * 0.2;
		const safeShadowBlur =
			((cameraSettings.value?.shadow || 0) / 100) * maxShadowBlur;

		let cameraX, cameraY;

		let timeBasedOffsetX = 0;
		let timeBasedOffsetY = 0;

		if (videoDuration > 0 && currentTime >= 0) {
			const normalizedTime = Math.min(currentTime / videoDuration, 1);

			const recordingDelay = 0.5;
			const adjustedTime = Math.max(0, currentTime - recordingDelay);
			const adjustedNormalizedTime = Math.min(adjustedTime / videoDuration, 1);

			// Zoom durumunda daha büyük time-based offset
			const baseMaxOffset = 20;
			const zoomMultiplier = zoomScale > 1 ? 2 : 1; // Zoom varsa offset'i 2 kat artır
			const maxOffset = baseMaxOffset * zoomMultiplier * dpr;
			timeBasedOffsetX = maxOffset * (1 - adjustedNormalizedTime);
			timeBasedOffsetY = maxOffset * (1 - adjustedNormalizedTime);
		}

		if (dragPosition && !cameraSettings.value.followMouse) {
			// Kamera drag edilirken video pozisyonunu kullanma
			cameraX = dragPosition.x + timeBasedOffsetX;
			cameraY = dragPosition.y + timeBasedOffsetY;
		} else if (cameraSettings.value.followMouse) {
			// Zoom durumunda daha küçük offset kullan
			const baseOffset = 60; // Azaltıldı (80 -> 40)
			const zoomMultiplier = zoomScale > 1 ? 1.8 : 1; // Azaltıldı (1.5 -> 1.2)
			const minOffset = baseOffset * zoomMultiplier;
			const offsetX = minOffset * dpr;
			const offsetY = minOffset * dpr;

			if (dragPosition) {
				// Kamera drag edilirken video pozisyonunu kullanma
				cameraX = dragPosition.x + timeBasedOffsetX;
				cameraY = dragPosition.y + timeBasedOffsetY;
			} else {
				// Mouse pozisyonunu doğrudan kullan (video pozisyonunu çıkarma)
				// Edge detection MediaPlayer'da yapılıyor, burada sadece basit pozisyonlama
				let targetX = mouseX - cameraWidth / 2;

				// Dinamik offset hesapla - camera size'ına ve cursor size'ına göre
				const { mouseSize } = usePlayerSettings();
				const cursorSize = mouseSize.value || 180; // Gerçek cursor size'ını al
				const cameraSizePercent = cameraSettings.value.size || 10;
				const cameraSizePixels = (canvasWidth * cameraSizePercent) / 100;

				// Offset'i camera size'ına göre ayarla
				const baseOffset = Math.max(cameraSizePixels * 0.3, 60 * dpr); // Camera'nın %30'u veya minimum 60px
				const cursorOffset = cursorSize * 0.2; // Cursor size'ının %20'si
				const dynamicOffset = baseOffset + cursorOffset;

				let targetY = mouseY + dynamicOffset; // Dinamik offset

				// Debug dinamik offset hesaplaması
				console.log("[DYNAMIC OFFSET DEBUG]", {
					cursorSize,
					cameraSizePercent,
					cameraSizePixels,
					baseOffset,
					cursorOffset,
					dynamicOffset,
					mouseY,
					targetY,
				});

				// Video pozisyonunu ekle
				targetX += videoPosition.x;
				targetY += videoPosition.y;

				// Smooth lerp - zoom'a göre hız ayarı
				const baseLerpFactor = 0.3;
				const zoomSpeedMultiplier = zoomScale > 1.01 ? 2.5 : 1; // Zoom'da daha hızlı
				const lerpFactor = baseLerpFactor * zoomSpeedMultiplier;

				const lastX = lastCameraPosition.value?.x || targetX;
				const lastY = lastCameraPosition.value?.y || targetY;

				cameraX = lastX + (targetX - lastX) * lerpFactor;
				cameraY = lastY + (targetY - lastY) * lerpFactor;
			}
		} else {
			// Sabit pozisyon durumunda da zoom'a göre offset ayarla
			const basePadding = 20;
			const zoomMultiplier = zoomScale > 1 ? 1.2 : 1; // Azaltıldı (1.5 -> 1.2)
			const padding = basePadding * zoomMultiplier * dpr;

			cameraX =
				(lastCameraPosition.value?.x || 30 * dpr) + // Daha solda (canvasWidth - cameraWidth - padding -> 30 * dpr)
				timeBasedOffsetX;
			cameraY =
				(lastCameraPosition.value?.y || 80 * dpr) + // Daha aşağıda (canvasHeight - cameraHeight - padding -> 80 * dpr)
				timeBasedOffsetY;
		}

		if (zoomScale > 1) {
			const zoomCameraWidth = cameraWidth;
			const zoomCameraHeight = cameraHeight;

			if (cameraSettings.value.followMouse) {
				const CANVAS_PADDING = 48 * dpr;
				cameraX = Math.max(
					CANVAS_PADDING,
					Math.min(canvasWidth - zoomCameraWidth - CANVAS_PADDING, cameraX)
				);
				cameraY = Math.max(
					CANVAS_PADDING,
					Math.min(canvasHeight - zoomCameraHeight - CANVAS_PADDING, cameraY)
				);
			}
		}

		if (cameraSettings.value.followMouse) {
			const CANVAS_PADDING = 48 * dpr;
			cameraX = Math.max(
				CANVAS_PADDING,
				Math.min(canvasWidth - cameraWidth - CANVAS_PADDING, cameraX)
			);
			cameraY = Math.max(
				CANVAS_PADDING,
				Math.min(canvasHeight - cameraHeight - CANVAS_PADDING, cameraY)
			);
		}

		if (dragPosition || !cameraSettings.value.followMouse || isResizing.value) {
			lastCameraPosition.value = {
				x: cameraX,
				y: cameraY,
			};
		}

		if (cameraSettings.value.optimizedBackgroundRemoval && cameraElement) {
			backgroundRemovalActive.value = true;

			if (!isTensorFlowInitialized.value) {
				initializeTensorFlow().then(() => {
					startTensorFlowProcessing();
				});
			} else if (!isTensorFlowProcessing.value) {
				startTensorFlowProcessing();
			}

			const frameKey = `${cameraElement?.currentTime || now}`;
			if (processingCache.value.has(frameKey)) {
				lastProcessedFrame.value = processingCache.value.get(frameKey);
			} else {
				processTensorFlowFrame(cameraElement)
					.then((processedCanvas) => {
						if (processedCanvas) {
							processingCache.value.set(frameKey, processedCanvas);
							lastProcessedFrame.value = processedCanvas;

							if (processingCache.value.size > 3) {
								const firstKey = processingCache.value.keys().next().value;
								processingCache.value.delete(firstKey);
							}
						}
					})
					.catch(() => {
						// Handle processing errors silently
					});
			}
		} else {
			backgroundRemovalActive.value = false;
			if (isTensorFlowProcessing.value) {
				stopTensorFlowProcessing();
			}
			lastProcessedFrame.value = null;
			processingCache.value.clear();
		}

		ctx.save();

		try {
			if (backgroundType === "color") {
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
				ctx.clip();
				ctx.globalAlpha = 1.0;
				ctx.fillStyle = backgroundColor;
				ctx.fill();
				ctx.restore();
			}

			const scaledWidth = cameraWidth * hoverScale.value;
			const scaledHeight = cameraHeight * hoverScale.value;
			const scaleOffsetX = (scaledWidth - cameraWidth) / 2;
			const scaleOffsetY = (scaledHeight - cameraHeight) / 2;

			ctx.translate(cameraX + cameraWidth / 2, cameraY + cameraHeight / 2);
			ctx.scale(hoverScale.value, hoverScale.value);
			ctx.translate(
				-(cameraX + cameraWidth / 2),
				-(cameraY + cameraHeight / 2)
			);

			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = "high";

			if (cameraSettings.value?.shadow > 0) {
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
				ctx.shadowColor = "rgba(0,0,0,0.6)";
				ctx.shadowBlur = safeShadowBlur;
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 0;
				ctx.fillStyle = "rgba(0,0,0,0.01)";
				ctx.fill();
				ctx.globalAlpha = 1.0;
				ctx.restore();
			}

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
			ctx.clip();

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

			if (cameraSettings.value?.mirror) {
				ctx.translate(cameraX + cameraWidth, cameraY);
				ctx.scale(-1, 1);
				ctx.translate(-cameraX, -cameraY);
			}

			if (backgroundRemovalActive.value && lastProcessedFrame.value) {
				const processedCanvas = lastProcessedFrame.value;

				ctx.drawImage(
					processedCanvas,
					sourceX,
					sourceY,
					sourceWidth,
					sourceHeight,
					cameraX,
					cameraY,
					cameraWidth,
					cameraHeight
				);
			} else {
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
			}

			ctx.restore();

			if (cameraSettings.value?.borderWidth > 0) {
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
				ctx.strokeStyle =
					cameraSettings.value.borderColor || "rgba(0, 0, 0, 1)";
				ctx.lineWidth = cameraSettings.value.borderWidth * dpr;
				ctx.stroke();
				ctx.restore();
			}

			if (
				(isMouseOverCamera.value && !cameraSettings.value?.followMouse) ||
				isCameraSelected.value ||
				isResizing.value
			) {
				const showHandles = isCameraSelected.value || isResizing.value;
				drawHoverFrame(
					ctx,
					cameraX,
					cameraY,
					cameraWidth,
					cameraHeight,
					safeRadius,
					dpr,
					showHandles
				);
			}

			// Hover durumunda da handle göster
			if (isMouseOverCamera.value && !cameraSettings.value?.followMouse) {
				drawHoverFrame(
					ctx,
					cameraX,
					cameraY,
					cameraWidth,
					cameraHeight,
					safeRadius,
					dpr,
					true
				);
			}
		} catch (error) {
			// Handle rendering errors gracefully without logging
		} finally {
			ctx.restore();
		}

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
			const isOverCamera = ctx.isPointInPath(mouseX, mouseY);

			let handle = null;
			if (isCameraSelected.value) {
				handle = detectHandle(
					mouseX,
					mouseY,
					{
						x: cameraX,
						y: cameraY,
						width: cameraWidth,
						height: cameraHeight,
					},
					dpr,
					scaleValue
				);
			}

			isMouseOverCamera.value =
				isOverCamera || (isCameraSelected.value && handle !== null);

			if (isCameraSelected.value && handle) {
				const canvas = document.getElementById("canvasID");
				if (canvas) {
					switch (handle) {
						case "tl":
						case "br":
							canvas.style.cursor = "nw-resize";
							break;
						case "tr":
						case "bl":
							canvas.style.cursor = "ne-resize";
							break;
					}
				}
			} else if (isOverCamera && !cameraSettings.value?.followMouse) {
				const canvas = document.getElementById("canvasID");
				if (canvas) {
					canvas.style.cursor = "move";
				}
			} else {
				const canvas = document.getElementById("canvasID");
				if (canvas) {
					canvas.style.cursor = "default";
				}
			}
		}

		const cameraRect = {
			x: cameraX,
			y: cameraY,
			width: cameraWidth,
			height: cameraHeight,
		};

		return {
			isMouseOver: isMouseOverCamera.value,
			rect: cameraRect,
		};
	};

	// ===== DRAG VE RESIZE FONKSİYONLARI =====
	const startDrag = (e, currentPosition, mouseX, mouseY) => {
		isDragging.value = true;
		const dpr = window.devicePixelRatio || 1;

		dragOffset.value = {
			x: mouseX - currentPosition.x,
			y: mouseY - currentPosition.y,
		};

		cameraPosition.value = { ...currentPosition };

		window.addEventListener("mousemove", handleDrag);
		window.addEventListener("mouseup", stopDrag);
	};

	const handleDrag = (e) => {
		if (!isDragging.value) return;

		const dpr = window.devicePixelRatio || 1;
		const canvas = document.getElementById("canvasID");

		if (!canvas) {
			console.warn("Canvas element not found during camera drag");
			return;
		}

		const rect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;

		const mouseX = (e.clientX - rect.left) * scaleX;
		const mouseY = (e.clientY - rect.top) * scaleY;

		cameraPosition.value = {
			x: mouseX - dragOffset.value.x,
			y: mouseY - dragOffset.value.y,
		};
	};

	const detectHandle = (mouseX, mouseY, cameraRect, dpr, scaleValue = 3) => {
		const handleSize = 100 * dpr; // Match GIF handle size

		// Sadece sol üst köşe için handle detection - tüm siyah alan resize alanı
		const handleX = cameraRect.x - handleSize / 2;
		const handleY = cameraRect.y - handleSize / 2;

		if (
			mouseX >= handleX &&
			mouseX <= handleX + handleSize &&
			mouseY >= handleY &&
			mouseY <= handleY + handleSize
		) {
			return "tl"; // Sadece sol üst köşe
		}

		return null;
	};

	const startResize = (
		e,
		currentPosition,
		currentSize,
		mouseX,
		mouseY,
		aspectRatio = "1:1"
	) => {
		const handle = detectHandle(
			mouseX,
			mouseY,
			{
				x: currentPosition.x,
				y: currentPosition.y,
				width: currentSize.width,
				height: currentSize.height,
			},
			window.devicePixelRatio || 1,
			3 // scaleValue
		);

		if (handle) {
			isResizing.value = true;
			resizeHandle.value = handle;
			initialSize.value = { ...currentSize };
			initialPosition.value = { ...currentPosition };
			lastCameraPosition.value = { ...currentPosition };

			window.addEventListener("mousemove", handleResize);
			window.addEventListener("mouseup", stopResize);
			return true;
		}

		return false;
	};

	const handleResize = (e) => {
		if (!isResizing.value) return;

		const dpr = window.devicePixelRatio || 1;
		const canvas = document.getElementById("canvasID");

		if (!canvas) {
			console.warn("Canvas element not found during camera resize");
			return;
		}

		const rect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;

		const mouseX = (e.clientX - rect.left) * scaleX;
		const mouseY = (e.clientY - rect.top) * scaleY;

		const aspectRatio = initialSize.value.width / initialSize.value.height;

		let newWidth, newHeight, newX, newY;

		// Basit resize mantığı - tüm köşeler için aynı
		const distanceX = Math.abs(
			mouseX - (initialPosition.value.x + initialSize.value.width / 2)
		);
		const distanceY = Math.abs(
			mouseY - (initialPosition.value.y + initialSize.value.height / 2)
		);
		const maxDistance = Math.max(distanceX, distanceY);

		newWidth = maxDistance * 2;
		newHeight = newWidth / aspectRatio;

		newX = initialPosition.value.x + initialSize.value.width / 2 - newWidth / 2;
		newY =
			initialPosition.value.y + initialSize.value.height / 2 - newHeight / 2;

		// Remove size constraints - allow unlimited resizing
		// const minSize = 50 * dpr;
		// if (newWidth < minSize) {
		// 	newWidth = minSize;
		// 	newHeight = newWidth / aspectRatio;
		// }
		// if (newHeight < minSize) {
		// 	newHeight = minSize;
		// 	newWidth = newHeight * aspectRatio;
		// }

		// Kamera boyutunu güncelle - remove size limits
		const canvasWidth = canvas.width;
		const newSizePercentage = (newWidth / canvasWidth) * 100;
		cameraSettings.value.size = newSizePercentage; // Remove size constraints

		cameraPosition.value = { x: newX, y: newY };
		lastCameraPosition.value = { x: newX, y: newY };

		return {
			position: { x: newX, y: newY },
			size: { width: newWidth, height: newHeight },
		};
	};

	const stopResize = () => {
		isResizing.value = false;
		resizeHandle.value = null;
		window.removeEventListener("mousemove", handleResize);
		window.removeEventListener("mouseup", stopResize);
	};

	const stopDrag = () => {
		isDragging.value = false;
		window.removeEventListener("mousemove", handleDrag);
		window.removeEventListener("mouseup", stopDrag);
	};

	return {
		// Kamera cihaz yönetimi
		videoDevices,
		selectedVideoDevice,
		isCameraActive,
		cameraPath,
		config,
		updateConfig,
		getVideoDevices,
		startCameraStream,
		startCameraRecording,
		stopCameraRecording,

		// Kamera render ve etkileşim
		drawCamera,
		isMouseOverCamera,
		isCameraSelected,
		lastCameraPosition,
		hoverScale,
		toggleBackgroundRemoval,
		isBackgroundRemovalLoading,
		isBackgroundRemovalActive,

		// Drag ve resize sistemi
		isDragging,
		isResizing,
		resizeHandle,
		cameraPosition,
		startDrag,
		handleDrag,
		stopDrag,
		startResize,
		handleResize,
		stopResize,
		detectHandle,
	};
};
