<template>
	<!-- Üst Kontrol Çubuğu -->
	<div
		class="w-full sticky top-0 z-50 flex items-center space-x-4 rounded-xl bg-[#1a1b26]/90 backdrop-blur-3xl px-4 py-2 text-white border border-gray-700"
		:class="{ 'cursor-grab': !isDragging, 'cursor-grabbing': isDragging }"
		@mousedown="startDrag"
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
		<div style="width: 0.51px" class="h-12 bg-white/30 rounded-full"></div>

		<!-- Ayarlar Butonu -->
		<div class="relative">
			<button
				@click="isSettingsOpen = !isSettingsOpen"
				class="p-2 hover:bg-gray-700 rounded-lg"
				:class="{ 'bg-gray-700': isSettingsOpen }"
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
						d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
			</button>
		</div>

		<!-- Kayıt Kontrolleri -->
		<div class="flex items-center space-x-4 flex-wrap">
			<select
				v-model="selectedVideoDevice"
				class="bg-transparent hover:bg-gray-700 max-w-36 h-[36px] text-white rounded-lg px-3 py-1 text-sm"
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
				class="bg-transparent hover:bg-gray-700 max-w-36 h-[36px] text-white rounded-lg px-3 py-1 text-sm"
			>
				<option
					v-for="device in audioDevices"
					:key="device.deviceId"
					:value="device.deviceId"
				>
					{{ device.label || `Mikrofon ${device.deviceId}` }}
				</option>
			</select>

			<!-- Mikrofon Ses Seviyesi -->
			<button
				class="flex flex-row opacity-50 items-center gap-2 p-2 hover:bg-gray-700 rounded-lg"
				:class="{ '!opacity-100': microphoneEnabled }"
				@click="toggleMicrophone"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						v-if="microphoneEnabled"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
					/>
					<path
						v-else
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
					/>
				</svg>
				<div class="w-12 h-1 rounded-full overflow-hidden">
					<div
						class="h-full bg-green-500 transition-all duration-75"
						:style="{ width: `${microphoneEnabled ? microphoneLevel : 0}%` }"
					></div>
				</div>
			</button>
			<!-- Sistem Sesi -->

			<button
				class="flex flex-row opacity-50 items-center gap-2 p-2 text-white hover:bg-gray-700 rounded-lg"
				:class="{ '!opacity-100': systemAudioEnabled }"
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
						v-if="systemAudioEnabled"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
					/>
					<path
						v-else
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
					/>
				</svg>
				<span class="text-sm">Sistem Sesi</span>
			</button>

			<!-- Kayıt Toggle Butonu -->
			<button
				@click="onRecordButtonClick"
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

	<!-- Ayarlar Paneli -->
	<RecordSettings
		v-if="isSettingsOpen"
		:delay-options="delayOptions"
		v-model="selectedDelay"
		v-model:selected-source="selectedSource"
		v-model:follow-mouse="followMouse"
		@update:selected-source="selectSource"
	/>
</template>

<script setup>
import { onMounted, ref, watch, onUnmounted, onBeforeUnmount } from "vue";
import { useMediaDevices } from "~/composables/useMediaDevices";
import RecordSettings from "~/components/record-settings/index.vue";

// IPC event isimlerini al
const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS || {};

const {
	videoDevices,
	audioDevices,
	selectedVideoDevice,
	selectedAudioDevice,
	mediaStream,
	isRecording,
	systemAudioEnabled,
	microphoneEnabled,
	microphoneLevel,
	currentAudioStream,
	isAudioAnalyserActive,
	selectedDelay,
	getDevices,
	startRecording,
	stopRecording,
	initAudioAnalyser,
	cleanupAudioAnalyser,
	toggleMicrophone,
	toggleSystemAudio,
	throttle,
} = useMediaDevices();

const electron = window.electron;

const closeWindow = () => {
	electron?.windowControls.close();
};

// Delay yönetimi için state
const isSettingsOpen = ref(false);
const delayOptions = [0, 1000, 3000, 5000, 10000]; // 1sn, 3sn, 5sn
const selectedSource = ref(null);
const followMouse = ref(true);

// Delay değişikliğini izle
watch(selectedDelay, (newValue) => {
	if (electron?.ipcRenderer) {
		electron.ipcRenderer.send(
			IPC_EVENTS.UPDATE_RECORDING_DELAY,
			parseInt(newValue)
		);
	}
});

// Pencere boyutunu ayarla
const updateWindowSize = (isOpen) => {
	if (electron?.ipcRenderer) {
		electron.ipcRenderer.send("UPDATE_WINDOW_SIZE", {
			height: isOpen ? 300 : 70, // Ayarlar açıkken 250px, kapalıyken 70px
		});
	}
};

// Ayarlar durumunu izle
watch(isSettingsOpen, (newValue) => {
	updateWindowSize(newValue);
});

// Kaynak seçimi
const selectSource = (source) => {
	selectedSource.value = source;
	if (source === "area") {
		electron?.ipcRenderer.send("START_AREA_SELECTION");
	}
};

