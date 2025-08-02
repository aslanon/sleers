<template>
	<div class="w-full !select-none bg-black text-white overflow-hidden h-screen">
		<div
			class="editor-header w-full p-3 px-6 pl-24 bg-black border-b border-gray-700 flex justify-between gap-2 flex-shrink-0"
			:class="{ 'cursor-grab': !isDragging, 'cursor-grabbing': isDragging }"
			@mousedown="startDrag"
		>
			<div class="flex flex-row gap-4 items-center">
				<img
					src="~/assets/logo-text-white.png"
					alt="logo"
					class="object-cover h-7"
				/>
				<div class="w-[2px] h-6 bg-white/20 rounded-full"></div>
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
					New Recording
				</button>
			</div>

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
					Close
				</button> -->
			</div>
		</div>
		<!-- Main Content -->
		<div class="w-full flex h-auto">
			<MediaPlayerSettings
				ref="mediaPlayerSettingsRef"
				:duration="videoDuration"
				:width="videoWidth"
				:height="videoHeight"
				:has-video="!!videoUrl"
				v-model="mouseSize"
				:media-player="mediaPlayerRef"
				class="relative"
			/>
			<div class="w-full min-h-[500px] flex-1 py-4 pb-0 flex flex-col">
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
					:total-canvas-duration="totalCanvasDuration"
					:mouse-positions="mousePositions"
					:mouse-size="mouseSize"
					:is-crop-mode="isCropMode"
					@video-loaded="onVideoLoaded"
					@video-ended="onVideoEnded"
					@video-paused="isPlaying = false"
					@timeUpdate="onTimeUpdate"
					@mute-change="isMuted = $event"
					@update:isCropMode="isCropMode = $event"
					@duration-changed="onDurationChanged"
					@openCameraSettings="openCameraSettings"
					class="inset-0 h-full"
				/>
				<MediaPlayerControls
					:is-playing="isPlaying"
					:current-time="currentTime"
					:preview-time="previewTime"
					:duration="totalCanvasDuration || videoDuration"
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
					@splitCurrentSegment="handleSplitCurrentSegment"
					@customResolutionChange="handleCustomResolutionChange"
				/>
			</div>
		</div>

		<!-- Timeline Component -->
		<TimelineComponent
			:duration="videoDuration"
			:original-video-duration="originalVideoDuration"
			:current-time="currentTime"
			:segments="segments"
			:is-split-mode="isSplitMode"
			:is-playing="isPlaying"
			:is-deleting-segment="isDeletingSegment"
			:has-video="!!videoUrl"
			@timeUpdate="handleTimeUpdate"
			@previewTimeUpdate="handlePreviewTimeUpdate"
			@segmentUpdate="handleSegmentUpdate"
			@segmentSelect="handleSegmentSelect"
			@segmentTrimmed="handleSegmentTrimmed"
			@segmentsReordered="handleSegmentsReordered"
			@splitSegment="handleSegmentSplit"
			@deleteSegment="handleSegmentDelete"
			@videoEnded="handleVideoEnded"
			@totalDurationUpdate="handleTotalDurationUpdate"
			ref="timelineRef"
		/>

		<!-- Export Modal -->
		<ExportModal
			ref="exportModalRef"
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
import ProjectManager from "~/components/ui/ProjectManager.vue";
import ExportModal from "~/components/ui/ExportModal.vue";
import ExportService from "~/services/ExportService";

const { updateCameraSettings, mouseVisible, mouseSize, updateMouseVisible } =
	usePlayerSettings();

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
const originalVideoDuration = ref(0);
const totalCanvasDuration = ref(0); // Timeline'dan gelen toplam canvas uzunluğu
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
const activeSegmentIndex = ref(0);
const showExportModal = ref(false);
const exportModalRef = ref(null);

// Video boyutları
const videoSize = ref({
	width: 1920,
	height: 1080,
});

// Video boyutları için computed değerler
const videoWidth = computed(() => videoSize.value?.width || 1920);
const videoHeight = computed(() => videoSize.value?.height || 1080);

// Segment state'i - başlangıçta boş, video yüklendiğinde doldurulacak
const segments = ref([]);

// Mouse pozisyonları state'i
const mousePositions = ref([]);

// Otomatik zoom segmentleri state'i
const autoZoomRanges = ref([]);

// Mouse pozisyonları değiştiğinde zoom segmentlerini oluştur
watch(
	mousePositions,
	(newMousePositions) => {
		if (
			newMousePositions &&
			newMousePositions.length > 0 &&
			videoDuration.value > 0
		) {
			console.log(
				`[Auto Zoom] Mouse pozisyonları güncellendi: ${newMousePositions.length}`
			);
			const autoZoomSegments = createAutoZoomSegments(
				newMousePositions,
				videoDuration.value
			);

			// Otomatik zoom segmentlerini usePlayerSettings'e ekle
			const { addZoomRange } = usePlayerSettings();
			autoZoomSegments.forEach((segment) => {
				addZoomRange(segment);
			});

			console.log(
				`[Auto Zoom] Watch ile ${autoZoomSegments.length} zoom segmenti usePlayerSettings'e eklendi`
			);
		}
	},
	{ deep: true }
);

// Ekran boyutları
const screenWidth = ref(1920);
const screenHeight = ref(1080);

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
		const fileResponse = await electron?.ipcRenderer.invoke(
			"READ_VIDEO_FILE",
			filePath
		);

		if (!fileResponse) {
			throw new Error(`${type} dosyası okunamadı`);
		}

		let blob;
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

		// Tüm dosyalar için streaming yaklaşımı
		if (fileResponse.type === "stream") {
			// Streaming ile güvenli dosya okuma
			const streamData = await electron?.ipcRenderer.invoke(
				"READ_VIDEO_STREAM",
				fileResponse.path
			);

			if (!streamData || !streamData.chunks) {
				throw new Error(`${type} stream verisi alınamadı`);
			}

			// Chunk'ları güvenli şekilde birleştir ve decode et
			try {
				// Her chunk'ı ayrı ayrı decode edip birleştir
				const allByteArrays = [];
				let totalLength = 0;

				for (const chunk of streamData.chunks) {
					if (chunk && chunk.length > 0) {
						const byteCharacters = atob(chunk);
						const chunkByteArray = new Uint8Array(byteCharacters.length);
						for (let i = 0; i < byteCharacters.length; i++) {
							chunkByteArray[i] = byteCharacters.charCodeAt(i);
						}
						allByteArrays.push(chunkByteArray);
						totalLength += chunkByteArray.length;
					}
				}

				// Tüm chunk'ları tek bir array'de birleştir
				const finalByteArray = new Uint8Array(totalLength);
				let offset = 0;
				for (const chunkArray of allByteArrays) {
					finalByteArray.set(chunkArray, offset);
					offset += chunkArray.length;
				}

				blob = new Blob([finalByteArray], { type: mimeType });
			} catch (decodeError) {
				throw new Error(`Base64 decode hatası: ${decodeError.message}`);
			}
		} else {
			throw new Error(`Bilinmeyen dosya türü: ${fileResponse.type}`);
		}

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
	} catch (error) {
		console.error(`[editor.vue] ${type} yükleme hatası:`, error);
		electron?.ipcRenderer.send(IPC_EVENTS.EDITOR_LOAD_ERROR, error.message);
	}
};

