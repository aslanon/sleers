<template>
	<div class="media-player w-full max-h-[600px] p-4 rounded-lg overflow-hidden">
		<!-- Video Container -->
		<div
			ref="containerRef"
			class="relative w-full h-full overflow-hidden bg-black"
			@mousedown="startDragging"
			@mousemove="onDragging"
			@mouseup="stopDragging"
			@mouseleave="stopDragging"
			@wheel="handleZoom"
		>
			<!-- Canvas -->
			<canvas
				ref="canvasRef"
				class="absolute top-0 left-0 w-full h-full"
				:class="{ 'cursor-grab': !isDragging, 'cursor-grabbing': isDragging }"
			></canvas>

			<!-- Gizli Video (Canvas için kaynak) -->
			<video
				ref="videoRef"
				class="hidden"
				preload="metadata"
				@loadedmetadata="onVideoMetadataLoaded"
				@loadeddata="onVideoDataLoaded"
				@durationchange="onDurationChange"
				@timeupdate="onTimeUpdate"
				@error="onVideoError"
			>
				<source v-if="videoUrl" :src="videoUrl" :type="videoType" />
			</video>

			<!-- Kırpma Çerçevesi ve Overlay -->
			<template v-if="selectedAspectRatio">
				<!-- Üst overlay -->
				<div
					class="absolute bg-black/80"
					:style="{
						left: 0,
						top: 0,
						width: '100%',
						height: cropArea.y + 'px',
					}"
				></div>
				<!-- Sol overlay -->
				<div
					class="absolute bg-black/80"
					:style="{
						left: 0,
						top: cropArea.y + 'px',
						width: cropArea.x + 'px',
						height: cropArea.height + 'px',
					}"
				></div>
				<!-- Sağ overlay -->
				<div
					class="absolute bg-black/80"
					:style="{
						left: cropArea.x + cropArea.width + 'px',
						top: cropArea.y + 'px',
						width: 'calc(100% - ' + (cropArea.x + cropArea.width) + 'px)',
						height: cropArea.height + 'px',
					}"
				></div>
				<!-- Alt overlay -->
				<div
					class="absolute bg-black/80"
					:style="{
						left: 0,
						top: cropArea.y + cropArea.height + 'px',
						width: '100%',
						height: 'calc(100% - ' + (cropArea.y + cropArea.height) + 'px)',
					}"
				></div>
				<!-- Kırpma çerçevesi -->
				<div
					class="absolute border-2 border-white pointer-events-none"
					:style="{
						left: cropArea.x + 'px',
						top: cropArea.y + 'px',
						width: cropArea.width + 'px',
						height: cropArea.height + 'px',
					}"
				></div>
			</template>
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
	selectedAspectRatio: {
		type: String,
		default: "",
	},
});

const emit = defineEmits([
	"videoLoaded",
	"videoEnded",
	"videoPaused",
	"timeUpdate",
	"cropChange",
]);

// Referanslar
const videoRef = ref(null);
const audioRef = ref(null);
const containerRef = ref(null);
const canvasRef = ref(null);
let ctx = null;

// State yönetimi
const selectedAspectRatio = ref("");
const position = ref({ x: 0, y: 0 });
const scale = ref(1);
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const cropArea = ref({ x: 0, y: 0, width: 0, height: 0 });
let metadataLoaded = false;

// Video boyutları
const videoSize = ref({ width: 0, height: 0 });

// Önceki container boyutlarını sakla
const previousContainer = ref({ width: 0, height: 0 });

// Kırpma bilgisi
const cropInfo = computed(() => {
	if (!selectedAspectRatio.value) return "";
	return `Kırpma: ${Math.round(cropArea.value.width)}x${Math.round(
		cropArea.value.height
	)} (x:${Math.round(cropArea.value.x)}, y:${Math.round(cropArea.value.y)})`;
});

