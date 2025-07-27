<template>
	<div
		ref="segmentRef"
		class="h-full ring-inset relative group"
		:class="{
			'ring-[1px] ring-white z-30': isActive,
			'hover:!ring-[1px] hover:!ring-white hover:z-30':
				!isResizing && !isActive && !isDragging && !isDraggingLocal,
			'z-10':
				!isResizing &&
				!isActive &&
				!isHovered &&
				!isDragging &&
				!isDraggingLocal,
			'cursor-grabbing': isDragging || isDraggingLocal,
			'cursor-grab':
				!isDragging && !isDraggingLocal && !isSplitMode && !isResizing,
			'transition-all duration-200': !isDragging && !isDraggingLocal, // Hem local hem prop state kontrolü
		}"
		:style="segmentStyle"
		:data-segment-id="segment.id"
		@click.stop="handleClick"
		@mousemove="handleMouseMove"
		@mouseleave="handleMouseLeave"
		@mousedown.stop="handleMouseDown"
	>
		<!-- Split Indicator -->
		<div
			v-if="isSplitMode && mousePosition.x > 0"
			class="absolute top-0 bottom-0 w-[1px] bg-white pointer-events-none transition-all duration-75"
			:style="{
				left: `${mousePosition.x}px`,
				opacity: 0.8,
				height: '100%',
			}"
		></div>

		<!-- Left Edge Handle -->
		<div
			class="absolute left-1 top-0 bottom-0 w-1 z-50 flex items-center justify-start opacity-0 transition-opacity duration-200"
			:class="{
				'opacity-80': isActive,
				'group-hover:opacity-80': !isResizing,
			}"
			@mousedown.stop="handleResizeStart($event, 'start')"
		>
			<div
				class="w-[3px] h-[24px] bg-white rounded-full cursor-ew-resize"
			></div>
		</div>

		<!-- Right Edge Handle -->
		<div
			class="absolute right-1 top-0 bottom-0 w-1 z-50 flex items-center justify-end opacity-0 transition-opacity duration-200"
			:class="{
				'opacity-80': isActive,
				'group-hover:opacity-80': !isResizing,
			}"
			@mousedown.stop="handleResizeStart($event, 'end')"
		>
			<div
				class="w-[3px] h-[24px] bg-white rounded-full cursor-ew-resize"
			></div>
		</div>

		<!-- Segment Content -->
		<div
			class="absolute inset-0 flex flex-col items-center justify-center text-center"
		>
			<!-- Top Row: Video Icon + Label -->
			<div class="flex items-center justify-center gap-1.5 mb-1">
				<!-- Video Icon -->
				<svg
					class="w-3 h-3 text-white/70"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M3.375 19.5H20.625M3.375 19.5C2.75368 19.5 2.25 18.9963 2.25 18.375M3.375 19.5H4.875C5.49632 19.5 6 18.9963 6 18.375M2.25 18.375V5.625M2.25 18.375V16.875C2.25 16.2537 2.75368 15.75 3.375 15.75M21.75 18.375V5.625M21.75 18.375C21.75 18.9963 21.2463 19.5 20.625 19.5M21.75 18.375V16.875C21.75 16.2537 21.2463 15.75 20.625 15.75M20.625 19.5H19.125C18.5037 19.5 18 18.9963 18 18.375M20.625 4.5H3.375M20.625 4.5C21.2463 4.5 21.75 5.00368 21.75 5.625M20.625 4.5H19.125C18.5037 4.5 18 5.00368 18 5.625M21.75 5.625V7.125C21.75 7.74632 21.2463 8.25 20.625 8.25M3.375 4.5C2.75368 4.5 2.25 5.00368 2.25 5.625M3.375 4.5H4.875C5.49632 4.5 6 5.00368 6 5.625M2.25 5.625V7.125C2.25 7.74632 2.75368 8.25 3.375 8.25M3.375 8.25H4.875M3.375 8.25C2.75368 8.25 2.25 8.75368 2.25 9.375V10.875C2.25 11.4963 2.75368 12 3.375 12M4.875 8.25C5.49632 8.25 6 7.74632 6 7.125V5.625M4.875 8.25C5.49632 8.25 6 8.75368 6 9.375V10.875M6 5.625V10.875M6 5.625C6 5.00368 6.50368 4.5 7.125 4.5H16.875C17.4963 4.5 18 5.00368 18 5.625M19.125 8.25H20.625M19.125 8.25C18.5037 8.25 18 7.74632 18 7.125V5.625M19.125 8.25C18.5037 8.25 18 8.75368 18 9.375V10.875M20.625 8.25C21.2463 8.25 21.75 8.75368 21.75 9.375V10.875C21.75 11.4963 21.2463 12 20.625 12M18 5.625V10.875M7.125 12H16.875M7.125 12C6.50368 12 6 11.4963 6 10.875M7.125 12C6.50368 12 6 12.5037 6 13.125M6 10.875C6 11.4963 5.49632 12 4.875 12M18 10.875C18 11.4963 17.4963 12 16.875 12M18 10.875C18 11.4963 18.5037 12 19.125 12M16.875 12C17.4963 12 18 12.5037 18 13.125M6 18.375V13.125M6 18.375C6 18.9963 6.50368 19.5 7.125 19.5H16.875C17.4963 19.5 18 18.9963 18 18.375M6 18.375V16.875C6 16.2537 5.49632 15.75 4.875 15.75M18 18.375V13.125M18 18.375V16.875C18 16.2537 18.5037 15.75 19.125 15.75M18 13.125V14.625C18 15.2463 18.5037 15.75 19.125 15.75M18 13.125C18 12.5037 18.5037 12 19.125 12M6 13.125V14.625C6 15.2463 5.49632 15.75 4.875 15.75M6 13.125C6 12.5037 5.49632 12 4.875 12M3.375 12H4.875M3.375 12C2.75368 12 2.25 12.5037 2.25 13.125V14.625C2.25 15.2463 2.75368 15.75 3.375 15.75M19.125 12H20.625M20.625 12C21.2463 12 21.75 12.5037 21.75 13.125V14.625C21.75 15.2463 21.2463 15.75 20.625 15.75M3.375 15.75H4.875M19.125 15.75H20.625"
						stroke="white"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				<span class="text-white/70 text-[10px] font-medium tracking-wide">
					{{ label }}
				</span>
			</div>

			<!-- Bottom Row: Duration + Speed -->
			<div class="flex items-center justify-center gap-1.5">
				<span class="text-white/90 text-sm font-medium tracking-wide">
					{{ formattedDuration }}
				</span>
				<span class="text-white/90 text-[10px] font-medium tracking-wide">
					@ {{ speed }}x
				</span>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
	segment: {
		type: Object,
		required: true,
	},
	index: {
		type: Number,
		required: true,
	},
	isActive: {
		type: Boolean,
		default: false,
	},
	isResizing: {
		type: Boolean,
		default: false,
	},
	isHovered: {
		type: Boolean,
		default: false,
	},
	isSplitMode: {
		type: Boolean,
		default: false,
	},
	isDragging: {
		type: Boolean,
		default: false,
	},
	duration: {
		type: Number,
		required: true,
	},
	originalVideoDuration: {
		type: Number,
		required: true,
	},
	label: {
		type: String,
		default: "Clip",
	},
	speed: {
		type: Number,
		default: 1,
	},
});

