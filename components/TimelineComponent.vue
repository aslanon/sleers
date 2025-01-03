<template>
	<div
		class="timeline-container min-h-[300px] flex-1 relative flex flex-col text-white"
	>
		<!-- Timeline Header -->
		<div class="flex justify-between items-center px-4 py-2">
			<div class="text-sm font-medium text-gray-300"></div>
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
		<div
			ref="scrollContainerRef"
			class="overflow-x-scroll overflow-y-hidden scroll-smooth"
		>
			<!-- @wheel.prevent="handleContainerWheel" -->
			<div
				ref="timelineRef"
				class="timeline-ruler relative h-full select-none"
				@mousedown="startDragging"
				@click="handleTimelineClick"
			>
				<div
					class="timeline-content relative h-[200px] transition-all ease-linear duration-300"
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
						<span
							v-if="marker.time != 0 && shouldShowTime(marker.time)"
							class="text-[12px] text-white/20 mt-0.5"
							:class="{
								'font-medium': marker.isHour || marker.isMinute,
							}"
						>
							{{ marker.label }}
						</span>
						<div v-if="marker.time != 0" class="w-1 h-1 bg-white/20"></div>
					</div>

					<!-- Video Track -->
					<div class="absolute left-0 right-0 top-14 flex items-center px-2">
						<div class="timeline-layer-bar w-full rounded-xl relative">
							<!-- Video Segments Container -->
							<div
								class="flex flex-row h-12 relative w-full"
								@dragover.prevent
								@drop.prevent="handleSegmentDrop"
							>
								<!-- Video Segments -->
								<div
									v-for="(segment, index) in props.segments"
									:key="segment.id || index"
									class="h-full relative cursor-move transition-all duration-200 group"
									:class="{
										'hover:ring-[1px] hover:ring-white/80 ': !isDragging,
									}"
									:style="getSegmentStyle(segment, index)"
									draggable="true"
									@dragstart="handleSegmentDragStart($event, index)"
									@dragover="handleSegmentDragOver($event, index)"
									@dragleave="handleSegmentDragLeave($event)"
									@dragend="handleSegmentDragEnd"
									@click.stop="handleSegmentClick(index, $event)"
									@mousemove="handleSegmentMouseMove($event, index)"
									@mouseleave="handleSegmentMouseLeave"
									@mousedown.stop="
										isSplitMode ? handleSegmentSplit($event, index) : null
									"
								>
									<!-- Sol Kenar İşaretleri -->
									<div
										class="absolute left-0 top-0 bottom-0 w-2 flex items-center justify-start opacity-80"
									>
										<div class="flex space-x-[2px]">
											<div class="w-[2px] h-full bg-white"></div>
											<div class="w-[2px] h-full bg-white"></div>
										</div>
									</div>

									<!-- Sağ Kenar İşaretleri -->
									<div
										class="absolute right-0 top-0 bottom-0 w-2 flex items-center justify-end opacity-80"
									>
										<div class="flex space-x-[2px]">
											<div class="w-[2px] h-full bg-white"></div>
											<div class="w-[2px] h-full bg-white"></div>
										</div>
									</div>

									<!-- Segment İçeriği -->
									<div
										class="absolute inset-0 flex flex-col items-center justify-center text-center"
									>
										<span
											class="text-white/30 text-[12px] font-medium tracking-wide"
											>Clip</span
										>
										<span
											class="text-white/90 text-sm font-medium tracking-wide mt-0.5"
										>
											{{ formatDuration(segment.end - segment.start) }} @ 1x
										</span>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Playhead -->
					<div
						class="absolute top-0 bottom-0 transition-all ease-linear duration-300 w-0.5 bg-red-500 z-10"
						:style="{
							left: `${playheadPosition}%`,
							transform: 'translateX(-50%)',
						}"
					></div>

					<!-- Playhead Handle -->
					<div
						class="absolute top-0 w-3 h-3 transition-all ease-linear duration-300 cursor-pointer z-20"
						:style="{
							left: `${playheadPosition}%`,
							transform: 'translateX(-50%)',
						}"
						@mousedown="handleSegmentDragStart(index, $event)"
					>
						<div class="w-3 h-3 bg-red-500 rounded-full"></div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";

