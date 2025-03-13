<template>
	<div
		class="h-full ring-inset relative transition-all duration-200 group"
		:class="{
			'ring-[1px] ring-white z-50': isActive,
			'hover:!ring-[1px] hover:!ring-white hover:z-50':
				!isResizing && !isActive,
			'z-10': !isResizing && !isActive && !isHovered,
		}"
		:style="segmentStyle"
		@click.stop="handleClick"
		@mousemove="handleMouseMove"
		@mouseleave="handleMouseLeave"
		@mousedown.stop="isSplitMode ? handleSplit($event) : null"
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
			class="absolute left-1 top-0 bottom-0 w-1 flex items-center justify-start opacity-0 transition-opacity duration-200"
			:class="{
				'opacity-80': isActive,
				'group-hover:opacity-80': !isResizing,
			}"
		>
			<div
				class="w-[3px] h-[24px] bg-white rounded-full cursor-w-resize"
				@mousedown.stop="handleResizeStart($event, 'start')"
			></div>
		</div>

		<!-- Right Edge Handle -->
		<div
			class="absolute right-1 top-0 bottom-0 w-1 flex items-center justify-end opacity-0 transition-opacity duration-200"
			:class="{
				'opacity-80': isActive,
				'group-hover:opacity-80': !isResizing,
			}"
		>
			<div
				class="w-[3px] h-[24px] bg-white rounded-full cursor-e-resize"
				@mousedown.stop="handleResizeStart($event, 'end')"
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
	duration: {
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
	"split",
]);

// Mouse position for split mode
const mousePosition = ref({ x: 0 });

// Computed styles for the segment
const segmentStyle = computed(() => {
	const start = props.segment.start || props.segment.startTime || 0;
	const end = props.segment.end || props.segment.endTime || props.duration;
	const width = ((end - start) / props.duration) * 100;
	const left = (start / props.duration) * 100;

	return {
		width: `${width}%`,
		left: `${left}%`,
		position: "absolute",
		transition: "all 0.2s ease",
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
	const seconds = props.segment.end - props.segment.start;
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
	emit("resizeStart", event, props.index, edge);
};

const handleSplit = (event) => {
	if (!props.isSplitMode) return;

	const segment = event.currentTarget;
	const rect = segment.getBoundingClientRect();
	const x = event.clientX - rect.left;
	const ratio = x / rect.width;

	emit("split", event, props.index, ratio);
};
</script>
