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
				<!-- Ekran Kaydı -->
				<div v-if="screenPath" class="space-y-2">
					<h3 class="text-lg font-semibold">Ekran Kaydı</h3>
					<video
						ref="screenPlayer"
						class="w-full rounded-lg"
						controls
						:src="screenPath"
					></video>
				</div>

				<!-- Kamera Kaydı -->
				<div v-if="cameraPath" class="space-y-2">
					<h3 class="text-lg font-semibold">Kamera Kaydı</h3>
					<video
						ref="cameraPlayer"
						class="w-full max-w-md rounded-lg"
						controls
						:src="cameraPath"
					></video>
				</div>

				<!-- Ses Kaydı -->
				<div v-if="audioPath" class="space-y-2">
					<h3 class="text-lg font-semibold">Ses Kaydı</h3>
					<audio
						ref="audioPlayer"
						class="w-full"
						controls
						:src="audioPath"
					></audio>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onActivated, onDeactivated } from "vue";
import { useRouter, useRoute } from "vue-router";

const router = useRouter();
const route = useRoute();
const screenPath = ref("");
const cameraPath = ref("");
const audioPath = ref("");
const screenPlayer = ref<HTMLVideoElement | null>(null);
const cameraPlayer = ref<HTMLVideoElement | null>(null);
const audioPlayer = ref<HTMLAudioElement | null>(null);
const isExporting = ref(false);

const closeWindow = () => {
	window.electron?.ipcRenderer.send("WINDOW_CLOSE");
};

const startNewRecording = async () => {
	await router.push("/");
};

const getMediaPaths = async () => {
	try {
		// URL'den dosya yollarını al ve decode et
		screenPath.value = route.query.screen
			? decodeURIComponent(route.query.screen as string)
			: "";
		cameraPath.value = route.query.camera
			? decodeURIComponent(route.query.camera as string)
			: "";
		audioPath.value = route.query.audio
			? decodeURIComponent(route.query.audio as string)
			: "";

		console.log("Ham dosya yolları:", {
			screen: screenPath.value,
			camera: cameraPath.value,
			audio: audioPath.value,
		});

		// Dosyaların varlığını kontrol et
		if (
			screenPath.value &&
			!(await window.electron?.ipcRenderer.invoke(
				"CHECK_FILE_EXISTS",
				screenPath.value
			))
		) {
			console.error("Ekran kaydı dosyası bulunamadı:", screenPath.value);
			screenPath.value = "";
		}

		if (
			cameraPath.value &&
			!(await window.electron?.ipcRenderer.invoke(
				"CHECK_FILE_EXISTS",
				cameraPath.value
			))
		) {
			console.error("Kamera kaydı dosyası bulunamadı:", cameraPath.value);
			cameraPath.value = "";
		}

		if (
			audioPath.value &&
			!(await window.electron?.ipcRenderer.invoke(
				"CHECK_FILE_EXISTS",
				audioPath.value
			))
		) {
			console.error("Ses kaydı dosyası bulunamadı:", audioPath.value);
			audioPath.value = "";
		}

		// Video elementleri için file:// protokolünü ekle
		if (screenPath.value) screenPath.value = `file://${screenPath.value}`;
		if (cameraPath.value) cameraPath.value = `file://${cameraPath.value}`;
		if (audioPath.value) audioPath.value = `file://${audioPath.value}`;

		console.log("İşlenmiş dosya yolları:", {
			screen: screenPath.value,
			camera: cameraPath.value,
			audio: audioPath.value,
		});
	} catch (error) {
		console.error("Dosya yolları alınırken hata:", error);
	}
};

const exportVideo = async () => {
	try {
		isExporting.value = true;

		// Dosya yollarını kontrol et ve file:// protokolünü kaldır
		const cleanScreenPath = screenPath.value.replace("file://", "");
		if (!cleanScreenPath) {
			throw new Error("Ekran kaydı bulunamadı");
		}

		console.log("Dosya yolları:", {
			screen: cleanScreenPath,
			camera: cameraPath.value?.replace("file://", ""),
			audio: audioPath.value?.replace("file://", ""),
		});

		// Kullanıcıdan kayıt yeri seç
		const savePath = await window.electron?.ipcRenderer.invoke(
			"SHOW_SAVE_DIALOG",
			{
				title: "Videoyu Kaydet",
				defaultPath: "kayit.webm",
				filters: [{ name: "Video", extensions: ["webm"] }],
			}
		);

		if (!savePath) {
			isExporting.value = false;
			return;
		}

		// FFmpeg ile videoları birleştir
		await window.electron?.ipcRenderer.invoke("MERGE_VIDEOS", {
			screenPath: cleanScreenPath,
			cameraPath: cameraPath.value
				? cameraPath.value.replace("file://", "")
				: null,
			audioPath: audioPath.value
				? audioPath.value.replace("file://", "")
				: null,
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
	// Pencere yüksekliğini artır
	window.electron?.ipcRenderer.send("RESIZE_EDITOR_WINDOW");
	// Video yollarını al
	await getMediaPaths();
});

// Sayfa her aktif olduğunda medya yollarını güncelle
onActivated(async () => {
	await getMediaPaths();
});

// Sayfa deaktive olduğunda medya oynatıcılarını durdur
onDeactivated(() => {
	if (screenPlayer.value) {
		screenPlayer.value.pause();
		screenPlayer.value.currentTime = 0;
	}
	if (cameraPlayer.value) {
		cameraPlayer.value.pause();
		cameraPlayer.value.currentTime = 0;
	}
	if (audioPlayer.value) {
		audioPlayer.value.pause();
		audioPlayer.value.currentTime = 0;
	}
});
</script>
