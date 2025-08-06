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
				@click="openRecordingSettings"
				class="p-2 hover:bg-gray-700 rounded-lg"
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
			<!-- Editör Modu Butonu -->
			<button
				@click="openEditorMode"
				class="p-2 hover:bg-gray-700 rounded-lg"
				title="Go to Editor Without Recording"
			>
				<svg
					width="24"
					height="24"
					class="h-5 w-5"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M3.375 19.5H20.625M3.375 19.5C2.75368 19.5 2.25 18.9963 2.25 18.375M3.375 19.5H4.875C5.49632 19.5 6 18.9963 6 18.375M2.25 18.375V5.625M2.25 18.375V16.875C2.25 16.2537 2.75368 15.75 3.375 15.75M21.75 18.375V5.625M21.75 18.375C21.75 18.9963 21.2463 19.5 20.625 19.5M21.75 18.375V16.875C21.75 16.2537 21.2463 15.75 20.625 15.75M20.625 19.5H19.125C18.5037 19.5 18 18.9963 18 18.375M20.625 4.5H3.375M20.625 4.5C21.2463 4.5 21.75 5.00368 21.75 5.625M20.625 4.5H19.125C18.5037 4.5 18 5.00368 18 5.625M21.75 5.625V7.125C21.75 7.74632 21.2463 8.25 20.625 8.25M3.375 4.5C2.75368 4.5 2.25 5.00368 2.25 5.625M3.375 4.5H4.875C5.49632 4.5 6 5.00368 6 5.625M2.25 5.625V7.125C2.25 7.74632 2.75368 8.25 3.375 8.25M3.375 8.25H4.875M3.375 8.25C2.75368 8.25 2.25 8.75368 2.25 9.375V10.875C2.25 11.4963 2.75368 12 3.375 12M4.875 8.25C5.49632 8.25 6 7.74632 6 7.125V5.625M4.875 8.25C5.49632 8.25 6 8.75368 6 9.375V10.875M6 5.625V10.875M6 5.625C6 5.00368 6.50368 4.5 7.125 4.5H16.875C17.4963 4.5 18 5.00368 18 5.625M19.125 8.25H20.625M19.125 8.25C18.5037 8.25 18 7.74632 18 7.125V5.625M19.125 8.25C18.5037 8.25 18 8.75368 18 9.375V10.875M20.625 8.25C21.2463 8.25 21.75 8.75368 21.75 9.375V10.875C21.75 11.4963 21.2463 12 20.625 12M18 5.625V10.875M7.125 12H16.875M7.125 12C6.50368 12 6 11.4963 6 10.875M7.125 12C6.50368 12 6 12.5037 6 13.125M6 10.875C6 11.4963 5.49632 12 4.875 12M18 10.875C18 11.4963 17.4963 12 16.875 12M18 10.875C18 11.4963 18.5037 12 19.125 12M16.875 12C17.4963 12 18 12.5037 18 13.125M6 18.375V13.125M6 18.375C6 18.9963 6.50368 19.5 7.125 19.5H16.875C17.4963 19.5 18 18.9963 18 18.375M6 18.375V16.875C6 16.2537 5.49632 15.75 4.875 15.75M18 18.375V13.125M18 18.375V16.875C18 16.2537 18.5037 15.75 19.125 15.75M18 13.125V14.625C18 15.2463 18.5037 15.75 19.125 15.75M18 13.125C18 12.5037 18.5037 12 19.125 12M6 13.125V14.625C6 15.2463 5.49632 15.75 4.875 15.75M6 13.125C6 12.5037 5.49632 12 4.875 12M3.375 12H4.875M3.375 12C2.75368 12 2.25 12.5037 2.25 13.125V14.625C2.25 15.2463 2.75368 15.75 3.375 15.75M19.125 12H20.625M20.625 12C21.2463 12 21.75 12.5037 21.75 13.125V14.625C21.75 15.2463 21.2463 15.75 20.625 15.75M3.375 15.75H4.875M19.125 15.75H20.625"
						stroke="white"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>

		<!-- Kayıt Kontrolleri -->
		<div class="flex items-center space-x-4 flex-wrap">
			<!-- Recording Type Selection -->
			<div class="flex items-center space-x-2">
				<!-- Screen Recording Button -->
				<button
					@click="selectRecordingType('screen')"
					class="p-2 hover:bg-gray-700 rounded-lg"
					title="Screen Recording"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
					</svg>
				</button>

				<!-- Window Recording Button -->
				<button
					@click="selectRecordingType('window')"
					class="p-2 hover:bg-gray-700 rounded-lg"
					title="Window Recording"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
					</svg>
				</button>

				<!-- Dynamic Window Overlay Button -->
				<button
					@click="startDynamicOverlay"
					class="p-2 hover:bg-gray-700 rounded-lg"
					title="Pencere Seç ve Kayıt Başlat (Screen Studio style)"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
					</svg>
				</button>

				<!-- Area Recording Button -->
				<button
					@click="selectRecordingType('area')"
					class="p-2 hover:bg-gray-700 rounded-lg"
					title="Area Recording"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
					</svg>
				</button>
			</div>


			<select
				v-model="selectedVideoDevice"
				class="bg-transparent hover:bg-gray-700 max-w-36 h-[36px] text-white rounded-lg px-3 py-1 text-sm"
			>
				<option value="none">No Camera Recording</option>
				<option
					v-for="device in videoDevices"
					:key="device.deviceId"
					:value="device.deviceId"
				>
					{{ device.label || `Camera ${device.deviceId}` }}
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
					{{ device.label || `Microphone ${device.deviceId}` }}
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
				<span class="text-sm">System Audio</span>
			</button>

			<!-- Cursor tracking butonu kaldırıldı - artık gerçek kayıt sistemiyle entegre -->

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
				<span>{{ isRecording ? "Stop" : "Record" }}</span>
			</button>
		</div>
	</div>



