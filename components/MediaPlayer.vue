<template>
	<div class="media-player w-full rounded-lg overflow-hidden bg-black/80">
		<div
			ref="containerRef"
			class="relative w-full overflow-hidden flex items-center justify-center"
			:style="{
				aspectRatio: currentAspectRatio,
				maxHeight: '80vh',
			}"
		>
			<div
				class="relative"
				:style="{
					width: `${cropArea.width}px`,
					height: `${cropArea.height}px`,
				}"
			>
				<canvas
					ref="canvasRef"
					class="absolute inset-0 w-full h-full"
					:class="{ 'cursor-grab': !isDragging, 'cursor-grabbing': isDragging }"
					@mousedown="startDragging"
					@mousemove="onDragging"
					@mouseup="stopDragging"
					@mouseleave="stopDragging"
					@wheel="handleZoom"
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
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import cursorSvg from "~/assets/cursors/default.svg";
import { usePlayerSettings } from "~/composables/usePlayerSettings";

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
	backgroundColor,
	padding,
	radius,
	shadowSize,
	cropRatio,
} = usePlayerSettings();

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

// Referanslar
const containerRef = ref(null);
const canvasRef = ref(null);
const audioRef = ref(null);
const videoRef = ref(null);

// Context
let ctx = null;

// Video objesi
let videoElement = null;

// Render ve animasyon state'leri
const isPlaying = ref(false);
let animationFrame = null;
let lastFrameTime = 0;
const FPS = 60;
const frameInterval = 1000 / FPS;

// Transform ve kırpma state'leri
const position = ref({ x: 0, y: 0 });
const scale = ref(1);
const rotation = ref(0);
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const cropArea = ref({ x: 0, y: 0, width: 0, height: 0 });
const videoSize = ref({ width: 0, height: 0 });
const selectedAspectRatio = ref("");

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

// Add isPaused computed
const isPaused = computed(() => videoState.value.isPaused);

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
		// Önce mevcut durumu kontrol et
		if (videoState.value.isPlaying) {
			return;
		}

		// Mevcut zamanı koru
		const startTime = videoState.value.currentTime;

		// Video ve ses elementlerini başlat
		videoElement.currentTime = startTime;
		await Promise.all([
			videoElement.play(),
			audioRef.value ? audioRef.value.play() : Promise.resolve(),
		]);

		// State'i güncelle
		videoState.value.isPlaying = true;
		videoState.value.isPaused = false;

		if (!animationFrame) {
			animationFrame = requestAnimationFrame(updateCanvas);
		}
	} catch (error) {
		console.error("[MediaPlayer] Oynatma hatası:", error);
		// Hata durumunda state'i sıfırla
		videoState.value.isPlaying = false;
		videoState.value.isPaused = true;
		throw error;
	}
};

const pause = async () => {
	if (!videoElement) return;
	try {
		// Önce mevcut durumu kontrol et
		if (!videoState.value.isPlaying) {
			return;
		}

		// Video ve sesi durdur
		await Promise.all([
			videoElement.pause(),
			audioRef.value ? audioRef.value.pause() : Promise.resolve(),
		]);

		// State'i güncelle
		videoState.value.isPlaying = false;
		videoState.value.isPaused = true;

		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
			animationFrame = null;
		}
		updateCanvas(performance.now());
	} catch (error) {
		console.error("[MediaPlayer] Durdurma hatası:", error);
	}
};

// Tam ekran kontrolü
const toggleFullscreen = async (e) => {
	e.preventDefault();
	e.stopPropagation();

	try {
		if (!document.fullscreenElement) {
			await containerRef.value.requestFullscreen();
			videoState.value.isFullscreen = true;
		} else {
			await document.exitFullscreen();
			videoState.value.isFullscreen = false;
		}
	} catch (error) {
		console.error("[MediaPlayer] Tam ekran hatası:", error);
	}
};