const props = defineProps({
	duration: {
		type: Number,
		required: true,
		validator: (value) => value >= 0,
	},
	currentTime: {
		type: Number,
		default: 0,
		validator: (value) => value >= 0,
	},
	segments: {
		type: Array,
		default: () => [],
		validator: (segments) =>
			segments.every(
				(segment) =>
					segment.start >= 0 &&
					segment.end >= segment.start &&
					typeof segment.start === "number" &&
					typeof segment.end === "number"
			),
	},
	minZoom: {
		type: Number,
		default: 10,
	},
	maxZoom: {
		type: Number,
		default: 20,
	},
	isSplitMode: {
		type: Boolean,
		default: false,
	},
});

const emit = defineEmits([
	"timeUpdate",
	"segmentUpdate",
	"segmentSelect",
	"splitSegment",
	"segmentsReordered",
]);

// Referanslar ve state
const scrollContainerRef = ref(null);
const timelineRef = ref(null);
const currentZoom = ref(3);
const isDragging = ref(false);
const startDragX = ref(0);
const startScrollLeft = ref(0);
const startSegmentStart = ref(0);

// Yardımcı fonksiyonlar
const generateId = () => {
	return "segment-" + Math.random().toString(36).substring(2, 11);
};

// Zoom sabitleri
const minZoom = 0.1; // Minimum zoom değeri artırıldı
const maxZoom = 10; // Maximum zoom değeri artırıldı
const zoomStep = 0.4; // Zoom adımı artırıldı

// Timeline sabitleri
const maxDuration = computed(() => Math.max(props.duration, 600)); // Minimum 10 dakika

// Timeline genişliği
const timelineWidth = computed(() => {
	return maxDuration.value * 25 * currentZoom.value;
});

// Playhead pozisyonu
const playheadPosition = computed(() => {
	return (props.currentTime / maxDuration.value) * 100;
});

// Playhead'i takip et
watch(
	() => props.currentTime,
	(newTime) => {
		const container = scrollContainerRef.value;
		if (!container) return;

		const timelineWidth = container.scrollWidth;
		const containerWidth = container.clientWidth;
		const playheadX = (newTime / maxDuration.value) * timelineWidth;

		const scrollLeft = container.scrollLeft;
		const scrollRight = scrollLeft + containerWidth;

		if (playheadX > scrollRight - 100) {
			container.scrollTo({
				left: playheadX - containerWidth + 100,
				behavior: "auto",
			});
		} else if (playheadX < scrollLeft + 100) {
			container.scrollTo({
				left: playheadX - 100,
				behavior: "auto",
			});
		}
	},
	{ immediate: true }
);

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

// Aktif segment state'i
const activeSegmentIndex = ref(null);

// Segment pozisyonlama hesaplamaları
const getSegmentStyle = (segment, index) => {
	const start = segment.start || segment.startTime || 0;
	const end = segment.end || segment.endTime || maxDuration.value;
	const width = ((end - start) / maxDuration.value) * 100;
	const isDragging = draggedSegmentIndex.value === index;
	const isDropTarget = dropTargetInfo.value.segmentIndex === index;

	return {
		width: `calc(${width}% - 1px)`,
		left: `${(start / maxDuration.value) * 100}%`,
		position: "absolute",
		opacity: isDragging ? "0.5" : "1",
		transition: "all 0.2s ease",
		zIndex: isDropTarget ? "10" : "1",
		borderRadius: "10px",
		background: "linear-gradient(180deg, #b16b00 0%, #ce8515 100%)",
		border: "1px solid rgba(255, 255, 255, 0.2)",
		boxShadow: `
			inset 0 1px 0 0 rgba(255,255,255,0.15),
			0 1px 2px 0 rgba(0,0,0,0.05)
		`,
	};
};

