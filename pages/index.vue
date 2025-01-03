<template>
	<!-- Üst Kontrol Çubuğu -->
	<div
		class="w-full flex items-center space-x-4 rounded-xl bg-[#1a1b26]/80 backdrop-blur-3xl p-4 text-white border border-gray-700 cursor-move"
		@mousedown="startDrag"
		@mousemove="drag"
		@mouseup="endDrag"
		@mouseleave="endDrag"
	>
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

		<!-- Kayıt Kontrolleri -->
		<div class="flex items-center space-x-2">
			<button
				class="p-2 hover:bg-gray-700 rounded-lg"
				:class="{ 'bg-gray-700': selectedSource === 'display' }"
				@click="selectSource('display')"
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
						d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
					/>
				</svg>
			</button>
			<button
				class="p-2 hover:bg-gray-700 rounded-lg"
				:class="{ 'bg-gray-700': selectedSource === 'window' }"
				@click="selectSource('window')"
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
						d="M4 6h16M4 10h16M4 14h16M4 18h16"
					/>
				</svg>
			</button>
			<button
				class="p-2 hover:bg-gray-700 rounded-lg"
				:class="{ 'bg-gray-700': selectedSource === 'area' }"
				@click="selectSource('area')"
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
						d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
					/>
				</svg>
			</button>
		</div>

		<!-- Kamera ve Mikrofon Seçimi -->
		<div class="flex items-center space-x-2 flex-wrap">
			<select
				v-model="selectedVideoDevice"
				class="bg-gray-700 h-[36px] max-w-32 text-white rounded-lg px-3 py-1 text-sm"
			>
				<option
					v-for="device in videoDevices"
					:key="device.deviceId"
					:value="device.label"
				>
					{{ device.label || `Kamera ${device.deviceId}` }}
				</option>
			</select>

			<select
				v-model="selectedAudioDevice"
				class="bg-gray-700 max-w-32 h-[36px] text-white rounded-lg px-3 py-1 text-sm"
			>
				<option
					v-for="device in audioDevices"
					:key="device.deviceId"
					:value="device.deviceId"
				>
					{{ device.label || `Mikrofon ${device.deviceId}` }}
				</option>
			</select>

			<!-- Sistem Sesi Toggle -->
			<button
				class="p-2 hover:bg-gray-700 rounded-lg"
				:class="{ 'bg-gray-700': systemAudioEnabled }"
				@click="toggleSystemAudio"
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
						d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
					/>
				</svg>
			</button>

			<!-- Kayıt Toggle Butonu -->
			<button
				@click="isRecording ? stopRecording() : startRecording()"
				class="flex items-center space-x-2 h-[36px] px-4 py-2 rounded-lg"
				:class="
					isRecording
						? 'bg-red-600 hover:bg-red-700'
						: 'bg-gray-700 hover:bg-gray-600'
				"
			>
				<span class="w-2 h-2 rounded-full bg-white" v-if="isRecording"></span>
				<span>{{ isRecording ? "Durdur" : "Kaydet" }}</span>
			</button>
		</div>
	</div>
</template>

<script setup>
import { onMounted, ref, watch, onUnmounted, onBeforeUnmount } from "vue";
import { useMediaDevices } from "~/composables/useMediaDevices";

let mediaRecorder = null;

const selectedSource = ref("display");
const systemAudioEnabled = ref(true);

const {
	videoDevices,
	audioDevices,
	selectedVideoDevice,
	selectedAudioDevice,
	getDevices,
	isRecording,
	mediaStream,
	startRecording: startMediaStream,
	stopRecording: stopMediaStream,
	saveRecording,
} = useMediaDevices();

const electron = window.electron;

const closeWindow = () => {
	electron?.windowControls.close();
};

const toggleSystemAudio = () => {
	systemAudioEnabled.value = !systemAudioEnabled.value;
};

const selectSource = (source) => {
	selectedSource.value = source;
	if (source === "area") {
		electron?.ipcRenderer.send("START_AREA_SELECTION");
	}
};

