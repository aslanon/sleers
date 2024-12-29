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
					left: `${Math.min(startPos.x, currentPos.x)}px`,
					top: `${Math.min(startPos.y, currentPos.y)}px`,
					width: `${Math.abs(currentPos.x - startPos.x)}px`,
					height: `${Math.abs(currentPos.y - startPos.y)}px`,
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
					{{ Math.abs(currentPos.x - startPos.x) }} x
					{{ Math.abs(currentPos.y - startPos.y) }}
				</div>
				<!-- Onay Butonu -->
				<button
					v-if="isValidSize"
					class="confirm-button"
					@click="confirmSelection"
				>
					Seçimi Onayla
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";

const isSelecting = ref(false);
const startPos = ref({ x: 0, y: 0 });
const currentPos = ref({ x: 0, y: 0 });
const isResizing = ref(false);
const resizeHandle = ref("");
const initialBoxSize = ref({ width: 0, height: 0 });
const hasSelection = ref(false);
const selectedRatio = ref("free");

// Aspect ratio hesaplayıcı
const getAspectRatio = (ratio: string) => {
	switch (ratio) {
		case "1:1":
			return 1;
		case "4:3":
			return 4 / 3;
		case "16:9":
			return 16 / 9;
		case "9:16":
			return 9 / 16;
		case "3:4":
			return 3 / 4;
		default:
			return null;
	}
};

// Seçim alanını aspect ratio'ya göre güncelle
const updateSelectionWithRatio = (e: MouseEvent) => {
	const ratio = getAspectRatio(selectedRatio.value);
	if (!ratio) {
		currentPos.value = { x: e.clientX, y: e.clientY };
		return;
	}

	const width = Math.abs(e.clientX - startPos.value.x);
	const height = width / ratio;

	// Mouse'un yönüne göre pozisyonu ayarla
	if (e.clientX < startPos.value.x) {
		currentPos.value.x = startPos.value.x - width;
	} else {
		currentPos.value.x = startPos.value.x + width;
	}

	if (e.clientY < startPos.value.y) {
		currentPos.value.y = startPos.value.y - height;
	} else {
		currentPos.value.y = startPos.value.y + height;
	}
};

const updateSelection = (e: MouseEvent) => {
	if (!isSelecting.value || hasSelection.value) return;

	if (selectedRatio.value === "free") {
		currentPos.value = { x: e.clientX, y: e.clientY };
	} else {
		updateSelectionWithRatio(e);
	}
};

const confirmSelection = () => {
	const width = Math.abs(currentPos.value.x - startPos.value.x);
	const height = Math.abs(currentPos.value.y - startPos.value.y);

	if (width < 100 || height < 100) {
		return;
	}

	const area = {
		x: Math.min(startPos.value.x, currentPos.value.x),
		y: Math.min(startPos.value.y, currentPos.value.y),
		width,
		height,
		display: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		devicePixelRatio: window.devicePixelRatio || 1,
		aspectRatio: selectedRatio.value,
	};

	window.electron?.ipcRenderer.send("AREA_SELECTED", area);
	window.electron?.ipcRenderer.send("CLOSE_SELECTION_WINDOW");
};

const startResize = (handle: string) => {
	isResizing.value = true;
	resizeHandle.value = handle;

	const box = document.querySelector(".selection-box");
	if (box) {
		const rect = box.getBoundingClientRect();
		initialBoxSize.value = {
			width: rect.width,
			height: rect.height,
		};
	}

	window.addEventListener("mousemove", onGlobalMouseMove);
	window.addEventListener("mouseup", onGlobalMouseUp);
};

const onGlobalMouseMove = (e: MouseEvent) => {
	if (isResizing.value) {
		const deltaX = e.clientX - startPos.value.x;
		const deltaY = e.clientY - startPos.value.y;

		switch (resizeHandle.value) {
			case "nw":
				currentPos.value = { x: e.clientX, y: e.clientY };
				break;
			case "ne":
				currentPos.value = {
					x: startPos.value.x + initialBoxSize.value.width + deltaX,
					y: e.clientY,
				};
				break;
			case "sw":
				currentPos.value = {
					x: e.clientX,
					y: startPos.value.y + initialBoxSize.value.height + deltaY,
				};
				break;
			case "se":
				currentPos.value = {
					x: startPos.value.x + initialBoxSize.value.width + deltaX,
					y: startPos.value.y + initialBoxSize.value.height + deltaY,
				};
				break;
		}
	} else if (isSelecting.value && !hasSelection.value) {
		updateSelection(e);
	}
};

const onGlobalMouseUp = () => {
	if (isResizing.value) {
		isResizing.value = false;
		resizeHandle.value = "";
	} else if (isSelecting.value && !hasSelection.value) {
		const width = Math.abs(currentPos.value.x - startPos.value.x);
		const height = Math.abs(currentPos.value.y - startPos.value.y);

		if (width >= 100 && height >= 100) {
			hasSelection.value = true;
		} else {
			isSelecting.value = false;
		}
	}

	window.removeEventListener("mousemove", onGlobalMouseMove);
	window.removeEventListener("mouseup", onGlobalMouseUp);
};

// Minimum boyut kontrolü
const isValidSize = computed(() => {
	const width = Math.abs(currentPos.value.x - startPos.value.x);
	const height = Math.abs(currentPos.value.y - startPos.value.y);
	return width >= 100 && height >= 100;
});

const startSelection = (e: MouseEvent) => {
	if (isResizing.value) return;

	hasSelection.value = false;
	isSelecting.value = true;
	startPos.value = { x: e.clientX, y: e.clientY };
	currentPos.value = { x: e.clientX, y: e.clientY };

	window.addEventListener("mousemove", onGlobalMouseMove);
	window.addEventListener("mouseup", onGlobalMouseUp);
};

onMounted(() => {
	window.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			window.electron?.ipcRenderer.send("CANCEL_AREA_SELECTION");
		}
	});
});

onUnmounted(() => {
	window.removeEventListener("mousemove", onGlobalMouseMove);
	window.removeEventListener("mouseup", onGlobalMouseUp);
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
