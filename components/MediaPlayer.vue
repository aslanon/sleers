<template>
	<div
		class="media-player w-full h-full m-auto rounded-lg overflow-hidden"
		@togglePlayback="togglePlay"
	>
		<div
			ref="containerRef"
			class="relative w-full h-full overflow-hidden flex items-center justify-center"
			:class="{
				'cursor-grab': !isVideoDragging && !isCameraDragging,
				'cursor-grabbing': isVideoDragging || isCameraDragging,
			}"
			@mousedown="handleMouseDown"
			@mousemove="handleMouseMove"
			@mouseup="handleMouseUp"
			@mouseleave="handleMouseUp"
		>
			<div
				class="relative crop-area flex items-center justify-center"
				:style="{
					width: '100%',
					height: '100%',
					position: 'relative',
					overflow: 'hidden',
				}"
			>
				<canvas
					id="canvasID"
					ref="canvasRef"
					class="rounded-md"
					style="display: block; position: absolute; margin: auto"
				></canvas>
			</div>

			<!-- Ses -->
			<audio
				v-if="audioUrl"
				ref="audioRef"
				preload="metadata"
				:src="audioUrl"
				:type="audioType"
				@error="onAudioError"
			></audio>
		</div>

		<!-- Video Crop Modal -->
		<VideoCropModal
			v-if="showCropModal"
			:is-open="showCropModal"
			:video-src="props.videoUrl"
			@close="
				() => {
					showCropModal = false;
					emit('update:isCropMode', false);
					// Crop'u sıfırla
					cropArea.value = {
						x: 0,
						y: 0,
						width: videoElement.videoWidth,
						height: videoElement.videoHeight,
						isApplied: false,
					};
					// Canvas'ı güncelle
					requestAnimationFrame(() => updateCanvas(performance.now()));
				}
			"
			@crop-applied="handleCropApplied"
		/>
	</div>
</template>

<script setup>
import { useVideoZoom } from "~/composables/useVideoZoom";
import { useMouseCursor } from "~/composables/useMouseCursor";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import { useCameraRenderer } from "~/composables/useCameraRenderer";
import { useCameraDrag } from "~/composables/useCameraDrag";
import { useVideoDrag } from "~/composables/useVideoDrag";
import useDockSettings from "~/composables/useDockSettings";
import { calculateVideoDisplaySize } from "~/composables/utils/mousePosition";
import VideoCropModal from "~/components/player-settings/VideoCropModal.vue";

const emit = defineEmits([
	"videoLoaded",
	"videoEnded",
	"videoPaused",
	"timeUpdate",
	"cropChange",
	"play",
	"pause",
	"seeking",
	"seeked",
	"rateChange",
	"volumeChange",
	"fullscreenChange",
	"muteChange",
]);

const scaleValue = 3;

const props = defineProps({
	videoUrl: {
		type: String,
		default: "",
	},
	cameraUrl: {
		type: String,
		default: "",
	},
	audioUrl: {
		type: String,
		default: "",
	},
	videoType: {
		type: String,
		default: "video/mp4",
	},
	cameraType: {
		type: String,
		default: "video/webm",
	},
	audioType: {
		type: String,
		default: "audio/webm",
	},
	isPlaying: {
		type: Boolean,
		default: false,
	},
	currentTime: {
		type: Number,
		default: 0,
	},
	previewTime: {
		type: Number,
		default: null,
	},
	selectedAspectRatio: {
		type: String,
		default: "",
	},
	systemAudioEnabled: {
		type: Boolean,
		default: true,
	},
	isMuted: {
		type: Boolean,
		default: false,
	},
	segments: {
		type: Array,
		default: () => [],
	},
	mousePositions: {
		type: Array,
		default: () => [],
		validator: (value) => {
			return value.every(
				(pos) => typeof pos.x === "number" && typeof pos.y === "number"
			);
		},
	},
	cropInfo: {
		type: Object,
		default: () => ({
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			scale: 1,
		}),
	},
	isCropMode: {
		type: Boolean,
		default: false,
	},
});

// Player settings'i al
const {
	backgroundColor,
	backgroundImage,
	backgroundBlur,
	padding,
	radius,
	shadowSize,
	cropRatio,
	mouseSize,
	lastMouseX,
	lastMouseY,
	mouseMotionEnabled,
	motionBlurValue,
	zoomRanges,
	currentZoomRange,
	MOTION_BLUR_CONSTANTS,
	setCurrentZoomRange,
	cameraSettings,
	videoBorderSettings,
	mouseVisible,
	showDock, // Dock görünürlük ayarı
	dockSize,
} = usePlayerSettings();

// Dock ayarlarını al
const { isSupported: isDockSupported, visibleDockItems } = useDockSettings();

// Kamera renderer'ı al
const { drawCamera, isMouseOverCamera, lastCameraPosition } =
	useCameraRenderer();
const {
	isDragging: isCameraDragging,
	cameraPosition,
	startDrag: startCameraDrag,
	stopDrag: stopCameraDrag,
} = useCameraDrag();

// Video sürükleme yönetimi
const {
	isDragging: isVideoDragging,
	videoPosition,
	startDrag: startVideoDrag,
	stopDrag: stopVideoDrag,
} = useVideoDrag();

// Referanslar
const containerRef = ref(null);
const canvasRef = ref(null);
const audioRef = ref(null);
const videoRef = ref(null);
const cameraRef = ref(null);

// Context
let ctx = null;

// Video objesi
let videoElement = null;
let cameraElement = null;

// Zoom yönetimi
const {
	scale,
	videoScale,
	targetScale,
	targetPosition,
	isZoomAnimating,
	lastZoomPosition,
	calculateZoomOrigin,
	applyZoomSegment,
	checkZoomSegments,
	cleanup: cleanupZoom,
} = useVideoZoom(videoElement, containerRef, canvasRef);

// Transform ve kırpma state'leri
const position = ref({ x: 0, y: 0 });
const dragStart = ref({ x: 0, y: 0 });
const cropArea = ref({ x: 0, y: 0, width: 0, height: 0 });
const videoSize = ref({ width: 0, height: 0 });
const selectedAspectRatio = ref("");
const lastSourceRatio = ref(null); // Add this line to track aspect ratio changes

// Render ve animasyon state'leri
let animationFrame = null;
let lastFrameTime = 0;
const FPS = 60;
const frameInterval = 1000 / FPS;

// Video state yönetimi
const videoState = ref({
	isPlaying: false,
	isPaused: true,
	isSeeking: false,
	isFullscreen: false,
	currentTime: 0,
	duration: 0,
	volume: 1,
	playbackRate: 1,
});

// Video state yönetimi
const currentSegmentIndex = ref(0);
const isPlayingSegments = ref(false);

// Mouse pozisyonları için state
const mousePosition = ref({ x: 0, y: 0 });

// Zoom state'leri
const isZoomTransitioning = ref(false);
const previousScale = ref(1);

// Crop modal state
const showCropModal = ref(false);

// Video oynatma kontrolü
const togglePlay = async (e) => {
	e.preventDefault();
	e.stopPropagation();

	if (videoState.value.isPlaying) {
		await pause();
	} else {
		await play();
	}
};

const play = async () => {
	if (!videoElement) return;
	try {
		console.log("[MediaPlayer] Play called, initial state:", {
			isPlaying: videoState.value.isPlaying,
			isPaused: videoState.value.isPaused,
			videoTime: videoElement ? videoElement.currentTime : "no video",
			audioTime: audioRef.value ? audioRef.value.currentTime : "no audio",
			audioExists: !!audioRef.value,
			audioSrc: audioRef.value ? audioRef.value.src : "no audio",
			audioMuted: audioRef.value ? audioRef.value.muted : "no audio",
		});

		// Video bitmiş ise başa sar
		if (videoElement.currentTime >= videoElement.duration) {
			videoElement.currentTime = 0;
			videoState.value.currentTime = 0;
			if (cameraElement) {
				cameraElement.currentTime = 0;
			}
			if (audioRef.value) {
				audioRef.value.currentTime = 0;
			}
		}

		// Önce state'i güncelle
		videoState.value.isPlaying = true;
		videoState.value.isPaused = false;

		// Video ve sesi oynat
		try {
			await videoElement.play();
			if (cameraElement) {
				await cameraElement.play();
			}
			if (audioRef.value) {
				try {
					console.log("[MediaPlayer] Attempting to play audio:", {
						src: audioRef.value.src,
						paused: audioRef.value.paused,
						muted: audioRef.value.muted,
					});
					await audioRef.value.play();
					console.log("[MediaPlayer] Audio play() succeeded");
				} catch (audioError) {
					console.error("[MediaPlayer] Audio play error:", audioError);
				}
			} else {
				console.warn("[MediaPlayer] No audio element to play");
			}

			// Canvas animasyonunu başlat
			if (!animationFrame) {
				console.log("[MediaPlayer] Starting canvas animation");
				animationFrame = requestAnimationFrame(updateCanvas);
			}
		} catch (error) {
			console.error("[MediaPlayer] Play error:", error);
			// Oynatma başarısız olursa state'i geri al
			videoState.value.isPlaying = false;
			videoState.value.isPaused = true;
			throw error;
		}
		emit("play");
	} catch (error) {
		console.error("[MediaPlayer] Play error:", error);
		videoState.value.isPlaying = false;
		videoState.value.isPaused = true;
	}
};

const pause = async () => {
	if (!videoElement) return;
	try {
		if (!videoState.value.isPlaying) return;

		videoState.value.isPlaying = false;
		videoState.value.isPaused = true;

		try {
			await videoElement.pause();
			if (cameraElement) {
				await cameraElement.pause();
			}
			if (audioRef.value && !audioRef.value.paused) {
				await audioRef.value.pause();
			}
		} catch (error) {
			console.error("[MediaPlayer] Pause error:", error);
			videoState.value.isPlaying = true;
			videoState.value.isPaused = false;
			throw error;
		}

		// Canvas animasyonunu durdur
		if (animationFrame) {
			console.log("[MediaPlayer] Stopping canvas animation");
			cancelAnimationFrame(animationFrame);
			animationFrame = null;
		}

		// Son frame'i çiz
		updateCanvas(performance.now());
		emit("pause");
	} catch (error) {
		console.error("[MediaPlayer] Pause error:", error);
	}
};

// Video scale animasyonu
const animateVideoScale = (timestamp) => {
	if (!ctx || !canvasRef.value || videoState.value.isPaused) return;

	// Store'dan gelen scale değerini kullan
	const targetScale = currentZoomRange.value ? currentZoomRange.value.scale : 1;
	const scaleDiff = targetScale - videoScale.value;

	// Smooth transition için lerp
	const lerpFactor = 0.1;
	if (Math.abs(scaleDiff) > 0.001) {
		videoScale.value += scaleDiff * lerpFactor;
		// Canvas'ı güncelle
		updateCanvas(timestamp);
		// Animasyonu devam ettir
		requestAnimationFrame(animateVideoScale);
	}
};

// Zoom range değişikliğini izle
watch(
	() => currentZoomRange.value,
	(newRange) => {
		if (!videoState.value.isPaused) {
			requestAnimationFrame(animateVideoScale);
		}
	}
);

// Video zamanı güncellendiğinde
const onTimeUpdate = () => {
	if (!videoElement) return;

	// Sadece video oynatılıyorsa zamanı güncelle
	if (videoState.value.isPlaying) {
		const currentTime = videoElement.currentTime;
		videoState.value.currentTime = currentTime;

		// Zoom segmentlerini kontrol et
		checkZoomSegments(currentTime);

		// Ses zamanını da senkronize et
		if (
			audioRef.value &&
			Math.abs(audioRef.value.currentTime - currentTime) > 0.1
		) {
			audioRef.value.currentTime = currentTime;
		}
		emit("timeUpdate", currentTime);

		// Canvas'ı güncelle
		if (!animationFrame) {
			animationFrame = requestAnimationFrame(updateCanvas);
		}
	}
};

