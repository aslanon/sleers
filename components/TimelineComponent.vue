<template>
	<div class="timeline-container p-12 relative flex flex-col text-white">
		<!-- Timeline Header -->
		<div class="flex justify-between items-center px-4 py-2">
			<div class="text-sm font-medium text-gray-300">Timeline</div>
			<div class="flex gap-1">
				<button
					class="p-1.5 rounded hover:bg-gray-800"
					@click="currentZoom = Math.max(minZoom, currentZoom / 2)"
					:disabled="currentZoom <= minZoom"
				>
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
						/>
						<path d="M7 9h5v1H7z" />
					</svg>
				</button>
				<button
					class="p-1.5 rounded hover:bg-gray-800"
					@click="currentZoom = Math.min(maxZoom, currentZoom * 2)"
					:disabled="currentZoom >= maxZoom"
				>
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
						/>
						<path d="M7 9h5v1H7zm2-2h1v5H9z" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Timeline Ruler -->
		<div class="overflow-x-auto">
			<div
				ref="timelineRef"
				class="timeline-ruler mx: 8 px-8 relative h-24 select-none"
				@wheel="handleWheel"
				@mousedown="startDragging"
				@click="handleTimelineClick"
			>
				<div
					class="timeline-content relative h-full"
					:style="{ width: `${timelineWidth}px` }"
				>
					<!-- Zaman İşaretleri -->
					<div
						v-for="marker in timeMarkers"
						:key="marker.time"
						class="absolute flex flex-col items-center"
						:style="{
							left: `${marker.position}%`,
							transform: 'translateX(-50%)',
						}"
					>
						<div
							class="w-0.5"
							:class="{
								'h-4 bg-gray-400': marker.isHour,
								'h-3 bg-gray-500': !marker.isHour && marker.isMinute,
								'h-2 bg-gray-600':
									!marker.isHour && !marker.isMinute && marker.isHalfMinute,
								'h-1.5 bg-gray-700':
									!marker.isHour && !marker.isMinute && !marker.isHalfMinute,
							}"
						></div>
						<span
							v-if="shouldShowTime(marker.time)"
							class="text-[10px] text-gray-400 mt-0.5"
							:class="{
								'font-medium': marker.isHour || marker.isMinute,
							}"
						>
							{{ marker.label }}
						</span>
					</div>

					<!-- Video Track -->
					<div
						class="absolute left-0 right-0 bottom-8 h-12 flex items-center px-2"
					>
						<div
							class="timeline-layer-bar w-full h-8 bg-gray-800/50 rounded-xl"
						>
							<!-- Video Segments -->
							<div
								v-for="(segment, index) in props.segments"
								:key="index"
								class="absolute h-full bg-orange-300 rounded-xl"
								:style="{
									left: `${(segment.start / maxDuration.value) * 100}%`,
									width: `${
										((segment.end - segment.start) / maxDuration.value) * 100
									}%`,
								}"
							></div>
						</div>
					</div>

					<!-- Playhead -->
					<div
						class="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
						:style="{
							left: `${playheadPosition}%`,
							transform: 'translateX(-50%)',
						}"
					></div>

					<!-- Playhead Handle -->
					<div
						class="absolute -top-1 w-3 h-3 cursor-pointer z-20"
						:style="{
							left: `${playheadPosition}%`,
							transform: 'translateX(-50%)',
						}"
					>
						<div class="w-3 h-3 bg-red-500 rounded-full"></div>
					</div>
				</div>
			</div>
		</div>
		<!-- Timeline Footer -->
		<div
			class="flex justify-between items-center px-4 py-2 text-xs text-gray-400"
		>
			<span>Current Time: {{ formatTime(props.currentTime) }}</span>
			<span>Total Duration: {{ formatTime(props.duration) }}</span>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";

const props = defineProps({
	duration: {
		type: Number,
		required: true,
	},
	currentTime: {
		type: Number,
		default: 0,
	},
	segments: {
		type: Array,
		default: () => [],
	},
});

const emit = defineEmits(["timeUpdate"]);

// Referanslar ve state
const timelineRef = ref(null);
const currentZoom = ref(1);
const isDragging = ref(false);
const startDragX = ref(0);
const startScrollLeft = ref(0);

// Zoom sabitleri
const minZoom = 0.01; // 100x uzaklaştırma
const maxZoom = 20; // 20x yakınlaştırma
const zoomStep = 0.1; // Zoom adımı

// Timeline sabitleri
const maxDuration = computed(() => Math.max(props.duration, 600)); // Minimum 10 dakika

// Timeline genişliği
const timelineWidth = computed(() => {
	return maxDuration.value * 100 * currentZoom.value; // Her saniye için 100px
});

// Playhead pozisyonu
const playheadPosition = computed(() => {
	return (props.currentTime / maxDuration.value) * 100;
});