// Oynatma/durdurma kontrolü
const togglePlayback = () => {
	isPlaying.value = !isPlaying.value;
};

// Track whether we've initialized segments for this video session
const hasInitializedSegments = ref(false);

// Mouse tıklama verilerinden otomatik zoom segmentleri oluştur
const createAutoZoomSegments = (mousePositions, videoDuration) => {
	if (!mousePositions || mousePositions.length === 0 || !videoDuration) {
		return [];
	}

	const zoomSegments = [];
	const CLICK_THRESHOLD = 2000; // 2 saniye (milisaniye)
	const ZOOM_SCALE = 2; // 2x zoom

	// Mouse tıklama verilerini filtrele (mousedown eventleri)
	const clickEvents = mousePositions.filter((pos) => pos.type === "mousedown");

	console.log(`[Auto Zoom] ${clickEvents.length} tıklama bulundu`);

	clickEvents.forEach((click, index) => {
		// Tıklama zamanını saniyeye çevir
		const clickTimeSeconds = click.timestamp / 1000;

		// Video süresini kontrol et
		if (clickTimeSeconds >= videoDuration) {
			return; // Video süresini aşan tıklamaları atla
		}

		// Zoom segment başlangıç ve bitiş zamanlarını hesapla
		const segmentStart = Math.max(0, clickTimeSeconds - 2); // 2 saniye önce
		const segmentEnd = Math.min(videoDuration, clickTimeSeconds + 2); // 2 saniye sonra

		// Minimum segment süresi kontrolü (en az 1 saniye)
		if (segmentEnd - segmentStart < 1) {
			return;
		}

		// Diğer zoom segmentleriyle çakışma kontrolü
		const hasOverlap = zoomSegments.some(
			(existing) => segmentStart < existing.end && segmentEnd > existing.start
		);

		if (!hasOverlap) {
			zoomSegments.push({
				id: generateId(),
				start: segmentStart,
				end: segmentEnd,
				scale: ZOOM_SCALE,
				type: "zoom",
				layer: 1, // Zoom segmentleri üst katmanda
				isAutoZoom: true, // Otomatik oluşturulan zoom segmenti
			});

			console.log(
				`[Auto Zoom] Segment ${index + 1}: ${segmentStart.toFixed(
					2
				)}s - ${segmentEnd.toFixed(2)}s (${ZOOM_SCALE}x)`
			);
		}
	});

	return zoomSegments;
};

// Video yüklendiğinde
const onVideoLoaded = (data) => {
	try {
		// Video bilgilerini kaydet
		if (data && typeof data.duration === "number") {
			videoDuration.value = Math.max(0, data.duration);
			originalVideoDuration.value = Math.max(0, data.duration);
			videoSize.value = {
				width: data.width || 1920,
				height: data.height || 1080,
			};

			// İlk segment'i oluştur - sadece hiç segment yoksa
			if (segments.value.length === 0) {
				segments.value = [
					{
						id: generateId(),
						timelineStart: 0,
						timelineEnd: videoDuration.value,
						videoStart: 0,
						videoEnd: videoDuration.value,
						// Eski field'ları da koru (backward compatibility)
						startTime: 0,
						endTime: videoDuration.value,
						start: 0,
						end: videoDuration.value,
						originalVideoDuration: videoDuration.value,
						videoStartOffset: 0,
						startPosition: "0%",
						width: "100%",
						type: "video",
						layer: 0,
						selected: false,
						locked: false,
					},
				];
			} else if (!hasInitializedSegments.value) {
				// İlk kez çağrılıyor ama segment'ler zaten var (proje load vs.)
				// Mevcut segment'lerin yeni field isimlerini oluştur

				segments.value = segments.value.map((segment) => ({
					...segment,
					// Timeline pozisyonları
					timelineStart:
						segment.timelineStart ?? segment.start ?? segment.startTime ?? 0,
					timelineEnd:
						segment.timelineEnd ??
						segment.end ??
						segment.endTime ??
						videoDuration.value,
					// Video content pozisyonları
					videoStart:
						segment.videoStart ?? segment.startTime ?? segment.start ?? 0,
					videoEnd:
						segment.videoEnd ??
						segment.endTime ??
						segment.end ??
						videoDuration.value,
					// Eski field'ları da koru (backward compatibility)
					start: segment.start ?? segment.startTime ?? 0,
					end: segment.end ?? segment.endTime ?? videoDuration.value,
					startTime: segment.startTime ?? segment.start ?? 0,
					endTime: segment.endTime ?? segment.end ?? videoDuration.value,
					// Eğer originalVideoDuration yoksa mevcut video duration'ını kullan
					originalVideoDuration:
						segment.originalVideoDuration ?? videoDuration.value,
					// Video offset yoksa 0 olarak ayarla
					videoStartOffset: segment.videoStartOffset ?? 0,
				}));
			} else {
				// Sonraki onVideoLoaded çağrıları - segment'leri koru ama duration'ı güncelle

				// Son segment'in end time'ını video duration'a eşitle (eğer daha büyükse)
				const lastSegmentIndex = segments.value.length - 1;
				if (
					segments.value[lastSegmentIndex] &&
					segments.value[lastSegmentIndex].timelineEnd > videoDuration.value
				) {
					segments.value[lastSegmentIndex] = {
						...segments.value[lastSegmentIndex],
						timelineEnd: videoDuration.value,
						videoEnd: videoDuration.value,
						// Eski field'ları da güncelle
						end: videoDuration.value,
						endTime: videoDuration.value,
					};
				}

				return;
			}

			// İlk kez yüklendiği için flag'i set et
			hasInitializedSegments.value = true;

			// Mouse tıklama verilerinden otomatik zoom segmentleri oluştur
			console.log(
				`[Auto Zoom] Video yüklendi, mouse pozisyonları: ${
					mousePositions.value?.length || 0
				}`
			);

			if (mousePositions.value && mousePositions.value.length > 0) {
				const autoZoomSegments = createAutoZoomSegments(
					mousePositions.value,
					videoDuration.value
				);
				console.log(
					`[Auto Zoom] ${autoZoomSegments.length} otomatik zoom segmenti oluşturuldu:`,
					autoZoomSegments.map(
						(seg) => `${seg.start.toFixed(1)}s-${seg.end.toFixed(1)}s`
					)
				);

				// Otomatik zoom segmentlerini usePlayerSettings'e ekle
				const { addZoomRange } = usePlayerSettings();
				autoZoomSegments.forEach((segment) => {
					addZoomRange(segment);
				});

				console.log(
					`[Auto Zoom] Otomatik zoom segmentleri usePlayerSettings'e eklendi`
				);
			} else {
				console.warn(
					`[Auto Zoom] Mouse pozisyonları yok veya boş: ${
						mousePositions.value?.length || 0
					}`
				);
			}
		} else {
			console.warn("[editor.vue] Video süresi geçersiz:", data);
		}
	} catch (error) {
		console.error("[editor.vue] Video yükleme hatası:", error);
	}
};