// Pencere boyutu değiştiğinde
const handleResize = () => {
	if (!containerRef.value || !videoElement || !canvasRef.value || !ctx) return;

	// Container boyutlarını al
	const container = containerRef.value.getBoundingClientRect();
	const containerWidth = container.width;
	const containerHeight = container.height;

	// Video veya crop aspect ratio'sunu hesapla
	let sourceWidth, sourceHeight;
	if (cropArea.value?.isApplied) {
		sourceWidth = cropArea.value.width;
		sourceHeight = cropArea.value.height;
	} else {
		sourceWidth = videoElement.videoWidth;
		sourceHeight = videoElement.videoHeight;
	}
	const sourceRatio = sourceWidth / sourceHeight;
	const containerRatio = containerWidth / containerHeight;

	// Canvas boyutlarını container'a göre ayarla
	let canvasWidth, canvasHeight;
	if (!cropRatio.value || cropRatio.value === "auto") {
		// Auto modunda source aspect ratio'sunu koru
		if (sourceRatio > containerRatio) {
			canvasWidth = containerWidth;
			canvasHeight = containerWidth / sourceRatio;
		} else {
			canvasHeight = containerHeight;
			canvasWidth = containerHeight * sourceRatio;
		}
	} else {
		// Seçilen aspect ratio'yu kullan
		const [targetWidth, targetHeight] = cropRatio.value.split(":").map(Number);
		const targetRatio = targetWidth / targetHeight;

		if (containerRatio > targetRatio) {
			canvasHeight = containerHeight;
			canvasWidth = containerHeight * targetRatio;
		} else {
			canvasWidth = containerWidth;
			canvasHeight = containerWidth / targetRatio;
		}
	}

	// DPR'ı kullanarak canvas çözünürlüğünü artır
	const dpr = window.devicePixelRatio || 1;
	canvasRef.value.width = canvasWidth * dpr * scaleValue;
	canvasRef.value.height = canvasHeight * dpr * scaleValue;

	// Canvas stil boyutlarını ayarla (CSS pixels)
	canvasRef.value.style.width = `${canvasWidth}px`;
	canvasRef.value.style.height = `${canvasHeight}px`;

	// Canvas'ı daima merkezde tutmak için
	position.value = { x: 0, y: 0 };
	videoPosition.value = { x: 0, y: 0 };

	// Canvas transform ayarları
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	// Canvas'ı hemen güncelle
	requestAnimationFrame(() => updateCanvas(performance.now()));

	// Değişiklikleri emit et
	emit("cropChange", getCropData());
};

// Kırpma alanını güncelle
const updateCropArea = () => {
	if (!containerRef.value || !videoElement || !canvasRef.value || !ctx) return;

	// Container boyutlarını al
	const container = containerRef.value.getBoundingClientRect();
	const containerWidth = container.width;
	const containerHeight = container.height;

	// Video veya crop aspect ratio'sunu hesapla
	let sourceWidth, sourceHeight;
	if (cropArea.value?.isApplied) {
		sourceWidth = cropArea.value.width;
		sourceHeight = cropArea.value.height;
	} else {
		sourceWidth = videoElement.videoWidth;
		sourceHeight = videoElement.videoHeight;
	}
	const sourceRatio = sourceWidth / sourceHeight;
	const containerRatio = containerWidth / containerHeight;

	// Canvas boyutlarını container'a göre ayarla
	let canvasWidth, canvasHeight;
	if (!cropRatio.value || cropRatio.value === "auto") {
		// Auto modunda source aspect ratio'sunu kullan
		if (sourceRatio > containerRatio) {
			canvasWidth = containerWidth;
			canvasHeight = containerWidth / sourceRatio;
		} else {
			canvasHeight = containerHeight;
			canvasWidth = containerHeight * sourceRatio;
		}
	} else {
		// Seçilen aspect ratio'yu kullan
		const [targetWidth, targetHeight] = cropRatio.value.split(":").map(Number);
		const targetRatio = targetWidth / targetHeight;

		if (containerRatio > targetRatio) {
			canvasHeight = containerHeight;
			canvasWidth = containerHeight * targetRatio;
		} else {
			canvasWidth = containerWidth;
			canvasHeight = containerWidth / targetRatio;
		}
	}

	// DPR'ı kullanarak canvas çözünürlüğünü artır
	const dpr = window.devicePixelRatio || 1;
	canvasRef.value.width = canvasWidth * dpr * scaleValue;
	canvasRef.value.height = canvasHeight * dpr * scaleValue;

	// Canvas stil boyutlarını ayarla (CSS pixels)
	canvasRef.value.style.width = `${canvasWidth}px`;
	canvasRef.value.style.height = `${canvasHeight}px`;

	// Canvas'ı daima merkezde tutmak için
	position.value = { x: 0, y: 0 };
	videoPosition.value = { x: 0, y: 0 };

	// Canvas transform ayarları
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	// Canvas'ı hemen güncelle
	requestAnimationFrame(() => updateCanvas(performance.now()));

	// Değişiklikleri emit et
	emit("cropChange", getCropData());
};

const updateDragPosition = (e) => {
	position.value = {
		x: e.clientX - dragStart.value.x,
		y: e.clientY - dragStart.value.y,
	};

	// Direkt olarak canvas'ı güncelle
	requestAnimationFrame(() => {
		updateCanvas(performance.now());
	});
};

// Video bittiğinde
const onVideoEnded = () => {
	// State'i güncelle
	videoState.value.isPlaying = false;
	videoState.value.isPaused = true;

	// Video ve sesi başa sar
	if (videoElement) {
		videoElement.currentTime = 0;
		videoState.value.currentTime = 0;
	}

	// Kamera elementini durdur ve başa sar
	if (cameraElement) {
		cameraElement.pause();
		cameraElement.currentTime = 0;
	}

	// Sesi durdur ve başa sar
	if (audioRef.value) {
		audioRef.value.pause();
		audioRef.value.currentTime = 0;
	}

	// Canvas animasyonunu durdur
	if (animationFrame) {
		cancelAnimationFrame(animationFrame);
		animationFrame = null;
	}

	// Event'i emit et
	emit("videoEnded");
};

// Video hatası
const onVideoError = (error) => {
	console.error("[MediaPlayer] Video hatası:", {
		error: error?.message || "Bilinmeyen hata",
		code: videoElement?.error?.code,
		message: videoElement?.error?.message,
		src: videoElement?.src,
		readyState: videoElement?.readyState,
		networkState: videoElement?.networkState,
	});
};

// Ses hatası
const onAudioError = (error) => {
	console.error("[MediaPlayer] Ses hatası:", error);
};

// Aspect ratio güncelleme
const updateAspectRatio = (ratio) => {
	console.log("[MediaPlayer] Updating aspect ratio:", ratio);
	selectedAspectRatio.value = ratio;
	cropRatio.value = ratio;
	updateCropArea();
};

// Aspect ratio değişikliğini izle
watch(
	cropRatio,
	(newRatio) => {
		console.log("[MediaPlayer] Crop ratio changed:", newRatio);
		updateCropArea();
	},
	{ immediate: true }
);

// Props'ları izle
watch(
	() => props.selectedAspectRatio,
	(newRatio) => {
		if (newRatio) {
			console.log(
				"[MediaPlayer] Selected aspect ratio prop changed:",
				newRatio
			);
			updateAspectRatio(newRatio);
		}
	},
	{ immediate: true }
);

// Kırpma verilerini al
const getCropData = () => {
	if (!containerRef.value || !videoElement) return null;

	const container = containerRef.value.getBoundingClientRect();
	const videoWidth = videoElement.videoWidth;
	const videoHeight = videoElement.videoHeight;

	// Seçilen aspect ratio yoksa null döndür
	if (!cropRatio.value) return null;

	// Canvas koordinatlarını video koordinatlarına dönüştür
	const canvasToVideo = (canvasX, canvasY, canvasWidth, canvasHeight) => {
		// Padding'i hesaba katarak kullanılabilir alanı hesapla
		const availableWidth = cropArea.value.width - padding.value * 2;
		const availableHeight = cropArea.value.height - padding.value * 2;

		// Canvas'taki oranı hesapla
		const scaleX = videoWidth / availableWidth;
		const scaleY = videoHeight / availableHeight;

		// Padding'i hesaba katarak dönüştür
		return {
			x: Math.round((canvasX - padding.value) * scaleX),
			y: Math.round((canvasY - padding.value) * scaleY),
			width: Math.round(canvasWidth * scaleX),
			height: Math.round(canvasHeight * scaleY),
		};
	};

	// Kırpma alanını video koordinatlarına dönüştür
	const videoCoords = canvasToVideo(
		padding.value,
		padding.value,
		cropArea.value.width - padding.value * 2,
		cropArea.value.height - padding.value * 2
	);

	console.log("[MediaPlayer] Kırpma verileri hesaplandı:", {
		canvas: cropArea.value,
		video: videoCoords,
		container: container,
		videoSize: { width: videoWidth, height: videoHeight },
		aspectRatio: cropRatio.value,
		padding: padding.value,
	});

	return {
		...videoCoords,
		scale: scale.value,
		aspectRatio: cropRatio.value,
	};
};

// Mouse cursor yönetimi
const {
	drawMousePosition,
	currentCursorType,
	isMouseDown,
	isDragging,
	MOUSE_EVENTS,
} = useMouseCursor(MOTION_BLUR_CONSTANTS);

