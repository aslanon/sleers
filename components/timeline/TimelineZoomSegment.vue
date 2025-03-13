<template>
	<div
		class="h-full ring-inset relative transition-all duration-200 group"
		:class="{
			'ring-[1px] ring-white z-50 selected-zoom': isSelected,
			'hover:!ring-[1px] hover:!ring-white hover:z-50':
				!isResizing && !isSelected,
			'z-10': !isResizing && !isSelected && !isHovered,
			'cursor-grab': !isDragging,
			'cursor-grabbing': isDragging,
		}"
		:style="zoomStyle"
		@mouseenter="handleMouseEnter"
		@mouseleave="handleMouseLeave"
		@click.stop="handleClick"
		@mousedown.stop="handleDragStart"
	>
		<!-- Left Resize Handle -->
		<div
			class="absolute left-1 top-0 bottom-0 w-1 flex items-center justify-start opacity-0 transition-opacity duration-200"
			:class="{
				'opacity-80': isSelected,
				'group-hover:opacity-80': !isResizing && !isDragging,
			}"
			@mousedown.stop="handleResizeStart($event, 'start')"
		>
			<div
				class="w-[3px] h-[24px] bg-white rounded-full cursor-ew-resize"
			></div>
		</div>

		<!-- Right Resize Handle -->
		<div
			class="absolute right-1 top-0 bottom-0 w-1 flex items-center justify-end opacity-0 transition-opacity duration-200"
			:class="{
				'opacity-80': isSelected,
				'group-hover:opacity-80': !isResizing && !isDragging,
			}"
			@mousedown.stop="handleResizeStart($event, 'end')"
		>
			<div
				class="w-[3px] h-[24px] bg-white rounded-full cursor-ew-resize"
			></div>
		</div>

		<!-- Zoom Content -->
		<div
			class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
		>
			<span class="text-white/70 text-[10px] font-medium tracking-wide">{{
				label
			}}</span>
			<span class="text-white/90 text-sm font-medium tracking-wide mt-0.5">
				{{ formattedDuration }} @ {{ range.scale }}x
			</span>
		</div>
	</div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
	range: {
		type: Object,
		required: true,
	},
	index: {
		type: Number,
		required: true,
	},
	isSelected: {
		type: Boolean,
		default: false,
	},
	isResizing: {
		type: Boolean,
		default: false,
	},
	isDragging: {
		type: Boolean,
		default: false,
	},
	isHovered: {
		type: Boolean,
		default: false,
	},
	duration: {
		type: Number,
		required: true,
	},
	label: {
		type: String,
		default: "Zoom",
	},
});

const emit = defineEmits([
	"click",
	"mouseEnter",
	"mouseLeave",
	"dragStart",
	"resizeStart",
]);

// Computed styles for the zoom segment
const zoomStyle = computed(() => {
	return {
		position: "absolute",
		left: `${(props.range.start / props.duration) * 100}%`,
		width: `${((props.range.end - props.range.start) / props.duration) * 100}%`,
		backgroundColor: props.isSelected ? "rgb(87, 62, 244)" : "rgb(67, 42, 244)",
		background: props.isSelected
			? "linear-gradient(rgb(87, 62, 244) 0%, rgb(134 119 233) 100%)"
			: "linear-gradient(rgb(67, 42, 244) 0%, rgb(114 99 213) 100%)",
		borderRadius: "10px",
		height: "100%",
		cursor: props.isDragging ? "grabbing" : "grab",
		transition: props.isDragging ? "none" : "all 0.2s ease",
		transform: "translate3d(0,0,0)", // Hardware acceleration
		willChange: props.isDragging ? "transform" : "auto",
	};
});

// Format duration for display
const formattedDuration = computed(() => {
	const seconds = props.range.end - props.range.start;
	const s = Math.floor(seconds);
	return `${s}s`;
});

// Event handlers
const handleClick = (event) => {
	emit("click", event, props.index);
};

const handleMouseEnter = () => {
	emit("mouseEnter", props.range, props.index);
};

const handleMouseLeave = () => {
	emit("mouseLeave");
};

const handleDragStart = (event) => {
	emit("dragStart", event, props.index);
};

const handleResizeStart = (event, edge) => {
	emit("resizeStart", event, props.index, edge);
};
</script>

<style scoped>
/* Zoom segment bounce animation */
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