// Zaman işaretleri
const timeMarkers = computed(() => {
	const markers = [];
	const totalSeconds = Math.ceil(maxDuration.value);

	// Zoom seviyesine göre marker aralığını belirle
	let interval;
	if (currentZoom.value <= 0.02) interval = 600; // Her 10 dakika
	else if (currentZoom.value <= 0.05) interval = 300; // Her 5 dakika
	else if (currentZoom.value <= 0.1) interval = 120; // Her 2 dakika
	else if (currentZoom.value <= 0.2) interval = 60; // Her dakika
	else if (currentZoom.value <= 0.5) interval = 30; // Her 30 saniye
	else if (currentZoom.value <= 1) interval = 15; // Her 15 saniye
	else if (currentZoom.value <= 2) interval = 5; // Her 5 saniye
	else if (currentZoom.value <= 5) interval = 2; // Her 2 saniye
	else interval = 1; // Her saniye

	for (let i = 0; i <= totalSeconds; i += interval) {
		const hours = Math.floor(i / 3600);
		const minutes = Math.floor((i % 3600) / 60);
		const seconds = i % 60;

		let label;
		if (hours > 0) {
			label = `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
				.toString()
				.padStart(2, "0")}`;
		} else {
			label = `${minutes.toString().padStart(2, "0")}:${seconds
				.toString()
				.padStart(2, "0")}`;
		}

		markers.push({
			time: i,
			label,
			position: (i / maxDuration.value) * 100,
			isHour: i % 3600 === 0,
			isMinute: i % 60 === 0,
			isHalfMinute: i % 30 === 0,
		});
	}

	return markers;
});

// Zaman gösterme kontrolü
const shouldShowTime = (time) => {
	if (currentZoom.value <= 0.02) return time % 600 === 0; // Her 10 dakika
	if (currentZoom.value <= 0.05) return time % 300 === 0; // Her 5 dakika
	if (currentZoom.value <= 0.1) return time % 120 === 0; // Her 2 dakika
	if (currentZoom.value <= 0.2) return time % 60 === 0; // Her dakika
	if (currentZoom.value <= 0.5) return time % 30 === 0; // Her 30 saniye
	if (currentZoom.value <= 1) return time % 15 === 0; // Her 15 saniye
	if (currentZoom.value <= 2) return time % 5 === 0; // Her 5 saniye
	if (currentZoom.value <= 5) return time % 2 === 0; // Her 2 saniye
	return true; // Her saniye
};

// Timeline tıklama ve sürükleme
const handleTimelineClick = (e) => {
	if (isDragging.value) return;

	const container = timelineRef.value;
	const rect = container.getBoundingClientRect();
	const x = e.clientX - rect.left + container.scrollLeft;
	const time = (x / timelineWidth.value) * maxDuration.value;

	// Video süresini aşmayacak şekilde sınırla
	emit("timeUpdate", Math.max(0, Math.min(props.duration, time)));
};

const startDragging = (e) => {
	isDragging.value = true;
	startDragX.value = e.clientX;
	startScrollLeft.value = timelineRef.value.scrollLeft;
};

const stopDragging = () => {
	isDragging.value = false;
};

const handleDrag = (e) => {
	if (!isDragging.value) return;

	const dx = e.clientX - startDragX.value;
	timelineRef.value.scrollLeft = startScrollLeft.value - dx;
};

// Mouse wheel ile zoom
const handleWheel = (e) => {
	if (e.ctrlKey || e.metaKey) {
		e.preventDefault();

		const delta = -Math.sign(e.deltaY) * zoomStep;
		const newZoom = Math.max(
			minZoom,
			Math.min(maxZoom, currentZoom.value + delta)
		);

		if (newZoom !== currentZoom.value) {
			// Zoom yaparken mouse pozisyonunu merkez al
			const container = timelineRef.value;
			const mouseX = e.clientX - container.getBoundingClientRect().left;
			const scrollLeftBeforeZoom = container.scrollLeft;
			const containerWidthBeforeZoom = container.scrollWidth;

			currentZoom.value = newZoom;

			// Zoom sonrası scroll pozisyonunu güncelle
			nextTick(() => {
				const scale = container.scrollWidth / containerWidthBeforeZoom;
				container.scrollLeft =
					mouseX * (scale - 1) + scrollLeftBeforeZoom * scale;
			});
		}
	}
};

// Zaman formatı
const formatTime = (seconds) => {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
			.toString()
			.padStart(2, "0")}`;
	}
	return `${minutes.toString().padStart(2, "0")}:${secs
		.toString()
		.padStart(2, "0")}`;
};

// Component mount/unmount
onMounted(() => {
	window.addEventListener("mouseup", stopDragging);
	window.addEventListener("mousemove", handleDrag);
});

onUnmounted(() => {
	window.removeEventListener("mouseup", stopDragging);
	window.removeEventListener("mousemove", handleDrag);
});
</script>

<style scoped>
.timeline-ruler::-webkit-scrollbar {
	height: 6px;
}

.timeline-ruler::-webkit-scrollbar-track {
	background: #1f2937;
}

.timeline-ruler::-webkit-scrollbar-thumb {
	background: #4b5563;
	border-radius: 3px;
}

.timeline-ruler::-webkit-scrollbar-thumb:hover {
	background: #6b7280;
}

button:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
</style>