// Mouse pozisyonlarını çiz
const drawMousePositions = () => {
	// Mouse görünürlüğü kapalıysa çizme
	if (!mouseVisible.value) return;

	if (!props.mousePositions || !canvasRef.value || !videoElement) return;

	const ctx = canvasRef.value.getContext("2d");
	if (!ctx) return;

	// Video süresini al
	const videoDuration = videoElement.duration;
	if (!videoDuration) return;

	// Current video time
	const currentVideoTime = videoElement.currentTime;

	// Add static variable for tracking transition state between draws
	// We need to use a closure variable since this function gets called repeatedly
	if (typeof drawMousePositions.lastIsStationary === "undefined") {
		drawMousePositions.lastIsStationary = true;
		drawMousePositions.transitionFactor = 0;
		drawMousePositions.lastUpdateTime = performance.now();
		drawMousePositions.lastVelocity = { x: 0, y: 0 };
		drawMousePositions.lastPosition = { x: 0, y: 0, timestamp: 0 };
	}

	// Mouse pozisyonları için toplam frame sayısı
	const totalFrames = props.mousePositions.length;
	if (totalFrames < 2) return;

	// Find closest positions by timestamp
	// First, convert video time to timestamp in the recorded data
	const frameTime = videoDuration / totalFrames;

	// Find the two closest points in time
	let prevIndex = -1;
	let nextIndex = -1;
	let prevTimeDiff = Infinity;
	let nextTimeDiff = Infinity;

	// Calculate normalized time (0-1 scale) for current video position
	const normalizedTime = currentVideoTime / videoDuration;
	const estimatedTimestamp =
		normalizedTime * props.mousePositions[totalFrames - 1].timestamp;

	// Find the two points surrounding the current time
	for (let i = 0; i < totalFrames; i++) {
		const pos = props.mousePositions[i];
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

	// Fallbacks if we couldn't find proper indices
	if (prevIndex === -1) prevIndex = 0;
	if (nextIndex === -1 || nextIndex === prevIndex)
		nextIndex = Math.min(prevIndex + 1, totalFrames - 1);

	const prevPos = props.mousePositions[prevIndex];
	const nextPos = props.mousePositions[nextIndex];

	// DPR'ı hesaba kat
	const dpr = window.devicePixelRatio || 1;

	// Calculate movement distance
	const moveDistance = Math.sqrt(
		Math.pow(nextPos.x - prevPos.x, 2) + Math.pow(nextPos.y - prevPos.y, 2)
	);

	// Calculate time difference between frames in milliseconds
	const timeDiff = nextPos.timestamp - prevPos.timestamp;

	// Define thresholds for stationary detection - daha kararlı eşikler
	const MOVEMENT_THRESHOLD = 8; // pixels - düşürüldü, daha duyarlı olması için
	const TIME_THRESHOLD = 150; // milliseconds - artırıldı, daha kararlı olması için

	// Determine if the mouse is truly stationary
	const isStationary =
		moveDistance < MOVEMENT_THRESHOLD || timeDiff > TIME_THRESHOLD;

	// Calculate current mouse velocity
	const velocity = {
		x: timeDiff > 0 ? (nextPos.x - prevPos.x) / timeDiff : 0,
		y: timeDiff > 0 ? (nextPos.y - prevPos.y) / timeDiff : 0,
	};

	// Calculate velocity magnitude (speed)
	const velocityMagnitude = Math.sqrt(
		velocity.x * velocity.x + velocity.y * velocity.y
	);

	// Handle transition between stationary and moving states
	const now = performance.now();
	const deltaTime = Math.min(now - drawMousePositions.lastUpdateTime, 50); // Limit to 50ms to avoid jumps
	drawMousePositions.lastUpdateTime = now;

	// Calculate transition speed based on velocity - faster for quick movements
	const baseTransitionSpeed = 0.008; // Base transition speed - lower for smoother transitions
	const velocityFactor = Math.min(velocityMagnitude * 0.5, 1.0); // Velocitye bağlı faktör
	const TRANSITION_SPEED_IN = baseTransitionSpeed * (1 + velocityFactor); // Hızlanırken daha hızlı
	const TRANSITION_SPEED_OUT = baseTransitionSpeed * 0.7; // Yavaşlarken daha yumuşak

	// Update transition based on velocity and stationary state
	if (isStationary) {
		// Moving to stationary - smooth out
		drawMousePositions.transitionFactor = Math.max(
			0,
			drawMousePositions.transitionFactor - TRANSITION_SPEED_OUT * deltaTime
		);
	} else {
		// Stationary to moving - quicker
		drawMousePositions.transitionFactor = Math.min(
			1,
			drawMousePositions.transitionFactor + TRANSITION_SPEED_IN * deltaTime
		);
	}

	// Calculate interpolation factor (how far between prev and next)
	let fraction = 0;
	if (timeDiff > 0) {
		fraction = (estimatedTimestamp - prevPos.timestamp) / timeDiff;
		// Clamp fraction between 0 and 1
		fraction = Math.max(0, Math.min(1, fraction));
	}

	// Save state for next frame
	drawMousePositions.lastIsStationary = isStationary;
	drawMousePositions.lastVelocity = velocity;
	drawMousePositions.lastPosition = {
		x: prevPos.x + (nextPos.x - prevPos.x) * fraction,
		y: prevPos.y + (nextPos.y - prevPos.y) * fraction,
		timestamp: estimatedTimestamp,
	};

	// Apply transition factor to interpolation
	let interpolatedX, interpolatedY;
	let dirX = 0,
		dirY = 0;
	let speed = 0;

	if (drawMousePositions.transitionFactor < 0.01) {
		// Almost fully stationary - use previous position exactly
		interpolatedX = prevPos.x;
		interpolatedY = prevPos.y;
	} else if (drawMousePositions.transitionFactor > 0.99) {
		// Almost fully in motion - use full interpolation
		interpolatedX = prevPos.x + (nextPos.x - prevPos.x) * fraction;
		interpolatedY = prevPos.y + (nextPos.y - prevPos.y) * fraction;

		// Calculate direction and speed for motion effects
		if (moveDistance > 0) {
			dirX = (nextPos.x - prevPos.x) / moveDistance;
			dirY = (nextPos.y - prevPos.y) / moveDistance;
			speed = timeDiff > 0 ? moveDistance / timeDiff : 0;
		}
	} else {
		// In transition - blend between stationary and moving positions
		const tf = drawMousePositions.transitionFactor;
		const movingX = prevPos.x + (nextPos.x - prevPos.x) * fraction;
		const movingY = prevPos.y + (nextPos.y - prevPos.y) * fraction;

		interpolatedX = prevPos.x * (1 - tf) + movingX * tf;
		interpolatedY = prevPos.y * (1 - tf) + movingY * tf;

		// Scale speed and direction by transition factor
		if (moveDistance > 0) {
			dirX = ((nextPos.x - prevPos.x) / moveDistance) * tf;
			dirY = ((nextPos.y - prevPos.y) / moveDistance) * tf;
			speed = (timeDiff > 0 ? moveDistance / timeDiff : 0) * tf;
		}
	}

	// Rest of the existing code for video/crop dimensions and cursor rendering
	// Video veya crop boyutlarını kullan
	let sourceWidth, sourceHeight, sourceX, sourceY;
	if (cropArea.value?.isApplied) {
		sourceWidth = cropArea.value.width;
		sourceHeight = cropArea.value.height;
		sourceX = cropArea.value.x;
		sourceY = cropArea.value.y;
	} else {
		sourceWidth = videoElement.videoWidth;
		sourceHeight = videoElement.videoHeight;
		sourceX = 0;
		sourceY = 0;
	}

	// Padding'i hesaba kat
	const paddingValue = padding.value * dpr;

	// Video'nun canvas içindeki pozisyonunu hesapla
	const {
		displayWidth,
		displayHeight,
		videoX: displayX,
		videoY: displayY,
	} = calculateVideoDisplaySize(
		sourceWidth,
		sourceHeight,
		canvasRef.value.width,
		canvasRef.value.height,
		paddingValue
	);

	// Mouse pozisyonunu video koordinatlarından canvas koordinatlarına çevir
	let canvasX, canvasY;

	if (cropArea.value?.isApplied) {
		// Crop uygulanmışsa, mouse pozisyonunu crop alanına göre normalize et
		const normalizedX = (interpolatedX - sourceX) / sourceWidth;
		const normalizedY = (interpolatedY - sourceY) / sourceHeight;

		canvasX = displayX + normalizedX * displayWidth + position.value.x;
		canvasY = displayY + normalizedY * displayHeight + position.value.y;
	} else {
		// Crop uygulanmamışsa normal hesaplama yap
		canvasX =
			displayX +
			(interpolatedX / videoElement.videoWidth) * displayWidth +
			position.value.x;
		canvasY =
			displayY +
			(interpolatedY / videoElement.videoHeight) * displayHeight +
			position.value.y;
	}

	// Zoom durumunda pozisyonu ayarla
	if (videoScale.value > 1.001) {
		const activeZoom = checkZoomSegments(
			videoElement.currentTime,
			zoomRanges.value
		);
		const { originX: zoomOriginX, originY: zoomOriginY } = calculateZoomOrigin(
			activeZoom?.position || lastZoomPosition.value || "center",
			displayX,
			displayY,
			displayWidth,
			displayHeight,
			displayX + displayWidth / 2,
			displayY + displayHeight / 2
		);

		// Zoom'u hesaba katarak pozisyonu güncelle
		canvasX = zoomOriginX + (canvasX - zoomOriginX) * videoScale.value;
		canvasY = zoomOriginY + (canvasY - zoomOriginY) * videoScale.value;
	}

	// Mouse cursor'ı çiz
	drawMousePosition(ctx, {
		x: canvasX,
		y: canvasY,
		event: {
			type: prevPos.type || MOUSE_EVENTS.MOVE,
			button: prevPos.button,
			clickCount: prevPos.clickCount,
			rotation: prevPos.rotation,
			direction: prevPos.direction,
			speed,
			dirX,
			dirY,
		},
		size: mouseSize.value,
		dpr,
		motionEnabled: mouseMotionEnabled.value,
		motionBlurValue: motionBlurValue.value,
		visible: mouseVisible.value, // Add visibility parameter
	});

	// Kamera pozisyonunu güncelle
	if (cameraElement && cameraSettings.value.followMouse) {
		// Kamera için offset değerleri
		const offsetX = 100 * dpr; // Yatay mesafeyi artır
		const offsetY = 100 * dpr; // Dikey mesafeyi artır
		const PADDING = 20 * dpr; // Kenarlardan minimum mesafe

		// Mouse pozisyonunu video pozisyonuna göre normalize et
		const normalizedMouseX = canvasX - position.value.x;
		const normalizedMouseY = canvasY - position.value.y;

		// Hedef pozisyonu hesapla (normalize edilmiş mouse pozisyonuna göre)
		let targetX = normalizedMouseX + offsetX;
		let targetY = normalizedMouseY + offsetY;

		// Kamera boyutlarını al
		const cameraWidth =
			(canvasRef.value.width * cameraSettings.value.size) / 100;
		const cameraHeight = cameraWidth;

		// Canvas sınırları içinde kal
		targetX = Math.max(
			PADDING,
			Math.min(targetX, canvasRef.value.width - cameraWidth - PADDING)
		);
		targetY = Math.max(
			PADDING,
			Math.min(targetY, canvasRef.value.height - cameraHeight - PADDING)
		);

		// Smooth geçiş için lerp faktörü
		const lerpFactor = 0.2;

		// İlk pozisyonu ayarla
		if (!lastCameraX.value) lastCameraX.value = targetX;
		if (!lastCameraY.value) lastCameraY.value = targetY;

		// Lerp ile yumuşak geçiş uygula
		lastCameraX.value += (targetX - lastCameraX.value) * lerpFactor;
		lastCameraY.value += (targetY - lastCameraY.value) * lerpFactor;

		// Kamera pozisyonunu güncelle (video pozisyonunu ekleyerek)
		lastCameraPosition.value = {
			x: lastCameraX.value + position.value.x,
			y: lastCameraY.value + position.value.y,
		};
	}
};

// Arkaplan resmi için
const bgImageElement = ref(null);
const bgImageLoaded = ref(false);

// Arkaplan rengi değiştiğinde canvas'ı güncelle
watch(backgroundColor, () => {
	if (!ctx || !canvasRef.value) return;
	ctx.fillStyle = backgroundColor.value;
	ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);
	bgImageLoaded.value = false;
	bgImageElement.value = null;
	if (videoElement && !videoState.value.isPlaying) {
		requestAnimationFrame(updateCanvas);
	}
});

watch([dockSize, showDock], () => {
	if (!ctx || !canvasRef.value) return;
	drawMacOSDock(ctx, window.devicePixelRatio || 1);
	if (videoElement && !videoState.value.isPlaying) {
		requestAnimationFrame(updateCanvas);
	}
});

// Arkaplan resmi değiştiğinde yükle
watch(backgroundImage, (newImage) => {
	if (newImage) {
		bgImageElement.value = new Image();
		bgImageElement.value.onload = () => {
			bgImageLoaded.value = true;
			if (ctx) {
				updateCanvas(performance.now(), lastMouseX, lastMouseY);
			}
		};
		bgImageElement.value.onerror = () => {
			console.error("Background image failed to load:", newImage);
			bgImageLoaded.value = false;
			bgImageElement.value = null;
		};
		bgImageElement.value.src = newImage;
	} else {
		bgImageLoaded.value = false;
		bgImageElement.value = null;
		if (ctx) {
			updateCanvas(performance.now(), lastMouseX, lastMouseY);
		}
	}
});