// Duration değiştiğinde (virtual trim için)
const onDurationChanged = (newDuration) => {
	try {
		// Video duration'ını güncelle ama segment'leri değiştirme
		videoDuration.value = Math.max(0, newDuration);
	} catch (error) {
		console.error("[editor.vue] Duration değişikliği hatası:", error);
	}
};

// Video bittiğinde
const onVideoEnded = () => {
	isPlaying.value = false;
	// Video sonda kalsın - currentTime'ı değiştirme
};

// Video düzenleme başlatma
const startEditing = (videoData) => {
	videoUrl.value = videoData.url;
};

// Video kaydetme
const handleExport = async (settings) => {
	try {
		// Directory ve filename kontrolü
		if (!settings.directory) {
			throw new Error(
				"Save directory not specified. Please select a directory."
			);
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

		// Modal'da progress gösterilecek - DOM element'i gerek yok

		// Playback'i durdur
		if (mediaPlayerRef.value) {
			await mediaPlayerRef.value.pause();
		}

		// Progress update handler
		const onProgress = (progress) => {
			console.log("[editor.vue] Export progress:", progress + "%");
			if (exportModalRef.value) {
				exportModalRef.value.updateProgress(progress);
			}
		};

		// Completion handler
		const onComplete = async (exportData) => {
			try {
				console.log("[editor.vue] Export completed:", exportData);

				// FFmpeg-based export already saved the file, so just show success
				if (exportData?.filePath) {
					// Success - modal'ı kapat
					if (exportModalRef.value) {
						exportModalRef.value.completeExport();
					}

					// Success mesajı
					setTimeout(() => {
						// alert(`Video saved successfully: ${exportData.filePath}`);
						// Dosyayı Finder/Explorer'da göster
						electron?.ipcRenderer.send(
							IPC_EVENTS.SHOW_FILE_IN_FOLDER,
							exportData.filePath
						);
					}, 1200);
				} else {
					throw new Error("Export completed but no file path provided");
				}
			} catch (error) {
				console.error("[editor.vue] Kayıt tamamlama hatası:", error);
				if (exportModalRef.value) {
					exportModalRef.value.showError(`Save failed: ${error.message}`);
				}
			}
		};

		// Error handler
		const onError = (error) => {
			console.error("[editor.vue] Video kayıt hatası:", error);
			if (exportModalRef.value) {
				exportModalRef.value.showError(error.message);
			}
		};

		try {
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
		alert(`An error occurred while starting export process: ${error.message}`);
	}
};

// Handle custom resolution change
const handleCustomResolutionChange = (resolution) => {
	console.log("Custom resolution change:", resolution);

	if (mediaPlayerRef.value && mediaPlayerRef.value.setCanvasSize) {
		mediaPlayerRef.value.setCanvasSize(resolution.width, resolution.height);
	}
};

// Değişiklikleri iptal et
const discardChanges = () => {
	if (confirm("Are you sure you want to discard changes?")) {
		closeWindow();
	}
};

// Pencereyi kapat
const closeWindow = () => {
	electron?.ipcRenderer.send("CLOSE_EDITOR_WINDOW");
};

// Yeni kayıt başlat
const startNewRecording = () => {
	if (confirm("Are you sure you want to start a new recording?")) {
		electron?.ipcRenderer.send("RESET_FOR_NEW_RECORDING");
		closeWindow();
	}
};

// Video zamanı güncellendiğinde - sadece currentTime güncelle
const onTimeUpdate = (time) => {
	if (!isNaN(time)) {
		currentTime.value = time;
		currentVideoTime.value = time;
	}
};

// Timeline'dan gelen zaman güncellemesi - direkt seek
const handleTimeUpdate = (time) => {
	if (!isNaN(time) && mediaPlayerRef.value) {
		mediaPlayerRef.value.seek(time);
	}
};

// Timeline'dan video bittiği sinyali geldiğinde
const handleVideoEnded = () => {
	isPlaying.value = false;
	// Video sonda kalsın - currentTime'ı 0 yapma
	// Seek yapma - video olduğu yerde kalsın
};

// Timeline'dan toplam canvas uzunluğu güncellemesi
const handleTotalDurationUpdate = (newTotalDuration) => {
	totalCanvasDuration.value = newTotalDuration;
	console.log(`[Editor] Total canvas duration updated: ${newTotalDuration}s`);
};

// Kesme modunu aç/kapa
const toggleTrimMode = () => {
	isTrimMode.value = !isTrimMode.value;
};

// Segment güncellemelerini işle
const handleSegmentUpdate = async (newSegments) => {
	// Segment silme işleminden sonra çağrılıyorsa, sadece segmentleri güncelle
	// Normalize etme işlemi yapma
	if (isDeletingSegment.value) {
		console.log(
			"[handleSegmentUpdate] Segment silme işlemi devam ediyor, normalize etme atlanıyor"
		);
		segments.value = newSegments;
		return;
	}

	// Segment'leri normalize et - yeni field isimlerini kullan
	const normalizedSegments = newSegments.map((segment, index) => {
		// Timeline pozisyonları
		const timelineStart = segment.timelineStart || segment.start || 0;
		const timelineEnd = segment.timelineEnd || segment.end || 0;

		// Video content pozisyonları
		const videoStart = segment.videoStart || segment.startTime || timelineStart;
		const videoEnd = segment.videoEnd || segment.endTime || timelineEnd;

		return {
			...segment,
			id: segment.id || generateId(),
			timelineStart,
			timelineEnd,
			videoStart,
			videoEnd,
			// Eski field'ları da koru (backward compatibility)
			start: timelineStart,
			end: timelineEnd,
			startTime: videoStart,
			endTime: videoEnd,
			duration: timelineEnd - timelineStart,
			// originalVideoDuration'ı koru
			originalVideoDuration:
				segment.originalVideoDuration || videoDuration.value,
		};
	});

	// Segment'leri güncelle - MediaPlayer otomatik olarak clipping uygulayacak
	segments.value = normalizedSegments;
};

// Segment seçimi
const handleSegmentSelect = async (index) => {
	activeSegmentIndex.value = index;

	// Seçilen segment'in clipped time'daki başlangıç pozisyonunu hesapla
	if (segments.value[index] && mediaPlayerRef.value) {
		// Segment'leri sırala
		const sortedSegments = [...segments.value].sort((a, b) => {
			const startA = a.start || a.startTime || 0;
			const startB = b.start || b.startTime || 0;
			return startA - startB;
		});

		// Seçilen segment'in clipped timeline'daki pozisyonunu hesapla
		let clippedTimePosition = 0;
		for (let i = 0; i < sortedSegments.length; i++) {
			if (sortedSegments[i].id === segments.value[index].id) {
				break;
			}
			const segStart =
				sortedSegments[i].start || sortedSegments[i].startTime || 0;
			const segEnd = sortedSegments[i].end || sortedSegments[i].endTime || 0;
			clippedTimePosition += segEnd - segStart;
		}

		// Oynatmayı durdur
		if (isPlaying.value) {
			await mediaPlayerRef.value.pause();
			isPlaying.value = false;
		}

		// Clipped time pozisyonuna git
		currentTime.value = clippedTimePosition;
		mediaPlayerRef.value.seek(clippedTimePosition);
	}
};

// Segment trim işlemi tamamlandığında
const handleSegmentTrimmed = async (index) => {
	// MediaPlayer otomatik olarak segment clipping uygulayacak
	// Sadece oynatmayı durduralım
	if (isPlaying.value && mediaPlayerRef.value) {
		await mediaPlayerRef.value.pause();
		isPlaying.value = false;
	}
};

// Segmentleri sıkıştır ve boşlukları kaldır
const compactSegments = () => {
	if (!segments.value?.length) return;

	// Segment'leri sadece filtrele, timeline pozisyonlarını değiştirme
	segments.value = segments.value
		.filter((segment) => {
			const timelineStart = segment.timelineStart || segment.start || 0;
			const timelineEnd = segment.timelineEnd || segment.end || 0;
			const duration = timelineEnd - timelineStart;
			return duration > 0.01; // Minimum 0.01 saniye süreli segmentleri koru
		})
		.map((segment, index) => {
			// Orijinal timeline pozisyonlarını koru
			const originalTimelineStart = segment.timelineStart || segment.start || 0;
			const originalTimelineEnd = segment.timelineEnd || segment.end || 0;
			const originalTimelineDuration =
				originalTimelineEnd - originalTimelineStart;

			// Video content pozisyonlarını koru
			const originalVideoStart =
				segment.videoStart || segment.startTime || originalTimelineStart;
			const originalVideoEnd =
				segment.videoEnd || segment.endTime || originalTimelineEnd;

			// Timeline pozisyonları için hesaplama (görsel amaçlı)
			const startPosition = `${
				(originalTimelineStart / videoDuration.value) * 100
			}%`;
			const width = `${
				(originalTimelineDuration / videoDuration.value) * 100
			}%`;

			const updatedSegment = {
				...segment,
				id: segment.id || generateId(),
				// Timeline pozisyonları
				timelineStart: originalTimelineStart,
				timelineEnd: originalTimelineEnd,
				// Video content pozisyonları
				videoStart: originalVideoStart,
				videoEnd: originalVideoEnd,
				// Eski field'ları da koru (backward compatibility)
				start: originalTimelineStart,
				end: originalTimelineEnd,
				startTime: originalVideoStart,
				endTime: originalVideoEnd,
				duration: originalTimelineDuration,
				originalVideoDuration:
					segment.originalVideoDuration || videoDuration.value,
				startPosition,
				width,
				type: segment.type || "video",
				layer: segment.layer || 0,
			};

			return updatedSegment;
		});

	// Toplam süreyi güncelle
	const totalCompactedDuration = segments.value.reduce((total, segment) => {
		const timelineStart = segment.timelineStart || segment.start || 0;
		const timelineEnd = segment.timelineEnd || segment.end || 0;
		return total + (timelineEnd - timelineStart);
	}, 0);
};

// Timeline segment'lerini güncelle
const updateSegments = () => {
	if (!segments.value?.length) return;

	// Segmentleri sadece filtrele (timeline pozisyonlarını koruyarak)
	compactSegments();

	// MediaPlayer'ı güncelle
	if (mediaPlayerRef.value) {
		const currentSegment = segments.value.find((segment) => {
			const timelineStart = segment.timelineStart || segment.start || 0;
			const timelineEnd = segment.timelineEnd || segment.end || 0;
			return (
				currentTime.value >= timelineStart && currentTime.value <= timelineEnd
			);
		});
		if (currentSegment && isPlaying.value) {
			mediaPlayerRef.value.seek(currentTime.value);
		}
	}
};

// Kırpma değişikliklerini işle
const onCropChange = (cropArea) => {
	try {
		if (!cropArea) {
			selectedArea.value = null;
			// Seçilen alanı sıfırla
			window.electron.ipcRenderer.send("UPDATE_SELECTED_AREA", null);
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

		// State'i güncelle
		selectedArea.value = safeArea;

		// Main process'e gönder
		window.electron.ipcRenderer.send("UPDATE_SELECTED_AREA", safeArea);
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
				onCropChange(cropData);
			}
		}
	} catch (error) {
		console.error("[editor.vue] Aspect ratio güncellenirken hata:", error);
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

	// Orijinal segment'in originalVideoDuration'ını ve video offset'ini al
	const originalSegment = updatedSegments[index];
	const parentOriginalDuration =
		originalSegment?.originalVideoDuration || videoDuration.value;
	const parentVideoOffset = originalSegment?.videoStartOffset || 0;

	// Yeni segmentleri ekle
	const splitSegments = newSegments.map((segment, segmentIndex) => ({
		...segment,
		id: generateId(), // Yeni ID oluştur
		startTime: segment.start,
		endTime: segment.end,
		duration: segment.end - segment.start,
		originalVideoDuration: parentOriginalDuration, // Parent'tan inherit et
		videoStartOffset:
			segmentIndex === 0
				? parentVideoOffset // İlk segment parent'in offset'ini alır
				: parentVideoOffset + (splitTime - originalSegment.start), // İkinci segment split noktasından başlar
		startPosition: `${(segment.start / totalDuration) * 100}%`,
		width: `${((segment.end - segment.start) / totalDuration) * 100}%`,
	}));

	// Tüm segmentleri birleştir
	const newSegmentsArray = [
		...beforeSegments,
		...splitSegments,
		...afterSegments,
	];

	segments.value = newSegmentsArray;

	// Aktif segmenti güncelle
	if (currentTime.value >= splitTime) {
		// Eğer playhead ikinci segmentteyse, onu seçili yap (yeni segment)
		activeSegmentIndex.value = index + 1;
	} else {
		// Eğer playhead ilk segmentteyse, onu seçili yap (ilk yeni segment)
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
};

// Toggle split mode
const toggleSplitMode = () => {
	isSplitMode.value = !isSplitMode.value;
};

// Segments değişikliklerini izle (sadece debug için, gereksiz log yok)
watch(
	segments,
	(newSegments, oldSegments) => {
		// Sadece zoom segmenti silindikten sonra tetiklenirse logla
		// (Burada bir flag ile zoom silme işlemi sonrası tetiklenip tetiklenmediğini de kontrol edebilirsin)
		console.log(
			"[DEBUG] SEGMENTS CHANGED:",
			newSegments.map((s) => ({
				id: s.id,
				start: s.start,
				end: s.end,
				type: s.type,
			})),
			"old:",
			oldSegments.map((s) => ({
				id: s.id,
				start: s.start,
				end: s.end,
				type: s.type,
			}))
		);
	},
	{ deep: true }
);

// Video URL değiştiğinde segment initialization flag'ini resetle
watch(videoUrl, (newUrl, oldUrl) => {
	if (newUrl !== oldUrl && newUrl) {
		hasInitializedSegments.value = false;
	}
});

// Oynatma başladığında preview'i temizle
watch(isPlaying, (playing) => {
	if (playing) {
		previewTime.value = 0;
	}
});

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

// Preview time state'i
const previewTime = ref(0);

// Preview time güncelleme
const handlePreviewTimeUpdate = (time) => {
	previewTime.value = time;
};

// Klavye event handler'ı
const handleKeyDown = async (event) => {
	// TODO: Fix selectedZoomIndex reference - currently undefined
	// Zoom segmenti seçiliyse, clip segmenti silme işlemini yapma
	// if (selectedZoomIndex.value !== null) {
	// 	console.log(
	// 		"[editor.vue] Zoom segment seçili, clip segment silme işlemi atlanıyor"
	// 	);
	// 	return;
	// }

	// Timeline component'ten gelen event'leri ignore et
	if (
		event.target.closest(".timeline-container") ||
		event.target.closest(".timeline-component")
	) {
		console.log(
			"[editor.vue] Keyboard delete ignored - event originated from timeline component"
		);
		return;
	}

	// Delete veya Backspace tuşu basıldığında
	if (event.key === "Delete" || event.key === "Backspace") {
		// Prevent deletion if already deleting
		if (isDeletingSegment.value) {
			console.warn(
				"[editor.vue] Keyboard delete iptal edildi - zaten silme işlemi devam ediyor"
			);
			event.preventDefault();
			event.stopPropagation();
			return;
		}

		// Prevent rapid multiple deletions (within 100ms)
		const now = Date.now();
		if (now - lastDeletionTime.value < 100) {
			console.warn(
				"[editor.vue] Keyboard delete ignored - too soon after last deletion"
			);
			return;
		}
		lastDeletionTime.value = now;

		// Mevcut zamanda hangi segment'te olduğumuzu bul
		const currentSegment = segments.value.find((segment) => {
			const start = segment.start || segment.startTime || 0;
			const end = segment.end || segment.endTime || 0;
			return currentTime.value >= start && currentTime.value <= end;
		});

		if (!currentSegment || segments.value.length <= 1) {
			console.warn(
				"[editor.vue] Delete için aktif segment bulunamadı veya son segment"
			);
			return;
		}

		const segmentIndex = segments.value.indexOf(currentSegment);
		console.log(
			`[handleKeyDown] Keyboard delete triggered for segment index: ${segmentIndex}`
		);
		await handleSegmentDelete(segmentIndex);

		// Event'i durdur
		event.preventDefault();
		event.stopPropagation();
	}
};

onMounted(async () => {
	try {
		// Cursor verilerini yükle
		if (electron?.mediaStateManager) {
			const cursorData = await electron.mediaStateManager.loadCursorData();
			mousePositions.value = cursorData;
			console.log(`[editor.vue] ${cursorData.length} mouse pozisyonu yüklendi`);
		} else {
			console.warn("[editor.vue] ⚠️ electron.mediaStateManager bulunamadı");

			// Test verisi ekle
			mousePositions.value = [
				{ x: 100, y: 100, timestamp: 1000, type: "mousedown" },
				{ x: 200, y: 200, timestamp: 3000, type: "mousedown" },
				{ x: 300, y: 300, timestamp: 5000, type: "mousedown" },
			];
			console.log(
				`[editor.vue] Test mouse pozisyonları eklendi: ${mousePositions.value.length}`
			);
		}

		// Editor settings'i yükle
		let editorSettings = await electron?.ipcRenderer.invoke(
			IPC_EVENTS.GET_EDITOR_SETTINGS
		);

		let isCameraFollowMouse = editorSettings?.camera?.followMouse || false;

		updateCameraSettings({
			followMouse: isCameraFollowMouse,
		});

		// Mouse görünürlüğünü manuel olarak true yap
		if (!mouseVisible.value) {
			updateMouseVisible(true);
		}

		// Ekran boyutlarını alıp saklayalım
		if (window?.electron?.screen) {
			const displaySize = await window.electron.screen.getPrimaryDisplay();
			if (displaySize) {
				screenWidth.value = displaySize.bounds.width;
				screenHeight.value = displaySize.bounds.height;
			}
		}

		// Klavye event listener'ı ekle
		window.addEventListener("keydown", handleKeyDown);

		// Media state'i al ve dosyaları yükle
		const mediaState = await electron?.ipcRenderer.invoke(
			IPC_EVENTS.GET_MEDIA_STATE
		);

		if (mediaState) {
			console.log("[editor.vue] Media state alındı:", mediaState);

			if (mediaState.videoPath) {
				await loadMedia(mediaState.videoPath, "video");
				console.log("[editor.vue] Video yüklendi");
			} else {
				console.error("[editor.vue] Video dosyası bulunamadı");
			}

			if (mediaState.cameraPath) {
				await loadMedia(mediaState.cameraPath, "camera");
				console.log("[editor.vue] Kamera yüklendi");
			}

			if (mediaState.audioPath) {
				await loadMedia(mediaState.audioPath, "audio");
				console.log("[editor.vue] Ses yüklendi");
			}
		} else {
			console.warn("[editor.vue] Media state bulunamadı");
		}

		// Media state güncellemelerini dinle
		electron?.ipcRenderer.on(IPC_EVENTS.MEDIA_STATE_UPDATE, async (state) => {
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
			if (paths.videoPath) await loadMedia(paths.videoPath, "video");
			if (paths.cameraPath) await loadMedia(paths.cameraPath, "camera");
			if (paths.audioPath) await loadMedia(paths.audioPath, "audio");
		});

		// Media paths event'ini dinle
		electron?.ipcRenderer.on(IPC_EVENTS.MEDIA_PATHS, async (paths) => {
			if (paths.videoPath) await loadMedia(paths.videoPath, "video");
			if (paths.cameraPath) await loadMedia(paths.cameraPath, "camera");
			if (paths.audioPath) await loadMedia(paths.audioPath, "audio");
		});

		console.log("[editor.vue] Editor başlatıldı");
	} catch (error) {
		console.error("[editor.vue] Başlangıç hatası:", error);
		electron?.ipcRenderer.send(IPC_EVENTS.EDITOR_LOAD_ERROR, error.message);
	}
});

onUnmounted(() => {
	// Clean up listener
	electron.ipcRenderer.removeAllListeners(
		electron.ipcRenderer.IPC_EVENTS.MOUSE_POSITION_UPDATED
	);
});

onUnmounted(() => {
	if (videoBlob.value) URL.revokeObjectURL(videoBlob.value);
	if (cameraBlob.value) URL.revokeObjectURL(cameraBlob.value);
	if (audioBlob.value) URL.revokeObjectURL(audioBlob.value);

	// Klavye event listener'ını temizle
	window.removeEventListener("keydown", handleKeyDown);

	if (window.electron) {
		window.electron.ipcRenderer.removeAllListeners("MEDIA_PATHS");
		window.electron.ipcRenderer.removeAllListeners("START_EDITING");
		window.electron.ipcRenderer.removeAllListeners("PROCESSING_COMPLETE");
	}
});

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
			} else {
				console.error("Ekran görüntüsü kaydedilemedi:", saveResult?.error);
			}
		}
	} catch (error) {
		console.error("Ekran görüntüsü alınırken hata oluştu:", error);
	}
};