// Pencere boyutu değiştiğinde
const handleResize = () => {
	try {
		if (!containerRef.value || !videoRef.value) return;

		const container = containerRef.value.getBoundingClientRect();
		const video = videoRef.value;

		if (!container.width || !container.height) return;

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
		if (selectedAspectRatio.value) {
			const [widthRatio, heightRatio] = selectedAspectRatio.value
				.split(":")
				.map(Number);

			if (widthRatio && heightRatio) {
				const targetRatio = widthRatio / heightRatio;
				let width, height;

				if (container.width / container.height > targetRatio) {
					height = container.height;
					width = height * targetRatio;
				} else {
					width = container.width;
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

		emitCropChange();
	} catch (error) {
		console.error("[MediaPlayer] Yeniden boyutlandırma hatası:", error);
	}
};

// Aspect ratio değiştiğinde kırpma alanını güncelle
const updateCropArea = () => {
	try {
		if (!containerRef.value || !videoRef.value) {
			console.warn("[MediaPlayer] Video container veya ref bulunamadı");
			return;
		}

		const container = containerRef.value.getBoundingClientRect();
		if (!container.width || !container.height) {
			console.warn("[MediaPlayer] Container boyutları geçersiz");
			return;
		}

		// İlk kez çalışıyorsa container boyutlarını kaydet
		if (previousContainer.value.width === 0) {
			previousContainer.value = {
				width: container.width,
				height: container.height,
			};
		}

		if (selectedAspectRatio.value) {
			const [widthRatio, heightRatio] = selectedAspectRatio.value
				.split(":")
				.map(Number);

			if (!widthRatio || !heightRatio) {
				console.warn("[MediaPlayer] Geçersiz aspect ratio formatı");
				return;
			}

			const targetRatio = widthRatio / heightRatio;
			let width, height;

			if (container.width / container.height > targetRatio) {
				height = container.height;
				width = height * targetRatio;
			} else {
				width = container.width;
				height = width / targetRatio;
			}

			cropArea.value = {
				width,
				height,
				x: (container.width - width) / 2,
				y: (container.height - height) / 2,
			};
		} else {
			cropArea.value = {
				width: container.width,
				height: container.height,
				x: 0,
				y: 0,
			};
		}

		emitCropChange();
	} catch (error) {
		console.error("[MediaPlayer] Kırpma alanı güncellenirken hata:", error);
		cropArea.value = {
			width: 0,
			height: 0,
			x: 0,
			y: 0,
		};
	}
};

// Sürükleme işlemleri
const startDragging = (e) => {
	isDragging.value = true;
	dragStart.value = {
		x: e.clientX - position.value.x,
		y: e.clientY - position.value.y,
	};
};

const onDragging = (e) => {
	if (!isDragging.value) return;

	position.value = {
		x: e.clientX - dragStart.value.x,
		y: e.clientY - dragStart.value.y,
	};

	emitCropChange();
};

const stopDragging = () => {
	isDragging.value = false;
};

// Zoom işlemi
const handleZoom = (e) => {
	e.preventDefault();
	if (!containerRef.value || !videoRef.value) return;

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
	emitCropChange();
};

// Kırpma değişikliklerini ilet
const emitCropChange = () => {
	try {
		if (!videoRef.value || !containerRef.value) return;

		const container = containerRef.value.getBoundingClientRect();
		const video = videoRef.value.getBoundingClientRect();

		if (!container.width || !container.height) {
			console.warn("[MediaPlayer] Container boyutları geçersiz");
			return;
		}

		const cropData = {
			position: { ...position.value },
			scale: scale.value,
			cropArea: { ...cropArea.value },
			containerSize: {
				width: container.width,
				height: container.height,
			},
			videoSize: { ...videoSize.value },
			aspectRatio: selectedAspectRatio.value,
		};

		emit("cropChange", cropData);
	} catch (error) {
		console.error("[MediaPlayer] Kırpma bilgileri iletilemedi:", error);
	}
};

// Canvas'ı güncelle
const updateCanvas = () => {
	if (!canvasRef.value || !videoRef.value || !ctx) return;

	const canvas = canvasRef.value;
	const video = videoRef.value;
	const container = containerRef.value;

	// Canvas boyutlarını container'a göre ayarla
	canvas.width = container.clientWidth;
	canvas.height = container.clientHeight;

	// Canvas'ı temizle
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Transform matrisini kaydet
	ctx.save();

	// Transform işlemlerini uygula
	ctx.translate(position.value.x, position.value.y);
	ctx.scale(scale.value, scale.value);

	// Videoyu çiz
	ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

	// Transform matrisini geri yükle
	ctx.restore();
};

// Video metadata yüklendiğinde
const onVideoMetadataLoaded = () => {
	if (!videoRef.value || !canvasRef.value) return;

	const video = videoRef.value;
	const canvas = canvasRef.value;
	ctx = canvas.getContext("2d", {
		alpha: false,
		desynchronized: true, // Daha iyi performans için
	});

	videoSize.value = {
		width: video.videoWidth,
		height: video.videoHeight,
	};

	// Video yüklendiğinde boyutları ayarla
	handleResize();
	updateCanvas();
};

// Video data yüklendiğinde
const onVideoDataLoaded = () => {
	if (!videoRef.value || metadataLoaded) return;

	const video = videoRef.value;
	const duration = video.duration;
	const width = video.videoWidth;
	const height = video.videoHeight;

	if (Number.isFinite(duration) && duration > 0 && width > 0 && height > 0) {
		metadataLoaded = true;
		console.log("[MediaPlayer] Video data yüklendi:", {
			duration,
			width,
			height,
		});
		emit("videoLoaded", {
			duration,
			width,
			height,
		});
	}
};

// Video süresi değiştiğinde
const onDurationChange = () => {
	if (!videoRef.value || metadataLoaded) return;

	const video = videoRef.value;
	const duration = video.duration;
	const width = video.videoWidth;
	const height = video.videoHeight;

	if (Number.isFinite(duration) && duration > 0 && width > 0 && height > 0) {
		metadataLoaded = true;
		console.log("[MediaPlayer] Video süresi güncellendi:", {
			duration,
			width,
			height,
		});
		emit("videoLoaded", {
			duration,
			width,
			height,
		});
	}
};

// Hata yönetimi
const onVideoError = (error) => {
	console.error("[MediaPlayer] Video hatası:", {
		error,
		video: videoRef.value?.error,
		readyState: videoRef.value?.readyState,
		networkState: videoRef.value?.networkState,
	});
};

const onAudioError = (error) => {
	console.error("[MediaPlayer] Ses hatası:", {
		error,
		audio: audioRef.value?.error,
	});
};

// Video URL'si değiştiğinde
watch(
	() => props.videoUrl,
	() => {
		metadataLoaded = false;
		if (videoRef.value) {
			videoRef.value.load();
		}
	}
);

// Video zamanı güncellendiğinde
const onTimeUpdate = () => {
	if (!videoRef.value) return;
	updateCanvas();
	emit("timeUpdate", videoRef.value.currentTime);
};

// Video kontrolü
const play = () => {
	if (!videoRef.value) return;
	videoRef.value.play();
};

const pause = () => {
	if (!videoRef.value) return;
	videoRef.value.pause();
};

const seek = (time) => {
	if (!videoRef.value) return;
	videoRef.value.currentTime = time;
};

// Video durduğunda veya bittiğinde
const onVideoEnded = () => {
	emit("videoEnded");
	const audio = audioRef.value;
	if (audio) audio.pause();
};

// Video ve ses senkronizasyonu için watch
watch(
	() => props.isPlaying,
	(newValue) => {
		if (newValue) {
			Promise.all([videoRef.value?.play(), audioRef.value?.play()]).catch(
				(error) => {
					console.error("[MediaPlayer] Oynatma hatası:", error);
					emit("error", error);
				}
			);
		} else {
			videoRef.value?.pause();
			audioRef.value?.pause();
		}
	}
);

// Ses ve video senkronizasyonu için timeupdate
watch(
	() => props.currentTime,
	(newValue) => {
		if (!videoRef.value || !audioRef.value) return;

		// Ses ve video arasındaki fark 0.1 saniyeden fazlaysa senkronize et
		if (Math.abs(videoRef.value.currentTime - newValue) > 0.1) {
			videoRef.value.currentTime = newValue;
		}
		if (Math.abs(audioRef.value.currentTime - newValue) > 0.1) {
			audioRef.value.currentTime = newValue;
		}
	}
);

// Ses seviyesi kontrolü
const setVolume = (volume) => {
	if (audioRef.value) {
		audioRef.value.volume = volume;
	}
	if (videoRef.value) {
		videoRef.value.volume = volume;
	}
};

// Aspect ratio'yu güncelle ve kırpma alanını ayarla
const updateAspectRatio = (ratio) => {
	try {
		if (ratio && typeof ratio === "string") {
			selectedAspectRatio.value = ratio;
			updateCropArea();
		} else {
			selectedAspectRatio.value = "";
			updateCropArea();
		}
	} catch (error) {
		console.error("[MediaPlayer] Aspect ratio güncellenirken hata:", error);
		selectedAspectRatio.value = "";
		updateCropArea();
	}
};

// Animasyon frame'i
let animationFrame = null;

// Component mount olduğunda
onMounted(() => {
	const video = videoRef.value;
	const audio = audioRef.value;

	if (video) {
		video.addEventListener("ended", onVideoEnded);
		video.addEventListener("pause", () => {
			emit("videoPaused");
			audio?.pause();
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
				animationFrame = null;
			}
		});
		video.addEventListener("play", () => {
			const animate = () => {
				updateCanvas();
				animationFrame = requestAnimationFrame(animate);
			};
			animate();
		});
	}

	if (audio) {
		audio.addEventListener("error", onAudioError);
	}

	// Varsayılan ses seviyesini ayarla
	setVolume(1.0);

	// Resize event listener'ı ekle
	window.addEventListener("resize", handleResize);
});

// Component unmount olduğunda
onUnmounted(() => {
	const video = videoRef.value;
	const audio = audioRef.value;

	if (video) {
		video.removeEventListener("ended", onVideoEnded);
	}

	if (audio) {
		audio.removeEventListener("error", onAudioError);
	}

	// Resize event listener'ı kaldır
	window.removeEventListener("resize", handleResize);

	// Animasyon frame'i temizle
	if (animationFrame) {
		cancelAnimationFrame(animationFrame);
	}
});

// Component exposed methods
defineExpose({
	videoRef,
	play,
	pause,
	seek,
	setVolume,
	updateCropArea,
	updateAspectRatio,
	getCropData: () => ({
		position: { ...position.value },
		scale: scale.value,
		cropArea: { ...cropArea.value },
		aspectRatio: selectedAspectRatio.value,
	}),
});

// Watch selectedAspectRatio prop changes
watch(
	() => props.selectedAspectRatio,
	(newRatio) => {
		selectedAspectRatio.value = newRatio;
		updateCropArea();
	}
);
</script>

<style scoped>
.media-player {
	aspect-ratio: 16/9;
}

canvas {
	image-rendering: pixelated;
}
</style>