</template>

<script setup>
import { onMounted, ref, watch, onUnmounted, onBeforeUnmount } from "vue";
import { useMediaDevices } from "~/composables/useMediaDevices";
import { useScreen } from "~/composables/modules/useScreen";


const electron = window.electron;
const IPC_EVENTS = electron?.ipcRenderer?.IPC_EVENTS || {};

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

const closeWindow = () => {
	electron?.windowControls.close();
};

// Delay yönetimi için state
const delayOptions = [0, 1000, 3002, 5000, 10000]; // 1sn, 3sn, 5sn
const selectedSource = ref(null);
const followMouse = ref(true);

// Recording type management
const availableScreens = ref([]);
const availableWindows = ref([]);

// Cursor tracking state kaldırıldı - artık gerçek kayıt sistemiyle entegre

// Yeni Kayıt state'i kaldırıldı

watch(followMouse, (newValue) => {
	if (electron?.ipcRenderer) {
		electron.ipcRenderer.send("TOGGLE_CAMERA_FOLLOW", newValue);
	}
});

// Delay değişikliğini izle
watch(selectedDelay, (newValue) => {
	if (electron?.ipcRenderer) {
		electron.ipcRenderer.send(
			IPC_EVENTS.UPDATE_RECORDING_DELAY,
			parseInt(newValue)
		);
	}
});


// Kayıt düğmesi işlevi
const onRecordButtonClick = async () => {
	try {
		if (isRecording.value) {
			await stopRecording();
		} else {
			// MediaState'den güncel kaynak bilgisini al

			let currentRecordingSource = null;
			try {
				const mediaState = await electron?.ipcRenderer?.invoke(
					"GET_MEDIA_STATE"
				);
				currentRecordingSource = mediaState?.recordingSource;
			} catch (error) {
				console.warn("🔧 [index.vue] MediaState alınamadı:", error);
			}

			// Kaynak seçimi kontrolü
			let recordingOptions = {};

			// MediaState'de kaynak varsa onu kullan
			if (currentRecordingSource && currentRecordingSource.sourceId) {

				recordingOptions = {
					startScreen: true,
					startCamera: selectedVideoDevice.value !== 'none', // No camera if 'none' selected
					startAudio: true,
				};
			} else {
				console.warn(
					"🔧 [index.vue] ⚠️ MediaState'de kaynak yok, default display ayarlanıyor"
				);

				// Default kaynak ayarla
				await electron?.ipcRenderer?.invoke("UPDATE_RECORDING_SOURCE", {
					sourceType: "display",
					sourceId: "screen:0",
					sourceName: "Display 1",
					macRecorderId: 0,
				});


				// 200ms bekle ki MediaState güncellensin
				await new Promise((resolve) => setTimeout(resolve, 200));

				recordingOptions = {
					startScreen: true,
					startCamera: selectedVideoDevice.value !== 'none', // No camera if 'none' selected
					startAudio: true,
				};
			}

			// Kayıt başlat
			await startRecording(recordingOptions);
		}
	} catch (error) {
		console.error("Kayıt işleminde hata:", error);
	}
};

// Editör modunu açma fonksiyonu
const openEditorMode = () => {
	if (electron?.ipcRenderer) {
		// Editör modunu aç
		electron.ipcRenderer.send(IPC_EVENTS.OPEN_EDITOR_MODE);
	}
};

// toggleCursorTracking fonksiyonu kaldırıldı - cursor capture artık gerçek kayıt sistemiyle entegre