// Canvas güncelleme fonksiyonu
const updateCanvas = (timestamp, mouseX = 0, mouseY = 0) => {
	if (!videoElement || !ctx || !canvasRef.value) {
		console.warn("[MediaPlayer] Missing required elements for canvas update");
		return;
	}

	// FPS kontrolü
	if (timestamp - lastFrameTime < frameInterval) {
		// Sadece video oynatılıyorsa veya zoom geçişi varsa animasyonu devam ettir
		if (videoState.value.isPlaying || isZoomTransitioning.value) {
			animationFrame = requestAnimationFrame((t) =>
				updateCanvas(t, mouseX, mouseY)
			);
		}
		return;
	}

	lastFrameTime = timestamp;

	try {
		// DPR'ı al
		const dpr = window.devicePixelRatio || 1;

		// Video pozisyonunu güncelle
		if (isVideoDragging.value) {
			position.value = videoPosition.value;
		}

		// Canvas'ı sadece gerektiğinde temizle
		if (
			!videoState.value.isPlaying &&
			!isZoomTransitioning.value &&
			!isCameraDragging.value
		) {
			ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
		}

		// Arkaplan
		if (bgImageLoaded.value && bgImageElement.value) {
			try {
				// Resmi canvas'a sığacak şekilde ölçekle
				const scale = Math.max(
					canvasRef.value.width / bgImageElement.value.width,
					canvasRef.value.height / bgImageElement.value.height
				);

				const scaledWidth = bgImageElement.value.width * scale;
				const scaledHeight = bgImageElement.value.height * scale;

				// Resmi ortala
				const x = (canvasRef.value.width - scaledWidth) / 2;
				const y = (canvasRef.value.height - scaledHeight) / 2;

				// Blur efekti uygula
				if (backgroundBlur.value > 0) {
					ctx.filter = `blur(${backgroundBlur.value}px)`;
				}

				ctx.drawImage(bgImageElement.value, x, y, scaledWidth, scaledHeight);

				// Blur'u sıfırla
				ctx.filter = "none";
			} catch (error) {
				console.error("Error drawing background image:", error);
				ctx.fillStyle = backgroundColor.value;
				ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);
			}
		} else {
			ctx.fillStyle = backgroundColor.value;
			ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);
		}

		// Ana context state'i kaydet
		ctx.save();

		// Video veya crop boyutlarını kullan
		let sourceWidth, sourceHeight;
		if (cropArea.value?.isApplied) {
			sourceWidth = cropArea.value.width;
			sourceHeight = cropArea.value.height;
		} else {
			sourceWidth = videoElement.videoWidth;
			sourceHeight = videoElement.videoHeight;
		}

		const sourceRatio = sourceWidth / sourceHeight;
		const canvasWidth = canvasRef.value.width;
		const canvasHeight = canvasRef.value.height;

		// Video'yu canvas'a sığdırırken aspect ratio'yu koru
		let drawWidth, drawHeight, x, y;

		// Önce padding'i hesaba kat
		const availableWidth = canvasWidth - padding.value * 2 * dpr;
		const availableHeight = canvasHeight - padding.value * 2 * dpr;
		const availableRatio = availableWidth / availableHeight;

		if (sourceRatio > availableRatio) {
			// Video daha geniş, genişliğe göre ölçekle
			drawWidth = availableWidth;
			drawHeight = drawWidth / sourceRatio;
			x = padding.value * dpr;
			y = padding.value * dpr + (availableHeight - drawHeight) / 2;
		} else {
			// Video daha dar, yüksekliğe göre ölçekle
			drawHeight = availableHeight;
			drawWidth = drawHeight * sourceRatio;
			x = padding.value * dpr + (availableWidth - drawWidth) / 2;
			y = padding.value * dpr;
		}

		// In the updateCanvas function, modify the calculation of drawWidth, drawHeight, x, y
		// First, ensure position is zeroed after aspect ratio changes
		if (videoScale.value <= 1.001) {
			// Only reset position to center when not zoomed in
			// This keeps the position consistent while applying different aspect ratios
			if (sourceRatio !== lastSourceRatio.value) {
				position.value = { x: 0, y: 0 };
				videoPosition.value = { x: 0, y: 0 };
				lastSourceRatio.value = sourceRatio;
			}
		}

		// For a cleaner approach to the drawing code, let's modify the positioning logic
		// for the drawX and drawY calculation to keep the video centered regardless of position

		// Add position as a fixed offset - this ensures consistency across different window sizes
		const offsetX = position.value.x * dpr;
		const offsetY = position.value.y * dpr;

		// Apply the position offset to the calculated coordinates
		const drawX = x + offsetX;
		const drawY = y + offsetY;

		// Aktif zoom segmentini bul
		const currentTime = videoElement.currentTime;
		const activeZoom = checkZoomSegments(currentTime, zoomRanges.value);

		// Store'dan gelen scale değerini kullan
		const targetScale = activeZoom ? activeZoom.scale : 1;
		const lerpFactor = 0.1;
		previousScale.value = videoScale.value;
		videoScale.value =
			videoScale.value + (targetScale - videoScale.value) * lerpFactor;

		// Scale değişim hızını hesapla
		const scaleVelocity = Math.abs(videoScale.value - previousScale.value);
		isZoomTransitioning.value = scaleVelocity > 0.01; // Eşik değeri

		// Zoom efektini uygula
		if (videoScale.value > 1.001) {
			const centerX = x + drawWidth / 2;
			const centerY = y + drawHeight / 2;

			// Zoom origin'i hesapla
			const { originX: transformOriginX, originY: transformOriginY } =
				calculateZoomOrigin(
					activeZoom?.position || lastZoomPosition.value || "center",
					x,
					y,
					drawWidth,
					drawHeight,
					centerX,
					centerY
				);

			// Son zoom pozisyonunu kaydet
			if (activeZoom?.position) {
				lastZoomPosition.value = activeZoom.position;
			}

			// Orijinal görüntüyü çiz - Transform the entire context for all elements
			ctx.save();

			// Apply the zoom transformation
			ctx.translate(transformOriginX + offsetX, transformOriginY + offsetY);
			ctx.scale(videoScale.value, videoScale.value);
			ctx.translate(
				-(transformOriginX + offsetX),
				-(transformOriginY + offsetY)
			);

			// Draw shadow if enabled
			if (shadowSize.value > 0) {
				ctx.save();
				ctx.beginPath();
				useRoundRect(
					ctx,
					drawX,
					drawY,
					drawWidth,
					drawHeight,
					radius.value * dpr
				);
				ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
				ctx.shadowBlur = shadowSize.value * dpr;
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 0;
				ctx.fillStyle = backgroundColor.value;
				ctx.fill();
				ctx.restore();
			}

			// Video alanını kırp ve radius uygula
			ctx.save();
			ctx.beginPath();
			useRoundRect(
				ctx,
				drawX,
				drawY,
				drawWidth,
				drawHeight,
				radius.value * dpr
			);
			ctx.clip();

			// Video çizimi
			if (cropArea.value?.isApplied === true) {
				// Crop uygulanmışsa kırpılmış alanı çiz
				ctx.drawImage(
					videoElement,
					cropArea.value.x,
					cropArea.value.y,
					cropArea.value.width,
					cropArea.value.height,
					drawX,
					drawY,
					drawWidth,
					drawHeight
				);
			} else {
				// Crop uygulanmamışsa tüm videoyu çiz
				ctx.drawImage(
					videoElement,
					0,
					0,
					videoElement.videoWidth,
					videoElement.videoHeight,
					drawX,
					drawY,
					drawWidth,
					drawHeight
				);
			}
			ctx.restore();

			// Video border çizimi - draw after the video
			if (videoBorderSettings.value?.width > 0) {
				ctx.save();
				ctx.beginPath();
				useRoundRect(
					ctx,
					drawX,
					drawY,
					drawWidth,
					drawHeight,
					radius.value * dpr
				);
				ctx.strokeStyle = videoBorderSettings.value.color || "rgba(0, 0, 0, 1)";
				ctx.lineWidth = videoBorderSettings.value.width * dpr;
				ctx.stroke();
				ctx.restore();
			}

			// Restore the entire context
			ctx.restore();

			// Motion blur for zoom transitions
			if (isZoomTransitioning.value) {
				// ... existing zoom transition code ...
			}
		} else {
			// Normal video çizimi için shadow ve radius
			if (shadowSize.value > 0) {
				ctx.save();
				ctx.beginPath();
				useRoundRect(
					ctx,
					drawX,
					drawY,
					drawWidth,
					drawHeight,
					radius.value * dpr
				);
				ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
				ctx.shadowBlur = shadowSize.value * dpr;
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 0;
				ctx.fillStyle = backgroundColor.value;
				ctx.fill();
				ctx.restore();
			}

			// Video alanını kırp ve radius uygula
			ctx.save();
			ctx.beginPath();
			useRoundRect(
				ctx,
				drawX,
				drawY,
				drawWidth,
				drawHeight,
				radius.value * dpr
			);
			ctx.clip();

			// Video çizimi
			if (cropArea.value?.isApplied === true) {
				// Crop uygulanmışsa kırpılmış alanı çiz
				ctx.drawImage(
					videoElement,
					cropArea.value.x,
					cropArea.value.y,
					cropArea.value.width,
					cropArea.value.height,
					drawX,
					drawY,
					drawWidth,
					drawHeight
				);
			} else {
				// Crop uygulanmamışsa tüm videoyu çiz
				ctx.drawImage(
					videoElement,
					0,
					0,
					videoElement.videoWidth,
					videoElement.videoHeight,
					drawX,
					drawY,
					drawWidth,
					drawHeight
				);
			}
			ctx.restore();

			// Video border çizimi
			if (videoBorderSettings.value?.width > 0) {
				ctx.save();
				ctx.beginPath();
				useRoundRect(
					ctx,
					drawX,
					drawY,
					drawWidth,
					drawHeight,
					radius.value * dpr
				);
				ctx.strokeStyle = videoBorderSettings.value.color || "rgba(0, 0, 0, 1)";
				ctx.lineWidth = videoBorderSettings.value.width * dpr;
				ctx.stroke();
				ctx.restore();
			}
		}

		// Ana context state'i geri yükle
		ctx.restore();

		// Mouse pozisyonlarını çiz
		drawMousePositions();

		// Kamera çizimi
		if (cameraElement) {
			let cameraPos;
			if (isCameraDragging.value) {
				// Kamera sürükleniyorsa sadece kamera pozisyonunu kullan
				cameraPos = cameraPosition.value;
			} else if (cameraSettings.value.followMouse && lastCameraPosition.value) {
				// Mouse takibi aktifse video pozisyonunu ekle
				cameraPos = {
					x: lastCameraPosition.value.x,
					y: lastCameraPosition.value.y,
				};
			} else if (cameraPosition.value) {
				// Kamera pozisyonu varsa onu kullan (düzen uygulandıktan sonra veya manuel ayarlandıktan sonra)
				cameraPos = { ...cameraPosition.value };
			} else if (cameraSettings.value.position) {
				// Kamera ayarlarında pozisyon varsa onu kullan (son çare olarak)
				cameraPos = { ...cameraSettings.value.position };
			}

			try {
				// Zoom aktifse kamera pozisyonunu ona göre ayarla
				let scaledVideoPosition = { ...position.value };
				if (videoScale.value > 1.001) {
					// Zoom aktifse kamera pozisyonu ve zoom ölçeğini hesaba kat
					if (cameraPos) {
						// Kameranın zoom'lu görüntüde doğru pozisyonda görünmesi için hesaplama
						cameraPos = {
							x: cameraPos.x,
							y: cameraPos.y,
						};
					}
				}

				drawCamera(
					ctx,
					cameraElement,
					canvasRef.value.width,
					canvasRef.value.height,
					1,
					mouseX,
					mouseY,
					cameraPos,
					videoScale.value, // Zoom ölçeğini kameraya aktar
					scaledVideoPosition
				);
			} catch (error) {
				console.warn("[MediaPlayer] Camera draw error:", error);
				if (!cameraElement || cameraElement.readyState < 2) {
					initializeCamera();
				}
			}
		}

		// Mouse pozisyonlarını çiz
		drawMousePositions();

		// Kamera çizimi
		if (cameraElement) {
			let cameraPos;
			if (isCameraDragging.value) {
				// Kamera sürükleniyorsa sadece kamera pozisyonunu kullan
				cameraPos = cameraPosition.value;
				console.log("[MediaPlayer] Using dragged camera position:", cameraPos);
			}
		}

		// macOS Dock çiz (eğer aktifse ve destekleniyorsa)
		if (
			showDock.value === true &&
			isDockSupported.value === true &&
			visibleDockItems.value &&
			visibleDockItems.value.length > 0
		) {
			drawMacOSDock(ctx, dpr);
		}

		// Animasyon frame'ini sadece gerektiğinde talep et
		if (
			videoState.value.isPlaying ||
			isZoomTransitioning.value ||
			isCameraDragging.value
		) {
			animationFrame = requestAnimationFrame((t) =>
				updateCanvas(t, mouseX, mouseY)
			);
		}
	} catch (error) {
		console.error("[MediaPlayer] Canvas update error:", error);
		animationFrame = null;
	}
};

