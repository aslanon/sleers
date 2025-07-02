<template>
	<div class="timeline-container h-full max-h-[400px]">
		<!-- Timeline Header -->
		<div
			class="flex fixed right-0 bottom-4 z-10 justify-between items-center px-4 py-2"
		>
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
			class="overflow-x-scroll h-full overflow-y-hidden"
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
					class="timeline-content h-full relative pt-6 transition-[width] duration-100 ease-linear"
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
								class="flex flex-row h-[42px] relative w-full"
								@dragover.prevent
								@drop.prevent="handleSegmentDrop"
							>
								<!-- Video Segments -->
								<TimelineSegment
									v-for="(segment, index) in compactedSegments"
									:key="segment.id || index"
									:segment="segment"
									:index="index"
									:is-active="activeSegmentIndex === index"
									:is-resizing="isResizing && resizingSegmentIndex === index"
									:is-hovered="isHovered"
									:is-split-mode="isSplitMode"
									:duration="maxDuration"
									@click="handleSegmentClick"
									@mouse-move="handleSegmentMouseMove"
									@mouse-leave="handleSegmentMouseLeave"
									@resize-start="handleResizeStart"
									@resize-update="handleResizeUpdate"
									@resize-end="handleResizeEnd"
									@split="handleSegmentSplit"
								/>
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
								class="flex flex-row h-[42px] relative"
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
								<TimelineZoomSegment
									v-for="(range, index) in zoomRanges"
									:key="index"
									:range="range"
									:index="index"
									:is-selected="selectedZoomIndex === index"
									:is-resizing="isZoomResizing"
									:is-dragging="isZoomDragging && draggedZoomIndex === index"
									:is-hovered="isHovered"
									:duration="maxDuration"
									@click="handleZoomSegmentClick"
									@mouse-enter="handleZoomRangeEnter"
									@mouse-leave="handleZoomRangeLeave"
									@drag-start="handleZoomDragStart"
									@resize-start="handleZoomResizeStart"
								/>

								<!-- Ghost Zoom Preview -->
								<TimelineGhostZoom
									:position="
										ghostZoomPosition !== null &&
										!isZoomResizing &&
										!isZoomDragging
											? ghostZoomPosition
											: null
									"
									:width="calculateGhostBarWidth()"
									label="Add zoom effect"
								/>
							</div>
						</div>

						<!-- Layout Track -->
						<div
							class="timeline-layer-bar w-full rounded-xl relative"
							@click="handleLayoutTrackClick"
							@mousemove="handleLayoutTrackMouseMove"
							@mouseenter="isLayoutTrackHovered = true"
							@mouseleave="handleLayoutTrackLeave"
						>
							<div
								class="flex flex-row h-[42px] relative"
								:class="{ 'z-50': isLayoutTrackHovered }"
							>
								<!-- Empty State Label -->
								<div
									v-if="layoutRanges.length === 0"
									class="absolute w-[100vw] bg-[#ffec1a07] rounded-[10px] inset-0 flex items-center justify-center gap-1.5 text-white/20 transition-colors"
								>
									<span class="text-sm font-medium tracking-wide"
										>Add layout effect</span
									>
								</div>

								<!-- Layout Ranges -->
								<TimelineLayoutSegment
									v-for="(range, index) in layoutRanges"
									:key="index"
									:range="range"
									:index="index"
									:is-selected="selectedLayoutIndex === index"
									:is-resizing="isLayoutResizing"
									:is-dragging="
										isLayoutDragging && draggedLayoutIndex === index
									"
									:is-hovered="isHovered"
									:duration="maxDuration"
									@click="handleLayoutSegmentClick"
									@mouse-enter="handleLayoutRangeEnter"
									@mouse-leave="handleLayoutRangeLeave"
									@drag-start="handleLayoutDragStart"
									@resize-start="handleLayoutResizeStart"
									@delete="handleLayoutDelete"
								/>

								<!-- Ghost Layout Preview -->
								<TimelineGhostZoom
									:position="
										ghostLayoutPosition !== null &&
										!isLayoutResizing &&
										!isLayoutDragging
											? ghostLayoutPosition
											: null
									"
									:width="calculateGhostBarWidth()"
									label="Add layout effect"
								/>
							</div>
						</div>
					</div>

					<!-- Preview Playhead -->
					<div
						v-show="previewPlayheadPosition !== null && !isPlayheadDragging"
						class="absolute top-4 bottom-0 w-[1px] z-50"
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
						class="absolute top-4 w-3 h-5 z-50"
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
						class="absolute top-0 bottom-0 w-[1px] transition-[left] duration-[250ms] ease-linear will-change-[left] z-40"
						:style="{
							left: `${playheadPosition}%`,
							transform: 'translateX(-50%)',
							background:
								'linear-gradient(to bottom, rgb(67 42 244) 0%, transparent 100%)',
						}"
					></div>

					<!-- Playhead Handle -->
					<div
						class="absolute top-0 w-3 h-5 cursor-move transition-[left] duration-[250ms] ease-linear will-change-[left] z-40"
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

		<!-- Layout Type Popover -->
		<LayoutTypePopover
			v-if="showLayoutTypePopover"
			:is-open="true"
			:x="layoutPopoverPosition.x"
			:y="layoutPopoverPosition.y"
			@select="handleLayoutTypeSelect"
			@close="closeLayoutPopover"
			class="layout-type-popover"
		/>
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import { useLayoutSettings } from "~/composables/useLayoutSettings";
import TimelineSegment from "~/components/timeline/TimelineSegment.vue";
import TimelineZoomSegment from "~/components/timeline/TimelineZoomSegment.vue";
import TimelineLayoutSegment from "~/components/timeline/TimelineLayoutSegment.vue";
import TimelineGhostZoom from "~/components/timeline/TimelineGhostZoom.vue";
import LayoutTypePopover from "~/components/timeline/LayoutTypePopover.vue";

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
	"segmentTrimmed",
	"splitSegment",
	"segmentsReordered",
	"previewTimeUpdate",
	"deleteSegment",
	"videoEnded",
]);

