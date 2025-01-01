<template>
	<div class="media-player-settings w-80 ml-4 rounded-lg p-4">
		<h2 class="text-xl font-bold mb-4">Video Ayarları</h2>

		<!-- Video Bilgileri -->
		<div class="space-y-4">
			<div>
				<label class="block text-sm font-medium mb-1">Video Süresi</label>
				<span class="text-gray-300">{{ formatDuration(duration) }}</span>
			</div>

			<div>
				<label class="block text-sm font-medium mb-1">Boyut</label>
				<span class="text-gray-300">{{ width }}x{{ height }}</span>
			</div>
		</div>
	</div>
</template>

<script setup>
defineProps({
	duration: {
		type: Number,
		default: 0,
	},
	width: {
		type: Number,
		default: 0,
	},
	height: {
		type: Number,
		default: 0,
	},
});

// Süre formatı
const formatDuration = (seconds) => {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};
</script>
