<script setup>
import { ref, watch } from "vue";

const props = defineProps({
	videoUrl: { type: String, required: true },
	currentTime: { type: Number, required: true },
	onDurationChange: { type: Function, required: true },
	onTimeUpdate: { type: Function, required: true },
});

const videoRef = ref(null);

watch(
	() => props.currentTime,
	(newTime) => {
		if (
			videoRef.value &&
			Math.abs(videoRef.value.currentTime - newTime) > 0.5
		) {
			videoRef.value.currentTime = newTime;
		}
	}
);

const handleLoadedMetadata = () => {
	if (videoRef.value) {
		props.onDurationChange(videoRef.value.duration);
	}
};

const handleTimeUpdate = () => {
	if (videoRef.value) {
		props.onTimeUpdate(videoRef.value.currentTime);
	}
};
</script>

<template>
	<video
		ref="videoRef"
		class="w-full rounded-lg"
		:src="props.videoUrl"
		@loadedmetadata="handleLoadedMetadata"
		@timeupdate="handleTimeUpdate"
		controls
	/>
</template>
