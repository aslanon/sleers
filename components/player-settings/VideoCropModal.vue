<template>
	<BaseModal
		v-model="isModalOpen"
		title="Video Crop"
		subtitle="Adjust the crop area to frame your content perfectly"
		size="2xl"
		@close="handleClose"
	>
		<div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
			<div class="lg:col-span-3">
				<!-- Video Preview Area -->
				<div
					class="relative bg-black rounded-xl overflow-hidden border border-white/10"
				>
					<div class="aspect-video relative">
						<video
							ref="videoRef"
							:src="videoSrc"
							class="w-full h-full object-contain"
							@loadedmetadata="onVideoLoad"
							@error="onVideoError"
						/>
					</div>

					<!-- Crop Overlay -->
					<div
						v-if="cropPosition && cropSize"
						ref="cropArea"
						class="absolute border-2 border-blue-500 bg-blue-500/10 cursor-move transition-all duration-150"
						:style="{
							left: cropPosition.x + 'px',
							top: cropPosition.y + 'px',
							width: cropSize.width + 'px',
							height: cropSize.height + 'px',
						}"
						@mousedown="startDrag"
					>
						<!-- Corner Resize Handles -->
						<div
							v-for="(handle, index) in resizeHandles"
							:key="index"
							:class="handle.class"
							class="absolute w-3 h-3 bg-blue-500 border border-white/20 rounded-sm cursor-pointer hover:bg-blue-400 transition-colors"
							@mousedown.stop="startResize($event, handle.direction)"
						></div>

						<!-- Center indicator -->
						<div
							class="absolute inset-0 flex items-center justify-center pointer-events-none"
						>
							<div class="w-1 h-1 bg-blue-500/60 rounded-full"></div>
						</div>

						<!-- Crop info -->
						<div
							class="absolute -top-8 left-0 bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none"
						>
							{{ Math.round(cropSize.width) }}×{{ Math.round(cropSize.height) }}
						</div>
					</div>

					<!-- Grid lines (rule of thirds) -->
					<div
						v-if="showGrid && cropPosition && cropSize"
						class="absolute pointer-events-none"
						:style="{
							left: cropPosition.x + 'px',
							top: cropPosition.y + 'px',
							width: cropSize.width + 'px',
							height: cropSize.height + 'px',
						}"
					>
						<!-- Vertical lines -->
						<div
							class="absolute top-0 bottom-0 border-l border-white/20"
							:style="{ left: cropSize.width / 3 + 'px' }"
						></div>
						<div
							class="absolute top-0 bottom-0 border-l border-white/20"
							:style="{ left: (cropSize.width * 2) / 3 + 'px' }"
						></div>
						<!-- Horizontal lines -->
						<div
							class="absolute left-0 right-0 border-t border-white/20"
							:style="{ top: cropSize.height / 3 + 'px' }"
						></div>
						<div
							class="absolute left-0 right-0 border-t border-white/20"
							:style="{ top: (cropSize.height * 2) / 3 + 'px' }"
						></div>
					</div>
				</div>
			</div>

			<!-- Right Column: Controls & Settings -->
			<div class="space-y-6">
				<!-- Aspect Ratio Controls -->
				<div>
					<h3
						class="text-lg font-medium text-white mb-4 flex items-center gap-2"
					>
						<svg
							class="w-5 h-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7c0-2.21-1.79-4-4-4H8c-2.21 0-4 1.79-4 4z"
							/>
						</svg>
						Aspect Ratio
					</h3>
					<div class="grid grid-cols-2 gap-2">
						<button
							v-for="ratio in aspectRatios"
							:key="ratio.value"
							@click="setAspectRatio(ratio.value)"
							class="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200"
							:class="
								currentRatio === ratio.value
									? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
									: 'bg-zinc-800/60 text-gray-300 hover:bg-zinc-700/80 hover:text-white'
							"
						>
							{{ ratio.label }}
						</button>
					</div>
				</div>

				<!-- Crop Information -->
				<div class="p-4 bg-zinc-800/40 rounded-lg border border-zinc-600/60">
					<div class="flex items-center gap-2 mb-3">
						<svg
							class="w-4 h-4 text-gray-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span class="text-sm font-medium text-gray-300">Crop Details</span>
					</div>
					<div class="space-y-2 text-sm" v-if="cropSize">
						<div class="flex justify-between">
							<span class="text-gray-400">Size:</span>
							<span class="text-white font-mono"
								>{{ Math.round(cropSize.width) }}×{{
									Math.round(cropSize.height)
								}}</span
							>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-400">Ratio:</span>
							<span class="text-white">{{ currentRatio }}</span>
						</div>
						<div class="flex justify-between" v-if="cropPosition">
							<span class="text-gray-400">Position:</span>
							<span class="text-white font-mono"
								>{{ Math.round(cropPosition.x) }},
								{{ Math.round(cropPosition.y) }}</span
							>
						</div>
					</div>
				</div>

				<!-- Options -->
				<div class="space-y-4">
					<h4 class="text-md font-medium text-white">Options</h4>
					<label
						class="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
					>
						<input
							v-model="showGrid"
							type="checkbox"
							class="w-4 h-4 text-blue-600 bg-zinc-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
						/>
						<div>
							<div class="text-sm font-medium text-gray-300">
								Show grid lines
							</div>
							<div class="text-xs text-gray-500">Rule of thirds overlay</div>
						</div>
					</label>

					<button
						@click="resetCrop"
						class="w-full px-4 py-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/80 text-gray-300 hover:text-white transition-all duration-200 flex items-center justify-center gap-2"
					>
						<svg
							class="w-4 h-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						Reset to default
					</button>
				</div>
			</div>
		</div>

		<!-- Error state -->
		<div
			v-if="error"
			class="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg"
		>
			<p class="text-red-400 text-sm">{{ error }}</p>
		</div>

		<template #footer>
			<button
				@click="handleClose"
				class="px-4 py-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/80 text-gray-300 hover:text-white transition-all duration-200"
			>
				Cancel
			</button>
			<button
				@click="applyCrop"
				:disabled="!cropPosition || !cropSize"
				class="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-gray-500 text-white font-medium transition-all duration-200 shadow-lg shadow-blue-600/25"
			>
				Apply Crop
			</button>
		</template>
	</BaseModal>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import BaseModal from "../ui/BaseModal.vue";

