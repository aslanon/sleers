<template>
	<div class="h-screen bg-black text-white p-6">
		<div class="max-w-6xl mx-auto space-y-6">
			<!-- Header -->
			<div class="text-center space-y-2">
				<h1 class="text-3xl font-bold">TensorFlow Webcam Test</h1>
				<p class="text-gray-400">
					Makaleden optimize edilmiş arka plan kaldırma sistemi
				</p>
			</div>

			<!-- Performance Stats -->
			<div class="grid grid-cols-4 gap-4 bg-zinc-900 rounded-lg p-4">
				<div class="text-center">
					<div class="text-2xl font-bold text-green-400">
						{{ metrics.actualFps.toFixed(1) }}
					</div>
					<div class="text-sm text-gray-400">Gerçek FPS</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-blue-400">
						{{ metrics.averageProcessingTime.toFixed(1) }}ms
					</div>
					<div class="text-sm text-gray-400">Ortalama İşlem</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-purple-400">
						{{ metrics.processedFrames }}
					</div>
					<div class="text-sm text-gray-400">İşlenen Kare</div>
				</div>
				<div class="text-center">
					<div
						class="text-2xl font-bold"
						:class="isProcessing ? 'text-green-400' : 'text-red-400'"
					>
						{{ isProcessing ? "Aktif" : "Durdu" }}
					</div>
					<div class="text-sm text-gray-400">Durum</div>
				</div>
			</div>

			<!-- Settings Panel -->
			<div class="bg-zinc-900 rounded-lg p-6 space-y-4">
				<h3 class="text-xl font-semibold mb-4">Ayarlar</h3>

				<div class="grid grid-cols-2 gap-6">
					<div class="space-y-4">
						<div>
							<label class="block text-sm font-medium mb-2">
								Segmentasyon Eşiği: {{ currentSettings.segmentationThreshold }}
							</label>
							<input
								type="range"
								v-model.number="currentSettings.segmentationThreshold"
								min="0"
								max="1"
								step="0.05"
								class="w-full"
								@input="handleSettingsUpdate"
							/>
						</div>

						<div>
							<label class="block text-sm font-medium mb-2">Çözünürlük</label>
							<select
								v-model="currentSettings.internalResolution"
								@change="handleSettingsUpdate"
								class="w-full bg-zinc-800 text-white rounded px-3 py-2 border border-zinc-700"
							>
								<option value="low">Düşük (Hızlı)</option>
								<option value="medium">Orta (Dengeli)</option>
								<option value="high">Yüksek (Kaliteli)</option>
								<option value="full">Tam (En Kaliteli)</option>
							</select>
						</div>
					</div>

					<div class="space-y-4">
						<div>
							<label class="block text-sm font-medium mb-2">
								Hedef FPS: {{ currentSettings.targetFps }}
							</label>
							<input
								type="range"
								v-model.number="currentSettings.targetFps"
								min="15"
								max="60"
								step="5"
								class="w-full"
								@input="handleSettingsUpdate"
							/>
						</div>

						<div class="flex items-center space-x-3">
							<input
								type="checkbox"
								v-model="currentSettings.flipHorizontal"
								@change="handleSettingsUpdate"
								class="form-checkbox h-5 w-5 text-blue-600"
							/>
							<label class="text-sm font-medium">Yatay Çevir</label>
						</div>
					</div>
				</div>
			</div>

			<!-- Video Display -->
			<div class="grid grid-cols-2 gap-6">
				<!-- Original Video -->
				<div class="space-y-3">
					<h3 class="text-lg font-semibold text-center">Orijinal Kamera</h3>
					<div
						class="relative bg-zinc-900 rounded-lg overflow-hidden aspect-video"
					>
						<video
							ref="videoRef"
							autoplay
							playsinline
							muted
							class="w-full h-full object-cover"
						/>
						<div
							v-if="!cameraStarted"
							class="absolute inset-0 flex items-center justify-center"
						>
							<div class="text-gray-400 text-center">
								<div class="text-6xl mb-4">📷</div>
								<div>Kamera henüz başlatılmadı</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Processed Video -->
				<div class="space-y-3">
					<h3 class="text-lg font-semibold text-center">
						Arka Plan Kaldırılmış
					</h3>
					<div
						class="relative rounded-lg overflow-hidden aspect-video checkerboard-bg"
					>
						<canvas ref="canvasRef" class="w-full h-full object-cover" />
						<div
							v-if="!isProcessing"
							class="absolute inset-0 flex items-center justify-center"
						>
							<div class="text-gray-400 text-center">
								<div class="text-6xl mb-4">🎭</div>
								<div>İşlem başlatılmadı</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Control Buttons -->
			<div class="flex justify-center space-x-4">
				<button
					@click="startCamera"
					:disabled="cameraStarted"
					class="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
				>
					{{ cameraStarted ? "Kamera Aktif" : "Kamerayı Başlat" }}
				</button>

				<button
					@click="toggleProcessing"
					:disabled="!cameraStarted || !isInitialized"
					class="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
				>
					{{ isProcessing ? "İşlemi Durdur" : "İşlemi Başlat" }}
				</button>

				<button
					@click="stopCamera"
					:disabled="!cameraStarted"
					class="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
				>
					Kamerayı Durdur
				</button>
			</div>

			<!-- Loading State -->
			<div v-if="!isInitialized && isInitializing" class="text-center py-8">
				<div
					class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"
				></div>
				<div class="text-lg">TensorFlow modeli yükleniyor...</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from "vue";