const emit = defineEmits([
	"click",
	"mouseMove",
	"mouseLeave",
	"resizeStart",
	"resizeUpdate",
	"resizeEnd",
	"split",
	"dragStart",
	"drag",
	"dragEnd",
]);

// Mouse position for split mode
const mousePosition = ref({ x: 0 });

// Resize state'leri
const isResizing = ref(false);
const resizeStartX = ref(0);
const resizeStartWidth = ref(0);
const resizeStartLeft = ref(0);
const resizeStartTime = ref(0);
const resizeEdge = ref(null);

// Computed styles for the segment
const segmentStyle = computed(() => {
	// Sıkıştırılmış timeline'da segment pozisyonu
	if (
		props.segment.timelineStart !== undefined &&
		props.segment.timelineEnd !== undefined
	) {
		// TimelineComponent'ten gelen sıkıştırılmış pozisyonları kullan
		const timelineStart = props.segment.timelineStart;
		const timelineEnd = props.segment.timelineEnd;
		const duration = timelineEnd - timelineStart;

		// Timeline'da segment'in kapladığı alan (sıkıştırılmış)
		const width = (duration / props.duration) * 100;
		const left = (timelineStart / props.duration) * 100;

		return {
			width: `${width}%`,
			left: `${left}%`,
			position: "absolute",
			transition:
				isResizing.value || props.isDragging ? "none" : "all 0.2s ease", // Sürükleme sırasında da transition yok
			zIndex: props.isActive ? "10" : "1",
			borderRadius: "10px",
			backgroundColor: "rgb(140,91,7)",
			background: props.isActive
				? "linear-gradient(180deg, rgba(160,111,27,1) 0%, rgba(225,161,50,1) 100%, rgba(254,168,19,1) 100%)"
				: "linear-gradient(180deg, rgba(140,91,7,1) 0%, rgba(205,141,30,1) 100%, rgba(254,168,19,1) 100%)",
			border: props.isActive
				? "1px solid rgba(255, 255, 255, 0.3)"
				: "0.25px solid rgba(255, 255, 255, 0.1)",
			height: "100%",
			cursor: "pointer",
		};
	}

	// Normal timeline pozisyonu - timelineStart/timelineEnd değerlerini kullan
	const timelineStart = props.segment.timelineStart || props.segment.start || 0;
	const timelineEnd = props.segment.timelineEnd || props.segment.end || 0;
	const duration = timelineEnd - timelineStart;
	const width = (duration / props.duration) * 100;
	const left = (timelineStart / props.duration) * 100;

	return {
		width: `${width}%`,
		left: `${left}%`,
		position: "absolute",
		transition:
			isResizing.value || props.isDragging || isDraggingLocal.value
				? "none"
				: "all 0.2s ease", // Hem local hem prop state kontrolü
		zIndex: props.isActive ? "10" : "1",
		borderRadius: "10px",
		backgroundColor: "rgb(140,91,7)",
		background: props.isActive
			? "linear-gradient(180deg, rgba(160,111,27,1) 0%, rgba(225,161,50,1) 100%, rgba(254,168,19,1) 100%)"
			: "linear-gradient(180deg, rgba(140,91,7,1) 0%, rgba(205,141,30,1) 100%, rgba(254,168,19,1) 100%)",
		border: props.isActive
			? "1px solid rgba(255, 255, 255, 0.3)"
			: "0.25px solid rgba(255, 255, 255, 0.1)",
		height: "100%",
		cursor: props.isDragging || isDraggingLocal.value ? "grabbing" : "grab", // Hem local hem prop state kontrolü
		transform: "translate3d(0,0,0)", // Hardware acceleration - zoom segmenti gibi
		willChange:
			props.isDragging || isDraggingLocal.value ? "transform" : "auto", // Hem local hem prop state kontrolü
	};
});

