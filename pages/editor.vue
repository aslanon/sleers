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
					:is-muted="isMuted"
					:segments="segments"
					@video-loaded="onVideoLoaded"
					@video-ended="onVideoEnded"
					@video-paused="isPlaying = false"
					@timeUpdate="onTimeUpdate"
					@mute-change="isMuted = $event"
				/>

				<MediaPlayerControls
					:is-playing="isPlaying"
					:current-time="currentTime"
					:duration="videoDuration"
					:is-trim-mode="isTrimMode"
					:selected-ratio="selectedRatio"
					:is-muted="isMuted"
					:is-split-mode="isSplitMode"
					@toggle-playback="togglePlayback"
					@toggle-trim-mode="toggleTrimMode"
					@update:selected-ratio="onAspectRatioChange"
					@toggle-mute="toggleMute"
					@toggle-split-mode="toggleSplitMode"
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
			:segments="segments"
			:is-split-mode="isSplitMode"
			@timeUpdate="handleTimeUpdate"
			@segmentsReordered="handleSegmentsReordered"
			@splitSegment="handleSegmentSplit"
			ref="timelineRef"
		/>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue";
import MediaPlayer from "~/components/MediaPlayer.vue";
import MediaPlayerControls from "~/components/MediaPlayerControls.vue";
import MediaPlayerSettings from "~/components/MediaPlayerSettings.vue";
import TimelineComponent from "~/components/TimelineComponent.vue";

// Yardımcı fonksiyonlar
const generateId = () => {
	return "id-" + Math.random().toString(36).substr(2, 9);
};

const electron = window.electron;
const mediaPlayerRef = ref(null);
const videoUrl = ref("");
const audioUrl = ref("");
const videoDuration = ref(0);
const currentTime = ref(0);
const currentVideoTime = ref(0);
const videoType = ref("video/mp4");
const audioType = ref("audio/webm");
const videoBlob = ref(null);
const audioBlob = ref(null);
const isPlaying = ref(false);
const isTrimMode = ref(false);
const selectedRatio = ref("");
const selectedArea = ref(null);
const isMuted = ref(false);
const isSplitMode = ref(false);

// Video boyutları
const videoSize = ref({
	width: 1920,
	height: 1080,
});

// Video boyutları için computed değerler
const videoWidth = computed(() => videoSize.value?.width || 1920);
const videoHeight = computed(() => videoSize.value?.height || 1080);