import { useTensorFlowWebcam } from "~/composables/useTensorFlowWebcam";

// Webcam composable
const {
	isInitialized,
	isProcessing,
	initialize,
	startProcessing,
	stopProcessing,
	updateSettings,
	getMetrics,
	cleanup,
	segmentationThreshold,
	internalResolution,
	flipHorizontal,
	targetFps,
	averageProcessingTime,
	processedFrameCount,
} = useTensorFlowWebcam();

// Local state
const cameraStarted = ref(false);
const isInitializing = ref(false);
const videoRef = ref(null);
const canvasRef = ref(null);
const cameraStream = ref(null);
const processLoop = ref(null);

// Settings
const currentSettings = reactive({
	segmentationThreshold: 0.6,
	internalResolution: "medium",
	flipHorizontal: false,
	targetFps: 30,
});

// Computed metrics
const metrics = computed(() => {
	const baseMetrics = getMetrics();
	return {
		...baseMetrics,
		actualFps: baseMetrics.actualFps || 0,
		averageProcessingTime: baseMetrics.averageProcessingTime || 0,
		processedFrames: baseMetrics.processedFrames || 0,
	};
});

// Start camera
const startCamera = async () => {
	try {
		if (!videoRef.value) return;

		// Get camera stream
		cameraStream.value = await navigator.mediaDevices.getUserMedia({
			video: {
				width: { ideal: 1280 },
				height: { ideal: 720 },
				frameRate: { ideal: 30 },
			},
			audio: false,
		});

		videoRef.value.srcObject = cameraStream.value;
		cameraStarted.value = true;

		// Initialize TensorFlow if not already done
		if (!isInitialized.value) {
			isInitializing.value = true;
			await initialize();
			isInitializing.value = false;
		}
	} catch (error) {
		console.error("Camera start error:", error);
		alert("Kamera erişimi sağlanamadı: " + error.message);
	}
};

// Stop camera
const stopCamera = () => {
	if (cameraStream.value) {
		cameraStream.value.getTracks().forEach((track) => track.stop());
		cameraStream.value = null;
	}

	if (videoRef.value) {
		videoRef.value.srcObject = null;
	}

	if (processLoop.value) {
		stopProcessing();
		processLoop.value = null;
	}

	cameraStarted.value = false;
};

// Toggle processing
const toggleProcessing = async () => {
	if (!videoRef.value || !canvasRef.value || !isInitialized.value) return;

	if (isProcessing.value) {
		stopProcessing();
		processLoop.value = null;
	} else {
		// Start processing loop
		processLoop.value = startProcessing();

		// Start the processing loop with callback
		processLoop.value(videoRef.value, (processedCanvas) => {
			if (canvasRef.value && processedCanvas) {
				const ctx = canvasRef.value.getContext("2d");
				canvasRef.value.width = processedCanvas.width;
				canvasRef.value.height = processedCanvas.height;
				ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
				ctx.drawImage(processedCanvas, 0, 0);
			}
		});
	}
};

// Handle settings update
const handleSettingsUpdate = () => {
	updateSettings(currentSettings);
};

// Cleanup on unmount
onUnmounted(() => {
	stopCamera();
	cleanup();
});
</script>

<style scoped>
.checkerboard-bg {
	background-image: linear-gradient(45deg, #666 25%, transparent 25%),
		linear-gradient(-45deg, #666 25%, transparent 25%),
		linear-gradient(45deg, transparent 75%, #666 75%),
		linear-gradient(-45deg, transparent 75%, #666 75%);
	background-size: 20px 20px;
	background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}

input[type="range"] {
	-webkit-appearance: none;
	appearance: none;
	height: 6px;
	background: #374151;
	border-radius: 3px;
}

input[type="range"]::-webkit-slider-thumb {
	-webkit-appearance: none;
	appearance: none;
	width: 20px;
	height: 20px;
	background: #3b82f6;
	border-radius: 50%;
	cursor: pointer;
}

input[type="range"]::-moz-range-thumb {
	width: 20px;
	height: 20px;
	background: #3b82f6;
	border-radius: 50%;
	cursor: pointer;
	border: none;
}
</style>
