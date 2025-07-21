<template>
	<div class="space-y-6">
		<!-- Enable Switch -->
		<div class="flex items-center justify-between">
			<div>
				<h4 class="text-base font-semibold text-white">Background Removal</h4>
				<p class="text-sm font-normal text-gray-500">
					Advanced background removal with TensorFlow
				</p>
			</div>
			<label class="relative inline-flex items-center cursor-pointer">
				<input type="checkbox" v-model="enabled" class="sr-only peer" />
				<div
					class="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"
				></div>
			</label>
		</div>

		<!-- Ayar UI'ı sadece enabled ise göster -->
		<div v-if="enabled">
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
					<span>Low</span>
					<span v-if="isLoading && selectedQuality === 'low'">
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
					<span>Medium</span>
					<span v-if="isLoading && selectedQuality === 'medium'">
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
					<span>High</span>
					<span v-if="isLoading && selectedQuality === 'high'">
						<span class="circle-loader"></span>
					</span>
				</button>
			</div>

			<!-- Arka Plan Tipi ve Renk Paleti (sadece kalite seçiliyse ve loading bittiyse) -->
			<div v-if="selectedQuality && !isLoading" class="flex items-center gap-3 mt-2">
				<button
					:class="[
						'px-3 py-1 rounded',
						backgroundType === 'transparent'
							? 'bg-blue-600 text-white'
							: 'bg-zinc-700 text-gray-300',
					]"
					@click="setBackgroundType('transparent')"
				>
					Transparent
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
				<span class="text-xs text-gray-400">Background color</span>
			</div>

			<!-- Error State -->
			<div
				v-if="hasError"
				class="bg-red-900/50 border border-red-700 rounded-lg p-3"
			>
				<div class="flex items-center space-x-2">
					<span class="text-red-400">⚠️</span>
					<span class="text-sm text-red-300"
						>Error loading model</span
					>
				</div>
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

const enabled = ref(false);
const { cameraSettings, updateCameraSettings } = usePlayerSettings();
const {
	isInitialized,
	initialize,
	updateSettings: updateTensorFlowSettings,
	cleanup,
	startProcessing,
} = useTensorFlowWebcam();

// TensorFlow functions initialized

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
			
			// Camera settings updated with background removal

			// Video element'i doğrudan MediaPlayer'dan al
			const videoElement = props.mediaPlayerRef?.value?.getVideoElement?.() || 
								props.mediaPlayerRef?.value?.videoElement ||
								null;
			
			// TensorFlow processing başlatılamıyor, manuel canvas güncelleme yap
			// Bu geçici çözüm - sadece ayarlar değiştiğinde canvas'ı güncelle
			
			// Direkt canvas güncelleme yapmayı dene
			if (props.mediaPlayerRef?.value?.updateCanvas) {
				// Canvas'ı birden fazla kez güncelle
				requestAnimationFrame(() => {
					props.mediaPlayerRef.value.updateCanvas(performance.now(), 0, 0);
				});
				
				// Biraz bekleyip tekrar güncelle
				setTimeout(() => {
					requestAnimationFrame(() => {
						props.mediaPlayerRef.value.updateCanvas(performance.now(), 0, 0);
					});
				}, 100);
				
				// Son bir deneme
				setTimeout(() => {
					requestAnimationFrame(() => {
						props.mediaPlayerRef.value.updateCanvas(performance.now(), 0, 0);
					});
				}, 300);
			}
			
			isLoading.value = false;
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
	
	// Canvas'ı hemen güncelle - mouse move gibi
	if (props.mediaPlayerRef?.value?.updateCanvas) {
		// Anında güncelle
		requestAnimationFrame(() => {
			props.mediaPlayerRef.value.updateCanvas(performance.now(), 0, 0);
		});
		
		// Biraz bekleyip tekrar
		setTimeout(() => {
			requestAnimationFrame(() => {
				props.mediaPlayerRef.value.updateCanvas(performance.now(), 0, 0);
			});
		}, 50);
	}
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
	
	// Canvas'ı hemen güncelle - mouse move gibi
	if (props.mediaPlayerRef?.value?.updateCanvas) {
		// Anında güncelle
		requestAnimationFrame(() => {
			props.mediaPlayerRef.value.updateCanvas(performance.now(), 0, 0);
		});
		
		// Biraz bekleyip tekrar
		setTimeout(() => {
			requestAnimationFrame(() => {
				props.mediaPlayerRef.value.updateCanvas(performance.now(), 0, 0);
			});
		}, 50);
	}
}

watch(
	() => cameraSettings.value,
	(newSettings) => {
		// Check if background removal is active and update enabled state
		if (newSettings.optimizedBackgroundRemoval) {
			enabled.value = true;
			selectedQuality.value =
				newSettings.optimizedBackgroundRemovalSettings?.internalResolution ||
				null;
		} else {
			enabled.value = false;
			selectedQuality.value = null;
		}
		
		// Background type ve color ayarlarını güncelle
		if (newSettings.optimizedBackgroundRemovalSettings) {
			backgroundType.value =
				newSettings.optimizedBackgroundRemovalSettings.backgroundType ||
				"transparent";
			backgroundColor.value =
				newSettings.optimizedBackgroundRemovalSettings.backgroundColor ||
				"#000000";
		}
	},
	{ deep: true, immediate: true }
);

watch(enabled, async (val) => {
	if (!val) {
		// Completely disable background removal when switch is turned off
		await cleanup();
		updateCameraSettings({
			optimizedBackgroundRemoval: false,
			removeBackground: false,
			optimizedBackgroundRemovalSettings: {},
		});
	}
});

onMounted(() => {
	const settings = cameraSettings.value.optimizedBackgroundRemovalSettings;
	
	// Check if background removal is active
	if (cameraSettings.value.optimizedBackgroundRemoval) {
		enabled.value = true;
		selectedQuality.value = settings?.internalResolution || null;
	} else {
		enabled.value = false;
		selectedQuality.value = null;
	}
	
	// Background type ve color ayarlarını yükle
	if (settings) {
		backgroundType.value = settings.backgroundType || "transparent";
		backgroundColor.value = settings.backgroundColor || "#000000";
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
