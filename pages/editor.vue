<template>
	<div class="w-full flex flex-col bg-black text-white min-h-screen">
		<div class="w-full p-4 px-6 bg-black flex justify-between gap-2">
			<div class="flex flex-row gap-2 items-center">
				<button
					class="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg"
					@click="startNewRecording()"
				>
					Yeni Kayıt
				</button>
			</div>
			<!-- Butonlar -->
			<div class="flex flex-row gap-2 items-center">
				<button
					class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
					@click="saveVideo()"
				>
					Kaydet
				</button>

				<!-- <button
					class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
					@click="discardChanges()"
				>
					Kapat
				</button> -->
			</div>
		</div>
		<!-- Ana İçerik -->
		<div class="w-full flex-1 flex">
			<div class="w-full p-4 flex-1 flex flex-col">
				<MediaPlayer
					ref="mediaPlayerRef"
					:video-url="videoUrl"
					:audio-url="audioUrl"
					:video-type="videoType"
					:audio-type="audioType"
					:is-playing="isPlaying"
					@video-loaded="onVideoLoaded"
					@video-ended="onVideoEnded"
					@video-paused="isPlaying = false"
				/>

				<MediaPlayerControls
					:is-playing="isPlaying"
					@toggle-playback="togglePlayback"
				/>
			</div>

			<MediaPlayerSettings
				:duration="videoDuration"
				:width="videoWidth"
				:height="videoHeight"
			/>
		</div>
		<div class="w-full h-[500px] bg-black">asd</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import MediaPlayer from "~/components/MediaPlayer.vue";
import MediaPlayerControls from "~/components/MediaPlayerControls.vue";
import MediaPlayerSettings from "~/components/MediaPlayerSettings.vue";

const electron = window.electron;
const mediaPlayerRef = ref(null);
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
		const base64Data = await electron?.ipcRenderer.invoke(
			"READ_VIDEO_FILE",
			filePath
		);
		if (!base64Data) {
			console.error(`[editor.vue] ${type} dosyası okunamadı`);
			return;
		}

		const extension = filePath.split(".").pop()?.toLowerCase();
		const mimeType =
			type === "video"
				? extension === "webm"
					? "video/webm"
					: "video/mp4"
				: extension === "webm"
				? "audio/webm"
				: "audio/mp4";

		const byteCharacters = atob(base64Data);
		const byteNumbers = new Array(byteCharacters.length);
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i);
		}
		const byteArray = new Uint8Array(byteNumbers);
		const blob = new Blob([byteArray], { type: mimeType });

		if (type === "video") {
			if (videoBlob.value) URL.revokeObjectURL(videoBlob.value);
			videoBlob.value = URL.createObjectURL(blob);
			videoUrl.value = videoBlob.value;
			videoType.value = mimeType;
		} else {
			if (audioBlob.value) URL.revokeObjectURL(audioBlob.value);
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
const togglePlayback = () => {
	isPlaying.value = !isPlaying.value;
};

// Video yüklendiğinde
const onVideoLoaded = (data) => {
	videoDuration.value = data.duration;
	videoWidth.value = data.width;
	videoHeight.value = data.height;

	electron?.ipcRenderer.send("EDITOR_STATUS_UPDATE", {
		status: "ready",
		duration: videoDuration.value,
		width: videoWidth.value,
		height: videoHeight.value,
	});
};

// Video bittiğinde
const onVideoEnded = () => {
	isPlaying.value = false;
};

// Video düzenleme başlatma
const startEditing = (videoData) => {
	console.log("[editor.vue] Düzenleme başlatılıyor:", videoData);
	videoUrl.value = videoData.url;
};

// Video kaydetme
const saveVideo = async () => {
	try {
		const filePath = await electron?.ipcRenderer.invoke("SHOW_SAVE_DIALOG", {
			title: "Videoyu Kaydet",
			defaultPath: `video_${Date.now()}.mp4`,
			filters: [{ name: "Video", extensions: ["mp4"] }],
		});

		if (filePath) {
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

// Yeni kayıt başlat
const startNewRecording = () => {
	if (confirm("Yeni kayıt başlatmak istediğinize emin misiniz?")) {
		electron?.ipcRenderer.send("RESET_FOR_NEW_RECORDING");
		closeWindow();
	}
};

onMounted(() => {
	console.log("[editor.vue] Component mount edildi");

	electron?.ipcRenderer.on("MEDIA_PATHS", async (paths) => {
		console.log("[editor.vue] Media paths alındı:", paths);
		if (paths.videoPath) await loadMedia(paths.videoPath, "video");
		if (paths.audioPath) await loadMedia(paths.audioPath, "audio");
	});

	electron?.ipcRenderer.on("START_EDITING", (videoData) => {
		console.log("[editor.vue] START_EDITING eventi alındı:", videoData);
		startEditing(videoData);
	});
});

onUnmounted(() => {
	if (videoBlob.value) URL.revokeObjectURL(videoBlob.value);
	if (audioBlob.value) URL.revokeObjectURL(audioBlob.value);

	if (window.electron) {
		window.electron.ipcRenderer.removeAllListeners("MEDIA_PATHS");
		window.electron.ipcRenderer.removeAllListeners("START_EDITING");
	}
});
</script>