// Segment state'i
const segments = ref([
	{
		id: generateId(),
		startTime: 0,
		endTime: 0,
		startPosition: "0%",
		width: "100%",
		type: "video",
		layer: 0,
		selected: false,
		locked: false,
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
const onVideoLoaded = (data) => {
	try {
		console.log("[editor.vue] Video yüklendi, gelen data:", data);

		// Video bilgilerini kaydet
		if (data && typeof data.duration === "number") {
			videoDuration.value = Math.max(0, data.duration);
			videoSize.value = {
				width: data.width || 1920,
				height: data.height || 1080,
			};

			// Mevcut segment'i güncelle
			if (segments.value.length > 0) {
				segments.value[0] = {
					...segments.value[0],
					startTime: 0,
					endTime: videoDuration.value,
					start: 0,
					end: videoDuration.value,
				};

				console.log("[editor.vue] Segment güncellendi:", {
					duration: videoDuration.value,
					segment: segments.value[0],
				});

				// Segment pozisyonlarını güncelle
				updateSegments();
			}
		} else {
			console.warn("[editor.vue] Video süresi geçersiz:", data);
		}
	} catch (error) {
		console.error("[editor.vue] Video yükleme hatası:", error);
	}
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
			// Debug: selectedArea değerini kontrol et
			console.log("[editor.vue] Mevcut selectedArea:", selectedArea.value);

			// Kırpma bilgilerini basitleştirilmiş formatta hazırla
			let cropInfo = null;

			if (selectedArea.value) {
				cropInfo = {
					x: parseInt(selectedArea.value.x) || 0,
					y: parseInt(selectedArea.value.y) || 0,
					width: parseInt(selectedArea.value.width) || videoWidth.value,
					height: parseInt(selectedArea.value.height) || videoHeight.value,
					scale: 1,
				};
			} else {
				// Main process'ten kırpma bilgisini al
				try {
					cropInfo = await electron?.ipcRenderer.invoke("GET_CROP_INFO");
				} catch (err) {
					console.warn("[editor.vue] Kırpma bilgisi alınamadı:", err);
				}
			}

			console.log("[editor.vue] Hazırlanan kırpma bilgileri:", cropInfo);

			// Video blob'unu al
			const response = await fetch(videoUrl.value);
			const blob = await response.blob();
			const arrayBuffer = await blob.arrayBuffer();

			// Ses blob'unu al
			let audioArrayBuffer = null;
			if (audioUrl.value && !isMuted.value) {
				// Ses açıksa ve ses dosyası varsa
				const audioResponse = await fetch(audioUrl.value);
				const audioBlob = await audioResponse.blob();
				audioArrayBuffer = await audioBlob.arrayBuffer();
			}

			console.log(
				"[editor.vue] Video ve ses verisi hazırlandı, kaydetme başlıyor...",
				{
					hasAudio: !!audioArrayBuffer,
					isMuted: isMuted.value,
				}
			);

			// Video, ses ve kırpma bilgilerini main process'e gönder
			const result = await electron?.ipcRenderer.invoke(
				"SAVE_VIDEO_FILE",
				arrayBuffer,
				filePath,
				cropInfo,
				audioArrayBuffer
			);

			console.log("[editor.vue] Video kaydedildi, sonuç:", result);
			console.log("[editor.vue] Video başarıyla kaydedildi:", filePath);
		}
	} catch (error) {
		console.error("[editor.vue] Video kaydedilirken hata:", error);
		console.error("[editor.vue] Hata detayları:", {
			message: error.message,
			stack: error.stack,
		});
		alert("Videoyu kaydederken bir hata oluştu: " + error.message);
	}
};

// Değişiklikleri iptal et
const discardChanges = () => {
	if (confirm("Değişiklikleri iptal etmek istediğinize emin misiniz ?")) {
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

// Video zamanı güncellendiğinde
const onTimeUpdate = (time) => {
	if (!isNaN(time)) {
		currentTime.value = time;
		currentVideoTime.value = time;
	}
};

// Timeline'dan gelen zaman güncellemesi
const handleTimeUpdate = (time) => {
	if (!isNaN(time)) {
		currentTime.value = time;
		if (mediaPlayerRef.value) {
			mediaPlayerRef.value.seek(time);
		}
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
const onCropChange = (cropArea) => {
	try {
		if (!cropArea) {
			selectedArea.value = null;
			// Seçilen alanı sıfırla
			window.electron.ipcRenderer.send("UPDATE_SELECTED_AREA", null);
			console.log("[editor.vue] Kırpma alanı sıfırlandı");
			return;
		}

		// cropArea'dan sadece gerekli değerleri al ve yeni bir obje oluştur
		const safeArea = {
			x: typeof cropArea.x === "number" ? Math.round(cropArea.x) : 0,
			y: typeof cropArea.y === "number" ? Math.round(cropArea.y) : 0,
			width:
				typeof cropArea.width === "number"
					? Math.round(cropArea.width)
					: videoWidth.value,
			height:
				typeof cropArea.height === "number"
					? Math.round(cropArea.height)
					: videoHeight.value,
			devicePixelRatio: window.devicePixelRatio || 1,
		};

		// Değerlerin geçerliliğini kontrol et
		if (safeArea.width <= 0 || safeArea.height <= 0) {
			console.warn("[editor.vue] Geçersiz kırpma boyutları:", safeArea);
			return;
		}

		// Video boyutlarını aşmadığından emin ol
		safeArea.width = Math.min(safeArea.width, videoWidth.value);
		safeArea.height = Math.min(safeArea.height, videoHeight.value);
		safeArea.x = Math.min(
			Math.max(0, safeArea.x),
			videoWidth.value - safeArea.width
		);
		safeArea.y = Math.min(
			Math.max(0, safeArea.y),
			videoHeight.value - safeArea.height
		);

		console.log("[editor.vue] Kırpma alanı hazırlandı:", safeArea);

		// State'i güncelle
		selectedArea.value = safeArea;

		// Main process'e gönder
		window.electron.ipcRenderer.send("UPDATE_SELECTED_AREA", safeArea);
		console.log("[editor.vue] Kırpma alanı main process'e gönderildi");
	} catch (error) {
		console.error("[editor.vue] Kırpma alanı güncellenirken hata:", error);
	}
};

// Aspect ratio değişikliğini işle
const onAspectRatioChange = (ratio) => {
	try {
		if (mediaPlayerRef.value) {
			selectedRatio.value = ratio;
			mediaPlayerRef.value.updateAspectRatio(ratio);

			// Kırpma durumunu güncelle
			const cropData = mediaPlayerRef.value.getCropData();
			if (cropData) {
				console.log(
					"[editor.vue] Yeni aspect ratio için kırpma verisi:",
					cropData
				);
				onCropChange(cropData);
			}
		}
	} catch (error) {
		console.error("[editor.vue] Aspect ratio güncellenirken hata:", error);
	}
};

// Timeline segment'lerini güncelle
const updateSegments = () => {
	if (!segments.value?.length) return;

	segments.value = segments.value.map((segment) => {
		const start = segment.start || segment.startTime || 0;
		const end = segment.end || segment.endTime || videoDuration.value;
		const duration = videoDuration.value || 1;

		return {
			...segment,
			start,
			end,
			startTime: start,
			endTime: end,
			startPosition: `${(start / duration) * 100}%`,
			width: `${((end - start) / duration) * 100}%`,
		};
	});
};

// Ses kontrolü
const toggleMute = () => {
	isMuted.value = !isMuted.value;
};

// Segment bölme işlemi
const handleSegmentSplit = ({ index, segments: newSegments, splitTime }) => {
	// Orijinal segmenti kaldır ve yerine yeni segmentleri ekle
	const updatedSegments = [...segments.value];
	updatedSegments.splice(index, 1, ...newSegments);
	segments.value = updatedSegments;

	// Timeline'ı güncelle
	updateSegments();
};

// Toggle split mode
const toggleSplitMode = () => {
	isSplitMode.value = !isSplitMode.value;
};

// Segment yönetimi
const handleSegmentsReordered = (newSegments) => {
	segments.value = newSegments;
};

// Video URL'lerini computed olarak yönet
const videoSrc = computed(() => videoUrl.value || "");

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
