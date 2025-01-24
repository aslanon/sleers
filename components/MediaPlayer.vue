<template>
	<div
		class="media-player w-full h-full rounded-lg overflow-hidden bg-black/80"
		@togglePlayback="togglePlay"
	>
		<div
			ref="containerRef"
			class="relative w-full h-full overflow-hidden flex items-center justify-center"
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
	</div>
</template>

<script setup>
import { useVideoZoom } from "~/composables/useVideoZoom";
import { useMouseCursor } from "~/composables/useMouseCursor";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import { useCameraRenderer } from "~/composables/useCameraRenderer";
import { useCameraDrag } from "~/composables/useCameraDrag";

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
});

// Player settings'i al
const {
	backgroundColor,
	backgroundImage,
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
		// Eğer zaten oynatılıyorsa işlemi durdur
		if (videoState.value.isPlaying) return;

		// Video bitmiş ise başa sar
		if (videoElement.currentTime >= videoElement.duration) {
			videoElement.currentTime = 0;
			videoState.value.currentTime = 0;
			if (cameraElement.currentTime >= cameraElement.duration) {
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
			if (audioRef.value && !audioRef.value.paused) {
				await audioRef.value.play();
			}
		} catch (error) {
			// Oynatma başarısız olursa state'i geri al
			videoState.value.isPlaying = false;
			videoState.value.isPaused = true;
			throw error;
		}

		// Canvas animasyonunu başlat
		if (!animationFrame) {
			animationFrame = requestAnimationFrame(updateCanvas);
		}

		emit("play");
	} catch (error) {
		console.error("[MediaPlayer] Oynatma hatası:", error);
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
			videoState.value.isPlaying = true;
			videoState.value.isPaused = false;
			throw error;
		}

		// Canvas animasyonunu durdur
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
			animationFrame = null;
		}

		// Son frame'i çiz
		updateCanvas(performance.now());
		emit("pause");
	} catch (error) {
		console.error("[MediaPlayer] Durdurma hatası:", error);
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

	// Video aspect ratio'sunu hesapla
	const videoRatio = videoElement.videoWidth / videoElement.videoHeight;
	const containerRatio = containerWidth / containerHeight;

	// Canvas boyutlarını container'a göre ayarla
	let canvasWidth, canvasHeight;
	if (!cropRatio.value || cropRatio.value === "auto") {
		// Auto modunda video aspect ratio'sunu koru
		if (videoRatio > containerRatio) {
			canvasWidth = containerWidth;
			canvasHeight = containerWidth / videoRatio;
		} else {
			canvasHeight = containerHeight;
			canvasWidth = containerHeight * videoRatio;
		}
	} else {
		// Seçilen aspect ratio'yu kullan
		const [targetWidth, targetHeight] = cropRatio.value.split(":").map(Number);
		const targetRatio = targetWidth / targetHeight;

		if (containerRatio > targetRatio) {
			// Container daha geniş, yüksekliğe göre hesapla
			canvasHeight = containerHeight;
			canvasWidth = containerHeight * targetRatio;
		} else {
			// Container daha dar, genişliğe göre hesapla
			canvasWidth = containerWidth;
			canvasHeight = containerWidth / targetRatio;
		}
	}

	// Canvas boyutlarını güncelle
	canvasRef.value.width = canvasWidth;
	canvasRef.value.height = canvasHeight;

	// Canvas stil boyutlarını ayarla (CSS pixels)
	canvasRef.value.style.width = `${canvasWidth}px`;
	canvasRef.value.style.height = `${canvasHeight}px`;

	// Canvas transform ayarları
	ctx.setTransform(1, 0, 0, 1, 0, 0);

	// Kırpma alanını güncelle
	cropArea.value = {
		width: canvasWidth,
		height: canvasHeight,
		x: 0,
		y: 0,
	};

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

	// Video aspect ratio'sunu hesapla
	const videoRatio = videoElement.videoWidth / videoElement.videoHeight;
	const containerRatio = containerWidth / containerHeight;

	// Canvas boyutlarını container'a göre ayarla
	let canvasWidth, canvasHeight;
	if (!cropRatio.value || cropRatio.value === "auto") {
		// Auto modunda video'nun orijinal en-boy oranını kullan
		const videoRatio = videoElement.videoWidth / videoElement.videoHeight;
		console.log(
			"[MediaPlayer] Aspect ratio changed:",
			`${videoElement.videoWidth}:${videoElement.videoHeight}`
		);

		if (videoRatio > containerRatio) {
			// Video daha geniş, genişliğe göre ölçekle
			canvasWidth = containerWidth;
			canvasHeight = containerWidth / videoRatio;
		} else {
			// Video daha dar, yüksekliğe göre ölçekle
			canvasHeight = containerHeight;
			canvasWidth = containerHeight * videoRatio;
		}
	} else {
		// Seçilen aspect ratio'yu al
		const [targetWidth, targetHeight] = cropRatio.value.split(":").map(Number);
		const targetRatio = targetWidth / targetHeight;
		console.log("[MediaPlayer] Aspect ratio changed:", cropRatio.value);

		if (containerRatio > targetRatio) {
			// Container daha geniş, yüksekliğe göre hesapla
			canvasHeight = containerHeight;
			canvasWidth = containerHeight * targetRatio;
		} else {
			// Container daha dar, genişliğe göre hesapla
			canvasWidth = containerWidth;
			canvasHeight = containerWidth / targetRatio;
		}
	}

	// Canvas boyutlarını güncelle
	canvasRef.value.width = canvasWidth;
	canvasRef.value.height = canvasHeight;

	// Canvas stil boyutlarını ayarla (CSS pixels)
	canvasRef.value.style.width = `${canvasWidth}px`;
	canvasRef.value.style.height = `${canvasHeight}px`;

	// Canvas transform ayarları
	ctx.setTransform(1, 0, 0, 1, 0, 0);

	// Kırpma alanını güncelle
	cropArea.value = {
		width: canvasWidth,
		height: canvasHeight,
		x: 0,
		y: 0,
	};

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
	requestAnimationFrame(() => updateCanvas(performance.now()));
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
		if (cameraElement) {
			cameraElement.currentTime = 0;
		}
	}

	if (audioRef.value) {
		audioRef.value.pause();
		audioRef.value.currentTime = 0;
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
	previousPositions,
	cursorImage,
	drawMousePosition: drawMouseCursor,
	mousePosition,
} = useMouseCursor(MOTION_BLUR_CONSTANTS);