// Yeni Kayıt fonksiyonu kaldırıldı - artık sadece "Kaydet" butonu var

// Recording type selection - now triggers native overlays
const selectRecordingType = async (type) => {
	try {
		if (electron?.ipcRenderer) {
			if (type === 'screen') {
				// Trigger native screen selection overlay
				electron.ipcRenderer.send('SHOW_NATIVE_SCREEN_SELECTOR');
			} else if (type === 'window') {
				// Trigger native window selection overlay
				electron.ipcRenderer.send('SHOW_NATIVE_WINDOW_SELECTOR');
			} else if (type === 'area') {
				// Trigger native area selection overlay
				electron.ipcRenderer.send('SHOW_NATIVE_AREA_SELECTOR');
			}
		}
	} catch (error) {
		console.error('Error triggering native selector:', error);
	}
};

// Dynamic Window Overlay - Screen Studio style with WindowSelector
const startDynamicOverlay = () => {
	try {
		if (window.electronAPI?.startDynamicWindowOverlay) {
			console.log('Starting native WindowSelector overlay...');
			window.electronAPI.startDynamicWindowOverlay();
		} else {
			console.error('Dynamic window overlay API not available');
		}
	} catch (error) {
		console.error('Error starting dynamic window overlay:', error);
	}
};

// Handle window selection and start recording
onMounted(() => {
	if (window.electron?.ipcRenderer) {
		// Handle window selection and start recording immediately
		window.electron.ipcRenderer.on('START_WINDOW_RECORDING', async (event, data) => {
			console.log('Starting window recording:', data.windowInfo);
			
			// Set selected source for UI display
			selectedSource.value = data.source;
			
			try {
				// Prepare recording options with crop info
				const recordingOptions = {
					startScreen: true,
					startCamera: selectedVideoDevice.value !== 'none',
					startAudio: true,
					systemAudio: systemAudioEnabled.value,
					microphone: microphoneEnabled.value,
					microphoneDeviceId: selectedAudioDevice.value,
					cropArea: data.cropInfo, // Pass crop info for window recording
					windowId: data.windowInfo.id,
					selectedSource: data.source
				};
				
				console.log('[Vue] Starting recording with options:', recordingOptions);
				
				// Start recording using Sleer's recording system
				await startRecording(recordingOptions);
				
				console.log(`🎬 Kayıt başladı: ${data.windowInfo.title} (${data.windowInfo.appName})`);
				
			} catch (error) {
				console.error('Recording start failed:', error);
				console.log(`❌ Kayıt başlatılamadı: ${error.message}`);
			}
		});
	}
});

// Load available screens and windows
const loadAvailableSources = async () => {
	try {
		if (electron?.ipcRenderer) {
			const [screens, windows] = await Promise.all([
				electron.ipcRenderer.invoke('GET_MAC_SCREENS') || [],
				electron.ipcRenderer.invoke('GET_MAC_WINDOWS') || []
			]);
			
			availableScreens.value = screens.map((screen, index) => ({
				id: screen.id ? `screen:${screen.id}` : `screen:${index}`,
				name: screen.name || screen.displayName || `Display ${screen.id || index + 1}`,
				type: 'display',
				macRecorderId: screen.id || index
			}));
			
			availableWindows.value = windows.map((window, index) => ({
				id: window.id ? `window:${window.id}` : `window:${index}`,
				name: window.name || window.title || window.windowName || 'Unknown Window',
				type: 'window',
				macRecorderId: window.id || index
			}));
		}
	} catch (error) {
		console.error('Failed to load recording sources:', error);
	}
};