const props = defineProps({
	isOpen: {
		type: Boolean,
		default: false,
	},
	videoSrc: {
		type: String,
		required: true,
	},
});

const emit = defineEmits(["close", "crop-applied"]);

// Refs
const videoRef = ref(null);
const cropArea = ref(null);
const isModalOpen = ref(false);

// State
const cropPosition = ref({ x: 0, y: 0 });
const cropSize = ref({ width: 0, height: 0 });
const currentRatio = ref("16:9");
const showGrid = ref(true);
const error = ref("");

// Drag & resize state
const isDragging = ref(false);
const isResizing = ref(false);
const resizeDirection = ref("");
let startPos = { x: 0, y: 0 };
let startSize = { width: 0, height: 0 };
let startCropPos = { x: 0, y: 0 };

// Watch props
watch(
	() => props.isOpen,
	(newVal) => {
		isModalOpen.value = newVal;
		if (newVal) {
			error.value = "";
		}
	},
	{ immediate: true }
);

// Constants
const aspectRatios = [
	{ label: "Free", value: "free" },
	{ label: "16:9", value: "16:9" },
	{ label: "4:3", value: "4:3" },
	{ label: "1:1", value: "1:1" },
	{ label: "9:16", value: "9:16" },
	{ label: "21:9", value: "21:9" },
];

const resizeHandles = [
	{ direction: "nw", class: "-top-1.5 -left-1.5 cursor-nw-resize" },
	{ direction: "ne", class: "-top-1.5 -right-1.5 cursor-ne-resize" },
	{ direction: "sw", class: "-bottom-1.5 -left-1.5 cursor-sw-resize" },
	{ direction: "se", class: "-bottom-1.5 -right-1.5 cursor-se-resize" },
];

// Methods
const onVideoLoad = () => {
	const video = videoRef.value;
	if (!video) return;

	try {
		// Initialize crop area to center with 16:9 ratio
		const containerRect = video.getBoundingClientRect();
		const videoWidth = containerRect.width;
		const videoHeight = containerRect.height;

		const initialWidth = videoWidth * 0.8;
		const initialHeight = initialWidth * (9 / 16);

		cropSize.value = {
			width: Math.min(initialWidth, videoWidth),
			height: Math.min(initialHeight, videoHeight),
		};

		cropPosition.value = {
			x: (videoWidth - cropSize.value.width) / 2,
			y: (videoHeight - cropSize.value.height) / 2,
		};

		error.value = "";
	} catch (err) {
		error.value = "Failed to initialize crop area";
		console.error("Video load error:", err);
	}
};

const onVideoError = (event) => {
	error.value = "Failed to load video";
	console.error("Video error:", event);
};

const getRatioValue = (ratio) => {
	const ratios = {
		"16:9": 16 / 9,
		"4:3": 4 / 3,
		"1:1": 1,
		"9:16": 9 / 16,
		"21:9": 21 / 9,
	};
	return ratios[ratio] || null;
};

const setAspectRatio = (ratio) => {
	currentRatio.value = ratio;
	if (ratio === "free" || !videoRef.value) return;

	const ratioValue = getRatioValue(ratio);
	if (!ratioValue) return;

	const video = videoRef.value;
	const containerRect = video.getBoundingClientRect();
	const maxWidth = containerRect.width * 0.9;
	const maxHeight = containerRect.height * 0.9;

	let width = Math.min(cropSize.value.width, maxWidth);
	let height = width / ratioValue;

	if (height > maxHeight) {
		height = maxHeight;
		width = height * ratioValue;
	}

	cropSize.value = { width, height };

	// Center the crop area
	cropPosition.value = {
		x: (containerRect.width - width) / 2,
		y: (containerRect.height - height) / 2,
	};
};

