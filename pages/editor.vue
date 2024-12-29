<template>
	<div class="min-h-screen bg-[#1a1b26]">
		<!-- Üst Bar - Mevcut header'ı koruyoruz -->
		<div
			class="fixed top-0 left-0 right-0 bg-[#1a1b26]/80 backdrop-blur-3xl border-b border-gray-200 z-50"
			@mousedown.prevent="startDrag"
		>
			<div class="flex items-center justify-between p-4">
				<div class="flex items-center space-x-4">
					<button
						@click="closeWindow"
						class="p-2 hover:bg-gray-700 rounded-lg cursor-pointer"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5 text-white"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
				</div>
			</div>
		</div>

		<!-- Yeni Layout -->
		<div class="pt-20 bg-neutral-800 p-8">
			<div class="mx-auto space-y-6">
				<!-- Video ve Araçlar -->
				<div class="flex gap-6 mb-6">
					<!-- Video Preview -->
					<div class="flex-1 bg-neutral-700 rounded-lg p-4 overflow-hidden">
						<div class="relative aspect-video">
							<!-- Ekran Kaydı -->
							<video
								ref="screenPlayer"
								class="w-full h-full"
								:style="{
									objectFit:
										cropArea?.aspectRatio === 'free' ? 'contain' : 'cover',
									clipPath: cropArea
										? `inset(${(cropArea.y / cropArea.display.height) * 100}% ${
												((cropArea.display.width -
													(cropArea.x + cropArea.width)) /
													cropArea.display.width) *
												100
										  }% ${
												((cropArea.display.height -
													(cropArea.y + cropArea.height)) /
													cropArea.display.height) *
												100
										  }% ${(cropArea.x / cropArea.display.width) * 100}%)`
										: 'none',
								}"
								preload="auto"
								@loadedmetadata="onScreenLoaded"
								@error="
									(e) => console.error('Ekran kaydı yüklenirken hata:', e)
								"
							></video>

							<!-- Kamera Kaydı (PiP) -->
							<video
								v-if="cameraPath"
								ref="cameraPlayer"
								class="absolute right-4 bottom-4 w-48 h-48 object-cover rounded-full shadow-lg"
								preload="auto"
								@loadedmetadata="onCameraLoaded"
								@error="
									(e) => console.error('Kamera kaydı yüklenirken hata:', e)
								"
							></video>
						</div>
					</div>

					<!-- Araçlar -->
					<div
						class="w-72 bg-neutral-700 rounded-lg p-4 flex flex-col items-center justify-between"
					>
						<!-- Crop Listesi -->
						<div class="w-full">
							<h3 class="text-neutral-300 font-medium mb-2">Kırpma Alanları</h3>
							<div class="space-y-2">
								<!-- Crop alanları buraya gelecek -->
							</div>
						</div>

						<!-- Tool Properties -->
						<div class="w-full mt-4">
							<h3 class="text-neutral-300 font-medium mb-2">Özellikler</h3>
							<div class="bg-neutral-600 rounded p-4">
								<p class="text-sm text-neutral-300">Seçili bir araç yok</p>
							</div>
						</div>
					</div>
				</div>

				<!-- Timeline ve Kontroller -->
				<div>
					<!-- Butonlar -->
					<div class="flex gap-4 mb-4">
						<button
							class="px-4 py-2 bg-neutral-700 text-white rounded hover:bg-neutral-600 transition-colors"
						>
							Alan Seç
						</button>
						<button
							@click="exportVideo"
							class="px-4 py-2 bg-neutral-700 text-white rounded hover:bg-neutral-600 transition-colors"
							:disabled="isExporting"
						>
							<span v-if="isExporting">Dışa Aktarılıyor...</span>
							<span v-else>Dışa Aktar</span>
						</button>
					</div>

					<!-- Timeline -->
					<div class="w-full relative">
						<!-- Timeline Container -->
						<div class="bg-neutral-800/50 rounded-lg p-4">
							<!-- Time Scale -->
							<div class="flex text-xs text-neutral-400 mb-2 relative">
								<div class="absolute inset-x-0 flex">
									<template v-for="i in 600" :key="i">
										<div
											class="flex-shrink-0 relative"
											:style="{ width: '60px' }"
										>
											<div
												v-if="i % 10 === 0"
												class="absolute left-0 -bottom-1 w-px h-2 bg-neutral-600"
											></div>
											<div
												v-else
												class="absolute left-0 -bottom-1 w-px h-1 bg-neutral-600/50"
											></div>
											<span
												v-if="i % 10 === 0"
												class="absolute left-0 -top-5 transform -translate-x-1/2"
											>
												{{ formatTime(i) }}
											</span>
										</div>
									</template>
								</div>
							</div>

							<!-- Timeline Track -->
							<div class="relative h-20">
								<!-- Background Track -->
								<div class="absolute inset-0 bg-neutral-700/30 rounded"></div>

								<!-- Video Section -->
								<div
									class="absolute inset-y-0 left-0 w-[500px] group"
									:style="{
										transform: `translateX(${timelineState.scroll}px)`,
									}"
								>
									<!-- Video Bar -->
									<div
										class="h-full bg-gradient-to-r from-[#E1A87A] to-[#E1A87A]/80 rounded-md shadow-lg relative overflow-hidden"
									>
										<!-- Progress Overlay -->
										<div
											class="absolute inset-y-0 left-0 bg-gradient-to-r from-[#E1A87A] to-[#E1A87A] transition-all"
											:style="{ width: `${(currentTime / duration) * 100}%` }"
										>
											<div class="absolute inset-0 bg-white/10"></div>
										</div>

										<!-- Video Info -->
										<div
											class="absolute inset-x-0 top-0 p-2 text-xs text-white/90 font-medium bg-gradient-to-b from-black/20 to-transparent"
										>
											Video Timeline
										</div>

										<!-- Duration Label -->
										<div
											class="absolute right-2 bottom-2 px-2 py-1 text-xs text-white/90 bg-black/30 rounded"
										>
											{{ formatTime(duration) }}
										</div>
									</div>

									<!-- Hover Effect -->
									<div
										class="absolute inset-0 ring-2 ring-white/0 group-hover:ring-white/20 rounded-md transition-all"
									></div>
								</div>

								<!-- Playhead -->
								<div
									class="absolute top-0 bottom-0 z-10"
									:style="{
										left: `${(currentTime / duration) * 500}px`,
									}"
									@mousedown.stop="startPlayheadDrag"
								>
									<!-- Playhead Line -->
									<div
										class="absolute inset-y-0 left-1/2 w-px bg-red-500 transform -translate-x-1/2"
									>
										<div
											class="absolute inset-0 animate-pulse bg-red-500/50 w-0.5"
										></div>
									</div>

									<!-- Playhead Handle -->
									<div
										class="absolute -top-1 left-1/2 transform -translate-x-1/2 w-3 h-3"
									>
										<div
											class="absolute inset-0 bg-red-500 rounded-full cursor-ew-resize hover:scale-110 transition-transform shadow-lg"
										>
											<div
												class="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-50"
											></div>
										</div>
									</div>

									<!-- Time Label -->
									<div
										class="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-neutral-900/90 rounded text-xs text-white whitespace-nowrap"
									>
										{{ formatTime(currentTime) }}
									</div>
								</div>
							</div>

							<!-- Timeline Controls -->
							<div class="flex items-center justify-between mt-4">
								<div class="flex items-center space-x-2">
									<!-- Play/Pause Button -->
									<button
										@click="togglePlay"
										class="p-2 rounded-full hover:bg-neutral-700/50 transition-colors"
									>
										<svg
											v-if="isPlaying"
											xmlns="http://www.w3.org/2000/svg"
											class="h-5 w-5 text-white"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path
												fill-rule="evenodd"
												d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
												clip-rule="evenodd"
											/>
										</svg>
										<svg
											v-else
											xmlns="http://www.w3.org/2000/svg"
											class="h-5 w-5 text-white"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
												clip-rule="evenodd"
											/>
										</svg>
									</button>

									<!-- Time Display -->
									<div class="text-sm text-white font-medium">
										<span>{{ formatTime(currentTime) }}</span>
										<span class="text-neutral-400 mx-1">/</span>
										<span class="text-neutral-400">{{
											formatTime(duration)
										}}</span>
									</div>
								</div>

								<!-- Zoom Controls -->
								<div
									class="flex items-center space-x-1 bg-neutral-700/30 rounded-full p-1"
								>
									<button
										@click="zoomOut"
										class="p-1 rounded-full hover:bg-neutral-600/50 transition-colors"
										:class="{
											'opacity-50 cursor-not-allowed':
												timelineState.zoom <= 0.5,
										}"
										:disabled="timelineState.zoom <= 0.5"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-4 w-4 text-white"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path
												fill-rule="evenodd"
												d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
												clip-rule="evenodd"
											/>
										</svg>
									</button>
									<div class="w-px h-4 bg-neutral-600"></div>
									<button
										@click="zoomIn"
										class="p-1 rounded-full hover:bg-neutral-600/50 transition-colors"
										:class="{
											'opacity-50 cursor-not-allowed': timelineState.zoom >= 4,
										}"
										:disabled="timelineState.zoom >= 4"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-4 w-4 text-white"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path
												fill-rule="evenodd"
												d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
												clip-rule="evenodd"
											/>
										</svg>
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Cursor -->
		<CustomCursor v-if="isRecording" />
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import CustomCursor from "~/components/CustomCursor.vue";
import { useCursor } from "~/composables/useCursor";

