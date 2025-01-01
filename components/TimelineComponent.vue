<template>
	<div class="timeline-container w-full bg-gray-900 flex flex-col p-4">
		<!-- Timeline Ana Bölümü -->
		<div
			ref="containerRef"
			class="timeline-main relative h-32 bg-gray-800 rounded-lg mb-4 overflow-x-auto"
		>
			<div
				ref="timelineRef"
				class="timeline-content relative h-full cursor-pointer"
				:style="{ width: `${timelineWidth * zoomLevel}px` }"
				@click="handleTimelineClick"
				@wheel.ctrl.prevent="handleWheel"
				@mousedown="startDragging"
				@mousemove="handleTimelineHover"
			>
				<!-- Hover İmleci -->
				<div
					v-if="hoverTime !== null"
					class="absolute top-0 bottom-0 w-0.5 bg-gray-500 opacity-50"
					:style="{
						left: `${(hoverTime / duration) * timelineWidth * zoomLevel}px`,
						transform: 'translateX(-50%)',
					}"
				>
					<div
						class="absolute -top-6 left-2 text-xs text-gray-400 whitespace-nowrap"
					>
						{{ formatDetailedTime(hoverTime) }}
					</div>
				</div>

				<!-- Zaman İşaretleri -->
				<div
					v-for="time in timeMarkers"
					:key="time"
					class="absolute flex flex-col items-center"
					:style="{
						left: `${(time / duration) * timelineWidth * zoomLevel}px`,
					}"
				>
					<div
						class="h-3 w-0.5"
						:class="{
							'bg-gray-600': time % 60 === 0,
							'bg-gray-700': time % 60 !== 0,
						}"
					></div>
					<span
						v-if="shouldShowTime(time)"
						class="text-xs text-gray-400 whitespace-nowrap"
					>
						{{ formatDetailedTime(time) }}
					</span>
				</div>

				<!-- Oynatma İmleci ve Başlığı -->
				<div
					class="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10"
					:style="{
						left: `${(currentTime / duration) * timelineWidth * zoomLevel}px`,
						transform: 'translateX(-50%)',
					}"
				></div>
				<div
					class="absolute -top-2 w-4 h-4 cursor-move z-20"
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

		<!-- Alt Bilgi ve Kontroller -->
		<div class="flex justify-between items-center">
			<!-- Zaman Bilgisi -->
			<div class="flex gap-4 text-sm text-gray-400">
				<span>Şu an: {{ formatDetailedTime(currentTime) }}</span>
				<span>Toplam: {{ formatDetailedTime(duration) }}</span>
			</div>

			<!-- Zoom Kontrolleri -->
			<div class="flex items-center gap-2">
				<button
					class="p-2 hover:bg-gray-700 rounded-lg"
					@click="handleZoomOut"
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
				<span class="text-sm text-gray-400"
					>{{ Math.round(zoomLevel * 100) }}%</span
				>
				<button
					class="p-2 hover:bg-gray-700 rounded-lg"
					@click="handleZoomIn"
					:disabled="zoomLevel >= 10"
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
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";

const props = defineProps({
	duration: {
		type: Number,
		default: 600,
	},
	currentTime: {
		type: Number,
		default: 0,
	},
});

const emit = defineEmits(["timeUpdate"]);

// Referanslar
const containerRef = ref(null);
const timelineRef = ref(null);

// Sabitler ve State
const timelineWidth = 1000;
const zoomLevel = ref(1);
const minZoom = 1;
const maxZoom = 10;

// Zaman işaretleri
const timeMarkers = computed(() => {
	const markers = [];
	const step = Math.max(30 / zoomLevel.value, 5);
	for (let time = 0; time <= props.duration; time += step) {
		markers.push(time);
	}
	return markers;
});

