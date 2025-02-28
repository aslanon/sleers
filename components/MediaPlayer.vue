<template>
	<div
		class="media-player w-full h-full m-auto rounded-lg overflow-hidden bg-black/80"
		@togglePlayback="togglePlay"
		style="width: 800px; height: 600px; min-width: 800px; min-height: 600px"
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
				class="relative"
				:style="{
					width: `${cropArea.width}px`,
					height: `${cropArea.height}px`,
				}"
			>
				<canvas
					id="canvasID"
					ref="canvasRef"
					class="absolute inset-0 w-full h-full"
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
} = usePlayerSettings();

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
	if (!props.mousePositions || !canvasRef.value || !videoElement) return;

	const ctx = canvasRef.value.getContext("2d");
	if (!ctx) return;

	// Video süresini al
	const videoDuration = videoElement.duration;
	if (!videoDuration) return;

	// Mouse pozisyonları için toplam frame sayısı
	const totalFrames = props.mousePositions.length;
	const frameTime = videoDuration / totalFrames;
	const exactFrame = videoElement.currentTime / frameTime;
	const currentFrame = Math.floor(exactFrame);
	const nextFrame = Math.min(currentFrame + 1, totalFrames - 1);
	const framePart = exactFrame - currentFrame;

	// İki frame arasında interpolasyon yap
	const currentPos = props.mousePositions[currentFrame];
	const nextPos = props.mousePositions[nextFrame];
	if (!currentPos || !nextPos) return;

	// İnterpolasyon ile ara pozisyonu hesapla
	const interpolatedX = currentPos.x + (nextPos.x - currentPos.x) * framePart;
	const interpolatedY = currentPos.y + (nextPos.y - currentPos.y) * framePart;

	// DPR'ı hesaba kat
	const dpr = window.devicePixelRatio || 1;

	// Mouse hareketi hesapla
	const moveDistance = Math.sqrt(
		Math.pow(nextPos.x - currentPos.x, 2) +
			Math.pow(nextPos.y - currentPos.y, 2)
	);
	const speed = moveDistance / (nextPos.timestamp - currentPos.timestamp);
	const dirX = moveDistance ? (nextPos.x - currentPos.x) / moveDistance : 0;
	const dirY = moveDistance ? (nextPos.y - currentPos.y) / moveDistance : 0;

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
			type: currentPos.type || MOUSE_EVENTS.MOVE,
			button: currentPos.button,
			clickCount: currentPos.clickCount,
			rotation: currentPos.rotation,
			direction: currentPos.direction,
			speed,
			dirX,
			dirY,
		},
		size: mouseSize.value,
		dpr,
		motionEnabled: mouseMotionEnabled.value,
		motionBlurValue: motionBlurValue.value,
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
			ctx.translate(
				transformOriginX + position.value.x,
				transformOriginY + position.value.y
			);
			ctx.scale(videoScale.value, videoScale.value);
			ctx.translate(
				-(transformOriginX + position.value.x),
				-(transformOriginY + position.value.y)
			);

			// Draw shadow if enabled
			if (shadowSize.value > 0) {
				ctx.save();
				ctx.beginPath();
				useRoundRect(
					ctx,
					x + position.value.x,
					y + position.value.y,
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
				x + position.value.x,
				y + position.value.y,
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
					x + position.value.x,
					y + position.value.y,
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
					x + position.value.x,
					y + position.value.y,
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
					x + position.value.x,
					y + position.value.y,
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
					x + position.value.x,
					y + position.value.y,
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
				x + position.value.x,
				y + position.value.y,
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
					x + position.value.x,
					y + position.value.y,
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
					x + position.value.x,
					y + position.value.y,
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
					x + position.value.x,
					y + position.value.y,
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
			transform: "translateZ(0)",
			backfaceVisibility: "hidden",
			perspective: "1000px",
			willChange: "transform",
			imageRendering: "high-quality",
			webkitImageRendering: "high-quality",
			position: "absolute",
			left: "50%",
			top: "50%",
			transform: "translate(-50%, -50%)",
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
	if (camera) ctx.drawImage(camera, 0, 0, canvas.width, canvas.height);

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

	if (isMouseOverCamera.value && !cameraSettings.value.followMouse) {
		startCameraDrag(e, lastCameraPosition.value, mouseX, mouseY);
	} else {
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
