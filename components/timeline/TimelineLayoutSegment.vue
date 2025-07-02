<template>
	<div
		class="h-full ring-inset relative transition-all duration-200 group"
		:class="{
			'ring-[1px] ring-white z-50 selected-layout': isSelected,
			'hover:!ring-[1px] hover:!ring-white hover:z-50':
				!isResizing && !isSelected,
			'z-10': !isResizing && !isSelected && !isHovered,
			'cursor-grab': !isDragging,
			'cursor-grabbing': isDragging,
		}"
		:style="layoutStyle"
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

		<!-- Layout Content -->
		<div
			class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
		>
			<span class="text-white/70 text-[10px] font-medium tracking-wide">{{
				label
			}}</span>
			<span class="text-white/90 text-sm font-medium tracking-wide mt-0.5">
				{{ formattedDuration }} @ {{ range.type }}
			</span>
		</div>
	</div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount } from "vue";

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
		default: "Layout",
	},
});

const emit = defineEmits([
	"click",
	"mouseEnter",
	"mouseLeave",
	"dragStart",
	"resizeStart",
	"delete",
]);

// Computed styles for the layout segment
const layoutStyle = computed(() => {
	const layoutColors = {
		"camera-full": {
			selected: "rgb(22, 163, 74)",
			normal: "rgb(21, 128, 61)",
			gradient: {
				selected: "linear-gradient(rgb(22, 163, 74) 0%, rgb(34, 197, 94) 100%)",
				normal: "linear-gradient(rgb(21, 128, 61) 0%, rgb(34, 197, 94) 100%)",
			},
		},
		"screen-full": {
			selected: "rgb(147, 51, 234)",
			normal: "rgb(126, 34, 206)",
			gradient: {
				selected:
					"linear-gradient(rgb(147, 51, 234) 0%, rgb(168, 85, 247) 100%)",
				normal: "linear-gradient(rgb(126, 34, 206) 0%, rgb(168, 85, 247) 100%)",
			},
		},
	};

	const colorSet =
		layoutColors[props.range.type] || layoutColors["camera-full"];

	return {
		position: "absolute",
		left: `${(props.range.start / props.duration) * 100}%`,
		width: `${((props.range.end - props.range.start) / props.duration) * 100}%`,
		backgroundColor: props.isSelected ? colorSet.selected : colorSet.normal,
		background: props.isSelected
			? colorSet.gradient.selected
			: colorSet.gradient.normal,
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

// Add keyboard event handler
const handleKeyDown = (event) => {
	if (
		props.isSelected &&
		(event.key === "Delete" || event.key === "Backspace")
	) {
		emit("delete", props.index);
	}
};

// Add lifecycle hooks
onMounted(() => {
	window.addEventListener("keydown", handleKeyDown);
});

onBeforeUnmount(() => {
	window.removeEventListener("keydown", handleKeyDown);
});
</script>

<style scoped>
/* Layout segment bounce animation */
@keyframes bounce {
	0%,
	100% {
		transform: translateY(0);
	}
	50% {
		transform: translateY(-2px);
	}
}

.group.selected-layout:not(:hover) {
	animation: bounce 1s ease-in-out infinite;
}
</style>