// Kamera değişikliği izleyicisi
watch(selectedVideoDevice, async (deviceLabel) => {
	if (deviceLabel) {
		try {
			console.log("[index.vue] Seçilen kamera label:", deviceLabel);
			// Kamera değişikliğini main process'e bildir
			electron?.ipcRenderer.send("CAMERA_DEVICE_CHANGED", deviceLabel);
			console.log(
				"[index.vue] Kamera değişikliği main process'e gönderildi:",
				deviceLabel
			);
		} catch (error) {
			console.error("[index.vue] Kamera değişikliği sırasında hata:", error);
		}
	}
});

onMounted(async () => {
	// Cihazları yükle
	await getDevices();

	// Electron API'si yüklendiyse event listener'ları ekle
	if (electron) {
		// Alan seçimi event listener'ı

		// Tray'den kayıt kontrolü için event listener'lar
		electron.ipcRenderer.on("START_RECORDING_FROM_TRAY", () => {
			startRecording();
		});

		electron.ipcRenderer.on("STOP_RECORDING_FROM_TRAY", () => {
			stopRecording();
		});

		// Kamera durumunu dinle
		electron.ipcRenderer.on("CAMERA_STATUS_CHANGED", (event, statusData) => {
			if (statusData.status === "active") {
				console.log("Kamera aktif:", statusData.deviceId);
			} else if (statusData.status === "error") {
				console.error("Kamera hatası:", statusData.error);
			}
		});

		// Yeni kayıt için sıfırlama
		electron.ipcRenderer.send("RESET_FOR_NEW_RECORDING");
	}
});

// Kayıt durumu değiştiğinde tray'i güncelle
watch(isRecording, (newValue) => {
	electron?.ipcRenderer.send("RECORDING_STATUS_CHANGED", newValue);
});

// Temizlik işlemleri
onBeforeUnmount(() => {
	// Event listener'ları temizle
	if (electron) {
		electron.ipcRenderer.removeAllListeners("AREA_SELECTED");
		electron.ipcRenderer.removeAllListeners("START_RECORDING_FROM_TRAY");
		electron.ipcRenderer.removeAllListeners("STOP_RECORDING_FROM_TRAY");
		electron.ipcRenderer.removeAllListeners("CAMERA_STATUS_CHANGED");
	}
});

onUnmounted(() => {
	// Olay dinleyicilerini temizle
	document.removeEventListener("mousedown", handleMouseDown);
	document.removeEventListener("mousemove", handleMouseMove);
	document.removeEventListener("mouseup", handleMouseUp);
});

