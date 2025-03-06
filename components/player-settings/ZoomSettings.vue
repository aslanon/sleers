<template>
	<div class="flex flex-col gap-4">
		<div v-if="isZoomSettingsActive" class="flex flex-col gap-12">
			<div class="space-y-2">
				<h3 class="text-lg font-medium">Zoom Ayarları</h3>
				<p class="text-sm text-gray-400">
					Zoom görüntüsü için ayarları buradan yapabilirsiniz.
				</p>
			</div>

			<!-- Zoom Level Slider -->
			<SliderInput
				v-model="zoomScale"
				desc="Zoom görüntüsünün büyütme seviyesini ayarlar."
				label="Zoom Level"
				:min="1"
				:max="10"
				:step="0.1"
				unit="x"
			/>

			<!-- Zoom Origin Selector -->
			<div class="setting-group pb-4">
				<label class="setting-label">Zoom Origin</label>
				<p class="setting-desc">Zoom efektinin merkez noktasını belirler.</p>
				<div class="mt-3 flex flex-col space-y-2">
					<label class="flex items-center space-x-2 cursor-pointer">
						<input
							type="radio"
							name="zoomOrigin"
							value="cursor"
							v-model="zoomOriginType"
							class="w-4 h-4 text-indigo-500"
						/>
						<span class="text-sm">Cursor Position (At segment start)</span>
					</label>
					<label class="flex items-center space-x-2 cursor-pointer">
						<input
							type="radio"
							name="zoomOrigin"
							value="custom"
							v-model="zoomOriginType"
							class="w-4 h-4 text-indigo-500"
						/>
						<span class="text-sm">Custom Position</span>
					</label>
				</div>
			</div>

			<!-- Zoom Position Selector (only visible when zoomOriginType is 'custom') -->
			<div v-if="zoomOriginType === 'custom'" class="setting-group pb-4">
				<label class="setting-label">Zoom Position</label>
				<p class="setting-desc">Zoom görüntüsünün konumunu ayarlar.</p>
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
const zoomOriginType = ref("cursor"); // Default to cursor position

// Frame data URL
const frameDataUrl = ref(null);

// Frame güncelleme fonksiyonu
const updateFrame = () => {
	if (props.mediaPlayer) {
		frameDataUrl.value = props.mediaPlayer.captureFrame();
	}
};

// Frame güncelleme interval'i
let frameUpdateInterval = null;

onMounted(() => {
	// İlk frame'i yakala
	updateFrame();

	// Her 100ms'de bir frame'i güncelle (daha sık güncelleme için 500ms'den düşürüldü)
	frameUpdateInterval = setInterval(updateFrame, 100);

	// Initialize based on current zoom range if available
	if (currentZoomRange.value) {
		// Set the origin type based on the current zoom range
		zoomOriginType.value =
			currentZoomRange.value.position === "cursor" ? "cursor" : "custom";

		// If it's a custom position, set the position values
		if (
			zoomOriginType.value === "custom" &&
			typeof currentZoomRange.value.position === "object"
		) {
			position.value.x = currentZoomRange.value.position.x;
			position.value.y = currentZoomRange.value.position.y;
		} else if (
			zoomOriginType.value === "cursor" &&
			currentZoomRange.value.cursorX !== undefined
		) {
			// If it's cursor position, use the stored cursor coordinates
			position.value.x = currentZoomRange.value.cursorX;
			position.value.y = currentZoomRange.value.cursorY;
		}
	}
});

onUnmounted(() => {
	if (frameUpdateInterval) {
		clearInterval(frameUpdateInterval);
	}
});

// Watch zoomScale changes
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

// Watch zoomOriginType changes
watch(zoomOriginType, (newType) => {
	if (!currentZoomRange.value) return;

	const index = zoomRanges.value.findIndex(
		(range) =>
			range.start === currentZoomRange.value.start &&
			range.end === currentZoomRange.value.end
	);

	if (index !== -1) {
		const updatedRange = {
			...currentZoomRange.value,
		};

		if (newType === "cursor") {
			// If cursor type is selected, keep the original cursor position from when segment was created
			updatedRange.position = "cursor";
		} else {
			// If custom type is selected, use the current position
			updatedRange.position = {
				type: "custom",
				x: position.value.x,
				y: position.value.y,
			};
		}

		updateZoomRange(index, updatedRange);
	}
});

// Watch store changes
watch(
	() => currentZoomRange.value,
	(newValue) => {
		if (newValue) {
			zoomScale.value = newValue.scale || 1;

			// Update the origin type and position
			if (newValue.position === "cursor") {
				zoomOriginType.value = "cursor";
				// For cursor position, use the stored cursor coordinates
				if (newValue.cursorX !== undefined && newValue.cursorY !== undefined) {
					position.value.x = newValue.cursorX;
					position.value.y = newValue.cursorY;
				}
			} else {
				zoomOriginType.value = "custom";
				if (typeof newValue.position === "object") {
					position.value.x = newValue.position.x;
					position.value.y = newValue.position.y;
				}
			}
		}
	},
	{ deep: true, immediate: true }
);

// Zoom pozisyonu güncelleme
const updateZoomPosition = (newPosition) => {
	if (!currentZoomRange.value) return;

	const index = zoomRanges.value.findIndex(
		(range) =>
			range.start === currentZoomRange.value.start &&
			range.end === currentZoomRange.value.end
	);

	if (index !== -1) {
		const updatedRange = {
			...currentZoomRange.value,
			position: {
				type: "custom",
				x: newPosition.x,
				y: newPosition.y,
			},
		};
		updateZoomRange(index, updatedRange);
	}
};

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

	// Calculate available space considering margins
	const availableWidth = rect.width - margin * 2;
	const availableHeight = rect.height - margin * 2;

	// Adjust mouse position relative to the margins
	const x = ((event.clientX - rect.left - margin) / availableWidth) * 100;
	const y = ((event.clientY - rect.top - margin) / availableHeight) * 100;

	// Clamp values between 0 and 100
	position.value = {
		x,
		y,
	};

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

// Video aspect ratio hesaplama
const videoAspectRatio = computed(() => {
	const video = props.mediaPlayer?.getVideoElement();
	if (!video) return "16/9";
	return `${video.videoWidth}/${video.videoHeight}`;
});

// Preview boyutlarını hesaplama
const previewDimensions = computed(() => {
	const video = props.mediaPlayer?.getVideoElement();
	if (!video) return { width: 160, height: 90 };

	const containerWidth = 160; // max-w-[160px]
	const containerHeight = containerWidth * (9 / 16); // aspect-video (16:9)

	const videoRatio = video.videoWidth / video.videoHeight;
	const containerRatio = containerWidth / containerHeight;

	let width, height;

	if (videoRatio > containerRatio) {
		// Video daha geniş, yüksekliğe göre ölçekle
		height = containerHeight;
		width = height * videoRatio;
	} else {
		// Video daha dar, genişliğe göre ölçekle
		width = containerWidth;
		height = width / videoRatio;
	}

	return { width, height };
});
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
