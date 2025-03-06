<template>
	<div class="timeline-container flex-1 relative flex flex-col text-white">
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
			class="overflow-x-scroll overflow-y-hidden"
			@wheel="handleZoom"
		>
			<!-- @wheel.prevent="handleContainerWheel" -->
			<div
				ref="timelineRef"
				class="timeline-ruler py-4 relative h-full select-none"
				@mousedown="startDragging"
				@click="handleTimelineClick"
				@mousemove="handleTimelineMouseMove"
				@mouseleave="handleTimelineMouseLeave"
			>
				<div
					class="timeline-content relative h-[220px] pt-6 transition-[width] duration-100 ease-linear"
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
						<div
							v-if="marker.time != 0"
							class="w-1 h-1 rounded-full bg-white/20"
						></div>
					</div>

					<!-- Video Track -->
					<div
						class="absolute left-0 right-0 top-16 flex flex-col gap-2 px-2"
						@mouseenter="isTimelineHovered = true"
						@mouseleave="isTimelineHovered = false"
					>
						<!-- Segment Bar -->
						<div class="timeline-layer-bar w-full rounded-xl relative">
							<!-- Video Segments Container -->
							<div
								class="flex flex-row h-[50px] relative w-full"
								@dragover.prevent
								@drop.prevent="handleSegmentDrop"
							>
								<!-- Video Segments -->
								<div
									v-for="(segment, index) in props.segments"
									:key="segment.id || index"
									class="h-full ring-inset relative transition-all duration-200 group"
									:class="{
										'ring-[1px] ring-white z-50': activeSegmentIndex === index,
										'hover:!ring-[1px] hover:!ring-white hover:z-50':
											!isResizing && activeSegmentIndex !== index,
										'z-10':
											!isResizing && activeSegmentIndex !== index && !isHovered,
									}"
									:style="getSegmentStyle(segment, index)"
									@click.stop="handleSegmentClick(index, $event)"
									@mousemove="handleSegmentMouseMove($event, index)"
									@mouseleave="handleSegmentMouseLeave"
									@mousedown.stop="
										isSplitMode ? handleSegmentSplit($event, index) : null
									"
								>
									<!-- Split Indicator -->
									<div
										v-if="isSplitMode && mousePosition.segmentIndex === index"
										class="absolute top-0 bottom-0 w-[1px] bg-white pointer-events-none transition-all duration-75"
										:style="{
											left: `${mousePosition.x}px`,
											opacity: 0.8,
											height: '100%',
										}"
									></div>

									<!-- Sol Kenar İşareti -->
									<div
										class="absolute left-1 top-0 bottom-0 w-1 flex items-center justify-start opacity-0 transition-opacity duration-200"
										:class="{
											'opacity-80': activeSegmentIndex === index,
											'group-hover:opacity-80': !isResizing,
										}"
									>
										<div
											class="w-[3px] h-[24px] bg-white rounded-full cursor-w-resize"
											@mousedown.stop="
												handleResizeStart($event, index, 'start')
											"
										></div>
									</div>

									<!-- Sağ Kenar İşareti -->
									<div
										class="absolute right-1 top-0 bottom-0 w-1 flex items-center justify-end opacity-0 transition-opacity duration-200"
										:class="{
											'opacity-80': activeSegmentIndex === index,
											'group-hover:opacity-80': !isResizing,
										}"
									>
										<div
											class="w-[3px] h-[24px] bg-white rounded-full cursor-e-resize"
											@mousedown.stop="handleResizeStart($event, index, 'end')"
										></div>
									</div>

									<!-- Segment İçeriği -->
									<div
										class="absolute inset-0 flex flex-col items-center justify-center text-center"
									>
										<span
											class="text-white/70 text-[10px] font-medium tracking-wide"
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

						<!-- Zoom Track -->
						<div
							class="timeline-layer-bar w-full rounded-xl relative"
							@click="handleZoomTrackClick"
							@mousemove="handleZoomTrackMouseMove"
							@mouseenter="isZoomTrackHovered = true"
							@mouseleave="handleZoomTrackLeave"
						>
							<div
								class="flex flex-row h-[50px] relative"
								:class="{ 'z-50': isZoomTrackHovered }"
							>
								<!-- Empty State Label -->
								<div
									v-if="zoomRanges.length === 0"
									class="absolute w-[100vw] bg-[#ffec1a07] rounded-[10px] inset-0 flex items-center justify-center gap-1.5 text-white/20 transition-colors"
								>
									<span class="text-sm font-medium tracking-wide"
										>Add zoom effect</span
									>
								</div>

								<!-- Zoom Ranges -->
								<div
									v-for="(range, index) in zoomRanges"
									:key="index"
									class="h-full ring-inset relative transition-all duration-200 group"
									:class="{
										'ring-[1px] ring-white z-50 selected-zoom':
											selectedZoomIndex === index,
										'hover:!ring-[1px] hover:!ring-white hover:z-50':
											!isZoomResizing && selectedZoomIndex !== index,
										'z-10':
											!isZoomResizing &&
											selectedZoomIndex !== index &&
											!isHovered,
										'cursor-grab': !isZoomDragging,
										'cursor-grabbing': isZoomDragging,
									}"
									:style="getZoomStyle(range, index)"
									@mouseenter="handleZoomRangeEnter(range, index)"
									@mouseleave="handleZoomRangeLeave"
									@click.stop="handleZoomSegmentClick($event, index)"
									@mousedown.stop="handleZoomDragStart($event, index)"
								>
									<!-- Sol Resize Handle -->
									<div
										class="absolute left-1 top-0 bottom-0 w-1 flex items-center justify-start opacity-0 transition-opacity duration-200"
										:class="{
											'opacity-80': selectedZoomIndex === index,
											'group-hover:opacity-80':
												!isZoomResizing && !isZoomDragging,
										}"
										@mousedown.stop="
											handleZoomResizeStart($event, index, 'start')
										"
									>
										<div
											class="w-[3px] h-[24px] bg-white rounded-full cursor-ew-resize"
										></div>
									</div>

									<!-- Sağ Resize Handle -->
									<div
										class="absolute right-1 top-0 bottom-0 w-1 flex items-center justify-end opacity-0 transition-opacity duration-200"
										:class="{
											'opacity-80': selectedZoomIndex === index,
											'group-hover:opacity-80':
												!isZoomResizing && !isZoomDragging,
										}"
										@mousedown.stop="
											handleZoomResizeStart($event, index, 'end')
										"
									>
										<div
											class="w-[3px] h-[24px] bg-white rounded-full cursor-ew-resize"
										></div>
									</div>

									<!-- Zoom İçeriği -->
									<div
										class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
									>
										<span
											class="text-white/70 text-[10px] font-medium tracking-wide"
											>Zoom</span
										>
										<span
											class="text-white/90 text-sm font-medium tracking-wide mt-0.5"
										>
											{{ formatDuration(range.end - range.start) }} @
											{{ range.scale }}x
										</span>
									</div>
								</div>

								<!-- Ghost Zoom Preview -->
								<div
									v-if="
										ghostZoomPosition !== null &&
										!isZoomResizing &&
										!isZoomDragging
									"
									class="absolute h-full transition-all rounded-[10px] duration-75 opacity-30 bg-white/20 ring-1 ring-white/20"
									:style="{
										left: `${ghostZoomPosition}%`,
										width: `${calculateGhostBarWidth()}%`,
										background:
											'linear-gradient(rgb(87, 62, 244) 0%, rgb(134 119 233) 100%)',
									}"
								>
									<div
										class="absolute inset-0 flex flex-col items-center justify-center text-center"
									>
										<span
											class="text-white text-[14px] font-medium tracking-wide"
											>Add zoom effect</span
										>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Preview Playhead -->
					<div
						v-show="previewPlayheadPosition !== null && !isPlayheadDragging"
						class="absolute top-4 bottom-0 w-[1px]"
						:class="{ 'z-30': !isTimelineHovered, 'z-0': isTimelineHovered }"
						:style="{
							left: `${previewPlayheadPosition}%`,
							transform: 'translateX(-50%)',
							background:
								'linear-gradient(to bottom, rgb(26 26 26) 0%, transparent 100%)',
						}"
					></div>

					<!-- Preview Playhead Handle -->
					<div
						v-show="previewPlayheadPosition !== null && !isPlayheadDragging"
						class="absolute top-4 w-3 h-5"
						:class="{ 'z-30': !isTimelineHovered, 'z-0': isTimelineHovered }"
						:style="{
							left: `${previewPlayheadPosition}%`,
							transform: 'translateX(-50%)',
						}"
						@mousedown="handlePlayheadDragStart"
					>
						<div
							class="w-3 h-3 rounded-full"
							:style="{
								background: 'rgb(26 26 26)',
							}"
						></div>
					</div>

					<!-- Playhead -->
					<div
						class="absolute top-0 bottom-0 w-[1px] transition-[left] duration-[250ms] ease-linear will-change-[left]"
						:class="{ 'z-20': !isTimelineHovered, 'z-0': isTimelineHovered }"
						:style="{
							left: `${playheadPosition}%`,
							transform: 'translateX(-50%)',
							background:
								'linear-gradient(to bottom, rgb(67 42 244) 0%, transparent 100%)',
						}"
					></div>

					<!-- Playhead Handle -->
					<div
						class="absolute top-0 w-3 h-5 cursor-move transition-[left] duration-[250ms] ease-linear will-change-[left]"
						:class="{ 'z-20': !isTimelineHovered, 'z-0': isTimelineHovered }"
						:style="{
							left: `${playheadPosition}%`,
							transform: 'translateX(-50%)',
						}"
						@mousedown="handlePlayheadDragStart"
					>
						<div
							class="w-3 h-3 rounded-full"
							:style="{
								background: 'rgb(67 42 244)',
							}"
						></div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";

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
	"previewTimeUpdate",
]);