// Segment seçme
const handleSegmentClick = (index, event) => {
	event.stopPropagation();
	activeSegmentIndex.value = index;
	emit("segmentSelect", index);
};

// Segment sürükleme
const handleSegmentDragStart = (event, index) => {
	if (props.isSplitMode) {
		event.preventDefault();
		return;
	}
	draggedSegmentIndex.value = index;
	event.dataTransfer.effectAllowed = "move";
};

// Segment üzerinde sürükleme
const handleSegmentDragOver = (event, index) => {
	event.preventDefault();
	if (draggedSegmentIndex.value === null || draggedSegmentIndex.value === index)
		return;

	const segment = event.currentTarget;
	const rect = segment.getBoundingClientRect();
	const mouseX = event.clientX - rect.left;
	const isFirstHalf = mouseX < rect.width / 2;

	dropTargetInfo.value = {
		segmentIndex: index,
		position: isFirstHalf ? "start" : "end",
	};
};

// Segment dışına sürükleme
const handleSegmentDragLeave = (event) => {
	event.preventDefault();
	dropTargetInfo.value = {
		segmentIndex: null,
		position: null,
	};
};

// Segment bırakıldığında
const handleSegmentDrop = (event) => {
	event.preventDefault();
	if (
		draggedSegmentIndex.value === null ||
		dropTargetInfo.value.segmentIndex === null
	)
		return;

	const newSegments = [...props.segments];
	const [draggedSegment] = newSegments.splice(draggedSegmentIndex.value, 1);
	let targetIndex = dropTargetInfo.value.segmentIndex;

	if (dropTargetInfo.value.position === "end") {
		targetIndex++;
	}
	if (draggedSegmentIndex.value < targetIndex) {
		targetIndex--;
	}

	// Yeni segmentleri oluştur ve zamanları güncelle
	newSegments.splice(targetIndex, 0, draggedSegment);

	// Segmentlerin zamanlarını sırayla güncelle
	let currentTime = 0;
	const updatedSegments = newSegments.map((segment) => {
		const duration = segment.end - segment.start;
		const updatedSegment = {
			...segment,
			start: currentTime,
			end: currentTime + duration,
			startTime: currentTime,
			endTime: currentTime + duration,
		};
		currentTime += duration;
		return updatedSegment;
	});

	emit("segmentsReordered", updatedSegments);

	// State'leri temizle
	draggedSegmentIndex.value = null;
	dropTargetInfo.value = {
		segmentIndex: null,
		position: null,
	};
};

// Sürükleme bittiğinde
const handleSegmentDragEnd = () => {
	draggedSegmentIndex.value = null;
	dropTargetInfo.value = {
		segmentIndex: null,
		position: null,
	};
};