// Format duration for display
const formattedDuration = computed(() => {
	// Timeline süresini göster (timelineStart/timelineEnd)
	const timelineStart = props.segment.timelineStart || props.segment.start || 0;
	const timelineEnd = props.segment.timelineEnd || props.segment.end || 0;
	const seconds = timelineEnd - timelineStart;
	const s = Math.floor(seconds);

	return `${s}s`;
});

// Event handlers
const handleClick = (event) => {
	emit("click", props.index, event);
};

const handleMouseMove = (event) => {
	if (!props.isSplitMode) return;

	const segment = event.currentTarget;
	const rect = segment.getBoundingClientRect();
	const x = event.clientX - rect.left;
	mousePosition.value = { x };

	emit("mouseMove", event, props.index);
};

const handleMouseLeave = () => {
	mousePosition.value = { x: 0 };
	emit("mouseLeave");
};

const handleResizeStart = (event, edge) => {
	event.stopPropagation();

	const segmentEl = event.currentTarget.closest(".h-full");
	const rect = segmentEl.getBoundingClientRect();

	isResizing.value = true;
	resizeEdge.value = edge;
	resizeStartX.value = event.clientX;
	resizeStartWidth.value = rect.width;
	resizeStartLeft.value = rect.left;

	// Resize başlangıç zamanını video content pozisyonlarından al
	if (edge === "start") {
		resizeStartTime.value =
			props.segment.videoStart || props.segment.startTime || 0;
	} else {
		resizeStartTime.value =
			props.segment.videoEnd || props.segment.endTime || 0;
	}

	// Resize durumunu güncelle
	emit("resizeStart", event, props.index, edge);

	// Global event listener'ları ekle
	window.addEventListener("mousemove", handleResize);
	window.addEventListener("mouseup", handleResizeEnd);
};

