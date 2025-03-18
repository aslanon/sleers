import { ref, onMounted, watch } from "vue";
import defaultCursor from "@/assets/cursors/high/default.svg";
import pointerCursor from "@/assets/cursors/high/pointer.svg";
import grabbingCursor from "@/assets/cursors/high/grabbing.svg";
import textCursor from "@/assets/cursors/high/text.svg";
import { calculateZoomOrigin } from "~/composables/utils/zoomPositions";
import {
	calculateMousePosition,
	calculateMouseMovement,
	calculateVideoDisplaySize,
} from "~/composables/utils/mousePosition";
import {
	calculateMotionBlurEffects,
	calculateStabilizedPosition,
	calculateStabilizedAngle,
	calculateLargeDistanceTransition,
	cubicBezier,
	setCursorTransitionType,
} from "~/composables/utils/motionBlur";
import { usePlayerSettings } from "~/composables/usePlayerSettings";

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
	// Player ayarlarını al
	const { cursorTransitionType } = usePlayerSettings();

	// Component başlatıldığında transition tipini ayarla
	onMounted(() => {
		if (cursorTransitionType.value) {
			setCursorTransitionType(cursorTransitionType.value);
		}
	});

	// Transition tipi değişikliklerini izle
	watch(cursorTransitionType, (newType) => {
		if (newType) {
			setCursorTransitionType(newType);
		}
	});

	const cursorImages = ref({
		default: null,
		pointer: null,
		grabbing: null,
		text: null,
	});

	const currentCursorType = ref("default");
	const isMouseDown = ref(false);
	const isDragging = ref(false);
	const isHovering = ref(false);
	const hoverTarget = ref(null);

	// Cursor canvas ve context
	const cursorCanvas = ref(null);
	const cursorCtx = ref(null);
	const cursorSize = ref(80); // custom-cursor.js'deki gibi 80 değeri
	const dpr = ref(1);

	// Animasyon için değişkenler - custom-cursor.js'deki gibi
	const cursorX = ref(0);
	const cursorY = ref(0);
	const targetX = ref(0);
	const targetY = ref(0);
	const currentScale = ref(1);
	const targetScale = ref(1);
	const rotation = ref(0);
	const targetRotation = ref(0);
	const warpX = ref(1);
	const warpY = ref(1);
	const targetWarpX = ref(1);
	const targetWarpY = ref(1);
	const speed = 0.5; // custom-cursor.js'deki gibi 0.1 değeri
	const animationActive = ref(false);
	const lastTimestamp = ref(0);
	const isVisible = ref(true);

	// Cursor canvas'ını oluştur
	const createCursorCanvas = () => {
		// Eğer zaten oluşturulmuşsa tekrar oluşturma
		if (cursorCanvas.value) return;

		// Canvas oluştur
		cursorCanvas.value = document.createElement("canvas");
		cursorCtx.value = cursorCanvas.value.getContext("2d");

		// Canvas boyutunu ayarla - cursor boyutunun 3 katı (kırpılma sorununu önlemek için)
		const size = cursorSize.value * 3;
		cursorCanvas.value.width = size;
		cursorCanvas.value.height = size;
	};

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

			// Cursor canvas'ını oluştur
			createCursorCanvas();
		} catch (error) {
			console.error("Error loading cursor images:", error);
		}
	});

	// Tıklama animasyonu
	const handleClickAnimation = () => {
		targetScale.value = 0.9; // Tıklama anında küçült (0.8 yerine 0.9 kullanarak daha az küçültme)

		// Belirli bir süre sonra normal boyuta dön
		setTimeout(() => {
			targetScale.value = 1;
		}, 150);
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

	// Cursor çizim fonksiyonu (ana canvas'a)
	const drawMousePosition = (ctx, options) => {
		const {
			x,
			y,
			event,
			size = 80, // custom-cursor.js'deki gibi 80 değeri
			dpr: devicePixelRatio = 1,
			motionEnabled = true,
			visible = true,
		} = options;

		if (!visible) {
			isVisible.value = false;
			return;
		}

		isVisible.value = true;
		dpr.value = devicePixelRatio;

		// Size değiştiğinde cursor boyutunu güncelle
		if (cursorSize.value !== size) {
			cursorSize.value = size;
		}

		// Cursor görselini kontrol et
		if (!cursorImages.value[currentCursorType.value]) {
			console.warn(
				`Cursor image not found for type: ${currentCursorType.value}`
			);
			return;
		}

		// Event'e göre cursor tipini güncelle
		updateCursorType(event);

		// Hedef pozisyonu güncelle
		targetX.value = x;
		targetY.value = y;

		// İlk çizimde cursor pozisyonunu hemen ayarla
		if (cursorX.value === 0 && cursorY.value === 0) {
			cursorX.value = x;
			cursorY.value = y;
		}

		// Ana canvas'a cursor'ı çiz
		ctx.save();

		// Hareket hızını hesapla
		const dx = targetX.value - cursorX.value;
		const dy = targetY.value - cursorY.value;
		const moveSpeed = Math.sqrt(dx * dx + dy * dy);

		// İvmelenme durumunda blur efektini artır
		if (motionEnabled) {
			// Kısa hareketlerde blur efektini kaldır (moveSpeed < 3 için blur yok)
			if (moveSpeed > 3) {
				const blurAmount = Math.min(moveSpeed * 0.5, 3.0);
				ctx.filter = `blur(${blurAmount}px)`;
			} else {
				ctx.filter = "none";
			}
		} else {
			ctx.filter = "none";
		}

		// Cursor görselini doğrudan çiz
		const cursorImg = cursorImages.value[currentCursorType.value];
		if (!cursorImg) return;

		// Cursor boyutunu hesapla
		const cursorWidth = cursorSize.value * currentScale.value;
		const cursorHeight = cursorSize.value * currentScale.value;

		// Cursor tipine göre hotspot pozisyonunu ayarla (20px cursor boyutu için)
		// Bu değerler SVG'lerin içindeki boşlukları dikkate alarak ayarlanmıştır
		const hotspots = {
			default: { x: 3, y: 3 }, // Default cursor için uç noktası (ok işareti)
			pointer: { x: 3, y: 4 }, // Pointer cursor için uç noktası (el işareti)
			grabbing: { x: 4, y: 5 }, // Grabbing cursor için uç noktası (yumruk işareti)
			text: { x: 4, y: 5 }, // Text cursor için uç noktası (I-beam işareti)
			grab: { x: 4, y: 5 }, // Grab cursor için uç noktası
			resize: { x: 4, y: 5 }, // Resize cursor için uç noktası
		};

		// Geçerli cursor tipi için hotspot'u al
		const baseHotspot = hotspots[currentCursorType.value] || hotspots.default;

		// Hotspot pozisyonunu cursor boyutuna göre ölçekle
		// 20px baz boyut için tanımlanmış hotspot değerlerini, mevcut cursor boyutuna göre orantılı olarak ayarla
		const hotspotScale = cursorSize.value / 20;

		// Doğrusal olmayan ölçekleme için düzeltme faktörü
		// Size arttıkça hotspot değerlerinin daha az artmasını sağlar
		const correctionFactor =
			0.85 + 0.15 * (20 / Math.max(20, cursorSize.value));

		const hotspot = {
			x: baseHotspot.x * hotspotScale * correctionFactor,
			y: baseHotspot.y * hotspotScale * correctionFactor,
		};

		// Cursor'ı çiz - hotspot pozisyonunu kullanarak cursor'ın uç noktasının tam olarak mouse pozisyonuna gelmesini sağla
		ctx.save();

		// Mouse size'a göre cursor pozisyonunu ayarla
		// Size arttıkça cursor'ı sola ve yukarıya doğru kaydır
		// Cursor tipine göre farklı offset faktörleri kullanıyoruz
		const baseOffsetFactors = {
			default: { x: 0.25, y: 0.15 },
			pointer: { x: 0.3, y: 0.2 },
			grabbing: { x: 0.35, y: 0.25 },
			text: { x: 0.35, y: 0.25 },
			grab: { x: 0.35, y: 0.25 },
			resize: { x: 0.35, y: 0.25 },
		};

		const offsetFactor =
			baseOffsetFactors[currentCursorType.value] || baseOffsetFactors.default;
		const offsetX = (cursorSize.value - 20) * offsetFactor.x;
		const offsetY = (cursorSize.value - 20) * offsetFactor.y;

		// Cursor'ı mouse pozisyonuna taşı ve offset uygula
		ctx.translate(cursorX.value - offsetX, cursorY.value - offsetY);

		// Dönüş ve warp efektlerini uygula
		ctx.rotate(rotation.value);
		ctx.scale(warpX.value, warpY.value);

		// Cursor'ı çiz - hotspot pozisyonunu kullanarak cursor'ın uç noktasının tam olarak mouse pozisyonuna gelmesini sağla
		ctx.drawImage(cursorImg, -hotspot.x, -hotspot.y, cursorWidth, cursorHeight);

		ctx.restore();

		// Animasyonu başlat (eğer zaten çalışmıyorsa)
		if (!animationActive.value) {
			animationActive.value = true;
			requestAnimationFrame(animateCursor);
		}
	};

	// Animasyon fonksiyonu
	const animateCursor = (timestamp) => {
		if (!animationActive.value) return;

		// Delta time hesapla (saniye cinsinden)
		const deltaTime = lastTimestamp.value
			? (timestamp - lastTimestamp.value) / 1000
			: 0.016;
		lastTimestamp.value = timestamp;

		// Önceki pozisyonu kaydet
		const prevX = cursorX.value;
		const prevY = cursorY.value;

		// Hedef pozisyona doğru hareket et
		cursorX.value += (targetX.value - cursorX.value) * speed;
		cursorY.value += (targetY.value - cursorY.value) * speed;

		// Hareket yönünü ve hızını hesapla
		const dx = cursorX.value - prevX;
		const dy = cursorY.value - prevY;

		// Hareket hızını hesapla
		const moveSpeed = Math.sqrt(dx * dx + dy * dy);

		// Eğimi ve warp değerlerini hız ve yönlere göre ayarla
		const maxRotation = 0.015;
		targetRotation.value = dx * maxRotation;

		const maxWarp = 0.02;
		targetWarpX.value = 1 + Math.min(Math.abs(dx) * maxWarp, 0.03);
		targetWarpY.value = 1 - Math.min(Math.abs(dy) * maxWarp, 0.03);

		// Smooth geçişler
		rotation.value += (targetRotation.value - rotation.value) * 0.1;
		warpX.value += (targetWarpX.value - warpX.value) * 0.1;
		warpY.value += (targetWarpY.value - warpY.value) * 0.1;
		currentScale.value += (targetScale.value - currentScale.value) * 0.2;

		// Animasyonu devam ettir
		requestAnimationFrame(animateCursor);
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
