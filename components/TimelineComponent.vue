<template>
	<div class="timeline-container h-auto max-h-[375px]">
		<!-- Timeline Header -->
		<!-- 
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
		</div> -->

		<!-- Timeline Ruler -->
		<div
			ref="scrollContainerRef"
			class="overflow-x-scroll h-full"
			@wheel="handleZoom"
		>
			<!-- @wheel.prevent="handleContainerWheel" -->
			<div
				ref="timelineRef"
				class="timeline-ruler py-4 relative min-h-full select-none"
				@mousedown="startDragging"
				@mousemove="handleTimelineMouseMove"
			>
				<div
					class="timeline-content min-h-full relative pt-6"
					:style="{ width: `${timelineWidth}px` }"
					@click="handleTimelineClick"
				>
					<!-- Zaman İşaretleri -->
					<div class="w-full h-[42px]">
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
								class="w-1 h-1 mt-1 rounded-full bg-white/20 relative time-dot"
							></div>
						</div>
					</div>
					<!-- Video Track -->
					<div
						class="max-h-[400px] overflow-y-auto min-h-[400px] pb-[250px] overflow-auto flex flex-col gap-2 px-2"
						@mouseenter="isTimelineHovered = true"
						@mouseleave="isTimelineHovered = false"
					>
						<!-- Individual GIF Track Rows -->
						<div
							v-for="(segment, index) in gifSegments"
							:key="`gif-row-${segment.id}`"
							class="timeline-layer-bar w-full rounded-xl relative"
							@click="handleGifTrackClick"
							@mousemove="handleGifTrackMouseMove"
							@mouseenter="isGifTrackHovered = true"
							@mouseleave="handleGifTrackLeave"
						>
							<div
								class="flex flex-row h-[42px] relative items-center"
								:class="{ 'z-50': isGifTrackHovered }"
							>
								<!-- Single GIF Segment in its own row -->
								<TimelineGifSegment
									:segment="segment"
									:is-active="segment.gif.id === selectedGifId"
									:is-dragging="isGifDragging && draggedGifIndex === index"
									:is-timeline-hovered="isGifTrackHovered"
									:time-scale="timeScale"
									:timeline-width="timelineWidth"
									:has-video="hasVideo"
									@click="handleGifSegmentClick"
									@update="handleGifSegmentUpdate"
									@delete="handleGifSegmentDelete"
									@drag-start="handleGifDragStart"
									@drag-end="handleGifDragEnd"
									@resize-start="handleGifResizeStart"
									@resize-end="handleGifResizeEnd"
								/>
							</div>
						</div>

						<!-- Individual Video Track Rows -->
						<div
							v-for="(segment, index) in videoSegments"
							:key="`video-row-${segment.id}`"
							class="timeline-layer-bar w-full rounded-xl relative"
							@click="handleVideoTrackClick"
							@mousemove="handleVideoTrackMouseMove"
							@mouseenter="isVideoTrackHovered = true"
							@mouseleave="handleVideoTrackLeave"
						>
							<div
								class="flex flex-row h-[42px] relative items-center"
								:class="{ 'z-50': isVideoTrackHovered }"
							>
								<!-- Single Video Segment in its own row -->
								<TimelineGifSegment
									:segment="segment"
									:is-active="segment.gif.id === selectedGifId"
									:is-dragging="isVideoDragging && draggedVideoIndex === index"
									:is-timeline-hovered="isVideoTrackHovered"
									:time-scale="timeScale"
									:timeline-width="timelineWidth"
									:has-video="hasVideo"
									@click="handleVideoSegmentClick"
									@update="handleVideoSegmentUpdate"
									@delete="handleVideoSegmentDelete"
									@drag-start="handleVideoDragStart"
									@drag-end="handleVideoDragEnd"
									@resize-start="handleVideoResizeStart"
									@resize-end="handleVideoResizeEnd"
								/>
							</div>
						</div>

						<!-- Segment Bar (MOVED BELOW GIF TRACKS) -->
						<div
							v-if="hasVideo"
							class="timeline-layer-bar w-full rounded-xl relative"
							@mouseenter="isSegmentTrackHovered = true"
							@mouseleave="isSegmentTrackHovered = false"
						>
							<!-- Video Segments Container -->
							<div
								class="flex flex-row h-[42px] relative w-full items-center"
								@dragover.prevent
								@drop.prevent="handleSegmentDrop"
							>
								<!-- Video Segments -->
								<TimelineSegment
									v-for="(segment, index) in compactedSegments"
									:key="segment.id"
									:segment="segment"
									:index="index"
									:is-active="segment.id === activeSegmentId"
									:is-resizing="isResizing && resizingSegmentIndex === index"
									:is-hovered="isSegmentTrackHovered"
									:is-split-mode="isSplitMode"
									:is-dragging="
										isSegmentDragging && draggedSegmentIndex === index
									"
									:duration="maxDuration"
									:original-video-duration="
										segment.originalVideoDuration ||
										originalVideoDuration ||
										duration
									"
									@click="handleSegmentClick"
									@mouse-move="handleSegmentMouseMove"
									@mouse-leave="handleSegmentMouseLeave"
									@resize-start="handleResizeStart"
									@resize-update="handleResizeUpdate"
									@resize-end="handleResizeEnd"
									@split="handleSegmentSplit"
									@drag-start="handleSegmentDragStart"
									@drag="handleSegmentDrag"
									@drag-end="handleVideoSegmentDragEnd"
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
								class="flex flex-row h-[42px] relative items-center"
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
									:key="`zoom-${index}-${range.start}-${range.end}`"
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
							v-if="hasVideo"
							class="timeline-layer-bar w-full rounded-xl relative"
							@click="handleLayoutTrackClick"
							@mousemove="handleLayoutTrackMouseMove"
							@mouseenter="isLayoutTrackHovered = true"
							@mouseleave="handleLayoutTrackLeave"
						>
							<div
								class="flex flex-row h-[42px] relative items-center"
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
									:is-timeline-hovered="isLayoutTrackHovered"
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
									:width="calculateLayoutGhostWidth()"
									label="Add layout effect"
								/>
							</div>
						</div>
					</div>

					<!-- Preview Playhead -->
					<div
						class="absolute top-4 w-[1px] z-[9998] pointer-events-none"
						:style="{
							left: `${previewPlayheadPosition || 0}%`,
							transform: 'translateX(-50%)',
							height: `${timelineContentHeight - 16}px`,
							background:
								'linear-gradient(to bottom, rgb(48,48,48) 0%, transparent 100%)',
						}"
					></div>

					<!-- Preview Playhead Handle -->
					<div
						class="absolute top-0 w-3 h-5 z-50 cursor-pointer transition-[top] duration-150 ease-out"
						:style="{
							left: `${previewPlayheadPosition || 0}%`,
							transform: 'translateX(-50%)',
							top: previewPlayheadOffset + 'px',
						}"
					>
						<div
							class="w-3 h-3 rounded-full relative"
							:style="{
								background: 'rgb(48,48,48)',
							}"
						>
							<!-- Damla efekti -->
							<div
								class="absolute w-1.5 h-2.5"
								:style="{
									background: 'rgb(48,48,48)',
									top: '55%',
									left: '50%',
									transform: 'translateX(-50%)',
									clipPath: 'polygon(0% 0%, 50% 100%, 100% 0%)',
								}"
							></div>
						</div>
					</div>

					<!-- Playhead -->
					<div
						class="absolute top-0 w-[1px] z-[9999] pointer-events-none"
						:style="{
							left: `${playheadPosition}%`,
							transform: 'translateX(-50%)',
							height: `${timelineContentHeight}px`,
							background:
								'linear-gradient(to bottom, rgb(67 42 244) 0%, transparent 100%)',
						}"
					></div>

					<!-- Playhead Handle -->
					<div
						class="absolute top-0 w-3 h-5 cursor-move z-40"
						:style="{
							left: `${playheadPosition}%`,
							transform: 'translateX(-50%)',
						}"
						@mousedown="handlePlayheadDragStart"
					>
						<div
							class="w-3 h-3 rounded-full relative"
							:style="{
								background: 'rgb(67 42 244)',
							}"
						>
							<!-- Damla efekti -->
							<div
								class="absolute w-1.5 h-2.5"
								:style="{
									background: 'rgb(67 42 244)',
									top: '55%',
									left: '50%',
									transform: 'translateX(-50%)',
									clipPath: 'polygon(0% 0%, 50% 100%, 100% 0%)',
								}"
							></div>
						</div>
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
import { useGifManager } from "~/composables/useGifManager";
import TimelineSegment from "~/components/timeline/TimelineSegment.vue";
import TimelineZoomSegment from "~/components/timeline/TimelineZoomSegment.vue";
import TimelineLayoutSegment from "~/components/timeline/TimelineLayoutSegment.vue";
import TimelineGhostZoom from "~/components/timeline/TimelineGhostZoom.vue";
import LayoutTypePopover from "~/components/timeline/LayoutTypePopover.vue";
import TimelineGifSegment from "~/components/timeline/TimelineGifSegment.vue";

