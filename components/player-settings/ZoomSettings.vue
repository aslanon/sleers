<template>
	<div class="flex flex-col gap-4">
		<div v-if="isZoomSettingsActive" class="flex flex-col gap-4">
			<!-- Zoom Level Slider -->
			<div class="flex flex-col gap-2">
				<label class="text-sm text-gray-500">Zoom Level</label>
				<input
					type="range"
					:min="1"
					:max="10"
					:step="0.1"
					:value="currentZoomRange?.scale || 1"
					@input="updateZoomScale($event.target.value)"
					class="w-full"
				/>
				<div class="text-xs text-gray-400">
					{{ currentZoomRange?.scale || 1 }}x
				</div>
			</div>

			<!-- Zoom Position Selector -->
			<div class="flex flex-col gap-2">
				<label class="text-sm text-gray-500">Zoom Position</label>
				<div
					class="relative w-[100px] h-[100px] bg-gray-800/50 rounded-lg mx-auto"
				>
					<!-- Köşe ve Kenar Noktaları -->
					<div class="absolute inset-0 grid grid-cols-3 grid-rows-3">
						<!-- Sol Üst -->
						<div class="flex items-center justify-center">
							<div
								class="w-3 h-3 rounded-full transition-colors cursor-pointer"
								:class="getPositionClass('top-left')"
								@click="updateZoomPosition('top-left')"
							></div>
						</div>
						<!-- Üst Orta -->
						<div class="flex items-center justify-center">
							<div
								class="w-3 h-3 rounded-full transition-colors cursor-pointer"
								:class="getPositionClass('top-center')"
								@click="updateZoomPosition('top-center')"
							></div>
						</div>
						<!-- Sağ Üst -->
						<div class="flex items-center justify-center">
							<div
								class="w-3 h-3 rounded-full transition-colors cursor-pointer"
								:class="getPositionClass('top-right')"
								@click="updateZoomPosition('top-right')"
							></div>
						</div>
						<!-- Sol Orta -->
						<div class="flex items-center justify-center">
							<div
								class="w-3 h-3 rounded-full transition-colors cursor-pointer"
								:class="getPositionClass('middle-left')"
								@click="updateZoomPosition('middle-left')"
							></div>
						</div>
						<!-- Merkez -->
						<div class="flex items-center justify-center">
							<div
								class="w-3 h-3 rounded-full transition-colors cursor-pointer"
								:class="getPositionClass('center')"
								@click="updateZoomPosition('center')"
							></div>
						</div>
						<!-- Sağ Orta -->
						<div class="flex items-center justify-center">
							<div
								class="w-3 h-3 rounded-full transition-colors cursor-pointer"
								:class="getPositionClass('middle-right')"
								@click="updateZoomPosition('middle-right')"
							></div>
						</div>
						<!-- Sol Alt -->
						<div class="flex items-center justify-center">
							<div
								class="w-3 h-3 rounded-full transition-colors cursor-pointer"
								:class="getPositionClass('bottom-left')"
								@click="updateZoomPosition('bottom-left')"
							></div>
						</div>
						<!-- Alt Orta -->
						<div class="flex items-center justify-center">
							<div
								class="w-3 h-3 rounded-full transition-colors cursor-pointer"
								:class="getPositionClass('bottom-center')"
								@click="updateZoomPosition('bottom-center')"
							></div>
						</div>
						<!-- Sağ Alt -->
						<div class="flex items-center justify-center">
							<div
								class="w-3 h-3 rounded-full transition-colors cursor-pointer"
								:class="getPositionClass('bottom-right')"
								@click="updateZoomPosition('bottom-right')"
							></div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div v-else class="flex items-center justify-center h-32 text-gray-500">
			Select a zoom segment to adjust its settings
		</div>
	</div>
</template>

<script setup>
import { computed } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";

const { currentZoomRange, updateZoomRange, zoomRanges } = usePlayerSettings();

// Zoom scale güncelleme
const updateZoomScale = (value) => {
	if (!currentZoomRange.value) return;

	const index = zoomRanges.value.findIndex(
		(range) =>
			range.start === currentZoomRange.value.start &&
			range.end === currentZoomRange.value.end
	);

	if (index !== -1) {
		const updatedRange = {
			...currentZoomRange.value,
			scale: parseFloat(value),
		};
		updateZoomRange(index, updatedRange);
	}
};

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
