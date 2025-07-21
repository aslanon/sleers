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
import { CanvasFastBlur, createCursorBlur } from "~/composables/utils/canvasMotionBlur";
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
	const { 
		cursorTransitionType, 
		autoHideCursor,
		enhancedMotionBlur,
		motionBlurIntensity,
		cursorSmoothness,
		activeZoomScale
	} = usePlayerSettings();

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

	// Motion blur system - hareketin orta ve bitiş kısmı için
	const motionBlur = ref(null);
	const realMouseHistory = ref([]);
	const lastRealMousePos = ref({ x: 0, y: 0 });
	const realMouseSpeed = ref(0);
	const realMouseAcceleration = ref(0);
	const lastRealMouseSpeed = ref(0);
	const speedSamples = ref([]);
	const blurCooldown = ref(0);
	const motionPhase = ref('idle'); // 'idle', 'accelerating', 'peak', 'decelerating'
	const phaseStability = ref(0); // Phase değişimi için stabilite sayacı
	const currentBlurIntensity = ref(0); // Yumuşak geçiş için mevcut blur intensity
	const blurActiveFrames = ref(0); // Blur'un kaç frame aktif olduğu
	const minActiveFrames = 5; // Minimum aktif kalma süresi

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
	const tiltAngle = ref(0);
	const skewX = ref(0);
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

		// Motion blur sistemini başlat
		if (enhancedMotionBlur.value) {
			console.log('[MotionBlur] Initializing motion blur system...');
			motionBlur.value = createCursorBlur(cursorCanvas.value, {
				blur: 3
			});
			console.log('[MotionBlur] Motion blur system initialized:', !!motionBlur.value);
		}
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
			console.error("[useMouseCursor] ❌ Error initializing cursor system:", error);
		}
	});

	// Watch for settings changes to reinitialize motion blur if needed
	watch([enhancedMotionBlur, motionBlurIntensity], () => {
		if (enhancedMotionBlur.value && !motionBlur.value && cursorCanvas.value) {
			console.log('[MotionBlur] Reinitializing motion blur system due to settings change...');
			motionBlur.value = createCursorBlur(cursorCanvas.value, {
				blur: 3
			});
			console.log('[MotionBlur] Motion blur system reinitialized:', !!motionBlur.value);
		} else if (!enhancedMotionBlur.value && motionBlur.value) {
			console.log('[MotionBlur] Disabling motion blur system...');
			motionBlur.value.destroy();
			motionBlur.value = null;
		}
	});


	// Motion data hesaplama
	const calculateMotionData = (deltaX, deltaY, deltaTime) => {
		// Velocity hesapla (piksel/saniye)
		const velocity = {
			x: deltaTime > 0 ? deltaX / deltaTime : 0,
			y: deltaTime > 0 ? deltaY / deltaTime : 0
		};

		// Speed hesapla
		const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

		// Acceleration hesapla
		const accelerationX = (velocity.x - lastVelocity.value.x) / deltaTime;
		const accelerationY = (velocity.y - lastVelocity.value.y) / deltaTime;
		const acceleration = Math.sqrt(accelerationX * accelerationX + accelerationY * accelerationY);

		// Angle hesapla (hareket yönü)
		const angle = Math.atan2(velocity.y, velocity.x);

		// Değerleri güncelle
		lastVelocity.value = velocity;
		currentSpeed.value = speed;
		currentAcceleration.value = acceleration;

		return {
			velocity,
			speed,
			acceleration,
			angle
		};
	};

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

		// Gerçek mouse movement'ı hesapla (blur için) - zoom normalize edilmiş
		const realMouseMovement = {
			x: x - lastRealMousePos.value.x,
			y: y - lastRealMousePos.value.y
		};
		const rawDistance = Math.sqrt(realMouseMovement.x * realMouseMovement.x + realMouseMovement.y * realMouseMovement.y);
		
		// Zoom factor ile normalize et - zoom arttığında movement daha büyük görünür
		const zoomFactor = activeZoomScale.value || 1.25;
		const normalizedDistance = rawDistance / zoomFactor;
		
		// Speed samples ile smoothing yap (normalized distance kullan)
		speedSamples.value.push(normalizedDistance);
		if (speedSamples.value.length > 10) {
			speedSamples.value.shift();
		}
		
		// Smoothed speed hesapla
		const avgSpeed = speedSamples.value.reduce((a, b) => a + b, 0) / speedSamples.value.length;
		realMouseSpeed.value = avgSpeed;
		
		// İvme hesapla (smoothed)
		realMouseAcceleration.value = Math.abs(realMouseSpeed.value - lastRealMouseSpeed.value);
		
		// Blur cooldown'u azalt
		if (blurCooldown.value > 0) {
			blurCooldown.value--;
		}

		// Hedef pozisyonu güncelle
		targetX.value = x;
		targetY.value = y;

		// İlk çizimde cursor pozisyonunu hemen ayarla
		if (cursorX.value === 0 && cursorY.value === 0) {
			cursorX.value = x;
			cursorY.value = y;
		}
		
		// Son pozisyonu güncelle
		lastRealMousePos.value = { x, y };
		lastRealMouseSpeed.value = realMouseSpeed.value;

		// Ana canvas'a cursor'ı çiz
		ctx.save();

		// Hareket hızını hesapla
		const dx = targetX.value - cursorX.value;
		const dy = targetY.value - cursorY.value;
		const rawMoveSpeed = Math.sqrt(dx * dx + dy * dy);
		const moveSpeed = rawMoveSpeed;

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

		// Transform origin'i cursor'ın üst ortasına ayarla (eğim için)
		ctx.translate(cursorWidth/2, 0);
		
		// Dönüş ve eğim efektlerini uygula (warp/scale yok)
		ctx.rotate(rotation.value);
		ctx.rotate(tiltAngle.value); // Hareket yönüne göre eğim
		ctx.transform(1, 0, skewX.value, 1, 0, 0); // Skew transform
		// Scale efekti sadece tıklama anında (currentScale)
		ctx.scale(currentScale.value, currentScale.value);
		
		// Transform origin'i geri al
		ctx.translate(-cursorWidth/2, 0);

		// Motion phase detection - başlangıç/orta/bitiş
		let shouldApplyMotionBlur = false;
		
		// Motion phase'i belirle - zoom'a göre ayarlanmış threshold'lar
		const speedThreshold = 4 * zoomFactor; // Zoom arttıkça threshold da artar
		const accelThreshold = 2 * zoomFactor; // Zoom arttıkça threshold da artar
		
		let newPhase = motionPhase.value;
		
		// Daha stabil phase detection ile stabilite kontrolü
		let suggestedPhase;
		
		if (realMouseSpeed.value < 1.5) {
			suggestedPhase = 'idle';
		} else if (realMouseSpeed.value > speedThreshold && realMouseAcceleration.value > accelThreshold) {
			suggestedPhase = 'accelerating';
		} else if (realMouseSpeed.value > speedThreshold && Math.abs(realMouseAcceleration.value) < 2) {
			suggestedPhase = 'peak';
		} else if (realMouseSpeed.value > speedThreshold && realMouseAcceleration.value < -accelThreshold) {
			suggestedPhase = 'decelerating';
		} else {
			// Belirsiz durum - mevcut phase'i koru
			suggestedPhase = motionPhase.value;
		}
		
		// Phase değişimi için stabilite kontrolü
		if (suggestedPhase === motionPhase.value) {
			// Aynı phase - stability counter'ı artır
			phaseStability.value = Math.min(phaseStability.value + 1, 10);
		} else {
			// Farklı phase önerisi - stability counter'ı azalt
			phaseStability.value = Math.max(phaseStability.value - 1, 0);
		}
		
		// Sadece yeterli stabilite varsa phase değiştir
		if (phaseStability.value <= 2 && suggestedPhase !== motionPhase.value) {
			console.log('[MotionPhase] Stable transition:', motionPhase.value, '->', suggestedPhase, 'Speed:', realMouseSpeed.value.toFixed(1), 'Accel:', realMouseAcceleration.value.toFixed(1));
			motionPhase.value = suggestedPhase;
			phaseStability.value = 5; // Reset stability
		}
		
		// Hedef blur intensity'yi belirle (daha stabil)
		let targetBlurIntensity = 0;
		let shouldTriggerBlur = false;
		
		// Distance threshold'u da zoom'a göre ayarla
		const distanceThreshold = 3 * zoomFactor;
		
		// Blur tetikleme koşulları - daha gevşek
		if (motionPhase.value === 'accelerating' && realMouseSpeed.value > speedThreshold * 0.8 && normalizedDistance > distanceThreshold * 0.7) {
			targetBlurIntensity = 0.5;
			shouldTriggerBlur = true;
		} else if (motionPhase.value === 'peak' && realMouseSpeed.value > speedThreshold * 0.7 && normalizedDistance > distanceThreshold * 0.6) {
			targetBlurIntensity = 0.7;
			shouldTriggerBlur = true;
		} else if (motionPhase.value === 'decelerating' && realMouseSpeed.value > speedThreshold * 0.6 && normalizedDistance > distanceThreshold * 0.5) {
			targetBlurIntensity = 0.6;
			shouldTriggerBlur = true;
		}
		
		// Blur aktif frame sayısını takip et
		if (shouldTriggerBlur) {
			blurActiveFrames.value++;
		} else {
			// Blur tetiklenmiyor ama minimum süre dolmadıysa devam ettir
			if (blurActiveFrames.value > 0 && blurActiveFrames.value < minActiveFrames) {
				// Minimum süre boyunca blur'u sürdür
				targetBlurIntensity = Math.max(currentBlurIntensity.value * 0.9, 0.3);
				blurActiveFrames.value++;
			} else {
				blurActiveFrames.value = Math.max(0, blurActiveFrames.value - 2);
			}
		}
		
		// Yumuşak geçiş için current blur intensity'yi güncelle - daha stabil
		const blurTransitionSpeed = targetBlurIntensity > currentBlurIntensity.value ? 0.12 : 0.18;
		currentBlurIntensity.value += (targetBlurIntensity - currentBlurIntensity.value) * blurTransitionSpeed;
		
		// Motion blur sadece intensity > 0.1 olduğunda uygula
		const shouldActivateBlur = motionEnabled && 
			enhancedMotionBlur.value && 
			currentBlurIntensity.value > 0.1;
		
		if (shouldActivateBlur) {
			console.log('[MotionBlur] Smooth blur in phase:', motionPhase.value, 'Intensity:', currentBlurIntensity.value.toFixed(2), 'Speed:', realMouseSpeed.value.toFixed(1));
			
			// Smooth blur intensity'ye göre radius hesapla
			const blurRadius = Math.max(2, Math.round(currentBlurIntensity.value * 4));
			const blurIntensity = currentBlurIntensity.value;
			
			// Gerçek mouse hareket yönünü hesapla
			const realDirection = {
				x: realMouseMovement.x !== 0 ? realMouseMovement.x / rawDistance : 0,
				y: realMouseMovement.y !== 0 ? realMouseMovement.y / rawDistance : 0
			};
			
			// Hareket yönüne göre cursor eğimi hesapla
			const horizontalMovement = Math.abs(realDirection.x);
			const verticalMovement = Math.abs(realDirection.y);
			
			// Sadece yatay hareket yoğun olduğunda eğim uygula
			if (horizontalMovement > 0.3 && horizontalMovement > verticalMovement) {
				// Sağa hareket = cursor sola eğilir (negatif açı)
				// Sola hareket = cursor sağa eğilir (pozitif açı)  
				const maxTiltAngle = 0.1; // ~6 derece max eğim
				const targetTilt = -realDirection.x * maxTiltAngle * currentBlurIntensity.value;
				
				// Yumuşak eğim geçişi
				tiltAngle.value += (targetTilt - tiltAngle.value) * 0.3;
				
				// Skew efekti de ekle
				const maxSkew = 0.15;
				const targetSkew = realDirection.x * maxSkew * currentBlurIntensity.value;
				skewX.value += (targetSkew - skewX.value) * 0.3;
			} else {
				// Hareket yoksa veya dikey hareket dominant ise eğimi sıfırla
				tiltAngle.value *= 0.85;
				skewX.value *= 0.85;
			}
			
			// Blur için temp canvas
			const tempCanvas = document.createElement('canvas');
			tempCanvas.width = cursorWidth + 60;
			tempCanvas.height = cursorHeight + 60;
			const tempCtx = tempCanvas.getContext('2d');
			
			// Cursor'ı merkeze çiz
			tempCtx.drawImage(currentImage, 30, 30, cursorWidth, cursorHeight);
			
			// Motion blur uygula - yönlü blur
			const blur = new CanvasFastBlur({ blur: blurRadius });
			blur.initCanvas(tempCanvas);
			
			// Yönlü distance hesapla
			const speedFactor = Math.min(realMouseSpeed.value / 20, 1);
			const baseDistance = speedFactor * motionBlurIntensity.value * blurIntensity;
			
			// Hareket yönüne göre blur yönünü ayarla
			const directionalDistance = Math.min(baseDistance, 1.2);
			
			blur.mBlur(directionalDistance, realDirection);
			
			// Blurred cursor'ı çiz
			ctx.drawImage(tempCanvas, -hotspot.x - 30, -hotspot.y - 30);
			shouldApplyMotionBlur = true;
		} else {
			// Motion blur yoksa eğimleri sıfırla
			tiltAngle.value *= 0.9;
			skewX.value *= 0.9;
		}

		// Cursor'ı çiz (sadece motion blur uygulanmadıysa)
		if (!shouldApplyMotionBlur) {
			ctx.drawImage(
				currentImage,
				-hotspot.x,
				-hotspot.y,
				cursorWidth,
				cursorHeight
			);
		}

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

		// Cursor smoothness - yüksek değer = daha hızlı/responsive
		// cursorSmoothness: 0-1 range, yüksek değer daha responsive
		const smoothnessFactor = cursorSmoothness.value;
		let adaptiveSpeed;
		
		if (distanceToTarget < 0.5) {
			// Çok yakın mesafede anında hareket et
			cursorX.value = targetX.value;
			cursorY.value = targetY.value;
			adaptiveSpeed = 1;
		} else {
			// Yüksek smoothness = yüksek hız = daha responsive
			const baseSpeed = Math.max(smoothnessFactor * 0.3, 0.05); // Min 0.05, max 0.3
			const distanceFactor = Math.min(distanceToTarget / 20, 1);
			adaptiveSpeed = baseSpeed * (1 + distanceFactor);
		}

		// Smoothness'e göre max speed - yüksek smoothness = daha yüksek max
		const maxSpeed = Math.max(smoothnessFactor * 0.8, 0.1);
		const normalizedSpeed = Math.min(adaptiveSpeed * (60 * deltaTime), maxSpeed);

		// Pozisyonu güncelle - daha stabil
		if (distanceToTarget >= 0.5) {
			const moveX = (targetX.value - cursorX.value) * normalizedSpeed;
			const moveY = (targetY.value - cursorY.value) * normalizedSpeed;
			
			// Çok küçük hareketleri filtrele (stabillik için)
			if (Math.abs(moveX) > 0.1) cursorX.value += moveX;
			if (Math.abs(moveY) > 0.1) cursorY.value += moveY;
		}

		// Hareket vektörünü hesapla
		const dx = cursorX.value - prevX;
		const dy = cursorY.value - prevY;
		const moveSpeed = Math.sqrt(dx * dx + dy * dy);

		// Sadece hafif rotasyon efekti (warp yok)
		const maxRotation = 0.008; // Daha düşük rotasyon
		const rotationTarget = dx * maxRotation * Math.min(moveSpeed / 30, 0.5);

		// Efektleri yumuşak geçişle uygula
		const effectSpeed = Math.min(1, deltaTime * 60);
		rotation.value += (rotationTarget - rotation.value) * effectSpeed * 0.15;
		
		// Warp değerlerini sabit 1.0'da tut (boyut değişimi yok)
		warpX.value += (1.0 - warpX.value) * effectSpeed * 0.2;
		warpY.value += (1.0 - warpY.value) * effectSpeed * 0.2;
		
		// Sadece tıklama scale'i
		currentScale.value +=
			(targetScale.value - currentScale.value) * effectSpeed * 0.3;

		// Animasyonu devam ettir
		requestAnimationFrame(animateCursor);
	};

	// Component unmount olduğunda cleanup
	onUnmounted(() => {
		if (inactivityTimeout.value) {
			clearTimeout(inactivityTimeout.value);
		}
		if (motionBlur.value) {
			motionBlur.value.destroy();
			motionBlur.value = null;
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
		tiltAngle,
		skewX,
		cursorSmoothness,
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
		// Motion blur status
		realMouseSpeed,
		realMouseAcceleration,
		motionPhase,
		currentBlurIntensity,
		phaseStability,
	};
};