const handleResize = (event) => {
	if (!isResizing.value) return;

	// Timeline container'ını bul
	const timelineContainer = document.querySelector(".timeline-layer-bar");
	if (!timelineContainer) return;

	const timelineRect = timelineContainer.getBoundingClientRect();
	const dx = event.clientX - resizeStartX.value;
	const pixelsPerSecond = timelineRect.width / props.duration;

	// Zaman değişimini hesapla
	const timeChange = dx / pixelsPerSecond;

	// Video content pozisyonlarını hesapla (videoStart/videoEnd)
	let newVideoStart = props.segment.videoStart || props.segment.startTime || 0;
	let newVideoEnd = props.segment.videoEnd || props.segment.endTime || 0;

	if (resizeEdge.value === "start") {
		// Start edge resize: videoStart'ı değişim miktarına göre güncelle
		const newVideoStartValue = Math.max(0, resizeStartTime.value + timeChange);
		newVideoStart = Math.min(newVideoStartValue, newVideoEnd - 0.1);
		newVideoEnd = props.segment.videoEnd || props.segment.endTime || 0; // videoEnd aynı kalır
	} else {
		// End edge resize: videoEnd'ı değişim miktarına göre güncelle
		const newVideoEndValue = resizeStartTime.value + timeChange;
		newVideoEnd = Math.max(
			newVideoStart + 0.1,
			Math.min(newVideoEndValue, props.originalVideoDuration)
		);
		newVideoStart = props.segment.videoStart || props.segment.startTime || 0; // videoStart aynı kalır
	}

	// Video content pozisyonlarının original video duration'ı geçmemesini sağla
	if (newVideoStart >= props.originalVideoDuration) {
		newVideoStart = props.originalVideoDuration - 0.1;
	}
	if (newVideoEnd > props.originalVideoDuration) {
		newVideoEnd = props.originalVideoDuration;
	}

	// Timeline pozisyonlarını video content pozisyonlarına göre hesapla
	const videoContentDuration = newVideoEnd - newVideoStart;
	const originalVideoStart =
		props.segment.videoStart || props.segment.startTime || 0;
	const originalVideoEnd = props.segment.videoEnd || props.segment.endTime || 0;
	const originalVideoDuration = originalVideoEnd - originalVideoStart;

	// Timeline pozisyonlarını koru, sadece video content değişsin
	const newTimelineStart =
		props.segment.timelineStart || props.segment.start || 0;
	const newTimelineEnd = newTimelineStart + videoContentDuration;

	// Debug log
	console.log(`[TimelineSegment] Resize ${resizeEdge.value}:`, {
		original: {
			timelineStart: props.segment.timelineStart || props.segment.start,
			timelineEnd: props.segment.timelineEnd || props.segment.end,
			videoStart: props.segment.videoStart || props.segment.startTime,
			videoEnd: props.segment.videoEnd || props.segment.endTime,
		},
		new: {
			timelineStart: newTimelineStart,
			timelineEnd: newTimelineEnd,
			videoStart: newVideoStart,
			videoEnd: newVideoEnd,
		},
		originalVideoDuration: props.originalVideoDuration,
	});

	const updatedSegment = {
		...props.segment,
		timelineStart: newTimelineStart,
		timelineEnd: newTimelineEnd,
		videoStart: newVideoStart,
		videoEnd: newVideoEnd,
		duration: newTimelineEnd - newTimelineStart,
	};

	emit("resizeUpdate", updatedSegment, props.index);
};

