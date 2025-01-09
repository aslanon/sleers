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
				<canvas ref="canvasRef" class="absolute inset-0 w-full h-full"></canvas>
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
import cursorSvg from "~/assets/cursors/default.svg";
import { useVideoZoom } from "~/composables/useVideoZoom";

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
	audioUrl: {
		type: String,
		default: "",
	},
	videoType: {
		type: String,
		default: "video/mp4",
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
	mouseSize,
	motionBlurValue,
	mouseMotionEnabled,
	backgroundColor,
	padding,
	radius,
	shadowSize,
	cropRatio,
	zoomRanges,
	currentZoomRange,
	MOTION_BLUR_CONSTANTS,
	setCurrentZoomRange,
} = usePlayerSettings();

// Referanslar
const containerRef = ref(null);
const canvasRef = ref(null);
const audioRef = ref(null);
const videoRef = ref(null);

// Context
let ctx = null;

// Video objesi
let videoElement = null;

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

// Video zaman güncelleme
const handleTimeUpdate = () => {
	if (!videoElement) return;

	const currentTime = videoElement.currentTime;

	if (isPlayingSegments.value && props.segments && props.segments.length > 0) {
		const currentSegment = props.segments[currentSegmentIndex.value];
		if (!currentSegment) return;

		const segmentEnd = currentSegment.end || currentSegment.endTime || 0;
		const segmentStart = currentSegment.start || currentSegment.startTime || 0;

		// Eğer segment dışına çıktıysa
		if (currentTime < segmentStart || currentTime >= segmentEnd) {
			// Sonraki segmente geç
			if (currentSegmentIndex.value < props.segments.length - 1) {
				currentSegmentIndex.value++;
				const nextSegment = props.segments[currentSegmentIndex.value];
				videoElement.currentTime =
					nextSegment.start || nextSegment.startTime || 0;
			} else {
				// Tüm segmentler tamamlandı
				isPlayingSegments.value = false;
				videoElement.pause();
				currentSegmentIndex.value = 0;
				emit("videoEnded");
			}
		}
	}

	emit("timeUpdate", currentTime);
};

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
	if (!containerRef.value || !videoElement) return;

	const container = containerRef.value.getBoundingClientRect();
	const containerRatio = container.width / container.height;

	// Canvas boyutlarını seçilen aspect ratio'ya göre ayarla
	let canvasWidth, canvasHeight;

	if (!cropRatio.value || cropRatio.value === "auto") {
		// Auto modunda container boyutlarını kullan
		canvasWidth = container.width;
		canvasHeight = container.height;
	} else {
		// Seçilen aspect ratio'yu kullan
		const [targetWidth, targetHeight] = cropRatio.value.split(":").map(Number);
		const targetRatio = targetWidth / targetHeight;

		if (containerRatio > targetRatio) {
			// Container daha geniş, yüksekliğe göre hesapla
			canvasHeight = container.height;
			canvasWidth = canvasHeight * targetRatio;
		} else {
			// Container daha dar, genişliğe göre hesapla
			canvasWidth = container.width;
			canvasHeight = canvasWidth / targetRatio;
		}
	}

	// Canvas boyutlarını güncelle
	if (canvasRef.value) {
		canvasRef.value.width = canvasWidth;
		canvasRef.value.height = canvasHeight;
	}

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
	if (!containerRef.value || !videoElement) return;

	const container = containerRef.value.getBoundingClientRect();

	let canvasWidth, canvasHeight;
	const containerRatio = container.width / container.height;

	if (!cropRatio.value || cropRatio.value === "auto") {
		// Auto modunda video'nun orijinal en-boy oranını kullan
		const videoRatio = videoElement.videoWidth / videoElement.videoHeight;
		console.log(
			"[MediaPlayer] Aspect ratio changed:",
			`${videoElement.videoWidth}:${videoElement.videoHeight}`
		);

		if (videoRatio > containerRatio) {
			// Video daha geniş, genişliğe göre ölçekle
			canvasWidth = container.width;
			canvasHeight = container.width / videoRatio;
		} else {
			// Video daha dar, yüksekliğe göre ölçekle
			canvasHeight = container.height;
			canvasWidth = container.height * videoRatio;
		}
	} else {
		// Seçilen aspect ratio'yu al
		const [targetWidth, targetHeight] = cropRatio.value.split(":").map(Number);
		const targetRatio = targetWidth / targetHeight;
		console.log("[MediaPlayer] Aspect ratio changed:", cropRatio.value);

		if (containerRatio > targetRatio) {
			// Container daha geniş, yüksekliğe göre hesapla
			canvasHeight = container.height;
			canvasWidth = canvasHeight * targetRatio;
		} else {
			// Container daha dar, genişliğe göre hesapla
			canvasWidth = container.width;
			canvasHeight = canvasWidth / targetRatio;
		}
	}

	// Kırpma alanını güncelle (canvas boyutları)
	cropArea.value = {
		width: canvasWidth,
		height: canvasHeight,
		x: 0,
		y: 0,
	};

	// Canvas boyutlarını güncelle
	if (canvasRef.value) {
		canvasRef.value.width = canvasWidth;
		canvasRef.value.height = canvasHeight;
	}

	// Canvas'ı güncelle
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
	selectedAspectRatio.value = ratio;
	updateCropArea();
	// Hemen canvas'ı güncelle
	requestAnimationFrame(() => {
		updateCanvas(performance.now());
	});
};

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