// Mouse positions değişikliğini izle ve previousPositions'ı temizle
watch(
	() => props.mousePositions,
	() => {
		previousPositions.value = []; // Trail'i temizle
	},
	{ deep: true }
);

// Arkaplan resmi için
const bgImageElement = ref(null);
const bgImageLoaded = ref(false);

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
const updateCanvas = (timestamp, mouseX, mouseY) => {
	if (!ctx || !canvasRef.value) return;

	// FPS kontrolü
	if (timestamp - lastFrameTime < frameInterval) {
		animationFrame = requestAnimationFrame(updateCanvas);
		return;
	}

	lastFrameTime = timestamp;

	// Canvas'ı temizle
	ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);

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

			ctx.drawImage(bgImageElement.value, x, y, scaledWidth, scaledHeight);
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

	// Video'nun orijinal en-boy oranını koru
	const videoRatio = videoElement.videoWidth / videoElement.videoHeight;
	const canvasWidth = canvasRef.value.width;
	const canvasHeight = canvasRef.value.height;

	// Video'yu canvas'a sığdırırken aspect ratio'yu koru
	let drawWidth, drawHeight, x, y;

	// Önce padding'i hesaba kat
	const availableWidth = cropArea.value.width - padding.value * 2;
	const availableHeight = cropArea.value.height - padding.value * 2;
	const availableRatio = availableWidth / availableHeight;

	if (videoRatio > availableRatio) {
		// Video daha geniş, genişliğe göre ölçekle
		drawWidth = availableWidth;
		drawHeight = drawWidth / videoRatio;
		x = padding.value;
		y = padding.value + (availableHeight - drawHeight) / 2;
	} else {
		// Video daha dar, yüksekliğe göre ölçekle
		drawHeight = availableHeight;
		drawWidth = drawHeight * videoRatio;
		x = padding.value + (availableWidth - drawWidth) / 2;
		y = padding.value;
	}

	// Aktif zoom segmentini bul
	const currentTime = videoElement.currentTime;
	const activeZoom = checkZoomSegments(currentTime, zoomRanges.value);

	// Store'dan gelen scale değerini kullan
	const targetScale = activeZoom ? activeZoom.scale : 1;
	const lerpFactor = 0.1;
	videoScale.value =
		videoScale.value + (targetScale - videoScale.value) * lerpFactor;

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

		// Scale transformasyonu uygula
		ctx.translate(transformOriginX, transformOriginY);
		ctx.scale(videoScale.value, videoScale.value);
		ctx.translate(-transformOriginX, -transformOriginY);
	}

	// Shadow için yeni bir state kaydet
	if (shadowSize.value > 0) {
		ctx.save();
		ctx.beginPath();
		useRoundRect(ctx, x, y, drawWidth, drawHeight, radius.value);
		ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
		ctx.shadowBlur = shadowSize.value;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;
		ctx.fillStyle = backgroundColor.value;
		ctx.fill();
		ctx.restore();
	}

	// Video alanını kırp ve radius uygula
	ctx.beginPath();
	useRoundRect(ctx, x, y, drawWidth, drawHeight, radius.value);
	ctx.clip();

	// Video'yu yüksek kalitede çiz
	ctx.drawImage(
		videoElement,
		0,
		0,
		videoElement.videoWidth,
		videoElement.videoHeight,
		x,
		y,
		drawWidth,
		drawHeight
	);

	// Ana context state'i geri yükle
	ctx.restore();

	// Mouse pozisyonlarını çiz
	let currentMouseX, currentMouseY;
	if (props.mousePositions && props.mousePositions.length > 0) {
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

		// Video koordinatlarından canvas koordinatlarına çevir
		const canvasX = (interpolatedX / videoElement.videoWidth) * drawWidth + x;
		const canvasY = (interpolatedY / videoElement.videoHeight) * drawHeight + y;

		// Zoom durumunda pozisyonu ayarla
		if (videoScale.value > 1.001) {
			const centerX = x + drawWidth / 2;
			const centerY = y + drawHeight / 2;
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

			// Zoom'u hesaba katarak pozisyonu güncelle
			currentMouseX =
				transformOriginX + (canvasX - transformOriginX) * videoScale.value;
			currentMouseY =
				transformOriginY + (canvasY - transformOriginY) * videoScale.value;
		} else {
			currentMouseX = canvasX;
			currentMouseY = canvasY;
		}

		// Mouse cursor'ı çiz
		drawMouseCursor(
			ctx,
			videoElement.currentTime,
			props.mousePositions,
			canvasRef.value,
			videoElement,
			padding.value,
			videoScale.value,
			zoomRanges.value,
			lastZoomPosition,
			mouseSize.value,
			mouseMotionEnabled.value,
			motionBlurValue.value
		);
	}

	// Kamera çizimi
	if (cameraElement) {
		let cameraPos;
		if (isCameraDragging.value) {
			cameraPos = cameraPosition.value;
		} else if (
			cameraSettings.value.followMouse &&
			currentMouseX !== undefined &&
			currentMouseY !== undefined
		) {
			// Mouse'dan Y ekseninde 150px aşağıya kaydır
			// camera offset
			const offsetY = 50;

			// Hedef pozisyonu hesapla
			const targetX = currentMouseX;
			const targetY = currentMouseY + offsetY;

			// Smooth geçiş için lerp uygula
			const ease = 0.1; // Düşük değer daha yavaş geçiş
			lastCameraX.value += (targetX - lastCameraX.value) * ease;
			lastCameraY.value += (targetY - lastCameraY.value) * ease;

			cameraPos = { x: lastCameraX.value, y: lastCameraY.value };
		}

		drawCamera(
			ctx,
			cameraElement,
			canvasRef.value.width,
			canvasRef.value.height,
			1,
			mouseX,
			mouseY,
			cameraPos
		);
	}

	animationFrame = requestAnimationFrame(updateCanvas);
};

