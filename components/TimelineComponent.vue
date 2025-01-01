<template>
	<div class="w-full max-w-[1000px] mx-auto p-4 bg-gray-900 rounded-lg">
		<div class="flex justify-between items-center mb-4">
			<div class="text-lg font-semibold text-gray-300">Timeline</div>
			<div class="flex gap-2">
				<button
					@click="handleZoomOut"
					class="p-2 rounded hover:bg-gray-800"
					title="Zoom Out"
					:disabled="zoomLevel <= 1"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="w-5 h-5"
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
				<button
					@click="handleZoomIn"
					class="p-2 rounded hover:bg-gray-800"
					title="Zoom In"
					:disabled="zoomLevel >= maxZoom"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="w-5 h-5"
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
			</div>
		</div>

		<div ref="containerRef" class="overflow-x-auto relative border rounded-lg">
			<div
				ref="timelineRef"
				class="relative h-20 bg-gray-800"
				:style="{ width: `${timelineWidth * zoomLevel}px` }"
				@click="handleTimelineClick"
				@wheel.ctrl.prevent="handleWheel"
			>
				<!-- Zaman İşaretleri -->
				<div
					v-for="time in timeMarkers"
					:key="time"
					class="absolute flex flex-col items-center"
					:style="{
						left: `${(time / duration) * timelineWidth * zoomLevel}px`,
						transform: 'translateX(-50%)',
					}"
				>
					<div
						class="h-3 w-0.5"
						:class="{
							'bg-gray-500': time % 60 === 0,
							'bg-gray-600': time % 30 === 0 && time % 60 !== 0,
							'bg-gray-700': time % 10 === 0 && time % 30 !== 0,
						}"
					></div>
					<span v-if="shouldShowTime(time)" class="text-xs text-gray-400 mt-1">
						{{ formatDetailedTime(time) }}
					</span>
				</div>

				<!-- Oynatma İmleci -->
				<div
					class="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10"
					:style="{
						left: `${(currentTime / duration) * timelineWidth * zoomLevel}px`,
						transform: 'translateX(-50%)',
					}"
				></div>

				<!-- Playhead -->
				<div
					class="absolute -top-2 w-4 h-4 cursor-pointer z-20"
					:style="{
						left: `${(currentTime / duration) * timelineWidth * zoomLevel}px`,
						transform: 'translateX(-50%)',
					}"
					@mousedown.stop="startPlayheadDrag"
				>
					<div class="w-4 h-4 bg-blue-500 rounded-full hover:bg-blue-400"></div>
				</div>
			</div>
		</div>

		<div class="mt-2 flex justify-between text-sm text-gray-400">
			<span>{{ formatDetailedTime(currentTime) }}</span>
			<span>{{ formatDetailedTime(duration) }}</span>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from "vue";

const props = defineProps({
	duration: {
		type: Number,
		default: 600, // 10 dakika
	},
	currentTime: {
		type: Number,
		default: 0,
	},
});

const emit = defineEmits(["timeUpdate"]);

// Referanslar ve Sabitler
const containerRef = ref(null);
const timelineRef = ref(null);
const timelineWidth = 1000;
const zoomLevel = ref(1);
const minZoom = 1;
const maxZoom = 10;

// Zaman işaretleri
const timeMarkers = computed(() => {
	const markers = [];
	const step = Math.max(10 / zoomLevel.value, 1);
	for (let time = 0; time <= props.duration; time += step) {
		markers.push(time);
	}
	return markers;
});

// Zaman formatı
const formatDetailedTime = (seconds) => {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

// Zaman gösterme kontrolü
const shouldShowTime = (time) => {
	if (zoomLevel.value >= 4) return time % 10 === 0;
	if (zoomLevel.value >= 2) return time % 30 === 0;
	return time % 60 === 0;
};

// Timeline tıklama
const handleTimelineClick = (event) => {
	if (!containerRef.value) return;

	const rect = containerRef.value.getBoundingClientRect();
	const x = event.clientX - rect.left + containerRef.value.scrollLeft;
	const secondsPerPixel = props.duration / (timelineWidth * zoomLevel.value);
	const newTime = Math.max(0, Math.min(props.duration, x * secondsPerPixel));

	emit("timeUpdate", newTime);
};

// Zoom kontrolleri
const handleZoomIn = () => {
	zoomLevel.value = Math.min(zoomLevel.value * 1.5, maxZoom);
	updateScroll();
};

const handleZoomOut = () => {
	zoomLevel.value = Math.max(zoomLevel.value / 1.5, minZoom);
	updateScroll();
};

const handleWheel = (event) => {
	const delta = event.deltaY > 0 ? -0.1 : 0.1;
	const newZoom = Math.max(
		minZoom,
		Math.min(maxZoom, zoomLevel.value * (1 + delta))
	);

	// Zoom yaparken imlecin altındaki zamanı sabit tut
	const rect = containerRef.value.getBoundingClientRect();
	const mouseX = event.clientX - rect.left + containerRef.value.scrollLeft;
	const timeAtMouse =
		(mouseX / (timelineWidth * zoomLevel.value)) * props.duration;

	zoomLevel.value = newZoom;

	// Yeni scroll pozisyonunu hesapla
	const newMouseX = (timeAtMouse / props.duration) * timelineWidth * newZoom;
	containerRef.value.scrollLeft = newMouseX - (event.clientX - rect.left);
};

// Playhead sürükleme
let isPlayheadDragging = false;

const startPlayheadDrag = (event) => {
	event.stopPropagation();
	isPlayheadDragging = true;
	document.addEventListener("mousemove", handlePlayheadDrag);
	document.addEventListener("mouseup", stopPlayheadDrag);
};

const handlePlayheadDrag = (event) => {
	if (!isPlayheadDragging || !containerRef.value) return;

	const rect = containerRef.value.getBoundingClientRect();
	const x = event.clientX - rect.left + containerRef.value.scrollLeft;
	const secondsPerPixel = props.duration / (timelineWidth * zoomLevel.value);
	const newTime = Math.max(0, Math.min(props.duration, x * secondsPerPixel));

	emit("timeUpdate", newTime);
};

const stopPlayheadDrag = () => {
	isPlayheadDragging = false;
	document.removeEventListener("mousemove", handlePlayheadDrag);
	document.removeEventListener("mouseup", stopPlayheadDrag);
};

// Scroll pozisyonunu güncelle
const updateScroll = () => {
	if (!containerRef.value) return;

	const container = containerRef.value;
	const markerPosition =
		(props.currentTime / props.duration) * timelineWidth * zoomLevel.value;
	const viewportWidth = container.clientWidth;

	if (
		markerPosition > container.scrollLeft + viewportWidth * 0.7 ||
		markerPosition < container.scrollLeft + viewportWidth * 0.3
	) {
		container.scrollLeft = markerPosition - viewportWidth / 2;
	}
};

// Oynatma konumunu izle
watch(
	() => props.currentTime,
	() => {
		updateScroll();
	}
);

// Event listener'ları temizle
onUnmounted(() => {
	document.removeEventListener("mousemove", handlePlayheadDrag);
	document.removeEventListener("mouseup", stopPlayheadDrag);
});
</script>

<style scoped>
.overflow-x-auto {
	overflow-x: auto;
	overflow-y: hidden;
	scroll-behavior: smooth;
}

.overflow-x-auto::-webkit-scrollbar {
	height: 8px;
}

.overflow-x-auto::-webkit-scrollbar-track {
	background: #1f2937;
	border-radius: 4px;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
	background: #4b5563;
	border-radius: 4px;
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover {
	background: #6b7280;
}

button:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
</style>