// Props'ları izle
watch(
	() => ({ ...props }),
	() => {
		// Props değiştiğinde sadece aspect ratio ve resize gibi özel durumları handle et
		if (props.selectedAspectRatio) {
			updateAspectRatio(props.selectedAspectRatio);
		}
		if (props.padding) {
			handleResize();
		}
	},
	{ deep: true, immediate: true }
);

// Preview zamanı değişikliğini izle
watch(
	() => props.previewTime,
	(newValue) => {
		if (!videoElement || newValue === null) return;
		videoElement.currentTime = newValue;
		videoState.value.currentTime = newValue;
		if (cameraElement) {
			cameraElement.currentTime = newValue;
		}
	},
	{ immediate: true }
);

const initCameraVideo = () => {
	try {
		// Yeni video elementi oluştur
		cameraElement = document.createElement("video");

		// Ana video ayarları
		cameraElement.crossOrigin = "anonymous";
		cameraElement.muted = true;
		cameraElement.playsInline = true;
		cameraElement.preload = "auto";
		cameraElement.volume = 0;
		cameraElement.playbackRate = 1;

		// Video kalitesi için ek ayarlar
		cameraElement.style.imageRendering = "high-quality";
		cameraElement.style.webkitImageRendering = "high-quality";
		cameraElement.style.objectFit = "contain";

		// Video kalitesi için özel attributeler
		cameraElement.setAttribute("playsinline", "");
		cameraElement.setAttribute("webkit-playsinline", "");
		cameraElement.setAttribute("x-webkit-airplay", "allow");
		cameraElement.setAttribute("preload", "auto");
		cameraElement.setAttribute("poster", "");

		// Event listener'ları ekle
		const { addEvents, removeEvents } = useVideoEvents(cameraElement, {
			onVideoMetadataLoaded,
			onVideoDataLoaded,
			onDurationChange,
			onTimeUpdate,
			onVideoEnded,
			onVideoError,
			onVideoPlay,
			onVideoPause,
			onVideoSeeking,
			onVideoSeeked,
			onVideoRateChange,
			onVideoVolumeChange,
		});

		addEvents();

		// Cleanup için removeEvents'i sakla
		cameraElement._removeEvents = removeEvents;

		// Video URL'ini set et ve yüklemeyi başlat
		console.log("1111111111111111cameraElement.src", props.cameraUrl);
		cameraElement.src = props.cameraUrl;
		cameraElement.load();
	} catch (error) {
		console.error("[MediaPlayer] Video yükleme hatası:", error);
	}
};

// Video yükleme ve hazırlık
const initVideo = () => {
	try {
		console.log("[MediaPlayer] Video yükleniyor, URL:", props.videoUrl);
		console.log("[MediaPlayer] Kamera yükleniyor, URL:", props.cameraUrl);

		if (!props.videoUrl) {
			console.warn("[MediaPlayer] Video URL'i boş!");
			return;
		}

		// Yeni video elementi oluştur
		videoElement = document.createElement("video");

		// Ana video ayarları
		videoElement.crossOrigin = "anonymous";
		videoElement.muted = !props.systemAudioEnabled;
		videoElement.playsInline = true;
		videoElement.preload = "metadata"; // Sadece metadata'yı yükleyelim
		videoElement.volume = videoState.value.volume;
		videoElement.playbackRate = videoState.value.playbackRate;

		// Video kalitesi için ek ayarlar
		videoElement.style.imageRendering = "high-quality";
		videoElement.style.webkitImageRendering = "high-quality";
		videoElement.style.objectFit = "contain";

		// Video kalitesi için özel attributeler
		videoElement.setAttribute("playsinline", "");
		videoElement.setAttribute("webkit-playsinline", "");
		videoElement.setAttribute("x-webkit-airplay", "allow");
		videoElement.setAttribute("preload", "metadata");
		videoElement.setAttribute("poster", "");

		// Duration için özel event listener'lar ekleyelim
		const checkAndUpdateDuration = (eventType) => {
			console.log(`[MediaPlayer] Checking duration from ${eventType}:`, {
				duration: videoElement.duration,
				readyState: videoElement.readyState,
				networkState: videoElement.networkState,
				error: videoElement.error,
			});

			if (isValidDuration(videoElement.duration)) {
				const duration = videoElement.duration;
				videoState.value.duration = duration;

				// Video boyutlarını da kontrol edelim
				const width = videoElement.videoWidth || videoSize.value.width;
				const height = videoElement.videoHeight || videoSize.value.height;

				console.log(`[MediaPlayer] Valid duration found from ${eventType}:`, {
					duration,
					width,
					height,
				});

				emit("videoLoaded", {
					duration,
					width,
					height,
				});

				// // Duration bilgisi alındıktan sonra video'yu başa saralım
				// if (videoElement.fastSeek) {
				// 	videoElement.fastSeek(0);
				// } else {
				// 	videoElement.currentTime = 0;
				// }
			}
		};

		const isValidDuration = (duration) => {
			return (
				duration && duration !== Infinity && !isNaN(duration) && duration > 0
			);
		};

		// Duration event listener'larını ekle
		videoElement.addEventListener("loadedmetadata", () => {
			checkAndUpdateDuration("loadedmetadata");

			// Eğer duration hala geçerli değilse, hızlı bir seek deneyelim
			if (!isValidDuration(videoElement.duration)) {
				console.log("[MediaPlayer] Trying fast seek to get duration");
				try {
					if (videoElement.fastSeek) {
						videoElement.fastSeek(Number.MAX_SAFE_INTEGER);
					} else {
						videoElement.currentTime = Number.MAX_SAFE_INTEGER;
					}
				} catch (e) {
					console.warn("[MediaPlayer] Fast seek failed:", e);
				}
			}
		});

		videoElement.addEventListener("durationchange", () => {
			checkAndUpdateDuration("durationchange");
		});

		videoElement.addEventListener("loadeddata", () => {
			checkAndUpdateDuration("loadeddata");
		});

		// Canplay event'inde de duration'ı kontrol edelim
		videoElement.addEventListener("canplay", () => {
			checkAndUpdateDuration("canplay");
		});

		// Error handling
		videoElement.addEventListener("error", (e) => {
			console.error("[MediaPlayer] Video loading error:", {
				error: videoElement.error,
				errorCode: videoElement.error?.code,
				errorMessage: videoElement.error?.message,
				networkState: videoElement.networkState,
				readyState: videoElement.readyState,
			});
		});

		// Progress monitoring
		videoElement.addEventListener("progress", () => {
			const buffered = videoElement.buffered;
			if (buffered.length > 0) {
				console.log("[MediaPlayer] Video loading progress:", {
					bufferedStart: buffered.start(0),
					bufferedEnd: buffered.end(0),
					duration: videoElement.duration,
				});
			}
		});

		// Event listener'ları ekle
		const { addEvents, removeEvents } = useVideoEvents(videoElement, {
			onVideoMetadataLoaded,
			onVideoDataLoaded,
			onDurationChange,
			onTimeUpdate,
			onVideoEnded,
			onVideoError,
			onVideoPlay,
			onVideoPause,
			onVideoSeeking,
			onVideoSeeked,
			onVideoRateChange,
			onVideoVolumeChange,
		});

		addEvents();

		// Cleanup için removeEvents'i sakla
		videoElement._removeEvents = removeEvents;

		// Video URL'ini set et ve yüklemeyi başlat
		videoElement.src = props.videoUrl;

		// Video yüklenmeye başladığında ilk frame'i göster
		videoElement.addEventListener(
			"loadeddata",
			() => {
				if (!animationFrame) {
					animationFrame = requestAnimationFrame(updateCanvas);
				}
			},
			{ once: true }
		);

		videoElement.load();

		// 5 saniye timeout ekleyelim
		setTimeout(() => {
			if (!isValidDuration(videoElement.duration)) {
				console.warn(
					"[MediaPlayer] Could not get valid duration after 5 seconds"
				);
				// Burada alternatif bir yöntem deneyebilir veya hata bildirebilirsiniz
			}
		}, 5000);
	} catch (error) {
		console.error("[MediaPlayer] Video yükleme hatası:", error);
	}
};

// Video metadata ve data yükleme işleyicileri
const onVideoMetadataLoaded = () => {
	if (!videoElement || !canvasRef.value) return;

	try {
		console.log("[MediaPlayer] Video metadata yükleniyor:", {
			videoWidth: videoElement.videoWidth,
			videoHeight: videoElement.videoHeight,
			duration: videoElement.duration,
			readyState: videoElement.readyState,
		});

		// Context'i oluştur
		ctx = canvasRef.value.getContext("2d", {
			alpha: false,
			desynchronized: false,
			willReadFrequently: false,
			preserveDrawingBuffer: true,
			antialias: true,
		});

		// Container boyutlarını al
		const container = containerRef.value.getBoundingClientRect();
		const containerWidth = container.width;
		const containerHeight = container.height;

		// Video aspect ratio'sunu hesapla
		const videoRatio = videoElement.videoWidth / videoElement.videoHeight;
		const containerRatio = containerWidth / containerHeight;

		// Canvas boyutlarını container'a göre ayarla
		let canvasWidth, canvasHeight;
		if (videoRatio > containerRatio) {
			canvasWidth = containerWidth;
			canvasHeight = containerWidth / videoRatio;
		} else {
			canvasHeight = containerHeight;
			canvasWidth = containerHeight * videoRatio;
		}

		// DPR'ı kullanarak canvas çözünürlüğünü artır
		const dpr = window.devicePixelRatio || 1;
		canvasRef.value.width = canvasWidth * dpr * scaleValue;
		canvasRef.value.height = canvasHeight * dpr * scaleValue;

		// Canvas stil boyutlarını ayarla (CSS pixels)
		canvasRef.value.style.width = `${canvasWidth}px`;
		canvasRef.value.style.height = `${canvasHeight}px`;

		// Canvas kalite ayarları
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";

		// Canvas transform ayarları
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		// Canvas stil ayarları
		Object.assign(canvasRef.value.style, {
			display: "block",
			backfaceVisibility: "hidden",
			willChange: "transform",
			imageRendering: "high-quality",
			webkitImageRendering: "high-quality",
			position: "absolute",
			transform: "translateZ(0)",
			margin: "auto",
			top: 0,
			right: 0,
			bottom: 0,
			left: 0,
			maxWidth: "100%",
			maxHeight: "100%",
			boxSizing: "border-box",
		});

		// Video boyutlarını kaydet
		videoSize.value = {
			width: videoElement.videoWidth,
			height: videoElement.videoHeight,
		};

		// İlk render
		handleResize();

		// İlk frame'i hemen çiz
		requestAnimationFrame(() => {
			updateCanvas(performance.now());
		});

		// Duration değerini kontrol et ve güncelle
		if (videoElement.duration && videoElement.duration !== Infinity) {
			const duration = videoElement.duration;
			videoState.value.duration = duration;

			// Video hazır event'i
			emit("videoLoaded", {
				duration,
				width: videoElement.videoWidth,
				height: videoElement.videoHeight,
			});
		}

		// Video yüklendikten sonra ilk frame'i göstermek için
		// seekToFirstFrame fonksiyonunu çağır
		seekToFirstFrame();
	} catch (error) {
		console.error("[MediaPlayer] Metadata yükleme hatası:", error);
	}
};