// Canvas güncelleme fonksiyonu
const updateCanvas = (timestamp) => {
	if (!videoElement || !ctx || !canvasRef.value) return;

	// FPS kontrolü
	if (timestamp - lastFrameTime < frameInterval) {
		animationFrame = requestAnimationFrame(updateCanvas);
		return;
	}

	lastFrameTime = timestamp;

	// Canvas'ı temizle
	ctx.fillStyle = backgroundColor.value;
	ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);

	// Ana context state'i kaydet
	ctx.save();

	// Video'nun orijinal en-boy oranını koru
	const videoRatio = videoElement.videoWidth / videoElement.videoHeight;
	const canvasRatio = canvasRef.value.width / canvasRef.value.height;

	// Padding'i hesaba katarak video boyutlarını hesapla
	let drawWidth, drawHeight;
	if (videoRatio > canvasRatio) {
		drawWidth = canvasRef.value.width - padding.value * 2;
		drawHeight = drawWidth / videoRatio;
	} else {
		drawHeight = canvasRef.value.height - padding.value * 2;
		drawWidth = drawHeight * videoRatio;
	}

	// Video'yu canvas'ın ortasına yerleştir
	const x = (canvasRef.value.width - drawWidth) / 2;
	const y = (canvasRef.value.height - drawHeight) / 2;

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
		const centerX = canvasRef.value.width / 2;
		const centerY = canvasRef.value.height / 2;

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

	// Video'yu çiz
	ctx.drawImage(videoElement, x, y, drawWidth, drawHeight);

	// Ana context state'i geri yükle
	ctx.restore();

	// Mouse pozisyonlarını çiz
	if (props.mousePositions && props.mousePositions.length > 0) {
		drawMousePosition(ctx, videoElement.currentTime);
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
	},
	{ immediate: true }
);

// Mouse positions değişikliğini izle ve previousPositions'ı temizle
watch(
	() => props.mousePositions,
	() => {
		previousPositions.value = []; // Trail'i temizle
	},
	{ deep: true }
);

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
		videoElement.crossOrigin = "anonymous";
		videoElement.muted = !props.systemAudioEnabled;
		videoElement.playsInline = true;
		videoElement.preload = "auto";
		videoElement.volume = videoState.value.volume;
		videoElement.playbackRate = videoState.value.playbackRate;

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

		console.log("[MediaPlayer] Video element oluşturuldu ve yükleniyor:", {
			src: videoElement.src,
			readyState: videoElement.readyState,
			networkState: videoElement.networkState,
		});
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
			desynchronized: true,
			willReadFrequently: false,
		});

		// Render kalitesi ayarları
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";

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

			console.log("[MediaPlayer] Video metadata yüklendi:", {
				width: videoElement.videoWidth,
				height: videoElement.videoHeight,
				duration,
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
	if (videoElement) {
		videoElement.addEventListener("timeupdate", handleTimeUpdate);
	}
	if (videoRef.value && canvasRef.value) {
		renderVideo();
	}
});