// Video zamanı güncellendiğinde
const onTimeUpdate = () => {
	if (!videoElement) return;

	// Sadece video oynatılıyorsa zamanı güncelle
	if (videoState.value.isPlaying) {
		const currentTime = videoElement.currentTime;
		videoState.value.currentTime = currentTime;

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
	const video = videoElement;

	// Kullanılabilir alanı hesapla (padding'i çıkar)
	const availableWidth = container.width - padding.value * 2;
	const availableHeight = container.height - padding.value * 2;

	// Container oranını hesapla
	const containerRatio = availableWidth / availableHeight;
	const videoRatio = video.videoWidth / video.videoHeight;

	let newScale;
	if (containerRatio > videoRatio) {
		// Container daha geniş, yüksekliğe göre ölçekle
		newScale = availableHeight / video.videoHeight;
	} else {
		// Container daha dar, genişliğe göre ölçekle
		newScale = availableWidth / video.videoWidth;
	}

	// Yeni ölçeği uygula
	scale.value = newScale;

	// Videoyu ortala (padding'i hesaba katarak)
	position.value = {
		x: (availableWidth - video.videoWidth * newScale) / 2,
		y: (availableHeight - video.videoHeight * newScale) / 2,
	};

	// Kırpma alanını güncelle
	updateCropArea();

	// Canvas'ı hemen güncelle
	requestAnimationFrame(() => updateCanvas(performance.now()));
};

// Kırpma alanını güncelle
const updateCropArea = () => {
	if (!containerRef.value || !videoElement) return;

	const container = containerRef.value.getBoundingClientRect();

	// Seçilen aspect ratio'yu al
	const [targetWidth, targetHeight] = cropRatio.value
		.split(":")
		.map(Number) || [16, 9];
	const targetRatio = targetWidth / targetHeight;

	// Mevcut container oranı
	const containerRatio = container.width / container.height;

	let cropWidth, cropHeight;

	if (containerRatio > targetRatio) {
		// Container daha geniş, yüksekliğe göre hesapla
		cropHeight = container.height;
		cropWidth = cropHeight * targetRatio;
	} else {
		// Container daha dar, genişliğe göre hesapla
		cropWidth = container.width;
		cropHeight = cropWidth / targetRatio;
	}

	// Kırpma alanını güncelle
	cropArea.value = {
		width: cropWidth,
		height: cropHeight,
		x: 0,
		y: 0,
	};

	// Video scale ve pozisyonunu güncelle
	const videoRatio = videoElement.videoWidth / videoElement.videoHeight;
	let newScale;

	// Padding'i hesaba katarak kullanılabilir alanı hesapla
	const availableWidth = cropWidth - padding.value * 2;
	const availableHeight = cropHeight - padding.value * 2;
	const availableRatio = availableWidth / availableHeight;

	if (videoRatio > availableRatio) {
		// Video daha geniş, yüksekliğe göre scale et
		newScale = availableHeight / videoElement.videoHeight;
	} else {
		// Video daha dar, genişliğe göre scale et
		newScale = availableWidth / videoElement.videoWidth;
	}

	scale.value = newScale;

	// Videoyu padding içinde ortala
	const scaledVideoWidth = videoElement.videoWidth * newScale;
	const scaledVideoHeight = videoElement.videoHeight * newScale;

	position.value = {
		x: padding.value + (availableWidth - scaledVideoWidth) / 2,
		y: padding.value + (availableHeight - scaledVideoHeight) / 2,
	};

	// Canvas boyutlarını güncelle
	if (canvasRef.value) {
		canvasRef.value.width = cropWidth;
		canvasRef.value.height = cropHeight;
	}

	// Canvas'ı güncelle
	requestAnimationFrame(() => updateCanvas(performance.now()));

	// Değişiklikleri emit et
	emit("cropChange", getCropData());
};

// Sürükleme işlemleri
const startDragging = (e) => {
	e.preventDefault();
	isDragging.value = true;
	dragStart.value = {
		x: e.clientX - position.value.x,
		y: e.clientY - position.value.y,
	};
	// İlk frame'i hemen çiz
	updateDragPosition(e);
};

const updateDragPosition = (e) => {
	if (!isDragging.value) return;

	position.value = {
		x: e.clientX - dragStart.value.x,
		y: e.clientY - dragStart.value.y,
	};

	// Direkt olarak canvas'ı güncelle
	requestAnimationFrame(() => {
		updateCanvas(performance.now());
	});
};

const onDragging = (e) => {
	e.preventDefault();
	if (isDragging.value) {
		updateDragPosition(e);
	}
};

const stopDragging = (e) => {
	e.preventDefault();
	if (isDragging.value) {
		isDragging.value = false;
		// Son pozisyonu emit et
		emit("cropChange", getCropData());
	}
};

// Zoom işlemi
const handleZoom = (e) => {
	e.preventDefault();
	if (!containerRef.value || !videoElement) return;

	const delta = e.deltaY * -0.01;
	const newScale = Math.min(Math.max(0.5, scale.value + delta), 3);

	// Mouse'un container içindeki pozisyonu
	const rect = containerRef.value.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;

	// Mouse'un video üzerindeki relatif pozisyonu
	const relativeX = (mouseX - position.value.x) / scale.value;
	const relativeY = (mouseY - position.value.y) / scale.value;

	// Yeni pozisyonu hesapla
	position.value = {
		x: mouseX - relativeX * newScale,
		y: mouseY - relativeY * newScale,
	};

	scale.value = newScale;

	// Direkt olarak canvas'ı güncelle
	requestAnimationFrame(() => {
		updateCanvas(performance.now());
	});
};

// Video bittiğinde
const onVideoEnded = () => {
	videoState.value.isPlaying = false;
	videoState.value.isPaused = true;
	emit("videoEnded");
	if (audioRef.value) audioRef.value.pause();
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

// Canvas güncelleme optimizasyonu
const updateCanvas = (timestamp) => {
	if (!canvasRef.value || !videoElement) return;

	// FPS kontrolü
	const elapsed = timestamp - lastFrameTime;
	if (elapsed < frameInterval) {
		animationFrame = requestAnimationFrame(updateCanvas);
		return;
	}
	lastFrameTime = timestamp;

	const canvas = canvasRef.value;
	const ctx = canvas.getContext("2d", {
		alpha: false,
		desynchronized: true,
	});

	// Render kalitesi ayarları
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";

	// Önce tüm canvas'ı arkaplan rengiyle doldur
	ctx.fillStyle = backgroundColor.value;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	//�ç alan için padding'i hesaba kat
	const innerX = padding.value;
	const innerY = padding.value;
	const innerWidth = canvas.width - padding.value * 2;
	const innerHeight = canvas.height - padding.value * 2;

	// Shadow için path oluştur
	if (shadowSize.value > 0) {
		ctx.save();
		ctx.beginPath();
		roundedRect(ctx, innerX, innerY, innerWidth, innerHeight, radius.value);

		// Shadow ayarları
		ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
		ctx.shadowBlur = shadowSize.value;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;

		// Shadow için arka planı çiz
		ctx.fillStyle = backgroundColor.value;
		ctx.fill();
		ctx.restore();
	}

	// Video alanını kırp ve radius uygula
	ctx.save();
	ctx.beginPath();
	roundedRect(ctx, innerX, innerY, innerWidth, innerHeight, radius.value);
	ctx.clip();

	// Transform işlemleri
	ctx.translate(position.value.x, position.value.y);
	ctx.scale(scale.value, scale.value);

	// Videoyu çiz
	if (videoElement.readyState >= videoElement.HAVE_CURRENT_DATA) {
		ctx.drawImage(
			videoElement,
			0,
			0,
			videoElement.videoWidth,
			videoElement.videoHeight
		);
	}

	ctx.restore();

	// Mouse pozisyonunu çiz
	if (props.mousePositions?.length > 0) {
		drawMousePosition(ctx, videoElement.currentTime);
	}

	// Her durumda sürekli güncelleme yap
	animationFrame = requestAnimationFrame(updateCanvas);
};

// Yardımcı fonksiyon: Yuvarlak köşeli dikdörtgen çizimi
const roundedRect = (ctx, x, y, width, height, radius) => {
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
};

// Tüm prop değişikliklerini izle ve canvas'ı güncelle
const forceCanvasUpdate = () => {
	if (animationFrame) {
		cancelAnimationFrame(animationFrame);
	}
	animationFrame = requestAnimationFrame(() => updateCanvas(performance.now()));
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
		videoElement.addEventListener("loadedmetadata", onVideoMetadataLoaded);
		videoElement.addEventListener("loadeddata", onVideoDataLoaded);
		videoElement.addEventListener("durationchange", onDurationChange);
		videoElement.addEventListener("timeupdate", onTimeUpdate);
		videoElement.addEventListener("ended", onVideoEnded);
		videoElement.addEventListener("error", onVideoError);
		videoElement.addEventListener("play", onVideoPlay);
		videoElement.addEventListener("pause", onVideoPause);
		videoElement.addEventListener("seeking", onVideoSeeking);
		videoElement.addEventListener("seeked", onVideoSeeked);
		videoElement.addEventListener("ratechange", onVideoRateChange);
		videoElement.addEventListener("volumechange", onVideoVolumeChange);

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
		const width = videoElement.videoWidth || 1920;
		const height = videoElement.videoHeight || 1080;
		videoSize.value = { width, height };

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
				width,
				height,
			});

			console.log("[MediaPlayer] Video metadata yüklendi:", {
				width,
				height,
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
	emit("play", videoState.value);
};

const onVideoPause = () => {
	videoState.value.isPlaying = false;
	videoState.value.isPaused = true;
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
	document.addEventListener("fullscreenchange", onFullscreenChange);
	if (videoElement) {
		videoElement.addEventListener("timeupdate", handleTimeUpdate);
	}
	if (videoRef.value && canvasRef.value) {
		renderVideo();
	}
});

onUnmounted(() => {
	if (videoElement) {
		videoElement.removeEventListener("loadedmetadata", onVideoMetadataLoaded);
		videoElement.removeEventListener("timeupdate", onTimeUpdate);
		videoElement.removeEventListener("ended", onVideoEnded);
		videoElement.removeEventListener("error", onVideoError);
		videoElement.removeEventListener("play", onVideoPlay);
		videoElement.removeEventListener("pause", onVideoPause);
		videoElement.removeEventListener("seeking", onVideoSeeking);
		videoElement.removeEventListener("seeked", onVideoSeeked);
		videoElement.removeEventListener("ratechange", onVideoRateChange);
		videoElement.removeEventListener("volumechange", onVideoVolumeChange);
		videoElement.src = "";
		videoElement = null;
	}

	window.removeEventListener("resize", handleResize);
	document.removeEventListener("fullscreenchange", onFullscreenChange);

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
});

// Tam ekran değişikliği
const onFullscreenChange = () => {
	videoState.value.isFullscreen = !!document.fullscreenElement;
	emit("fullscreenChange", videoState.value);
};

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
	play,
	pause,
	seek: (time) => {
		if (!videoElement) return;
		videoElement.currentTime = time;
	},
	setVolume: (volume) => {
		if (!videoElement) return;
		videoElement.volume = Math.max(0, Math.min(1, volume));
		if (audioRef.value) {
			audioRef.value.volume = videoElement.volume;
		}
	},
	setPlaybackRate: (rate) => {
		if (!videoElement) return;
		videoElement.playbackRate = rate;
	},
	getState: () => ({ ...videoState.value }),
	updateAspectRatio,
	getCropData,
	toggleMute: () => {
		if (!videoElement) return;
		videoElement.muted = !videoElement.muted;
		if (audioRef.value) {
			audioRef.value.muted = videoElement.muted;
		}
		emit("muteChange", videoElement.muted);
	},
	getCanvas: () => canvasRef.value,
	getVideoElement: () => videoElement,
	on: (event, handler) => {
		if (event === "videoEnded") {
			if (videoElement) {
				videoElement.addEventListener("ended", handler);
			}
		}
	},
	off: (event, handler) => {
		if (event === "videoEnded") {
			if (videoElement) {
				videoElement.removeEventListener("ended", handler);
			}
		}
	},
});