// Settings değişikliklerini izle ve canvas'ı güncelle
watch(
	[
		backgroundColor,
		backgroundBlur,
		radius,
		shadowSize,
		padding,
		cameraSettings,
		videoBorderSettings, // Yeni eklenen
		mouseSize,
		mouseMotionEnabled,
		motionBlurValue,
		mouseVisible, // mouseVisible ekledim
		zoomRanges,
		currentZoomRange,
	],
	() => {
		if (!ctx || !canvasRef.value) return;

		// Canvas'ı hemen güncelle
		requestAnimationFrame(() => {
			updateCanvas(performance.now());
		});

		// Kamera ayarları değiştiğinde kamera pozisyonunu sıfırla
		if (cameraSettings.value.followMouse) {
			lastCameraPosition.value = null;
			lastCameraX.value = 0;
			lastCameraY.value = 0;
		}
	},
	{ immediate: true, deep: true }
);

// İlk frame'e seek etmek için yardımcı fonksiyon
const seekToFirstFrame = async () => {
	if (!videoElement) return;

	try {
		// Video hazır olana kadar bekle
		if (videoElement.readyState < 2) {
			await new Promise((resolve) => {
				const checkReady = () => {
					if (videoElement.readyState >= 2) {
						resolve();
					} else {
						requestAnimationFrame(checkReady);
					}
				};
				checkReady();
			});
		}

		// İlk frame'e git
		videoElement.currentTime = 0;

		// Canvas'ı hemen güncelle
		requestAnimationFrame(() => {
			updateCanvas(performance.now());
		});

		// Eğer video oynatılmıyorsa, animasyon frame'ini iptal et
		if (!videoState.value.isPlaying && animationFrame) {
			cancelAnimationFrame(animationFrame);
			animationFrame = null;
		}
	} catch (error) {
		console.error("[MediaPlayer] First frame seek error:", error);
	}
};

// Video data yüklendiğinde
const onVideoDataLoaded = () => {
	if (!videoElement) return;

	try {
		console.log("[MediaPlayer] Video data yükleniyor:", {
			videoWidth: videoElement.videoWidth,
			videoHeight: videoElement.videoHeight,
			duration: videoElement.duration,
			readyState: videoElement.readyState,
		});

		const width = videoElement.videoWidth || 1920;
		const height = videoElement.videoHeight || 1080;
		const duration = isFinite(videoElement.duration)
			? videoElement.duration
			: 0;

		// Video hazır event'i
		emit("videoLoaded", {
			duration,
			width,
			height,
		});

		console.log("[MediaPlayer] Video data yüklendi:", {
			width,
			height,
			duration,
		});
	} catch (error) {
		console.error("[MediaPlayer] Video data yükleme hatası:", error);
	}
};

// Duration değişikliğini izle
const onDurationChange = () => {
	if (!videoElement) return;

	try {
		// Duration değerini kontrol et
		if (videoElement.duration && videoElement.duration !== Infinity) {
			const duration = videoElement.duration;
			videoState.value.duration = duration;

			// Eğer metadata yüklenmiş ama duration henüz emit edilmemişse
			if (videoElement.readyState >= 1) {
				emit("videoLoaded", {
					duration,
					width: videoSize.value.width,
					height: videoSize.value.height,
				});
			}

			console.log("[MediaPlayer] Video süresi güncellendi:", duration);
		} else {
			console.log(
				"[MediaPlayer] Geçersiz duration değeri:",
				videoElement.duration
			);
		}
	} catch (error) {
		console.error("[MediaPlayer] Süre güncelleme hatası:", error);
	}
};

// Video event handlers
const onVideoPlay = () => {
	if (!videoElement) return;

	console.log("[MediaPlayer] Video play event triggered");

	videoState.value.isPlaying = true;
	videoState.value.isPaused = false;

	// Canvas animasyonunu başlat
	if (!animationFrame) {
		console.log("[MediaPlayer] Starting canvas animation from play event");
		animationFrame = requestAnimationFrame(updateCanvas);
	}

	emit("play", videoState.value);
};

const onVideoPause = () => {
	videoState.value.isPlaying = false;
	videoState.value.isPaused = true;

	// Canvas animasyonunu durdur
	if (animationFrame) {
		cancelAnimationFrame(animationFrame);
		animationFrame = null;
	}

	// Son frame'i çiz ve bırak
	updateCanvas(performance.now());

	emit("pause", videoState.value);
};

const onVideoSeeking = () => {
	videoState.value.isSeeking = true;
	emit("seeking", videoState.value);
};

const onVideoSeeked = () => {
	videoState.value.isSeeking = false;
	emit("seeked", videoState.value);
};

const onVideoRateChange = () => {
	videoState.value.playbackRate = videoElement.playbackRate;
	emit("rateChange", videoState.value);
};

const onVideoVolumeChange = () => {
	videoState.value.volume = videoElement.volume;
	emit("volumeChange", videoState.value);
};

// Component lifecycle
onMounted(() => {
	initVideo();

	// Initialize camera position from camera settings if available
	if (cameraSettings.value && cameraSettings.value.position) {
		console.log(
			"[MediaPlayer] Initializing camera position from settings:",
			cameraSettings.value.position
		);
		cameraPosition.value = { ...cameraSettings.value.position };
		if (lastCameraPosition.value) {
			lastCameraPosition.value = { ...cameraSettings.value.position };
		}
	}

	let newImage = backgroundImage.value;

	if (newImage) {
		bgImageElement.value = new Image();
		bgImageElement.value.onload = () => {
			bgImageLoaded.value = true;
			if (ctx) {
				updateCanvas(performance.now(), lastMouseX, lastMouseY);
			}
		};
		bgImageElement.value.onerror = () => {
			console.error("Background image failed to load:", newImage);
			bgImageLoaded.value = false;
			bgImageElement.value = null;
		};
		bgImageElement.value.src = newImage;
	}

	window.addEventListener("resize", handleResize);
	if (videoRef.value && canvasRef.value) {
		renderVideo();
	}
	canvasRef.value.addEventListener("mousedown", handleMouseDown);
	canvasRef.value.addEventListener("mousemove", handleMouseMove);
	window.addEventListener("mouseup", handleMouseUp);
});

onUnmounted(() => {
	if (videoElement) {
		if (videoElement._removeEvents) {
			videoElement._removeEvents();
		}
		videoElement.src = "";
		videoElement = null;
	}

	if (cameraElement) {
		if (cameraElement._removeEvents) {
			cameraElement._removeEvents();
		}
		cameraElement.src = "";
		cameraElement = null;
	}

	window.removeEventListener("resize", handleResize);

	if (animationFrame) {
		cancelAnimationFrame(animationFrame);
		animationFrame = null;
	}

	videoRef.value = null;
	cameraRef.value = null;
	canvasRef.value = null;
	cleanupZoom();
	if (canvasRef.value) {
		canvasRef.value.removeEventListener("mousedown", handleMouseDown);
		canvasRef.value.removeEventListener("mousemove", handleMouseMove);
	}
	window.removeEventListener("mouseup", handleMouseUp);
});

// Props değişikliklerini izle
watch(
	() => props.videoUrl,
	(newUrl, oldUrl) => {
		console.log("[MediaPlayer] Video URL değişti:", {
			newUrl,
			oldUrl,
			videoElement: !!videoElement,
		});

		if (newUrl && newUrl !== oldUrl) {
			initVideo();
		}
	},
	{ immediate: true }
);

watch(
	() => props.cameraUrl,
	(newUrl, oldUrl) => {
		console.log("[MediaPlayer] Kamera URL değişti:", {
			newUrl,
			oldUrl,
			cameraElement: !!cameraElement,
		});
		initCameraVideo();
	}
);

watch(
	() => props.isPlaying,
	(newValue) => {
		if (newValue) {
			play();
		} else {
			pause();
		}
	}
);

watch(
	() => props.currentTime,
	(newValue) => {
		if (!videoElement) return;

		// Sadece video oynatılmıyorsa ve preview yapılmıyorsa zamanı güncelle
		if (!videoState.value.isPlaying && props.previewTime === null) {
			videoElement.currentTime = newValue;
			if (cameraElement) {
				cameraElement.currentTime = newValue;
			}
			if (audioRef.value) {
				audioRef.value.currentTime = newValue;
			}
		}
	}
);

watch(() => props.selectedAspectRatio, updateAspectRatio);

// Props değişikliklerini izle
watch(
	() => props.systemAudioEnabled,
	(newValue) => {
		if (videoElement) {
			videoElement.muted = !newValue;
		}
	}
);

// Ses durumu değişikliğini izle
watch(
	() => props.isMuted,
	(newValue) => {
		if (videoElement) {
			videoElement.muted = newValue;
			if (audioRef.value) {
				audioRef.value.muted = newValue;
			}
			emit("muteChange", newValue);
		}
	}
);

// Preview zamanı değiştiğinde
watch(
	() => props.previewTime,
	(newValue) => {
		if (!videoElement || newValue === null) return;

		// Preview zamanını güncelle
		videoElement.currentTime = newValue;
		if (cameraElement) {
			cameraElement.currentTime = newValue;
		}
		videoState.value.currentTime = newValue;

		// Canvas'ı hemen güncelle
		requestAnimationFrame(() => updateCanvas(performance.now()));
	},
	{ immediate: true }
);

// Video render fonksiyonu
const renderVideo = () => {
	if (!canvasRef.value || !videoRef.value) return;

	const canvas = canvasRef.value;
	const ctx = canvas.getContext("2d");
	const video = videoRef.value;
	const camera = cameraRef.value;

	// Canvas boyutlarını ayarla
	canvas.width = containerRef.value.clientWidth;
	canvas.height = containerRef.value.clientHeight;

	// Videoyu çiz
	ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
	if (camera && cameraSettings.value.visible)
		ctx.drawImage(camera, 0, 0, canvas.width, canvas.height);

	// Bir sonraki frame'i iste
	requestAnimationFrame(renderVideo);
};

