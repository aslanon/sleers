<template>
	<div class="min-h-screen bg-[#1a1b26]/10 text-white">
		<!-- Alan Seçimi Overlay -->
		<div v-if="isSelectingArea" class="fixed inset-0 z-50">
			<div
				class="absolute inset-0 cursor-crosshair"
				@mousedown="startAreaSelection"
				@mousemove="updateAreaSelection"
				@mouseup="endAreaSelection"
			>
				<div
					v-if="selectedArea"
					class="absolute border-2 border-blue-500 bg-blue-500/20"
					:style="{
						left: `${selectedArea.x}px`,
						top: `${selectedArea.y}px`,
						width: `${selectedArea.width}px`,
						height: `${selectedArea.height}px`,
					}"
				>
					<div
						class="absolute -top-6 left-0 bg-blue-500 text-white px-2 py-1 text-sm rounded-t-md"
					>
						{{ selectedArea.width }} x {{ selectedArea.height }}
					</div>
				</div>
			</div>
		</div>

		<!-- Üst Kontrol Çubuğu -->
		<div
			class="fixed top-0 left-0 right-0 bg-[#1a1b26]/80 backdrop-blur-sm p-4 border-b border-gray-700"
		>
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-4">
					<button @click="closeWindow" class="p-2 hover:bg-gray-700 rounded-lg">
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
					<div class="flex items-center space-x-2">
						<select
							v-model="selectedVideoDevice"
							class="bg-gray-700 text-white rounded-lg px-3 py-1 text-sm"
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
							class="bg-gray-700 text-white rounded-lg px-3 py-1 text-sm"
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
							class="flex items-center space-x-2 px-4 py-2 rounded-lg"
							:class="
								isRecording
									? 'bg-red-600 hover:bg-red-700'
									: 'bg-gray-700 hover:bg-gray-600'
							"
						>
							<span
								class="w-2 h-2 rounded-full bg-white"
								v-if="isRecording"
							></span>
							<span>{{ isRecording ? "Durdur" : "Kaydet" }}</span>
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Başlık çubuğu -->
		<div
			class="h-8 bg-[#1a1b26] flex items-center justify-between px-4 cursor-move"
			@mousedown="startDrag"
			@mousemove="drag"
			@mouseup="endDrag"
			@mouseleave="endDrag"
		>
			<div class="flex items-center space-x-2">
				<button
					class="p-1 hover:bg-gray-700 rounded"
					@click="selectSource('display')"
				>
					<Icon name="material-symbols:desktop-windows-outline" size="20" />
				</button>
				<button
					class="p-1 hover:bg-gray-700 rounded"
					@click="selectSource('window')"
				>
					<Icon name="material-symbols:window-outline" size="20" />
				</button>
				<button
					class="p-1 hover:bg-gray-700 rounded"
					@click="selectSource('area')"
				>
					<Icon name="material-symbols:crop-free" size="20" />
				</button>
			</div>
			<button class="p-1 hover:bg-gray-700 rounded" @click="closeWindow">
				<Icon name="material-symbols:close" size="20" />
			</button>
		</div>

		<!-- Ana İçerik -->
		<div class="pt-20 p-4">
			<div class="grid grid-cols-1 gap-4">
				<!-- Alan seçimi için gerekli olan overlay -->
				<div v-if="isSelectingArea" class="fixed inset-0 z-50">
					<div
						class="absolute inset-0 cursor-crosshair"
						@mousedown="startAreaSelection"
						@mousemove="updateAreaSelection"
						@mouseup="endAreaSelection"
					>
						<div
							v-if="selectedArea"
							class="absolute border-2 border-blue-500 bg-blue-500/20"
							:style="{
								left: `${selectedArea.x}px`,
								top: `${selectedArea.y}px`,
								width: `${selectedArea.width}px`,
								height: `${selectedArea.height}px`,
							}"
						>
							<div
								class="absolute -top-6 left-0 bg-blue-500 text-white px-2 py-1 text-sm rounded-t-md"
							>
								{{ selectedArea.width }} x {{ selectedArea.height }}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Kayıt Kontrolleri -->
		<div class="fixed bottom-4 left-1/2 transform -translate-x-1/2">
			<div
				class="flex items-center space-x-4 bg-gray-800/80 backdrop-blur-sm rounded-full px-6 py-3"
			>
				<button
					@click="startRecording"
					:disabled="isRecording"
					class="flex items-center space-x-2 px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-50"
				>
					<span class="w-2 h-2 rounded-full bg-white" v-if="isRecording"></span>
					<span>{{ isRecording ? "Kaydediliyor..." : "Kaydı Başlat" }}</span>
				</button>
				<button
					v-if="isRecording"
					@click="stopRecording"
					class="px-4 py-2 rounded-full bg-gray-700 hover:bg-gray-600"
				>
					Kaydı Durdur
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted } from "vue";
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
	startRecording: startMediaStream,
	stopRecording: stopMediaStream,
	saveRecording,
} = useMediaDevices();

