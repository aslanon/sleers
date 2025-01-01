<template>
	<div class="timeline-container w-full bg-gray-900 flex flex-col p-4">
		<!-- Timeline Ana Bölümü -->
		<div class="timeline-main relative h-32 bg-gray-800 rounded-lg mb-4">
			<!-- Zaman İşaretleri -->
			<div
				class="time-markers absolute inset-0"
				:style="{ transform: `scaleX(${zoomLevel})`, transformOrigin: 'left' }"
			>
				<div
					v-for="second in totalSeconds"
					:key="second"
					class="absolute h-full border-l"
					:class="{
						'border-l-2 border-gray-600': second % 60 === 0,
						'border-l border-gray-700': second % getTimeInterval() === 0,
						hidden: !shouldShowMarker(second),
					}"
					:style="{
						left: `${(second / totalSeconds) * 100}%`,
					}"
				>
					<span
						v-if="shouldShowTime(second)"
						class="absolute -top-6 left-2 text-xs text-gray-400 whitespace-nowrap"
					>
						{{ formatDetailedTime(second) }}
					</span>
				</div>
			</div>

			<!-- Oynatma İmleci -->
			<div
				class="playhead absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
				:style="{
					left: `${(currentTime / duration) * 100 * zoomLevel}%`,
				}"
			></div>

			<!-- Timeline İçeriği -->
			<div
				class="timeline-content absolute inset-0"
				:style="{ transform: `scaleX(${zoomLevel})`, transformOrigin: 'left' }"
				@wheel.ctrl.prevent="handleZoom"
				@mousedown="startDragging"
			></div>
		</div>

		<!-- Zoom Kontrolü -->
		<div
			class="zoom-controls flex items-center gap-4 p-2 bg-gray-800 rounded-lg"
		>
			<button
				class="p-2 hover:bg-gray-700 rounded-lg"
				@click="adjustZoom(-0.5)"
				:disabled="zoomLevel <= 1"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
						clip-rule="evenodd"
					/>
					<path
						fill-rule="evenodd"
						d="M5 8a1 1 0 011-1h4a1 1 0 110 2H6a1 1 0 01-1-1z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
			<div class="text-sm text-gray-400">
				{{ Math.round(zoomLevel * 100) }}%
			</div>
			<button
				class="p-2 hover:bg-gray-700 rounded-lg"
				@click="adjustZoom(0.5)"
				:disabled="zoomLevel >= 5"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
						clip-rule="evenodd"
					/>
					<path
						fill-rule="evenodd"
						d="M8 5a1 1 0 000 2h2v2a1 1 0 102 0V7h2a1 1 0 100-2h-2V3a1 1 0 10-2 0v2H8z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
			<button
				class="ml-4 px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm"
				@click="resetZoom"
			>
				Sıfırla
			</button>
		</div>
	</div>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
	duration: {
		type: Number,
		default: 600, // Varsayılan 10 dakika (saniye cinsinden)
	},
	currentTime: {
		type: Number,
		default: 0,
	},
});

const emit = defineEmits(["timeUpdate"]);

// Zoom seviyesi (1 = normal, > 1 = yakınlaştırılmış)
const zoomLevel = ref(1);
const minZoom = 1;
const maxZoom = 5;

// Timeline hesaplamaları
const totalSeconds = computed(() => props.duration);

// Detaylı zaman formatı (00:00 şeklinde)
const formatDetailedTime = (seconds) => {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
		.toString()
		.padStart(2, "0")}`;
};

// Basit zaman formatı
const formatTime = (seconds) => {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

// Zoom seviyesine göre zaman aralığını belirle
const getTimeInterval = () => {
	if (zoomLevel.value >= 4) return 1; // Her saniye
	if (zoomLevel.value >= 3) return 5; // Her 5 saniye
	if (zoomLevel.value >= 2) return 15; // Her 15 saniye
	if (zoomLevel.value >= 1.5) return 30; // Her 30 saniye
	return 60; // Her dakika
};

// İşaretçinin gösterilip gösterilmeyeceğini belirle
const shouldShowMarker = (second) => {
	return second % getTimeInterval() === 0;
};

// Zaman etiketinin gösterilip gösterilmeyeceğini belirle
const shouldShowTime = (second) => {
	if (zoomLevel.value >= 4) return second % 5 === 0; // Her 5 saniyede bir
	if (zoomLevel.value >= 3) return second % 15 === 0; // Her 15 saniyede bir
	if (zoomLevel.value >= 2) return second % 30 === 0; // Her 30 saniyede bir
	if (zoomLevel.value >= 1.5) return second % 60 === 0; // Her dakikada bir
	return second % 60 === 0; // Her dakikada bir
};

// Zoom kontrolleri
const adjustZoom = (delta) => {
	const newZoom = Math.max(minZoom, Math.min(maxZoom, zoomLevel.value + delta));
	zoomLevel.value = newZoom;
};

const resetZoom = () => {
	zoomLevel.value = 1;
};

const handleZoom = (event) => {
	const delta = event.deltaY > 0 ? -0.1 : 0.1;
	adjustZoom(delta);
};

// Timeline sürükleme
let isDragging = false;
let startX = 0;
let scrollLeft = 0;

const startDragging = (event) => {
	isDragging = true;
	startX = event.pageX - event.currentTarget.offsetLeft;
	scrollLeft = event.currentTarget.scrollLeft;

	document.addEventListener("mousemove", handleDragging);
	document.addEventListener("mouseup", stopDragging);
};

const handleDragging = (event) => {
	if (!isDragging) return;

	const x = event.pageX - event.currentTarget.offsetLeft;
	const walk = (x - startX) * 2;
	event.currentTarget.scrollLeft = scrollLeft - walk;
};

const stopDragging = () => {
	isDragging = false;
	document.removeEventListener("mousemove", handleDragging);
	document.removeEventListener("mouseup", stopDragging);
};
</script>

<style scoped>
.timeline-container {
	user-select: none;
	overflow: hidden;
}

.timeline-main {
	overflow-x: auto;
	overflow-y: hidden;
	scroll-behavior: smooth;
}

.timeline-content {
	min-width: 100%;
	height: 100%;
}

/* Scrollbar stilleri */
.timeline-main::-webkit-scrollbar {
	height: 8px;
}

.timeline-main::-webkit-scrollbar-track {
	background: #1f2937;
	border-radius: 4px;
}

.timeline-main::-webkit-scrollbar-thumb {
	background: #4b5563;
	border-radius: 4px;
}

.timeline-main::-webkit-scrollbar-thumb:hover {
	background: #6b7280;
}

button:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
</style>