const router = useRouter();
const route = useRoute();

const screenPath = ref("");
const cameraPath = ref("");
const audioPath = ref("");
const screenPlayer = ref<HTMLVideoElement | null>(null);
const cameraPlayer = ref<HTMLVideoElement | null>(null);
const cropArea = ref<any>(null);
const isExporting = ref(false);
const exportProgress = ref(0);
const exportStatus = ref({
	frames: 0,
	fps: 0,
	time: "00:00:00.00",
});
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);

// Sürükleme durumu için ref'ler
const isDragging = ref(false);

const { settings, cursorState, startRecording, stopRecording } = useCursor();

// Sürükleme işleyicileri
const startDrag = (e: MouseEvent) => {
	// Butonlar ve ikonlar üzerinde sürüklemeyi engelle
	if (e.target instanceof HTMLButtonElement || e.target instanceof SVGElement) {
		return;
	}

	isDragging.value = true;
	window.electron?.ipcRenderer.send("START_WINDOW_DRAG", {
		x: e.screenX,
		y: e.screenY,
	});

	// Global event listener'ları ekle
	window.addEventListener("mousemove", onDrag);
	window.addEventListener("mouseup", endDrag);
};

const onDrag = (e: MouseEvent) => {
	if (!isDragging.value) return;
	window.electron?.ipcRenderer.send("WINDOW_DRAGGING", {
		x: e.screenX,
		y: e.screenY,
	});
};

