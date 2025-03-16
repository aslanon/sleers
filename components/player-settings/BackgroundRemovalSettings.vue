<template>
	<div class="bg-white rounded-lg shadow-md p-4 mb-4">
		<div class="flex items-center justify-between mb-4">
			<h3 class="text-lg font-medium">Arkaplan Kaldırma</h3>
			<div class="flex items-center">
				<label class="relative inline-flex items-center cursor-pointer">
					<input
						type="checkbox"
						v-model="removeBackground"
						class="sr-only peer"
						@change="handleBackgroundRemovalToggle"
					/>
					<div
						class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
					></div>
				</label>
			</div>
		</div>

		<div v-if="removeBackground" class="space-y-4">
			<div
				v-if="isBackgroundRemovalLoading"
				class="flex items-center justify-center p-4"
			>
				<div
					class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"
				></div>
				<span class="ml-2 text-sm text-gray-600">Model yükleniyor...</span>
			</div>

			<div class="space-y-2">
				<label class="block text-sm font-medium text-gray-700">
					Segmentasyon Eşiği
					<span class="text-xs text-gray-500 ml-1"
						>({{ segmentationThreshold }})</span
					>
				</label>
				<input
					type="range"
					v-model="segmentationThreshold"
					min="0.1"
					max="0.9"
					step="0.05"
					class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
					@change="updateSettings"
				/>
				<div class="flex justify-between text-xs text-gray-500">
					<span>0.1</span>
					<span>0.9</span>
				</div>
			</div>

			<div class="space-y-2">
				<label class="block text-sm font-medium text-gray-700"
					>Çözünürlük</label
				>
				<select
					v-model="internalResolution"
					class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
					@change="updateSettings"
				>
					<option value="low">Düşük (Hızlı)</option>
					<option value="medium">Orta</option>
					<option value="high">Yüksek (Yavaş)</option>
				</select>
			</div>

			<div class="space-y-2">
				<label class="block text-sm font-medium text-gray-700">
					Hedef FPS
					<span class="text-xs text-gray-500 ml-1">({{ targetFps }})</span>
				</label>
				<input
					type="range"
					v-model="targetFps"
					min="15"
					max="60"
					step="5"
					class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
					@change="updateSettings"
				/>
				<div class="flex justify-between text-xs text-gray-500">
					<span>15</span>
					<span>60</span>
				</div>
			</div>

			<div class="flex items-center mt-2">
				<input
					id="flip-horizontal"
					type="checkbox"
					v-model="flipHorizontal"
					class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
					@change="updateSettings"
				/>
				<label
					for="flip-horizontal"
					class="ml-2 text-sm font-medium text-gray-700"
				>
					Yatay Çevir
				</label>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import { useCameraRenderer } from "~/composables/useCameraRenderer";

const { cameraSettings, updateCameraSettings } = usePlayerSettings();
const {
	toggleBackgroundRemoval,
	isBackgroundRemovalLoading,
	isBackgroundRemovalActive,
} = useCameraRenderer();

// Local state
const removeBackground = ref(cameraSettings.value.removeBackground);
const segmentationThreshold = ref(
	cameraSettings.value.backgroundRemovalSettings?.segmentationThreshold || 0.6
);
const internalResolution = ref(
	cameraSettings.value.backgroundRemovalSettings?.internalResolution || "medium"
);
const flipHorizontal = ref(
	cameraSettings.value.backgroundRemovalSettings?.flipHorizontal || false
);
const targetFps = ref(
	cameraSettings.value.backgroundRemovalSettings?.targetFps || 30
);

// Watch for changes in camera settings
watch(
	() => cameraSettings.value,
	(newSettings) => {
		removeBackground.value = newSettings.removeBackground;
		segmentationThreshold.value =
			newSettings.backgroundRemovalSettings?.segmentationThreshold || 0.6;
		internalResolution.value =
			newSettings.backgroundRemovalSettings?.internalResolution || "medium";
		flipHorizontal.value =
			newSettings.backgroundRemovalSettings?.flipHorizontal || false;
		targetFps.value = newSettings.backgroundRemovalSettings?.targetFps || 30;
	},
	{ deep: true }
);

// Toggle background removal
const handleBackgroundRemovalToggle = async () => {
	// Update camera settings
	updateCameraSettings({
		removeBackground: removeBackground.value,
	});

	// Toggle background removal processing if enabled
	if (removeBackground.value) {
		await toggleBackgroundRemoval();
	} else if (isBackgroundRemovalActive.value) {
		await toggleBackgroundRemoval();
	}
};

// Update background removal settings
const updateSettings = () => {
	updateCameraSettings({
		backgroundRemovalSettings: {
			segmentationThreshold: parseFloat(segmentationThreshold.value),
			internalResolution: internalResolution.value,
			flipHorizontal: flipHorizontal.value,
			targetFps: parseInt(targetFps.value),
		},
	});
};

onMounted(() => {
	// Initialize with current settings
	removeBackground.value = cameraSettings.value.removeBackground;
	segmentationThreshold.value =
		cameraSettings.value.backgroundRemovalSettings?.segmentationThreshold ||
		0.6;
	internalResolution.value =
		cameraSettings.value.backgroundRemovalSettings?.internalResolution ||
		"medium";
	flipHorizontal.value =
		cameraSettings.value.backgroundRemovalSettings?.flipHorizontal || false;
	targetFps.value =
		cameraSettings.value.backgroundRemovalSettings?.targetFps || 30;
});
</script>
