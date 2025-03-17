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
	const clickScale = ref(1); // Tıklama animasyonu için scale değeri
	const isHovering = ref(false);
	const hoverTarget = ref(null);

	// Son pozisyon bilgisi
	const lastPosition = ref({ x: 0, y: 0, timestamp: 0 });

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

	// Tıklama animasyonu - daha smooth
	const handleClickAnimation = () => {
		clickScale.value = 0.85; // Tıklama anında %85'e küçült (daha az agresif)

		// Smooth geri dönüş için setTimeout kullan
		setTimeout(() => {
			clickScale.value = 0.92;

			setTimeout(() => {
				clickScale.value = 0.96;

				setTimeout(() => {
					clickScale.value = 1;
				}, 50);
			}, 50);
		}, 50);
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
			size = 180,
			dpr = 1,
			motionEnabled = false,
			motionBlurValue = 0.5,
			visible = true,
		} = options;

		if (!visible) return;

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
		ctx.globalAlpha = 1.0;

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

		// Hareket hızını ve yönünü hesapla
		let speed = 0;
		let dirX = 0;
		let dirY = 0;
		let distance = 0;
		let isSmallMovement = false;
		let isClickMovement = false;

		if (event) {
			// Tıklama eventini kontrol et
			if (
				event.type === MOUSE_EVENTS.DOWN ||
				event.type === MOUSE_EVENTS.CLICK
			) {
				isClickMovement = true;
			}

			// Hız ve yön bilgisi varsa kullan
			if (
				event.speed !== undefined &&
				event.dirX !== undefined &&
				event.dirY !== undefined
			) {
				speed = event.speed;
				dirX = event.dirX;
				dirY = event.dirY;

				// Mesafeyi hesapla (eğer verilmemişse)
				if (event.distance !== undefined) {
					distance = event.distance;
				} else {
					distance = Math.sqrt(dirX * dirX + dirY * dirY) * 100;
				}
			}
			// Yoksa son pozisyondan hesapla
			else if (lastPosition.value.timestamp > 0) {
				const now = Date.now();
				const timeDiff = now - lastPosition.value.timestamp;

				if (timeDiff > 0 && timeDiff < 100) {
					// 100ms'den eski verileri kullanma
					const dx = x - lastPosition.value.x;
					const dy = y - lastPosition.value.y;
					distance = Math.sqrt(dx * dx + dy * dy);

					// Yüksek mesafe eşiği - cubic-bezier animasyonu kullanmak için
					// Tıklama anlarında eşiği düşür
					const HIGH_DISTANCE_THRESHOLD = isClickMovement ? 20 : 80;

					// Yüksek mesafelerde farklı animasyon stratejisi kullan
					if (distance > HIGH_DISTANCE_THRESHOLD || isClickMovement) {
						// Son pozisyonu güncelle
						lastPosition.value = { x, y, timestamp: Date.now() };

						// Piksel/ms -> piksel/s
						speed = distance / (timeDiff / 1000);

						// Yön vektörünü normalize et
						dirX = dx / distance;
						dirY = dy / distance;

						// Cubic-bezier geçiş efektini hesapla - tıklama için özel parametre
						const {
							shouldApplyCubicBezier,
							cubicBezierParams,
							effectStrength,
							speedFactor = 1,
						} = calculateLargeDistanceTransition(
							distance,
							HIGH_DISTANCE_THRESHOLD,
							isClickMovement
						);

						// Mesafeye göre blur miktarını ayarla
						// Daha az blur, daha net cursor
						let blurAmount = Math.min(effectStrength, 1.0);

						// Tıklama anında blur azalt
						if (isClickMovement) {
							blurAmount = Math.min(blurAmount * 0.5, 0.5);
						}

						// Özel motion blur ayarları ile cursor çizimi
						ctx.save();
						ctx.globalAlpha = 1.0;

						// Yüksek mesafelerde hafif blur uygula
						if (
							shouldApplyCubicBezier &&
							effectStrength > 0.15 &&
							!isClickMovement
						) {
							ctx.filter = `blur(${blurAmount}px)`;
						}

						ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
						ctx.shadowBlur = 2 * dpr;
						ctx.shadowOffsetX = 1 * dpr;
						ctx.shadowOffsetY = 1 * dpr;

						// Cursor pozisyonunu çiz
						ctx.drawImage(
							cursorImg,
							adjustedX,
							adjustedY,
							cursorWidth,
							cursorHeight
						);
						ctx.restore();
						ctx.restore(); // Ana context'i restore et
						return;
					}

					// Çok küçük hareketleri filtrele
					if (distance < 1.5 && !isClickMovement) {
						isSmallMovement = true;
						// Son pozisyonu güncelle ama hız ve yön hesaplama
						lastPosition.value = { x, y, timestamp: Date.now() };

						// Normal cursor çizimi (çok küçük hareket)
						ctx.save();
						ctx.globalAlpha = 1.0;
						ctx.filter = "none";
						ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
						ctx.shadowBlur = 2 * dpr;
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
						ctx.restore(); // Ana context'i restore et
						return;
					}

					// Piksel/ms -> piksel/s
					speed = distance / (timeDiff / 1000);

					// Yön vektörünü normalize et
					if (distance > 0) {
						dirX = dx / distance;
						dirY = dy / distance;
					}
				} else {
					// Zaman farkı çok büyükse veya negatifse, hareket yok say
					isSmallMovement = true;
				}
			}

			// Son pozisyonu güncelle
			if (!isSmallMovement) {
				lastPosition.value = { x, y, timestamp: Date.now() };
			}
		}

		// Güncellenmiş motion blur efekti
		if (motionEnabled && speed > 0 && !isSmallMovement) {
			// Efekt değerini normalize et (0-1 arası)
			const normalizedIntensity = motionBlurValue;

			// Motion blur efektlerini hesapla
			const {
				easedIntensity,
				deformAmount,
				blurAmount,
				shouldApplyEffect,
				speedFactor,
				accelerationFactor,
				accelerationBoost,
			} = calculateMotionBlurEffects(
				speed,
				distance,
				normalizedIntensity * 100
			);

			// Daha keskin eşik değeri - düşük hızlarda hiç efekt olmasın
			const MIN_SPEED_THRESHOLD = isClickMovement ? 1.0 : 2.5;
			const effectThreshold = speed > MIN_SPEED_THRESHOLD;

			if ((shouldApplyEffect && effectThreshold) || isClickMovement) {
				// Stabilize edilmiş açı
				const rawAngle = Math.atan2(dirY, dirX);
				const angle = calculateStabilizedAngle(rawAngle, speed);

				ctx.save();

				// Cursor'u çiz
				ctx.globalAlpha = 1.0;
				ctx.globalCompositeOperation = "source-over";

				// Cursor'u sol üst köşesinden konumlandır (origin olarak sol üst köşe)
				ctx.translate(adjustedX, adjustedY);

				// Hareket yönüne göre rotasyon uygula - sadece hareket başında/sonunda
				const maxRotationDegree = isClickMovement ? 5 : 10; // Tıklama anında daha az rotasyon
				const rotationFactor = isClickMovement ? 0.05 : 0.1; // Tıklama anında daha az rotasyon

				// İvmelenme hesaplama - sadece ani ivme değişimlerinde yüksek değerler
				const hasAcceleration = accelerationFactor > 0.3; // Daha yüksek eşik

				// Rotasyon etkisini hesaplarken ani hız değişimlerine daha duyarlı ol
				const rotationBoost = hasAcceleration
					? Math.min(accelerationFactor * 0.3, 0.3)
					: 0;

				// Hız faktörünü daha dengeli hale getir - aşırı hızlarda bile daha yavaş artış
				const limitedSpeedFactor = Math.min(
					Math.pow(speedFactor, 1.5) * 0.8,
					0.8
				);

				// Rotasyon açısını hesapla - daha kararlı
				const directionRotation =
					Math.min(
						Math.max(
							-maxRotationDegree,
							angle * (180 / Math.PI) * rotationFactor
						),
						maxRotationDegree
					) *
					(limitedSpeedFactor + rotationBoost);

				// Rotasyonu radyana çevir
				const rotationRad = directionRotation * (Math.PI / 180);

				// Rotasyonu uygula - tıklama hareketi için daha az rotasyon
				if (!isClickMovement) {
					ctx.rotate(rotationRad);
				}

				// Blur efekti - daha dengeli ve tutarlı
				let baseBlur = Math.min(blurAmount * 1.2, 3.0);

				// Tıklama anında daha az blur
				if (isClickMovement) {
					baseBlur = Math.min(baseBlur * 0.3, 0.8);
				}

				const dynamicBlur =
					hasAcceleration && !isClickMovement
						? baseBlur + accelerationFactor * 1.5
						: baseBlur;

				const finalBlurValue = Math.min(dynamicBlur, 3.0); // Üst sınır

				// Tıklama anında blur'ı azalt veya kaldır
				if (!isClickMovement && finalBlurValue > 0.5) {
					ctx.filter = `blur(${finalBlurValue}px)`;
				}

				// Gölge ekle - daha iyi görünürlük için
				ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
				ctx.shadowBlur = 2 * dpr;
				ctx.shadowOffsetX = 1 * dpr;
				ctx.shadowOffsetY = 1 * dpr;

				// Hızlı hareketlerde warp efekti - daha kontrollü
				if (speed > 4.0 && !isClickMovement) {
					// Skew ve stretch değerlerini azalt - daha az deformasyon
					const skewFactor = 0.06 * speedFactor * normalizedIntensity;
					const stretchFactor = 0.08 * speedFactor * normalizedIntensity;

					const skewX = -dirX * deformAmount * skewFactor;
					const skewY = -dirY * deformAmount * skewFactor;

					// Uzatma efektini sınırla
					const stretchX =
						1 +
						Math.abs(dirX * deformAmount * stretchFactor) *
							easedIntensity *
							0.5;
					const stretchY =
						1 +
						Math.abs(dirY * deformAmount * stretchFactor) *
							easedIntensity *
							0.5;

					ctx.scale(stretchX, stretchY);
					ctx.transform(1, skewY, skewX, 1, 0, 0);
				}

				// Cursor'u çiz (0,0 noktasından)
				ctx.drawImage(cursorImg, 0, 0, cursorWidth, cursorHeight);

				ctx.restore();
			} else {
				// Normal cursor çizimi (düşük hızda)
				ctx.save();
				ctx.globalAlpha = 1.0;
				ctx.filter = "none";
				ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
				ctx.shadowBlur = 2 * dpr;
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
			// Hareketsiz veya düşük hızdaki cursor çizimi
			ctx.save();
			ctx.globalAlpha = 1.0;
			ctx.filter = "none";
			ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
			ctx.shadowBlur = 2 * dpr;
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
