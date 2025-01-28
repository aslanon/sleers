<template>
	<div
		class="media-player w-full h-full rounded-lg overflow-hidden bg-black/80"
		@togglePlayback="togglePlay"
	>
		<div
			ref="containerRef"
			class="relative w-full h-full overflow-hidden flex items-center justify-center"
		>
			<div class="relative w-full h-full">
				<canvas
					id="canvasID"
					ref="canvasRef"
					class="w-full m-auto h-full object-contain"
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
	videoCrop,
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
	dragOffset,
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
	if (videoRatio > containerRatio) {
		// Video daha geniş, genişliğe göre ölçekle
		canvasWidth = containerWidth;
		canvasHeight = containerWidth / videoRatio;
	} else {
		// Video daha dar, yüksekliğe göre ölçekle
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

	// Canvas transform ayarları
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	// Canvas'ı hemen güncelle
	requestAnimationFrame(() => updateCanvas(performance.now()));
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
	const dpr = window.devicePixelRatio || 1;
	canvasRef.value.width = canvasWidth * dpr * scaleValue;
	canvasRef.value.height = canvasHeight * dpr * scaleValue;

	// Canvas stil boyutlarını ayarla (CSS pixels)
	canvasRef.value.style.width = `${canvasWidth}px`;
	canvasRef.value.style.height = `${canvasHeight}px`;

	// Canvas transform ayarları
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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
const updateCanvas = (timestamp, mouseX, mouseY) => {
	if (!videoElement || !ctx || !canvasRef.value) return;

	// FPS kontrolü
	if (timestamp - lastFrameTime < frameInterval) {
		animationFrame = requestAnimationFrame((t) =>
			updateCanvas(t, mouseX, mouseY)
		);
		return;
	}

	lastFrameTime = timestamp;

	// DPR'ı al
	const dpr = window.devicePixelRatio || 1;

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

			// Blur efekti için yeni bir canvas oluştur
			const tempCanvas = document.createElement("canvas");
			const tempCtx = tempCanvas.getContext("2d");
			tempCanvas.width = canvasRef.value.width;
			tempCanvas.height = canvasRef.value.height;

			// Önce geçici canvas'a resmi çiz
			tempCtx.drawImage(bgImageElement.value, x, y, scaledWidth, scaledHeight);

			// Blur efektini uygula
			if (backgroundBlur.value > 0) {
				ctx.filter = `blur(${backgroundBlur.value}px)`;
			}

			// Blur'lu resmi ana canvas'a çiz
			ctx.drawImage(tempCanvas, 0, 0);

			// Filtre ayarlarını sıfırla
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

	// Video'yu canvas'a sığdırırken aspect ratio'yu koru
	let drawWidth, drawHeight, x, y;
	let sourceX, sourceY, sourceWidth, sourceHeight;

	// Önce padding'i hesaba kat
	const availableWidth = canvasRef.value.width - padding.value * 2 * dpr;
	const availableHeight = canvasRef.value.height - padding.value * 2 * dpr;

	// Video'nun orijinal boyutları
	const videoWidth = videoElement.videoWidth;
	const videoHeight = videoElement.videoHeight;
	const originalVideoRatio = videoWidth / videoHeight;

	// Seçilen aspect ratio'ya göre boyutları hesapla
	if (videoCrop.value.aspectRatio === "original") {
		// Orijinal video oranını kullan
		sourceX = 0;
		sourceY = 0;
		sourceWidth = videoWidth;
		sourceHeight = videoHeight;

		if (originalVideoRatio > availableWidth / availableHeight) {
			drawWidth = availableWidth;
			drawHeight = drawWidth / originalVideoRatio;
		} else {
			drawHeight = availableHeight;
			drawWidth = drawHeight * originalVideoRatio;
		}
	} else {
		// Seçilen aspect ratio'yu kullan
		const [widthRatio, heightRatio] = videoCrop.value.aspectRatio
			.split(":")
			.map(Number);
		const targetRatio = widthRatio / heightRatio;

		if (originalVideoRatio > targetRatio) {
			// Video daha geniş, yükseklikten kırp
			sourceHeight = videoHeight;
			sourceWidth = videoHeight * targetRatio;
			sourceY = 0;
			sourceX = (videoWidth - sourceWidth) / 2 + videoDragOffset.value.x;
		} else {
			// Video daha dar, genişlikten kırp
			sourceWidth = videoWidth;
			sourceHeight = videoWidth / targetRatio;
			sourceX = 0;
			sourceY = (videoHeight - sourceHeight) / 2 + videoDragOffset.value.y;
		}

		// Çizim boyutlarını hesapla
		if (targetRatio > availableWidth / availableHeight) {
			drawWidth = availableWidth;
			drawHeight = drawWidth / targetRatio;
		} else {
			drawHeight = availableHeight;
			drawWidth = drawHeight * targetRatio;
		}
	}

	// Pozisyonu ortala
	x = padding.value * dpr + (availableWidth - drawWidth) / 2;
	y = padding.value * dpr + (availableHeight - drawHeight) / 2;

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
		useRoundRect(ctx, x, y, drawWidth, drawHeight, radius.value * dpr);
		ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
		ctx.shadowBlur = shadowSize.value * dpr;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;
		ctx.fillStyle = backgroundColor.value;
		ctx.fill();
		ctx.restore();
	}

	// Video alanını kırp ve radius uygula
	if (radius.value > 0) {
		ctx.beginPath();
		useRoundRect(ctx, x, y, drawWidth, drawHeight, radius.value * dpr);
		ctx.clip();
	}

	// Video'yu yüksek kalitede çiz
	ctx.drawImage(
		videoElement,
		sourceX,
		sourceY,
		sourceWidth,
		sourceHeight,
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

		// DPR'ı hesaba kat
		currentMouseX *= dpr;
		currentMouseY *= dpr;

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

		// Kamera pozisyonunu güncelle
		if (cameraElement && cameraSettings.value.followMouse) {
			// Kamera için offset değerleri
			const offsetX = 0; // X ekseninde offset
			const offsetY = 50 * dpr * scaleValue; // Y ekseninde offset

			// Hedef pozisyonu hesapla (mouse pozisyonuna göre)
			const targetX = currentMouseX + offsetX;
			const targetY = currentMouseY + offsetY;

			// Smooth geçiş için lerp faktörü (0-1 arası)
			const lerpFactor = 0.15; // Daha yumuşak hareket için düşük değer

			// Lerp ile yumuşak geçiş uygula
			if (!lastCameraX.value) lastCameraX.value = targetX;
			if (!lastCameraY.value) lastCameraY.value = targetY;

			lastCameraX.value += (targetX - lastCameraX.value) * lerpFactor;
			lastCameraY.value += (targetY - lastCameraY.value) * lerpFactor;

			// Kamera pozisyonunu güncelle
			lastCameraPosition.value = {
				x: lastCameraX.value,
				y: lastCameraY.value,
			};
		}
	}

	// Kamera çizimi
	if (cameraElement) {
		let cameraPos;
		if (isCameraDragging.value) {
			cameraPos = cameraPosition.value;
		} else if (cameraSettings.value.followMouse && lastCameraPosition.value) {
			cameraPos = lastCameraPosition.value;
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

	animationFrame = requestAnimationFrame((t) =>
		updateCanvas(t, mouseX, mouseY)
	);
};

// Watch videoCrop changes
watch(
	() => videoCrop.value,
	() => {
		if (!videoElement || !canvasRef.value) return;
		requestAnimationFrame(() => updateCanvas(performance.now()));
	},
	{ deep: true }
);

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

		// İlk frame'i çiz
		requestAnimationFrame(() => updateCanvas(performance.now()));
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
			alpha: true,
			desynchronized: false,
			willReadFrequently: false,
			preserveDrawingBuffer: true,
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

	// Event listener'ları ekle
	if (canvasRef.value) {
		canvasRef.value.addEventListener("mousedown", handleMouseDown);
		canvasRef.value.addEventListener("mousemove", handleMouseMove);
	}
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

	// Event listener'ları temizle
	if (canvasRef.value) {
		canvasRef.value.removeEventListener("mousedown", handleMouseDown);
		canvasRef.value.removeEventListener("mousemove", handleMouseMove);
	}
	window.removeEventListener("mousemove", handleCameraDrag);
	window.removeEventListener("mousemove", handleVideoMouseMove);
	window.removeEventListener("mouseup", handleMouseUp);

	videoRef.value = null;
	cameraRef.value = null;
	canvasRef.value = null;
	cleanupZoom();
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

	// Eğer kamera üzerindeyse ve takip modu kapalıysa kamerayı sürükle
	if (isMouseOverCamera.value && !cameraSettings.value.followMouse) {
		e.preventDefault();
		e.stopPropagation();
		startCameraDrag(e, lastCameraPosition.value, mouseX, mouseY);
	}
};

const handleCameraDrag = (e) => {
	if (!canvasRef.value || !isCameraDragging.value) return;

	e.preventDefault();
	e.stopPropagation();

	const rect = canvasRef.value.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	const mouseX = (e.clientX - rect.left) * dpr * scaleValue;
	const mouseY = (e.clientY - rect.top) * dpr * scaleValue;

	// Mouse pozisyonundan offset'i çıkararak kamera pozisyonunu güncelle
	const newPosition = {
		x: mouseX - dragOffset.value.x,
		y: mouseY - dragOffset.value.y,
	};

	// Sınırları kontrol et
	const canvas = canvasRef.value;
	const cameraSize = (canvas.width * cameraSettings.value.size) / 100;

	newPosition.x = Math.max(
		-cameraSize / 2,
		Math.min(canvas.width - cameraSize / 2, newPosition.x)
	);
	newPosition.y = Math.max(
		-cameraSize / 2,
		Math.min(canvas.height - cameraSize / 2, newPosition.y)
	);

	lastCameraPosition.value = newPosition;

	// Canvas'ı güncelle
	requestAnimationFrame(() => updateCanvas(performance.now()));
};

const handleMouseMove = (e) => {
	if (!canvasRef.value) return;

	const rect = canvasRef.value.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	const mouseX = (e.clientX - rect.left) * dpr * scaleValue;
	const mouseY = (e.clientY - rect.top) * dpr * scaleValue;

	// Canvas'ı güncelle
	requestAnimationFrame(() => {
		updateCanvas(performance.now(), mouseX, mouseY);
	});
};

const handleMouseUp = () => {
	if (isCameraDragging.value) {
		stopCameraDrag();
		window.removeEventListener("mousemove", handleCameraDrag);
		window.removeEventListener("mouseup", handleMouseUp);
	}
};

// Video drag state'leri
const isDraggingVideo = ref(false);
const dragStartPos = ref({ x: 0, y: 0 });
const videoDragOffset = ref({ x: 0, y: 0 });

// Video drag handlers
const handleVideoMouseDown = (e) => {
	// Kamera sürükleniyorsa video sürüklemeyi engelle
	if (isCameraDragging.value) return;

	if (!videoElement || videoCrop.value.aspectRatio === "original") return;

	const rect = canvasRef.value.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	const mouseX = (e.clientX - rect.left) * dpr;
	const mouseY = (e.clientY - rect.top) * dpr;

	isDraggingVideo.value = true;
	dragStartPos.value = {
		x: mouseX - videoDragOffset.value.x,
		y: mouseY - videoDragOffset.value.y,
	};

	window.addEventListener("mousemove", handleVideoMouseMove);
	window.addEventListener("mouseup", handleVideoMouseUp);
};

const handleVideoMouseMove = (e) => {
	// Kamera sürüklenmeye başlarsa video sürüklemeyi durdur
	if (isCameraDragging.value) {
		handleVideoMouseUp();
		return;
	}

	if (!isDraggingVideo.value || !videoElement || !canvasRef.value) return;

	const rect = canvasRef.value.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	const mouseX = (e.clientX - rect.left) * dpr;
	const mouseY = (e.clientY - rect.top) * dpr;

	// Yeni offset'i hesapla
	const newOffsetX = mouseX - dragStartPos.value.x;
	const newOffsetY = mouseY - dragStartPos.value.y;

	// Video boyutlarını al
	const videoWidth = videoElement.videoWidth;
	const videoHeight = videoElement.videoHeight;

	// Seçilen aspect ratio'ya göre maksimum offset'leri hesapla
	const [widthRatio, heightRatio] = videoCrop.value.aspectRatio
		.split(":")
		.map(Number);
	const targetRatio = widthRatio / heightRatio;
	const originalRatio = videoWidth / videoHeight;

	let maxOffsetX = 0;
	let maxOffsetY = 0;

	if (originalRatio > targetRatio) {
		// Video daha geniş, yatayda sınırla
		maxOffsetX = (videoWidth - videoHeight * targetRatio) / 2;
		maxOffsetY = 0;
	} else {
		// Video daha dar, dikeyde sınırla
		maxOffsetX = 0;
		maxOffsetY = (videoHeight - videoWidth / targetRatio) / 2;
	}

	// Offset'leri sınırla
	videoDragOffset.value = {
		x: Math.max(-maxOffsetX, Math.min(maxOffsetX, newOffsetX)),
		y: Math.max(-maxOffsetY, Math.min(maxOffsetY, newOffsetY)),
	};

	// Canvas'ı güncelle
	requestAnimationFrame(() => updateCanvas(performance.now()));
};

const handleVideoMouseUp = () => {
	isDraggingVideo.value = false;
	window.removeEventListener("mousemove", handleVideoMouseMove);
	window.removeEventListener("mouseup", handleVideoMouseUp);
};

// Template'e event listener'ları ekle
onMounted(() => {
	if (canvasRef.value) {
		canvasRef.value.addEventListener("mousedown", handleVideoMouseDown);
	}
});

onUnmounted(() => {
	if (canvasRef.value) {
		canvasRef.value.removeEventListener("mousedown", handleVideoMouseDown);
	}
	window.removeEventListener("mousemove", handleVideoMouseMove);
	window.removeEventListener("mouseup", handleMouseUp);
});
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
