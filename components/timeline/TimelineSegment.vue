<template>
	<div
		class="h-full ring-inset relative transition-all duration-200 group"
		:class="{
			'ring-[1px] ring-white z-30': isActive,
			'hover:!ring-[1px] hover:!ring-white hover:z-30':
				!isResizing && !isActive && !isDragging,
			'z-10': !isResizing && !isActive && !isHovered && !isDragging,
			'cursor-grabbing': isDragging,
			'cursor-grab': !isDragging && !isSplitMode && !isResizing,
		}"
		:style="segmentStyle"
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
			<span class="text-white/70 text-[10px] font-medium tracking-wide">{{
				label
			}}</span>
			<span class="text-white/90 text-sm font-medium tracking-wide mt-0.5">
				{{ formattedDuration }} @ {{ speed }}x
			</span>
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
			transition: isResizing.value ? "none" : "all 0.2s ease",
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
		transition: isResizing.value ? "none" : "all 0.2s ease",
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

const handleDragStart = (event) => {
	if (props.isResizing || props.isSplitMode) return;

	event.preventDefault();
	event.stopPropagation();

	isDraggingLocal.value = true;
	dragStartX.value = event.clientX;
	dragStartTime.value = props.segment.timelineStart || props.segment.start || 0;

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