const {
	zoomRanges,
	addZoomRange,
	removeZoomRange,
	updateZoomRange,
	setCurrentZoomRange,
} = usePlayerSettings();

const {
	layoutRanges,
	addLayoutRange,
	removeLayoutRange,
	updateLayoutRange,
	setCurrentLayoutRange,
	currentLayout,
	setCurrentLayoutType,
	wouldOverlap,
} = useLayoutSettings();

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
// Segment'leri sıkıştırılmış timeline pozisyonlarıyla hesapla
const compactedSegments = computed(() => {
	if (!props.segments || props.segments.length === 0) {
		return [];
	}

	let cumulativeTime = 0;
	return props.segments.map((segment, index) => {
		const segmentDuration =
			(segment.end || segment.endTime || 0) -
			(segment.start || segment.startTime || 0);

		const compactedSegment = {
			...segment,
			timelineStart: cumulativeTime, // Timeline'daki başlangıç pozisyonu
			timelineEnd: cumulativeTime + segmentDuration, // Timeline'daki bitiş pozisyonu
			originalStart: segment.start || segment.startTime || 0, // Orijinal video'daki başlangıç
			originalEnd: segment.end || segment.endTime || 0, // Orijinal video'daki bitiş
			duration: segmentDuration,
		};

		cumulativeTime += segmentDuration;
		return compactedSegment;
	});
});

// Timeline uzunluğu sıkıştırılmış segment'lerin toplam süresine göre hesaplanır
const maxDuration = computed(() => {
	if (compactedSegments.value.length === 0) {
		return props.duration;
	}

	// Sıkıştırılmış segment'lerin toplam süresini hesapla
	const totalCompactedDuration = compactedSegments.value.reduce(
		(total, segment) => {
			return total + segment.duration;
		},
		0
	);

	return totalCompactedDuration > 0 ? totalCompactedDuration : props.duration;
});

// Timeline genişliği
const timelineWidth = computed(() => {
	return maxDuration.value * 25 * currentZoom.value;
});

// Playhead pozisyonu - orijinal video zamanını sıkıştırılmış timeline zamanına çevir
const playheadPosition = computed(() => {
	if (compactedSegments.value.length === 0) {
		return (props.currentTime / maxDuration.value) * 100;
	}

	// Orijinal video zamanını sıkıştırılmış timeline zamanına çevir
	const compactedTime = convertOriginalTimeToCompactedTime(props.currentTime);
	return (compactedTime / maxDuration.value) * 100;
});

