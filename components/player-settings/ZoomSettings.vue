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

			<!-- Zoom Position Selector -->
			<div class="setting-group pb-4">
				<label class="setting-label">Zoom Position</label>
				<p class="setting-desc">Zoom görüntüsünün konumunu ayarlar.</p>
				<div
					class="relative w-full max-w-[160px] h-[90px] bg-zinc-900 rounded-lg border border-gray-700"
					@mousedown="startDragging"
					@mousemove="handleDrag"
					@mouseup="stopDragging"
					@mouseleave="stopDragging"
					ref="dragArea"
				>
					<!-- İç kısım için ayrı bir container -->
					<div class="absolute inset-0 m-3">
						<div
							class="absolute z-20 w-8 h-8 -m-4 bg-zinc-700 ring-2 ring-zinc-500 rounded-full cursor-grab hover:ring-zinc-400 transition-all active:scale-95"
							:style="{ left: `${position.x}%`, top: `${position.y}%` }"
							:class="{ 'cursor-grabbing ring-zinc-400 scale-95': isDragging }"
						></div>
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
import { ref, computed, watch } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import SliderInput from "~/components/ui/SliderInput.vue";

// First, import the usePlayerSettings at the top of script setup
const { currentZoomRange, updateZoomRange, zoomRanges, padding } = usePlayerSettings();

// Local state
// Local state
const zoomScale = ref(currentZoomRange.value?.scale || 1);
const isDragging = ref(false);
const dragArea = ref(null);
const position = ref({ x: 50, y: 50 }); // Default to center

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
    const availableWidth = rect.width - (margin * 2);
    const availableHeight = rect.height - (margin * 2);

    // Adjust mouse position relative to the margins
    const x = ((event.clientX - rect.left - margin) / availableWidth) * 100;
    const y = ((event.clientY - rect.top - margin) / availableHeight) * 100;

    // Clamp values between 0 and 100
    position.value = {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y))
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