// Arkaplan rengi değiştiğinde canvas'ı güncelle
watch(backgroundColor, () => {
	if (!ctx || !canvasRef.value) return;
	ctx.fillStyle = backgroundColor.value;
	ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);
	if (videoElement && !videoState.value.isPlaying) {
		requestAnimationFrame(updateCanvas);
	}
});

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
		videoElement.preload = "auto";
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
		videoElement.setAttribute("preload", "auto");
		videoElement.setAttribute("poster", "");

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
		videoElement.load();
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
			// Video daha geniş, genişliğe göre ölçekle
			canvasWidth = containerWidth;
			canvasHeight = containerWidth / videoRatio;
		} else {
			// Video daha dar, yüksekliğe göre ölçekle
			canvasHeight = containerHeight;
			canvasWidth = containerHeight * videoRatio;
		}

		// Canvas boyutlarını güncelle
		canvasRef.value.width = canvasWidth;
		canvasRef.value.height = canvasHeight;

		// Canvas stil boyutlarını ayarla (CSS pixels)
		canvasRef.value.style.width = `${canvasWidth}px`;
		canvasRef.value.style.height = `${canvasHeight}px`;

		// Canvas kalite ayarları
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";

		// Canvas transform ayarları
		ctx.setTransform(1, 0, 0, 1, 0, 0);

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
		updateCanvas(performance.now());

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
	} catch (error) {
		console.error("[MediaPlayer] Metadata yükleme hatası:", error);
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
	videoState.value.isPlaying = true;
	videoState.value.isPaused = false;
	if (!animationFrame) {
		animationFrame = requestAnimationFrame(updateCanvas);
	}
	emit("play", videoState.value);
};