// Orijinal video zamanını sıkıştırılmış timeline zamanına çevir
const convertOriginalTimeToCompactedTime = (originalTime) => {
	if (compactedSegments.value.length === 0) {
		return originalTime;
	}

	// Hangi segment içinde olduğumuzu bul
	for (const segment of compactedSegments.value) {
		if (
			originalTime >= segment.originalStart &&
			originalTime <= segment.originalEnd
		) {
			// Bu segment içindeyiz, timeline pozisyonunu hesapla
			const segmentProgress = originalTime - segment.originalStart;
			return segment.timelineStart + segmentProgress;
		}
	}

	// Hiçbir segment içinde değilsek, en yakın segment'e snap et
	const firstSegment = compactedSegments.value[0];
	const lastSegment =
		compactedSegments.value[compactedSegments.value.length - 1];

	if (originalTime < firstSegment.originalStart) {
		return 0; // İlk segment'in başına
	} else if (originalTime > lastSegment.originalEnd) {
		return maxDuration.value; // Son segment'in sonuna
	}

	return 0; // Fallback
};

// Sıkıştırılmış timeline zamanını orijinal video zamanına çevir
const convertCompactedTimeToOriginalTime = (compactedTime) => {
	if (compactedSegments.value.length === 0) {
		return compactedTime;
	}

	// Hangi segment içinde olduğumuzu bul
	for (const segment of compactedSegments.value) {
		if (
			compactedTime >= segment.timelineStart &&
			compactedTime <= segment.timelineEnd
		) {
			// Bu segment içindeyiz, orijinal pozisyonu hesapla
			const segmentProgress = compactedTime - segment.timelineStart;
			return segment.originalStart + segmentProgress;
		}
	}

	// Hiçbir segment içinde değilsek, en yakın segment'e snap et
	const firstSegment = compactedSegments.value[0];
	const lastSegment =
		compactedSegments.value[compactedSegments.value.length - 1];

	if (compactedTime < firstSegment.timelineStart) {
		return firstSegment.originalStart; // İlk segment'in başına
	} else if (compactedTime > lastSegment.timelineEnd) {
		return lastSegment.originalEnd; // Son segment'in sonuna
	}

	return 0; // Fallback
};

