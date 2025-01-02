<template>
	<div
		class="media-player flex-1 w-full max-h-[600px] p-4 bg-gray-900 rounded-lg overflow-hidden"
	>
		<video
			ref="videoRef"
			class="h-full m-auto"
			preload="metadata"
			@loadedmetadata="onVideoLoaded"
			@loadeddata="onVideoDataLoaded"
			@durationchange="onDurationChange"
			@timeupdate="onTimeUpdate"
			@error="onVideoError"
		>
			<source v-if="videoUrl" :src="videoUrl" :type="videoType" />
		</video>
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
import { ref, onMounted, onUnmounted, watch } from "vue";

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
});

const emit = defineEmits([
	"videoLoaded",
	"videoEnded",
	"videoPaused",
	"timeUpdate",
]);

const videoRef = ref(null);
const audioRef = ref(null);
let metadataLoaded = false;

// Video metadata yüklendiğinde
const onVideoLoaded = () => {
	if (!videoRef.value) return;

	const video = videoRef.value;
	console.log("[MediaPlayer] Video metadata yükleniyor:", {
		readyState: video.readyState,
		networkState: video.networkState,
		src: video.src,
		currentSrc: video.currentSrc,
		type: video.type,
		duration: video.duration,
		width: video.videoWidth,
		height: video.videoHeight,
	});
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

// Props izleme
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
		if (!videoRef.value) return;
		if (Math.abs(videoRef.value.currentTime - newValue) > 0.1) {
			seek(newValue);
		}
	}
);

// Component mount olduğunda
onMounted(() => {
	const video = videoRef.value;
	if (video) {
		video.addEventListener("ended", onVideoEnded);
		video.addEventListener("pause", () => {
			emit("videoPaused");
		});
	}
});

// Component unmount olduğunda
onUnmounted(() => {
	const video = videoRef.value;
	if (video) {
		video.removeEventListener("ended", onVideoEnded);
	}
});

// Component exposed methods
defineExpose({
	play,
	pause,
	seek,
});
</script>

<style scoped>
.media-player {
	aspect-ratio: 16/9;
}

video::-webkit-media-controls {
	display: none !important;
}

video {
	object-fit: contain;
	background: black;
}
</style>
