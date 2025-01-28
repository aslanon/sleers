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
				<div class="relative">
					<!-- Arka plan alanı -->
					<div
						class="w-full max-w-[160px] h-[90px] bg-zinc-900 rounded-lg border border-gray-700 relative"
						@mousedown="startDragging"
						@mousemove="handleDrag"
						@mouseup="stopDragging"
						@mouseleave="stopDragging"
						ref="dragArea"
					>
						<!-- Handle -->
						<div
							class="absolute z-50 w-6 h-6 -translate-x-1/2 -translate-y-1/2 bg-zinc-700 ring-2 ring-zinc-500 rounded-full cursor-grab hover:ring-zinc-400 transition-all active:scale-95 shadow-lg"
							:style="{
								left: `${position.x}%`,
								top: `${position.y}%`,
							}"
							:class="{
								'cursor-grabbing ring-zinc-400 scale-95': isDragging,
								'hover:ring-zinc-300': !isDragging,
							}"
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
const { currentZoomRange, updateZoomRange, zoomRanges, padding } =
	usePlayerSettings();

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
	() => currentZoomRange.value,
	(newRange) => {
		if (newRange) {
			zoomScale.value = newRange.scale || 1;
			if (newRange.position) {
				position.value = {
					x: newRange.position.x || 50,
					y: newRange.position.y || 50,
				};
			} else {
				position.value = { x: 50, y: 50 };
			}
		} else {
			zoomScale.value = 1;
			position.value = { x: 50, y: 50 };
		}
	},
	{ immediate: true, deep: true }
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
				x: Math.round(newPosition.x),
				y: Math.round(newPosition.y),
			},
		};
		console.log("Updating zoom position:", updatedRange.position);
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
	const handleSize = 24; // 6rem = 24px
	const handleOffset = handleSize / 2;

	// Mouse pozisyonunu hesapla
	const x = event.clientX - rect.left;
	const y = event.clientY - rect.top;

	// Handle'ın sınırlar içinde kalması için offset'leri hesaba kat
	const minX = 0;
	const maxX = rect.width;
	const minY = 0;
	const maxY = rect.height;

	// Sınırlandırılmış pozisyonu hesapla
	const clampedX = Math.max(minX, Math.min(maxX, x));
	const clampedY = Math.max(minY, Math.min(maxY, y));

	// Yüzdelik değerleri hesapla
	const percentX = (clampedX / rect.width) * 100;
	const percentY = (clampedY / rect.height) * 100;

	// Pozisyonu güncelle
	position.value = {
		x: percentX,
		y: percentY,
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