const startRecording = async () => {
	try {
		isRecording.value = true;

		// Kayıt başlamadan önce body'e recording sınıfını ekle
		document.body.classList.add("recording");

		// Kayıt başlat
		console.log("2. Stream başlatılıyor...");
		const { screenStream, cameraStream } = await startMediaStream({
			audio: {
				mandatory: {
					chromeMediaSource: "desktop",
				},
			},
			video: {
				mandatory: {
					chromeMediaSource: "desktop",
				},
			},
		});
		console.log("3. Stream başlatıldı");

		// Her stream için ayrı MediaRecorder oluştur
		if (mediaStream.value) {
			console.log("4. MediaRecorder'lar oluşturuluyor");

			// Ekran kaydı için recorder
			const screenRecorder = new MediaRecorder(screenStream, {
				mimeType: "video/webm;codecs=vp9",
				videoBitsPerSecond: 50000000,
			});

			// Kamera kaydı için recorder (eğer varsa)
			let cameraRecorder = null;
			if (cameraStream) {
				cameraRecorder = new MediaRecorder(cameraStream, {
					mimeType: "video/webm;codecs=vp9",
					videoBitsPerSecond: 8000000,
				});
			}

			// Ses kaydı için recorder
			let audioRecorder = null;
			if (mediaStream.value.getAudioTracks().length > 0) {
				const audioStream = new MediaStream(mediaStream.value.getAudioTracks());
				audioRecorder = new MediaRecorder(audioStream, {
					mimeType: "audio/webm;codecs=opus",
					audioBitsPerSecond: 320000,
				});
			}

			// Ekran kaydı chunks
			const screenChunks = [];
			screenRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					screenChunks.push(event.data);
				}
			};

			// Kamera kaydı chunks
			const cameraChunks = [];
			if (cameraRecorder) {
				cameraRecorder.ondataavailable = (event) => {
					if (event.data.size > 0) {
						cameraChunks.push(event.data);
					}
				};
			}

			// Ses kaydı chunks
			const audioChunks = [];
			if (audioRecorder) {
				audioRecorder.ondataavailable = (event) => {
					if (event.data.size > 0) {
						audioChunks.push(event.data);
					}
				};
			}

			// Tüm recorder'ları başlat
			screenRecorder.start(1000);
			if (cameraRecorder) cameraRecorder.start(1000);
			if (audioRecorder) audioRecorder.start(1000);

			// Global mediaRecorder referansını güncelle
			mediaRecorder = {
				screen: screenRecorder,
				camera: cameraRecorder,
				audio: audioRecorder,
				stop: async () => {
					// Kayıt durduğunda recording sınıfını kaldır
					document.body.classList.remove("recording");

					screenRecorder.stop();
					if (cameraRecorder) cameraRecorder.stop();
					if (audioRecorder) audioRecorder.stop();

					// Tüm kayıtlar bittiğinde editör sayfasına yönlendir
					await saveRecording({
						screen: screenChunks,
						camera: cameraChunks,
						audio: audioChunks,
					});
				},
			};

			console.log("8. Tüm MediaRecorder'lar başlatıldı");
			isRecording.value = true;
		}
	} catch (error) {
		console.error("Kayıt başlatılırken hata:", error);
		// Hata durumunda recording sınıfını kaldır
		document.body.classList.remove("recording");
		isRecording.value = false;
	}
};

const stopRecording = async () => {
	isRecording.value = false;

	try {
		console.log("1. Kayıt durdurma başlatıldı");
		if (mediaRecorder) {
			console.log("2. MediaRecorder'lar durduruluyor");
			await mediaRecorder.stop();
			mediaRecorder = null;
		}
		console.log("3. Stream durduruluyor");
		await stopMediaStream();
		console.log("4. Kayıt durdurma tamamlandı");
		isRecording.value = false;
	} catch (error) {
		console.error("Kayıt durdurulurken hata:", error);
	}

	// Temizlik işlemleri
	document.body.classList.remove("recording");
};

// Pencere sürükleme işleyicileri
const handleMouseDown = (e) => {
	electron?.windowControls.startDrag({ x: e.screenX, y: e.screenY });
};

const handleMouseMove = (e) => {
	electron?.windowControls.dragging({ x: e.screenX, y: e.screenY });
};

const handleMouseUp = () => {
	electron?.windowControls.endDrag();
};

// Mikrofon değişikliğini izle
watch(selectedAudioDevice, async (newDeviceId) => {
	if (newDeviceId) {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					deviceId: { exact: newDeviceId },
				},
			});

			// Yeni ses stream'ini kayıt için sakla
			currentAudioStream.value = stream;
		} catch (error) {
			console.error("Mikrofon değiştirme hatası:", error);
		}
	}
});

// Pencere sürükleme fonksiyonları
const startDrag = (event) => {
	electron?.ipcRenderer.send("START_WINDOW_DRAG", {
		x: event.screenX,
		y: event.screenY,
	});
};

const drag = (event) => {
	electron?.ipcRenderer.send("WINDOW_DRAGGING", {
		x: event.screenX,
		y: event.screenY,
	});
};

const endDrag = () => {
	electron?.ipcRenderer.send("END_WINDOW_DRAG");
};
</script>

<style>
.camera-preview {
	pointer-events: none;
}
</style>
