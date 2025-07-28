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
			'transition-all duration-200': !isDragging && !isDraggingLocal,
		}"
		:style="segmentStyle"
		:data-segment-id="segment.id"
		@click.stop="handleClick"
		@mousemove="handleMouseMove"
		@mouseleave="handleMouseLeave"
		@mousedown.stop="handleMouseDown"
	>
		<!-- Background GIF Preview Image -->
		<div
			class="absolute inset-0 overflow-hidden"
			:style="{
				borderRadius: '10px',
				backgroundImage: `url(${segment.gif.url})`,
				backgroundSize: 'auto 100%',
				backgroundRepeat: 'repeat-x',
				backgroundPosition: 'left center',
				opacity: 0.3,
				filter: 'blur(0.5px)',
			}"
		>
			<div
				class="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"
			></div>
		</div>

		<!-- Segment Content - Responsive layout based on timeline hover -->
		<div
			class="absolute inset-0 flex items-center justify-center text-center pointer-events-none"
		>
			<!-- Timeline Hovered: Vertical layout (icon above text) -->
			<div
				v-if="isTimelineHovered"
				class="flex flex-col items-center justify-center"
			>
				<span
					class="text-white/70 text-[10px] font-medium tracking-wide mb-0.5"
				>
					{{ segment.gif.type === "image" ? "IMAGE" : "GIF" }}
				</span>
				<span
					class="text-white/90 text-sm font-medium tracking-wide truncate max-w-[100px]"
				>
					{{ segment.gif.title }}
				</span>
			</div>

			<!-- Timeline Not Hovered: Horizontal layout (icon and text side by side) -->
			<div v-else class="flex items-center justify-center gap-1.5">
				<svg
					v-if="segment.gif.type === 'image'"
					class="w-3 h-3 text-white/70 flex-shrink-0"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						d="M12.75 8.25V15.75M18.75 8.25H15.75V12M15.75 12V15.75M15.75 12H18M9.75 9.34835C8.72056 7.88388 7.05152 7.88388 6.02208 9.34835C4.99264 10.8128 4.99264 13.1872 6.02208 14.6517C7.05152 16.1161 8.72056 16.1161 9.75 14.6517V12H8.25M4.5 19.5H19.5C20.7426 19.5 21.75 18.4926 21.75 17.25V6.75C21.75 5.50736 20.7426 4.5 19.5 4.5H4.5C3.25736 4.5 2.25 5.50736 2.25 6.75V17.25C2.25 18.4926 3.25736 19.5 4.5 19.5Z"
						stroke="white"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				<svg
					v-else
					class="w-3 h-3 text-white/70 flex-shrink-0"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6Z M8 12L10 14L16 8 M14 16H18V12"
					/>
				</svg>
				<span
					class="text-white/90 text-xs font-medium tracking-wide truncate max-w-[120px]"
				>
					{{ segment.gif.title }}
				</span>
			</div>
		</div>

		<!-- Left Edge Handle -->
		<div
			class="absolute left-1 top-0 bottom-0 w-1 z-50 flex items-center justify-start opacity-0 transition-opacity duration-200"
			:class="{
				'opacity-80': isActive && isTimelineHovered,
				'group-hover:opacity-80':
					!isResizing && !isDragging && isTimelineHovered,
				hidden: !isTimelineHovered,
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
				'opacity-80': isActive && isTimelineHovered,
				'group-hover:opacity-80':
					!isResizing && !isDragging && isTimelineHovered,
				hidden: !isTimelineHovered,
			}"
			@mousedown.stop="handleResizeStart($event, 'end')"
		>
			<div
				class="w-[3px] h-[24px] bg-white rounded-full cursor-ew-resize"
			></div>
		</div>

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
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useGifManager } from "~/composables/useGifManager";

const props = defineProps({
	segment: {
		type: Object,
		required: true,
	},
	timelineWidth: {
		type: Number,
		required: true,
	},
	timeScale: {
		type: Number,
		required: true,
	},
	isActive: {
		type: Boolean,
		default: false,
	},
	isDragging: {
		type: Boolean,
		default: false,
	},
	isSplitMode: {
		type: Boolean,
		default: false,
	},
	isTimelineHovered: {
		type: Boolean,
		default: false,
	},
});

const emit = defineEmits([
	"click",
	"update",
	"delete",
	"drag-start",
	"drag-end",
	"resize-start",
	"resize-end",
	"split",
]);

const { removeGif, selectGif } = useGifManager();

// Local state
const segmentRef = ref(null);
const isDraggingLocal = ref(false);
const isResizing = ref(false);
const isHovered = ref(false);
const mousePosition = ref({ x: 0, y: 0 });
const dragOffset = ref({ x: 0, y: 0 });
const resizeType = ref("");

// Computed properties
const segmentStyle = computed(() => {
	const startX = props.segment.gif.startTime * props.timeScale;
	const duration = props.segment.gif.endTime - props.segment.gif.startTime;
	const width = duration * props.timeScale;

	return {
		left: `${startX}px`,
		width: `${Math.max(width, 50)}px`,
		backgroundColor: "rgba(59, 130, 246, 0.1)", // Blue background for GIF segments
		borderRadius: props.isTimelineHovered ? "10px" : "6px",
		height: props.isTimelineHovered ? "100%" : "46%",
		border: props.isActive
			? "1px solid rgba(255, 255, 255, 0.5)"
			: "0.5px solid rgba(255, 255, 255, 0.2)",
		transition: props.isDragging ? "none" : "all 0.2s ease",
	};
});

