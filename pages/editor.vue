<template>
	<div class="min-h-screen bg-[#1a1b26] text-white">
		<!-- Üst Bar -->
		<div
			class="fixed top-0 left-0 right-0 bg-[#1a1b26]/80 backdrop-blur-3xl border-b border-gray-700 z-50"
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
							class="h-5 w-5"
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

					<!-- Export Butonu -->
					<button
						@click="exportVideo"
						class="flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700"
						:disabled="isExporting"
					>
						<svg
							v-if="!isExporting"
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
							/>
						</svg>
						<svg
							v-else
							class="animate-spin h-5 w-5"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						<div class="flex flex-col items-start" v-if="isExporting">
							<span>Dışa Aktarılıyor...</span>
							<span class="text-xs text-gray-300">
								{{ exportStatus.frames }} kare işlendi | {{ exportStatus.time }}
							</span>
						</div>
						<span v-else>Dışa Aktar</span>
					</button>

					<!-- Yeni Kayıt Butonu -->
					<button
						@click="startNewRecording"
						class="flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 4v16m8-8H4"
							/>
						</svg>
						<span>Yeni Kayıt</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Ana İçerik -->
		<div class="pt-20 p-4 flex min-h-screen">
			<!-- Sol Taraf - Preview ve Timeline -->
			<div class="flex-1 space-y-6 pr-4">
				<!-- Preview Alanı -->
				<div
					class="relative aspect-video bg-[#2a2b36] rounded-3xl overflow-hidden"
				>
					<!-- Ekran Kaydı -->
					<video
						ref="screenPlayer"
						class="w-full h-full"
						:style="{
							objectFit: cropArea?.aspectRatio === 'free' ? 'contain' : 'cover',
							clipPath: cropArea
								? `inset(${(cropArea.y / cropArea.display.height) * 100}% ${
										((cropArea.display.width - (cropArea.x + cropArea.width)) /
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
						@error="(e) => console.error('Ekran kaydı yüklenirken hata:', e)"
					></video>

					<!-- Kamera Kaydı (PiP) -->
					<!-- <video
						v-if="cameraPath"
						ref="cameraPlayer"
						class="absolute hidden right-4 bottom-4 w-48 h-48 object-cover rounded-full shadow-lg"
						preload="auto"
						@loadedmetadata="onCameraLoaded"
						@error="(e) => console.error('Kamera kaydı yüklenirken hata:', e)"
					></video> -->
				</div>

				<!-- Timeline Alanı -->
				<div class="relative">
					<!-- Zaman Göstergesi -->
					<div class="flex justify-between text-sm text-gray-400 mb-2 px-2">
						<div class="flex space-x-4">
							<span>{{ formatTime(currentTime) }}</span>
						</div>
						<span>{{ formatTime(duration) }}</span>
					</div>

					<!-- Timeline'lar Container -->
					<div class="relative">
						<!-- Playhead - Tüm timeline'ları kesen kırmızı çizgi -->
						<div
							class="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
							:style="{ left: `${(currentTime / duration) * 100}%` }"
						>
							<div
								class="absolute -top-1 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full"
							></div>
						</div>

						<!-- Timeline'lar Stack -->
						<div class="relative space-y-px">
							<!-- Ekran Timeline -->
							<div
								class="relative h-16 bg-orange-500/20 rounded-t-2xl overflow-hidden"
							>
								<div
									class="absolute inset-y-0 bg-orange-500/30"
									:style="{ width: `${(currentTime / duration) * 100}%` }"
								></div>
							</div>

							<!-- Kamera Timeline -->
							<div
								v-if="cameraPath"
								class="relative h-16 bg-purple-500/20 overflow-hidden"
							>
								<div
									class="absolute inset-y-0 bg-purple-500/30"
									:style="{ width: `${(currentTime / duration) * 100}%` }"
								></div>
							</div>

							<!-- Ses Timeline -->
							<div
								v-if="audioPath"
								class="relative h-16 bg-green-500/20 rounded-b-2xl overflow-hidden"
							>
								<div
									class="absolute inset-y-0 bg-green-500/30"
									:style="{ width: `${(currentTime / duration) * 100}%` }"
								></div>
							</div>
						</div>

						<!-- Timeline Control -->
						<input
							type="range"
							class="absolute inset-0 w-full opacity-0 cursor-pointer"
							:min="0"
							:max="duration"
							:value="currentTime"
							@input="seekTo"
							step="0.01"
						/>
					</div>

					<!-- Oynatma Kontrolleri -->
					<div class="flex items-center mt-4">
						<button
							@click="togglePlay"
							class="p-2 hover:bg-gray-700 rounded-full"
						>
							<svg
								v-if="isPlaying"
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
							<svg
								v-else
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
						</button>
					</div>
				</div>
			</div>

			<!-- Sağ Taraf - Araçlar -->
			<div class="w-80 space-y-4">
				<!-- Crop Listesi -->
				<div class="bg-[#2a2b36] rounded-2xl p-4 space-y-4">
					<div class="space-y-2">
						<h3 class="text-sm font-medium">Kırpma Alanları</h3>
						<button
							class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
						>
							Alan Seç
						</button>
					</div>
				</div>

				<!-- Tool Properties -->
				<div class="bg-[#2a2b36] rounded-2xl p-4 space-y-2">
					<h3 class="text-sm font-medium">Özellikler</h3>
					<div class="bg-[#1a1b26] rounded-lg p-4">
						<p class="text-sm text-gray-400">Seçili bir araç yok</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Mevcut içerik -->
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

		// Crop alanını kontrol et
		if (route.query.cropArea) {
			cropArea.value = JSON.parse(
				decodeURIComponent(route.query.cropArea as string)
			);
			console.log("Crop alanı yüklendi:", cropArea.value);
		}
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

		console.log("Editor sayfası yüklendi:", {
			screenPlayer: !!screenPlayer.value,
			cameraPlayer: !!cameraPlayer.value,
			screenPath: screenPath.value,
			cameraPath: cameraPath.value,
			audioPath: audioPath.value,
		});
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