const props = defineProps({
	duration: {
		type: Number,
		required: true,
		validator: (value) => value >= 0,
	},
	originalVideoDuration: {
		type: Number,
		default: null,
		validator: (value) => value === null || value >= 0,
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
					typeof segment === "object" &&
					segment !== null &&
					(segment.start >= 0 || segment.startTime >= 0) &&
					(segment.end >= (segment.start || segment.startTime || 0) ||
						segment.endTime >= (segment.start || segment.startTime || 0)) &&
					typeof (segment.start || segment.startTime) === "number" &&
					typeof (segment.end || segment.endTime) === "number"
			),
	},
	hasVideo: {
		type: Boolean,
		default: false,
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
	isPlaying: {
		type: Boolean,
		default: false,
	},
	isDeletingSegment: {
		type: Boolean,
		default: false,
	},
	zoomRanges: {
		type: Array,
		default: () => [],
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
	"zoomSegmentSelect",
	"totalDurationUpdate",
	"zoomRangeAdded",
	"zoomRangeRemoved",
	"layoutRangeAdded",
	"layoutRangeRemoved",
]);

const {
	zoomRanges: defaultZoomRanges,
	addZoomRange,
	removeZoomRange,
	updateZoomRange,
	setCurrentZoomRange,
} = usePlayerSettings();

// usePlayerSettings'deki zoomRanges'i kullan
const zoomRanges = computed(() => {
	return defaultZoomRanges.value;
});

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

// GIF manager
const {
	activeGifs,
	selectedGifId,
	selectGif,
	removeGif,
	handleKeyDown: handleGifKeyDown,
} = useGifManager();

// Referanslar ve state
const scrollContainerRef = ref(null);
const timelineRef = ref(null);
const currentZoom = ref(3);
const isDragging = ref(false);

// Video segment uzunluğunu kontrol et ve zoom ayarla
const checkVideoSegmentDurationAndSetZoom = () => {
	if (!props.segments || props.segments.length === 0) return;

	// Video segmentlerinin toplam uzunluğunu hesapla
	const totalVideoDuration = props.segments.reduce((total, segment) => {
		const segmentDuration =
			(segment.timelineEnd || segment.end || 0) -
			(segment.timelineStart || segment.start || 0);
		return total + segmentDuration;
	}, 0);

	// Eğer video segment uzunluğu 3-5 saniye arasındaysa zoom'u %50 artır
	if (parseInt(totalVideoDuration) <= 10) {
		currentZoom.value = 6;
	}
};
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
// Segment'leri gerçek pozisyonlarıyla hesapla (artık sıkıştırma yapmıyor)
const compactedSegments = computed(() => {
	if (!props.segments || props.segments.length === 0) {
		return [];
	}

	// Segment filtreleme kaldırıldı - tüm segment'leri göster
	const result = props.segments.map((segment, index) => {
		const segmentTimelineStart = segment.timelineStart || segment.start || 0;
		const segmentTimelineEnd = segment.timelineEnd || segment.end || 0;
		const segmentDuration = segmentTimelineEnd - segmentTimelineStart;

		// Artık gerçek pozisyonları kullanıyoruz - sıkıştırma yok
		const realPositionSegment = {
			...segment,
			timelineStart: segmentTimelineStart, // Timeline'da nerede görüneceği
			timelineEnd: segmentTimelineEnd, // Timeline'da nerede görüneceği
			videoStart: segment.videoStart || segment.startTime || 0, // Video'nun hangi kısmı gösterilecek
			videoEnd: segment.videoEnd || segment.endTime || 0, // Video'nun hangi kısmı gösterilecek
			duration: segmentDuration,
		};

		return realPositionSegment;
	});

	return result;
});

// Timeline uzunluğu - default uzunluk ama segment'ler geçerse genişler
const maxDuration = computed(() => {
	// Default timeline uzunluğu (minimum 60sn veya video uzunluğu)
	const defaultTimelineDuration = Math.max(60, props.duration);

	if (!props.segments || props.segments.length === 0) {
		// Segment yoksa default uzunluğu kullan
		return defaultTimelineDuration;
	}

	// En son segment'in bitiş zamanını bul
	const lastSegmentEndTime = Math.max(
		...props.segments.map((segment) => segment.timelineEnd || segment.end || 0),
		0
	);

	// Timeline uzunluğu = default ile son segment'in maksimumu
	const timelineEndTime = Math.max(defaultTimelineDuration, lastSegmentEndTime);

	return timelineEndTime;
});

// Canvas uzunluğu - sadece video segment'lerin en son bitiş zamanına göre (GIF ve video segment'ler henüz tanımlanmadı)
const canvasDuration = computed(() => {
	// Video segment'lerinin en son bitiş zamanı
	const videoSegmentsEndTime =
		props.segments && props.segments.length > 0
			? Math.max(
					...props.segments.map(
						(segment) => segment.timelineEnd || segment.end || 0
					),
					0
			  )
			: 0;

	// Layout segment'lerinin en son bitiş zamanı
	const layoutSegmentsEndTime =
		layoutRanges.value.length > 0
			? Math.max(...layoutRanges.value.map((range) => range.end || 0), 0)
			: 0;

	// Zoom segment'lerinin en son bitiş zamanı
	const zoomSegmentsEndTime =
		zoomRanges.value.length > 0
			? Math.max(...zoomRanges.value.map((range) => range.end || 0), 0)
			: 0;

	// Tüm segment türlerinin en son bitiş zamanını bul (GIF ve video segment'ler sonra eklenecek)
	const allSegmentsEndTime = Math.max(
		videoSegmentsEndTime,
		layoutSegmentsEndTime,
		zoomSegmentsEndTime,
		0
	);

	// Canvas uzunluğu minimum video uzunluğu kadar olmalı
	const actualCanvasDuration = Math.max(allSegmentsEndTime, props.duration);

	return actualCanvasDuration;
});

// Timeline genişliği
const timelineWidth = computed(() => {
	return maxDuration.value * 25 * currentZoom.value;
});

// Time scale for pixel-to-time conversion
const timeScale = computed(() => {
	return 25 * currentZoom.value; // pixels per second
});

// GIF, Image and Video segments for timeline display
const gifSegments = computed(() => {
	return activeGifs.value
		.filter((gif) => gif.type === "gif" || gif.type === "image")
		.map((gif) => ({
			id: `${gif.type}-segment-${gif.id}`,
			gif: gif,
			type: gif.type || "gif", // Support both 'gif' and 'image' types
		}));
});

// Video segments for timeline display (separate row)
const videoSegments = computed(() => {
	return activeGifs.value
		.filter((gif) => gif.type === "video")
		.map((gif) => ({
			id: `${gif.type}-segment-${gif.id}`,
			gif: gif,
			type: gif.type,
		}));
});

// Canvas duration'ı GIF ve video segment'lerle güncelle
const finalCanvasDuration = computed(() => {
	// Mevcut canvas duration'ı al
	const baseCanvasDuration = canvasDuration.value;

	// GIF ve image segment'lerinin en son bitiş zamanı
	const gifSegmentsEndTime =
		gifSegments.value.length > 0
			? Math.max(
					...gifSegments.value.map((segment) => segment.gif.endTime || 0),
					0
			  )
			: 0;

	// Video overlay segment'lerinin en son bitiş zamanı
	const videoOverlaySegmentsEndTime =
		videoSegments.value.length > 0
			? Math.max(
					...videoSegments.value.map((segment) => segment.gif.endTime || 0),
					0
			  )
			: 0;

	// Tüm segment türlerinin en son bitiş zamanını bul
	const allSegmentsEndTime = Math.max(
		baseCanvasDuration,
		gifSegmentsEndTime,
		videoOverlaySegmentsEndTime,
		0
	);

	return allSegmentsEndTime;
});

// Canvas duration değiştiğinde MediaPlayer'a bildir
watch(
	finalCanvasDuration,
	(newDuration) => {
		emit("totalDurationUpdate", newDuration);
	},
	{ immediate: true }
);

// Calculate dynamic timeline height based on content
const timelineContentHeight = computed(() => {
	// Base height for timeline markers and padding
	const baseHeight = 80; // pt-6 + pb-6 + marker space

	// Layout track height
	const layoutTrackHeight = 42;

	// GIF tracks height (each GIF gets its own row)
	const gifTracksHeight = Math.max(42, gifSegments.value.length * 44); // 42px per GIF + 2px gap

	// Video tracks height (each video gets its own row)
	const videoTracksHeight = Math.max(42, videoSegments.value.length * 44); // 42px per video + 2px gap

	// Segments bar height
	const segmentsBarHeight = 42;

	// Zoom tracks height
	const zoomTracksHeight = zoomRanges.value.length > 0 ? 42 : 0;

	return (
		baseHeight +
		layoutTrackHeight +
		gifTracksHeight +
		videoTracksHeight +
		segmentsBarHeight +
		zoomTracksHeight
	);
});

// GIF track state
const isGifTrackHovered = ref(false);
const isGifDragging = ref(false);
const draggedGifIndex = ref(-1);

// Video track state
const isVideoTrackHovered = ref(false);
const isVideoDragging = ref(false);
const draggedVideoIndex = ref(-1);

// Segment track state
const isSegmentTrackHovered = ref(false);

// Playhead pozisyonu - artık gerçek video time ile çalışır
const playheadPosition = computed(() => {
	// Gerçek video time'ı timeline üzerindeki pozisyona çevir
	const realTime = props.currentTime;
	const position = (realTime / maxDuration.value) * 100;

	return Math.max(0, position); // Sadece 0'dan küçük olmamasını kontrol et
});

// Preview playhead offset - ana playhead ile üst üste geldiğinde 10px aşağı kaydır
const previewPlayheadOffset = computed(() => {
	if (previewPlayheadPosition.value === null) return 0;

	// Ana playhead ile preview playhead arasındaki mesafeyi hesapla
	const distance = Math.abs(
		previewPlayheadPosition.value - playheadPosition.value
	);

	// Eğer mesafe 1%'den azsa (yaklaşık üst üste geliyorlarsa) 10px aşağı kaydır
	if (distance <= 0.35) {
		return 14;
	}

	return 4;
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
		// Artık timeline segment kontrolü yapmıyoruz - canvas normal oynatılacak
		// Segment'ler sadece timeline'da pozisyon göstergesi olarak çalışacak

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

// Aktif segment ID'si (index yerine ID kullan)
const activeSegmentId = ref(null);

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

	// Timeline pozisyonlarını kullan
	const timelineStart = segment.timelineStart || segment.start || 0;
	const timelineEnd = segment.timelineEnd || segment.end || 0;
	const timelineDuration = timelineEnd - timelineStart;
	const splitTime = timelineStart + timelineDuration * ratio;

	// Minimum segment süresi kontrolü (örneğin 0.1 saniye)
	const minDuration = 0.1;
	if (
		splitTime - timelineStart < minDuration ||
		timelineEnd - splitTime < minDuration
	) {
		console.warn("Segment too small to split");
		return;
	}

	// Video content pozisyonlarını hesapla
	const videoStart = segment.videoStart || segment.startTime || 0;
	const videoEnd = segment.videoEnd || segment.endTime || 0;
	const videoDuration = videoEnd - videoStart;

	// Split ratio'yu video content'e uygula
	const videoSplitTime = videoStart + videoDuration * ratio;

	// Parent segment'in originalVideoDuration'ını al
	const parentOriginalDuration =
		segment.originalVideoDuration || props.duration;

	// İlk segment (sol taraf)
	const leftSegment = {
		id: generateId(),
		timelineStart: timelineStart,
		timelineEnd: splitTime,
		videoStart: videoStart,
		videoEnd: videoSplitTime,
		originalVideoDuration: parentOriginalDuration,
		type: segment.type,
		layer: segment.layer,
		duration: splitTime - timelineStart,
		width: `${((splitTime - timelineStart) / maxDuration.value) * 100}%`,
		startPosition: `${(timelineStart / maxDuration.value) * 100}%`,
	};

	// İkinci segment (sağ taraf)
	const rightSegment = {
		id: generateId(),
		timelineStart: splitTime,
		timelineEnd: timelineEnd,
		videoStart: videoSplitTime,
		videoEnd: videoEnd,
		originalVideoDuration: parentOriginalDuration,
		type: segment.type,
		layer: segment.layer,
		duration: timelineEnd - splitTime,
		width: `${((timelineEnd - splitTime) / maxDuration.value) * 100}%`,
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
	// Performance style'larını resetle - zoom segmenti gibi
	const segments = document.querySelectorAll(".timeline-layer-bar > div > div");
	segments.forEach((segment) => {
		segment.style.willChange = "auto";
		segment.style.transition = null;
	});

	draggedSegmentIndex.value = null;
	dropTargetInfo.value = {
		segmentIndex: null,
		position: null,
	};
};

// Timeline tıklama - direkt timeUpdate emit et
const handleTimelineClick = (e) => {
	if (isDragging.value || isResizing.value) return;

	const container = timelineRef.value;
	const rect = container.getBoundingClientRect();
	const x = e.clientX - rect.left + container.scrollLeft;
	const time = (x / timelineWidth.value) * maxDuration.value;

	// Preview playhead'i tıklanan pozisyonda tut
	const validTime = Math.max(0, Math.min(maxDuration.value, time));

	emit("timeUpdate", validTime);
};

const startDragging = (e) => {
	//aslanon
	// isDragging.value = true;
	// startDragX.value = e.clientX;
	// startScrollLeft.value = timelineRef.value.scrollLeft;
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
			// Zoom yaparken playhead pozisyonunu merkez al
			const container = scrollContainerRef.value;
			const playheadTime = props.currentTime;
			const playheadPosition =
				(playheadTime / maxDuration.value) * timelineWidth.value;
			const scrollLeftBeforeZoom = container.scrollLeft;
			const containerWidthBeforeZoom = container.scrollWidth;

			currentZoom.value = newZoom;

			// Zoom sonrası scroll pozisyonunu playhead'e göre güncelle
			nextTick(() => {
				const scale = container.scrollWidth / containerWidthBeforeZoom;
				const newPlayheadPosition =
					(playheadTime / maxDuration.value) * timelineWidth.value;
				const playheadOffset = newPlayheadPosition - playheadPosition;
				container.scrollLeft = scrollLeftBeforeZoom + playheadOffset;
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

	isResizing.value = true;
	resizingSegmentIndex.value = index;
	resizingEdge.value = edge;
	originalSegment.value = { ...props.segments[index] };
	startResizeX.value = event.clientX;

	// Aktif segment'i güncelle
	const segment = props.segments[index];
	if (segment) {
		activeSegmentId.value = segment.id;
		emit("segmentSelect", index);
	}
};

// Resize güncelleme
const handleResizeUpdate = (updatedSegment, index) => {
	if (!isResizing.value || resizingSegmentIndex.value !== index) return;

	const newSegments = [...props.segments];
	const originalSegment = newSegments[index];

	// Segment'i güncelle - tüm değerleri tutarlı şekilde ayarla
	newSegments[index] = {
		...originalSegment, // Mevcut segment özelliklerini koru
		...updatedSegment, // Güncellenen değerleri uygula
		id: originalSegment.id || generateId(), // ID'yi koru
		timelineStart: updatedSegment.timelineStart, // Timeline pozisyonu
		timelineEnd: updatedSegment.timelineEnd, // Timeline pozisyonu
		videoStart: updatedSegment.videoStart, // Video content pozisyonu
		videoEnd: updatedSegment.videoEnd, // Video content pozisyonu
		duration: updatedSegment.timelineEnd - updatedSegment.timelineStart,
		originalVideoDuration:
			originalSegment.originalVideoDuration || props.duration, // Original duration'ı koru
		width: `${
			((updatedSegment.timelineEnd - updatedSegment.timelineStart) /
				maxDuration.value) *
			100
		}%`,
		startPosition: `${
			(updatedSegment.timelineStart / maxDuration.value) * 100
		}%`,
	};

	emit("segmentUpdate", newSegments);
};

// Resize bitirme
const handleResizeEnd = (index) => {
	isResizing.value = false;
	resizingSegmentIndex.value = null;
	resizingEdge.value = null;
	originalSegment.value = null;

	// Final segment güncellemesini emit et
	emit("segmentTrimmed", index);
};

// Preview playhead state'i
const previewPlayheadPosition = ref(0);

// Timeline üzerinde mouse hareketi - real time olarak çalışır
const handleTimelineMouseMove = (e) => {
	if (isDragging.value || isResizing.value || isPlayheadDragging.value) {
		return;
	}

	// Video oynatılırken preview devre dışı
	if (props.isPlaying) {
		return;
	}

	const container = timelineRef.value;
	const rect = container.getBoundingClientRect();
	const x = e.clientX - rect.left + container.scrollLeft;
	const realTime = (x / timelineWidth.value) * maxDuration.value;

	// Artık real time kullan
	const validRealTime = Math.max(0, realTime);

	// Preview pozisyonunu hesapla
	previewPlayheadPosition.value =
		(validRealTime / maxDuration.value) * 100 || 0;

	// Preview zamanını MediaPlayer'a gönder (canvas güncellemesi için) - real time olarak
	emit("previewTimeUpdate", validRealTime);
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

	// Timeline süresini kontrol et (video duration yerine timeline duration)
	if (clickedTime >= maxDuration.value) return;

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

	// Kullanılabilir alanı hesapla (timeline sonuna kadar)
	let availableStart = prevSegment ? prevSegment.end : 0;
	let availableEnd = nextSegment ? nextSegment.start : maxDuration.value;

	// Tıklanan nokta bu aralıkta değilse çık
	if (clickedTime < availableStart || clickedTime > availableEnd) {
		return;
	}

	// Tıklanan noktadan sonraki kullanılabilir alanı hesapla
	const availableSpace = availableEnd - clickedTime;

	// Yeni zoom segmentinin boyutunu hesapla (maksimum 1 saniye)
	const zoomDuration = Math.min(1, availableSpace);

	// Zoom range'i oluştur - manuel olarak işaretle
	const zoomRange = {
		start: clickedTime,
		end: clickedTime + zoomDuration,
		scale: 2,
		isAutoZoom: false, // Manuel zoom segmenti
	};

	addZoomRange(zoomRange);
	emit("zoomRangeAdded", zoomRange);
	hideGhostZoom();
};

// Zoom segmenti sürükleme başlatma
const handleZoomDragStart = (event, index) => {
	if (isZoomResizing.value) return;

	event.stopPropagation();

	const segment = zoomRanges.value[index];

	const timeline = timelineRef.value;
	const rect = timeline.getBoundingClientRect();
	const clickX = event.clientX - rect.left + timeline.scrollLeft;
	const clickTime = (clickX / timelineWidth.value) * maxDuration.value;

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
	// Timeline süresini kontrol et (son segment'e kadar)
	if (newEnd > maxDuration.value) {
		newEnd = maxDuration.value;
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
			// Timeline süresini kontrol et
			if (snappedEnd > maxDuration.value) continue;
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

	const segment = zoomRanges.value[index];

	isZoomResizing.value = true;
	activeZoomIndex.value = index;
	resizingZoomEdge.value = edge;
	initialZoomRange.value = { ...segment };
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
		range.end = Math.min(maxDuration.value, range.end); // Timeline süresini aşmaması için
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

// Layout ghost için ayrı süre değişkeni
const ghostLayoutDuration = ref(2.5); // Default 2.5 seconds for layout ghost

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
	if (ghostZoomPosition.value === null) return 20;
	return (ghostZoomDuration.value / maxDuration.value) * 100;
};

// Layout ghost genişliği hesaplama
const calculateLayoutGhostWidth = () => {
	if (ghostLayoutPosition.value === null) return 20;
	return (ghostLayoutDuration.value / maxDuration.value) * 100;
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

	emit("timeUpdate", Math.max(0, time));
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

	const zoomRange = zoomRanges.value[index];

	if (selectedZoomIndex.value === index) {
		selectedZoomIndex.value = null;
		setCurrentZoomRange(null);
	} else {
		selectedZoomIndex.value = index;
		setCurrentZoomRange(zoomRange);
	}
	emit("zoomSegmentSelect");
};

// Klavye olaylarını dinle
const handleKeyDown = (event) => {
	// Zoom segment silme
	if (
		selectedZoomIndex.value !== null &&
		(event.key === "Delete" || event.key === "Backspace")
	) {
		emit("zoomRangeRemoved", selectedZoomIndex.value);
		removeZoomRange(selectedZoomIndex.value);
		selectedZoomIndex.value = null;
		// activeSegmentId.value'yu koru - zoom segment silme işlemi clip segmentleri etkilememeli
		// Timeline hesaplamalarını yeniden yapma - clip segmentlerin pozisyonlarını koru
		return;
	}

	// Video segment silme
	if (
		activeSegmentId.value !== null &&
		(event.key === "Delete" || event.key === "Backspace")
	) {
		event.preventDefault();
		event.stopPropagation(); // Stop event from bubbling to global handler
		// Active segment ID'sinden index'i bul
		const activeIndex = props.segments.findIndex(
			(s) => s.id === activeSegmentId.value
		);
		if (activeIndex !== -1) {
			emit("deleteSegment", activeIndex);
		}
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
	// Segment silme işlemi sırasında segmentUpdate emit etme
	if (props.isDeletingSegment) {
		return;
	}

	const newSegments = [...props.segments];
	newSegments[index] = {
		...props.segments[index], // Orijinal segment'i koru
		...updatedSegment, // Güncellenen değerleri uygula
		timelineStart: updatedSegment.timelineStart,
		timelineEnd: updatedSegment.timelineEnd,
		videoStart: updatedSegment.videoStart,
		videoEnd: updatedSegment.videoEnd,
		duration: updatedSegment.timelineEnd - updatedSegment.timelineStart,
		// originalVideoDuration'ı koru
		originalVideoDuration:
			props.segments[index].originalVideoDuration || props.duration,
		width: `${
			((updatedSegment.timelineEnd - updatedSegment.timelineStart) /
				props.duration) *
			100
		}%`,
		startPosition: `${(updatedSegment.timelineStart / props.duration) * 100}%`,
	};

	emit("segmentUpdate", newSegments);
};

// Segment seçme
const handleSegmentClick = (index, event) => {
	event.stopPropagation();
	const segment = props.segments[index];
	if (segment) {
		activeSegmentId.value = segment.id;
		emit("segmentSelect", index);
	}
};

// Segment drag state'leri
const isSegmentDragging = ref(false);
const draggedSegmentIndex = ref(null);
const dragStartData = ref(null);
const dragPreviewSegments = ref([]);

// Segment drag başlangıcı
const handleSegmentDragStart = (data) => {
	isSegmentDragging.value = true;
	draggedSegmentIndex.value = data.index;
	dragStartData.value = data;

	// Drag preview için segment listesini kopyala
	dragPreviewSegments.value = [...props.segments];
};

// Segment sürükleme
const handleSegmentDrag = (data) => {
	if (!isSegmentDragging.value || draggedSegmentIndex.value !== data.index)
		return;

	// Timeline container'ından pixel to time dönüşümü
	const timelineContainer = timelineRef.value;
	if (!timelineContainer) return;

	const deltaX = data.deltaX;
	const pixelsPerSecond = timelineWidth.value / maxDuration.value;
	const deltaTime = deltaX / pixelsPerSecond;

	// Yeni segment pozisyonunu hesapla
	const originalSegment = props.segments[data.index];
	const segmentDuration =
		originalSegment.timelineEnd - originalSegment.timelineStart;
	let newTimelineStart = dragStartData.value.startTime + deltaTime;
	let newTimelineEnd = newTimelineStart + segmentDuration;

	// Minimum 0'dan aşağı inmemesi için
	if (newTimelineStart < 0) {
		newTimelineStart = 0;
		newTimelineEnd = segmentDuration;
	}

	// Collision detection - diğer segment'lerle çakışma kontrolü
	const hasCollision = checkSegmentCollision(
		data.index,
		newTimelineStart,
		newTimelineEnd
	);

	if (!hasCollision) {
		// Geçici olarak segment pozisyonunu güncelle (visual feedback için)
		const updatedSegments = [...props.segments];
		updatedSegments[data.index] = {
			...originalSegment,
			timelineStart: newTimelineStart, // Timeline pozisyonu değişir
			timelineEnd: newTimelineEnd, // Timeline pozisyonu değişir
			videoStart: originalSegment.videoStart, // Video content pozisyonu değişmez
			videoEnd: originalSegment.videoEnd, // Video content pozisyonu değişmez
			duration: segmentDuration,
			originalVideoDuration:
				originalSegment.originalVideoDuration || maxDuration.value,
		};

		// Real-time visual feedback için emit et
		emit("segmentUpdate", updatedSegments);
	}
};

// Segment sürükleme bitişi
const handleVideoSegmentDragEnd = (data) => {
	if (!isSegmentDragging.value) return;

	// Timeline container'ından pixel to time dönüşümü
	const timelineContainer = timelineRef.value;
	if (!timelineContainer) return;

	const deltaX = data.endX - dragStartData.value.startX;
	const pixelsPerSecond = timelineWidth.value / maxDuration.value;
	const deltaTime = deltaX / pixelsPerSecond;

	// Final segment pozisyonunu hesapla
	const originalSegment = props.segments[data.index];
	const segmentDuration =
		originalSegment.timelineEnd - originalSegment.timelineStart;
	let newTimelineStart = dragStartData.value.startTime + deltaTime;
	let newTimelineEnd = newTimelineStart + segmentDuration;

	// Minimum 0'dan aşağı inmemesi için
	if (newTimelineStart < 0) {
		newTimelineStart = 0;
		newTimelineEnd = segmentDuration;
	}

	// Collision detection
	const hasCollision = checkSegmentCollision(
		data.index,
		newTimelineStart,
		newTimelineEnd
	);

	if (!hasCollision) {
		// Kalıcı değişiklik yap
		const updatedSegments = [...props.segments];
		updatedSegments[data.index] = {
			...originalSegment,
			timelineStart: newTimelineStart, // Timeline pozisyonu değişir
			timelineEnd: newTimelineEnd, // Timeline pozisyonu değişir
			videoStart: originalSegment.videoStart, // Video content pozisyonu değişmez
			videoEnd: originalSegment.videoEnd, // Video content pozisyonu değişmez
			duration: segmentDuration,
			originalVideoDuration:
				originalSegment.originalVideoDuration || maxDuration.value,
		};

		// Segment'leri güncelle
		emit("segmentUpdate", updatedSegments);
	}

	// Drag state'ini resetle
	isSegmentDragging.value = false;
	draggedSegmentIndex.value = null;
	dragStartData.value = null;
	dragPreviewSegments.value = [];
};

// Collision detection helper
const checkSegmentCollision = (
	draggedIndex,
	newTimelineStart,
	newTimelineEnd
) => {
	for (let i = 0; i < props.segments.length; i++) {
		if (i === draggedIndex) continue; // Kendi segment'i atla

		const segment = props.segments[i];
		const segmentTimelineStart = segment.timelineStart || segment.start || 0;
		const segmentTimelineEnd = segment.timelineEnd || segment.end || 0;

		// Çakışma kontrolü (overlap)
		if (
			newTimelineStart < segmentTimelineEnd &&
			newTimelineEnd > segmentTimelineStart
		) {
			return true; // Collision detected
		}
	}

	return false; // No collision
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
	if (selectedLayoutIndex.value === index) {
		selectedLayoutIndex.value = null;
		setCurrentLayoutRange(null);
	} else {
		selectedLayoutIndex.value = index;
		setCurrentLayoutRange(index);
	}
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
	emit("layoutRangeRemoved", index);
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
	const labels = {
		"camera-full": "Full Camera",
		"screen-full": "Full Screen",
	};

	if (layoutClickTime.value !== null) {
		const newLayout = {
			start: layoutClickTime.value,
			end: Math.min(layoutClickTime.value + 2, props.duration),
			type: type,
			label: labels[type],
		};

		if (!wouldOverlap(newLayout, -1)) {
			layoutRanges.value.push(newLayout);
			emit("layoutRangeAdded", newLayout);
		}
	}

	closeLayoutPopover();
};

// GIF Track Event Handlers
const handleGifTrackClick = (event) => {
	// Handle clicking on empty GIF track (could open GIF settings)
	// For now, just clear selection
	selectedGifId.value = null;
};

const handleGifTrackMouseMove = (event) => {
	// Handle mouse movement on GIF track
};

const handleGifTrackLeave = () => {
	isGifTrackHovered.value = false;
};

const handleGifSegmentClick = (segment) => {
	selectGif(segment.gif.id);
};

const handleGifSegmentUpdate = (updatedSegment) => {
	// Update the GIF with new timing/position
	const gif = activeGifs.value.find((g) => g.id === updatedSegment.gif.id);
	if (gif) {
		Object.assign(gif, updatedSegment.gif);
	}
};

const handleGifSegmentDelete = (segment) => {
	removeGif(segment.gif.id);
};

const handleGifDragStart = (data) => {
	isGifDragging.value = true;
	draggedGifIndex.value = gifSegments.value.findIndex(
		(s) => s.id === data.segment.id
	);
};

const handleGifDragEnd = () => {
	isGifDragging.value = false;
	draggedGifIndex.value = -1;
};

const handleGifResizeStart = () => {
	// Handle GIF resize start
};

const handleGifResizeEnd = () => {
	// Handle GIF resize end
};

// Video Track Event Handlers
const handleVideoTrackClick = (event) => {
	// Handle clicking on empty video track (could open video settings)
	// For now, just clear selection
	selectedGifId.value = null;
};

const handleVideoTrackMouseMove = (event) => {
	// Handle mouse movement on video track
};

const handleVideoTrackLeave = () => {
	isVideoTrackHovered.value = false;
};

const handleVideoSegmentClick = (segment) => {
	selectGif(segment.gif.id);
};

const handleVideoSegmentUpdate = (updatedSegment) => {
	// Update the video with new timing/position
	const gif = activeGifs.value.find((g) => g.id === updatedSegment.gif.id);
	if (gif) {
		Object.assign(gif, updatedSegment.gif);
	}
};

const handleVideoSegmentDelete = (segment) => {
	removeGif(segment.gif.id);
};

const handleVideoDragStart = (data) => {
	isVideoDragging.value = true;
	draggedVideoIndex.value = videoSegments.value.findIndex(
		(s) => s.id === data.segment.id
	);
};

const handleVideoDragEnd = () => {
	isVideoDragging.value = false;
	draggedVideoIndex.value = -1;
};

const handleVideoResizeStart = () => {
	// Handle video resize start
};

const handleVideoResizeEnd = () => {
	// Handle video resize end
};

// Video segment uzunluğunu izle ve zoom ayarla
watch(
	() => props.segments,
	() => {
		checkVideoSegmentDurationAndSetZoom();
	},
	{ deep: true }
);

// Lifecycle hooks
onMounted(() => {
	window.addEventListener("click", handleClickOutside);
	window.addEventListener("keydown", handleKeyDown);
	window.addEventListener("keydown", handleGifKeyDown);

	// Video segment uzunluğunu kontrol et ve zoom ayarla
	checkVideoSegmentDurationAndSetZoom();
});

onUnmounted(() => {
	window.removeEventListener("click", handleClickOutside);
	window.removeEventListener("keydown", handleKeyDown);
	window.removeEventListener("keydown", handleGifKeyDown);
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

.time-dot:after {
	content: "";
	position: absolute;
	top: 30px;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 1px;
	background: linear-gradient(to bottom, #ffffff24, #ffffff00);
	height: 40px;
	z-index: 0;
}
</style>