// Event handlers
const handleClick = () => {
	emit("click", props.segment);
	selectGif(props.segment.gif.id);
};

const handleMouseMove = (event) => {
	if (!props.isSplitMode) return;

	const rect = segmentRef.value.getBoundingClientRect();
	mousePosition.value = {
		x: event.clientX - rect.left,
		y: event.clientY - rect.top,
	};
	isHovered.value = true;
};

const handleMouseLeave = () => {
	isHovered.value = false;
	mousePosition.value = { x: 0, y: 0 };
};

const handleMouseDown = (event) => {
	if (props.isSplitMode) {
		// Handle split
		const rect = segmentRef.value.getBoundingClientRect();
		const clickX = event.clientX - rect.left;
		const relativeTime = clickX / props.timeScale;
		const splitTime = props.segment.gif.startTime + relativeTime;

		emit("split", {
			segment: props.segment,
			splitTime,
		});
		return;
	}

	// Start dragging
	const rect = segmentRef.value.getBoundingClientRect();
	dragOffset.value = {
		x: event.clientX - rect.left,
		y: event.clientY - rect.top,
	};

	isDraggingLocal.value = true;
	emit("drag-start", {
		segment: props.segment,
		offset: dragOffset.value,
	});

	// Add global mouse event listeners
	document.addEventListener("mousemove", handleGlobalMouseMove);
	document.addEventListener("mouseup", handleGlobalMouseUp);
};

const handleGlobalMouseMove = (event) => {
	if (!isDraggingLocal.value && !isResizing.value) return;

	if (isDraggingLocal.value) {
		// Handle drag
		const timelineRect = segmentRef.value.parentElement.getBoundingClientRect();
		const newX = event.clientX - timelineRect.left - dragOffset.value.x;
		const newTime = Math.max(0, newX / props.timeScale);
		const duration = props.segment.gif.endTime - props.segment.gif.startTime;

		// Update segment timing
		const updatedSegment = {
			...props.segment,
			gif: {
				...props.segment.gif,
				startTime: newTime,
				endTime: newTime + duration,
			},
		};

		emit("update", updatedSegment);
	}
};

const handleGlobalMouseUp = () => {
	if (isDraggingLocal.value) {
		isDraggingLocal.value = false;
		emit("drag-end", props.segment);
	}

	if (isResizing.value) {
		isResizing.value = false;
		resizeType.value = "";
		emit("resize-end", props.segment);
	}

	// Remove global event listeners
	document.removeEventListener("mousemove", handleGlobalMouseMove);
	document.removeEventListener("mouseup", handleGlobalMouseUp);
};

const handleResizeStart = (event, type) => {
	event.stopPropagation();

	isResizing.value = true;
	resizeType.value = type;

	emit("resize-start", {
		segment: props.segment,
		type,
	});

	// Add global mouse event listeners for resize
	document.addEventListener("mousemove", handleResizeMove);
	document.addEventListener("mouseup", handleResizeEnd);
};

const handleResizeMove = (event) => {
	if (!isResizing.value) return;

	const timelineRect = segmentRef.value.parentElement.getBoundingClientRect();
	const mouseX = event.clientX - timelineRect.left;
	const mouseTime = mouseX / props.timeScale;

	let updatedSegment = { ...props.segment };

	if (resizeType.value === "start") {
		// Resize from start
		const minStartTime = 0;
		const maxStartTime = props.segment.gif.endTime - 0.1; // Minimum 0.1s duration
		const newStartTime = Math.max(
			minStartTime,
			Math.min(maxStartTime, mouseTime)
		);

		updatedSegment.gif = {
			...updatedSegment.gif,
			startTime: newStartTime,
		};
	} else if (resizeType.value === "end") {
		// Resize from end
		const minEndTime = props.segment.gif.startTime + 0.1; // Minimum 0.1s duration
		const newEndTime = Math.max(minEndTime, mouseTime);

		updatedSegment.gif = {
			...updatedSegment.gif,
			endTime: newEndTime,
		};
	}

	emit("update", updatedSegment);
};

const handleResizeEnd = () => {
	isResizing.value = false;
	resizeType.value = "";
	emit("resize-end", props.segment);

	// Remove global event listeners
	document.removeEventListener("mousemove", handleResizeMove);
	document.removeEventListener("mouseup", handleResizeEnd);
};

// Cleanup on unmount
onUnmounted(() => {
	document.removeEventListener("mousemove", handleGlobalMouseMove);
	document.removeEventListener("mouseup", handleGlobalMouseUp);
	document.removeEventListener("mousemove", handleResizeMove);
	document.removeEventListener("mouseup", handleResizeEnd);
});
</script>

<style scoped>
.segment-transition {
	transition: left 0.1s ease-out, width 0.1s ease-out;
}

/* Prevent GIF animation completely in timeline segments */
div[style*="background-image"] {
	background-attachment: fixed !important;
}

/* Static background image - no animation */
:deep(img),
img {
	animation: none !important;
	animation-play-state: paused !important;
	animation-duration: 0s !important;
	animation-iteration-count: 0 !important;
}
</style>
