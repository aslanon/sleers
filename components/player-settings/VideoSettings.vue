<template>
	<div class="space-y-4">
		<h2 class="text-xl font-bold mb-4">Video Ayarları</h2>
		<div>
			<label class="block text-sm font-medium mb-1">Video Süresi</label>
			<span class="text-gray-300">{{ formatDuration(duration) }}</span>
		</div>

		<div>
			<label class="block text-sm font-medium mb-1">Boyut</label>
			<span class="text-gray-300">{{ width }}x{{ height }}</span>
		</div>
	</div>
</template>

<script setup>
const props = defineProps({
	duration: {
		type: Number,
		required: true,
		validator: (value) => value >= 0,
	},
	width: {
		type: Number,
		required: true,
		default: 1920,
	},
	height: {
		type: Number,
		required: true,
		default: 1080,
	},
});

// Süre formatı
const formatDuration = (seconds) => {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};
</script>