// Component metodlarını dışa aktar
defineExpose({
	// Playback controls
	updateCanvas,
	play,
	pause,
	seek: (time) => {
		if (!videoElement) return;
		videoElement.currentTime = time;
		if (cameraElement) cameraElement.currentTime = time;
	},

	// Video element access
	getVideoElement: () => videoElement,

	// Video frame capture
	captureFrame: () => {
		if (!canvasRef.value) return null;

		// Canvas'ı direkt olarak kopyala - tüm içeriği almak için
		try {
			// Yüksek kaliteli bir görüntü almak için
			return canvasRef.value.toDataURL("image/png", 1.0);
		} catch (error) {
			console.error("[MediaPlayer] Screenshot capture error:", error);
			return null;
		}
	},

	// Export için fare pozisyonu işleme - bu fonksiyon ekleniyor
	handleMousePositionForExport: (currentTime) => {
		if (!props.mousePositions || !props.mousePositions.length) return;

		// Video süresini al
		const videoDuration = videoElement?.duration || 0;
		if (!videoDuration) return;

		// Doğrudan fare pozisyonunu güncelle - daha az yumuşak ama export için daha doğru
		const totalPositions = props.mousePositions.length;
		const normalizedTime = currentTime / videoDuration;

		// Pozisyon indeksini hesapla
		const positionIndex = Math.min(
			Math.floor(normalizedTime * totalPositions),
			totalPositions - 1
		);

		// İlgili pozisyonu al
		if (positionIndex >= 0 && positionIndex < totalPositions) {
			const position = props.mousePositions[positionIndex];
			if (position) {
				// Doğrudan hedef ve mevcut pozisyonları güncelle - animasyon için
				if (typeof window.mouseCursorExportHelper === "undefined") {
					window.mouseCursorExportHelper = {};
				}

				// Global değişkenleri güncelle - daha hızlı erişim için
				window.mouseCursorExportHelper = {
					targetX: position.x,
					targetY: position.y,
					cursorX: position.x,
					cursorY: position.y,
					lastUpdateTime: Date.now(),
				};
			}
		}
	},

	// Video frame capture with specific size
	captureFrameWithSize: (width, height) => {
		if (!canvasRef.value) return null;

		try {
			// Performans için optimizasyon - export sırasında daha verimli çalışma
			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = width;
			tempCanvas.height = height;
			const tempCtx = tempCanvas.getContext("2d", {
				alpha: false,
				antialias: true,
				desynchronized: true, // Performans için desynchronized modunu etkinleştir
				willReadFrequently: true, // Sık okuma için optimize et
			});

			// En iyi kalite için ayarlar
			tempCtx.imageSmoothingEnabled = true;
			tempCtx.imageSmoothingQuality = "high";

			// Orijinal canvas'ın boyutlarını al
			const originalWidth = canvasRef.value.width;
			const originalHeight = canvasRef.value.height;

			// En-boy oranını koruyarak çizim yap
			const aspectRatio = originalWidth / originalHeight;
			let drawWidth = width;
			let drawHeight = height;

			if (width / height > aspectRatio) {
				// Hedef canvas daha geniş, yüksekliği kullan
				drawWidth = height * aspectRatio;
				drawHeight = height;
			} else {
				// Hedef canvas daha dar, genişliği kullan
				drawWidth = width;
				drawHeight = width / aspectRatio;
			}

			// Ortalama için offset hesapla
			const offsetX = (width - drawWidth) / 2;
			const offsetY = (height - drawHeight) / 2;

			// Arka planı siyah yap
			tempCtx.fillStyle = "#000000";
			tempCtx.fillRect(0, 0, width, height);

			// Orijinal canvas'ı çiz
			tempCtx.drawImage(
				canvasRef.value,
				offsetX,
				offsetY,
				drawWidth,
				drawHeight
			);

			// Performans optimizasyonu - daha düşük kalite kullan (1.0 yerine 0.85)
			// Export için PNG yerine JPEG kullan (daha hızlı, ama biraz kalite kaybı olur)
			// PNG: Tam kalite, yavaş
			// JPEG: Biraz kayıplı, hızlı
			return tempCanvas.toDataURL("image/jpeg", 0.85);
		} catch (error) {
			console.error("[MediaPlayer] Sized screenshot capture error:", error);
			return null;
		}
	},

	// Audio controls
	setVolume: (volume) => {
		if (!videoElement) return;
		const normalizedVolume = Math.max(0, Math.min(1, volume));
		videoElement.volume = normalizedVolume;
		if (audioRef.value) {
			audioRef.value.volume = normalizedVolume;
		}
	},
	toggleMute: () => {
		if (!videoElement) return;
		videoElement.muted = !videoElement.muted;
		if (audioRef.value) {
			audioRef.value.muted = videoElement.muted;
		}
		emit("muteChange", videoElement.muted);
	},

	// Video controls
	setPlaybackRate: (rate) => {
		if (!videoElement) return;
		videoElement.playbackRate = rate;
		if (cameraElement) cameraElement.playbackRate = rate;
	},
	updateAspectRatio,

	// State and data
	getState: () => ({ ...videoState.value }),
	getCropData,
	getCanvas: () => canvasRef.value,

	// Event handlers
	on: (event, handler) => {
		if (event === "videoEnded" && videoElement) {
			videoElement.addEventListener("ended", handler);
			cameraElement.addEventListener("ended", handler);
		}
	},
	off: (event, handler) => {
		if (event === "videoEnded" && videoElement) {
			videoElement.removeEventListener("ended", handler);
			cameraElement.removeEventListener("ended", handler);
		}
	},
	toggleCropModal: () => {
		console.log("[MediaPlayer] Toggling crop modal");
		showCropModal.value = !showCropModal.value;
	},

	// Expose methods to get and set positions
	getVideoPosition: () => {
		return { ...videoPosition.value };
	},

	getCameraPosition: () => {
		// Return the camera position from the useCameraDrag composable
		// Make a deep copy to avoid reference issues
		if (cameraPosition.value) {
			console.log(
				"[MediaPlayer] Getting camera position:",
				cameraPosition.value
			);
			return { ...cameraPosition.value };
		}

		// Fallback to lastCameraPosition if available
		if (lastCameraPosition.value) {
			console.log(
				"[MediaPlayer] Getting camera position from lastCameraPosition:",
				lastCameraPosition.value
			);
			return { ...lastCameraPosition.value };
		}

		// Default position if nothing else is available
		console.log(
			"[MediaPlayer] No camera position available, returning default"
		);
		return { x: 0, y: 0 };
	},

	setVideoPosition: (newPosition) => {
		if (!newPosition || typeof newPosition !== "object") return;

		// Ensure both position references are updated consistently
		videoPosition.value = { ...newPosition };
		position.value = { ...newPosition }; // Update the main position as well

		// Immediately update the canvas to reflect new position
		requestAnimationFrame(() => {
			updateCanvas(performance.now());
		});
	},

	setCameraPosition: (newPosition) => {
		if (
			newPosition &&
			typeof newPosition.x === "number" &&
			typeof newPosition.y === "number"
		) {
			console.log("[MediaPlayer] Setting camera position to:", newPosition);

			// Kamera pozisyonunu güncelle
			cameraPosition.value = { ...newPosition };

			// Ayrıca lastCameraPosition'ı da güncelle (render için)
			if (lastCameraPosition.value) {
				lastCameraPosition.value = { ...newPosition };
			}

			// Kamera ayarlarındaki pozisyonu güncelleme - bu sadece kaydetme sırasında yapılmalı
			// Burada güncellemeyi kaldırıyoruz ki düzen uygulandıktan sonra kamera serbest hareket edebilsin

			// Kamera pozisyonunu canvas'ta hemen güncelle
			requestAnimationFrame(() => {
				updateCanvas(performance.now());
			});
		}
	},

	// Add methods to get canvas size, camera settings, and video border settings
	getCanvasSize: () => {
		if (!canvasRef.value) return { width: 800, height: 600 };
		return {
			width: canvasRef.value.width,
			height: canvasRef.value.height,
		};
	},

	getCameraSettings: () => {
		return JSON.parse(JSON.stringify(cameraSettings.value || {}));
	},

	getVideoBorderSettings: () => {
		return JSON.parse(JSON.stringify(videoBorderSettings.value || {}));
	},

	getMouseCursorSettings: () => {
		return {
			size: mouseSize.value,
			visible: mouseVisible.value,
			motionBlur: motionBlurValue.value,
		};
	},

	getZoomSettings: () => {
		return {
			zoomRanges: JSON.parse(JSON.stringify(zoomRanges.value || [])),
			currentZoomRange: currentZoomRange.value
				? JSON.parse(JSON.stringify(currentZoomRange.value))
				: null,
		};
	},
});

// cropRatio değişikliğini izle
watch(cropRatio, (newRatio) => {
	if (!videoElement) return;

	// Eğer crop uygulanmışsa, mevcut crop değerlerini koru
	if (cropArea.value?.isApplied === true) {
		return;
	}

	if (!newRatio || newRatio === "auto") {
		// Auto seçildiğinde orijinal boyutları kullan
		cropArea.value = {
			x: 0,
			y: 0,
			width: videoElement.videoWidth,
			height: videoElement.videoHeight,
			isApplied: false,
		};
	} else {
		// Diğer aspect ratio'lar için mevcut hesaplama
		const [widthRatio, heightRatio] = newRatio.split(":").map(Number);
		const targetRatio = widthRatio / heightRatio;
		const currentRatio = videoElement.videoWidth / videoElement.videoHeight;

		if (currentRatio > targetRatio) {
			// Video daha geniş, yüksekliği kullan
			const newWidth = videoElement.videoHeight * targetRatio;
			cropArea.value = {
				x: (videoElement.videoWidth - newWidth) / 2,
				y: 0,
				width: newWidth,
				height: videoElement.videoHeight,
				isApplied: false,
			};
		} else {
			// Video daha dar, genişliği kullan
			const newHeight = videoElement.videoWidth / targetRatio;
			cropArea.value = {
				x: 0,
				y: (videoElement.videoHeight - newHeight) / 2,
				width: videoElement.videoWidth,
				height: newHeight,
				isApplied: false,
			};
		}
	}

	// Crop değişikliğini bildir
	emit("cropChange", cropArea.value);
});

// Aspect ratio değişikliğini izle ve canvas'ı güncelle
watch(
	cropRatio,
	(newRatio) => {
		console.log("[MediaPlayer] Aspect ratio changed:", newRatio);

		// Reset position to center when aspect ratio changes
		position.value = { x: 0, y: 0 };
		videoPosition.value = { x: 0, y: 0 };

		// Canvas'ı yeniden boyutlandır
		if (containerRef.value && canvasRef.value) {
			const container = containerRef.value;
			const canvas = canvasRef.value;

			// Container boyutlarını güncelle
			requestAnimationFrame(() => {
				// Canvas boyutlarını güncelle
				canvas.width = container.clientWidth;
				canvas.height = container.clientHeight;

				// Kırpma alanını ve video pozisyonunu güncelle
				updateCropArea();

				// Canvas'ı hemen güncelle
				updateCanvas(performance.now());
			});
		}
	},
	{ immediate: true }
);

// Kamera pozisyonu için state
const lastCameraX = ref(0);
const lastCameraY = ref(0);

// Mouse event handlers
const handleMouseDown = (e) => {
	if (!canvasRef.value) return;

	const rect = canvasRef.value.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	const mouseX = (e.clientX - rect.left) * dpr * scaleValue;
	const mouseY = (e.clientY - rect.top) * dpr * scaleValue;

	// Kamera üzerinde tıklandıysa ve takip modu kapalıysa kamerayı sürükle
	if (isMouseOverCamera.value && !cameraSettings.value.followMouse) {
		console.log("[MediaPlayer] Starting camera drag");
		// Kamera pozisyonu için lastCameraPosition veya cameraPosition kullan
		const currentCameraPos = lastCameraPosition.value ||
			cameraPosition.value || { x: 0, y: 0 };
		startCameraDrag(e, currentCameraPos, mouseX, mouseY);
	} else {
		// Değilse videoyu sürükle
		console.log("[MediaPlayer] Starting video drag");
		startVideoDrag(
			e,
			{ x: position.value.x, y: position.value.y },
			mouseX,
			mouseY
		);
	}
};

const handleMouseMove = (e) => {
	if (!canvasRef.value) return;

	// Mouse görünürlüğü kapalıysa sadece pozisyonu güncelle, canvas'ı güncelleme
	const rect = canvasRef.value.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	const mouseX = (e.clientX - rect.left) * dpr * scaleValue;
	const mouseY = (e.clientY - rect.top) * dpr * scaleValue;

	// Mouse pozisyonlarını güncelle
	mousePosition.value = { x: mouseX, y: mouseY };

	// Canvas'ı sürekli güncelle (hover efekti için)
	requestAnimationFrame(() => {
		updateCanvas(performance.now(), mouseX, mouseY);
	});
};

const handleMouseUp = () => {
	if (isCameraDragging.value) {
		stopCameraDrag();
	}
	if (isVideoDragging.value) {
		stopVideoDrag();
	}
};