const onVideoPause = () => {
	videoState.value.isPlaying = false;
	videoState.value.isPaused = true;
	if (animationFrame) {
		cancelAnimationFrame(animationFrame);
		animationFrame = null;
	}
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
	getVideoElement: () => videoElement,

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
});

// cropRatio değişikliğini izle
watch(cropRatio, (newRatio) => {
	if (!videoElement) return;

	if (!newRatio || newRatio === "auto") {
		// Auto seçildiğinde orijinal boyutları kullan
		cropArea.value = {
			x: 0,
			y: 0,
			width: videoElement.videoWidth,
			height: videoElement.videoHeight,
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
			};
		} else {
			// Video daha dar, genişliği kullan
			const newHeight = videoElement.videoWidth / targetRatio;
			cropArea.value = {
				x: 0,
				y: (videoElement.videoHeight - newHeight) / 2,
				width: videoElement.videoWidth,
				height: newHeight,
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
	const rect = canvasRef.value.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;

	if (isMouseOverCamera.value && !cameraSettings.value.followMouse) {
		startCameraDrag(e, lastCameraPosition.value);
	}
};

const handleMouseMove = (e) => {
	const rect = canvasRef.value.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;

	// Canvas'ı güncelle
	requestAnimationFrame(() => {
		updateCanvas(performance.now(), mouseX, mouseY);
	});
};

const handleMouseUp = () => {
	if (isCameraDragging.value) {
		stopCameraDrag();
	}
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
