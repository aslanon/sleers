<template>
	<div
		class="media-player flex-1 w-full max-h-[500px] bg-black rounded-lg overflow-hidden"
	>
		<video
			ref="videoRef"
			class="w-full h-full"
			:src="videoUrl"
			:type="videoType"
			@loadedmetadata="onVideoLoaded"
		></video>
		<audio
			v-show="audioUrl"
			ref="audioRef"
			:src="audioUrl"
			:type="audioType"
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
});

const emit = defineEmits(["videoLoaded", "videoEnded", "videoPaused"]);

const videoRef = ref(null);
const audioRef = ref(null);

// Video yüklendiğinde
const onVideoLoaded = () => {
	if (videoRef.value) {
		emit("videoLoaded", {
			duration: videoRef.value.duration,
			width: videoRef.value.videoWidth,
			height: videoRef.value.videoHeight,
		});
	}
};

// Video durduğunda veya bittiğinde
const onVideoEnded = () => {
	emit("videoEnded");
	const audio = audioRef.value;
	if (audio) audio.pause();
};

// isPlaying prop'unu izle
watch(
	() => props.isPlaying,
	async (newValue) => {
		const video = videoRef.value;
		const audio = audioRef.value;

		if (!video) return;

		if (newValue) {
			// Oynat
			try {
				await video.play();
				if (audio) {
					await audio.play();
					audio.currentTime = video.currentTime;
				}
			} catch (error) {
				console.error("Medya oynatma hatası:", error);
			}
		} else {
			// Durdur
			video.pause();
			if (audio) audio.pause();
		}
	},
	{ immediate: true }
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

// Medya kontrollerini dışa aç
defineExpose({
	videoRef,
	audioRef,
});
</script>
