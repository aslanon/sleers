import { ref, onMounted } from "vue";
import defaultCursor from "@/assets/cursors/default.svg";
import pointerCursor from "@/assets/cursors/pointer.svg";
import grabbingCursor from "@/assets/cursors/grabbing.svg";
import textCursor from "@/assets/cursors/text.svg";
import { calculateZoomOrigin } from "~/composables/utils/zoomPositions";
import {
	calculateMousePosition,
	calculateMouseMovement,
	calculateVideoDisplaySize,
} from "~/composables/utils/mousePosition";
import {
	calculateMotionBlurEffects,
	applyTrailEffects,
	applyDeformationEffects,
} from "~/composables/utils/motionBlur";

export const MOUSE_EVENTS = {
	MOVE: "move",
	DOWN: "mousedown",
	UP: "mouseup",
	DRAG: "drag",
	WHEEL: "wheel",
	HOVER: "hover",
	CLICK: "click",
};

export const CURSOR_TYPES = {
	DEFAULT: "default",
	POINTER: "pointer",
	GRABBING: "grabbing",
	TEXT: "text",
	GRAB: "grab",
	RESIZE: "resize",
};

export const useMouseCursor = () => {
	const cursorImages = ref({
		default: null,
		pointer: null,
		grabbing: null,
		text: null,
	});

	const currentCursorType = ref("default");
	const isMouseDown = ref(false);
	const isDragging = ref(false);
	const clickScale = ref(1); // Tıklama animasyonu için scale değeri
	const isHovering = ref(false);
	const hoverTarget = ref(null);

	// Cursor görsellerini yükle
	onMounted(async () => {
		try {
			const loadImage = (src) => {
				return new Promise((resolve, reject) => {
					const img = new Image();
					img.onload = () => resolve(img);
					img.onerror = (e) => {
						console.error(`Failed to load cursor image: ${src}`, e);
						reject(e);
					};
					img.src = src;
				});
			};

			console.log("Loading cursor images...");

			// Tüm cursor görsellerini paralel olarak yükle
			const [defaultImg, pointerImg, grabbingImg, textImg] = await Promise.all([
				loadImage(defaultCursor),
				loadImage(pointerCursor),
				loadImage(grabbingCursor),
				loadImage(textCursor),
			]);

			console.log("Cursor images loaded successfully");

			cursorImages.value = {
				default: defaultImg,
				pointer: pointerImg,
				grabbing: grabbingImg,
				text: textImg,
			};
		} catch (error) {
			console.error("Error loading cursor images:", error);
		}
	});

	// Tıklama animasyonu
	const handleClickAnimation = () => {
		clickScale.value = 0.8; // Tıklama anında %80'e küçült
		setTimeout(() => {
			clickScale.value = 1; // Direkt normal boyuta dön
		}, 100); // 100ms sonra
	};

	// Mouse event'lerine göre cursor tipini güncelle
	const updateCursorType = (event) => {
		if (!event) return;

		const prevType = currentCursorType.value;
		let newType = prevType;

		switch (event.type) {
			case MOUSE_EVENTS.DOWN:
				isMouseDown.value = true;
				newType = CURSOR_TYPES.POINTER;
				handleClickAnimation();
				break;
			case MOUSE_EVENTS.UP:
				isMouseDown.value = false;
				isDragging.value = false;
				newType = isHovering.value
					? CURSOR_TYPES.POINTER
					: CURSOR_TYPES.DEFAULT;
				break;
			case MOUSE_EVENTS.DRAG:
				isDragging.value = true;
				newType = CURSOR_TYPES.GRABBING;
				break;
			case MOUSE_EVENTS.HOVER:
				isHovering.value = true;
				hoverTarget.value = event.target;
				newType = CURSOR_TYPES.POINTER;
				break;
			case MOUSE_EVENTS.MOVE:
				if (!isMouseDown.value && !isDragging.value) {
					newType = isHovering.value
						? CURSOR_TYPES.POINTER
						: CURSOR_TYPES.DEFAULT;
				}
				break;
		}

		if (prevType !== newType) {
			currentCursorType.value = newType;
			// Cursor type değişikliğini kaydet
			if (event.recordChange) {
				event.recordChange({
					type: "cursor_change",
					from: prevType,
					to: newType,
					timestamp: Date.now(),
				});
			}
		}
	};

	// Mouse pozisyonunu çiz
	const drawMousePosition = (ctx, options) => {
		const {
			x,
			y,
			event,
			size = 124,
			dpr = 1,
			motionEnabled = false,
			motionBlurValue = 0.5,
		} = options;

		if (!cursorImages.value[currentCursorType.value]) {
			console.warn(
				`Cursor image not found for type: ${currentCursorType.value}`
			);
			return;
		}

		// Event'e göre cursor tipini güncelle
		updateCursorType(event);

		// Context'i kaydet
		ctx.save();

		// Her zaman en üstte çizilmesi için
		ctx.globalCompositeOperation = "source-over";

		// Cursor boyutunu ve pozisyonunu hesapla
		const cursorSize = size * dpr * clickScale.value;
		const cursorImg = cursorImages.value[currentCursorType.value];
		const cursorWidth = cursorSize;
		const cursorHeight = cursorSize;

		// SVG viewBox içindeki cursor pozisyonlarını tanımla
		const svgOffsets = {
			default: { offsetX: -7, offsetY: -4 },
			pointer: { offsetX: -8, offsetY: -5 },
			grabbing: { offsetX: -12, offsetY: -12 },
			text: { offsetX: -2, offsetY: -12 },
			grab: { offsetX: -12, offsetY: -12 },
			resize: { offsetX: -12, offsetY: -12 },
		};

		// Geçerli cursor için offset'i al
		const offset = svgOffsets[currentCursorType.value] || svgOffsets.default;

		// SVG offset'ini cursor boyutuna göre ölçekle
		const scaledOffsetX = (offset.offsetX * cursorWidth) / 24;
		const scaledOffsetY = (offset.offsetY * cursorHeight) / 24;

		// Cursor'ı çizmek için pozisyonu ayarla
		const adjustedX = x + scaledOffsetX;
		const adjustedY = y + scaledOffsetY;

		// Motion blur efekti
		if (motionEnabled && event?.speed > 0) {
			const { easedIntensity, deformAmount, blurAmount, shouldApplyEffect } =
				calculateMotionBlurEffects(
					event.speed,
					Math.sqrt(event.dirX * event.dirX + event.dirY * event.dirY) * 100,
					undefined,
					undefined,
					motionBlurValue
				);

			if (shouldApplyEffect) {
				ctx.save();
				ctx.globalAlpha = 1; // Her zaman tam görünür

				// Cursor'ın merkez noktasına göre transform uygula
				ctx.translate(
					adjustedX + cursorWidth / 2,
					adjustedY + cursorHeight / 2
				);

				// Hareket yönünde warp
				const warpAmount = deformAmount * 0.8;
				ctx.transform(
					1 + Math.abs(event.dirX * warpAmount), // Yatay genişleme
					event.dirY * warpAmount * 0.5, // Yatay eğim (daha az)
					event.dirX * warpAmount * 0.5, // Dikey eğim (daha az)
					1 + Math.abs(event.dirY * warpAmount), // Dikey genişleme
					0,
					0
				);

				// Gaussian blur
				const blurRadius = blurAmount * 2;
				ctx.filter = `blur(${blurRadius}px)`;

				// Cursor'ı merkez noktasından çiz
				ctx.drawImage(
					cursorImg,
					-cursorWidth / 2,
					-cursorHeight / 2,
					cursorWidth,
					cursorHeight
				);

				ctx.restore();
			} else {
				// Normal cursor çizimi (düşük hızda)
				ctx.save();
				ctx.globalAlpha = 1;
				ctx.filter = "none";
				ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
				ctx.shadowBlur = 4 * dpr;
				ctx.shadowOffsetX = 1 * dpr;
				ctx.shadowOffsetY = 1 * dpr;
				ctx.drawImage(
					cursorImg,
					adjustedX,
					adjustedY,
					cursorWidth,
					cursorHeight
				);
				ctx.restore();
			}
		} else {
			// Normal cursor çizimi (hareket yok)
			ctx.save();
			ctx.globalAlpha = 1;
			ctx.filter = "none";
			ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
			ctx.shadowBlur = 4 * dpr;
			ctx.shadowOffsetX = 1 * dpr;
			ctx.shadowOffsetY = 1 * dpr;
			ctx.drawImage(cursorImg, adjustedX, adjustedY, cursorWidth, cursorHeight);
			ctx.restore();
		}

		// Debug için hotspot noktasını göster (geliştirme sırasında yardımcı olur)
		if (process.env.NODE_ENV === "development") {
			ctx.beginPath();
			ctx.arc(x, y, 2, 0, Math.PI * 2);
			ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
			ctx.fill();
		}

		ctx.restore();
	};

	// Hover state yönetimi
	const handleHover = (element, isHoverable = false) => {
		if (isHoverable) {
			element.addEventListener("mouseenter", () => {
				isHovering.value = true;
				hoverTarget.value = element;
				updateCursorType({ type: MOUSE_EVENTS.HOVER, target: element });
			});

			element.addEventListener("mouseleave", () => {
				isHovering.value = false;
				hoverTarget.value = null;
				updateCursorType({ type: MOUSE_EVENTS.MOVE });
			});
		}
	};

	return {
		currentCursorType,
		isMouseDown,
		isDragging,
		isHovering,
		MOUSE_EVENTS,
		CURSOR_TYPES,
		drawMousePosition,
		handleHover,
	};
};
