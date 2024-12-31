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
					@loadedmetadata="onVideoLoaded"
				>
					<source :src="videoUrl" type="video/mp4" />
				</video>
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

onMounted(() => {
	console.log("[editor.vue] Component mount edildi");

	// Event listener'ları ekle
	if (electron) {
		electron.ipcRenderer.on("START_EDITING", (videoData) => {
			console.log("[editor.vue] START_EDITING eventi alındı");
			startEditing(videoData);
		});
	}
});

onUnmounted(() => {
	// Event listener'ları temizle
	if (electron) {
		electron.ipcRenderer.removeAllListeners("START_EDITING");
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