const endDrag = () => {
	if (!isDragging.value) return;
	isDragging.value = false;
	window.electron?.ipcRenderer.send("END_WINDOW_DRAG");

	// Global event listener'ları kaldır
	window.removeEventListener("mousemove", onDrag);
	window.removeEventListener("mouseup", endDrag);
};

// Video yükleme işleyicileri
const onScreenLoaded = () => {
	if (screenPlayer.value) {
		duration.value = screenPlayer.value.duration;

		// Crop alanı varsa uygula
		if (cropArea.value) {
			const video = screenPlayer.value;
			const { x, y, width, height, display, devicePixelRatio, aspectRatio } =
				cropArea.value;

			// Yüzdelik oranları hesapla
			const clipTop = (y / display.height) * 100;
			const clipRight = ((display.width - (x + width)) / display.width) * 100;
			const clipBottom =
				((display.height - (y + height)) / display.height) * 100;
			const clipLeft = (x / display.width) * 100;

			// Video elementinin stilini güncelle
			video.style.objectFit = aspectRatio === "free" ? "contain" : "cover";
			video.style.clipPath = `inset(${clipTop}% ${clipRight}% ${clipBottom}% ${clipLeft}%)`;
		}

		console.log("Ekran kaydı yüklendi:", {
			duration: duration.value,
			videoWidth: screenPlayer.value.videoWidth,
			videoHeight: screenPlayer.value.videoHeight,
			cropArea: cropArea.value,
		});
	}
};

const onCameraLoaded = () => {
	if (cameraPlayer.value && screenPlayer.value) {
		cameraPlayer.value.currentTime = screenPlayer.value.currentTime;
		console.log("Kamera kaydı yüklendi:", {
			videoWidth: cameraPlayer.value.videoWidth,
			videoHeight: cameraPlayer.value.videoHeight,
		});
	}
};