const handleResizeEnd = (event) => {
	// Global event listener'ları kaldır
	window.removeEventListener("mousemove", handleResize);
	window.removeEventListener("mouseup", handleResizeEnd);

	// Resize durumunu resetle
	isResizing.value = false;
	resizeEdge.value = null;

	// Resize bittiğini emit et
	emit("resizeEnd", props.index);
};

// Mouse down handler - handles both split and drag
const handleMouseDown = (event) => {
	if (props.isSplitMode) {
		handleSplit(event);
		return;
	}

	// Check if clicking on resize handles
	const target = event.target;
	if (target.closest(".cursor-ew-resize")) {
		// Resize handle clicked, let resize handler take over
		return;
	}

	// Start drag operation
	handleDragStart(event);
};

const handleSplit = (event) => {
	if (!props.isSplitMode) return;

	const segment = event.currentTarget;
	const rect = segment.getBoundingClientRect();
	const x = event.clientX - rect.left;
	const ratio = x / rect.width;

	emit("split", event, props.index, ratio);
};

// Drag functionality
const isDraggingLocal = ref(false);
const dragStartX = ref(0);
const dragStartTime = ref(0);
const segmentRef = ref(null); // Segment element'ini ref ile tut

const handleDragStart = (event) => {
	if (props.isResizing || props.isSplitMode) return;

	event.preventDefault();
	event.stopPropagation();

	isDraggingLocal.value = true;
	dragStartX.value = event.clientX;
	dragStartTime.value = props.segment.timelineStart || props.segment.start || 0;

	// Performance için style güncellemesi - zoom segmenti gibi
	const segmentEl = event.currentTarget;
	segmentEl.style.willChange = "transform";
	segmentEl.style.transition = "none";

	emit("dragStart", {
		index: props.index,
		segment: props.segment,
		startX: event.clientX,
		startTime: props.segment.timelineStart || props.segment.start || 0,
	});

	// Add global event listeners
	window.addEventListener("mousemove", handleDragMove, { passive: false });
	window.addEventListener("mouseup", handleDragEnd);
};

const handleDragMove = (event) => {
	if (!isDraggingLocal.value) return;

	event.preventDefault();

	const deltaX = event.clientX - dragStartX.value;

	emit("drag", {
		index: props.index,
		segment: props.segment,
		deltaX: deltaX,
		currentX: event.clientX,
	});
};

const handleDragEnd = (event) => {
	if (!isDraggingLocal.value) return;

	isDraggingLocal.value = false;

	// Performance style'larını resetle - güvenli yaklaşım
	// Önce ref'ten dene, sonra data-segment-id ile bul
	let segmentEl = segmentRef.value;
	if (!segmentEl) {
		segmentEl = document.querySelector(
			`[data-segment-id="${props.segment.id}"]`
		);
	}
	if (!segmentEl) {
		// Son çare olarak tüm segment element'lerini bul ve ilkini al
		const allSegments = document.querySelectorAll(".h-full.ring-inset");
		segmentEl = allSegments[0];
	}

	if (segmentEl) {
		segmentEl.style.willChange = "auto";
		segmentEl.style.transition = null;
	}

	emit("dragEnd", {
		index: props.index,
		segment: props.segment,
		endX: event.clientX,
	});

	// Remove global event listeners
	window.removeEventListener("mousemove", handleDragMove);
	window.removeEventListener("mouseup", handleDragEnd);
};
</script>
