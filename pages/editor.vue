<template>
	<div class="editor-container bg-gray-900 text-white min-h-screen">
		<!-- Ana İçerik -->
		<div class="flex flex-1 p-4">
			<!-- Video Önizleme -->
			<div class="flex-1 bg-black rounded-lg overflow-hidden">
				<video
					ref="videoRef"
					class="w-full h-full"
					controls
					:src="videoUrl"
					:type="videoType"
					@loadedmetadata="onVideoLoaded"
				></video>
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
const videoUrl = ref("");
const videoDuration = ref(0);
const videoWidth = ref(0);
const videoHeight = ref(0);
const videoType = ref("video/mp4");
const videoBlob = ref(null);

// Video URL'sini güvenli hale getir
const sanitizeVideoUrl = (url) => {
	if (!url) return "";
	// URL'yi düzgün formata çevir
	if (!url.startsWith("file://")) {
		return `file://${url}`;
	}
	return url;
};

// Video URL'sini güvenli hale getir
const loadVideo = async (filePath) => {
	try {
		// Dosya içeriğini base64 olarak al
		const base64Data = await electron?.ipcRenderer.invoke(
			"READ_VIDEO_FILE",
			filePath
		);
		if (!base64Data) {
			console.error("[editor.vue] Video dosyası okunamadı");
			return;
		}

		// Dosya uzantısına göre MIME type belirle
		const extension = filePath.split(".").pop()?.toLowerCase();
		const mimeType = extension === "webm" ? "video/webm" : "video/mp4";

		// Base64'ü Blob'a çevir
		const byteCharacters = atob(base64Data);
		const byteNumbers = new Array(byteCharacters.length);
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i);
		}
		const byteArray = new Uint8Array(byteNumbers);
		const blob = new Blob([byteArray], { type: mimeType });

		// Blob URL oluştur
		if (videoBlob.value) {
			URL.revokeObjectURL(videoBlob.value);
		}
		videoBlob.value = URL.createObjectURL(blob);
		videoUrl.value = videoBlob.value;
		videoType.value = mimeType;

		console.log("[editor.vue] Video yüklendi:", {
			url: videoUrl.value,
			type: videoType.value,
			size: blob.size,
		});
	} catch (error) {
		console.error("[editor.vue] Video yükleme hatası:", error);
	}
};

// IPC mesajını dinle
onMounted(() => {
	console.log("[editor.vue] Component mount edildi");

	// Media paths için listener
	electron?.ipcRenderer.on("MEDIA_PATHS", async (paths) => {
		console.log("[editor.vue] Media paths alındı:", paths);
		if (paths.videoPath) {
			await loadVideo(paths.videoPath);
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
	if (videoBlob.value) {
		URL.revokeObjectURL(videoBlob.value);
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
