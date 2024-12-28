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
					:value="device.deviceId"
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

	<!-- Başlık çubuğu -->
</template>

<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted, onBeforeUnmount } from "vue";
import { useMediaDevices } from "~/composables/useMediaDevices";

const preview = ref<HTMLVideoElement | null>(null);
const cameraPreview = ref<HTMLVideoElement | null>(null);
let mediaRecorder: MediaRecorder | null = null;

const selectedSource = ref<"display" | "window" | "area">("display");
const systemAudioEnabled = ref(true);

const {
	videoDevices,
	audioDevices,
	selectedVideoDevice,
	selectedAudioDevice,
	currentCameraStream,
	getDevices,
	isRecording,
	recordedChunks,
	mediaStream,
	startRecording: startMediaStream,
	stopRecording: stopMediaStream,
	saveRecording,
} = useMediaDevices();

// Pencere sürükleme için değişkenler
const isDragging = ref(false);
const startPosition = ref({ x: 0, y: 0 });

// Alan seçimi için değişkenler
const selectedArea = ref<{
	x: number;
	y: number;
	width: number;
	height: number;
} | null>(null);

// Kamera pozisyonu için değişkenler
const cameraPosition = ref({ x: 20, y: 20 });
const isCameraDragging = ref(false);
const cameraDragOffset = ref({ x: 0, y: 0 });

const closeWindow = () => {
	window.electron?.windowControls.close();
};

const toggleSystemAudio = () => {
	systemAudioEnabled.value = !systemAudioEnabled.value;
};

const selectSource = (source: "display" | "window" | "area") => {
	selectedSource.value = source;
	if (source === "area") {
		window.electron?.ipcRenderer.send("START_AREA_SELECTION");
	}
};

onMounted(async () => {
	// Cihazları yükle
	await getDevices();

	// Electron API'si yüklendiyse event listener'ları ekle
	if (window.electron?.ipcRenderer) {
		// Alan seçimi event listener'ı
		window.electron.ipcRenderer.on("AREA_SELECTED", (event: any, area: any) => {
			console.log("Ham alan seçimi:", area);

			// Ekran ölçeğini hesapla
			const screenScale = window.devicePixelRatio || 1;

			// Seçilen alanı ekran pozisyonuna göre ayarla
			selectedArea.value = {
				x: Math.round(area.x * screenScale),
				y: Math.round(area.y * screenScale),
				width: Math.round(area.width * screenScale),
				height: Math.round(area.height * screenScale),
			};

			console.log("Düzeltilmiş alan seçimi:", {
				screenScale,
				originalArea: area,
				adjustedArea: selectedArea.value,
				rawY: area.y,
				scaledY: area.y * screenScale,
				finalY: selectedArea.value.y,
			});
		});

		// Tray'den kayıt kontrolü için event listener'lar
		window.electron.ipcRenderer.on("START_RECORDING_FROM_TRAY", () => {
			startRecording();
		});

		window.electron.ipcRenderer.on("STOP_RECORDING_FROM_TRAY", () => {
			stopRecording();
		});

		// Yeni kayıt için sıfırlama
		window.electron.ipcRenderer.send("RESET_FOR_NEW_RECORDING");
	}
});

// Kayıt durumu değiştiğinde tray'i güncelle
watch(isRecording, (newValue) => {
	window.electron?.ipcRenderer.send("RECORDING_STATUS_CHANGED", newValue);
});