// Crop işlemi uygulandığında
const handleCropApplied = (cropData) => {
	console.log("Crop applied:", cropData);

	// Crop verilerini doğrula
	if (!cropData || !videoElement) {
		console.warn("[MediaPlayer] Invalid crop data or video element");
		return;
	}

	// Video boyutlarına göre crop koordinatlarını hesapla
	const videoWidth = videoElement.videoWidth;
	const videoHeight = videoElement.videoHeight;

	// Crop verilerini video sınırları içinde tut ve gerçek piksel değerlerine dönüştür
	const validatedCropData = {
		x: Math.round(Math.max(0, Math.min(cropData.x * videoWidth, videoWidth))),
		y: Math.round(Math.max(0, Math.min(cropData.y * videoHeight, videoHeight))),
		width: Math.round(Math.min(cropData.width * videoWidth, videoWidth)),
		height: Math.round(Math.min(cropData.height * videoHeight, videoHeight)),
		isApplied: true, // Crop'un uygulandığını belirt
	};

	// Kırpma verilerini kaydet
	cropArea.value = validatedCropData;

	// Canvas'ı güncelle
	requestAnimationFrame(() => {
		updateCanvas(performance.now());
	});

	// Modal'ı kapat ve state'i güncelle
	showCropModal.value = false;
	emit("update:isCropMode", false);
	emit("cropChange", validatedCropData);
};

// isCropMode prop'unu izleyelim
watch(
	() => props.isCropMode,
	(newValue) => {
		showCropModal.value = newValue;
		if (!newValue) {
			emit("update:isCropMode", false);
		}
	}
);

// Add watch for audioUrl after other watches
// ... existing code ...
// Ses durumu güncelleme
watch(
	() => props.isMuted,
	(newMuted) => {
		if (videoElement) videoElement.muted = newMuted;
		if (cameraElement) cameraElement.muted = newMuted;
		if (audioRef.value) {
			audioRef.value.muted = newMuted;
			console.log(
				`[MediaPlayer] Audio muted set to: ${newMuted}, Audio element:`,
				{
					src: audioRef.value.src,
					paused: audioRef.value.paused,
					muted: audioRef.value.muted,
				}
			);
		}
	},
	{ immediate: true }
);

// Audio URL değiştiğinde debug için log
watch(
	() => props.audioUrl,
	(newUrl, oldUrl) => {
		console.log(`[MediaPlayer] Audio URL changed:`, {
			old: oldUrl,
			new: newUrl,
			audioRef: audioRef.value
				? {
						exists: true,
						src: audioRef.value.src,
				  }
				: "No audio element yet",
		});
	},
	{ immediate: true }
);
// ... existing code ...

// mouseVisible değişikliğini izle ve canvas'ı güncelle
watch(
	mouseVisible,
	() => {
		if (!ctx || !canvasRef.value) return;

		// Canvas'ı hemen güncelle
		requestAnimationFrame(() => {
			updateCanvas(performance.now());
		});
	},
	{ immediate: true }
);

// İlk frame'e seek etmek için yardımcı fonksiyon

// macOS Dock çizme fonksiyonu
const drawMacOSDock = (ctx, dpr) => {
	if (!canvasRef.value || !ctx) return;

	// Dock ikonları için önbellek oluştur - component scope'unda tutulur
	if (!window.dockIconCache) {
		window.dockIconCache = {};
	}

	try {
		// Canvas boyutlarını al
		const canvasWidth = canvasRef.value.width;
		const canvasHeight = canvasRef.value.height;

		// Dock öğelerini çiz
		if (visibleDockItems.value && visibleDockItems.value.length > 0) {
			// Dock ayarları
			const scale = dockSize.value;
			const dockHeight = 52 * dpr * scale;
			const dockRadius = 18 * dpr * scale;
			const iconSize = 48 * dpr * scale;
			const iconSpacing = 4 * dpr * scale; // İkonlar arası boşluğu artır
			const dividerSpacing = 8 * dpr * scale; // Ayırıcı için boşluk miktarını azalt

			// Dock içinde ayırıcı olup olmadığını kontrol et ve varsa ayırıcı sayısını bul
			let dividerCount = 0;
			visibleDockItems.value.forEach((item) => {
				if (item.isDivider) dividerCount++;
			});

			// Dock toplam genişliğini hesapla
			const dockWidth =
				iconSize * visibleDockItems.value.length + // İkonların toplam genişliği
				iconSpacing * (visibleDockItems.value.length - 1) + // İkonlar arası boşluk (son ikon için boşluk yok)
				dividerSpacing * dividerCount * 2; // Ayırıcılar için ekstra boşluk (her iki tarafta)

			// Dock'u yatayda ortala
			const dockX = Math.floor((canvasWidth - dockWidth) / 2);
			const dockY = canvasHeight - dockHeight - 5 * dpr * scale;

			// 1. ADIM: Mevcut canvas içeriğini bir kopyasını al (arkaplanı blurlayacağız)
			const contentCanvas = document.createElement("canvas");
			contentCanvas.width = canvasWidth;
			contentCanvas.height = canvasHeight;
			const contentCtx = contentCanvas.getContext("2d");

			// Mevcut canvas içeriğini kopyala
			contentCtx.drawImage(canvasRef.value, 0, 0);

			// 2. ADIM: Dock alanı için maskeleme yaparak blur uygula
			const backdropCanvas = document.createElement("canvas");
			backdropCanvas.width = canvasWidth;
			backdropCanvas.height = canvasHeight;
			const backdropCtx = backdropCanvas.getContext("2d");

			// Önce mevcut içeriği kopyala
			backdropCtx.drawImage(contentCanvas, 0, 0);

			// Dock alanına blur uygula
			backdropCtx.save();
			backdropCtx.beginPath();
			roundedRect(backdropCtx, dockX, dockY, dockWidth, dockHeight, dockRadius);
			backdropCtx.clip();

			// Blur filtresi uygula - Daha güçlü blur efekti
			backdropCtx.filter = `blur(${30 * dpr}px)`;
			backdropCtx.drawImage(contentCanvas, 0, 0);
			backdropCtx.filter = "none";
			backdropCtx.restore();

			// 3. ADIM: Shadow çizimi için geçici canvas oluştur
			const shadowCanvas = document.createElement("canvas");
			shadowCanvas.width = canvasWidth;
			shadowCanvas.height = canvasHeight;
			const shadowCtx = shadowCanvas.getContext("2d");

			// Shadow çiz - daha belirgin gölge
			shadowCtx.save();
			shadowCtx.shadowColor = "rgba(0, 0, 0, 0.8)";
			shadowCtx.shadowBlur = 25 * dpr;
			shadowCtx.shadowOffsetX = 0;
			shadowCtx.shadowOffsetY = 2 * dpr;

			// Shadow için şekil çiz
			shadowCtx.beginPath();
			roundedRect(shadowCtx, dockX, dockY, dockWidth, dockHeight, dockRadius);
			shadowCtx.fillStyle = "rgba(255, 255, 255, 0.005)";
			shadowCtx.fill();
			shadowCtx.restore();

			// 4. ADIM: Ana canvas'a tüm efektleri çiz
			ctx.save();

			// Önce blurlu arkaplanı çiz
			ctx.drawImage(backdropCanvas, 0, 0);

			// Sonra üzerine buzlu cam efekti ekle
			ctx.globalCompositeOperation = "source-over";
			ctx.beginPath();
			roundedRect(ctx, dockX, dockY, dockWidth, dockHeight, dockRadius);
			ctx.fillStyle = "rgba(255, 255, 255, 0.15)"; // Daha belirgin arka plan
			ctx.fill();

			// Shadow'u çiz
			ctx.drawImage(shadowCanvas, 0, 0);

			// Border çiz - daha belirgin kenarlar
			ctx.beginPath();
			roundedRect(ctx, dockX, dockY, dockWidth + 2, dockHeight + 2, dockRadius);
			ctx.strokeStyle = "rgba(255, 255, 255, 0.23)";
			ctx.lineWidth = 4 * dpr;
			ctx.stroke();

			// İkonları çizmeye hazırlan
			ctx.restore();

			// 5. ADIM: İkonları çiz (blursuz ve net olarak)
			const totalIcons = visibleDockItems.value.length;

			// İlk ikon konumu (dock'un sol kenarından iconSpacing kadar içeride)
			let currentX = dockX + iconSpacing;

			// Her dock öğesi için icon çiz
			visibleDockItems.value.forEach((item, index) => {
				// Eğer bu öğe divider özelliğine sahipse, ayırıcı çiz
				if (item.isDivider) {
					// Divider'dan önce boşluk bırak
					currentX += dividerSpacing;

					// Ayırıcı çizgisi için koordinatları hesapla
					const dividerX = currentX;
					const dividerY = dockY + dockHeight * 0.2; // Dock'un üst kısmından başla
					const dividerHeight = dockHeight * 0.6; // Dock'un %60'ı kadar uzunlukta

					// Ayırıcı çizgisini çiz
					ctx.save();
					ctx.beginPath();
					ctx.moveTo(dividerX, dividerY);
					ctx.lineTo(dividerX, dividerY + dividerHeight);
					ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"; // Biraz daha belirgin beyaz
					ctx.lineWidth = 2 * dpr * scale; // Çizgi kalınlığını artır
					ctx.stroke();
					ctx.restore();

					// Divider'dan sonra boşluk bırak
					currentX += dividerSpacing;
				}

				// İkon için X ve Y pozisyonlarını hesapla
				const iconX = currentX;
				const iconY = dockY + (dockHeight - iconSize) / 2;
				const cacheKey = item.name || `icon-${index}`;

				// Icon varsa çiz
				if (item.iconDataUrl) {
					// Cache'de var mı kontrol et
					if (window.dockIconCache[cacheKey]) {
						// Cache'den çiz
						ctx.save();
						ctx.beginPath();
						ctx.arc(
							iconX + iconSize / 2,
							iconY + iconSize / 2,
							iconSize / 2,
							0,
							2 * Math.PI
						);
						ctx.clip();
						ctx.drawImage(
							window.dockIconCache[cacheKey],
							iconX,
							iconY,
							iconSize,
							iconSize
						);
						ctx.restore();
					} else {
						// Yeni image yükle
						const img = new Image();
						img.onload = () => {
							// Cache'e ekle
							window.dockIconCache[cacheKey] = img;

							// Yuvarlak kırpma maskesi oluştur
							ctx.save();
							ctx.beginPath();
							ctx.arc(
								iconX + iconSize / 2,
								iconY + iconSize / 2,
								iconSize / 2,
								0,
								2 * Math.PI
							);
							ctx.clip();

							// İkonu çiz
							ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
							ctx.restore();

							// Canvas'ı güncelle
							requestAnimationFrame(updateCanvas);
						};
						img.src = item.iconDataUrl;
					}
				}

				// Sonraki ikon için X pozisyonunu güncelle (ikon genişliği + boşluk)
				currentX += iconSize + iconSpacing;
			});
		}

		ctx.restore();
	} catch (error) {
		console.error("[MediaPlayer] Error drawing macOS dock:", error);
	}
};

// Yuvarlak köşeli dikdörtgen çizme yardımcı fonksiyonu
const roundedRect = (ctx, x, y, width, height, radius) => {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
};
</script>

<style scoped>
canvas {
	image-rendering: -webkit-optimize-contrast;
	image-rendering: crisp-edges;
	image-rendering: pixelated;
	image-rendering: optimizeQuality;
	-webkit-backface-visibility: hidden;
	backface-visibility: hidden;
	transform: translateZ(0);
	perspective: 1000;
	-webkit-transform-style: preserve-3d;
	transform-style: preserve-3d;
	-webkit-perspective: 1000;
}

video {
	image-rendering: -webkit-optimize-contrast;
	image-rendering: crisp-edges;
	image-rendering: optimizeQuality;
	-webkit-backface-visibility: hidden;
	backface-visibility: hidden;
	transform: translateZ(0);
	perspective: 1000;
	-webkit-transform-style: preserve-3d;
	transform-style: preserve-3d;
	-webkit-perspective: 1000;
}
</style>
