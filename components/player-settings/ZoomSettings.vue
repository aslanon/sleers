<template>
	<div class="flex flex-col gap-4 min-h-[800px]">
		<div v-if="isZoomSettingsActive" class="flex flex-col gap-12">
			<div class="space-y-2">
				<h3 class="text-lg font-medium">Zoom Settings</h3>
				<p class="text-sm text-gray-400">
					You can configure zoom image settings from here.
				</p>
			</div>

			<!-- Zoom Level Slider -->
			<SliderInput
				v-model="zoomScale"
				desc="Adjusts zoom image magnification level."
				label="Zoom Level"
				:min="1"
				:max="10"
				:step="0.1"
				unit="x"
			/>

			<!-- Zoom Position Selector -->
			<div class="setting-group pb-4">
				<label class="setting-label">Zoom Position</label>
				<p class="setting-desc">Adjusts zoom image position.</p>
				<div
					class="relative w-full max-w-[160px] aspect-video overflow-hidden border border-gray-700 rounded-lg"
					@mousedown="startDragging"
					@mousemove="handleDrag"
					@mouseup="stopDragging"
					@mouseleave="stopDragging"
					ref="dragArea"
				>
					<!-- Video frame background container -->
					<div class="absolute inset-0 flex items-center justify-center">
						<div
							class="relative w-full h-full"
							:style="{
								aspectRatio: videoAspectRatio,
								width: previewDimensions.width + 'px',
								height: previewDimensions.height + 'px',
							}"
						>
							<!-- Video frame background -->
							<div
								class="absolute inset-0 bg-cover bg-center bg-no-repeat"
								:style="{ backgroundImage: `url(${frameDataUrl})` }"
							></div>
							<!-- İç kısım için ayrı bir container -->
							<div class="absolute inset-0 m-3">
								<div
									class="absolute z-20 w-8 h-8 -m-4 bg-zinc-700/80 ring-2 ring-zinc-500 rounded-full cursor-grab hover:ring-zinc-400 transition-all active:scale-95"
									:style="{ left: `${position.x}%`, top: `${position.y}%` }"
									:class="{
										'cursor-grabbing ring-zinc-400 scale-95': isDragging,
									}"
								></div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div v-else class="flex items-center justify-center h-32 text-gray-400">
			Select a zoom segment to adjust its settings
		</div>
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import SliderInput from "~/components/ui/SliderInput.vue";

const props = defineProps({
	mediaPlayer: {
		type: Object,
		required: true,
	},
});

// First, import the usePlayerSettings at the top of script setup
const { currentZoomRange, updateZoomRange, zoomRanges, padding } =
	usePlayerSettings();

// Local state
const zoomScale = ref(currentZoomRange.value?.scale || 1);
const isDragging = ref(false);
const dragArea = ref(null);
const position = ref({ x: 50, y: 50 }); // Default to center

// Frame data URL
const frameDataUrl = ref(null);

// Frame güncelleme fonksiyonu
const updateFrame = () => {
	if (props.mediaPlayer && !frameDataUrl.value) {
		frameDataUrl.value = props.mediaPlayer.captureFrame();
	}
};

// Watch currentZoomRange changes to update frame when a new zoom range is selected
watch(
	currentZoomRange,
	(newRange) => {
		if (newRange) {
			// Reset frame data to force a new capture
			frameDataUrl.value = null;
			// Capture new frame
			updateFrame();
		}
	},
	{ immediate: true }
);

onMounted(() => {
	// İlk frame'i yakala
	updateFrame();
});

onUnmounted(() => {
	frameDataUrl.value = null;
});

// Watch local changes
watch(zoomScale, (newValue) => {
	if (!currentZoomRange.value) return;

	const index = zoomRanges.value.findIndex(
		(range) =>
			range.start === currentZoomRange.value.start &&
			range.end === currentZoomRange.value.end
	);

	if (index !== -1) {
		const updatedRange = {
			...currentZoomRange.value,
			scale: parseFloat(newValue),
		};
		updateZoomRange(index, updatedRange);
	}
});

// Watch store changes
watch(
	() => currentZoomRange.value?.scale,
	(newValue) => {
		zoomScale.value = newValue || 1;
	}
);

// Zoom pozisyonu güncelleme
const updateZoomPosition = (position) => {
	if (!currentZoomRange.value) return;

	const index = zoomRanges.value.findIndex(
		(range) =>
			range.start === currentZoomRange.value.start &&
			range.end === currentZoomRange.value.end
	);

	if (index !== -1) {
		const updatedRange = {
			...currentZoomRange.value,
			position,
		};
		updateZoomRange(index, updatedRange);
	}
};

