<template>
	<div
		class="w-full !select-none flex flex-col bg-black text-white h-screen overflow-hidden"
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

			<!-- Butonlar -->
			<div class="flex flex-row gap-2 items-center">
				<button
					class="btn-export flex flex-row gap-2 items-center"
					@click="saveVideo()"
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
							d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
						/>
					</svg>
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
		<div class="flex-1 flex flex-col min-h-0">
			<div class="w-full flex flex-1">
				<div class="flex-shrink-0 w-[500px] h-full flex flex-col">
					<div class="flex-1 p-4 relative">
						<MediaPlayerSettings
							:duration="videoDuration"
							:width="videoWidth"
							:height="videoHeight"
							v-model="mouseSize"
							class="relative"
						/>
					</div>
				</div>
				<div class="w-full p-4 flex-1 flex flex-col">
					<div class="flex-1 relative min-h-0">
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
							@video-loaded="onVideoLoaded"
							@video-ended="onVideoEnded"
							@video-paused="isPlaying = false"
							@timeUpdate="onTimeUpdate"
							@mute-change="isMuted = $event"
							class="absolute inset-0 h-full"
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
						@toggle-playback="togglePlayback"
						@toggle-trim-mode="toggleTrimMode"
						@update:selected-ratio="onAspectRatioChange"
						@toggle-mute="toggleMute"
						@toggle-split-mode="toggleSplitMode"
						class="mt-4"
					/>
				</div>
			</div>

			<div class="flex-shrink-0">
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
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import MediaPlayer from "~/components/MediaPlayer.vue";
import MediaPlayerControls from "~/components/MediaPlayerControls.vue";
import MediaPlayerSettings from "~/components/MediaPlayerSettings.vue";
import TimelineComponent from "~/components/TimelineComponent.vue";

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
const saveVideo = async () => {
	try {
		const filePath = await electron?.ipcRenderer.invoke("SHOW_SAVE_DIALOG", {
			title: "Videoyu Kaydet",
			defaultPath: `video_${Date.now()}.mp4`,
			filters: [{ name: "Video", extensions: ["mp4"] }],
		});

		if (filePath) {
			// Canvas'ı al
			const sourceCanvas = mediaPlayerRef.value?.getCanvas();
			if (!sourceCanvas) {
				throw new Error("Canvas bulunamadı");
			}

			// Orijinal boyutları kaydet
			const originalWidth = sourceCanvas.width;
			const originalHeight = sourceCanvas.height;

			// 2K çözünürlük için yeni boyutları hesapla (aspect ratio'yu koru)
			const targetHeight = 1440; // 2K dikey çözünürlük
			const targetWidth = Math.round(
				(targetHeight * originalWidth) / originalHeight
			);

			// Geçici yüksek çözünürlüklü canvas oluştur
			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = targetWidth;
			tempCanvas.height = targetHeight;
			const tempCtx = tempCanvas.getContext("2d", {
				alpha: true,
				willReadFrequently: true,
			});

			// Kayıt durumunu göster
			const loadingMessage = document.createElement("div");
			loadingMessage.className =
				"fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50";
			loadingMessage.innerHTML = `
				<div class="bg-gray-800 p-4 rounded-lg text-white">
					<p class="text-lg">Video kaydediliyor...</p>
					<p class="text-sm mt-2">Lütfen bekleyin...</p>
				</div>
			`;
			document.body.appendChild(loadingMessage);

			return new Promise(async (resolve, reject) => {
				try {
					// Video kaydını başlat - en yüksek kalite için ayarlar
					const stream = tempCanvas.captureStream(60); // 60 FPS
					const mediaRecorder = new MediaRecorder(stream, {
						mimeType: "video/webm",
						videoBitsPerSecond: 50000000, // 50 Mbps for ultra high quality
					});

					const chunks = [];
					mediaRecorder.ondataavailable = (e) => {
						if (e.data.size > 0) {
							chunks.push(e.data);
						}
					};

					let startTime = 0;
					let lastFrameTime = 0;
					const frameInterval = 1000 / 60; // 60 FPS için frame aralığı

					// Frame çizme fonksiyonu
					const renderFrame = async (currentTime) => {
						if (!startTime) startTime = currentTime;
						const elapsed = currentTime - startTime;

						// FPS kontrolü
						if (currentTime - lastFrameTime >= frameInterval) {
							lastFrameTime = currentTime;

							// Video süresini kontrol et
							const videoTime = elapsed / 1000;
							if (videoTime >= videoDuration.value) {
								mediaRecorder.stop();
								return;
							}

							// Videoyu ilgili zamana getir
							await mediaPlayerRef.value.seek(videoTime);

							// Source canvas'ı yüksek çözünürlüklü canvas'a çiz
							tempCtx.clearRect(0, 0, targetWidth, targetHeight);
							tempCtx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

							// Bir sonraki frame için devam et
							requestAnimationFrame(renderFrame);
						} else {
							requestAnimationFrame(renderFrame);
						}
					};

					// Kayıt tamamlandığında
					mediaRecorder.onstop = async () => {
						try {
							// Son frame'e geri dön
							await mediaPlayerRef.value.seek(currentTime.value);

							const webmBlob = new Blob(chunks, { type: "video/webm" });
							const arrayBuffer = await webmBlob.arrayBuffer();
							const base64Data = btoa(
								new Uint8Array(arrayBuffer).reduce(
									(data, byte) => data + String.fromCharCode(byte),
									""
								)
							);

							// Base64'ü Electron'a gönder ve MP4'e dönüştür
							const result = await electron?.ipcRenderer.invoke(
								"SAVE_VIDEO",
								`data:video/webm;base64,${base64Data}`,
								filePath
							);

							if (result?.success) {
								console.log("[editor.vue] Video başarıyla kaydedildi");
							} else {
								throw new Error(result?.error || "Video kaydedilemedi");
							}

							if (loadingMessage.parentNode) {
								document.body.removeChild(loadingMessage);
							}

							resolve(result);
						} catch (error) {
							console.error("[editor.vue] Kayıt sonlandırma hatası:", error);
							reject(error);
						}
					};

					// Kayıt işlemini başlat
					mediaRecorder.start();

					// Video başlangıca sar ve frame çizmeyi başlat
					await mediaPlayerRef.value.seek(0);
					requestAnimationFrame(renderFrame);
				} catch (error) {
					console.error("[editor.vue] Kayıt başlatma hatası:", error);
					if (loadingMessage.parentNode) {
						document.body.removeChild(loadingMessage);
					}
					reject(error);
				}
			});
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
</script>