const resetCrop = () => {
	onVideoLoad();
};

// Drag functionality
const startDrag = (e) => {
	isDragging.value = true;
	startPos = {
		x: e.clientX - cropPosition.value.x,
		y: e.clientY - cropPosition.value.y,
	};
	document.addEventListener("mousemove", onDrag);
	document.addEventListener("mouseup", stopDrag);
	e.preventDefault();
};

const onDrag = (e) => {
	if (!isDragging.value || !videoRef.value) return;

	const video = videoRef.value;
	const containerRect = video.getBoundingClientRect();

	const newX = e.clientX - startPos.x;
	const newY = e.clientY - startPos.y;

	cropPosition.value = {
		x: Math.max(0, Math.min(newX, containerRect.width - cropSize.value.width)),
		y: Math.max(
			0,
			Math.min(newY, containerRect.height - cropSize.value.height)
		),
	};
};

const stopDrag = () => {
	isDragging.value = false;
	document.removeEventListener("mousemove", onDrag);
	document.removeEventListener("mouseup", stopDrag);
};

// Resize functionality
const startResize = (e, direction) => {
	isResizing.value = true;
	resizeDirection.value = direction;
	startPos = { x: e.clientX, y: e.clientY };
	startSize = { ...cropSize.value };
	startCropPos = { ...cropPosition.value };

	document.addEventListener("mousemove", onResize);
	document.addEventListener("mouseup", stopResize);
	e.preventDefault();
};

const onResize = (e) => {
	if (!isResizing.value || !videoRef.value) return;

	const dx = e.clientX - startPos.x;
	const dy = e.clientY - startPos.y;
	const video = videoRef.value;
	const containerRect = video.getBoundingClientRect();

	let newWidth = startSize.width;
	let newHeight = startSize.height;
	let newX = startCropPos.x;
	let newY = startCropPos.y;

	// Calculate new dimensions based on resize direction
	switch (resizeDirection.value) {
		case "se": // Bottom-right
			newWidth = startSize.width + dx;
			newHeight = startSize.height + dy;
			break;
		case "sw": // Bottom-left
			newWidth = startSize.width - dx;
			newHeight = startSize.height + dy;
			newX = startCropPos.x + dx;
			break;
		case "ne": // Top-right
			newWidth = startSize.width + dx;
			newHeight = startSize.height - dy;
			newY = startCropPos.y + dy;
			break;
		case "nw": // Top-left
			newWidth = startSize.width - dx;
			newHeight = startSize.height - dy;
			newX = startCropPos.x + dx;
			newY = startCropPos.y + dy;
			break;
	}

	// Apply aspect ratio constraint
	if (currentRatio.value !== "free") {
		const ratioValue = getRatioValue(currentRatio.value);
		if (ratioValue) {
			newHeight = newWidth / ratioValue;

			// Adjust position for top resize directions
			if (resizeDirection.value.includes("n")) {
				newY = startCropPos.y + startSize.height - newHeight;
			}
		}
	}

	// Apply constraints
	const minSize = 50;
	newWidth = Math.max(minSize, Math.min(newWidth, containerRect.width));
	newHeight = Math.max(minSize, Math.min(newHeight, containerRect.height));

	// Ensure crop area stays within bounds
	newX = Math.max(0, Math.min(newX, containerRect.width - newWidth));
	newY = Math.max(0, Math.min(newY, containerRect.height - newHeight));

	cropSize.value = { width: newWidth, height: newHeight };
	cropPosition.value = { x: newX, y: newY };
};

const stopResize = () => {
	isResizing.value = false;
	resizeDirection.value = "";
	document.removeEventListener("mousemove", onResize);
	document.removeEventListener("mouseup", stopResize);
};

const applyCrop = () => {
	if (!videoRef.value || !cropPosition.value || !cropSize.value) return;

	const video = videoRef.value;
	const containerRect = video.getBoundingClientRect();

	const crop = {
		x: cropPosition.value.x / containerRect.width,
		y: cropPosition.value.y / containerRect.height,
		width: cropSize.value.width / containerRect.width,
		height: cropSize.value.height / containerRect.height,
	};

	emit("crop-applied", crop);
	handleClose();
};

const handleClose = () => {
	isModalOpen.value = false;
	emit("close");
};

// BaseModal'dan gelen update:modelValue event'ini handle et
watch(
	() => isModalOpen.value,
	(newVal) => {
		if (!newVal) {
			emit("close");
		}
	}
);

// Cleanup
onUnmounted(() => {
	document.removeEventListener("mousemove", onDrag);
	document.removeEventListener("mouseup", stopDrag);
	document.removeEventListener("mousemove", onResize);
	document.removeEventListener("mouseup", stopResize);
});
</script>