// Throttled updateAudioSettings fonksiyonu
const throttledUpdateAudioSettings = throttle((settings) => {
	if (!electron?.ipcRenderer || !IPC_EVENTS?.UPDATE_AUDIO_SETTINGS) {
		console.warn("[index.vue] Electron veya IPC_EVENTS tanımlı değil");
		return;
	}
	try {
		electron.ipcRenderer.send(IPC_EVENTS.UPDATE_AUDIO_SETTINGS, settings);
	} catch (error) {
		console.error("[index.vue] Ses ayarları güncellenirken hata:", error);
	}
}, 1000);

// Mikrofon değişikliğini izle
watch(selectedAudioDevice, async (newDeviceId, oldDeviceId) => {
	if (newDeviceId && newDeviceId !== oldDeviceId) {
		try {
			// MediaState'e yeni mikrofon cihazını bildir
			throttledUpdateAudioSettings({
				selectedAudioDevice: newDeviceId,
			});

			// Ses analizini yeniden başlat
			await initAudioAnalyser();
		} catch (error) {
			console.error("[index.vue] Mikrofon değiştirme hatası:", error);
		}
	}
});

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

// Kayıt başlatma fonksiyonu
const handleStartRecording = async () => {
	try {
		await startRecording({
			systemAudio: systemAudioEnabled.value,
			microphone: microphoneEnabled.value,
			microphoneDeviceId: selectedAudioDevice.value,
			sourceType: selectedSource.value?.type || "display",
			sourceId: selectedSource.value?.id,
		});
	} catch (error) {
		console.error("Kayıt başlatılırken hata:", error);
	}
};

// Kayıt butonuna tıklandığında
const onRecordButtonClick = () => {
	if (isRecording.value) {
		stopRecording();
	} else {
		handleStartRecording();
	}
};

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

onMounted(async () => {
	// Cihazları yükle
	await getDevices();

	// Electron API'si yüklendiyse event listener'ları ekle
	if (electron) {
		// Mouse pozisyonlarını dinle
		electron.ipcRenderer.on("MOUSE_POSITION", (event, position) => {
			// Mouse pozisyonları useMediaDevices composable'ında işleniyor
			console.log("[index.vue] Mouse pozisyonu alındı:", position);
		});

		// MediaState'i al ve ses durumlarını güncelle
		const mediaState = await electron.ipcRenderer.invoke(
			IPC_EVENTS.GET_MEDIA_STATE
		);
		if (mediaState?.audioSettings) {
			microphoneEnabled.value = mediaState.audioSettings.microphoneEnabled;
			systemAudioEnabled.value = mediaState.audioSettings.systemAudioEnabled;
			if (mediaState.audioSettings.selectedAudioDevice) {
				selectedAudioDevice.value =
					mediaState.audioSettings.selectedAudioDevice;
			}
		}

		// MediaState güncellemelerini dinle
		electron.ipcRenderer.on(IPC_EVENTS.MEDIA_STATE_UPDATE, (state) => {
			if (state?.audioSettings) {
				microphoneEnabled.value = state.audioSettings.microphoneEnabled;
				systemAudioEnabled.value = state.audioSettings.systemAudioEnabled;
				if (state.audioSettings.selectedAudioDevice) {
					selectedAudioDevice.value = state.audioSettings.selectedAudioDevice;
				}
			}
		});

		// Tray'den kayıt kontrolü için event listener'lar
		electron.ipcRenderer.on("START_RECORDING_FROM_TRAY", () => {
			startRecording({
				systemAudio: systemAudioEnabled.value,
				microphone: microphoneEnabled.value,
				microphoneDeviceId: selectedAudioDevice.value,
			});
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

	await initAudioAnalyser();

	// Kayıtlı delay değerini al
	if (electron?.ipcRenderer) {
		const delay = await electron.ipcRenderer.invoke(
			IPC_EVENTS.GET_RECORDING_DELAY
		);
		if (delay) {
			selectedDelay.value = delay;
		}
	}
});

// Kayıt durumu değiştiğinde tray'i güncelle
watch(isRecording, (newValue) => {
	if (electron?.ipcRenderer) {
		console.log("[index.vue] Kayıt durumu değişti:", newValue);
		electron.ipcRenderer.send(IPC_EVENTS.RECORDING_STATUS_CHANGED, newValue);
	}
});

// Temizlik işlemleri
onBeforeUnmount(() => {
	// Event listener'ları temizle
	if (electron) {
		electron.ipcRenderer.removeAllListeners("AREA_SELECTED");
		electron.ipcRenderer.removeAllListeners("START_RECORDING_FROM_TRAY");
		electron.ipcRenderer.removeAllListeners("STOP_RECORDING_FROM_TRAY");
		electron.ipcRenderer.removeAllListeners("CAMERA_STATUS_CHANGED");
		electron.ipcRenderer.removeAllListeners("MOUSE_POSITION");
	}
});

onUnmounted(() => {
	window.removeEventListener("mousemove", handleGlobalMouseMove);
	window.removeEventListener("mouseup", handleGlobalMouseUp);
	cleanupAudioAnalyser();
});
</script>

<style>
.camera-preview {
	pointer-events: none;
}

/* Geri sayım animasyonu */
@keyframes countdown {
	from {
		transform: scale(1.2);
		opacity: 0;
	}
	to {
		transform: scale(1);
		opacity: 1;
	}
}

.countdown-number {
	animation: countdown 0.5s ease-out;
}
</style>
