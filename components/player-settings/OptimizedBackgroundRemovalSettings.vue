<template>
	<div class="space-y-6">
		<!-- Header -->
		<div>
			<h4 class="text-base font-semibold text-white">Arkaplan Kaldırma</h4>
			<p class="text-sm font-normal text-gray-500">
				TensorFlow ile geliştirilmiş arkaplan kaldırma
			</p>
		</div>

		<!-- Kalite Seçimi Butonları -->
		<div class="flex gap-2">
			<button
				:class="[
					'px-4 py-2 rounded-md flex items-center justify-center gap-2',
					selectedQuality === 'low'
						? 'bg-blue-600 text-white'
						: 'bg-zinc-700 text-gray-300',
				]"
				@click="selectQuality('low')"
			>
				<span>Düşük</span>
				<span v-if="isLoading && false && selectedQuality === 'low'">
					<span class="circle-loader"></span>
				</span>
			</button>
			<button
				:class="[
					'px-4 py-2 rounded-md flex items-center justify-center gap-2',
					selectedQuality === 'medium'
						? 'bg-blue-600 text-white'
						: 'bg-zinc-700 text-gray-300',
				]"
				@click="selectQuality('medium')"
			>
				<span>Orta</span>
				<span v-if="isLoading && false && selectedQuality === 'medium'">
					<span class="circle-loader"></span>
				</span>
			</button>
			<button
				:class="[
					'px-4 py-2 rounded-md flex items-center justify-center gap-2',
					selectedQuality === 'high'
						? 'bg-blue-600 text-white'
						: 'bg-zinc-700 text-gray-300',
				]"
				@click="selectQuality('high')"
			>
				<span>Yüksek</span>
				<span v-if="isLoading && false && selectedQuality === 'high'">
					<span class="circle-loader"></span>
				</span>
			</button>
		</div>

		<!-- Arka Plan Tipi ve Renk Paleti (sadece kalite seçiliyse) -->
		<div v-if="selectedQuality" class="flex items-center gap-3 mt-2">
			<button
				:class="[
					'px-3 py-1 rounded',
					backgroundType === 'transparent'
						? 'bg-blue-600 text-white'
						: 'bg-zinc-700 text-gray-300',
				]"
				@click="setBackgroundType('transparent')"
			>
				Saydam
			</button>
			<input
				type="color"
				v-model="backgroundColor"
				:class="[
					'w-8 h-8 rounded cursor-pointer',
					backgroundType === 'color' ? 'ring-2 ring-blue-500' : '',
				]"
				@input="onColorInput"
			/>
			<span class="text-xs text-gray-400">Arkaplan rengi</span>
		</div>

		<!-- Loading State -->
		<!-- KALDIRILDI -->

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
import { ref, reactive, watch, onMounted, onUnmounted } from "vue";
import { useTensorFlowWebcam } from "~/composables/useTensorFlowWebcam";
import { usePlayerSettings } from "~/composables/usePlayerSettings";

const props = defineProps({
	mediaPlayerRef: { type: Object, default: null },
});

const { cameraSettings, updateCameraSettings } = usePlayerSettings();
const {
	isInitialized,
	initialize,
	updateSettings: updateTensorFlowSettings,
	cleanup,
	startProcessing,
} = useTensorFlowWebcam();

const selectedQuality = ref(null); // 'low', 'medium', 'high'
const backgroundType = ref("transparent"); // 'transparent' | 'color'
const backgroundColor = ref("#000000");
const isLoading = ref(false);
const hasError = ref(false);

const qualityDefaults = {
	low: { internalResolution: "low", segmentationThreshold: 0.3, targetFps: 20 },
	medium: {
		internalResolution: "medium",
		segmentationThreshold: 0.5,
		targetFps: 30,
	},
	high: {
		internalResolution: "high",
		segmentationThreshold: 0.7,
		targetFps: 45,
	},
};

async function selectQuality(quality) {
	selectedQuality.value = quality;
	const defaults = qualityDefaults[quality];
	if (defaults) {
		isLoading.value = true;
		try {
			await cleanup();
			await initialize();
			await updateTensorFlowSettings({
				...defaults,
				backgroundType: backgroundType.value,
				backgroundColor: backgroundColor.value,
			});
			await updateCameraSettings({
				optimizedBackgroundRemoval: true,
				removeBackground: true,
				optimizedBackgroundRemovalSettings: {
					...defaults,
					backgroundType: backgroundType.value,
					backgroundColor: backgroundColor.value,
				},
			});

			if (
				typeof startProcessing === "function" &&
				props.mediaPlayerRef?.value?.getVideoElement
			) {
				const videoElement = props.mediaPlayerRef.value.getVideoElement();
				const processLoop = startProcessing(() => {
					isLoading.value = false;
					if (
						props.mediaPlayerRef &&
						props.mediaPlayerRef.value &&
						typeof props.mediaPlayerRef.value.updateCanvas === "function"
					) {
						props.mediaPlayerRef.value.updateCanvas(performance.now());
					}
				});
				if (videoElement) {
					processLoop(videoElement);
				}
			}
		} finally {
			// loading artık onFirstFrame ile kapanacak
		}
	}
}

function setBackgroundType(type) {
	backgroundType.value = type;
	updateTensorFlowSettings({
		...qualityDefaults[selectedQuality.value],
		backgroundType: type,
		backgroundColor: backgroundColor.value,
	});
	updateCameraSettings({
		optimizedBackgroundRemovalSettings: {
			...qualityDefaults[selectedQuality.value],
			backgroundType: type,
			backgroundColor: backgroundColor.value,
		},
	});
}

function onColorInput(e) {
	backgroundType.value = "color";
	backgroundColor.value = e.target.value;
	updateTensorFlowSettings({
		...qualityDefaults[selectedQuality.value],
		backgroundType: "color",
		backgroundColor: backgroundColor.value,
	});
	updateCameraSettings({
		optimizedBackgroundRemovalSettings: {
			...qualityDefaults[selectedQuality.value],
			backgroundType: "color",
			backgroundColor: backgroundColor.value,
		},
	});
}

watch(
	() => cameraSettings.value,
	(newSettings) => {
		if (newSettings.optimizedBackgroundRemovalSettings) {
			backgroundType.value =
				newSettings.optimizedBackgroundRemovalSettings.backgroundType ||
				"transparent";
			backgroundColor.value =
				newSettings.optimizedBackgroundRemovalSettings.backgroundColor ||
				"#000000";
		}
		if (newSettings.optimizedBackgroundRemoval) {
			selectedQuality.value =
				newSettings.optimizedBackgroundRemovalSettings?.internalResolution ||
				null;
		} else {
			selectedQuality.value = null;
		}
	},
	{ deep: true, immediate: true }
);

onMounted(() => {
	const settings = cameraSettings.value.optimizedBackgroundRemovalSettings;
	if (settings) {
		backgroundType.value = settings.backgroundType || "transparent";
		backgroundColor.value = settings.backgroundColor || "#000000";
	}
	if (cameraSettings.value.optimizedBackgroundRemoval) {
		selectedQuality.value = settings?.internalResolution || null;
	}
});

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

.circle-loader {
	display: inline-block;
	width: 18px;
	height: 18px;
	border: 2.5px solid #fff;
	border-radius: 50%;
	border-top: 2.5px solid #3b82f6;
	animation: spin 0.7s linear infinite;
}
@keyframes spin {
	0% {
		transform: rotate(0deg);
	}
	100% {
		transform: rotate(360deg);
	}
}
</style>
