<template>
	<div class="fixed inset-0 bg-black/50 backdrop-blur-sm">
		<div
			class="absolute inset-0 cursor-crosshair"
			@mousedown="startSelection"
			@mousemove="updateSelection"
			@mouseup="endSelection"
		>
			<div
				v-if="selection"
				class="absolute border-2 border-blue-500 bg-blue-500/20"
				:style="{
					left: `${selection.x}px`,
					top: `${selection.y}px`,
					width: `${selection.width}px`,
					height: `${selection.height}px`,
				}"
			>
				<div
					class="absolute -top-6 left-0 bg-blue-500 text-white px-2 py-1 text-sm rounded-t-md"
				>
					{{ selection.width }} x {{ selection.height }}
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const isSelecting = ref(false);
const startPos = ref({ x: 0, y: 0 });
const selection = ref<{
	x: number;
	y: number;
	width: number;
	height: number;
} | null>(null);

const startSelection = (e: MouseEvent) => {
	isSelecting.value = true;
	startPos.value = { x: e.clientX, y: e.clientY };
	selection.value = {
		x: e.clientX,
		y: e.clientY,
		width: 0,
		height: 0,
	};
};

const updateSelection = (e: MouseEvent) => {
	if (!isSelecting.value) return;

	const x = Math.min(startPos.value.x, e.clientX);
	const y = Math.min(startPos.value.y, e.clientY);
	const width = Math.abs(e.clientX - startPos.value.x);
	const height = Math.abs(e.clientY - startPos.value.y);

	selection.value = { x, y, width, height };
};

const endSelection = () => {
	if (!isSelecting.value || !selection.value) return;
	isSelecting.value = false;

	if (selection.value.width > 0 && selection.value.height > 0) {
		// @ts-ignore
		window.electron?.completeAreaSelection({
			...selection.value,
			// Ekran koordinatlarına çevir
			x: Math.round(selection.value.x),
			y: Math.round(selection.value.y),
			width: Math.round(selection.value.width),
			height: Math.round(selection.value.height),
		});
	}
};
</script>

<style scoped>
.backdrop-blur-sm {
	backdrop-filter: blur(4px);
}
</style>
