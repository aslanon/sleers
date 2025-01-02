<template>
	<div class="w-full flex flex-col bg-black text-white min-h-screen">
		<div
			class="w-full p-2 px-6 bg-black border-b border-gray-700 flex justify-between gap-2"
		>
			<div class="flex flex-row gap-2 items-center">
				<button
					class="px-4 py-1 bg-gray-600 hover:bg-gray-700 rounded-lg"
					@click="startNewRecording()"
				>
					Yeni Kayıt
				</button>
			</div>
			<!-- Butonlar -->
			<div class="flex flex-row gap-2 items-center">
				<button
					class="px-4 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg"
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
					:current-time="currentTime"
					@video-loaded="onVideoLoaded"
					@video-ended="onVideoEnded"
					@video-paused="isPlaying = false"
					@time-update="onTimeUpdate"
				/>

				<MediaPlayerControls
					:is-playing="isPlaying"
					:current-time="currentTime"
					:duration="videoDuration"
					:is-trim-mode="isTrimMode"
					:selected-ratio="selectedRatio"
					@toggle-playback="togglePlayback"
					@toggle-trim-mode="toggleTrimMode"
					@update:selected-ratio="onAspectRatioChange"
				/>
			</div>

			<MediaPlayerSettings
				:duration="videoDuration"
				:width="videoWidth"
				:height="videoHeight"
			/>
		</div>

		<TimelineComponent
			:duration="videoDuration"
			:current-time="currentTime"
			:segments="videoSegments"
			@time-update="onTimelineUpdate"
		/>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import MediaPlayer from "~/components/MediaPlayer.vue";
import MediaPlayerControls from "~/components/MediaPlayerControls.vue";
import MediaPlayerSettings from "~/components/MediaPlayerSettings.vue";
import TimelineComponent from "~/components/TimelineComponent.vue";

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
const currentTime = ref(0);
const isTrimMode = ref(false);
const selectedRatio = ref("");
const videoSegments = ref([
	{
		start: 0,
		end: 0,
	},
]);

// Kırpma ve pozisyon state'leri
const cropState = ref({
	position: { x: 0, y: 0 },
	scale: 1,
	cropArea: { x: 0, y: 0, width: 0, height: 0 },
	containerSize: { width: 0, height: 0 },
	videoSize: { width: 0, height: 0 },
	aspectRatio: "",
});

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
const onVideoLoaded = ({ duration, width, height }) => {
	console.log("[editor.vue] Video yüklendi:", { duration, width, height });
	videoDuration.value = duration;
	videoWidth.value = width;
	videoHeight.value = height;

	// İlk segment'i video süresine göre ayarla
	videoSegments.value = [
		{
			start: 0,
			end: duration,
			type: "video",
		},
	];

	console.log("[editor.vue] Segment oluşturuldu:", {
		segment: videoSegments.value[0],
		duration,
		startPosition: `${(0 / duration) * 100}%`,
		width: `${(duration / duration) * 100}%`,
	});

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
			// Kırpma bilgilerini hazırla
			const cropInfo = {
				x: Math.round(cropState.value.cropArea.x),
				y: Math.round(cropState.value.cropArea.y),
				width: Math.round(cropState.value.cropArea.width),
				height: Math.round(cropState.value.cropArea.height),
				scale: cropState.value.scale,
				position: cropState.value.position,
				aspectRatio: cropState.value.aspectRatio,
			};

			// Video blob'unu al
			const response = await fetch(videoUrl.value);
			const blob = await response.blob();
			const arrayBuffer = await blob.arrayBuffer();

			// Video ve kırpma bilgilerini main process'e gönder
			await electron?.ipcRenderer.invoke(
				"SAVE_VIDEO_FILE",
				arrayBuffer,
				filePath,
				cropInfo
			);
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

// Video zamanı güncellendiğinde (video'dan gelen)
const onTimeUpdate = (time) => {
	currentTime.value = time;
};

// Timeline'dan gelen zaman güncellemesi
const onTimelineUpdate = (time) => {
	currentTime.value = time;
	if (mediaPlayerRef.value?.videoRef?.value) {
		mediaPlayerRef.value.videoRef.value.currentTime = time;
	}
};

// Kesme modunu aç/kapa
const toggleTrimMode = () => {
	isTrimMode.value = !isTrimMode.value;
};

// Segment güncellemelerini işle
const onSegmentUpdate = ({ type, segments }) => {
	console.log(`[editor.vue] ${type} segmentleri güncellendi:`, segments);
	// Burada segmentleri işleyebilir ve videoyu/sesi buna göre düzenleyebilirsiniz
};

// Kırpma değişikliklerini işle
const onCropChange = (cropData) => {
	cropState.value = { ...cropData };
	console.log("[editor.vue] Kırpma durumu güncellendi:", cropState.value);
};

// Aspect ratio değişikliğini işle
const onAspectRatioChange = (ratio) => {
	if (mediaPlayerRef.value) {
		selectedRatio.value = ratio;
		mediaPlayerRef.value.updateAspectRatio(ratio);

		// Kırpma durumunu güncelle
		const cropData = mediaPlayerRef.value.getCropData();
		if (cropData) {
			onCropChange(cropData);
		}
	}
};

onMounted(() => {
	console.log("[editor.vue] Component mount edildi");

	// Video işleme durumunu kontrol et
	electron?.ipcRenderer
		.invoke("CHECK_PROCESSING_STATUS")
		.then((status) => {
			console.log("[editor.vue] Video işleme durumu:", status);

			if (status.isProcessing) {
				console.log("[editor.vue] Video işleniyor, tamamlanmasını bekliyoruz");

				// Video işleme tamamlandığında tetiklenecek event listener
				electron?.ipcRenderer.once("PROCESSING_COMPLETE", async (paths) => {
					console.log(
						"[editor.vue] Video işleme tamamlandı, medya yükleniyor:",
						paths
					);
					if (paths.videoPath) await loadMedia(paths.videoPath, "video");
					if (paths.audioPath) await loadMedia(paths.audioPath, "audio");
				});
			} else {
				// Video işleme tamamlanmışsa direkt path'leri al
				electron?.ipcRenderer.invoke("GET_MEDIA_PATHS").then(async (paths) => {
					console.log("[editor.vue] Media paths alındı:", paths);
					if (paths.videoPath) await loadMedia(paths.videoPath, "video");
					if (paths.audioPath) await loadMedia(paths.audioPath, "audio");
				});
			}
		})
		.catch((error) => {
			console.error(
				"[editor.vue] Video işleme durumu kontrol edilirken hata:",
				error
			);
		});

	// Diğer event listener'lar
	electron?.ipcRenderer.on("MEDIA_PATHS", async (paths) => {
		console.log("[editor.vue] MEDIA_PATHS eventi alındı:", paths);
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
		window.electron.ipcRenderer.removeAllListeners("PROCESSING_COMPLETE");
	}
});
</script>
