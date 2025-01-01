<template>
	<div class="editor-container bg-gray-900 text-white min-h-screen">
		<!-- Ana İçerik -->
		<div class="flex flex-1 p-4">
			<!-- Video Önizleme -->

			<div
				class="flex-1 w-full max-h-[500px] bg-black rounded-lg overflow-hidden"
			>
				<video
					ref="videoRef"
					class="w-full h-full"
					:src="videoUrl"
					:type="videoType"
					@loadedmetadata="onVideoLoaded"
				></video>
				<audio
					v-show="audioUrl"
					ref="audioRef"
					:src="audioUrl"
					:type="audioType"
				></audio>
			</div>
			<!-- Medya Kontrolleri -->
			<div class="mt-4 flex justify-center items-center space-x-4">
				<button
					@click="togglePlayback"
					class="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center"
				>
					<span v-if="isPlaying">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</span>
					<span v-else>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</span>
					<span class="ml-2">{{ isPlaying ? "Durdur" : "Oynat" }}</span>
				</button>
			</div>
			<!-- Kontrol Paneli -->
			<div class="w-80 ml-4 bg-gray-800 rounded-lg p-4">
				<h2 class="text-xl font-bold mb-4">Video Ayarları</h2>

				<!-- Video Bilgileri -->
				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium mb-1">Video Süresi</label>
						<span class="text-gray-300">{{
							formatDuration(videoDuration)
						}}</span>
					</div>

					<div>
						<label class="block text-sm font-medium mb-1">Boyut</label>
						<span class="text-gray-300"
							>{{ videoWidth }}x{{ videoHeight }}</span
						>
					</div>

					<!-- Butonlar -->
					<div class="flex flex-col space-y-2 mt-4">
						<button
							class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
							@click="saveVideo"
						>
							Kaydet
						</button>
						<button
							class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
							@click="startNewRecording"
						>
							Yeni Kayıt
						</button>
						<button
							class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
							@click="discardChanges"
						>
							İptal
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const electron = window.electron;
const videoRef = ref(null);
const audioRef = ref(null);
const videoUrl = ref("");
const audioUrl = ref("");
const videoDuration = ref(0);
const videoWidth = ref(0);
const videoHeight = ref(0);
const videoType = ref("video/mp4");
const audioType = ref("audio/webm");
const videoBlob = ref(null);
const audioBlob = ref(null);
const isPlaying = ref(false);

// Video ve ses dosyalarını yükle
const loadMedia = async (filePath, type = "video") => {
	try {
		// Dosya içeriğini base64 olarak al
		const base64Data = await electron?.ipcRenderer.invoke(
			"READ_VIDEO_FILE",
			filePath
		);
		if (!base64Data) {
			console.error(`[editor.vue] ${type} dosyası okunamadı`);
			return;
		}

		// Dosya uzantısına göre MIME type belirle
		const extension = filePath.split(".").pop()?.toLowerCase();
		const mimeType =
			type === "video"
				? extension === "webm"
					? "video/webm"
					: "video/mp4"
				: extension === "webm"
				? "audio/webm"
				: "audio/mp4";

		// Base64'ü Blob'a çevir
		const byteCharacters = atob(base64Data);
		const byteNumbers = new Array(byteCharacters.length);
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i);
		}
		const byteArray = new Uint8Array(byteNumbers);
		const blob = new Blob([byteArray], { type: mimeType });

		// Blob URL oluştur
		if (type === "video") {
			if (videoBlob.value) {
				URL.revokeObjectURL(videoBlob.value);
			}
			videoBlob.value = URL.createObjectURL(blob);
			videoUrl.value = videoBlob.value;
			videoType.value = mimeType;
		} else {
			if (audioBlob.value) {
				URL.revokeObjectURL(audioBlob.value);
			}
			audioBlob.value = URL.createObjectURL(blob);
			audioUrl.value = audioBlob.value;
			audioType.value = mimeType;
		}

		console.log(`[editor.vue] ${type} yüklendi:`, {
			url: type === "video" ? videoUrl.value : audioUrl.value,
			type: type === "video" ? videoType.value : audioType.value,
			size: blob.size,
		});
	} catch (error) {
		console.error(`[editor.vue] ${type} yükleme hatası:`, error);
	}
};