// Video aspect ratio hesaplama
const videoAspectRatio = computed(() => {
	if (props.mediaPlayer && props.mediaPlayer.videoElement) {
		const video = props.mediaPlayer.videoElement;
		return `${video.videoWidth} / ${video.videoHeight}`;
	}
	return "16 / 9"; // Varsayılan oran
});

// Preview boyutlarını hesapla
const previewDimensions = computed(() => {
	if (!dragArea.value) return { width: 0, height: 0 };

	const containerWidth = dragArea.value.clientWidth;
	const containerHeight = dragArea.value.clientHeight;
	const margin = 24; // m-3 * 2 = 24px

	const availableWidth = containerWidth - margin;
	const availableHeight = containerHeight - margin;

	// Video aspect ratio'sunu parse et
	let aspectRatio = 16 / 9;
	if (props.mediaPlayer && props.mediaPlayer.videoElement) {
		const video = props.mediaPlayer.videoElement;
		aspectRatio = video.videoWidth / video.videoHeight;
	}

	// Boyutları hesapla
	let width, height;
	if (aspectRatio > 1) {
		// Yatay video
		width = availableWidth;
		height = width / aspectRatio;
		if (height > availableHeight) {
			height = availableHeight;
			width = height * aspectRatio;
		}
	} else {
		// Dikey video
		height = availableHeight;
		width = height * aspectRatio;
		if (width > availableWidth) {
			width = availableWidth;
			height = width / aspectRatio;
		}
	}

	return { width, height };
});

// Position değerini izle ve currentZoomRange'den al
watch(
	() => currentZoomRange.value?.position,
	(newPosition) => {
		if (newPosition) {
			// Eğer string ise (örn. "center"), onu koordinatlara çevir
			if (typeof newPosition === "string") {
				switch (newPosition) {
					case "center":
						position.value = { x: 50, y: 50 };
						break;
					case "top":
						position.value = { x: 50, y: 25 };
						break;
					case "bottom":
						position.value = { x: 50, y: 75 };
						break;
					case "left":
						position.value = { x: 25, y: 50 };
						break;
					case "right":
						position.value = { x: 75, y: 50 };
						break;
					case "top-left":
						position.value = { x: 25, y: 25 };
						break;
					case "top-right":
						position.value = { x: 75, y: 25 };
						break;
					case "bottom-left":
						position.value = { x: 25, y: 75 };
						break;
					case "bottom-right":
						position.value = { x: 75, y: 75 };
						break;
					default:
						position.value = { x: 50, y: 50 };
				}
			} else {
				position.value = { ...newPosition };
			}
		} else {
			// Varsayılan olarak merkez
			position.value = { x: 50, y: 50 };
		}
	},
	{ immediate: true }
);

const startDragging = (event) => {
	isDragging.value = true;
	updatePosition(event);
};

const stopDragging = () => {
	isDragging.value = false;
};

const handleDrag = (event) => {
	if (!isDragging.value) return;
	updatePosition(event);
};

const updatePosition = (event) => {
	if (!dragArea.value) return;

	const rect = dragArea.value.getBoundingClientRect();
	const margin = 12; // m-3 = 12px

	// Preview boyutlarını al
	const { width, height } = previewDimensions.value;

	// Preview'in başlangıç pozisyonunu hesapla
	const previewX = (rect.width - width) / 2;
	const previewY = (rect.height - height) / 2;

	// Mouse pozisyonunu preview alanına göre normalize et
	const relativeX = event.clientX - rect.left - previewX;
	const relativeY = event.clientY - rect.top - previewY;

	// Yüzde olarak pozisyonu hesapla
	const x = Math.max(0, Math.min(100, (relativeX / width) * 100));
	const y = Math.max(0, Math.min(100, (relativeY / height) * 100));

	// Pozisyonu güncelle
	position.value = { x, y };
	updateZoomPosition(position.value);
};

// Pozisyon noktası stil sınıfları
const getPositionClass = (position) => {
	const isSelected = currentZoomRange.value?.position === position;
	return {
		"bg-white/20 hover:bg-white/30": !isSelected,
		"bg-indigo-500": isSelected,
	};
};

// Zoom ayarları aktif mi?
const isZoomSettingsActive = computed(() => currentZoomRange.value !== null);
</script>

<style scoped>
.setting-group {
	@apply flex flex-col gap-2;
}

.setting-label {
	@apply text-base font-semibold text-gray-300;
}

.setting-desc {
	@apply text-sm font-semibold text-gray-500;
}
</style>
