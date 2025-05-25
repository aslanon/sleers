<template>
	<div
		class="w-full !select-none grid grid-cols-1 grid-rows-[auto_1fr_400px] bg-black text-white h-screen overflow-hidden"
	>
		<div
			class="editor-header w-full p-3 px-6 pl-24 bg-black border-b border-gray-700 flex justify-between gap-2 flex-shrink-0"
			:class="{ 'cursor-grab': !isDragging, 'cursor-grabbing': isDragging }"
			@mousedown="startDrag"
		>
			<button
				class="btn-new-record flex flex-row gap-2 items-center"
				@click="startNewRecording()"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				Yeni Kayıt
			</button>

			<div class="flex flex-row gap-2 items-center">
				<ProjectManager
					:media-player="mediaPlayerRef"
					:video-url="videoUrl"
					:audio-url="audioUrl"
					:camera-url="cameraUrl"
					:segments="segments"
					:mouse-positions="mousePositions"
					@update:video-url="videoUrl = $event"
					@update:audio-url="audioUrl = $event"
					@update:camera-url="cameraUrl = $event"
					@update:segments="segments = $event"
					@update:mouse-positions="mousePositions = $event"
					@project-loaded="onProjectLoaded"
				/>
			</div>

			<!-- Butonlar -->
			<div class="flex flex-row gap-2 items-center">
				<LayoutManager :media-player="mediaPlayerRef" />
				<button
					class="btn-export bg-[#432af4] rounded-lg p-2 py-1 flex flex-row gap-2 items-center"
					@click="showExportModal = true"
				>
					<svg
						class="h-5 w-5"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M19.5 14.25V11.625C19.5 9.76104 17.989 8.25 16.125 8.25H14.625C14.0037 8.25 13.5 7.74632 13.5 7.125V5.625C13.5 3.76104 11.989 2.25 10.125 2.25H8.25M9 14.25L12 17.25M12 17.25L15 14.25M12 17.25L12 11.25M10.5 2.25H5.625C5.00368 2.25 4.5 2.75368 4.5 3.375V20.625C4.5 21.2463 5.00368 21.75 5.625 21.75H18.375C18.9963 21.75 19.5 21.2463 19.5 20.625V11.25C19.5 6.27944 15.4706 2.25 10.5 2.25Z"
							stroke="white"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>

					Export
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
		<div class="w-full flex flex-1 h-full">
			<div class="flex-shrink-0 w-[500px] max-w-[500px] h-full flex flex-col">
				<div class="flex-1 relative">
					<MediaPlayerSettings
						:duration="videoDuration"
						:width="videoWidth"
						:height="videoHeight"
						v-model="mouseSize"
						:media-player="mediaPlayerRef"
						class="relative"
					/>
				</div>
			</div>
			<div class="w-full p-4 flex-1 flex flex-col">
				<div
					class="flex-1 w-full h-full relative min-h-0 m-auto"
					style="min-width: 800px; min-height: 500px"
				>
					<MediaPlayer
						ref="mediaPlayerRef"
						:video-url="videoUrl"
						:audio-url="audioUrl"
						:camera-url="cameraUrl"
						:video-type="videoType"
						:audio-type="audioType"
						:camera-type="cameraType"
						:is-playing="isPlaying"
						:current-time="currentTime"
						:preview-time="previewTime"
						:is-muted="isMuted"
						:segments="segments"
						:mouse-positions="mousePositions"
						:mouse-size="mouseSize"
						:is-crop-mode="isCropMode"
						@video-loaded="onVideoLoaded"
						@video-ended="onVideoEnded"
						@video-paused="isPlaying = false"
						@timeUpdate="onTimeUpdate"
						@mute-change="isMuted = $event"
						@update:isCropMode="isCropMode = $event"
						class="inset-0 h-full"
					/>
				</div>
				<MediaPlayerControls
					:is-playing="isPlaying"
					:current-time="currentTime"
					:preview-time="previewTime"
					:duration="videoDuration"
					:is-trim-mode="isTrimMode"
					:selected-ratio="selectedRatio"
					:is-muted="isMuted"
					:is-split-mode="isSplitMode"
					:is-crop-mode="isCropMode"
					@toggle-playback="togglePlayback"
					@toggle-trim-mode="toggleTrimMode"
					@update:selected-ratio="onAspectRatioChange"
					@toggle-mute="toggleMute"
					@toggle-split-mode="toggleSplitMode"
					@update:isCropMode="isCropMode = $event"
					@captureScreenshot="handleCaptureScreenshot"
					class="mt-4"
				/>
			</div>
		</div>

		<TimelineComponent
			:duration="videoDuration"
			:current-time="currentTime"
			:segments="segments"
			:is-split-mode="isSplitMode"
			@timeUpdate="handleTimeUpdate"
			@previewTimeUpdate="handlePreviewTimeUpdate"
			@segmentsReordered="handleSegmentsReordered"
			@splitSegment="handleSegmentSplit"
			ref="timelineRef"
		/>

		<!-- Export Modal -->
		<ExportModal
			:is-open="showExportModal"
			@close="showExportModal = false"
			@export="handleExport"
		/>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import MediaPlayer from "~/components/MediaPlayer.vue";
