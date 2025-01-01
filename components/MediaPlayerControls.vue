<template>
	<div
		class="media-player-controls mt-4 flex justify-center items-center space-x-4"
	>
		<div class="text-sm text-gray-300">{{ formatTime(currentTime) }}</div>
		<button
			@click="$emit('togglePlayback')"
			class="px-6 py-2 rounded-lg flex items-center"
		>
			<span v-if="isPlaying">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			</span>
			<span v-else>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			</span>
		</button>
		<div class="text-sm text-gray-300">{{ formatTime(duration) }}</div>
	</div>
</template>

<script setup>
defineProps({
	isPlaying: {
		type: Boolean,
		default: false,
	},
	currentTime: {
		type: Number,
		default: 0,
	},
	duration: {
		type: Number,
		default: 0,
	},
});

defineEmits(["togglePlayback"]);

const formatTime = (seconds) => {
	if (!Number.isFinite(seconds)) return "0:00";

	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};
</script>
