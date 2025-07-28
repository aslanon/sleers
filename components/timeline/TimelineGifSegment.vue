<template>
	<div
		ref="segmentRef"
		class="h-full ring-inset relative group"
		:class="{
			'ring-[1px] ring-blue-400 z-30': isActive,
			'hover:!ring-[1px] hover:!ring-blue-300 hover:z-30':
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
		<!-- GIF Preview Image -->
		<div class="absolute inset-0 overflow-hidden rounded-sm">
			<img
				:src="segment.gif.url"
				:alt="segment.gif.title"
				class="w-full h-full object-cover opacity-70"
				loading="lazy"
			/>
			<div class="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
		</div>

		<!-- GIF Icon Overlay -->
		<div class="absolute top-1 left-1 z-20">
			<svg 
				class="w-4 h-4 text-white drop-shadow-lg"
				fill="none" 
				stroke="currentColor" 
				viewBox="0 0 24 24"
			>
				<path 
					stroke-linecap="round" 
					stroke-linejoin="round" 
					stroke-width="2" 
					d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6Z M8 12L10 14L16 8 M14 16H18V12"
				/>
			</svg>
		</div>

		<!-- GIF Title -->
		<div class="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/80 to-transparent">
			<p class="text-xs text-white truncate font-medium">{{ segment.gif.title }}</p>
		</div>

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
				class="w-[3px] h-[24px] bg-blue-400 rounded-full cursor-ew-resize"
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
				class="w-[3px] h-[24px] bg-blue-400 rounded-full cursor-ew-resize"
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

		<!-- Delete Button -->
		<div
			v-if="isActive"
			class="absolute -top-2 -right-2 z-50"
		>
			<button
				@click.stop="handleDelete"
				class="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-lg"
			>
				<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
				</svg>
			</button>
		</div>
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
		backgroundColor: 'rgba(59, 130, 246, 0.1)', // Blue background for GIF segments
		borderRadius: '4px',
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
			}
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
		const newStartTime = Math.max(minStartTime, Math.min(maxStartTime, mouseTime));

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

const handleDelete = () => {
	removeGif(props.segment.gif.id);
	emit("delete", props.segment);
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
</style>