// Zaman formatı
const formatDetailedTime = (seconds) => {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
		.toString()
		.padStart(2, "0")}`;
};

// Timeline tıklama
const handleTimelineClick = (event) => {
	if (!containerRef.value) return;

	const rect = containerRef.value.getBoundingClientRect();
	const x = event.clientX - rect.left + containerRef.value.scrollLeft;
	const secondsPerPixel = props.duration / (timelineWidth * zoomLevel.value);
	const newTime = x * secondsPerPixel;

	if (newTime >= 0 && newTime <= props.duration) {
		emit("timeUpdate", newTime);
	}
};

// Zoom kontrolleri
const handleZoomIn = () => {
	zoomLevel.value = Math.min(zoomLevel.value * 1.5, maxZoom);
};

const handleZoomOut = () => {
	zoomLevel.value = Math.max(zoomLevel.value / 1.5, minZoom);
};

// Zaman etiketinin gösterilip gösterilmeyeceğini belirle
const shouldShowTime = (second) => {
	if (zoomLevel.value >= 4) return second % 5 === 0;
	if (zoomLevel.value >= 3) return second % 15 === 0;
	if (zoomLevel.value >= 2) return second % 30 === 0;
	return second % 60 === 0;
};

// Oynatma imlecini görünür tut
watch(
	() => props.currentTime,
	() => {
		if (!containerRef.value) return;

		const markerPosition =
			(props.currentTime / props.duration) * timelineWidth * zoomLevel.value;
		const container = containerRef.value;
		const viewportWidth = container.clientWidth;

		if (
			markerPosition > container.scrollLeft + viewportWidth * 0.7 ||
			markerPosition < container.scrollLeft + viewportWidth * 0.3
		) {
			container.scrollLeft = markerPosition - viewportWidth / 2;
		}
	}
);

// Mouse takibi için state
const isDragging = ref(false);
const isPlayheadDragging = ref(false);
const startX = ref(0);
const startScrollLeft = ref(0);
const hoverTime = ref(null);

// Timeline üzerinde hover
const handleTimelineHover = (event) => {
	if (isDragging.value || isPlayheadDragging.value) return;

	const rect = containerRef.value.getBoundingClientRect();
	const x = event.clientX - rect.left + containerRef.value.scrollLeft;
	const secondsPerPixel = props.duration / (timelineWidth * zoomLevel.value);
	hoverTime.value = Math.max(0, Math.min(props.duration, x * secondsPerPixel));
};

// Timeline sürükleme
const startDragging = (event) => {
	if (event.target.closest(".cursor-move")) return;

	isDragging.value = true;
	startX.value = event.pageX - containerRef.value.offsetLeft;
	startScrollLeft.value = containerRef.value.scrollLeft;

	document.addEventListener("mousemove", handleDragging);
	document.addEventListener("mouseup", stopDragging);
};

const handleDragging = (event) => {
	if (!isDragging.value) return;

	const x = event.pageX - containerRef.value.offsetLeft;
	const walk = (startX.value - x) * 2;
	containerRef.value.scrollLeft = startScrollLeft.value + walk;
};

const stopDragging = () => {
	isDragging.value = false;
	document.removeEventListener("mousemove", handleDragging);
	document.removeEventListener("mouseup", stopDragging);
};

// Playhead sürükleme
const startPlayheadDrag = (event) => {
	event.stopPropagation();
	isPlayheadDragging.value = true;
	document.addEventListener("mousemove", handlePlayheadDrag);
	document.addEventListener("mouseup", stopPlayheadDrag);
};

const handlePlayheadDrag = (event) => {
	if (!isPlayheadDragging.value) return;

	const rect = containerRef.value.getBoundingClientRect();
	const x = event.clientX - rect.left + containerRef.value.scrollLeft;
	const secondsPerPixel = props.duration / (timelineWidth * zoomLevel.value);
	const newTime = Math.max(0, Math.min(props.duration, x * secondsPerPixel));

	emit("timeUpdate", newTime);
};

const stopPlayheadDrag = () => {
	isPlayheadDragging.value = false;
	document.removeEventListener("mousemove", handlePlayheadDrag);
	document.removeEventListener("mouseup", stopPlayheadDrag);
};

// Ctrl + Wheel ile zoom
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

// Event listener'ları temizle
onUnmounted(() => {
	document.removeEventListener("mousemove", handleDragging);
	document.removeEventListener("mouseup", stopDragging);
	document.removeEventListener("mousemove", handlePlayheadDrag);
	document.removeEventListener("mouseup", stopPlayheadDrag);
});
</script>

<style scoped>
.timeline-container {
	user-select: none;
}

.timeline-main {
	overflow-x: auto;
	overflow-y: hidden;
	scroll-behavior: smooth;
}

.timeline-content {
	height: 100%;
	position: relative;
}

.timeline-content:hover {
	background-color: rgba(255, 255, 255, 0.02);
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