// Proje yüklendiğinde çağrılacak fonksiyon
const onProjectLoaded = (project) => {
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

		// Mouse pozisyonları yüklendiğinde otomatik zoom segmentleri oluştur
		if (project.mousePositions && Array.isArray(project.mousePositions)) {
			mousePositions.value = project.mousePositions;

			// Video duration varsa otomatik zoom segmentleri oluştur
			if (videoDuration.value > 0) {
				const autoZoomSegments = createAutoZoomSegments(
					mousePositions.value,
					videoDuration.value
				);
				autoZoomRanges.value = autoZoomSegments;
				console.log(
					`[Auto Zoom] Proje yüklendiğinde ${autoZoomSegments.length} otomatik zoom segmenti oluşturuldu`
				);
			}
		}

		// Kullanıcıya bilgi ver
		alert(`"${project.name}" projesi başarıyla yüklendi.`);
	});
};

// Deletion guard to prevent rapid multiple deletions
const isDeletingSegment = ref(false);
const lastDeletionTime = ref(0);

// Segment silme işlemi - Tamamen yeniden yazılmış kusursuz versiyon
const handleSegmentDelete = async (index) => {
	// Prevent multiple simultaneous deletions
	if (isDeletingSegment.value) {
		console.warn(
			"[editor.vue] Segment silme işlemi zaten devam ediyor, iptal ediliyor"
		);
		return;
	}

	if (segments.value.length <= 1) {
		console.warn("[editor.vue] Son segment silinemez");
		return;
	}

	if (index < 0 || index >= segments.value.length) {
		console.warn("[editor.vue] Geçersiz segment index:", index);
		return;
	}

	// Set deletion guard and timestamp
	isDeletingSegment.value = true;
	lastDeletionTime.value = Date.now();

	try {
		// Oynatmayı durdur
		if (isPlaying.value && mediaPlayerRef.value) {
			await mediaPlayerRef.value.pause();
			isPlaying.value = false;
		}

		console.log(
			`[handleSegmentDelete] Silme işlemi başlatıldı - Index: ${index}, Mevcut segments: ${segments.value.length}`
		);

		// Tüm mevcut segmentleri logla
		console.log(
			`[handleSegmentDelete] Mevcut segmentler:`,
			segments.value.map(
				(s, i) =>
					`${i}: timeline(${s.timelineStart || s.start}-${
						s.timelineEnd || s.end
					}) video(${s.videoStart || s.startTime}-${s.videoEnd || s.endTime})`
			)
		);

		// Mevcut durumu kaydet
		const originalSegments = [...segments.value];
		const currentPlayerTime = currentTime.value; // Mevcut clipped time
		const segmentToDelete = originalSegments[index];

		console.log(
			`[handleSegmentDelete] Silinecek segment: timeline(${
				segmentToDelete.timelineStart || segmentToDelete.start
			}-${segmentToDelete.timelineEnd || segmentToDelete.end}) video(${
				segmentToDelete.videoStart || segmentToDelete.startTime
			}-${
				segmentToDelete.videoEnd || segmentToDelete.endTime
			}), Mevcut player time: ${currentPlayerTime}`
		);

		// 1. ADIM: Clipped timeline'da hangi pozisyonda olduğumuzu hesapla
		let playerSegmentIndex = -1;
		let playerPositionInTimeline = 0;
		let accumulatedTime = 0;

		// Player'ın hangi segment'te olduğunu bul
		for (let i = 0; i < originalSegments.length; i++) {
			const segment = originalSegments[i];
			const segmentDuration =
				(segment.timelineEnd || segment.end || segment.endTime || 0) -
				(segment.timelineStart || segment.start || segment.startTime || 0);

			if (
				currentPlayerTime >= accumulatedTime &&
				currentPlayerTime < accumulatedTime + segmentDuration
			) {
				playerSegmentIndex = i;
				playerPositionInTimeline = currentPlayerTime - accumulatedTime; // Segment içindeki pozisyon
				break;
			}
			accumulatedTime += segmentDuration;
		}

		// Eğer player tam son segment'in sonundaysa
		if (playerSegmentIndex === -1 && originalSegments.length > 0) {
			playerSegmentIndex = originalSegments.length - 1;
			const lastSegment = originalSegments[playerSegmentIndex];
			const lastSegmentDuration =
				(lastSegment.timelineEnd ||
					lastSegment.end ||
					lastSegment.endTime ||
					0) -
				(lastSegment.timelineStart ||
					lastSegment.start ||
					lastSegment.startTime ||
					0);
			playerPositionInTimeline = lastSegmentDuration;
		}

		console.log(
			`[handleSegmentDelete] Player segment index: ${playerSegmentIndex}, Position in segment: ${playerPositionInTimeline}`
		);

		// 2. ADIM: Segment'i sil
		const newSegments = originalSegments.filter((_, i) => i !== index);

		// Hiç segment kalmadıysa
		if (newSegments.length === 0) {
			segments.value = [];
			currentTime.value = 0;
			videoDuration.value = 0;
			activeSegmentIndex.value = -1;
			console.log(`[handleSegmentDelete] Tüm segment'ler silindi`);
			return;
		}

		// 3. ADIM: Yeni timeline'da player pozisyonunu hesapla
		let newClippedTime = 0;

		if (playerSegmentIndex === index) {
			// Player silinen segment'teydi
			console.log(`[handleSegmentDelete] Player silinen segment'teydi`);

			if (index < newSegments.length) {
				// Aynı index'te yeni bir segment var (sağdaki segment sola kaydı)
				// O segment'in başına git (player orada değildi çünkü segment silindi)
				let accTime = 0;
				for (let i = 0; i < index; i++) {
					const seg = newSegments[i];
					accTime +=
						(seg.timelineEnd || seg.end || seg.endTime || 0) -
						(seg.timelineStart || seg.start || seg.startTime || 0);
				}
				newClippedTime = accTime;
				console.log(
					`[handleSegmentDelete] Sağdaki segment'in başına gidiliyor: ${newClippedTime}`
				);
			} else if (index > 0) {
				// Sağda segment yok, bir önceki segment'in sonuna git
				let accTime = 0;
				for (let i = 0; i < newSegments.length; i++) {
					const seg = newSegments[i];
					accTime +=
						(seg.timelineEnd || seg.end || seg.endTime || 0) -
						(seg.timelineStart || seg.start || seg.startTime || 0);
				}
				newClippedTime = accTime; // Son segment'in sonuna git
				console.log(
					`[handleSegmentDelete] Son segment'in sonuna gidiliyor: ${newClippedTime}`
				);
			} else {
				// İlk segment silinmişti, başa git
				newClippedTime = 0;
				console.log(
					`[handleSegmentDelete] İlk segment silindi, başa gidiliyor: ${newClippedTime}`
				);
			}
		} else if (playerSegmentIndex > index) {
			// Player silinen segment'ten sonra bir segment'teydi
			// Yeni pozisyon = eski pozisyon - silinen segment'in süresi
			const deletedSegmentDuration =
				(segmentToDelete.timelineEnd ||
					segmentToDelete.end ||
					segmentToDelete.endTime ||
					0) -
				(segmentToDelete.timelineStart ||
					segmentToDelete.start ||
					segmentToDelete.startTime ||
					0);
			newClippedTime = currentPlayerTime - deletedSegmentDuration;
			console.log(
				`[handleSegmentDelete] Player sonraki segment'teydi, yeni pozisyon: ${newClippedTime} (${currentPlayerTime} - ${deletedSegmentDuration})`
			);
		} else {
			// Player silinen segment'ten önce bir segment'teydi
			// Pozisyon değişmez
			newClippedTime = currentPlayerTime;
			console.log(
				`[handleSegmentDelete] Player önceki segment'teydi, pozisyon aynı: ${newClippedTime}`
			);
		}

		// 4. ADIM: Yeni toplam süreyi hesapla ve sınırlandır
		const newTotalDuration = newSegments.reduce((total, segment) => {
			const timelineStart = segment.timelineStart || segment.start || 0;
			const timelineEnd = segment.timelineEnd || segment.end || 0;
			return total + (timelineEnd - timelineStart);
		}, 0);

		// Clipped time'ı yeni toplam süre ile sınırlandır
		newClippedTime = Math.max(0, Math.min(newClippedTime, newTotalDuration));

		// 5. ADIM: Active segment index'ini güncelle
		let newActiveIndex = activeSegmentIndex.value;

		if (activeSegmentIndex.value === index) {
			// Active segment silindi
			if (index < newSegments.length) {
				// Aynı pozisyonda yeni segment var
				newActiveIndex = index;
			} else if (newSegments.length > 0) {
				// Son segment'e git
				newActiveIndex = newSegments.length - 1;
			} else {
				newActiveIndex = -1;
			}
		} else if (activeSegmentIndex.value > index) {
			// Active segment silinen segment'ten sonradaydı, index'i azalt
			newActiveIndex = activeSegmentIndex.value - 1;
		}
		// Eğer active segment silinen segment'ten önceydi, değişiklik yok

		// Bounds check
		if (newActiveIndex >= newSegments.length) {
			newActiveIndex = newSegments.length - 1;
		}
		if (newActiveIndex < 0 && newSegments.length > 0) {
			newActiveIndex = 0;
		}

		// 6. ADIM: Tüm değişiklikleri uygula
		segments.value = newSegments;
		videoDuration.value = newTotalDuration;
		activeSegmentIndex.value = newActiveIndex;
		currentTime.value = newClippedTime;

		console.log(
			`[handleSegmentDelete] Kalan segmentler:`,
			newSegments.map(
				(s, i) =>
					`${i}: timeline(${s.timelineStart || s.start}-${
						s.timelineEnd || s.end
					}) video(${s.videoStart || s.startTime}-${s.videoEnd || s.endTime})`
			)
		);
		console.log(
			`[handleSegmentDelete] Sonuç - Yeni segments: ${newSegments.length}, Yeni duration: ${newTotalDuration}, Yeni clipped time: ${newClippedTime}, Yeni active index: ${newActiveIndex}`
		);

		// Debug: TimelineComponent'e geçilen segment'leri kontrol et
		console.log(
			`[handleSegmentDelete] TimelineComponent'e geçilen segments.value:`,
			segments.value
		);

		// 7. ADIM: MediaPlayer'ı yeni pozisyona götür
		if (mediaPlayerRef.value) {
			await nextTick();
			if (mediaPlayerRef.value.seek) {
				mediaPlayerRef.value.seek(newClippedTime);
			}
		}
	} catch (error) {
		console.error("[editor.vue] Segment silme hatası:", error);
	} finally {
		// Clear deletion guard
		isDeletingSegment.value = false;
	}
};