// Temizlik işlemleri
onBeforeUnmount(() => {
	// Event listener'ları temizle
	if (window.electron?.ipcRenderer) {
		window.electron.ipcRenderer.removeAllListeners("AREA_SELECTED");
		window.electron.ipcRenderer.removeAllListeners("START_RECORDING_FROM_TRAY");
		window.electron.ipcRenderer.removeAllListeners("STOP_RECORDING_FROM_TRAY");
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
		let streamOptions = {};

		// Seçilen alana göre stream seçeneklerini ayarla
		if (selectedSource.value === "area" && selectedArea.value) {
			console.log("1. Seçili alan ile kayıt başlatılıyor:", selectedArea.value);
			streamOptions = {
				x: selectedArea.value.x,
				y: selectedArea.value.y,
				width: selectedArea.value.width,
				height: selectedArea.value.height,
			};
		}

		// Kayıt başlat
		console.log("2. Stream başlatılıyor...");
		const { screenStream, cameraStream } = await startMediaStream(
			streamOptions
		);
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
					screenRecorder.stop();
					if (cameraRecorder) cameraRecorder.stop();
					if (audioRecorder) audioRecorder.stop();

					// Tüm kayıtlar bittiğinde editör sayfasına yönlendir
					await saveRecording(
						{
							screen: screenChunks,
							camera: cameraChunks,
							audio: audioChunks,
						},
						selectedSource.value === "area" ? selectedArea.value : null
					);
				},
			};

			console.log("8. Tüm MediaRecorder'lar başlatıldı");
			isRecording.value = true;
		}
	} catch (error) {
		console.error("Kayıt başlatılırken hata:", error);
	}
};

const stopRecording = async () => {
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
};

// Pencere sürükleme işleyicileri
const handleMouseDown = (e: MouseEvent) => {
	window.electron?.windowControls.startDrag({ x: e.screenX, y: e.screenY });
};

const handleMouseMove = (e: MouseEvent) => {
	window.electron?.windowControls.dragging({ x: e.screenX, y: e.screenY });
};

const handleMouseUp = () => {
	window.electron?.windowControls.endDrag();
};

// Kamera sürükleme işleyicileri
const startCameraDrag = (e: MouseEvent) => {
	e.stopPropagation();
	isCameraDragging.value = true;
	const rect = (e.target as HTMLElement).getBoundingClientRect();
	cameraDragOffset.value = {
		x: e.clientX - rect.left,
		y: e.clientY - rect.top,
	};
};

const dragCamera = (e: MouseEvent) => {
	e.stopPropagation();
	if (!isCameraDragging.value) return;

	const container = preview.value?.parentElement;
	if (!container) return;

	const rect = container.getBoundingClientRect();
	const newX = e.clientX - rect.left - cameraDragOffset.value.x;
	const newY = e.clientY - rect.top - cameraDragOffset.value.y;

	// Sınırlar içinde tutma
	const maxX = rect.width - 200;
	const maxY = rect.height - 200;

	cameraPosition.value = {
		x: Math.max(0, Math.min(maxX, newX)),
		y: Math.max(0, Math.min(maxY, newY)),
	};
};

const endCameraDrag = (e: MouseEvent) => {
	e.stopPropagation();
	isCameraDragging.value = false;
};

watch(currentCameraStream, (stream) => {
	const cameraPreview =
		document.querySelector<HTMLVideoElement>("#cameraPreview");
	if (cameraPreview && stream) {
		cameraPreview.srcObject = stream;
	}
});

const openCameraWindow = () => {
	window.electron?.ipcRenderer.send("OPEN_CAMERA_WINDOW");
};

// Kamera değişikliğini izle
watch(selectedVideoDevice, async (newDeviceId) => {
	if (newDeviceId) {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					deviceId: { exact: newDeviceId },
					width: 320,
					height: 320,
				},
			});

			// Kamera penceresine yeni stream'i gönder
			window.electron?.ipcRenderer.send("UPDATE_CAMERA_STREAM", stream.id);
		} catch (error) {
			console.error("Kamera değiştirme hatası:", error);
		}
	}
});

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
const startDrag = (event: MouseEvent) => {
	window.electron?.ipcRenderer.send("START_WINDOW_DRAG", {
		x: event.screenX,
		y: event.screenY,
	});
};

const drag = (event: MouseEvent) => {
	window.electron?.ipcRenderer.send("WINDOW_DRAGGING", {
		x: event.screenX,
		y: event.screenY,
	});
};

const endDrag = () => {
	window.electron?.ipcRenderer.send("END_WINDOW_DRAG");
};
</script>