// Zaman formatlayıcı
const formatTime = (time: number) => {
	const minutes = Math.floor(time / 60);
	const seconds = Math.floor(time % 60);
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

// Oynatma kontrolü
const togglePlay = () => {
	if (!screenPlayer.value) return;

	if (isPlaying.value) {
		screenPlayer.value.pause();
		if (cameraPlayer.value) cameraPlayer.value.pause();
	} else {
		screenPlayer.value.play();
		if (cameraPlayer.value) cameraPlayer.value.play();
	}
	isPlaying.value = !isPlaying.value;
};

// Timeline kontrolü
const seekTo = (event: Event) => {
	const time = parseFloat((event.target as HTMLInputElement).value);
	if (screenPlayer.value) {
		screenPlayer.value.currentTime = time;
		if (cameraPlayer.value) {
			cameraPlayer.value.currentTime = time;
		}
	}
};

// Video senkronizasyonu için timeupdate event listener
const onTimeUpdate = () => {
	if (screenPlayer.value) {
		currentTime.value = screenPlayer.value.currentTime;
		if (cameraPlayer.value) {
			cameraPlayer.value.currentTime = currentTime.value;
		}
	}
};

const closeWindow = () => {
	window.electron?.ipcRenderer.send("WINDOW_CLOSE");
};

const startNewRecording = async () => {
	await router.push("/");
};

const getMediaPaths = async () => {
	try {
		// Pencere yüksekliğini artır
		window.electron?.ipcRenderer.send("RESIZE_EDITOR_WINDOW");

		// URL'den dosya yollarını al
		const rawScreenPath = decodeURIComponent(route.query.screen as string);
		const rawCameraPath = route.query.camera
			? decodeURIComponent(route.query.camera as string)
			: null;
		const rawAudioPath = route.query.audio
			? decodeURIComponent(route.query.audio as string)
			: null;

		console.log("Ham dosya yolları:", {
			screen: rawScreenPath,
			camera: rawCameraPath,
			audio: rawAudioPath,
		});

		// Dosya varlığını kontrol et
		const exists = await window.electron?.ipcRenderer.invoke(
			"CHECK_FILE_EXISTS",
			rawScreenPath
		);
		if (!exists) {
			throw new Error(`Ekran kaydı dosyası bulunamadı: ${rawScreenPath}`);
		}

		// Dosya yollarını ayarla
		screenPath.value = rawScreenPath;

		// Kamera kaydı varsa kontrol et
		if (rawCameraPath) {
			const cameraExists = await window.electron?.ipcRenderer.invoke(
				"CHECK_FILE_EXISTS",
				rawCameraPath
			);
			if (cameraExists) {
				cameraPath.value = rawCameraPath;
			} else {
				console.warn("Kamera kaydı dosyası bulunamadı:", rawCameraPath);
			}
		}

		// Ses kaydı varsa kontrol et
		if (rawAudioPath) {
			const audioExists = await window.electron?.ipcRenderer.invoke(
				"CHECK_FILE_EXISTS",
				rawAudioPath
			);
			if (audioExists) {
				audioPath.value = rawAudioPath;
			} else {
				console.warn("Ses kaydı dosyası bulunamadı:", rawAudioPath);
			}
		}

		console.log("İşlenmiş dosya yolları:", {
			screen: screenPath.value,
			camera: cameraPath.value,
			audio: audioPath.value,
		});

		// Video elementlerini güncelle
		await nextTick();
		if (screenPlayer.value && screenPath.value) {
			const fullPath = `file://${screenPath.value}`;
			console.log("Ekran kaydı yükleniyor:", fullPath);
			screenPlayer.value.src = fullPath;
			await screenPlayer.value.load();
		}

		if (cameraPlayer.value && cameraPath.value) {
			const fullPath = `file://${cameraPath.value}`;
			console.log("Kamera kaydı yükleniyor:", fullPath);
			cameraPlayer.value.src = fullPath;
			await cameraPlayer.value.load();
		}

		// // Crop alanını kontrol et
		// if (route.query.cropArea) {
		// 	cropArea.value = JSON.parse(
		// 		decodeURIComponent(route.query.cropArea as string)
		// 	);
		// 	console.log("Crop alanı yüklendi:", cropArea.value);
		// }
	} catch (error) {
		console.error("Dosya yolları alınırken hata:", error);
		alert(
			"Kayıt dosyaları yüklenirken bir hata oluştu. Lütfen tekrar deneyin."
		);
		throw error; // Hatayı yukarı ilet
	}
};

const exportVideo = async () => {
	try {
		if (!screenPath.value) {
			throw new Error("Ekran kaydı bulunamadı");
		}

		isExporting.value = true;
		exportProgress.value = 0;
		exportStatus.value = {
			frames: 0,
			fps: 0,
			time: "00:00:00.00",
		};

		const savePath = await window.electron?.ipcRenderer.invoke(
			"SHOW_SAVE_DIALOG",
			{
				title: "Videoyu Kaydet",
				defaultPath: `kayit-${Date.now()}.webm`,
				filters: [{ name: "Video", extensions: ["webm"] }],
			}
		);

		if (!savePath) {
			isExporting.value = false;
			return;
		}

		// file:// protokolünü kaldır
		const cleanScreenPath = screenPath.value.replace("file://", "");
		const cleanCameraPath = cameraPath.value
			? cameraPath.value.replace("file://", "")
			: null;
		const cleanAudioPath = audioPath.value
			? audioPath.value.replace("file://", "")
			: null;

		console.log("Export için dosya yolları:", {
			screen: cleanScreenPath,
			camera: cleanCameraPath,
			audio: cleanAudioPath,
			output: savePath,
		});

		// İlerleme durumunu dinle
		window.electron?.ipcRenderer.on("MERGE_STATUS", (_, status) => {
			console.log("Birleştirme durumu:", status);
			exportProgress.value = status.percent || 0;

			exportStatus.value = status;
		});

		await window.electron?.ipcRenderer.invoke("MERGE_VIDEOS", {
			screenPath: cleanScreenPath,
			cameraPath: cleanCameraPath,
			audioPath: cleanAudioPath,
			outputPath: savePath,
			cropArea: cropArea.value,
		});

		alert("Video başarıyla kaydedildi!");
	} catch (error: any) {
		console.error("Video dışa aktarılırken hata:", error);
		alert(`Video dışa aktarılırken bir hata oluştu: ${error.message}`);
	} finally {
		isExporting.value = false;
		exportProgress.value = 0;
		exportStatus.value = {
			frames: 0,
			fps: 0,
			time: "00:00:00.00",
		};
		// Event listener'ı temizle
		window.electron?.ipcRenderer.removeAllListeners("MERGE_STATUS");
	}
};

const isRecording = ref(false);

// Kayıt durumunu izle
watch(isRecording, (newValue) => {
	if (newValue) {
		startRecording();
	} else {
		stopRecording();
	}
});

// Timeline sabitleri ve state'i
const MAX_DURATION = 600; // 10 dakika (saniye cinsinden)
const timelineState = ref({
	scroll: 0,
	isDragging: false,
	dragStartX: 0,
	dragStartScroll: 0,
	zoom: 1,
});

// Timeline sürükleme kontrolleri
const startTimelineDrag = (e: MouseEvent) => {
	timelineState.value.isDragging = true;
	timelineState.value.dragStartX = e.clientX;
	timelineState.value.dragStartScroll = timelineState.value.scroll;

	window.addEventListener("mousemove", handleTimelineDrag);
	window.addEventListener("mouseup", stopTimelineDrag);
};

const handleTimelineDrag = (e: MouseEvent) => {
	if (!timelineState.value.isDragging) return;

	const delta = e.clientX - timelineState.value.dragStartX;
	const maxScroll = (duration.value / MAX_DURATION) * 100 - 100;

	timelineState.value.scroll = Math.max(
		Math.min(timelineState.value.dragStartScroll + delta, 0),
		-maxScroll
	);
};

const stopTimelineDrag = () => {
	timelineState.value.isDragging = false;
	window.removeEventListener("mousemove", handleTimelineDrag);
	window.removeEventListener("mouseup", stopTimelineDrag);
};

// Playhead sürükleme
const isPlayheadDragging = ref(false);
const playheadDragStartX = ref(0);
const playheadDragStartTime = ref(0);

const startPlayheadDrag = (e: MouseEvent) => {
	isPlayheadDragging.value = true;
	playheadDragStartX.value = e.clientX;
	playheadDragStartTime.value = currentTime.value;

	window.addEventListener("mousemove", handlePlayheadDrag);
	window.addEventListener("mouseup", stopPlayheadDrag);
};

const handlePlayheadDrag = (e: MouseEvent) => {
	if (!isPlayheadDragging.value || !screenPlayer.value) return;

	const timeline = e.currentTarget as HTMLElement;
	const rect = timeline.getBoundingClientRect();
	const delta = e.clientX - playheadDragStartX.value;
	const timelineDuration = MAX_DURATION;
	const pixelsPerSecond = rect.width / timelineDuration;
	const timeDelta = delta / pixelsPerSecond;

	const newTime = Math.max(
		0,
		Math.min(playheadDragStartTime.value + timeDelta, duration.value)
	);
	screenPlayer.value.currentTime = newTime;
};

const stopPlayheadDrag = () => {
	isPlayheadDragging.value = false;
	window.removeEventListener("mousemove", handlePlayheadDrag);
	window.removeEventListener("mouseup", stopPlayheadDrag);
};

// Timeline click handler
const handleTimelineClick = (e: MouseEvent) => {
	if (
		e.button === 0 &&
		!timelineState.value.isDragging &&
		!isPlayheadDragging.value
	) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const x = e.clientX - rect.left;
		const normalizedX = x / rect.width;
		const newTime = Math.max(
			0,
			Math.min(normalizedX * MAX_DURATION, duration.value)
		);

		if (screenPlayer.value) {
			screenPlayer.value.currentTime = newTime;
		}
	} else {
		startTimelineDrag(e);
	}
};