import MediaPlayerControls from "~/components/MediaPlayerControls.vue";
import MediaPlayerSettings from "~/components/MediaPlayerSettings.vue";
import TimelineComponent from "~/components/TimelineComponent.vue";
import LayoutManager from "~/components/ui/LayoutManager.vue";
import ProjectManager from "~/components/ui/ProjectManager.vue";
import ExportModal from "~/components/ui/ExportModal.vue";
import ExportService from "~/services/ExportService";

const { updateCameraSettings } = usePlayerSettings();

// IPC event isimlerini al
const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS || {};

// Yardımcı fonksiyonlar
const generateId = () => {
	return "id-" + Math.random().toString(36).substr(2, 9);
};

const electron = window.electron;
const mediaPlayerRef = ref(null);
const videoUrl = ref("");
const audioUrl = ref("");
const cameraUrl = ref("");
const videoDuration = ref(0);
const currentTime = ref(0);
const currentVideoTime = ref(0);
const videoType = ref("video/mp4");
const audioType = ref("audio/webm");
const cameraType = ref("video/webm");
const videoBlob = ref(null);
const audioBlob = ref(null);
const cameraBlob = ref(null);
const isPlaying = ref(false);
const isTrimMode = ref(false);
const selectedRatio = ref("");
const selectedArea = ref(null);
const isMuted = ref(false);
const isSplitMode = ref(false);
const isCropMode = ref(false);
const showExportModal = ref(false);

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
		console.log(`[editor.vue] ${type} yükleniyor:`, filePath);

		const base64Data = await electron?.ipcRenderer.invoke(
			IPC_EVENTS.READ_VIDEO_FILE,
			filePath
		);

		if (!base64Data) {
			console.error(`[editor.vue] ${type} dosyası okunamadı:`, filePath);
			throw new Error(`${type} dosyası okunamadı`);
		}

		const extension = filePath.split(".").pop()?.toLowerCase();
		const mimeType =
			type === "video"
				? extension === "webm"
					? "video/webm"
					: "video/mp4"
				: type === "camera"
				? "video/webm"
				: extension === "webm"
				? "audio/webm"
				: "audio/mp4";

		console.log(`[editor.vue] ${type} MIME type:`, mimeType);

		const byteCharacters = atob(base64Data);
		const byteNumbers = new Array(byteCharacters.length);
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i);
		}
		const byteArray = new Uint8Array(byteNumbers);
		const blob = new Blob([byteArray], { type: mimeType });

		console.log(`[editor.vue] ${type} blob created, size:`, blob.size);

		if (type === "video") {
			if (videoBlob.value) URL.revokeObjectURL(videoBlob.value);
			videoBlob.value = URL.createObjectURL(blob);
			videoUrl.value = videoBlob.value;
			videoType.value = mimeType;
		} else if (type === "camera") {
			if (cameraBlob.value) URL.revokeObjectURL(cameraBlob.value);
			cameraBlob.value = URL.createObjectURL(blob);
			cameraUrl.value = cameraBlob.value;
			cameraType.value = mimeType;
		} else {
			if (audioBlob.value) URL.revokeObjectURL(audioBlob.value);
			audioBlob.value = URL.createObjectURL(blob);
			audioUrl.value = audioBlob.value;
			audioType.value = mimeType;
		}

		console.log(`[editor.vue] ${type} yüklendi:`, {
			url:
				type === "video"
					? videoUrl.value
					: type === "camera"
					? cameraUrl.value
					: audioUrl.value,
			type:
				type === "video"
					? videoType.value
					: type === "camera"
					? cameraType.value
					: audioType.value,
			size: blob.size,
			mimeType,
		});
	} catch (error) {
		console.error(`[editor.vue] ${type} yükleme hatası:`, error);
		electron?.ipcRenderer.send(IPC_EVENTS.EDITOR_LOAD_ERROR, error.message);
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

			// İlk segment'i oluştur veya güncelle
			if (segments.value.length === 0) {
				segments.value = [
					{
						id: generateId(),
						startTime: 0,
						endTime: videoDuration.value,
						start: 0,
						end: videoDuration.value,
						startPosition: "0%",
						width: "100%",
						type: "video",
						layer: 0,
						selected: false,
						locked: false,
					},
				];
			} else {
				segments.value[0] = {
					...segments.value[0],
					startTime: 0,
					endTime: videoDuration.value,
					start: 0,
					end: videoDuration.value,
				};
			}

			console.log("[editor.vue] Segment güncellendi:", {
				duration: videoDuration.value,
				segment: segments.value[0],
			});

			// Segment pozisyonlarını güncelle
			updateSegments();
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
const handleExport = async (settings) => {
	try {
		console.log("[editor.vue] Export başlatılıyor, ayarlar:", settings);

		// Directory ve filename kontrolü
		if (!settings.directory) {
			throw new Error("Kayıt dizini belirtilmemiş. Lütfen bir dizin seçin.");
		}

		// Ensure filename has correct extension and is sanitized for filesystem
		let filename = settings.filename;

		// Sanitize filename - remove characters that could be interpreted as path separators
		filename = filename.replace(/[/\\:*?"<>|]/g, "-");

		// Make sure it has the correct extension
		if (!filename.endsWith(`.${settings.format}`)) {
			filename = `${filename}.${settings.format}`;
		}

		// Dosya yolunu oluştur
		const filePath = `${settings.directory}/${filename}`;
		console.log("[editor.vue] Export dosya yolu:", filePath);

		// Kayıt durumu mesajı göster
		const loadingMessage = document.createElement("div");
		loadingMessage.className =
			"fixed inset-0 flex items-center flex-col text-center justify-center bg-black bg-opacity-70 z-50";
		loadingMessage.innerHTML = `
            <div class="bg-[#1a1a1a] p-8 rounded-xl shadow-3xl text-white max-w-md">
                <p class="text-xl font-bold mb-2">Video Kaydediliyor</p>
                <p class="text-gray-300 mb-4">Lütfen bekleyin, bu işlem birkaç dakika sürebilir.</p>
                <div class="w-full bg-gray-700 rounded-full h-3 mb-1">
                    <div id="export-progress-bar" class="bg-[#432af4] h-3 rounded-full" style="width: 0%"></div>
                </div>
                <p id="export-progress-text" class="text-sm text-gray-400">%0</p>
            </div>
        `;
		document.body.appendChild(loadingMessage);

		const progressBar = document.getElementById("export-progress-bar");
		const progressText = document.getElementById("export-progress-text");

		// Playback'i durdur
		if (mediaPlayerRef.value) {
			await mediaPlayerRef.value.pause();
		}

		// Progress update handler
		const onProgress = (progress) => {
			if (progressBar && progressText) {
				const percent = Math.round(progress);
				progressBar.style.width = `${percent}%`;
				progressText.textContent = `%${percent}`;
				console.log(`[editor.vue] Export ilerleme: %${percent}`);
			}
		};

		// Completion handler
		const onComplete = async (exportData) => {
			try {
				console.log("[editor.vue] Export tamamlandı, verileri kaydediliyor...");

				// Electron'a gönder ve dosyaya kaydet
				const saveResult = await electron?.ipcRenderer.invoke(
					exportData.format === "mp4"
						? IPC_EVENTS.SAVE_VIDEO
						: IPC_EVENTS.SAVE_GIF,
					exportData.data,
					filePath
				);

				// Loading mesajını kaldır
				if (loadingMessage.parentNode) {
					document.body.removeChild(loadingMessage);
				}

				if (saveResult?.success) {
					alert(`Video başarıyla kaydedildi: ${filePath}`);
					console.log("[editor.vue] Video başarıyla kaydedildi:", filePath);

					// Dosyayı Finder/Explorer'da göster
					electron?.ipcRenderer.send(IPC_EVENTS.SHOW_FILE_IN_FOLDER, filePath);
				} else {
					throw new Error(saveResult?.error || "Video kaydedilemedi.");
				}
			} catch (error) {
				console.error("[editor.vue] Kayıt tamamlama hatası:", error);
				alert(`Video kaydedilirken hata oluştu: ${error.message}`);

				// Loading mesajını kaldır
				if (loadingMessage.parentNode) {
					document.body.removeChild(loadingMessage);
				}
			}
		};

		// Error handler
		const onError = (error) => {
			console.error("[editor.vue] Video kayıt hatası:", error);
			alert(`Video kaydedilirken hata oluştu: ${error.message}`);

			// Loading mesajını kaldır
			if (loadingMessage.parentNode) {
				document.body.removeChild(loadingMessage);
			}
		};

		try {
			console.log("[editor.vue] ExportService ile export başlatılıyor...");

			// Export service'i kullanarak export işlemini başlat
			ExportService.exportVideo(
				mediaPlayerRef.value,
				settings,
				onProgress,
				onComplete,
				onError
			);
		} catch (exportError) {
			console.error("[editor.vue] Export başlatma hatası:", exportError);
			onError(exportError);
		}
	} catch (error) {
		console.error("[editor.vue] Export işlemi hatası:", error);
		alert(`Export işlemi başlatılırken hata oluştu: ${error.message}`);
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

	let currentTime = 0;
	segments.value = segments.value.map((segment, index) => {
		// Her segmentin başlangıç ve bitiş zamanlarını hesapla
		const start = segment.start || segment.startTime || currentTime;
		const duration = segment.duration || segment.end - segment.start;
		const end = start + duration;

		// Segment pozisyonlarını hesapla
		const startPosition = `${(start / videoDuration.value) * 100}%`;
		const width = `${(duration / videoDuration.value) * 100}%`;

		// Bir sonraki segment için başlangıç zamanını güncelle
		currentTime = end;

		return {
			...segment,
			id: segment.id || generateId(),
			start,
			end,
			startTime: start,
			endTime: end,
			duration,
			startPosition,
			width,
			type: segment.type || "video",
			layer: segment.layer || 0,
		};
	});

	// MediaPlayer'ı güncelle
	if (mediaPlayerRef.value) {
		const currentSegment = segments.value.find(
			(segment) =>
				currentTime.value >= segment.start && currentTime.value <= segment.end
		);
		if (currentSegment && isPlaying.value) {
			mediaPlayerRef.value.seek(currentTime.value);
		}
	}
};

// Ses kontrolü
const toggleMute = () => {
	isMuted.value = !isMuted.value;
};

// Segment bölme işlemi
const handleSegmentSplit = ({
	index,
	segments: newSegments,
	splitTime,
	totalDuration,
}) => {
	// Orijinal segmentleri kopyala
	const updatedSegments = [...segments.value];

	// Bölünen segmentin öncesindeki segmentleri koru
	const beforeSegments = updatedSegments.slice(0, index);

	// Bölünen segmentin sonrasındaki segmentleri al
	const afterSegments = updatedSegments.slice(index + 1);

	// Yeni segmentleri ekle
	const splitSegments = newSegments.map((segment) => ({
		...segment,
		id: generateId(), // Yeni ID oluştur
		startTime: segment.start,
		endTime: segment.end,
		duration: segment.end - segment.start,
		startPosition: `${(segment.start / totalDuration) * 100}%`,
		width: `${((segment.end - segment.start) / totalDuration) * 100}%`,
	}));

	// Tüm segmentleri birleştir
	segments.value = [...beforeSegments, ...splitSegments, ...afterSegments];

	// Aktif segmenti güncelle
	if (currentTime.value >= splitTime) {
		// Eğer playhead ikinci segmentteyse, onu seçili yap
		activeSegmentIndex.value = index + 1;
	} else {
		// Eğer playhead ilk segmentteyse, onu seçili yap
		activeSegmentIndex.value = index;
	}

	// MediaPlayer'ı güncelle
	if (mediaPlayerRef.value) {
		// Mevcut zamana en yakın segment'e git
		const currentSegment = segments.value.find(
			(segment) =>
				currentTime.value >= segment.start && currentTime.value <= segment.end
		);
		if (currentSegment) {
			mediaPlayerRef.value.seek(currentTime.value);
		}
	}

	// Timeline'ı güncelle
	nextTick(() => {
		updateSegments();
	});
};

// Toggle split mode
const toggleSplitMode = () => {
	isSplitMode.value = !isSplitMode.value;
};

// Segment yönetimi
const handleSegmentsReordered = (newSegments) => {
	// Yeni segment sıralamasını uygula
	segments.value = newSegments;

	// MediaPlayer'ı güncelle
	if (mediaPlayerRef.value) {
		// Eğer video oynatılıyorsa, mevcut segmentin başlangıç zamanına git
		if (isPlaying.value) {
			const currentSegment = newSegments.find(
				(segment) =>
					currentTime.value >= segment.start && currentTime.value <= segment.end
			);
			if (currentSegment) {
				mediaPlayerRef.value.seek(currentSegment.start);
			}
		}
	}
};

// Video URL'lerini computed olarak yönet
const videoSrc = computed(() => videoUrl.value || "");

// Preview time state'i
const previewTime = ref(null);

// Preview time güncelleme
const handlePreviewTimeUpdate = (time) => {
	previewTime.value = time;
};

let mousePositions = ref([]);

onMounted(async () => {
	// Cursor verilerini yükle
	if (electron.mediaStateManager) {
		const cursorData = await electron.mediaStateManager.loadCursorData();
		mousePositions.value = cursorData;
	}

	let editorSettings = await electron?.ipcRenderer.invoke(
		IPC_EVENTS.GET_EDITOR_SETTINGS
	);

	console.log("Editor settings:", editorSettings);
	let isCameraFollowMouse = editorSettings.camera.followMouse;

	updateCameraSettings({
		followMouse: isCameraFollowMouse,
	});

	// Mevcut kaydedicileri temizle
	if (mediaRecorder.value) {
		mediaRecorder.value = null;
	}

	// Ekran boyutlarını alıp saklayalım
	if (window?.electron?.screen) {
		const displaySize = await window.electron.screen.getPrimaryDisplay();
		if (displaySize) {
			screenWidth.value = displaySize.bounds.width;
			screenHeight.value = displaySize.bounds.height;
		}
	}

	// Medya dosyalarını yenileştirilmiş loadMediaFromState() fonksiyonu ile yükle
	await loadMediaFromState();

	// ... rest of the existing code ...
});

onUnmounted(() => {
	// Clean up listener
	electron.ipcRenderer.removeAllListeners(
		electron.ipcRenderer.IPC_EVENTS.MOUSE_POSITION_UPDATED
	);
});

onMounted(async () => {
	try {
		// İlk olarak mevcut media state'i al
		const mediaState = await electron?.ipcRenderer.invoke(
			IPC_EVENTS.GET_MEDIA_STATE
		);
		console.log("[editor.vue] Başlangıç media state:", mediaState);

		if (mediaState) {
			if (mediaState.videoPath) {
				console.log(
					"[editor.vue] Video dosyası yükleniyor:",
					mediaState.videoPath
				);
				await loadMedia(mediaState.videoPath, "video");
			} else {
				console.error("[editor.vue] Video dosyası bulunamadı");
				electron?.ipcRenderer.send(
					IPC_EVENTS.EDITOR_LOAD_ERROR,
					"Video dosyası bulunamadı"
				);
				return;
			}

			if (mediaState.cameraPath) {
				console.log(
					"[editor.vue] Kamera dosyası yükleniyor:",
					mediaState.cameraPath
				);
				await loadMedia(mediaState.cameraPath, "camera");
			}

			if (mediaState.audioPath) {
				console.log(
					"[editor.vue] Ses dosyası yükleniyor:",
					mediaState.audioPath
				);
				await loadMedia(mediaState.audioPath, "audio");
			}
		}

		// Media state güncellemelerini dinle
		electron?.ipcRenderer.on(IPC_EVENTS.MEDIA_STATE_UPDATE, async (state) => {
			console.log("[editor.vue] Media state güncellendi:", state);
			if (state.videoPath && state.videoPath !== videoUrl.value) {
				await loadMedia(state.videoPath, "video");
			}
			if (state.cameraPath && state.cameraPath !== cameraUrl.value) {
				await loadMedia(state.cameraPath, "camera");
			}
			if (state.audioPath && state.audioPath !== audioUrl.value) {
				await loadMedia(state.audioPath, "audio");
			}
		});

		// Processing complete event'ini dinle
		electron?.ipcRenderer.on(IPC_EVENTS.PROCESSING_COMPLETE, async (paths) => {
			console.log("[editor.vue] Processing complete:", paths);
			if (paths.videoPath) await loadMedia(paths.videoPath, "video");
			if (paths.cameraPath) await loadMedia(paths.cameraPath, "camera");
			if (paths.audioPath) await loadMedia(paths.audioPath, "audio");
		});

		// Media paths event'ini dinle
		electron?.ipcRenderer.on(IPC_EVENTS.MEDIA_PATHS, async (paths) => {
			console.log("[editor.vue] Media paths güncellendi:", paths);
			if (paths.videoPath) await loadMedia(paths.videoPath, "video");
			if (paths.cameraPath) await loadMedia(paths.cameraPath, "camera");
			if (paths.audioPath) await loadMedia(paths.audioPath, "audio");
		});
	} catch (error) {
		console.error("[editor.vue] Başlangıç hatası:", error);
		electron?.ipcRenderer.send(IPC_EVENTS.EDITOR_LOAD_ERROR, error.message);
	}
});

onUnmounted(() => {
	if (videoBlob.value) URL.revokeObjectURL(videoBlob.value);
	if (cameraBlob.value) URL.revokeObjectURL(cameraBlob.value);
	if (audioBlob.value) URL.revokeObjectURL(audioBlob.value);

	if (window.electron) {
		window.electron.ipcRenderer.removeAllListeners("MEDIA_PATHS");
		window.electron.ipcRenderer.removeAllListeners("START_EDITING");
		window.electron.ipcRenderer.removeAllListeners("PROCESSING_COMPLETE");
	}
});

// Mouse ayarları
const mouseSize = ref(42);

// Mouse size değişikliğini izle
watch(
	mouseSize,
	(newSize) => {
		console.log("[editor.vue] Mouse size güncellendi:", newSize);
	},
	{ immediate: true }
);

// Sürükleme durumu için ref
const isDragging = ref(false);
const initialMousePosition = ref({ x: 0, y: 0 });

// Pencere sürükleme fonksiyonları
const startDrag = (event) => {
	isDragging.value = true;
	initialMousePosition.value = {
		x: event.screenX,
		y: event.screenY,
	};

	// Global event listener'ları ekle
	window.addEventListener("mousemove", handleGlobalMouseMove);
	window.addEventListener("mouseup", handleGlobalMouseUp);

	electron?.ipcRenderer.send("START_WINDOW_DRAG", {
		x: event.screenX,
		y: event.screenY,
	});
};

const handleGlobalMouseMove = (event) => {
	if (!isDragging.value) return;

	electron?.ipcRenderer.send("WINDOW_DRAGGING", {
		x: event.screenX,
		y: event.screenY,
	});
};

const handleGlobalMouseUp = () => {
	if (!isDragging.value) return;

	isDragging.value = false;
	// Global event listener'ları kaldır
	window.removeEventListener("mousemove", handleGlobalMouseMove);
	window.removeEventListener("mouseup", handleGlobalMouseUp);

	electron?.ipcRenderer.send("END_WINDOW_DRAG");
};

// Event listener'ları temizle
onUnmounted(() => {
	window.removeEventListener("mousemove", handleGlobalMouseMove);
	window.removeEventListener("mouseup", handleGlobalMouseUp);
});

// Screenshot alma fonksiyonu
const handleCaptureScreenshot = async () => {
	if (!mediaPlayerRef.value) return;

	try {
		// Canvas'tan görüntüyü al
		const imageData = mediaPlayerRef.value.captureFrame();
		if (!imageData) {
			console.error("Ekran görüntüsü alınamadı");
			return;
		}

		// Electron IPC ile görüntüyü kaydet
		const result = await electron?.ipcRenderer.invoke("SHOW_SAVE_DIALOG", {
			title: "Ekran Görüntüsünü Kaydet",
			defaultPath: `screenshot_${Date.now()}.png`,
			filters: [{ name: "Görüntü", extensions: ["png", "jpg"] }],
		});

		if (result) {
			// Base64 formatındaki görüntüyü kaydet
			const saveResult = await electron?.ipcRenderer.invoke(
				IPC_EVENTS.SAVE_SCREENSHOT,
				imageData,
				result
			);

			if (saveResult?.success) {
				console.log("Ekran görüntüsü başarıyla kaydedildi:", result);
			} else {
				console.error("Ekran görüntüsü kaydedilemedi:", saveResult?.error);
			}
		}
	} catch (error) {
		console.error("Ekran görüntüsü alınırken hata oluştu:", error);
	}
};

// Medya dosyalarını yükleme fonksiyonu
async function loadMediaFromState() {
	try {
		if (electron?.ipcRenderer) {
			// Medya yollarını al
			const mediaState = await electron.ipcRenderer.invoke("GET_MEDIA_STATE");

			console.log("Medya durumu alındı:", mediaState);

			// Video dosyası kontrolü
			if (mediaState.videoPath) {
				console.log("Video dosyası alındı:", mediaState.videoPath);
				await loadMedia(mediaState.videoPath, "video");
			} else {
				console.warn("[editor.vue] Video path not found in media state");
			}

			// Audio dosyası kontrolü
			if (mediaState.audioPath) {
				console.log("Ses dosyası alındı:", mediaState.audioPath);
				// Eğer ses dosyası video ile aynı dosya ise, ayrıca yükleme yapma
				if (mediaState.audioPath === mediaState.videoPath) {
					console.log("Ses ve video aynı dosyada, ayrıca yüklenmeyecek");
					// Video'nun ses kanalını kullan
					audioType.value = videoType.value;
					console.log(
						"[editor.vue] Audio type set to video type:",
						audioType.value
					);

					// Since audio is in the video file, make sure we're not muting it
					isMuted.value = false;
					console.log(
						"[editor.vue] Unmuting audio since it's in the video file"
					);
				} else {
					// Farklı bir ses dosyası ise ayrıca yükle
					console.log("[editor.vue] Loading separate audio file");
					await loadMedia(mediaState.audioPath, "audio");
				}
			} else {
				console.warn("[editor.vue] Audio path not found in media state");
			}
		} else {
			console.error("[editor.vue] Electron IPC not available");
		}
	} catch (error) {
		console.error("Medya durumu yükleme hatası:", error);
		electron?.ipcRenderer.send(IPC_EVENTS.EDITOR_LOAD_ERROR, error.message);
	}
}

// Proje yüklendiğinde çağrılacak fonksiyon
const onProjectLoaded = (project) => {
	console.log("Proje yüklendi:", project);

	// Proje yüklendikten sonra MediaPlayer'ı güncelle
	nextTick(() => {
		if (mediaPlayerRef.value) {
			// Video ve kamera pozisyonlarını güncelle
			if (project.positions) {
				if (project.positions.video) {
					mediaPlayerRef.value.setVideoPosition(project.positions.video);
				}
				if (project.positions.camera) {
					mediaPlayerRef.value.setCameraPosition(project.positions.camera);
				}
			}

			// Canvas'ı güncelle
			mediaPlayerRef.value.updateCanvas(performance.now());
		}

		// Kullanıcıya bilgi ver
		alert(`"${project.name}" projesi başarıyla yüklendi.`);
	});
};
</script>