// Pencere sürükleme için değişkenler
const isDragging = ref(false);
const startPosition = ref({ x: 0, y: 0 });

// Alan seçimi için değişkenler
const isSelectingArea = ref(false);
const selectionStart = ref({ x: 0, y: 0 });
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
		isSelectingArea.value = true;
	}
};

onMounted(async () => {
	await getDevices();
});

onUnmounted(() => {
	// Olay dinleyicilerini temizle
	document.removeEventListener("mousedown", handleMouseDown);
	document.removeEventListener("mousemove", handleMouseMove);
	document.removeEventListener("mouseup", handleMouseUp);
});

const startRecording = async () => {
	try {
		const streamOptions = {
			video: {
				mandatory: {
					chromeMediaSource: "desktop",
					minWidth: 1280,
					maxWidth: 1920,
					minHeight: 720,
					maxHeight: 1080,
				},
			},
		};

		// Alan seçimi varsa koordinatları ekle
		if (selectedSource.value === "area" && selectedArea.value) {
			streamOptions.video.mandatory = {
				...streamOptions.video.mandatory,
				x: selectedArea.value.x,
				y: selectedArea.value.y,
				width: selectedArea.value.width,
				height: selectedArea.value.height,
			};
		}

		const { screenStream, cameraStream } = await startMediaStream(
			streamOptions
		);

		// Önizleme için stream'i ayarla
		if (preview.value) {
			preview.value.srcObject = screenStream;
			await preview.value
				.play()
				.catch((e) => console.error("Ekran önizleme hatası:", e));
		}

		// Kamera önizlemesi için stream'i ayarla
		if (cameraPreview.value && cameraStream) {
			cameraPreview.value.srcObject = cameraStream;
			await cameraPreview.value
				.play()
				.catch((e) => console.error("Kamera önizleme hatası:", e));
		}

		// MediaRecorder ayarları
		const options = {
			mimeType: "video/webm;codecs=h264",
			videoBitsPerSecond: 2500000,
			audioBitsPerSecond: 128000,
		};

		if (!MediaRecorder.isTypeSupported(options.mimeType)) {
			console.warn("H264 codec desteklenmiyor, varsayılan codec kullanılacak");
			options.mimeType = "video/webm";
		}

		mediaRecorder = new MediaRecorder(screenStream, options);
		mediaRecorder.ondataavailable = (e) => {
			if (e.data && e.data.size > 0) {
				recordedChunks.value.push(e.data);
			}
		};
		mediaRecorder.onstop = () => {
			saveRecording(recordedChunks.value);
			recordedChunks.value = [];
		};
		mediaRecorder.onerror = (error) => {
			console.error("MediaRecorder hatası:", error);
			stopRecording();
		};

		mediaRecorder.start(1000);
		isRecording.value = true;
	} catch (error) {
		console.error("Kayıt başlatılırken hata oluştu:", error);
		alert("Kayıt başlatılırken bir hata oluştu. Lütfen tekrar deneyin.");
		stopRecording();
	}
};

const stopRecording = () => {
	if (mediaRecorder && mediaRecorder.state !== "inactive") {
		mediaRecorder.stop();
		stopMediaStream();
		if (preview.value) {
			preview.value.srcObject = null;
		}
		if (cameraPreview.value) {
			cameraPreview.value.srcObject = null;
		}
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

// Alan seçimi işleyicileri
const startAreaSelection = (e: MouseEvent) => {
	if (selectedSource.value !== "area") return;
	selectionStart.value = { x: e.clientX, y: e.clientY };
	selectedArea.value = {
		x: e.clientX,
		y: e.clientY,
		width: 0,
		height: 0,
	};
};

const updateAreaSelection = (e: MouseEvent) => {
	if (!isSelectingArea.value) return;

	const x = Math.min(selectionStart.value.x, e.clientX);
	const y = Math.min(selectionStart.value.y, e.clientY);
	const width = Math.abs(e.clientX - selectionStart.value.x);
	const height = Math.abs(e.clientY - selectionStart.value.y);

	selectedArea.value = { x, y, width, height };
};

const endAreaSelection = () => {
	if (!isSelectingArea.value) return;
	isSelectingArea.value = false;
};

// Alan seçimi sıfırlama
watch(selectedSource, (newSource) => {
	if (newSource !== "area") {
		isSelectingArea.value = false;
		selectedArea.value = null;
	}
});

const startDrag = (event) => {
	window.electron?.startDrag({
		x: event.screenX,
		y: event.screenY,
	});
};

const drag = (event) => {
	window.electron?.drag({
		x: event.screenX,
		y: event.screenY,
	});
};

const endDrag = () => {
	window.electron?.endDrag();
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
</script>
