<template>
	<div class="min-h-screen bg-[#1a1b26] text-white">
		<!-- Üst Bar -->
		<div
			class="fixed top-0 left-0 right-0 bg-[#1a1b26]/80 backdrop-blur-3xl border-b border-gray-700 z-50"
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
						<span>{{
							isExporting ? "Dışa Aktarılıyor..." : "Dışa Aktar"
						}}</span>
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

		<!-- Editör İçeriği -->
		<div class="pt-20 p-4">
			<div class="max-w-6xl mx-auto space-y-4">
				<!-- Ana Önizleme -->
				<div
					class="relative w-full aspect-video bg-black rounded-lg overflow-hidden"
				>
					<!-- Ekran Kaydı -->
					<video
						ref="screenPlayer"
						class="w-full h-full"
						preload="auto"
						@loadedmetadata="onScreenLoaded"
						@error="(e) => console.error('Ekran kaydı yüklenirken hata:', e)"
					></video>

					<!-- Kamera Kaydı (PiP) -->
					<video
						v-if="cameraPath"
						ref="cameraPlayer"
						class="absolute right-4 bottom-4 w-1/4 rounded-lg shadow-lg"
						preload="auto"
						@loadedmetadata="onCameraLoaded"
						@error="(e) => console.error('Kamera kaydı yüklenirken hata:', e)"
					></video>
				</div>

				<!-- Timeline -->
				<div class="bg-gray-800 rounded-lg p-4 space-y-4">
					<!-- Zaman Göstergesi -->
					<div class="flex justify-between text-sm text-gray-400">
						<span>{{ formatTime(currentTime) }}</span>
						<span>{{ formatTime(duration) }}</span>
					</div>

					<!-- Ana Timeline -->
					<div class="relative h-24 bg-gray-700 rounded">
						<!-- Ekran Kaydı Timeline -->
						<div class="absolute top-0 left-0 h-8 w-full bg-blue-500/20">
							<div
								class="h-full bg-blue-500"
								:style="{ width: `${(currentTime / duration) * 100}%` }"
							></div>
						</div>

						<!-- Kamera Timeline -->
						<div
							v-if="cameraPath"
							class="absolute top-8 left-0 h-8 w-full bg-green-500/20"
						>
							<div
								class="h-full bg-green-500"
								:style="{ width: `${(currentTime / duration) * 100}%` }"
							></div>
						</div>

						<!-- Ses Timeline -->
						<div
							v-if="audioPath"
							class="absolute top-16 left-0 h-8 w-full bg-red-500/20"
						>
							<div
								class="h-full bg-red-500"
								:style="{ width: `${(currentTime / duration) * 100}%` }"
							></div>
						</div>

						<!-- Playhead -->
						<div
							class="absolute top-0 h-full w-0.5 bg-white"
							:style="{ left: `${(currentTime / duration) * 100}%` }"
						></div>

						<!-- Timeline Kontrolü -->
						<input
							type="range"
							class="absolute bottom-0 left-0 w-full opacity-0 cursor-pointer"
							:min="0"
							:max="duration"
							:value="currentTime"
							@input="seekTo"
							step="0.01"
						/>
					</div>

					<!-- Kontrol Butonları -->
					<div class="flex items-center justify-center space-x-4">
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
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";

const router = useRouter();
const route = useRoute();

const screenPath = ref("");
const cameraPath = ref("");
const audioPath = ref("");
const screenPlayer = ref<HTMLVideoElement | null>(null);
const cameraPlayer = ref<HTMLVideoElement | null>(null);
const isExporting = ref(false);
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);

// Video yükleme işleyicileri
const onScreenLoaded = () => {
	if (screenPlayer.value) {
		duration.value = screenPlayer.value.duration;
		console.log("Ekran kaydı yüklendi:", {
			duration: duration.value,
			videoWidth: screenPlayer.value.videoWidth,
			videoHeight: screenPlayer.value.videoHeight,
		});
	}
};

const onCameraLoaded = () => {
	if (cameraPlayer.value && screenPlayer.value) {
		// Kamera videosunu ana video ile senkronize et
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

		await window.electron?.ipcRenderer.invoke("MERGE_VIDEOS", {
			screenPath: cleanScreenPath,
			cameraPath: cleanCameraPath,
			audioPath: cleanAudioPath,
			outputPath: savePath,
			cropArea: route.query.cropArea
				? JSON.parse(decodeURIComponent(route.query.cropArea as string))
				: null,
		});

		alert("Video başarıyla kaydedildi!");
	} catch (error: any) {
		console.error("Video dışa aktarılırken hata:", error);
		alert(`Video dışa aktarılırken bir hata oluştu: ${error.message}`);
	} finally {
		isExporting.value = false;
	}
};

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
