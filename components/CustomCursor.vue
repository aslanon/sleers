<template>
	<div
		v-show="cursorState.isVisible"
		class="custom-cursor"
		:style="{
			transform: `translate(${cursorState.currentPosition.x}px, ${cursorState.currentPosition.y}px) scale(${settings.size})`,
			opacity: cursorState.isMoving ? 1 : 0.5,
			transition: settings.smoothing ? 'opacity 0.3s' : 'none',
			cursor: 'none',
		}"
	>
		<div
			class="cursor-inner"
			:class="{
				'high-quality': settings.highQuality,
				moving: cursorState.isMoving,
			}"
		>
			<!-- Yüksek kaliteli imleç SVG'si -->
			<svg
				v-if="settings.highQuality"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M7 2L17 12L7 22"
					stroke="white"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			<!-- Varsayılan imleç -->
			<div v-else class="default-cursor"></div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useCursor } from "~/composables/useCursor";

const { settings, cursorState } = useCursor();
</script>

<style scoped>
.custom-cursor {
	position: fixed;
	top: 0;
	left: 0;
	pointer-events: none;
	z-index: 9999;
	will-change: transform;
}

.cursor-inner {
	width: 24px;
	height: 24px;
	display: flex;
	align-items: center;
	justify-content: center;
	transform-origin: center;
}

.default-cursor {
	width: 12px;
	height: 12px;
	background: white;
	border-radius: 50%;
	box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

.high-quality {
	filter: drop-shadow(0 0 5px rgba(0, 0, 0, 0.5));
}

.moving {
	animation: pulse 1s infinite;
}

@keyframes pulse {
	0% {
		transform: scale(1);
	}
	50% {
		transform: scale(1.1);
	}
	100% {
		transform: scale(1);
	}
}

:global(body.recording) {
	cursor: none !important;
}

:global(body.recording *) {
	cursor: none !important;
}
</style>