// Cleanup
onUnmounted(() => {
	window.removeEventListener("mousemove", handleTimelineDrag);
	window.removeEventListener("mouseup", stopTimelineDrag);
	window.removeEventListener("mousemove", handlePlayheadDrag);
	window.removeEventListener("mouseup", stopPlayheadDrag);
});

onMounted(async () => {
	try {
		// Route'un hazır olmasını bekle
		await nextTick();

		console.log("Route query:", route.query);

		// Route kontrolü
		if (!route.query || !route.query.screen) {
			console.error("Route parametreleri hazır değil veya eksik");
			return;
		}

		// Pencere boyutunu ayarla
		window.electron?.ipcRenderer.send("RESIZE_EDITOR_WINDOW");

		// Medya yollarını yükle
		await getMediaPaths();

		// Event listener'ları ekle
		if (screenPlayer.value) {
			screenPlayer.value.addEventListener("timeupdate", onTimeUpdate);
		}

		window.electron?.ipcRenderer.on(
			"AREA_SELECTED",
			(event: any, area: any) => {
				console.log(123123123123123213);
				cropArea.value = area;
			}
		);

		console.log("Editor sayfası yüklendi:", {
			screenPlayer: !!screenPlayer.value,
			cameraPlayer: !!cameraPlayer.value,
			screenPath: screenPath.value,
			cameraPath: cameraPath.value,
			audioPath: audioPath.value,
		});

		// Editör sayfası açıldığında kamera penceresini kapat
		window.electron.ipcRenderer.send("NAVIGATE_TO_EDITOR");
	} catch (error) {
		console.error("Editor sayfası yüklenirken hata:", error);
		alert("Editor sayfası yüklenirken bir hata oluştu. Lütfen tekrar deneyin.");
	}
});

onUnmounted(() => {
	if (screenPlayer.value) {
		screenPlayer.value.removeEventListener("timeupdate", onTimeUpdate);
	}
	window.removeEventListener("mousemove", onDrag);
	window.removeEventListener("mouseup", endDrag);
});

// Video senkronizasyonu için watch
watch(isPlaying, (newValue) => {
	if (screenPlayer.value && cameraPlayer.value) {
		if (newValue) {
			Promise.all([screenPlayer.value.play(), cameraPlayer.value.play()]).catch(
				console.error
			);
		} else {
			screenPlayer.value.pause();
			cameraPlayer.value.pause();
		}
	}
});

const zoomOut = () => {
	timelineState.value.zoom = Math.max(0.5, timelineState.value.zoom - 0.5);
};

const zoomIn = () => {
	timelineState.value.zoom = Math.min(4, timelineState.value.zoom + 0.5);
};
</script>

<style>
.camera-preview {
	pointer-events: none;
}

/* Kamera önizlemesini gizle */
video[ref="cameraPlayer"] {
	display: none !important;
}
</style>
