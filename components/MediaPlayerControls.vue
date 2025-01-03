<template>
	<div
		class="media-player-controls mt-4 flex justify-center items-center space-x-4"
	>
		<div class="flex flex-row space-x-4">
			<!-- Aspect Ratio Seçimi -->
			<select
				:value="selectedRatio"
				class="bg-gray-800 text-white px-3 py-1 rounded-lg"
				@change="$emit('update:selectedRatio', $event.target.value)"
			>
				<option value="">Serbest Kırpma</option>
				<option value="1:1">1:1 Kare</option>
				<option value="4:3">4:3 Klasik</option>
				<option value="3:4">3:4 Klasik</option>
				<option value="16:9">16:9 Geniş</option>
				<option value="9:16">9:16 Dikey</option>
			</select>
		</div>

		<div class="w-full flex justify-center items-center space-x-4">
			<div class="text-sm text-gray-300">{{ formatTime(currentTime) }}</div>

			<button
				@click="$emit('togglePlayback')"
				class="px-6 py-2 rounded-lg flex items-center"
				type="button"
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
			<button
				v-if="false"
				@click="$emit('toggleTrimMode')"
				class="px-4 py-2 rounded-lg flex items-center"
				:class="{ 'bg-purple-600': isTrimMode }"
				type="button"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243zm8.486-.486a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"
					/>
				</svg>
			</button>
			<div class="text-sm text-gray-300">{{ formatTime(duration) }}</div>
		</div>

		<div class="flex flex-row space-x-4">
			<!-- Ses Kontrol Butonu -->
			<button
				@click="$emit('toggleMute')"
				class="px-4 py-2 rounded-lg flex items-center"
				type="button"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						v-if="!isMuted"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
					/>
					<path
						v-else
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
					/>
				</svg>
			</button>
		</div>
	</div>
</template>

<script setup>
const props = defineProps({
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
	isTrimMode: {
		type: Boolean,
		default: false,
	},
	selectedRatio: {
		type: String,
		default: "",
	},
	isMuted: {
		type: Boolean,
		default: false,
	},
});

const emit = defineEmits([
	"toggle-playback",
	"toggle-trim-mode",
	"update:selected-ratio",
	"toggle-mute",
]);

const formatTime = (seconds) => {
	if (!seconds || isNaN(seconds)) return "00:00:00";

	const minutes = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	const centiseconds = Math.floor((seconds % 1) * 100);

	return `${minutes.toString().padStart(2, "0")}:${secs
		.toString()
		.padStart(2, "0")}:${centiseconds.toString().padStart(2, "0")}`;
};

// Aspect ratio değişikliği
const onAspectRatioChange = (ratio) => {
	emit("update:selected-ratio", ratio);
};
</script>

<style scoped>
select {
	appearance: none;
	background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
	background-repeat: no-repeat;
	background-position: right 0.5rem center;
	background-size: 1em;
	padding-right: 2.5rem;
}

button {
	transition: all 0.2s ease;
}

button:active {
	transform: scale(0.95);
}
</style>