// Kaynak seçimi
const selectSource = (source) => {
	selectedSource.value = source;

	// Alan seçimi ise özel bir işlem yap
	if (source.type === "area") {
		if (electron?.ipcRenderer) {
			electron.ipcRenderer.send(
				electron.ipcRenderer.IPC_EVENTS.START_AREA_SELECTION
			);
		}
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

			// Mikrofon değişikliğini main process'e bildir
			if (electron?.ipcRenderer) {
				electron.ipcRenderer.send(IPC_EVENTS.AUDIO_DEVICE_CHANGED, newDeviceId);
			}

			// Eski yöntem - MediaState'e yeni mikrofon cihazını bildir
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
watch(selectedVideoDevice, async (deviceId) => {
	if (deviceId) {
		try {
			// "No Camera Recording" seçilirse kamera penceresini gizle
			if (deviceId === 'none') {
				console.log('[index.vue] No camera recording selected - hiding camera window');
				if (electron?.ipcRenderer) {
					electron.ipcRenderer.send('HIDE_CAMERA_WINDOW');
				}
				return;
			}

			// Kamera değişikliğini main process'e bildir
			if (electron?.ipcRenderer) {
				// Önce kamera penceresini göster (gizlenmişse)
				electron.ipcRenderer.send('SHOW_CAMERA_WINDOW');
				// Sonra device değişikliğini gönder
				electron.ipcRenderer.send(IPC_EVENTS.CAMERA_DEVICE_CHANGED, deviceId);
			} else {
				console.error("[index.vue] Electron API bulunamadı");
			}
		} catch (error) {
			console.error("[index.vue] Kamera değişikliği sırasında hata:", error);
		}
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

const openRecordingSettings = () => {
	if (electron?.ipcRenderer) {
		electron.ipcRenderer.send('SHOW_RECORDING_SETTINGS');
	}
};

const handleSettingsSave = (settings) => {
	console.log('[index.vue] Recording settings saved:', settings);
	// TODO: Save settings to localStorage or electron-store
	// TODO: Apply settings to recording configuration
	
	// Example of applying some settings:
	if (settings.video) {
		console.log('Applying video settings:', settings.video);
	}
	if (settings.audio) {
		console.log('Applying audio settings:', settings.audio);
	}
	if (settings.source) {
		console.log('Applying source settings:', settings.source);
	}
};

onMounted(async () => {
	const screenModule = useScreen();

	// Cihazları yükle
	await getDevices();

	// Load available recording sources
	await loadAvailableSources();

	// MacRecorder test fonksiyonu
	if (electron?.ipcRenderer) {
		try {
			const [screens, windows] = await Promise.all([
				electron.macRecorder.getDisplays(),
				electron.macRecorder.getWindows(),
			]);
		} catch (testError) {
			console.error("[index.vue] MacRecorder API test hatası:", testError);
		}
	}

	// ✅ KESIN ÇÖZÜM: Direkt Display 1 seç

	const defaultSource = {
		sourceType: "display",
		sourceId: "screen:0",
		sourceName: "Display 1",
		macRecorderId: 0,
	};


	// IPC ile kaynak seçimini bildir
	if (electron?.ipcRenderer) {
		electron.ipcRenderer.send("UPDATE_RECORDING_SOURCE", defaultSource);
	}

	// Electron API'si yüklendiyse event listener'ları ekle
	if (electron) {
		// Mouse pozisyonlarını dinle
		electron.ipcRenderer.on("MOUSE_POSITION", (event, position) => {
			// Mouse pozisyonları useMediaDevices composable'ında işleniyor
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
			} else if (statusData.status === "error") {
				console.error("Kamera hatası:", statusData.error);
			}
		});

		// Native overlay callbacks
		electron.ipcRenderer.on("NATIVE_SCREEN_SELECTED", async (event, screenData) => {
			try {
				// Set selected screen and start recording
				await electron.ipcRenderer.invoke("UPDATE_RECORDING_SOURCE", {
					sourceType: 'display',
					sourceId: screenData.id,
					sourceName: screenData.name,
					macRecorderId: screenData.macRecorderId || 0,
				});
				
				// Start recording
				await startRecording({
					startScreen: true,
					startCamera: selectedVideoDevice.value !== 'none',
					startAudio: true,
				});
			} catch (error) {
				console.error('Error starting screen recording:', error);
			}
		});

		electron.ipcRenderer.on("NATIVE_WINDOW_SELECTED", async (event, windowData) => {
			try {
				// Set selected window and start recording
				await electron.ipcRenderer.invoke("UPDATE_RECORDING_SOURCE", {
					sourceType: 'window',
					sourceId: windowData.id,
					sourceName: windowData.name,
					macRecorderId: windowData.macRecorderId || 0,
				});
				
				// Start recording
				await startRecording({
					startScreen: true,
					startCamera: selectedVideoDevice.value !== 'none',
					startAudio: true,
				});
			} catch (error) {
				console.error('Error starting window recording:', error);
			}
		});

		electron.ipcRenderer.on("NATIVE_AREA_SELECTED", async (event, areaData) => {
			try {
				// Set selected area and start recording
				await electron.ipcRenderer.invoke("UPDATE_RECORDING_SOURCE", {
					sourceType: 'area',
					sourceId: 'area:custom',
					sourceName: 'Selected Area',
					bounds: areaData.bounds
				});
				
				// Start recording
				await startRecording({
					startScreen: true,
					startCamera: selectedVideoDevice.value !== 'none',
					startAudio: true,
				});
			} catch (error) {
				console.error('Error starting area recording:', error);
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
		electron.ipcRenderer.removeAllListeners("NATIVE_SCREEN_SELECTED");
		electron.ipcRenderer.removeAllListeners("NATIVE_WINDOW_SELECTED");
		electron.ipcRenderer.removeAllListeners("NATIVE_AREA_SELECTED");
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
