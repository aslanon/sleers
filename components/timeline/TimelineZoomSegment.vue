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
			class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2"
		>
			<!-- Top Row: Zoom Icon + Label -->
			<div class="flex items-center justify-center gap-1.5">
				<!-- Zoom Icon -->
				<svg
					class="w-3 h-3 text-white/70"
					viewBox="0 0 24 24"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						clip-rule="evenodd"
						d="M17.3033 5.1967C14.3744 2.26777 9.62563 2.26777 6.6967 5.1967C3.76777 8.12563 3.76777 12.8744 6.6967 15.8033C6.98959 16.0962 6.98959 16.5711 6.6967 16.864C6.40381 17.1569 5.92893 17.1569 5.63604 16.864C2.12132 13.3492 2.12132 7.65076 5.63604 4.13604C9.15076 0.62132 14.8492 0.62132 18.364 4.13604C20.1211 5.89321 21 8.19775 21 10.4998C21 10.9141 20.6642 11.2498 20.25 11.2499C19.8358 11.2499 19.5 10.9141 19.5 10.4999C19.5 8.57933 18.7679 6.66128 17.3033 5.1967ZM15.182 7.31802C13.4246 5.56066 10.5754 5.56066 8.81802 7.31802C7.06066 9.07538 7.06066 11.9246 8.81802 13.682C9.11091 13.9749 9.11091 14.4497 8.81802 14.7426C8.52513 15.0355 8.05025 15.0355 7.75736 14.7426C5.41421 12.3995 5.41421 8.60051 7.75736 6.25736C10.1005 3.91421 13.8995 3.91421 16.2426 6.25736C17.414 7.42877 18 8.96558 18 10.4999C18 10.9141 17.6642 11.2499 17.25 11.2499C16.8358 11.2499 16.5 10.9142 16.5 10.4999C16.5 9.34715 16.0608 8.19683 15.182 7.31802ZM11.5484 8.63179C11.8602 8.54824 12.1905 8.67359 12.3684 8.94299L17.5955 16.8599C17.7627 17.113 17.7609 17.4419 17.591 17.6932C17.421 17.9445 17.1165 18.0687 16.8193 18.0079L14.722 17.5787L15.7668 21.4777C15.874 21.8778 15.6365 22.289 15.2364 22.3963C14.8363 22.5035 14.4251 22.266 14.3179 21.8659L13.2732 17.967L11.6717 19.3872C11.4447 19.5884 11.1189 19.6332 10.8461 19.5005C10.5733 19.3678 10.4073 19.0839 10.4254 18.7811L10.9939 9.3113C11.0132 8.98905 11.2366 8.71534 11.5484 8.63179Z"
						fill="white"
					/>
				</svg>
				<span class="text-white/70 text-[10px] font-medium tracking-wide">
					Zoom
				</span>
			</div>

			<!-- Bottom Row: Scale + Lightning/Auto Icon + Type -->
			<div class="flex items-center justify-center gap-1.5">
				<span class="text-white/90 text-sm font-medium tracking-wide">
					{{ range.scale }}x
				</span>
				<!-- Lightning/Auto Icon -->
				<svg
					class="w-3 h-3 text-white/90"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M3.75 13.5L14.25 2.25L12 10.5H20.25L9.75 21.75L12 13.5H3.75Z"
						stroke="white"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				<span class="text-white/90 text-[10px] font-medium tracking-wide">
					{{ range.isAutoZoom ? "Auto" : "Manual" }}
				</span>
			</div>
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
