<template>
	<div class="space-y-6">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div>
				<h4 class="text-base font-semibold text-white">Arkaplan Kaldırma</h4>
				<p class="text-sm font-normal text-gray-500">
					TensorFlow ile geliştirilmiş arkaplan kaldırma
				</p>
			</div>
			<label class="relative inline-flex items-center cursor-pointer">
				<input
					type="checkbox"
					v-model="isEnabled"
					@change="handleToggle"
					class="sr-only peer"
				/>
				<div
					class="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"
				></div>
			</label>
		</div>

		<!-- Settings (sadece aktifken göster) -->
		<div v-if="isEnabled" class="space-y-4">
			<!-- Segmentation Threshold -->
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-2">
					Kenar Hassasiyeti:
					{{ localSettings.segmentationThreshold.toFixed(2) }}
				</label>
				<input
					type="range"
					v-model.number="localSettings.segmentationThreshold"
					min="0.1"
					max="0.9"
					step="0.05"
					@input="updateSettings"
					class="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer slider"
				/>
				<div class="flex justify-between text-xs text-gray-500 mt-1">
					<span>Yumuşak Kenar</span>
					<span>Keskin Kenar</span>
				</div>
			</div>

			<!-- Internal Resolution -->
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-2"
					>Kalite</label
				>
				<select
					v-model="localSettings.internalResolution"
					@change="updateSettings"
					class="w-full bg-zinc-800 text-white text-sm rounded-md border border-zinc-700 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
				>
					<option value="low">Düşük (En Hızlı)</option>
					<option value="medium">Orta (Önerilen)</option>
					<option value="high">Yüksek (En Kaliteli)</option>
				</select>
			</div>

			<!-- FPS Setting -->
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-2">
					FPS: {{ localSettings.targetFps }}
				</label>
				<input
					type="range"
					v-model.number="localSettings.targetFps"
					min="15"
					max="60"
					step="5"
					@input="updateSettings"
					class="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer slider"
				/>
				<div class="flex justify-between text-xs text-gray-500 mt-1">
					<span>15 FPS</span>
					<span>60 FPS</span>
				</div>
			</div>

			<!-- Flip Horizontal -->
			<!-- <div class="flex items-center justify-between">
				<span class="text-sm font-medium text-gray-300">Yatay Çevir</span>
				<label class="relative inline-flex items-center cursor-pointer">
					<input
						type="checkbox"
						v-model="localSettings.flipHorizontal"
						@change="updateSettings"
						class="sr-only peer"
					/>
					<div
						class="w-9 h-5 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"
					></div>
				</label>
			</div> -->
		</div>

		<!-- Loading State -->
		<div v-if="isLoading" class="flex items-center justify-center py-4">
			<div
				class="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"
			></div>
			<span class="text-sm text-gray-400">Model yükleniyor...</span>
		</div>

		<!-- Error State -->
		<div
			v-if="hasError"
			class="bg-red-900/50 border border-red-700 rounded-lg p-3"
		>
			<div class="flex items-center space-x-2">
				<span class="text-red-400">⚠️</span>
				<span class="text-sm text-red-300">Model yüklenirken hata oluştu</span>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from "vue";
import { useTensorFlowWebcam } from "~/composables/useTensorFlowWebcam";
import { usePlayerSettings } from "~/composables/usePlayerSettings";

// Player settings
const { cameraSettings, updateCameraSettings } = usePlayerSettings();

// TensorFlow webcam composable
const {
	isInitialized,
	isProcessing,
	initialize,
	startProcessing,
	stopProcessing,
	processFrame,
	updateSettings: updateTensorFlowSettings,
	cleanup,
} = useTensorFlowWebcam();

// Local state
const isEnabled = ref(false);
const isLoading = ref(false);
const hasError = ref(false);

// Local settings - optimized defaults
const localSettings = reactive({
	segmentationThreshold: 0.5,
	internalResolution: "medium",
	flipHorizontal: false,
	targetFps: 30,
});

// Toggle handler
const handleToggle = async () => {
	if (isEnabled.value) {
		await startOptimizedBackgroundRemoval();
	} else {
		await stopOptimizedBackgroundRemoval();
	}
};

// Initialize background removal
const initializeBackgroundRemoval = async () => {
	try {
		isLoading.value = true;
		hasError.value = false;

		// Initialize TensorFlow
		await initialize();

		isInitialized.value = true;
		isLoading.value = false;
	} catch (error) {
		// Failed to initialize background removal
		hasError.value = true;
		isLoading.value = false;
		throw error;
	}
};

// Start optimized background removal
const startOptimizedBackgroundRemoval = async () => {
	try {
		isLoading.value = true;
		hasError.value = false;

		// Initialize if not already done
		if (!isInitialized.value) {
			await initializeBackgroundRemoval();
		}

		// Update camera settings
		updateCameraSettings({
			optimizedBackgroundRemoval: true,
			removeBackground: true,
		});

		isLoading.value = false;
	} catch (error) {
		// Failed to start background removal
		hasError.value = true;
		isEnabled.value = false;
		isLoading.value = false;
	}
};

// Stop optimized background removal
const stopOptimizedBackgroundRemoval = async () => {
	try {
		// Update camera settings
		updateCameraSettings({
			optimizedBackgroundRemoval: false,
			removeBackground: false,
		});
	} catch (error) {
		// Failed to stop background removal
	}
};

// Update settings
const updateSettings = () => {
	// Update TensorFlow settings
	updateTensorFlowSettings(localSettings);

	// Update camera settings for persistence
	updateCameraSettings({
		optimizedBackgroundRemovalSettings: { ...localSettings },
	});
};

// Watch for camera settings changes
watch(
	() => cameraSettings.value,
	(newSettings) => {
		if (newSettings.optimizedBackgroundRemovalSettings) {
			Object.assign(
				localSettings,
				newSettings.optimizedBackgroundRemovalSettings
			);
		}

		// Sync enabled state
		if (newSettings.optimizedBackgroundRemoval !== isEnabled.value) {
			isEnabled.value = newSettings.optimizedBackgroundRemoval || false;
		}
	},
	{ deep: true, immediate: true }
);

// Initialize from settings
onMounted(() => {
	const settings = cameraSettings.value.optimizedBackgroundRemovalSettings;
	if (settings) {
		Object.assign(localSettings, settings);
	}

	isEnabled.value = cameraSettings.value.optimizedBackgroundRemoval || false;
});

// Cleanup on unmount
onUnmounted(() => {
	cleanup();
});
</script>

<style scoped>
.slider::-webkit-slider-thumb {
	appearance: none;
	height: 20px;
	width: 20px;
	border-radius: 50%;
	background: #3b82f6;
	cursor: pointer;
	box-shadow: 0 0 2px 0 rgba(0, 0, 0, 0.2);
}

.slider::-moz-range-thumb {
	height: 20px;
	width: 20px;
	border-radius: 50%;
	background: #3b82f6;
	cursor: pointer;
	border: none;
	box-shadow: 0 0 2px 0 rgba(0, 0, 0, 0.2);
}

.slider:focus {
	outline: none;
}

.slider::-webkit-slider-track {
	height: 8px;
	border-radius: 4px;
	background: #374151;
}

.slider::-moz-range-track {
	height: 8px;
	border-radius: 4px;
	background: #374151;
}
</style>
