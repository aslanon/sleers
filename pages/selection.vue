<template>
	<div class="selection-container">
		<!-- Aspect Ratio Seçici -->
		<div class="aspect-ratio-selector">
			<select v-model="selectedRatio" class="ratio-select">
				<option value="free">Serbest</option>
				<option value="1:1">1:1 Kare</option>
				<option value="4:3">4:3 Yatay</option>
				<option value="16:9">16:9 Yatay</option>
				<option value="9:16">9:16 Dikey</option>
				<option value="3:4">3:4 Dikey</option>
			</select>
		</div>

		<div
			class="selection-area"
			@mousedown.prevent="startSelection"
			@mousemove="updateSelection"
		>
			<div
				v-if="isSelecting"
				class="selection-box"
				:style="{
					left: `${Math.min(startPoint.x, endPoint.x)}px`,
					top: `${Math.min(startPoint.y, endPoint.y)}px`,
					width: `${Math.abs(endPoint.x - startPoint.x)}px`,
					height: `${Math.abs(endPoint.y - startPoint.y)}px`,
				}"
			>
				<div class="selection-box-overlay"></div>
				<div class="selection-box-handles">
					<div
						class="handle handle-nw"
						@mousedown.stop="startResize('nw')"
					></div>
					<div
						class="handle handle-ne"
						@mousedown.stop="startResize('ne')"
					></div>
					<div
						class="handle handle-sw"
						@mousedown.stop="startResize('sw')"
					></div>
					<div
						class="handle handle-se"
						@mousedown.stop="startResize('se')"
					></div>
				</div>
				<!-- Çözünürlük Bilgisi -->
				<div class="resolution-info">
					{{ Math.abs(endPoint.x - startPoint.x) }} x
					{{ Math.abs(endPoint.y - startPoint.y) }}
				</div>
				<!-- Onay Butonu -->
				<button
					v-if="isValidSize"
					class="confirm-button z-50"
					@mousedown.stop
					@click.stop="confirmSelection"
				>
					Seçimi Onayla
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useCursor } from "~/composables/useCursor";

const electron = window.electron;
const isSelecting = ref(false);
const startPoint = ref({ x: 0, y: 0 });
const endPoint = ref({ x: 0, y: 0 });
const selectedArea = ref({ x: 0, y: 0, width: 0, height: 0 });
const isResizing = ref(false);
const resizeHandle = ref("");

const onMouseDown = (e) => {
	if (e.button === 0) {
		isSelecting.value = true;
		startPoint.value = { x: e.clientX, y: e.clientY };
		endPoint.value = { x: e.clientX, y: e.clientY };
	}
};

const onMouseMove = (e) => {
	if (isSelecting.value) {
		endPoint.value = { x: e.clientX, y: e.clientY };
	}
};

const onMouseUp = () => {
	if (isSelecting.value) {
		isSelecting.value = false;
		const width = Math.abs(endPoint.value.x - startPoint.value.x);
		const height = Math.abs(endPoint.value.y - startPoint.value.y);

		selectedArea.value = {
			x: Math.min(startPoint.value.x, endPoint.value.x),
			y: Math.min(startPoint.value.y, endPoint.value.y),
			width,
			height,
		};
	}
};

onMounted(() => {
	window.addEventListener("mousedown", onMouseDown);
	window.addEventListener("mousemove", onMouseMove);
	window.addEventListener("mouseup", onMouseUp);
});

onUnmounted(() => {
	window.removeEventListener("mousedown", onMouseDown);
	window.removeEventListener("mousemove", onMouseMove);
	window.removeEventListener("mouseup", onMouseUp);
});
</script>

<style scoped>
.selection-container {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.5);
	cursor: crosshair;
}

.aspect-ratio-selector {
	position: fixed;
	top: 20px;
	left: 50%;
	transform: translateX(-50%);
	z-index: 1000;
}

.ratio-select {
	background: #2563eb;
	color: white;
	padding: 8px 16px;
	border: none;
	border-radius: 6px;
	font-size: 14px;
	cursor: pointer;
}

.ratio-select:hover {
	background: #1d4ed8;
}

.selection-area {
	position: absolute;
	inset: 0;
}

.selection-box {
	position: absolute;
	border: 2px solid #2563eb;
	background: rgba(37, 99, 235, 0.1);
	pointer-events: all;
}

.selection-box-overlay {
	position: absolute;
	inset: 0;
	border: 1px solid rgba(255, 255, 255, 0.3);
}

.selection-box-handles {
	position: absolute;
	inset: 0;
	pointer-events: all;
}

.handle {
	position: absolute;
	width: 10px;
	height: 10px;
	background: #2563eb;
	border: 1px solid white;
}

.handle-nw {
	top: -5px;
	left: -5px;
	cursor: nw-resize;
}
.handle-ne {
	top: -5px;
	right: -5px;
	cursor: ne-resize;
}
.handle-sw {
	bottom: -5px;
	left: -5px;
	cursor: sw-resize;
}
.handle-se {
	bottom: -5px;
	right: -5px;
	cursor: se-resize;
}

.resolution-info {
	position: absolute;
	top: -30px;
	left: 50%;
	transform: translateX(-50%);
	background: #2563eb;
	color: white;
	padding: 4px 8px;
	border-radius: 4px;
	font-size: 14px;
	white-space: nowrap;
}

.confirm-button {
	position: absolute;
	bottom: -40px;
	left: 50%;
	transform: translateX(-50%);
	background: #2563eb;
	color: white;
	padding: 8px 16px;
	border-radius: 6px;
	font-size: 14px;
	cursor: pointer;
	pointer-events: all;
	border: none;
	transition: background-color 0.2s;
	z-index: 100;
}

.confirm-button:hover {
	background: #1d4ed8;
}
</style>