onUnmounted(() => {
	if (videoElement) {
		// Kayıtlı removeEvents fonksiyonunu çağır
		if (videoElement._removeEvents) {
			videoElement._removeEvents();
		}
		videoElement.src = "";
		videoElement = null;
	}

	window.removeEventListener("resize", handleResize);

	if (animationFrame) {
		cancelAnimationFrame(animationFrame);
		animationFrame = null;
	}

	if (videoElement) {
		videoElement.removeEventListener("timeupdate", handleTimeUpdate);
	}

	// Video ve canvas referanslarını temizle
	videoRef.value = null;
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

	// Canvas boyutlarını ayarla
	canvas.width = containerRef.value.clientWidth;
	canvas.height = containerRef.value.clientHeight;

	// Videoyu çiz
	ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

	// Bir sonraki frame'i iste
	requestAnimationFrame(renderVideo);
};

// Component metodlarını dışa aktar
defineExpose({
	// Playback controls
	play,
	pause,
	seek: (time) => {
		if (!videoElement) return;
		videoElement.currentTime = time;
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
		}
	},
	off: (event, handler) => {
		if (event === "videoEnded" && videoElement) {
			videoElement.removeEventListener("ended", handler);
		}
	},
});

// Mouse animasyonu için state
const previousPositions = ref([]);

// Cursor image yönetimi
const cursorImage = Object.assign(new Image(), {
	src: cursorSvg,
	onload: () => console.log("[MediaPlayer] Cursor image loaded successfully"),
	onerror: (error) =>
		console.error("[MediaPlayer] Cursor image loading error:", error),
});

// Motion blur fonksiyonu
const applyMotionBlur = (
	ctx,
	cursorImage,
	x,
	y,
	dirX,
	dirY,
	speed,
	moveDistance
) => {
	const {
		MIN_SPEED_THRESHOLD,
		MAX_SPEED,
		MIN_DISTANCE_THRESHOLD,
		TRAIL_STEPS,
		TRAIL_OPACITY_BASE,
		TRAIL_OFFSET_MULTIPLIER,
		BLUR_BASE,
		MOVEMENT_ANGLE,
		SKEW_FACTOR,
		STRETCH_FACTOR,
	} = MOTION_BLUR_CONSTANTS;

	// Mouse boyutunu kesinlikle sabit tut
	const size = mouseSize.value;
	const offsetX = size * 0.3;
	const offsetY = size * 0.2;

	// Zoom durumunda scale'i kompanse et
	if (videoScale.value > 1.001) {
		ctx.save();
		const scale = videoScale.value;
		ctx.scale(scale, scale);
		x = x / scale;
		y = y / scale;
	}

	// Hız ve mesafe kontrolü
	const isSignificantMovement =
		speed > MIN_SPEED_THRESHOLD && moveDistance > MIN_DISTANCE_THRESHOLD;

	if (!mouseMotionEnabled.value || !isSignificantMovement) {
		ctx.drawImage(cursorImage, x - offsetX, y - offsetY, size, size);
		if (videoScale.value > 1.001) {
			ctx.restore();
		}
		return;
	}

	const easeOutQuad = (t) => t * (2 - t);

	const normalizedSpeed = Math.min(
		(speed - MIN_SPEED_THRESHOLD) / (MAX_SPEED - MIN_SPEED_THRESHOLD),
		1
	);
	const normalizedDistance = Math.min(moveDistance / 100, 1);
	const movementIntensity = normalizedSpeed * normalizedDistance;
	const easedIntensity = easeOutQuad(movementIntensity);
	const deformAmount = Math.min(6, easedIntensity * motionBlurValue.value * 6);

	// Trail efekti
	for (let i = TRAIL_STEPS; i > 0; i--) {
		const trailOpacity = (i / TRAIL_STEPS) * TRAIL_OPACITY_BASE;
		const trailOffset = i * TRAIL_OFFSET_MULTIPLIER;

		ctx.globalAlpha = trailOpacity;
		ctx.filter = `blur(${BLUR_BASE}px)`;
		ctx.drawImage(
			cursorImage,
			x + dirX * trailOffset - offsetX,
			y + dirY * trailOffset - offsetY,
			size,
			size
		);
	}

	// Ana cursor için normal efektleri uygula
	ctx.globalAlpha = 1;
	const blurAmount = Math.min(1.5, easedIntensity * 5);
	ctx.filter = `blur(${blurAmount}px)`;

	ctx.translate(x, y);

	// Hareket yönüne doğru eğim uygula
	if (moveDistance > 25) {
		const angle = Math.atan2(dirY, dirX);
		const rotationDegree = MOVEMENT_ANGLE * (Math.PI / 180);
		ctx.rotate(angle * 0.05 + rotationDegree * easedIntensity);
	}

	const skewX = -dirX * deformAmount * SKEW_FACTOR;
	const skewY = -dirY * deformAmount * SKEW_FACTOR;
	const stretchX =
		1 + Math.abs(dirX * deformAmount * STRETCH_FACTOR) * easedIntensity;
	const stretchY =
		1 + Math.abs(dirY * deformAmount * STRETCH_FACTOR) * easedIntensity;

	ctx.scale(stretchX, stretchY);
	ctx.transform(1, skewY, skewX, 1, 0, 0);

	ctx.drawImage(cursorImage, -offsetX, -offsetY, size, size);

	if (videoScale.value > 1.001) {
		ctx.restore();
	}

	ctx.restore();
};

