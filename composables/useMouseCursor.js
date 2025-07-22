import { ref, computed, onMounted, watch, onUnmounted } from "vue";
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

	// Cursor tipi değişimi için bekleme listesi - efekt aktifken kullanılacak
	const pendingCursorType = ref(null);
	
	// Efekt aktiflik durumunu kontrol eden computed
	const isEffectActive = computed(() => {
		return realMouseSpeed.value > 3 || 
			   currentBlurIntensity.value > 0.1 || 
			   motionPhase.value !== 'idle' ||
			   blurActiveFrames.value > 0;
	});

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

			// Eğer efekt aktifse, cursor tipi değişimini ertele
			if (isEffectActive.value) {
				// Bekleyen cursor tipini kaydet
				pendingCursorType.value = normalizedType;
				console.log(`[useMouseCursor] Cursor change delayed due to active effect: ${prevType} -> ${normalizedType}`);
				return;
			}

			// Eğer bu cursor type için görsel varsa güncelle
			if (cursorImages.value[normalizedType]) {
				currentCursorType.value = normalizedType;
				pendingCursorType.value = null; // Pending'i temizle

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
				pendingCursorType.value = null;
			}
		}
	};

	// Efekt bittiğinde bekleyen cursor tipini uygula
	const applyPendingCursorType = () => {
		if (pendingCursorType.value && !isEffectActive.value) {
			const normalizedType = pendingCursorType.value;
			
			if (cursorImages.value[normalizedType]) {
				const prevType = currentCursorType.value;
				currentCursorType.value = normalizedType;
				console.log(`[useMouseCursor] Applied pending cursor change: ${prevType} -> ${normalizedType}`);
			}
			
			pendingCursorType.value = null;
		}
	};

	// Timeline-based cursor effect calculation for export/playback
	const calculateCursorEffectsFromData = (mousePositions, currentTime, videoDuration) => {
		if (!mousePositions || mousePositions.length < 2) {
			return {
				motionPhase: 'idle',
				blurIntensity: 0,
				rotation: 0,
				tiltAngle: 0,
				skewX: 0,
				scale: 1,
				speed: 0,
				acceleration: 0
			};
		}

		// Find the surrounding positions for current time
		const totalFrames = mousePositions.length;
		const normalizedTime = currentTime / videoDuration;
		const estimatedTimestamp = normalizedTime * mousePositions[totalFrames - 1].timestamp;

		// Find closest positions by timestamp
		let prevIndex = -1;
		let nextIndex = -1;
		let prevTimeDiff = Infinity;
		let nextTimeDiff = Infinity;

		for (let i = 0; i < totalFrames; i++) {
			const pos = mousePositions[i];
			const timeDiff = pos.timestamp - estimatedTimestamp;

			if (timeDiff <= 0 && Math.abs(timeDiff) < prevTimeDiff) {
				prevTimeDiff = Math.abs(timeDiff);
				prevIndex = i;
			}

			if (timeDiff >= 0 && timeDiff < nextTimeDiff) {
				nextTimeDiff = timeDiff;
				nextIndex = i;
			}
		}

		// Fallbacks
		if (prevIndex === -1) prevIndex = 0;
		if (nextIndex === -1 || nextIndex === prevIndex) {
			nextIndex = Math.min(prevIndex + 1, totalFrames - 1);
		}

		const prevPos = mousePositions[prevIndex];
		const nextPos = mousePositions[nextIndex];

		// Calculate movement and timing data from recorded positions
		const deltaX = nextPos.x - prevPos.x;
		const deltaY = nextPos.y - prevPos.y;
		const deltaTime = (nextPos.timestamp - prevPos.timestamp) / 1000; // Convert to seconds
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

		// Calculate speed and acceleration from frame data
		const speed = deltaTime > 0 ? distance / deltaTime : 0;
		
		// Look ahead for acceleration calculation
		let acceleration = 0;
		if (nextIndex < totalFrames - 1) {
			const futurePos = mousePositions[nextIndex + 1];
			const futureDeltaX = futurePos.x - nextPos.x;
			const futureDeltaY = futurePos.y - nextPos.y;
			const futureDeltaTime = (futurePos.timestamp - nextPos.timestamp) / 1000;
			const futureDistance = Math.sqrt(futureDeltaX * futureDeltaX + futureDeltaY * futureDeltaY);
			const futureSpeed = futureDeltaTime > 0 ? futureDistance / futureDeltaTime : 0;
			
			acceleration = futureDeltaTime > 0 ? (futureSpeed - speed) / futureDeltaTime : 0;
		}

		// Motion phase detection based on recorded data
		const speedThreshold = 100; // pixels per second
		const accelThreshold = 50;  // pixels per second²
		
		let motionPhase = 'idle';
		if (speed < 20) {
			motionPhase = 'idle';
		} else if (speed > speedThreshold && acceleration > accelThreshold) {
			motionPhase = 'accelerating';
		} else if (speed > speedThreshold && Math.abs(acceleration) < 20) {
			motionPhase = 'peak';
		} else if (speed > speedThreshold && acceleration < -accelThreshold) {
			motionPhase = 'decelerating';
		}

		// Skip effects for short distance movements - no need for effects on small movements
		const isShortMovement = distance < 20 || speed < 50;
		
		// Calculate blur intensity based on motion phase and speed (skip for short movements)
		let blurIntensity = 0;
		const speedRatio = speed / speedThreshold;
		
		// No blur for short movements - keeps cursor clean for small adjustments
		if (!isShortMovement && speed > 60) { // Higher threshold for blur
			if (motionPhase === 'accelerating' && speed > speedThreshold * 0.8) {
				blurIntensity = Math.min(0.3 * speedRatio, 0.6); // Further reduced intensity
			} else if (motionPhase === 'peak' && speed > speedThreshold * 0.7) {
				blurIntensity = Math.min(0.4 * speedRatio, 0.7); // Further reduced intensity
			} else if (motionPhase === 'decelerating' && speed > speedThreshold * 0.6) {
				blurIntensity = Math.min(0.25 * speedRatio, 0.5); // Further reduced intensity
			} else if (speed > speedThreshold * 0.6) {
				// General movement blur for smooth transitions (higher threshold)
				blurIntensity = Math.min(0.15 * speedRatio, 0.4);
			}
		}
		
		// Calculate rotation based on movement direction (only for longer movements)
		let rotation = 0;
		if (!isShortMovement && distance > 25 && speed > 60) {
			// Only apply rotation for meaningful movement
			const normalizedSpeed = Math.min(speed / speedThreshold, 1.0);
			rotation = Math.atan2(deltaY, deltaX) * 0.04 * normalizedSpeed; // Even more subtle
		}

		// Calculate tilt based on horizontal movement (only for significant movements)
		let tiltAngle = 0;
		if (!isShortMovement && Math.abs(deltaX) > 30 && speed > 70) {
			// Only tilt for significant horizontal movement
			const horizontalRatio = Math.abs(deltaX) / Math.max(Math.abs(deltaY), 1);
			if (horizontalRatio > 2.0) { // More predominantly horizontal movement required
				const normalizedSpeed = Math.min(speed / speedThreshold, 1.0);
				tiltAngle = (deltaX / 300) * Math.PI / 18 * normalizedSpeed; // Further reduced tilt
			}
		}

		// Calculate skew for motion effect (only for fast movements)
		let skewX = 0;
		if (!isShortMovement && speed > 80) {
			// Only skew for faster movements
			const normalizedSpeed = Math.min(speed / speedThreshold, 1.0);
			skewX = Math.min(deltaX / 500, 0.08) * normalizedSpeed; // Further reduced skew
		}

		// Scale remains 1 unless there's a click event (handled separately)
		const scale = 1;

		return {
			motionPhase,
			blurIntensity,
			rotation,
			tiltAngle,
			skewX,
			scale,
			speed,
			acceleration,
			prevPos,
			nextPos,
			estimatedTimestamp
		};
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

		// Check if timeline effects are provided in event data
		const hasTimelineEffects = event && event.motionPhase && event.blurIntensity !== undefined;

		// Transform origin'i cursor'ın üst ortasına ayarla (eğim için)
		ctx.translate(cursorWidth/2, 0);
		
		// Apply rotation and tilt effects - use timeline data if available with smoothing
		if (hasTimelineEffects) {
			// Smooth timeline-based rotation and tilt effects
			const targetRotation = event.rotation || 0;
			const targetTilt = event.tiltAngle || 0;
			const targetSkew = event.skewX || 0;
			
			// Apply smooth transitions for stability
			const rotationSpeed = 0.2;
			const tiltSpeed = 0.2;
			const skewSpeed = 0.25;
			
			// Limit extreme values to prevent jarring movements
			const maxRotation = Math.PI / 8; // 22.5 degrees max
			const maxTilt = Math.PI / 12;     // 15 degrees max
			const maxSkew = 0.15;             // Reasonable skew limit
			
			const clampedRotation = Math.max(-maxRotation, Math.min(maxRotation, targetRotation));
			const clampedTilt = Math.max(-maxTilt, Math.min(maxTilt, targetTilt));
			const clampedSkew = Math.max(-maxSkew, Math.min(maxSkew, targetSkew));
			
			// Smooth transitions
			rotation.value += (clampedRotation - rotation.value) * rotationSpeed;
			tiltAngle.value += (clampedTilt - tiltAngle.value) * tiltSpeed;
			skewX.value += (clampedSkew - skewX.value) * skewSpeed;
			
			// Apply smoothed values
			ctx.rotate(rotation.value);
			ctx.rotate(tiltAngle.value);
			ctx.transform(1, 0, skewX.value, 1, 0, 0);
		} else {
			// Use real-time effects
			ctx.rotate(rotation.value);
			ctx.rotate(tiltAngle.value);
			ctx.transform(1, 0, skewX.value, 1, 0, 0);
		}
		
		// Scale efekti sadece tıklama anında (currentScale)
		ctx.scale(currentScale.value, currentScale.value);
		
		// Transform origin'i geri al
		ctx.translate(-cursorWidth/2, 0);
		
		// Motion phase detection - use timeline data if available
		let shouldApplyMotionBlur = false;
		let currentMotionPhase;
		let targetBlurIntensity = 0;
		let shouldTriggerBlur = false;
		
		if (hasTimelineEffects) {
			// Use timeline-based effects with smoothing
			currentMotionPhase = event.motionPhase;
			targetBlurIntensity = event.blurIntensity;
			shouldTriggerBlur = targetBlurIntensity > 0;
			
			// Update motion phase for consistency with stability check
			if (event.motionPhase !== motionPhase.value) {
				// Only change phase if it's stable for a few frames
				if (!motionPhase.timelinePhaseStability) {
					motionPhase.timelinePhaseStability = 0;
				}
				motionPhase.timelinePhaseStability++;
				
				if (motionPhase.timelinePhaseStability > 3) {
					motionPhase.value = currentMotionPhase;
					motionPhase.timelinePhaseStability = 0;
				}
			} else {
				motionPhase.timelinePhaseStability = 0;
			}
			
			// Smooth blur intensity transitions
			const blurTransitionSpeed = targetBlurIntensity > currentBlurIntensity.value ? 0.15 : 0.25;
			currentBlurIntensity.value += (targetBlurIntensity - currentBlurIntensity.value) * blurTransitionSpeed;
			
			console.log('[TimelineEffects] Using timeline data - Phase:', currentMotionPhase, 'Target:', targetBlurIntensity.toFixed(2), 'Current:', currentBlurIntensity.value.toFixed(2));
		} else {
			// Original real-time motion detection logic
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
			
			currentMotionPhase = motionPhase.value;
		}
		
		// Only calculate blur if not using timeline effects
		if (!hasTimelineEffects) {
			// Distance threshold'u da zoom'a göre ayarla
			const distanceThreshold = 3 * zoomFactor;
			const speedThreshold = 4 * zoomFactor;
			
			// Blur tetikleme koşulları - daha gevşek
			if (currentMotionPhase === 'accelerating' && realMouseSpeed.value > speedThreshold * 0.8 && normalizedDistance > distanceThreshold * 0.7) {
				targetBlurIntensity = 0.5;
				shouldTriggerBlur = true;
			} else if (currentMotionPhase === 'peak' && realMouseSpeed.value > speedThreshold * 0.7 && normalizedDistance > distanceThreshold * 0.6) {
				targetBlurIntensity = 0.7;
				shouldTriggerBlur = true;
			} else if (currentMotionPhase === 'decelerating' && realMouseSpeed.value > speedThreshold * 0.6 && normalizedDistance > distanceThreshold * 0.5) {
				targetBlurIntensity = 0.6;
				shouldTriggerBlur = true;
			}
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
			
			// Mouse hareket yönünü hesapla - timeline data varsa oradan al
			let realDirection;
			if (hasTimelineEffects && event.dirX !== undefined && event.dirY !== undefined) {
				// Use timeline-based direction
				realDirection = {
					x: event.dirX,
					y: event.dirY
				};
			} else {
				// Use real-time movement direction
				realDirection = {
					x: realMouseMovement.x !== 0 ? realMouseMovement.x / rawDistance : 0,
					y: realMouseMovement.y !== 0 ? realMouseMovement.y / rawDistance : 0
				};
			}
			
			// Only update tilt/skew effects if not using timeline data
			if (!hasTimelineEffects) {
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
			
			// Hareket yönüne göre blur yönünü ayarla - trail hareket yönünün tersinde olmalı
			const directionalDistance = Math.min(baseDistance, 1.2);
			
			// Trail efekti için direction'ı ters çevir
			const trailDirection = {
				x: -realDirection.x, // Hareket yönünün tersi
				y: -realDirection.y  // Hareket yönünün tersi
			};
			
			blur.mBlur(directionalDistance, trailDirection);
			
			// Blurred cursor'ı çiz
			ctx.drawImage(tempCanvas, -hotspot.x - 30, -hotspot.y - 30);
			shouldApplyMotionBlur = true;
		} else {
			// Motion blur yoksa eğimleri sıfırla (sadece timeline kullanmıyorsak)
			if (!hasTimelineEffects) {
				tiltAngle.value *= 0.9;
				skewX.value *= 0.9;
			}
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

	// Timeline-based cursor drawing function for export/playback
	const drawMousePositionFromTimeline = (ctx, mousePositions, currentTime, videoDuration, options = {}) => {
		const {
			size = 80,
			dpr: devicePixelRatio = 1,
			motionEnabled = true,
			visible = true,
			enhancedMotionBlur: enabledMotionBlur = enhancedMotionBlur.value,
			motionBlurIntensity: blurIntensity = motionBlurIntensity.value,
		} = options;

		if (!visible || !mousePositions || mousePositions.length === 0) {
			return;
		}

		// Calculate effects from timeline data
		const effects = calculateCursorEffectsFromData(mousePositions, currentTime, videoDuration);
		
		if (!effects.prevPos || !effects.nextPos) {
			return;
		}

		// Interpolate position based on timeline
		const timeDiff = effects.nextPos.timestamp - effects.prevPos.timestamp;
		let fraction = 0;
		if (timeDiff > 0) {
			fraction = (effects.estimatedTimestamp - effects.prevPos.timestamp) / timeDiff;
			fraction = Math.max(0, Math.min(1, fraction));
		}

		const x = effects.prevPos.x + (effects.nextPos.x - effects.prevPos.x) * fraction;
		const y = effects.prevPos.y + (effects.nextPos.y - effects.prevPos.y) * fraction;

		// Get cursor image
		const currentImage = cursorImages.value[effects.prevPos.cursorType || 'default'];
		if (!currentImage) {
			return;
		}

		// Apply effects from timeline calculation
		ctx.save();
		
		// Calculate cursor dimensions
		const cursorWidth = size * effects.scale;
		const cursorHeight = size * effects.scale;

		// Cursor positioning with offset
		const hotspots = {
			default: { x: 3, y: 3 },
			pointer: { x: 3, y: 4 },
			grabbing: { x: 4, y: 5 },
			text: { x: 4, y: 5 },
			grab: { x: 4, y: 5 },
			resize: { x: 4, y: 5 },
		};

		const baseHotspot = hotspots[effects.prevPos.cursorType || 'default'] || hotspots.default;
		const hotspotScale = size / 20;
		const correctionFactor = 0.85 + 0.15 * (20 / Math.max(20, size));
		
		const hotspot = {
			x: baseHotspot.x * hotspotScale * correctionFactor,
			y: baseHotspot.y * hotspotScale * correctionFactor,
		};

		const baseOffsetFactors = {
			default: { x: 0.25, y: 0.15 },
			pointer: { x: 0.3, y: 0.2 },
			grabbing: { x: 0.35, y: 0.25 },
			text: { x: 0.35, y: 0.25 },
			grab: { x: 0.35, y: 0.25 },
			resize: { x: 0.35, y: 0.25 },
		};

		const offsetFactor = baseOffsetFactors[effects.prevPos.cursorType || 'default'] || baseOffsetFactors.default;
		const offsetX = (size - 20) * offsetFactor.x;
		const offsetY = (size - 20) * offsetFactor.y;

		// Position cursor
		ctx.translate(x - offsetX, y - offsetY);
		ctx.translate(cursorWidth / 2, 0);

		// Apply timeline-calculated effects
		ctx.rotate(effects.rotation);
		ctx.rotate(effects.tiltAngle);
		ctx.transform(1, 0, effects.skewX, 1, 0, 0);
		ctx.scale(effects.scale, effects.scale);

		ctx.translate(-cursorWidth / 2, 0);

		// Apply motion blur if enabled and intensity > 0
		if (motionEnabled && effects.blurIntensity > 0 && enabledMotionBlur) {
			// Create motion blur using canvas operations
			const blurRadius = effects.blurIntensity * blurIntensity * 10;
			
			// Apply blur based on movement direction
			if (effects.speed > 0) {
				const deltaX = effects.nextPos.x - effects.prevPos.x;
				const deltaY = effects.nextPos.y - effects.prevPos.y;
				const angle = Math.atan2(deltaY, deltaX);
				
				// Create directional blur effect
				ctx.save();
				ctx.filter = `blur(${blurRadius}px)`;
				ctx.globalAlpha = 0.7;
				ctx.drawImage(currentImage, 0, 0, cursorWidth, cursorHeight);
				ctx.restore();
			}
		}

		// Draw the main cursor
		ctx.globalAlpha = visible ? 1 : 0;
		ctx.drawImage(currentImage, 0, 0, cursorWidth, cursorHeight);

		ctx.restore();

		// Return effects data for debugging/monitoring
		return {
			position: { x, y },
			effects,
		};
	};

	// Efekt durumu değiştiğinde pending cursor tipini kontrol et
	watch(isEffectActive, (newValue, oldValue) => {
		// Efekt bittiğinde bekleyen cursor tipini uygula
		if (oldValue && !newValue) {
			// Küçük bir gecikme ile pending cursor tipini uygula
			setTimeout(() => {
				applyPendingCursorType();
			}, 100);
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
		// Timeline-based functions for export/playback
		calculateCursorEffectsFromData,
		drawMousePositionFromTimeline,
		// Motion blur status
		realMouseSpeed,
		realMouseAcceleration,
		motionPhase,
		currentBlurIntensity,
		phaseStability,
		// Efekt kontrol sistemi
		isEffectActive,
		pendingCursorType,
		applyPendingCursorType,
	};
};
