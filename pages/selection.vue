<template>
	<div class="fixed inset-0 bg-black/30 backdrop-blur-sm">
		<div
			class="absolute inset-0 cursor-crosshair"
			@mousedown="startSelection"
			@mousemove="updateSelection"
			@mouseup="endSelection"
			@keydown.esc="cancelSelection"
			tabindex="0"
			ref="container"
		>
			<div
				v-if="selection"
				class="absolute border-2 border-blue-500 bg-transparent"
				:style="{
					left: `${selection.x}px`,
					top: `${selection.y}px`,
					width: `${selection.width}px`,
					height: `${selection.height}px`,
					cursor: isMoving ? 'grabbing' : 'grab',
				}"
				@mousedown.stop="startMove"
				@mousemove.stop="moveSelection"
				@mouseup.stop="endMove"
			>
				<div
					class="absolute -top-6 left-0 bg-blue-500 text-white px-2 py-1 text-sm rounded-t-md flex items-center space-x-2"
				>
					<span>{{ selection.width }} x {{ selection.height }}</span>
					<button
						@click="confirmSelection"
						class="bg-green-500 hover:bg-green-600 px-2 py-0.5 rounded text-xs"
					>
						Onayla
					</button>
				</div>
			</div>

			<!-- Talimatlar -->
			<div
				v-if="!isSelecting && !selection"
				class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-center"
			>
				<p class="text-lg mb-2">Kaydetmek istediğiniz alanı seçin</p>
				<p class="text-sm opacity-75">ESC tuşu ile iptal edebilirsiniz</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

declare global {
	interface Window {
		electron: {
			ipcRenderer: {
				send: (channel: string, ...args: any[]) => void;
			};
		};
	}
}

const { ipcRenderer } = window.electron;
const container = ref<HTMLElement | null>(null);
const isSelecting = ref(false);
const isMoving = ref(false);
const selection = ref<{
	x: number;
	y: number;
	width: number;
	height: number;
} | null>(null);
const startPos = ref({ x: 0, y: 0 });
const moveOffset = ref({ x: 0, y: 0 });

onMounted(() => {
	if (container.value) {
		container.value.focus();
	}
});

const startSelection = (e: MouseEvent) => {
	if (selection.value) return; // Eğer zaten bir seçim varsa yeni seçime izin verme
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
	if (!isSelecting.value || !selection.value) return;

	const currentX = e.clientX;
	const currentY = e.clientY;

	// Seçim alanını hesapla
	const x = Math.min(startPos.value.x, currentX);
	const y = Math.min(startPos.value.y, currentY);
	const width = Math.abs(currentX - startPos.value.x);
	const height = Math.abs(currentY - startPos.value.y);

	selection.value = { x, y, width, height };
};

const endSelection = () => {
	if (!isSelecting.value || !selection.value) return;
	isSelecting.value = false;
};

const startMove = (e: MouseEvent) => {
	if (!selection.value) return;
	isMoving.value = true;
	moveOffset.value = {
		x: e.clientX - selection.value.x,
		y: e.clientY - selection.value.y,
	};
};

const moveSelection = (e: MouseEvent) => {
	if (!isMoving.value || !selection.value) return;

	const newX = e.clientX - moveOffset.value.x;
	const newY = e.clientY - moveOffset.value.y;

	// Sınırlar içinde tutma
	const maxX = window.innerWidth - selection.value.width;
	const maxY = window.innerHeight - selection.value.height;

	selection.value.x = Math.max(0, Math.min(maxX, newX));
	selection.value.y = Math.max(0, Math.min(maxY, newY));
};

const endMove = () => {
	isMoving.value = false;
};

const confirmSelection = () => {
	if (!selection.value) return;
	// Seçilen alanı ana pencereye gönder
	ipcRenderer.send("AREA_SELECTED", selection.value);
};

const cancelSelection = () => {
	ipcRenderer.send("CANCEL_AREA_SELECTION");
};
</script>

<style>
html,
body {
	overflow: hidden;
	user-select: none;
}
</style>