// Mouse pozisyonunu çiz
const drawMousePosition = (ctx, currentTime) => {
	const mousePos = props.mousePositions;
	if (
		!mousePos ||
		mousePos.length === 0 ||
		!canvasRef.value ||
		!videoElement ||
		!cursorImage.complete
	)
		return;

	// Video süresini al
	const videoDuration = videoElement.duration;
	if (!videoDuration) return;

	// Mouse pozisyonları için toplam frame sayısı
	const totalFrames = mousePos.length;
	const frameTime = videoDuration / totalFrames;
	const exactFrame = currentTime / frameTime;
	const currentFrame = Math.floor(exactFrame);
	const nextFrame = Math.min(currentFrame + 1, totalFrames - 1);
	const framePart = exactFrame - currentFrame;

	// İki frame arasında interpolasyon yap
	const currentPos = mousePos[currentFrame];
	const nextPos = mousePos[nextFrame];
	if (!currentPos || !nextPos) return;

	// Video boyutlarını al
	const videoWidth = videoElement.videoWidth;
	const videoHeight = videoElement.videoHeight;

	// Canvas boyutlarını al
	const canvas = canvasRef.value;
	const canvasWidth = canvas.width;
	const canvasHeight = canvas.height;

	// Video'nun canvas içindeki boyutlarını ve pozisyonunu hesapla
	const videoRatio = videoWidth / videoHeight;
	const canvasRatio = canvasWidth / canvasHeight;
	let displayWidth, displayHeight;

	if (videoRatio > canvasRatio) {
		displayWidth = canvasWidth - padding.value * 2;
		displayHeight = displayWidth / videoRatio;
	} else {
		displayHeight = canvasHeight - padding.value * 2;
		displayWidth = displayHeight * videoRatio;
	}

	// Video'nun canvas içindeki pozisyonunu hesapla (padding dahil)
	const videoX = (canvasWidth - displayWidth) / 2;
	const videoY = (canvasHeight - displayHeight) / 2;

	// İki pozisyon arasında cubic interpolasyon yap
	const t = framePart;
	const t2 = t * t;
	const t3 = t2 * t;
	const interpolatedX =
		currentPos.x + (nextPos.x - currentPos.x) * (3 * t2 - 2 * t3);
	const interpolatedY =
		currentPos.y + (nextPos.y - currentPos.y) * (3 * t2 - 2 * t3);

	// Video içindeki oransal pozisyonu hesapla (0-1 arası)
	const normalizedX = interpolatedX / videoWidth;
	const normalizedY = interpolatedY / videoHeight;

	// Mouse'un temel pozisyonunu hesapla
	let finalX = videoX + normalizedX * displayWidth;
	let finalY = videoY + normalizedY * displayHeight;

	// Zoom durumunda pozisyonu ayarla
	const centerX = canvasWidth / 2;
	const centerY = canvasHeight / 2;
	let originX = centerX;
	let originY = centerY;

	// Zoom origin noktasını belirle
	const activeZoom = zoomRanges.value.find(
		(range) => currentTime >= range.start && currentTime <= range.end
	);

	// Son zoom pozisyonunu kaydet
	if (activeZoom?.position) {
		switch (activeZoom.position) {
			case "top-left":
				originX = videoX;
				originY = videoY;
				break;
			case "top-center":
				originX = centerX;
				originY = videoY;
				break;
			case "top-right":
				originX = videoX + displayWidth;
				originY = videoY;
				break;
			case "middle-left":
				originX = videoX;
				originY = centerY;
				break;
			case "middle-right":
				originX = videoX + displayWidth;
				originY = centerY;
				break;
			case "bottom-left":
				originX = videoX;
				originY = videoY + displayHeight;
				break;
			case "bottom-center":
				originX = centerX;
				originY = videoY + displayHeight;
				break;
			case "bottom-right":
				originX = videoX + displayWidth;
				originY = videoY + displayHeight;
				break;
		}
		lastZoomPosition.value = activeZoom.position;
	} else if (lastZoomPosition.value) {
		// Zoom devreden çıkarken son pozisyonu kullan
		switch (lastZoomPosition.value) {
			case "top-left":
				originX = videoX;
				originY = videoY;
				break;
			case "top-center":
				originX = centerX;
				originY = videoY;
				break;
			case "top-right":
				originX = videoX + displayWidth;
				originY = videoY;
				break;
			case "middle-left":
				originX = videoX;
				originY = centerY;
				break;
			case "middle-right":
				originX = videoX + displayWidth;
				originY = centerY;
				break;
			case "bottom-left":
				originX = videoX;
				originY = videoY + displayHeight;
				break;
			case "bottom-center":
				originX = centerX;
				originY = videoY + displayHeight;
				break;
			case "bottom-right":
				originX = videoX + displayWidth;
				originY = videoY + displayHeight;
				break;
		}
	}

	// Mouse pozisyonunu zoom origin'e göre ayarla
	const relativeX = finalX - originX;
	const relativeY = finalY - originY;

	// Zoom geçişlerinde smooth pozisyon hesaplama
	const currentScale = videoScale.value;
	const targetScale = activeZoom ? activeZoom.scale : 1;
	const lerpFactor = 0.1; // Zoom ile aynı lerp faktörü

	// Scale değişimini smooth yap
	const smoothScale = currentScale + (targetScale - currentScale) * lerpFactor;

	// Pozisyonu smooth scale ile hesapla
	finalX = originX + relativeX * smoothScale;
	finalY = originY + relativeY * smoothScale;

	// Mouse hızını ve yönünü hesapla
	const moveX = nextPos.x - currentPos.x;
	const moveY = nextPos.y - currentPos.y;
	const speed = Math.sqrt(moveX * moveX + moveY * moveY);
	const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY);

	// Hareket yönünü hesapla ve normalize et
	const dirX = speed > 0 ? moveX / speed : 0;
	const dirY = speed > 0 ? moveY / speed : 0;

	ctx.save();

	// Motion blur efektini uygula
	applyMotionBlur(
		ctx,
		cursorImage,
		finalX,
		finalY,
		dirX,
		dirY,
		speed,
		moveDistance
	);

	ctx.restore();
};

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
</script>

<style scoped>
canvas {
	image-rendering: optimizeQuality;
	-webkit-backface-visibility: hidden;
	backface-visibility: hidden;
}
</style>