// Timeline tıklama ve playhead güncelleme
const handleTimelineClick = (e) => {
	if (isDragging.value) return;

	const container = timelineRef.value;
	const rect = container.getBoundingClientRect();
	const x = e.clientX - rect.left + container.scrollLeft;
	const time = (x / timelineWidth.value) * maxDuration.value;

	// Sadece geçerli zaman aralığında olmasını kontrol et
	const validTime = Math.max(0, Math.min(props.duration, time));
	emit("timeUpdate", validTime);
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

// Mouse wheel ile zoom ve scroll
const handleContainerWheel = (e) => {
	if (e.ctrlKey || e.metaKey) {
		// Zoom işlemi
		const delta = -Math.sign(e.deltaY) * zoomStep;
		const newZoom = Math.max(
			minZoom,
			Math.min(maxZoom, currentZoom.value + delta)
		);

		if (newZoom !== currentZoom.value) {
			// Zoom yaparken mouse pozisyonunu merkez al
			const container = scrollContainerRef.value;
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
	} else {
		// Yatay scroll - hızı artırıldı
		const container = scrollContainerRef.value;
		if (container) {
			container.scrollLeft += e.deltaY * 10; // Scroll hızını 3 katına çıkardık
		}
	}
};

// Zaman formatı
const formatTime = (seconds) => {
	const minutes = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	const centiseconds = Math.floor((seconds % 1) * 100);

	return `${minutes.toString().padStart(2, "0")}:${secs
		.toString()
		.padStart(2, "0")}:${centiseconds.toString().padStart(2, "0")}`;
};

// Segment üzerinde mouse pozisyonu
const mousePosition = ref({ x: 0, segmentIndex: null });

// Segment üzerinde mouse hareketi
const handleSegmentMouseMove = (event, index) => {
	if (!props.isSplitMode) return;

	const segment = event.currentTarget;
	const rect = segment.getBoundingClientRect();
	const x = event.clientX - rect.left;
	mousePosition.value = { x, segmentIndex: index };
};

// Segment üzerinden mouse ayrıldığında
const handleSegmentMouseLeave = () => {
	mousePosition.value = { x: 0, segmentIndex: null };
};

// Segment bölme işlemi
const handleSegmentSplit = (event, index) => {
	if (!props.isSplitMode) return;
	event.stopPropagation();

	const segment = props.segments[index];
	if (!segment) return;

	const segmentEl = event.currentTarget;
	const rect = segmentEl.getBoundingClientRect();
	const x = event.clientX - rect.left;
	const ratio = x / rect.width;

	// Bölme noktasındaki zamanı hesapla
	const splitTime = segment.start + (segment.end - segment.start) * ratio;

	// İlk segment (sol taraf)
	const leftSegment = {
		id: generateId(),
		start: segment.start,
		end: splitTime,
		startTime: segment.start,
		endTime: splitTime,
		type: segment.type,
		layer: segment.layer,
	};

	// İkinci segment (sağ taraf)
	const rightSegment = {
		id: generateId(),
		start: splitTime,
		end: segment.end,
		startTime: splitTime,
		endTime: segment.end,
		type: segment.type,
		layer: segment.layer,
	};

	// Bölünmüş segmentleri emit et
	emit("splitSegment", {
		index,
		segments: [leftSegment, rightSegment],
		splitTime,
	});
};

// Sürükle-bırak state'leri
const draggedSegmentIndex = ref(null);
const dropTargetInfo = ref({
	segmentIndex: null,
	position: null, // 'start' veya 'end'
});

// Süre formatı güncellendi
const formatDuration = (seconds) => {
	const s = Math.floor(seconds);
	return `${s}s`;
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
/* ScrollContainer scrollbar'ını gizle */
.overflow-x-scroll::-webkit-scrollbar {
	display: none;
}

.overflow-x-scroll {
	-ms-overflow-style: none; /* IE ve Edge için */
	scrollbar-width: none; /* Firefox için */
}

/* Timeline ruler scrollbar stilleri */
.timeline-ruler::-webkit-scrollbar {
	height: 4px;
	background: transparent;
}

.timeline-ruler::-webkit-scrollbar-track {
	background: #111827;
	border-radius: 2px;
}

.timeline-ruler::-webkit-scrollbar-thumb {
	background: #374151;
	border-radius: 2px;
	transition: all 0.2s ease;
}

.timeline-ruler::-webkit-scrollbar-thumb:hover {
	background: #4b5563;
}

/* Firefox için scrollbar */
.timeline-ruler {
	scrollbar-width: thin;
	scrollbar-color: #374151 #111827;
	scroll-behavior: smooth;
	--scroll-behavior-duration: 150ms;
}

button:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.scroll-smooth {
	scroll-behavior: smooth;
}

.timeline-content {
	will-change: transform, width;
}
</style>
