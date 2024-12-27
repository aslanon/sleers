<template>
	<div class="min-h-screen bg-[#1a1b26] text-white p-4">
		<div class="max-w-6xl mx-auto">
			<!-- Video Önizleme -->
			<div
				class="aspect-video bg-gray-800 rounded-lg overflow-hidden mb-4 relative"
			>
				<canvas ref="videoCanvas" class="w-full h-full"></canvas>
				<video ref="videoPreview" class="hidden"></video>

				<!-- Video Kontrolleri -->
				<div
					class="absolute bottom-0 left-0 right-0 p-4 bg-black/50 backdrop-blur-sm"
				>
					<div class="flex items-center space-x-4">
						<button
							@click="togglePlay"
							class="p-2 hover:bg-white/20 rounded-lg"
						>
							<Icon
								:name="
									isPlaying
										? 'material-symbols:pause'
										: 'material-symbols:play-arrow'
								"
								size="24"
							/>
						</button>

						<!-- İlerleme Çubuğu -->
						<div
							class="flex-1 h-1 bg-gray-600 rounded-full cursor-pointer"
							@click="seek"
						>
							<div
								class="h-full bg-blue-500 rounded-full"
								:style="{ width: `${progress}%` }"
							></div>
						</div>

						<!-- Süre -->
						<div class="text-sm">
							{{ formatTime(currentTime) }} / {{ formatTime(duration) }}
						</div>
					</div>
				</div>
			</div>

			<!-- Zaman Çizelgesi -->
			<div class="bg-gray-800 rounded-lg p-4">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-lg font-semibold">Zaman Çizelgesi</h2>
					<div class="flex space-x-2">
						<button
							@click="exportVideo"
							class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
						>
							Dışa Aktar
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const videoPreview = ref<HTMLVideoElement | null>(null);
const videoCanvas = ref<HTMLCanvasElement | null>(null);
let videoPath: string | null = null;
let animationFrame: number | null = null;

const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const progress = ref(0);

// Video yükleme
onMounted(async () => {
	try {
		videoPath = await window.electron?.getTempVideoPath();
		console.log("Video yolu:", videoPath);

		if (videoPath && videoPreview.value && videoCanvas.value) {
			// Video dosyasını base64 olarak oku
			const base64Data = await window.electron?.readVideoFile(videoPath);
			if (base64Data) {
				const videoUrl = `data:video/webm;base64,${base64Data}`;
				videoPreview.value.src = videoUrl;

				// Video olaylarını dinle
				videoPreview.value.addEventListener("loadedmetadata", () => {
					duration.value = videoPreview.value?.duration || 0;
					updateCanvasSize();
				});

				videoPreview.value.addEventListener("timeupdate", () => {
					currentTime.value = videoPreview.value?.currentTime || 0;
					progress.value = (currentTime.value / duration.value) * 100;
				});

				videoPreview.value.addEventListener("ended", () => {
					isPlaying.value = false;
					cancelAnimationFrame(animationFrame!);
				});

				videoPreview.value.load();
			}
		}
	} catch (error) {
		console.error("Video yüklenirken hata oluştu:", error);
	}
});

// Canvas boyutunu güncelle
const updateCanvasSize = () => {
	if (!videoCanvas.value || !videoPreview.value) return;

	const canvas = videoCanvas.value;
	const container = canvas.parentElement;
	if (!container) return;

	// Container boyutlarını al
	const rect = container.getBoundingClientRect();

	// Canvas boyutlarını ayarla
	canvas.width = rect.width;
	canvas.height = rect.height;
};

// Video frame'ini canvas'a çiz
const drawFrame = () => {
	if (!videoCanvas.value || !videoPreview.value) return;

	const ctx = videoCanvas.value.getContext("2d");
	if (!ctx) return;

	ctx.drawImage(
		videoPreview.value,
		0,
		0,
		videoCanvas.value.width,
		videoCanvas.value.height
	);

	if (isPlaying.value) {
		animationFrame = requestAnimationFrame(drawFrame);
	}
};

// Oynatma kontrolü
const togglePlay = () => {
	if (!videoPreview.value) return;

	if (isPlaying.value) {
		videoPreview.value.pause();
		isPlaying.value = false;
		cancelAnimationFrame(animationFrame!);
	} else {
		videoPreview.value.play();
		isPlaying.value = true;
		drawFrame();
	}
};

// İlerleme çubuğunda tıklama
const seek = (event: MouseEvent) => {
	if (!videoPreview.value) return;

	const rect = (event.target as HTMLElement).getBoundingClientRect();
	const x = event.clientX - rect.left;
	const percentage = x / rect.width;

	videoPreview.value.currentTime = percentage * duration.value;
};

// Süre formatı
const formatTime = (seconds: number) => {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

// Dışa aktarma
const exportVideo = async () => {
	if (!videoPath) return;

	try {
		const timestamp = Date.now();
		const savePath = await window.electron?.showSaveDialog({
			defaultPath: `kayit-${timestamp}.webm`,
			filters: [{ name: "WebM Video", extensions: ["webm"] }],
		});

		if (savePath) {
			await window.electron?.copyFile(videoPath, savePath);
			alert("Video başarıyla dışa aktarıldı!");
		}
	} catch (error) {
		console.error("Video dışa aktarılırken hata oluştu:", error);
		alert("Video dışa aktarılırken bir hata oluştu. Lütfen tekrar deneyin.");
	}
};

// Temizlik
onUnmounted(() => {
	if (animationFrame !== null) {
		cancelAnimationFrame(animationFrame);
	}
});
</script>
