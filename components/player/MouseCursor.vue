<template>
	<div class="mouse-cursor" :style="cursorStyle">
		<div class="cursor-inner"></div>
	</div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
	size: {
		type: Number,
		default: 20,
	},
	mouseHoldLevel: {
		type: Number,
		default: 0,
	},
	motionBlurValue: {
		type: Number,
		default: 0,
	},
	motionBlurConstants: {
		type: Object,
		default: () => ({}),
	},
	mouseX: {
		type: Number,
		default: 0,
	},
	mouseY: {
		type: Number,
		default: 0,
	},
	isRightClick: {
		type: Boolean,
		default: false,
	},
	isScrolling: {
		type: Boolean,
		default: false,
	},
});

// Calculate cursor style based on properties
const cursorStyle = computed(() => {
	return {
		width: `${props.size}px`,
		height: `${props.size}px`,
		backgroundColor: props.isRightClick
			? "rgba(255, 100, 100, 0.5)"
			: "rgba(255, 255, 255, 0.5)",
		borderColor: props.isRightClick ? "#ff6464" : "#ffffff",
		transform: props.isScrolling
			? "scale(0.9)"
			: `scale(${1 + props.mouseHoldLevel * 0.1})`,
	};
});
</script>

<style scoped>
.mouse-cursor {
	position: absolute;
	border-radius: 50%;
	border: 2px solid #ffffff;
	background-color: rgba(255, 255, 255, 0.5);
	transform-origin: center;
	transition: transform 0.1s ease;
	pointer-events: none;
}

.cursor-inner {
	position: absolute;
	top: 50%;
	left: 50%;
	width: 4px;
	height: 4px;
	background-color: #fff;
	border-radius: 50%;
	transform: translate(-50%, -50%);
}
</style>
