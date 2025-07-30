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
			<!-- GIF için mavi/mor gradient, Image için yeşil/turuncu gradient -->
			<div
				class="absolute inset-0"
				:class="{
					'bg-gradient-to-r from-blue-600/20 to-purple-600/20':
						segment.gif.type === 'gif',
					'bg-gradient-to-r from-green-600/20 to-orange-600/20':
						segment.gif.type === 'image',
					'bg-gradient-to-r from-red-600/20 to-pink-600/20':
						segment.gif.type === 'video',
				}"
			></div>
		</div>

		<!-- Segment Content - Video segment stilini kullan -->
		<div
			:class="{
				'!flex-row gap-2': hasVideo
					? isTimelineHovered
						? false
						: true
					: false,
			}"
			class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
		>
			<!-- Top Row: Icon + Label -->
			<div class="flex items-center justify-center gap-1.5">
				<!-- GIF Icon -->
				<svg
					v-if="segment.gif.type === 'gif'"
					class="w-3 h-3 text-white/70"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M12 2L2 7L12 12L22 7L12 2Z"
						stroke="white"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M2 17L12 22L22 17"
						stroke="white"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M2 12L12 17L22 12"
						stroke="white"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>

				<!-- Image Icon -->
				<svg
					v-else-if="segment.gif.type === 'image'"
					class="w-3 h-3 text-white/70"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19Z"
						stroke="white"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M8.5 10C9.32843 10 10 9.32843 10 8.5C10 7.67157 9.32843 7 8.5 7C7.67157 7 7 7.67157 7 8.5C7 9.32843 7.67157 10 8.5 10Z"
						stroke="white"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M21 15L16 10L5 21"
						stroke="white"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>

				<!-- Video Icon -->
				<svg
					v-else-if="segment.gif.type === 'video'"
					class="w-3 h-3 text-white/70"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M3.375 19.5H20.625M3.375 19.5C2.75368 19.5 2.25 18.9963 2.25 18.375M3.375 19.5H4.875C5.49632 19.5 6 18.9963 6 18.375M2.25 18.375V5.625M2.25 18.375V16.875C2.25 16.2537 2.75368 15.75 3.375 15.75M21.75 18.375V5.625M21.75 18.375C21.75 18.9963 21.2463 19.5 20.625 19.5M21.75 18.375V16.875C21.75 16.2537 21.2463 15.75 20.625 15.75M20.625 19.5H19.125C18.5037 19.5 18 18.9963 18 18.375M20.625 4.5H3.375M20.625 4.5C21.2463 4.5 21.75 5.00368 21.75 5.625M20.625 4.5H19.125C18.5037 4.5 18 5.00368 18 5.625M21.75 5.625V7.125C21.75 7.74632 21.2463 8.25 20.625 8.25M3.375 4.5C2.75368 4.5 2.25 5.00368 2.25 5.625M3.375 4.5H4.875C5.49632 4.5 6 5.00368 6 5.625M2.25 5.625V7.125C2.25 7.74632 2.75368 8.25 3.375 8.25M3.375 8.25H4.875M3.375 8.25C2.75368 8.25 2.25 8.75368 2.25 9.375V10.875C2.25 11.4963 2.75368 12 3.375 12M4.875 8.25C5.49632 8.25 6 7.74632 6 7.125V5.625M4.875 8.25C5.49632 8.25 6 8.75368 6 9.375V10.875M6 5.625V10.875M6 5.625C6 5.00368 6.50368 4.5 7.125 4.5H16.875C17.4963 4.5 18 5.00368 18 5.625M19.125 8.25H20.625M19.125 8.25C18.5037 8.25 18 7.74632 18 7.125V5.625M19.125 8.25C18.5037 8.25 18 8.75368 18 9.375V10.875M20.625 8.25C21.2463 8.25 21.75 8.75368 21.75 9.375V10.875C21.75 11.4963 21.2463 12 20.625 12M18 5.625V10.875M7.125 12H16.875M7.125 12C6.50368 12 6 11.4963 6 10.875M7.125 12C6.50368 12 6 12.5037 6 13.125M6 10.875C6 11.4963 5.49632 12 4.875 12M18 10.875C18 11.4963 17.4963 12 16.875 12M18 10.875C18 11.4963 18.5037 12 19.125 12M16.875 12C17.4963 12 18 12.5037 18 13.125M6 18.375V13.125M6 18.375C6 18.9963 6.50368 19.5 7.125 19.5H16.875C17.4963 19.5 18 18.9963 18 18.375M6 18.375V16.875C6 16.2537 5.49632 15.75 4.875 15.75M18 18.375V13.125M18 18.375V16.875C18 16.2537 18.5037 15.75 19.125 15.75M18 13.125V14.625C18 15.2463 18.5037 15.75 19.125 15.75M18 13.125C18 12.5037 18.5037 12 19.125 12M6 13.125V14.625C6 15.2463 5.49632 15.75 4.875 15.75M6 13.125C6 12.5037 5.49632 12 4.875 12M3.375 12H4.875M3.375 12C2.75368 12 2.25 12.5037 2.25 13.125V14.625C2.25 15.2463 2.75368 15.75 3.375 15.75M19.125 12H20.625M20.625 12C21.2463 12 21.75 12.5037 21.75 13.125V14.625C21.75 15.2463 21.2463 15.75 20.625 15.75M3.375 15.75H4.875M19.125 15.75H20.625"
						stroke="white"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>

				<span class="text-white/70 text-[10px] font-medium tracking-wide">
					{{
						segment.gif.type === "image"
							? "IMAGE"
							: segment.gif.type === "video"
							? "CLIP"
							: "GIF"
					}}
					- {{ segment.gif.title }}
				</span>
			</div>

			<!-- Bottom Row: Duration -->
			<div class="flex items-center justify-center gap-1.5">
				<span class="text-white/90 text-sm font-medium tracking-wide">
					{{ formattedDuration }}
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
	hasVideo: {
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

// Format duration for video segments
const formattedDuration = computed(() => {
	const duration = props.segment.gif.endTime - props.segment.gif.startTime;
	const s = Math.floor(duration);
	return `${s}s`;
});

// Computed properties
const segmentStyle = computed(() => {
	const startX = props.segment.gif.startTime * props.timeScale;
	const duration = props.segment.gif.endTime - props.segment.gif.startTime;
	const width = duration * props.timeScale;

	// Video segment'leri için clip segment stilini kullan
	const isVideo = props.segment.gif.type === "video";

	if (isVideo) {
		return {
			left: `${startX}px`,
			width: `${Math.max(width, 50)}px`,
			position: "absolute",
			transition: props.isDragging ? "none" : "all 0.2s ease",
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
			cursor: props.isDragging ? "grabbing" : "grab",
			transform: "translate3d(0,0,0)", // Hardware acceleration
			willChange: props.isDragging ? "transform" : "auto",
		};
	}

	// GIF ve image segment'leri için mevcut stil
	return {
		left: `${startX}px`,
		width: `${Math.max(width, 50)}px`,
		backgroundColor: "rgba(59, 130, 246, 0.1)", // Blue background for GIF segments
		borderRadius: props.hasVideo
			? props.isTimelineHovered
				? "10px"
				: "6px"
			: "10px",
		height: props.hasVideo
			? props.isTimelineHovered
				? "100%"
				: "46%"
			: "100%",
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