// VideoClipManager'dan alınan split ve delete fonksiyonları
const handleSplitCurrentSegment = () => {
	// Mevcut zamanda hangi segment'te olduğumuzu bul
	const currentSegment = segments.value.find((segment) => {
		const timelineStart =
			segment.timelineStart || segment.start || segment.startTime || 0;
		const timelineEnd =
			segment.timelineEnd || segment.end || segment.endTime || 0;
		return (
			currentTime.value >= timelineStart && currentTime.value <= timelineEnd
		);
	});

	if (!currentSegment) {
		console.warn("[editor.vue] Split için aktif segment bulunamadı");
		return;
	}

	const segmentIndex = segments.value.indexOf(currentSegment);
	const splitPoint = currentTime.value;
	const timelineStart =
		currentSegment.timelineStart ||
		currentSegment.start ||
		currentSegment.startTime ||
		0;
	const timelineEnd =
		currentSegment.timelineEnd ||
		currentSegment.end ||
		currentSegment.endTime ||
		0;

	// Split noktasının segment içinde olduğunu kontrol et
	if (splitPoint <= timelineStart || splitPoint >= timelineEnd) {
		console.warn("[editor.vue] Split noktası segment dışında");
		return;
	}

	// Video content pozisyonlarını hesapla
	const videoStart =
		currentSegment.videoStart || currentSegment.startTime || timelineStart;
	const videoEnd =
		currentSegment.videoEnd || currentSegment.endTime || timelineEnd;
	const videoDuration = videoEnd - videoStart;

	// Split ratio'yu video content'e uygula
	const timelineDuration = timelineEnd - timelineStart;
	const splitRatio = (splitPoint - timelineStart) / timelineDuration;
	const videoSplitPoint = videoStart + videoDuration * splitRatio;

	// Parent segment'in originalVideoDuration'ını al
	const parentOriginalDuration =
		currentSegment.originalVideoDuration || videoDuration.value;

	// İki yeni segment oluştur
	const leftSegment = {
		id: generateId(),
		timelineStart: timelineStart,
		timelineEnd: splitPoint,
		videoStart: videoStart,
		videoEnd: videoSplitPoint,
		// Eski field'ları da koru (backward compatibility)
		start: timelineStart,
		end: splitPoint,
		startTime: videoStart,
		endTime: videoSplitPoint,
		duration: splitPoint - timelineStart,
		originalVideoDuration: parentOriginalDuration,
		type: currentSegment.type || "video",
		layer: currentSegment.layer || 0,
		selected: false,
		locked: false,
	};

	const rightSegment = {
		id: generateId(),
		timelineStart: splitPoint,
		timelineEnd: timelineEnd,
		videoStart: videoSplitPoint,
		videoEnd: videoEnd,
		// Eski field'ları da koru (backward compatibility)
		start: splitPoint,
		end: timelineEnd,
		startTime: videoSplitPoint,
		endTime: videoEnd,
		duration: timelineEnd - splitPoint,
		originalVideoDuration: parentOriginalDuration,
		type: currentSegment.type || "video",
		layer: currentSegment.layer || 0,
		selected: false,
		locked: false,
	};

	// Orijinal segmenti iki yeni segment ile değiştir
	segments.value.splice(segmentIndex, 1, leftSegment, rightSegment);

	// Segmentleri sıkıştır - SİLİNDİ: Bu çağrı segment silme işleminden sonra timeline'ı bozuyor
	// compactSegments();
};

// MediaPlayerSettings ref'i ekle
const mediaPlayerSettingsRef = ref(null);

// Camera settings açma fonksiyonu
const openCameraSettings = () => {
	if (mediaPlayerSettingsRef.value) {
		mediaPlayerSettingsRef.value.currentTab = "camera";
	}
};
</script>