// Mouse animasyonu için state
const currentMousePos = ref({ x: 0, y: 0 });
const targetMousePos = ref({ x: 0, y: 0 });
const previousPositions = ref([]);
const MAX_TRAIL_LENGTH = 15; // 30'dan 15'e düşürelim

// Lerp (Linear interpolation) fonksiyonu
const lerp = (start, end, factor) => {
	return start + (end - start) * factor;
};

// Cursor image yükleme
const cursorImage = new Image();
cursorImage.src = cursorSvg;

// Cursor'ın yüklendiğinden emin olmak için
cursorImage.onload = () => {
	console.log("[MediaPlayer] Cursor image loaded successfully");
};

cursorImage.onerror = (error) => {
	console.error("[MediaPlayer] Cursor image loading error:", error);
};

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
	const videoWidth = videoSize.value.width;
	const videoHeight = videoSize.value.height;

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

	// Video'nun canvas içindeki mevcut boyutlarını hesapla
	const scaledVideoWidth = videoWidth * scale.value;
	const scaledVideoHeight = videoHeight * scale.value;

	// Mouse pozisyonunu canvas koordinatlarına dönüştür
	const canvasX = position.value.x + normalizedX * scaledVideoWidth;
	const canvasY = position.value.y + normalizedY * scaledVideoHeight;

	// Yeni pozisyonu kaydet
	if (previousPositions.value.length >= MAX_TRAIL_LENGTH) {
		previousPositions.value.shift();
	}
	previousPositions.value.push({ x: canvasX, y: canvasY, time: currentTime });

	// Motion blur efekti için önceki pozisyonları çiz
	const blurValue = motionBlurValue.value;
	if (blurValue > 0) {
		const trailLength = previousPositions.value.length;
		const positions = [...previousPositions.value].reverse();

		// Batch drawing için path kullan
		ctx.save();
		for (let i = 0; i < positions.length; i++) {
			const pos = positions[i];
			const normalizedIndex = i / trailLength;
			const alpha = Math.pow(1 - normalizedIndex, 0.5) * blurValue;

			ctx.globalAlpha = Math.min(0.9, alpha);
			ctx.translate(pos.x, pos.y);

			// Trail için cursor boyutunu hesapla
			const sizeMultiplier = 1 - normalizedIndex * 0.3;
			const cursorSize = mouseSize.value * 2 * scale.value * sizeMultiplier;

			ctx.filter = `blur(${blurValue}px)`;

			try {
				ctx.drawImage(
					cursorImage,
					-cursorSize / 4,
					-cursorSize / 4,
					cursorSize,
					cursorSize
				);
			} catch (error) {
				console.error("[MediaPlayer] Trail cursor drawing error:", error);
			}

			ctx.translate(-pos.x, -pos.y);
		}
		ctx.restore();
	}

	// Ana cursor'ı çiz
	ctx.save();
	ctx.globalAlpha = 1;
	ctx.translate(canvasX, canvasY);

	// Ana cursor boyutunu ayarla
	const cursorSize = mouseSize.value * 2 * scale.value;

	// Ana cursor'a da blur efekti uygula
	if (blurValue > 0) {
		ctx.filter = `blur(${blurValue / 10}px)`; // Ana cursor için daha az blur
	}

	try {
		ctx.drawImage(
			cursorImage,
			-cursorSize / 4,
			-cursorSize / 4,
			cursorSize,
			cursorSize
		);
	} catch (error) {
		console.error("[MediaPlayer] Main cursor drawing error:", error);
	}

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

// Aspect ratio hesaplama
const currentAspectRatio = computed(() => {
	if (!cropRatio.value) return "16/9"; // Default ratio

	const [width, height] = cropRatio.value.split(":").map(Number);
	if (!width || !height) return "16/9";
	return `${width}/${height}`;
});

// Video yüklendiğinde
const onVideoLoad = () => {
	if (!videoElement) return;

	// Video boyutlarını kaydet
	videoSize.value = {
		width: videoElement.videoWidth,
		height: videoElement.videoHeight,
	};

	// Crop alanını ayarla
	if (!cropRatio.value || cropRatio.value === "auto") {
		cropArea.value = {
			x: 0,
			y: 0,
			width: videoElement.videoWidth,
			height: videoElement.videoHeight,
		};
	} else {
		// Diğer aspect ratio'lar için mevcut hesaplama
		const [widthRatio, heightRatio] = cropRatio.value.split(":").map(Number);
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
};
</script>

<style scoped>
canvas {
	image-rendering: optimizeQuality;
	-webkit-backface-visibility: hidden;
	backface-visibility: hidden;
}
</style>
