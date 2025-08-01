<template>
	<div
		class="h-full ring-inset relative group"
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
			class="absolute left-1 top-0 bottom-0 w-1 flex items-center justify-start opacity-0"
			:class="{
				'opacity-80': isSelected && isTimelineHovered,
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

		<!-- Right Resize Handle -->
		<div
			class="absolute right-1 top-0 bottom-0 w-1 flex items-center justify-end opacity-0"
			:class="{
				'opacity-80': isSelected && isTimelineHovered,
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

		<!-- Layout Content -->
		<div
			class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
		>
			<span
				v-if="isTimelineHovered"
				class="text-white/70 text-[10px] font-medium tracking-wide"
				>{{ label }}</span
			>
			<span
				class="text-white/90 font-medium tracking-wide"
				:class="{
					'mt-0.5 text-sm': isTimelineHovered,
					'text-xs': !isTimelineHovered,
				}"
			>
				<template v-if="isTimelineHovered">{{ formattedDuration }} @ </template
				>{{ range.label || range.type }}
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
	isTimelineHovered: {
		type: Boolean,
		default: false,
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
			selected: "rgb(64, 64, 64)",
			normal: "rgb(38, 38, 38)",
			gradient: {
				selected: "linear-gradient(rgb(64, 64, 64) 0%, rgb(82, 82, 82) 100%)",
				normal: "linear-gradient(rgb(38, 38, 38) 0%, rgb(51, 51, 51) 100%)",
			},
		},
		"screen-full": {
			selected: "rgb(64, 64, 64)",
			normal: "rgb(38, 38, 38)",
			gradient: {
				selected: "linear-gradient(rgb(64, 64, 64) 0%, rgb(82, 82, 82) 100%)",
				normal: "linear-gradient(rgb(38, 38, 38) 0%, rgb(51, 51, 51) 100%)",
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
		borderRadius: props.isTimelineHovered ? "10px" : "10px",
		height: props.isTimelineHovered ? "100%" : "46%",
		cursor: props.isDragging ? "grabbing" : "grab",
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
