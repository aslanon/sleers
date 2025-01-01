<template>
	<div class="media-player-settings w-80 ml-4 bg-gray-800 rounded-lg p-4">
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

			<!-- Butonlar -->
			<div class="flex flex-col space-y-2 mt-4">
				<button
					class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
					@click="$emit('saveVideo')"
				>
					Kaydet
				</button>
				<button
					class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
					@click="$emit('startNewRecording')"
				>
					Yeni Kayıt
				</button>
				<button
					class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
					@click="$emit('discardChanges')"
				>
					İptal
				</button>
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

defineEmits(["saveVideo", "startNewRecording", "discardChanges"]);

// Süre formatı
const formatDuration = (seconds) => {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};
</script>