// Playhead'i takip et ve segment kontrolü yap
watch(
	() => props.currentTime,
	(newTime) => {
		// SEGMENT SINIR KONTROLÜ - Video oynatılırken segment sınırlarını kontrol et
		if (compactedSegments.value.length > 0) {
			// Hangi segment içinde olduğumuzu bul
			const currentSegment = compactedSegments.value.find(
				(segment) =>
					newTime >= segment.originalStart && newTime <= segment.originalEnd
			);

			if (!currentSegment) {
				// Hiçbir segment içinde değilsek, sonraki segment'e atla
				const nextSegment = compactedSegments.value.find(
					(segment) => segment.originalStart > newTime
				);

				if (nextSegment) {
					// Sonraki segment'e atla
					emit("timeUpdate", nextSegment.originalStart);
					return;
				} else {
					// Son segment'i de geçtik, durdur
					// Bu durumu parent component'e bildir
					emit("videoEnded");
					return;
				}
			}

			// Segment sonuna geldiysek sonraki segment'e geç
			if (currentSegment && newTime >= currentSegment.originalEnd) {
				const currentIndex = compactedSegments.value.indexOf(currentSegment);
				const nextSegment = compactedSegments.value[currentIndex + 1];

				if (nextSegment) {
					// Sonraki segment'e geç
					emit("timeUpdate", nextSegment.originalStart);
					return;
				} else {
					// Son segment bitti, durdur
					emit("videoEnded");
					return;
				}
			}
		}

		// Scroll takibi
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

// Segment üzerinde mouse pozisyonu
const mousePosition = ref({ x: 0, segmentIndex: null });

// Aktif segment index'i
const activeSegmentIndex = ref(0);

// Segment üzerinde mouse hareketi
const handleSegmentMouseMove = (event, index) => {
	if (!props.isSplitMode) return;
	mousePosition.value = {
		x: event.clientX - event.currentTarget.getBoundingClientRect().left,
		segmentIndex: index,
	};
};

// Segment üzerinden mouse ayrıldığında
const handleSegmentMouseLeave = () => {
	mousePosition.value = { x: 0, segmentIndex: null };
};

// Segment bölme işlemi
const handleSegmentSplit = (event, index, ratio) => {
	if (!props.isSplitMode) return;

	const segment = props.segments[index];
	if (!segment) return;

	// Bölme noktasındaki zamanı hesapla
	const duration = segment.end - segment.start;
	const splitTime = segment.start + duration * ratio;

	// Minimum segment süresi kontrolü (örneğin 0.1 saniye)
	const minDuration = 0.1;
	if (
		splitTime - segment.start < minDuration ||
		segment.end - splitTime < minDuration
	) {
		console.warn("Segment too small to split");
		return;
	}

	// İlk segment (sol taraf)
	const leftSegment = {
		id: generateId(),
		start: segment.start,
		end: splitTime,
		startTime: segment.start,
		endTime: splitTime,
		type: segment.type,
		layer: segment.layer,
		duration: splitTime - segment.start,
		width: `${((splitTime - segment.start) / maxDuration.value) * 100}%`,
		startPosition: `${(segment.start / maxDuration.value) * 100}%`,
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
		duration: segment.end - splitTime,
		width: `${((segment.end - splitTime) / maxDuration.value) * 100}%`,
		startPosition: `${(splitTime / maxDuration.value) * 100}%`,
	};

	// Bölünmüş segmentleri emit et
	emit("splitSegment", {
		index,
		segments: [leftSegment, rightSegment],
		splitTime,
		totalDuration: maxDuration.value,
	});
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
	const compactedTime = (x / timelineWidth.value) * maxDuration.value;

	// Layout track'e tıklandıysa popover'ı aç
	if (e.target.classList.contains("layout-track")) {
		layoutClickTime.value = compactedTime;
		layoutPopoverPosition.value = {
			x: e.clientX,
			y: e.clientY,
		};
		showLayoutTypePopover.value = true;
		return;
	}

	// Sıkıştırılmış timeline zamanını orijinal video zamanına çevir
	const originalTime = convertCompactedTimeToOriginalTime(compactedTime);

	// SEGMENT SINIR KONTROLÜ - Sadece segment içine tıklanabilir
	if (compactedSegments.value.length > 0) {
		// Hangi segment içinde tıklandığını bul
		const clickedSegment = compactedSegments.value.find(
			(segment) =>
				compactedTime >= segment.timelineStart &&
				compactedTime <= segment.timelineEnd
		);

		if (!clickedSegment) {
			// Segment dışına tıklandı, en yakın segment'e git
			const nearestSegment = compactedSegments.value.reduce(
				(nearest, segment) => {
					const distanceToStart = Math.abs(
						compactedTime - segment.timelineStart
					);
					const distanceToEnd = Math.abs(compactedTime - segment.timelineEnd);
					const minDistance = Math.min(distanceToStart, distanceToEnd);

					const nearestDistance = Math.min(
						Math.abs(compactedTime - nearest.timelineStart),
						Math.abs(compactedTime - nearest.timelineEnd)
					);

					return minDistance < nearestDistance ? segment : nearest;
				}
			);

			// En yakın segment'in başına git
			emit("timeUpdate", nearestSegment.originalStart);
			previewPlayheadPosition.value = null;
			emit("previewTimeUpdate", null);
			return;
		}
	}

	// Geçerli zaman aralığında olmasını kontrol et
	const validTime = Math.max(0, Math.min(props.duration, originalTime));
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

// Sürükleme state'leri
const isResizing = ref(false);
const resizingSegmentIndex = ref(null);
const resizingEdge = ref(null); // 'start' veya 'end'
const originalSegment = ref(null);
const startResizeX = ref(0);

// Resize başlatma
const handleResizeStart = (event, index, edge) => {
	event.stopPropagation();
	console.log("[TimelineComponent] Resize start:", { index, edge });

	isResizing.value = true;
	resizingSegmentIndex.value = index;
	resizingEdge.value = edge;
	originalSegment.value = { ...props.segments[index] };
	startResizeX.value = event.clientX;

	// Aktif segment'i güncelle
	activeSegmentIndex.value = index;
	emit("segmentSelect", index);
};

// Resize güncelleme
const handleResizeUpdate = (updatedSegment, index) => {
	if (!isResizing.value || resizingSegmentIndex.value !== index) return;

	console.log("[TimelineComponent] Resize update:", {
		index,
		updatedSegment,
		oldStart: props.segments[index]?.start,
		oldEnd: props.segments[index]?.end,
		newStart: updatedSegment.start,
		newEnd: updatedSegment.end,
	});

	const newSegments = [...props.segments];
	newSegments[index] = {
		...newSegments[index], // Mevcut segment özelliklerini koru
		...updatedSegment, // Güncellenen değerleri uygula
		id: newSegments[index].id || generateId(), // ID'yi koru
		start: updatedSegment.start, // Bu önemli!
		end: updatedSegment.end, // Bu önemli!
		startTime: updatedSegment.start,
		endTime: updatedSegment.end,
		duration: updatedSegment.end - updatedSegment.start,
		width: `${
			((updatedSegment.end - updatedSegment.start) / maxDuration.value) * 100
		}%`,
		startPosition: `${(updatedSegment.start / maxDuration.value) * 100}%`,
	};

	console.log("[TimelineComponent] Updated segment:", newSegments[index]);
	emit("segmentUpdate", newSegments);
};

// Resize bitirme
const handleResizeEnd = (index) => {
	console.log("[TimelineComponent] Resize end:", { index });

	isResizing.value = false;
	resizingSegmentIndex.value = null;
	resizingEdge.value = null;
	originalSegment.value = null;

	// Final segment güncellemesini emit et
	emit("segmentTrimmed", index);
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
	const compactedTime = (x / timelineWidth.value) * maxDuration.value;

	// Sıkıştırılmış timeline zamanını orijinal video zamanına çevir
	const originalTime = convertCompactedTimeToOriginalTime(compactedTime);

	// Geçerli zaman aralığında olmasını kontrol et
	const validTime = Math.max(0, Math.min(props.duration, originalTime));

	// Preview pozisyonunu sıkıştırılmış timeline'a göre hesapla
	const compactedPreviewTime = convertOriginalTimeToCompactedTime(validTime);
	previewPlayheadPosition.value =
		(compactedPreviewTime / maxDuration.value) * 100;
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

	// Zoom range'i oluştur
	const zoomRange = {
		start: clickedTime,
		end: clickedTime + zoomDuration,
		scale: 2,
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
	if (
		selectedZoomIndex.value !== index &&
		!isZoomResizing.value &&
		!isZoomDragging.value
	) {
		ghostZoomPosition.value = (range.start / maxDuration.value) * 100;
		ghostZoomDuration.value = range.end - range.start;
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
	// Zoom segment silme
	if (
		selectedZoomIndex.value !== null &&
		(event.key === "Delete" || event.key === "Backspace")
	) {
		removeZoomRange(selectedZoomIndex.value);
		selectedZoomIndex.value = null;
		return;
	}

	// Video segment silme
	if (
		activeSegmentIndex.value !== null &&
		(event.key === "Delete" || event.key === "Backspace")
	) {
		event.preventDefault();
		emit("deleteSegment", activeSegmentIndex.value);
		return;
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

// Segment güncelleme
const handleSegmentUpdate = (updatedSegment, index) => {
	const newSegments = [...props.segments];
	newSegments[index] = {
		...updatedSegment,
		startTime: updatedSegment.start,
		endTime: updatedSegment.end,
		duration: updatedSegment.end - updatedSegment.start,
		width: `${
			((updatedSegment.end - updatedSegment.start) / props.duration) * 100
		}%`,
		startPosition: `${(updatedSegment.start / props.duration) * 100}%`,
	};

	emit("segmentUpdate", newSegments);
};

// Segment seçme
const handleSegmentClick = (index, event) => {
	event.stopPropagation();
	activeSegmentIndex.value = index;
	emit("segmentSelect", index);
};

// Layout track state
const isLayoutTrackHovered = ref(false);
const isLayoutDragging = ref(false);
const draggedLayoutIndex = ref(null);
const dragStartLayoutRange = ref(null);
const selectedLayoutIndex = ref(null);
const isLayoutResizing = ref(false);
const ghostLayoutPosition = ref(null);

// Layout track click handler
const handleLayoutTrackClick = (e) => {
	e.stopPropagation(); // Prevent timeline click handler

	const container = timelineRef.value;
	const rect = container.getBoundingClientRect();
	const x = e.clientX - rect.left + container.scrollLeft;
	const clickTime = (x / timelineWidth.value) * maxDuration.value;

	layoutClickTime.value = clickTime;
	layoutPopoverPosition.value = {
		x: e.clientX,
		y: e.clientY - 10, // Offset a bit above the click
	};
	showLayoutTypePopover.value = true;
};

const handleLayoutTrackMouseMove = (event) => {
	if (isLayoutResizing.value || isLayoutDragging.value) return;

	const timeline = timelineRef.value;
	const rect = timeline.getBoundingClientRect();
	const mouseX = event.clientX - rect.left + timeline.scrollLeft;
	const mouseTime = (mouseX / timelineWidth.value) * maxDuration.value;

	ghostLayoutPosition.value = (mouseTime / maxDuration.value) * 100;
};

const handleLayoutTrackLeave = () => {
	hideGhostLayout();
	isLayoutTrackHovered.value = false;
};

const hideGhostLayout = () => {
	ghostLayoutPosition.value = null;
};

const handleLayoutSegmentClick = (event, index) => {
	event.stopPropagation();
	selectedLayoutIndex.value = index;
	setCurrentLayoutRange(index);
};

const handleLayoutRangeEnter = (range, index) => {
	isHovered.value = true;
};

const handleLayoutRangeLeave = () => {
	isHovered.value = false;
};

const handleLayoutDragStart = (event, index) => {
	if (isLayoutResizing.value) return;

	event.stopPropagation();

	const timeline = timelineRef.value;
	const rect = timeline.getBoundingClientRect();
	const clickX = event.clientX - rect.left + timeline.scrollLeft;
	const clickTime = (clickX / timelineWidth.value) * maxDuration.value;

	const segment = layoutRanges.value[index];
	const clickOffset = clickTime - segment.start;

	isLayoutDragging.value = true;
	draggedLayoutIndex.value = index;
	dragStartLayoutRange.value = {
		...segment,
		clickOffset,
	};

	const segmentEl = event.currentTarget;
	segmentEl.style.willChange = "transform";
	segmentEl.style.transition = "none";

	window.addEventListener("mousemove", handleLayoutDrag, { passive: true });
	window.addEventListener("mouseup", handleLayoutDragEnd);
};

const handleLayoutDrag = (event) => {
	if (!isLayoutDragging.value || draggedLayoutIndex.value === null) return;

	const timeline = timelineRef.value;
	const rect = timeline.getBoundingClientRect();
	const mouseX = event.clientX - rect.left + timeline.scrollLeft;
	const currentTime = (mouseX / timelineWidth.value) * maxDuration.value;

	const segment = dragStartLayoutRange.value;
	const duration = segment.end - segment.start;

	let newStart = currentTime - segment.clickOffset;
	let newEnd = newStart + duration;

	if (newStart < 0) {
		newStart = 0;
		newEnd = duration;
	}

	if (newEnd > props.duration) {
		newEnd = props.duration;
		newStart = newEnd - duration;
	}

	const otherRanges = layoutRanges.value.filter(
		(_, i) => i !== draggedLayoutIndex.value
	);
	const snapThreshold = 0.05;

	let shouldSnap = false;
	let snappedStart = newStart;
	let snappedEnd = newEnd;

	for (const range of otherRanges) {
		if (Math.abs(newStart - range.end) < snapThreshold) {
			snappedStart = range.end;
			snappedEnd = range.end + duration;
			if (snappedEnd > props.duration) continue;
			shouldSnap = true;
			break;
		}
		if (Math.abs(newEnd - range.start) < snapThreshold) {
			snappedEnd = range.start;
			snappedStart = range.start - duration;
			if (snappedStart < 0) continue;
			shouldSnap = true;
			break;
		}
	}

	const hasCollision = otherRanges.some((range) => {
		if (shouldSnap) return false;
		const isOverlapping = newStart < range.end && newEnd > range.start;
		const isSnapping =
			Math.abs(newStart - range.end) < snapThreshold ||
			Math.abs(newEnd - range.start) < snapThreshold;
		return isOverlapping && !isSnapping;
	});

	if (!hasCollision) {
		const updatedRange = {
			...segment,
			start: shouldSnap ? snappedStart : newStart,
			end: shouldSnap ? snappedEnd : newEnd,
		};

		requestAnimationFrame(() => {
			updateLayoutRange(draggedLayoutIndex.value, updatedRange);
		});
	}
};

const handleLayoutDragEnd = () => {
	if (!isLayoutDragging.value) return;

	const segments = document.querySelectorAll(".timeline-layer-bar > div > div");
	segments.forEach((segment) => {
		segment.style.willChange = "auto";
		segment.style.transition = null;
	});

	isLayoutDragging.value = false;
	draggedLayoutIndex.value = null;
	dragStartLayoutRange.value = null;

	window.removeEventListener("mousemove", handleLayoutDrag);
	window.removeEventListener("mouseup", handleLayoutDragEnd);
};

const handleLayoutResizeStart = (event, index, edge) => {
	if (isLayoutDragging.value) return;

	event.stopPropagation();

	const timeline = timelineRef.value;
	const rect = timeline.getBoundingClientRect();
	const clickX = event.clientX - rect.left + timeline.scrollLeft;

	isLayoutResizing.value = true;
	selectedLayoutIndex.value = index;
	setCurrentLayoutRange(index);

	const segment = layoutRanges.value[index];
	const startX = (segment.start / maxDuration.value) * timelineWidth.value;
	const endX = (segment.end / maxDuration.value) * timelineWidth.value;

	const resizeData = {
		edge,
		index,
		startX: clickX,
		originalStart: segment.start,
		originalEnd: segment.end,
		minX:
			edge === "start"
				? 0
				: startX + (0.1 * timelineWidth.value) / maxDuration.value,
		maxX:
			edge === "end"
				? timelineWidth.value
				: endX - (0.1 * timelineWidth.value) / maxDuration.value,
	};

	const handleResize = (e) => {
		const currentX = e.clientX - rect.left + timeline.scrollLeft;
		const deltaX = currentX - resizeData.startX;
		const deltaTime = (deltaX / timelineWidth.value) * maxDuration.value;

		let newStart = segment.start;
		let newEnd = segment.end;

		if (edge === "start") {
			newStart = Math.max(
				0,
				Math.min(resizeData.originalStart + deltaTime, segment.end - 0.1)
			);
		} else {
			newEnd = Math.min(
				props.duration,
				Math.max(segment.start + 0.1, resizeData.originalEnd + deltaTime)
			);
		}

		const updatedRange = {
			...segment,
			start: newStart,
			end: newEnd,
		};

		if (!wouldOverlap(updatedRange, index)) {
			updateLayoutRange(index, updatedRange);
		}
	};

	const handleResizeEnd = () => {
		isLayoutResizing.value = false;
		window.removeEventListener("mousemove", handleResize);
		window.removeEventListener("mouseup", handleResizeEnd);
	};

	window.addEventListener("mousemove", handleResize);
	window.addEventListener("mouseup", handleResizeEnd);
};

// Add layout delete handler
const handleLayoutDelete = (index) => {
	removeLayoutRange(index);
	selectedLayoutIndex.value = -1;
};

// Layout type popover state
const showLayoutTypePopover = ref(false);
const layoutPopoverPosition = ref({ x: 0, y: 0 });
const layoutClickTime = ref(null);

// Close popover
const closeLayoutPopover = () => {
	showLayoutTypePopover.value = false;
	layoutClickTime.value = null;
};

// Close popover when clicking outside
const handleClickOutside = (e) => {
	if (
		showLayoutTypePopover.value &&
		!e.target.closest(".layout-type-popover")
	) {
		closeLayoutPopover();
	}
};

// Layout type selection handler
const handleLayoutTypeSelect = (type) => {
	if (layoutClickTime.value !== null) {
		const newLayout = {
			start: layoutClickTime.value,
			end: Math.min(layoutClickTime.value + 2, props.duration),
			type: type,
		};

		if (!wouldOverlap(newLayout, -1)) {
			layoutRanges.value.push(newLayout);
		}
	}

	closeLayoutPopover();
};

// Lifecycle hooks
onMounted(() => {
	window.addEventListener("click", handleClickOutside);
	window.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
	window.removeEventListener("click", handleClickOutside);
	window.removeEventListener("keydown", handleKeyDown);
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

.layout-type-popover {
	position: fixed; /* Use fixed positioning to ensure it's always visible */
	pointer-events: auto; /* Ensure clicks are captured */
}

.timeline-track {
	position: relative;
	cursor: pointer;
}
</style>