const {
	zoomRanges,
	addZoomRange,
	removeZoomRange,
	updateZoomRange,
	setCurrentZoomRange,
} = usePlayerSettings();

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
const minZoom = 0.1;
const maxZoom = 10;
const zoomStep = 0.2;

// Timeline sabitleri
const maxDuration = computed(() => props.duration);

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
				behavior: "instant",
			});
		} else if (playheadX < scrollLeft + 100) {
			container.scrollTo({
				left: playheadX - 100,
				behavior: "instant",
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
	const isActive = activeSegmentIndex.value === index;
	const start = segment.start || segment.startTime || 0;
	const end = segment.end || segment.endTime || maxDuration.value;
	const width = ((end - start) / maxDuration.value) * 100;
	const left = (start / maxDuration.value) * 100;

	return {
		width: `${width}%`,
		left: `${left}%`,
		position: "absolute",
		transition: "all 0.2s ease",
		zIndex: isActive ? "10" : "1",
		borderRadius: "10px",
		backgroundColor: "rgb(140,91,7)",
		background: isActive
			? "linear-gradient(180deg, rgba(160,111,27,1) 0%, rgba(225,161,50,1) 100%, rgba(254,168,19,1) 100%)"
			: "linear-gradient(180deg, rgba(140,91,7,1) 0%, rgba(205,141,30,1) 100%, rgba(254,168,19,1) 100%)",
		border: isActive
			? "1px solid rgba(255, 255, 255, 0.3)"
			: "0.25px solid rgba(255, 255, 255, 0.1)",
		height: "100%",
		cursor: "pointer",
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

// Timeline tıklama
const handleTimelineClick = (e) => {
	if (isDragging.value || isResizing.value) return;

	// Seçili zoom segmentini temizle
	selectedZoomIndex.value = null;

	const container = timelineRef.value;
	const rect = container.getBoundingClientRect();
	const x = e.clientX - rect.left + container.scrollLeft;
	const time = (x / timelineWidth.value) * maxDuration.value;

	// Geçerli zaman aralığında olmasını kontrol et
	const validTime = Math.max(0, Math.min(props.duration, time));
	emit("timeUpdate", validTime);
	previewPlayheadPosition.value = null; // Tıklandığında preview'i gizle
	emit("previewTimeUpdate", null); // Preview'i temizle
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

// Zoom işlemi
const handleZoom = (e) => {
	// Sadece Cmd/Ctrl basılıyken zoom işlemi yap
	if (e.ctrlKey || e.metaKey) {
		e.preventDefault();
		// Zoom işlemi - daha yumuşak bir zoom için deltaY'yi normalize et
		const normalizedDelta =
			-Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY * 0.01), 1);
		const delta = normalizedDelta * zoomStep;
		const newZoom = Math.max(
			minZoom,
			Math.min(maxZoom, currentZoom.value * (1 + delta))
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
	window.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
	window.removeEventListener("mouseup", stopDragging);
	window.removeEventListener("mousemove", handleDrag);
	window.removeEventListener("mousemove", handlePlayheadDrag);
	window.removeEventListener("mouseup", handlePlayheadDragEnd);
	window.removeEventListener("keydown", handleKeyDown);
});

// Resize state'leri
const isResizing = ref(false);
const resizingSegmentIndex = ref(null);
const resizingEdge = ref(null); // 'start' veya 'end'
const originalSegment = ref(null);
const startResizeX = ref(0);

// Resize başlatma
const handleResizeStart = (event, index, edge) => {
	event.stopPropagation();
	isResizing.value = true;
	resizingSegmentIndex.value = index;
	resizingEdge.value = edge;
	originalSegment.value = { ...props.segments[index] };
	startResizeX.value = event.clientX;

	window.addEventListener("mousemove", handleResize);
	window.addEventListener("mouseup", handleResizeEnd);
};

// Resize işlemi
const handleResize = (event) => {
	if (!isResizing.value || resizingSegmentIndex.value === null) return;

	const segment = props.segments[resizingSegmentIndex.value];
	const timeline = timelineRef.value;
	const timelineRect = timeline.getBoundingClientRect();

	const dx = event.clientX - startResizeX.value;
	const timeChange = (dx / timelineRect.width) * maxDuration.value;

	const newSegments = [...props.segments];
	const updatedSegment = { ...segment };

	if (resizingEdge.value === "start") {
		const newStart = Math.max(
			originalSegment.value.start - maxDuration.value,
			Math.min(
				originalSegment.value.start + timeChange,
				segment.end - 1 // En az 1 saniyelik segment
			)
		);
		updatedSegment.start = newStart;
	} else {
		const newEnd = Math.max(
			segment.start + 1, // En az 1 saniyelik segment
			Math.min(
				originalSegment.value.end + timeChange,
				originalSegment.value.end + maxDuration.value
			)
		);
		updatedSegment.end = newEnd;
	}

	newSegments[resizingSegmentIndex.value] = updatedSegment;
	emit("segmentUpdate", newSegments);
};

// Resize bitirme
const handleResizeEnd = () => {
	isResizing.value = false;
	resizingSegmentIndex.value = null;
	resizingEdge.value = null;
	originalSegment.value = null;

	window.removeEventListener("mousemove", handleResize);
	window.removeEventListener("mouseup", handleResizeEnd);
};

// Preview playhead state'i
const previewPlayheadPosition = ref(null);

// Timeline üzerinde mouse hareketi
const handleTimelineMouseMove = (e) => {
	if (isDragging.value || isResizing.value || isPlayheadDragging.value) {
		previewPlayheadPosition.value = null;
		emit("previewTimeUpdate", null);
		return;
	}

	const container = timelineRef.value;
	const rect = container.getBoundingClientRect();
	const x = e.clientX - rect.left + container.scrollLeft;
	const time = (x / timelineWidth.value) * maxDuration.value;

	// Geçerli zaman aralığında olmasını kontrol et
	const validTime = Math.max(0, Math.min(props.duration, time));
	previewPlayheadPosition.value = (validTime / maxDuration.value) * 100;
	emit("previewTimeUpdate", validTime);
};

// Timeline'dan mouse çıkınca preview'i gizle
const handleTimelineMouseLeave = () => {
	previewPlayheadPosition.value = null;
	emit("previewTimeUpdate", null);
};

// Zoom track için state'ler
const isZoomResizing = ref(false);
const activeZoomIndex = ref(null);
const resizingZoomEdge = ref(null);
const initialZoomRange = ref(null);
const initialClientX = ref(null);

// Zoom range ekleme
const handleZoomTrackClick = (event) => {
	if (isZoomResizing.value || isZoomDragging.value) return;

	// Seçili zoom segmentini temizle
	selectedZoomIndex.value = null;

	const rect = event.currentTarget.getBoundingClientRect();
	const clickX = event.clientX - rect.left;
	const scrollLeft = scrollContainerRef.value.scrollLeft;

	// Timeline üzerindeki tıklanan noktayı bul
	const adjustedX = clickX + scrollLeft;
	const clickedTime = (adjustedX / timelineWidth.value) * maxDuration.value;

	// Video süresini kontrol et
	if (clickedTime >= props.duration) return;

	// Tıklanan noktaya en yakın segmentleri bul
	const sortedRanges = [...zoomRanges.value].sort((a, b) => a.start - b.start);
	let prevSegment = null;
	let nextSegment = null;

	for (let i = 0; i < sortedRanges.length; i++) {
		if (sortedRanges[i].start > clickedTime) {
			nextSegment = sortedRanges[i];
			prevSegment = sortedRanges[i - 1];
			break;
		}
	}

	if (!nextSegment && sortedRanges.length > 0) {
		prevSegment = sortedRanges[sortedRanges.length - 1];
	}

	// Kullanılabilir alanı hesapla
	let availableStart = prevSegment ? prevSegment.end : 0;
	let availableEnd = nextSegment ? nextSegment.start : props.duration;

	// Tıklanan nokta bu aralıkta değilse çık
	if (clickedTime < availableStart || clickedTime > availableEnd) return;

	// Tıklanan noktadan sonraki kullanılabilir alanı hesapla
	const availableSpace = availableEnd - clickedTime;

	// Yeni zoom segmentinin boyutunu hesapla (maksimum 1 saniye)
	const zoomDuration = Math.min(1, availableSpace);

	// Zoom range'i oluştur - varsayılan olarak cursor pozisyonunu kullan
	// Cursor pozisyonu olarak 50,50 (merkez) kullan, kullanıcı daha sonra ayarlardan değiştirebilir
	const zoomRange = {
		start: clickedTime,
		end: clickedTime + zoomDuration,
		scale: 2,
		position: "cursor", // Varsayılan olarak cursor pozisyonunu kullan
		cursorX: 50, // Varsayılan olarak merkez X
		cursorY: 50, // Varsayılan olarak merkez Y
	};

	addZoomRange(zoomRange);
	hideGhostZoom();
};

// Zoom segmenti sürükleme başlatma
const handleZoomDragStart = (event, index) => {
	if (isZoomResizing.value) return;

	event.stopPropagation();

	const timeline = timelineRef.value;
	const rect = timeline.getBoundingClientRect();
	const clickX = event.clientX - rect.left + timeline.scrollLeft;
	const clickTime = (clickX / timelineWidth.value) * maxDuration.value;

	const segment = zoomRanges.value[index];
	const clickOffset = clickTime - segment.start;

	isZoomDragging.value = true;
	draggedZoomIndex.value = index;
	dragStartRange.value = {
		...segment,
		clickOffset, // Tıklanan noktanın segment başlangıcına olan uzaklığı
	};

	// Performance için style güncellemesi
	const segmentEl = event.currentTarget;
	segmentEl.style.willChange = "transform";
	segmentEl.style.transition = "none";

	window.addEventListener("mousemove", handleZoomDrag, { passive: true });
	window.addEventListener("mouseup", handleZoomDragEnd);
};

// Zoom segmenti sürükleme
const handleZoomDrag = (event) => {
	if (!isZoomDragging.value || draggedZoomIndex.value === null) return;

	const timeline = timelineRef.value;
	const rect = timeline.getBoundingClientRect();

	// Mouse pozisyonunu timeline içindeki konuma çevir
	const mouseX = event.clientX - rect.left + timeline.scrollLeft;
	const currentTime = (mouseX / timelineWidth.value) * maxDuration.value;

	const segment = dragStartRange.value;
	const duration = segment.end - segment.start;

	// Tıklanan noktayı koruyarak yeni pozisyonu hesapla
	let newStart = currentTime - segment.clickOffset;
	let newEnd = newStart + duration;

	// Sınırları kontrol et
	if (newStart < 0) {
		newStart = 0;
		newEnd = duration;
	}
	// Video süresini kontrol et
	if (newEnd > props.duration) {
		newEnd = props.duration;
		newStart = newEnd - duration;
	}

	// Diğer segmentlerle çakışma kontrolü
	const otherRanges = zoomRanges.value.filter(
		(_, i) => i !== draggedZoomIndex.value
	);
	const snapThreshold = 0.05; // 50ms snap toleransı

	// Snap kontrolü
	let shouldSnap = false;
	let snappedStart = newStart;
	let snappedEnd = newEnd;

	for (const range of otherRanges) {
		// Başlangıç noktası snap kontrolü
		if (Math.abs(newStart - range.end) < snapThreshold) {
			snappedStart = range.end;
			snappedEnd = range.end + duration;
			// Video süresini kontrol et
			if (snappedEnd > props.duration) continue;
			shouldSnap = true;
			break;
		}
		// Bitiş noktası snap kontrolü
		if (Math.abs(newEnd - range.start) < snapThreshold) {
			snappedEnd = range.start;
			snappedStart = range.start - duration;
			// Başlangıç noktasını kontrol et
			if (snappedStart < 0) continue;
			shouldSnap = true;
			break;
		}
	}

	// Çakışma kontrolü
	const hasCollision = otherRanges.some((range) => {
		// Snap durumunda çakışma kontrolü yapma
		if (shouldSnap) return false;

		// Normal çakışma kontrolü
		const isOverlapping = newStart < range.end && newEnd > range.start;
		const isSnapping =
			Math.abs(newStart - range.end) < snapThreshold ||
			Math.abs(newEnd - range.start) < snapThreshold;

		return isOverlapping && !isSnapping;
	});

	if (!hasCollision) {
		// Segment pozisyonunu güncelle
		const updatedRange = {
			...segment,
			start: shouldSnap ? snappedStart : newStart,
			end: shouldSnap ? snappedEnd : newEnd,
		};

		// Style güncellemesi için requestAnimationFrame kullan
		requestAnimationFrame(() => {
			updateZoomRange(draggedZoomIndex.value, updatedRange);
		});
	}
};

// Zoom segmenti sürükleme bitirme
const handleZoomDragEnd = () => {
	if (!isZoomDragging.value) return;

	const segments = document.querySelectorAll(".timeline-layer-bar > div > div");
	segments.forEach((segment) => {
		segment.style.willChange = "auto";
		segment.style.transition = null;
	});

	isZoomDragging.value = false;
	draggedZoomIndex.value = null;
	dragStartX.value = 0;
	dragStartRange.value = null;

	window.removeEventListener("mousemove", handleZoomDrag);
	window.removeEventListener("mouseup", handleZoomDragEnd);
};

// Zoom range'den mouse çıktığında deaktif et
const handleZoomRangeLeave = () => {
	ghostZoomPosition.value = null;
};

// Zoom range yeniden boyutlandırma
const handleZoomResizeStart = (event, index, edge) => {
	event.stopPropagation();
	isZoomResizing.value = true;
	activeZoomIndex.value = index;
	resizingZoomEdge.value = edge;
	initialZoomRange.value = { ...zoomRanges.value[index] };
	initialClientX.value = event.clientX;

	// Performance için style güncellemesi
	const segmentEl = event.currentTarget.closest(
		".timeline-layer-bar > div > div"
	);
	if (segmentEl) {
		segmentEl.style.willChange = "transform";
		segmentEl.style.transition = "none";
	}

	window.addEventListener("mousemove", handleZoomResizeMove);
	window.addEventListener("mouseup", handleZoomResizeEnd);
};

const handleZoomResizeMove = (event) => {
	if (!isZoomResizing.value || activeZoomIndex.value === null) return;

	const timeline = timelineRef.value;
	const rect = timeline.getBoundingClientRect();
	const mouseX = event.clientX - rect.left + timeline.scrollLeft;
	const currentTime = (mouseX / timelineWidth.value) * maxDuration.value;

	const range = { ...initialZoomRange.value };
	const minDuration = 0.1; // Minimum 100ms uzunluk

	// Yeni başlangıç ve bitiş zamanlarını hesapla
	if (resizingZoomEdge.value === "start") {
		range.start = Math.min(currentTime, range.end - minDuration);
		range.start = Math.max(0, range.start); // 0'ın altına inmemesi için
	} else {
		range.end = Math.max(currentTime, range.start + minDuration);
		range.end = Math.min(props.duration, range.end); // Video süresini aşmaması için
	}

	// Diğer segmentlerle çakışma kontrolü
	const otherRanges = zoomRanges.value.filter(
		(_, i) => i !== activeZoomIndex.value
	);
	const snapThreshold = 0.05; // 50ms snap toleransı

	// Snap kontrolü
	let shouldSnap = false;
	let snappedTime =
		resizingZoomEdge.value === "start" ? range.start : range.end;

	for (const other of otherRanges) {
		// Başlangıç noktası için snap
		if (resizingZoomEdge.value === "start") {
			if (Math.abs(range.start - other.end) < snapThreshold) {
				snappedTime = other.end;
				shouldSnap = true;
				break;
			}
		}
		// Bitiş noktası için snap
		else {
			if (Math.abs(range.end - other.start) < snapThreshold) {
				snappedTime = other.start;
				shouldSnap = true;
				break;
			}
		}
	}

	// Çakışma kontrolü
	const hasCollision = otherRanges.some((other) => {
		if (resizingZoomEdge.value === "start") {
			return range.start < other.end && range.end > other.start;
		} else {
			return range.end > other.start && range.start < other.end;
		}
	});

	if (!hasCollision) {
		// Snap varsa uygula
		if (shouldSnap) {
			if (resizingZoomEdge.value === "start") {
				range.start = snappedTime;
			} else {
				range.end = snappedTime;
			}
		}

		// Style güncellemesi için requestAnimationFrame kullan
		requestAnimationFrame(() => {
			updateZoomRange(activeZoomIndex.value, range);
		});
	}
};

const handleZoomResizeEnd = () => {
	isZoomResizing.value = false;

	// Style'ları resetle
	const segments = document.querySelectorAll(".timeline-layer-bar > div > div");
	segments.forEach((segment) => {
		segment.style.willChange = "auto";
		segment.style.transition = null;
	});

	activeZoomIndex.value = null;
	resizingZoomEdge.value = null;
	initialZoomRange.value = null;
	initialClientX.value = null;

	window.removeEventListener("mousemove", handleZoomResizeMove);
	window.removeEventListener("mouseup", handleZoomResizeEnd);
};

// Zoom range'e mouse girdiğinde aktif et
const handleZoomRangeEnter = (range, index) => {
	if (selectedZoomIndex !== index && !isZoomResizing && !isZoomDragging) {
		ghostZoomPosition.value = range.start;
		ghostZoomDuration.value = range.duration;
		ghostZoomScale.value = range.scale;
	}
};

// Script kısmına eklenecek state ve fonksiyonlar:
const ghostZoomPosition = ref(null);
const ghostZoomDuration = ref(1); // Default 1 second
const ghostZoomScale = ref(2); // Default 2x zoom

// Ghost zoom pozisyonunu güncelle
const handleZoomTrackMouseMove = (event) => {
	if (isZoomResizing.value || isZoomDragging.value) {
		ghostZoomPosition.value = null;
		return;
	}

	const rect = event.currentTarget.getBoundingClientRect();
	const clickX = event.clientX - rect.left;
	const scrollLeft = scrollContainerRef.value.scrollLeft;

	// Timeline üzerindeki mouse pozisyonunu bul
	const adjustedX = clickX + scrollLeft;
	const hoverTime = (adjustedX / timelineWidth.value) * maxDuration.value;

	// Video süresini kontrol et
	if (hoverTime >= props.duration) {
		ghostZoomPosition.value = null;
		return;
	}

	// Kalan süreyi hesapla
	const remainingDuration = props.duration - hoverTime;
	const ghostDuration = Math.min(1, remainingDuration);

	// Çakışma kontrolü
	const hasCollision = zoomRanges.value.some((range) => {
		return hoverTime < range.end && hoverTime + ghostDuration > range.start;
	});

	if (!hasCollision) {
		// Ghost zoom pozisyonunu güncelle
		ghostZoomPosition.value = (hoverTime / maxDuration.value) * 100;
	} else {
		ghostZoomPosition.value = null;
	}
};

// Ghost zoom'u gizle
const hideGhostZoom = () => {
	ghostZoomPosition.value = null;
};

// Ghost bar genişliği hesaplama
const calculateGhostBarWidth = () => {
	if (ghostZoomPosition.value === null) return 0;
	return (ghostZoomDuration.value / maxDuration.value) * 100;
};

// Zoom segmentleri için style hesaplama
const getZoomStyle = (range, index) => {
	const isSelected = selectedZoomIndex.value === index;
	const isDragging = draggedZoomIndex.value === index;

	return {
		position: "absolute",
		left: `${(range.start / maxDuration.value) * 100}%`,
		width: `${((range.end - range.start) / maxDuration.value) * 100}%`,
		backgroundColor: isSelected ? "rgb(87, 62, 244)" : "rgb(67, 42, 244)",
		background: isSelected
			? "linear-gradient(rgb(87, 62, 244) 0%, rgb(134 119 233) 100%)"
			: "linear-gradient(rgb(67, 42, 244) 0%, rgb(114 99 213) 100%)",
		borderRadius: "10px",
		height: "100%",
		cursor: isDragging ? "grabbing" : "grab",
		transition: isDragging ? "none" : "all 0.2s ease",
		transform: "translate3d(0,0,0)", // Hardware acceleration
		willChange: isDragging ? "transform" : "auto",
	};
};

// Playhead sürükleme state'i
const isPlayheadDragging = ref(false);

// Playhead sürükleme başlatma
const handlePlayheadDragStart = (e) => {
	e.stopPropagation();
	isPlayheadDragging.value = true;
	window.addEventListener("mousemove", handlePlayheadDrag);
	window.addEventListener("mouseup", handlePlayheadDragEnd);
};

// Playhead sürükleme
const handlePlayheadDrag = (e) => {
	if (!isPlayheadDragging.value) return;

	const container = timelineRef.value;
	const rect = container.getBoundingClientRect();
	const x = e.clientX - rect.left + container.scrollLeft;
	const time = (x / timelineWidth.value) * maxDuration.value;

	// Geçerli zaman aralığında olmasını kontrol et
	const validTime = Math.max(0, Math.min(props.duration, time));
	emit("timeUpdate", validTime);
	previewPlayheadPosition.value = null; // Sürükleme sırasında preview'i gizle
	emit("previewTimeUpdate", null); // Preview'i temizle
};

// Playhead sürükleme bitirme
const handlePlayheadDragEnd = () => {
	isPlayheadDragging.value = false;
	window.removeEventListener("mousemove", handlePlayheadDrag);
	window.removeEventListener("mouseup", handlePlayheadDragEnd);
};

const selectedZoomIndex = ref(null);

// Zoom segmentine tıklama
const handleZoomSegmentClick = (event, index) => {
	event.stopPropagation();
	selectedZoomIndex.value = index;
	setCurrentZoomRange(zoomRanges.value[index]); // Sadece tıklamada ayarları aç
	emit("zoomSegmentSelect");
};

// Klavye olaylarını dinle
const handleKeyDown = (event) => {
	if (
		selectedZoomIndex.value !== null &&
		(event.key === "Delete" || event.key === "Backspace")
	) {
		removeZoomRange(selectedZoomIndex.value);
		selectedZoomIndex.value = null;
	}
};

// Timeline hover state'i
const isTimelineHovered = ref(false);
const isZoomTrackHovered = ref(false);
const isHovered = ref(false);

// Zoom track'ten mouse çıktığında
const handleZoomTrackLeave = () => {
	hideGhostZoom();
	isZoomTrackHovered.value = false;
};

// Zoom sürükleme state'leri
const isZoomDragging = ref(false);
const draggedZoomIndex = ref(null);
const dragStartX = ref(0);
const dragStartRange = ref(null);
</script>

<style scoped>
.timeline-container {
	padding: 0 0px;
	position: relative;
	/* &::before {
		content: "";
		position: absolute;
		top: 122px;
		left: 0px;
		right: 0;
		width: 120px;
		height: 100%;
		background: linear-gradient(to right, #000, transparent);
		z-index: 2;
	}
	&::after {
		content: "";
		position: absolute;
		top: 122px;
		right: 0px;
		width: 120px;
		height: 100%;
		background: linear-gradient(to left, #000, transparent);
		z-index: 2;
	} */
}

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

/* Zoom segment bounce animasyonu */
@keyframes bounce {
	0%,
	100% {
		transform: translateY(0);
	}
	50% {
		transform: translateY(-2px);
	}
}

.group.selected-zoom:not(:hover) {
	animation: bounce 1s ease-in-out infinite;
}
</style>