// Oynatma/durdurma kontrolü
const togglePlayback = async () => {
	try {
		const video = videoRef.value;
		const audio = audioRef.value;

		if (!video) return;

		if (isPlaying.value) {
			// Durdur
			video.pause();
			if (audio) audio.pause();
		} else {
			// Oynat
			await video.play();
			if (audio) {
				await audio.play();
				// Ses ve videoyu senkronize et
				audio.currentTime = video.currentTime;
			}
		}
		isPlaying.value = !isPlaying.value;
	} catch (error) {
		console.error("Medya oynatma hatası:", error);
	}
};

// Video durduğunda veya bittiğinde
const onVideoEnded = () => {
	isPlaying.value = false;
	const audio = audioRef.value;
	if (audio) audio.pause();
};

// Component mount olduğunda
onMounted(() => {
	console.log("[editor.vue] Component mount edildi");

	const video = videoRef.value;
	if (video) {
		video.addEventListener("ended", onVideoEnded);
		video.addEventListener("pause", () => {
			isPlaying.value = false;
		});
	}

	// Media paths için listener
	electron?.ipcRenderer.on("MEDIA_PATHS", async (paths) => {
		console.log("[editor.vue] Media paths alındı:", paths);
		if (paths.videoPath) {
			await loadMedia(paths.videoPath, "video");
		}
		if (paths.audioPath) {
			await loadMedia(paths.audioPath, "audio");
		}
	});

	// Start editing için listener
	electron?.ipcRenderer.on("START_EDITING", (videoData) => {
		console.log("[editor.vue] START_EDITING eventi alındı:", videoData);
		startEditing(videoData);
	});
});

// Video yüklendiğinde
const onVideoLoaded = () => {
	if (videoRef.value) {
		videoDuration.value = videoRef.value.duration;
		videoWidth.value = videoRef.value.videoWidth;
		videoHeight.value = videoRef.value.videoHeight;

		// Editor durumunu ana pencereye bildir
		electron?.ipcRenderer.send("EDITOR_STATUS_UPDATE", {
			status: "ready",
			duration: videoDuration.value,
			width: videoWidth.value,
			height: videoHeight.value,
		});
	}
};

// Video düzenleme başlatma eventi
const startEditing = (videoData) => {
	console.log("[editor.vue] Düzenleme başlatılıyor:", videoData);
	videoUrl.value = videoData.url;
};

// Video kaydetme
const saveVideo = async () => {
	try {
		// Kaydetme dialogunu aç
		const filePath = await electron?.ipcRenderer.invoke("SHOW_SAVE_DIALOG", {
			title: "Videoyu Kaydet",
			defaultPath: `video_${Date.now()}.mp4`,
			filters: [{ name: "Video", extensions: ["mp4"] }],
		});

		if (filePath) {
			// Video dosyasını kopyala
			await electron?.ipcRenderer.invoke("COPY_FILE", videoUrl.value, filePath);
			console.log("[editor.vue] Video kaydedildi:", filePath);
		}
	} catch (error) {
		console.error("[editor.vue] Video kaydedilirken hata:", error);
	}
};

// Değişiklikleri iptal et
const discardChanges = () => {
	if (confirm("Değişiklikleri iptal etmek istediğinize emin misiniz?")) {
		closeWindow();
	}
};

// Pencereyi kapat
const closeWindow = () => {
	electron?.ipcRenderer.send("CLOSE_EDITOR_WINDOW");
};

// Süre formatı
const formatDuration = (seconds) => {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

// Yeni kayıt başlat
const startNewRecording = () => {
	if (confirm("Yeni kayıt başlatmak istediğinize emin misiniz?")) {
		// Ana pencereye yeni kayıt sinyali gönder
		electron?.ipcRenderer.send("RESET_FOR_NEW_RECORDING");
		// Editor penceresini kapat
		closeWindow();
	}
};

// Component unmount olduğunda Blob URL'lerini temizle
onUnmounted(() => {
	const video = videoRef.value;
	if (video) {
		video.removeEventListener("ended", onVideoEnded);
	}

	if (videoBlob.value) {
		URL.revokeObjectURL(videoBlob.value);
	}
	if (audioBlob.value) {
		URL.revokeObjectURL(audioBlob.value);
	}
	// Event listener'ları temizle
	if (window.electron) {
		window.electron.ipcRenderer.removeAllListeners("MEDIA_PATHS");
		window.electron.ipcRenderer.removeAllListeners("START_EDITING");
	}
});
</script>

<style scoped>
.editor-container {
	display: flex;
	flex-direction: column;
	height: 100vh;
}
</style>
