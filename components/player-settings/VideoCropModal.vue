<template>
	<div
		v-if="isOpen"
		class="fixed inset-0 z-50 flex items-center justify-center"
	>
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-black/80" @click="$emit('close')"></div>

		<!-- Modal Content -->
		<div
			class="relative flex flex-col gap-4 bg-zinc-900/95 backdrop-blur-sm rounded-lg border border-white/10 z-[60] shadow-xl p-6 w-[90vw] max-w-4xl"
		>
			<div class="flex justify-between items-center">
				<h3 class="text-lg font-medium">Video Kırpma</h3>
				<button @click="$emit('close')" class="text-gray-400 hover:text-white">
					<svg
						class="w-6 h-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
			<!-- Controls -->
			<div class="flex space-x-4">
				<button
					v-for="ratio in aspectRatios"
					:key="ratio.value"
					@click="setAspectRatio(ratio.value)"
					class="px-3 min-w-24 py-1.5 rounded-lg"
					:class="currentRatio === ratio.value ? 'bg-blue-600' : 'bg-zinc-800'"
				>
					{{ ratio.label }}
				</button>
			</div>
			<!-- Video Preview Area -->
			<div
				class="relative max-w-[600px] mx-auto bg-black my-12 rounded-lg overflow-hidden"
			>
				<video
					ref="videoRef"
					:src="videoSrc"
					class="w-full h-full object-contain rounded-lg"
					@loadedmetadata="onVideoLoad"
				></video>
				<div
					ref="cropArea"
					class="absolute border-2 border-purple-500 bg-blue-500/20 cursor-move"
					:style="{
						left: cropPosition.x + 'px',
						top: cropPosition.y + 'px',
						width: cropSize.width + 'px',
						height: cropSize.height + 'px',
					}"
					@mousedown="startDrag"
				>
					<!-- Resize Handles -->
					<div
						class="absolute -right-1 -bottom-1 w-3 h-3 bg-blue-500 cursor-se-resize"
						@mousedown.stop="startResize"
					></div>
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="flex justify-end space-x-3">
				<button
					@click="$emit('close')"
					class="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700"
				>
					İptal
				</button>
				<button
					@click="applyCrop"
					class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
				>
					Uygula
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const props = defineProps({
	isOpen: Boolean,
	videoSrc: String,
});

const emit = defineEmits(["close", "crop-applied"]);

const videoRef = ref(null);
const cropArea = ref(null);
const cropPosition = ref({ x: 0, y: 0 });
const cropSize = ref({ width: 0, height: 0 });
const currentRatio = ref("16:9");
const isDragging = ref(false);
const isResizing = ref(false);
let startPos = { x: 0, y: 0 };
let startSize = { width: 0, height: 0 };

const aspectRatios = [
	{ label: "Serbest", value: "free" },
	{ label: "16:9", value: "16:9" },
	{ label: "4:3", value: "4:3" },
	{ label: "1:1", value: "1:1" },
	{ label: "9:16", value: "9:16" },
];

const onVideoLoad = () => {
	const video = videoRef.value;
	if (!video) return;

	// Initialize crop area to 16:9
	const videoWidth = video.offsetWidth;
	const videoHeight = video.offsetHeight;

	cropSize.value = {
		width: videoWidth * 0.8,
		height: videoWidth * 0.8 * (9 / 16),
	};

	cropPosition.value = {
		x: (videoWidth - cropSize.value.width) / 2,
		y: (videoHeight - cropSize.value.height) / 2,
	};
};

const startDrag = (e) => {
	isDragging.value = true;
	startPos = {
		x: e.clientX - cropPosition.value.x,
		y: e.clientY - cropPosition.value.y,
	};
	document.addEventListener("mousemove", onDrag);
	document.addEventListener("mouseup", stopDrag);
};

const onDrag = (e) => {
	if (!isDragging.value) return;

	const video = videoRef.value;
	const newX = e.clientX - startPos.x;
	const newY = e.clientY - startPos.y;

	cropPosition.value = {
		x: Math.max(0, Math.min(newX, video.offsetWidth - cropSize.value.width)),
		y: Math.max(0, Math.min(newY, video.offsetHeight - cropSize.value.height)),
	};
};

const startResize = (e) => {
	isResizing.value = true;
	startPos = { x: e.clientX, y: e.clientY };
	startSize = { ...cropSize.value };
	document.addEventListener("mousemove", onResize);
	document.addEventListener("mouseup", stopResize);
};

const onResize = (e) => {
	if (!isResizing.value) return;

	const dx = e.clientX - startPos.x;
	const dy = e.clientY - startPos.y;

	if (currentRatio.value === "free") {
		cropSize.value = {
			width: Math.max(100, startSize.width + dx),
			height: Math.max(100, startSize.height + dy),
		};
	} else {
		const ratio = getRatioValue(currentRatio.value);
		const width = Math.max(100, startSize.width + dx);
		cropSize.value = {
			width,
			height: width / ratio,
		};
	}
};

const stopDrag = () => {
	isDragging.value = false;
	document.removeEventListener("mousemove", onDrag);
	document.removeEventListener("mouseup", stopDrag);
};

const stopResize = () => {
	isResizing.value = false;
	document.removeEventListener("mousemove", onResize);
	document.removeEventListener("mouseup", stopResize);
};

const getRatioValue = (ratio) => {
	switch (ratio) {
		case "16:9":
			return 16 / 9;
		case "4:3":
			return 4 / 3;
		case "1:1":
			return 1;
		case "9:16":
			return 9 / 16;
		default:
			return null;
	}
};

const setAspectRatio = (ratio) => {
	currentRatio.value = ratio;
	if (ratio === "free") return;

	const ratioValue = getRatioValue(ratio);
	const video = videoRef.value;
	if (!video || !ratioValue) return;

	const maxWidth = video.offsetWidth * 0.8;
	const maxHeight = video.offsetHeight * 0.8;

	let width = maxWidth;
	let height = width / ratioValue;

	if (height > maxHeight) {
		height = maxHeight;
		width = height * ratioValue;
	}

	cropSize.value = { width, height };
	cropPosition.value = {
		x: (video.offsetWidth - width) / 2,
		y: (video.offsetHeight - height) / 2,
	};
};

const applyCrop = () => {
	const video = videoRef.value;
	if (!video) return;

	const videoRect = video.getBoundingClientRect();
	const cropRect = cropArea.value.getBoundingClientRect();

	const crop = {
		x: cropPosition.value.x / videoRect.width,
		y: cropPosition.value.y / videoRect.height,
		width: cropSize.value.width / videoRect.width,
		height: cropSize.value.height / videoRect.height,
	};

	emit("crop-applied", crop);
	emit("close");
};

onUnmounted(() => {
	document.removeEventListener("mousemove", onDrag);
	document.removeEventListener("mouseup", stopDrag);
	document.removeEventListener("mousemove", onResize);
	document.removeEventListener("mouseup", stopResize);
});
</script>

<style scoped>
.aspect-video {
	aspect-ratio: 16/9;
}
</style>
