<template>
	<div class="media-player w-full h-max p-4 rounded-lg overflow-hidden">
		<div
			ref="containerRef"
			class="relative w-full h-full overflow-hidden bg-black"
		>
			<canvas
				ref="canvasRef"
				class="absolute top-0 left-0 w-full h-full"
				:class="{ 'cursor-grab': !isDragging, 'cursor-grabbing': isDragging }"
				@mousedown="startDragging"
				@mousemove="onDragging"
				@mouseup="stopDragging"
				@mouseleave="stopDragging"
				@wheel="handleZoom"
			></canvas>

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
});

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

// Segment oynatma mantığı
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
const togglePlay = () => {
	if (!videoElement) return;

	if (videoElement.paused) {
		isPlayingSegments.value = true;
		currentSegmentIndex.value = 0;

		// İlk segmentin başlangıç zamanına git
		if (props.segments && props.segments.length > 0) {
			const firstSegment = props.segments[0];
			const startTime = firstSegment.start || firstSegment.startTime || 0;
			videoElement.currentTime = startTime;
		}

		videoElement
			.play()
			.then(() => {
				emit("play");
			})
			.catch((error) => {
				console.error("Video oynatma hatası:", error);
				isPlayingSegments.value = false;
				emit("pause");
			});
	} else {
		isPlayingSegments.value = false;
		videoElement.pause();
		emit("pause");
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

		// İlk frame'i göster
		videoElement.currentTime = 0;

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

			// İlk frame'i göster
			videoElement.currentTime = 0;

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

		// İlk frame'i göster
		videoElement.currentTime = 0;

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

// Oynatma kontrolü
const togglePlayback = async (e) => {
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
		await videoElement.play();
		// Ses elementini de oynat
		if (audioRef.value) {
			audioRef.value.currentTime = videoElement.currentTime;
			await audioRef.value.play();
		}
		if (!animationFrame) {
			animationFrame = requestAnimationFrame(updateCanvas);
		}
	} catch (error) {
		console.error("[MediaPlayer] Oynatma hatası:", error);
	}
};

const pause = async () => {
	if (!videoElement) return;
	try {
		await videoElement.pause();
		// Ses elementini de durdur
		if (audioRef.value) {
			await audioRef.value.pause();
		}
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
	videoState.value.currentTime = videoElement.currentTime;
	// Ses zamanını da senkronize et
	if (
		audioRef.value &&
		Math.abs(audioRef.value.currentTime - videoElement.currentTime) > 0.1
	) {
		audioRef.value.currentTime = videoElement.currentTime;
	}
	emit("timeUpdate", videoElement.currentTime);
};

// Pencere boyutu değiştiğinde
const handleResize = () => {
	if (!containerRef.value || !videoElement) return;

	const container = containerRef.value.getBoundingClientRect();
	const video = videoElement;

	// Container oranını hesapla
	const containerRatio = container.width / container.height;
	const videoRatio = video.videoWidth / video.videoHeight;

	let newScale;
	if (containerRatio > videoRatio) {
		// Container daha geniş, yüksekliğe göre ölçekle
		newScale = container.height / video.videoHeight;
	} else {
		// Container daha dar, genişliğe göre ölçekle
		newScale = container.width / video.videoWidth;
	}

	// Yeni ölçeği uygula
	scale.value = newScale;

	// Videoyu ortala
	position.value = {
		x: (container.width - video.videoWidth * newScale) / 2,
		y: (container.height - video.videoHeight * newScale) / 2,
	};

	// Kırpma alanını güncelle
	updateCropArea();
};

// Kırpma alanını güncelle
const updateCropArea = () => {
	if (!containerRef.value || !videoElement) return;

	const container = containerRef.value.getBoundingClientRect();

	if (selectedAspectRatio.value) {
		const [widthRatio, heightRatio] = selectedAspectRatio.value
			.split(":")
			.map(Number);

		if (widthRatio && heightRatio) {
			const targetRatio = widthRatio / heightRatio;
			let width, height;

			if (container.width / container.height > targetRatio) {
				height = container.height; // Maksimum yükseklik
				width = height * targetRatio;
			} else {
				width = container.width; // Maksimum genişlik
				height = width / targetRatio;
			}

			cropArea.value = {
				width,
				height,
				x: (container.width - width) / 2,
				y: (container.height - height) / 2,
			};
		}
	} else {
		cropArea.value = {
			width: container.width,
			height: container.height,
			x: 0,
			y: 0,
		};
	}

	// Kırpma değişikliğini hemen emit et
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

	// Seçilen alan yoksa null döndür
	if (!selectedAspectRatio.value) return null;

	// Canvas koordinatlarını video koordinatlarına dönüştür
	const canvasToVideo = (canvasX, canvasY, canvasWidth, canvasHeight) => {
		// Canvas'taki oranı hesapla
		const scaleX = videoWidth / container.width;
		const scaleY = videoHeight / container.height;

		return {
			x: Math.round(canvasX * scaleX),
			y: Math.round(canvasY * scaleY),
			width: Math.round(canvasWidth * scaleX),
			height: Math.round(canvasHeight * scaleY),
		};
	};

	// Kırpma alanını video koordinatlarına dönüştür
	const videoCoords = canvasToVideo(
		cropArea.value.x,
		cropArea.value.y,
		cropArea.value.width,
		cropArea.value.height
	);

	console.log("[MediaPlayer] Kırpma verileri hesaplandı:", {
		canvas: cropArea.value,
		video: videoCoords,
		container: container,
		videoSize: { width: videoWidth, height: videoHeight },
	});

	return {
		...videoCoords,
		scale: 1, // Scale'i 1 olarak sabit tutuyoruz çünkü koordinatları zaten dönüştürdük
	};
};

// Canvas güncelleme optimizasyonu
const updateCanvas = (timestamp) => {
	if (!canvasRef.value || !videoElement || !ctx) return;

	const canvas = canvasRef.value;
	const container = containerRef.value;

	// Canvas boyutlarını ayarla (sadece gerektiğinde)
	if (
		canvas.width !== container.clientWidth ||
		canvas.height !== container.clientHeight
	) {
		canvas.width = container.clientWidth;
		canvas.height = container.clientHeight;
	}

	// Canvas'ı temizle
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Transform işlemleri
	ctx.save();
	ctx.translate(position.value.x, position.value.y);
	ctx.scale(scale.value, scale.value);
	ctx.rotate(rotation.value);

	// Videoyu çiz
	ctx.drawImage(
		videoElement,
		0,
		0,
		videoElement.videoWidth,
		videoElement.videoHeight
	);

	ctx.restore();

	// Kırpma alanı varsa overlay ve çerçeve çiz
	if (selectedAspectRatio.value) {
		// Kırpma alanı dışındaki bölgeleri karart (opaklık artırıldı)
		ctx.fillStyle = "rgba(0, 0, 0, 1)"; // Tam siyah overlay

		// Üst bölge
		ctx.fillRect(0, 0, canvas.width, cropArea.value.y);

		// Sol bölge
		ctx.fillRect(0, cropArea.value.y, cropArea.value.x, cropArea.value.height);

		// Sağ bölge
		ctx.fillRect(
			cropArea.value.x + cropArea.value.width,
			cropArea.value.y,
			canvas.width - (cropArea.value.x + cropArea.value.width),
			cropArea.value.height
		);

		// Alt bölge
		ctx.fillRect(
			0,
			cropArea.value.y + cropArea.value.height,
			canvas.width,
			canvas.height - (cropArea.value.y + cropArea.value.height)
		);

		// Kırpma çerçevesi
		ctx.strokeStyle = "white";
		ctx.lineWidth = 2;
		ctx.strokeRect(
			cropArea.value.x,
			cropArea.value.y,
			cropArea.value.width,
			cropArea.value.height
		);
	}

	// Video oynatılıyorsa veya sürükleme/zoom yapılıyorsa animasyonu devam ettir
	if (videoState.value.isPlaying || isDragging.value) {
		animationFrame = requestAnimationFrame(updateCanvas);
	}
};

// Component lifecycle
onMounted(() => {
	initVideo();
	window.addEventListener("resize", handleResize);
	document.addEventListener("fullscreenchange", onFullscreenChange);
	if (videoElement) {
		videoElement.addEventListener("timeupdate", handleTimeUpdate);
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
		if (Math.abs(videoElement.currentTime - newValue) > 0.1) {
			videoElement.currentTime = newValue;
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

		// Eğer video oynatılmıyorsa önizleme zamanını güncelle
		if (!videoState.value.isPlaying) {
			videoElement.currentTime = newValue;
			if (audioRef.value) {
				audioRef.value.currentTime = newValue;
			}
		}
	}
);

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
});
</script>

<style scoped>
.media-player {
	aspect-ratio: 16/9;
}

canvas {
	image-rendering: optimizeQuality;
	-webkit-backface-visibility: hidden;
	backface-visibility: hidden;
}
</style>
