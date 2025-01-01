<template>
	<div
		class="media-player-controls mt-4 flex justify-center items-center space-x-4"
	>
		<button
			@click="$emit('togglePlayback')"
			class="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center"
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
			<span class="ml-2">{{ isPlaying ? "Durdur" : "Oynat" }}</span>
		</button>
	</div>
</template>

<script setup>
defineProps({
	isPlaying: {
		type: Boolean,
		default: false,
	},
});

defineEmits(["togglePlayback"]);
</script>
