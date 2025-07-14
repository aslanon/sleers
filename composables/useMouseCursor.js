import { ref, onMounted, watch, onUnmounted } from "vue";
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
	const { cursorTransitionType, autoHideCursor } = usePlayerSettings();

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
		grab: null,
		resize: null,
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
	const warpX = ref(1);
	const warpY = ref(1);
	const speed = 0.2; // Decreased for smoother movement
	const animationActive = ref(false);
	const lastTimestamp = ref(0);
	const isVisible = ref(true);

	// Cursor hareketsizlik takibi için değişkenler
	const lastMovementTime = ref(Date.now());
	const inactivityTimeout = ref(null);
	const INACTIVITY_DURATION = 3000; // 3 saniye

	// Cursor hareketsizlik kontrolü
	const checkCursorInactivity = () => {
		// Otomatik gizlenme kapalıysa işlem yapma
		if (!autoHideCursor.value) {
			isVisible.value = true;
			return;
		}

		if (inactivityTimeout.value) {
			clearTimeout(inactivityTimeout.value);
		}

		inactivityTimeout.value = setTimeout(() => {
			isVisible.value = false;
		}, INACTIVITY_DURATION);

		// Eğer cursor gizliyse ve hareket varsa göster
		if (!isVisible.value) {
			isVisible.value = true;
		}

		lastMovementTime.value = Date.now();
	};

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
					img.onload = () => {
						resolve(img);
					};
					img.onerror = (e) => {
						console.error(
							`[useMouseCursor] ❌ Failed to load cursor image: ${src}`,
							e
						);
						reject(e);
					};
					img.src = src;
				});
			};


			// Tüm cursor görsellerini paralel olarak yükle
			const [defaultImg, pointerImg, grabbingImg, textImg] = await Promise.all([
				loadImage(defaultCursor),
				loadImage(pointerCursor),
				loadImage(grabbingCursor),
				loadImage(textCursor),
			]);


			// Cursor image mapping'i güncelle
			cursorImages.value = {
				default: defaultImg,
				pointer: pointerImg,
				grabbing: grabbingImg,
				text: textImg,
				grab: grabbingImg, // Grab için grabbing cursor'ı kullan
				resize: defaultImg, // Resize için şimdilik default cursor
			};


			// Cursor canvas'ını oluştur
			createCursorCanvas();
		} catch (error) {
			console.error("[useMouseCursor] ❌ Error loading cursor images:", error);
		}
	});

	// Tıklama animasyonu
	const handleClickAnimation = () => {
		targetScale.value = 0.8; // More noticeable click effect

		// Belirli bir süre sonra normal boyuta dön
		setTimeout(() => {
			targetScale.value = 1;
		}, 150);
	};

	// Mouse event'lerine göre cursor tipini güncelle
	const updateCursorType = (event) => {
		if (!event) return;

		const prevType = currentCursorType.value;
		let newType = event.cursorType || CURSOR_TYPES.DEFAULT;

		// Mousedown/mouseup olaylarını işle
		if (event.type === MOUSE_EVENTS.DOWN) {
			handleClickAnimation();
			if (currentCursorType.value === CURSOR_TYPES.GRAB) {
				newType = CURSOR_TYPES.GRABBING;
			}
		} else if (event.type === MOUSE_EVENTS.UP) {
			if (currentCursorType.value === CURSOR_TYPES.GRABBING) {
				newType = CURSOR_TYPES.GRAB;
			}
		}

		// Cursor tipini güncelle
		if (prevType !== newType) {

			// Cursor type'ı küçük harfe çevir
			const normalizedType = newType.toLowerCase();

			// Eğer bu cursor type için görsel varsa güncelle
			if (cursorImages.value[normalizedType]) {
				currentCursorType.value = normalizedType;

				if (event.recordChange) {
					event.recordChange({
						type: "cursor_change",
						from: prevType,
						to: normalizedType,
						timestamp: Date.now(),
					});
				}
			} else {
				console.warn(
					`[useMouseCursor] ⚠️ No image for cursor type: ${normalizedType}`
				);
				currentCursorType.value = "default";
			}
		}
	};

	// Cursor çizim fonksiyonu (ana canvas'a)
	const drawMousePosition = (ctx, options) => {
		const {
			x,
			y,
			event,
			size = 80,
			dpr: devicePixelRatio = 1,
			motionEnabled = true,
			visible = true,
		} = options;

		// Mouse hareketi varsa inaktivite kontrolünü başlat
		if (x !== cursorX.value || y !== cursorY.value) {
			checkCursorInactivity();
		}

		if (!isVisible.value) {
			return;
		}

		isVisible.value = true;
		dpr.value = devicePixelRatio;

		// Size değiştiğinde cursor boyutunu güncelle
		if (cursorSize.value !== size) {
			cursorSize.value = size;
		}

		// Event'e göre cursor tipini güncelle
		if (event) {
			updateCursorType(event);
		}

		// Cursor görselini kontrol et
		const currentImage = cursorImages.value[currentCursorType.value];
		if (!currentImage) {
			console.warn(
				`[useMouseCursor] ⚠️ No cursor image for type: ${currentCursorType.value}`,
				"Available images:",
				Object.keys(cursorImages.value),
				"Current event:",
				event
			);
			return;
		}

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

		// Cursor boyutunu hesapla
		const cursorWidth = cursorSize.value * currentScale.value;
		const cursorHeight = cursorSize.value * currentScale.value;

		// Cursor tipine göre hotspot pozisyonunu ayarla
		const hotspots = {
			default: { x: 3, y: 3 },
			pointer: { x: 3, y: 4 },
			grabbing: { x: 4, y: 5 },
			text: { x: 4, y: 5 },
			grab: { x: 4, y: 5 },
			resize: { x: 4, y: 5 },
		};

		const baseHotspot = hotspots[currentCursorType.value] || hotspots.default;
		const hotspotScale = cursorSize.value / 20;
		const correctionFactor =
			0.85 + 0.15 * (20 / Math.max(20, cursorSize.value));

		const hotspot = {
			x: baseHotspot.x * hotspotScale * correctionFactor,
			y: baseHotspot.y * hotspotScale * correctionFactor,
		};

		// Mouse size'a göre cursor pozisyonunu ayarla
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

		// Blur efektini sadece cursor çizimi için uygula
		if (motionEnabled && moveSpeed > 50) {
			const blurAmount = Math.min(moveSpeed * 0.4, 2.8);
			ctx.filter = `blur(${blurAmount}px)`;
		} else {
			ctx.filter = "none";
		}

		// Cursor'ı çiz
		ctx.drawImage(
			currentImage,
			-hotspot.x,
			-hotspot.y,
			cursorWidth,
			cursorHeight
		);

		// Efektleri sıfırla
		ctx.filter = "none";
		ctx.restore();

		// Animasyonu başlat
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

		// Hedef noktaya olan mesafeyi hesapla
		const distanceToTarget = Math.sqrt(
			Math.pow(targetX.value - cursorX.value, 2) +
				Math.pow(targetY.value - cursorY.value, 2)
		);

		// Mesafeye ve hıza bağlı olarak adaptif smoothing uygula
		let adaptiveSpeed;
		if (distanceToTarget < 2) {
			// Çok yakın mesafede anında hareket et
			cursorX.value = targetX.value;
			cursorY.value = targetY.value;
			adaptiveSpeed = 1;
		} else if (distanceToTarget < 10) {
			// Yakın mesafede hızlı hareket
			adaptiveSpeed = speed * 3;
		} else if (distanceToTarget > 100) {
			// Uzak mesafede daha akıcı hareket
			adaptiveSpeed = speed * (1 + (distanceToTarget - 100) / 200);
		} else {
			// Normal mesafede standart hız
			adaptiveSpeed = speed * 1.5;
		}

		// Hareket hızını deltaTime ile normalize et
		const normalizedSpeed = adaptiveSpeed * (60 * deltaTime);

		// Pozisyonu güncelle
		if (distanceToTarget >= 2) {
			cursorX.value += (targetX.value - cursorX.value) * normalizedSpeed;
			cursorY.value += (targetY.value - cursorY.value) * normalizedSpeed;
		}

		// Hareket vektörünü hesapla
		const dx = cursorX.value - prevX;
		const dy = cursorY.value - prevY;
		const moveSpeed = Math.sqrt(dx * dx + dy * dy);

		// Rotasyon ve warp efektlerini hesapla
		const maxRotation = 0.015;
		const rotationTarget = dx * maxRotation * Math.min(moveSpeed / 30, 0.7);

		const maxWarp = 0.045;
		const speedFactor = Math.min(moveSpeed / 15, 1);
		const warpXTarget =
			1 + Math.min(Math.abs(dx) * maxWarp * speedFactor, 0.065);
		const warpYTarget =
			1 - Math.min(Math.abs(dy) * maxWarp * speedFactor, 0.065);

		// Efektleri yumuşak geçişle uygula
		const effectSpeed = Math.min(1, deltaTime * 60);
		rotation.value += (rotationTarget - rotation.value) * effectSpeed * 0.15;
		warpX.value += (warpXTarget - warpX.value) * effectSpeed * 0.15;
		warpY.value += (warpYTarget - warpY.value) * effectSpeed * 0.15;
		currentScale.value +=
			(targetScale.value - currentScale.value) * effectSpeed * 0.3;

		// Animasyonu devam ettir
		requestAnimationFrame(animateCursor);
	};

	// Component unmount olduğunda timeout'u temizle
	onUnmounted(() => {
		if (inactivityTimeout.value) {
			clearTimeout(inactivityTimeout.value);
		}
	});

	return {
		cursorCanvas,
		cursorCtx,
		cursorSize,
		dpr,
		cursorX,
		cursorY,
		targetX,
		targetY,
		currentScale,
		targetScale,
		rotation,
		warpX,
		warpY,
		speed,
		animationActive,
		lastTimestamp,
		isVisible,
		currentCursorType,
		isMouseDown,
		isDragging,
		isHovering,
		hoverTarget,
		updateCursorType,
		drawMousePosition,
		handleClickAnimation,
	};
};
