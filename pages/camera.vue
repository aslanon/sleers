<template>
	<div
		class="w-full h-full bg-transparent rounded-full overflow-hidden"
		@mousedown="handleMouseDown"
		@mousemove="handleDrag"
		@mouseup="handleMouseUp"
	>
		<video
			ref="videoElement"
			class="w-full h-full object-cover transform scale-x-[-1]"
			autoplay
			playsinline
			muted
		></video>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useIpcState } from "~/composables/useIpcState";
import { useMediaDevices } from "~/composables/useMediaDevices";

const videoElement = ref<HTMLVideoElement | null>(null);
const isDragging = ref(false);
const cameraPosition = ref<{ x: number; y: number } | null>(null);

// Mouse hareketi için değişkenler
const lastMousePositions = ref<{ x: number; y: number }[]>([]);
const lastShakeTime = ref<number>(0);
const SHAKE_THRESHOLD = 800; // Hız eşiği
const SHAKE_TIME_WINDOW = 500; // Son 500ms içindeki hareketleri kontrol et
const REQUIRED_MOVEMENTS = 5; // Gerekli hareket sayısı

const { videoDevices, selectedVideoDevice, currentCameraStream, getDevices } =
	useMediaDevices();
const { ipcState, addIpcListener, removeIpcListener, sendIpcMessage } =
	useIpcState();

// Kamera stream'ini başlat
const startCamera = async () => {
	try {
		if (!selectedVideoDevice.value) {
			await getDevices();
		}

		// Önceki stream'i kapat
		if (videoElement.value?.srcObject) {
			const stream = videoElement.value.srcObject as MediaStream;
			stream.getTracks().forEach((track) => track.stop());
		}

		const stream = await navigator.mediaDevices.getUserMedia({
			video: {
				deviceId: selectedVideoDevice.value
					? { exact: selectedVideoDevice.value }
					: undefined,
				width: { ideal: 1280 },
				height: { ideal: 720 },
				frameRate: { ideal: 30 },
				aspectRatio: 1,
			},
			audio: false,
		});

		if (videoElement.value) {
			videoElement.value.srcObject = stream;
			currentCameraStream.value = stream;
			await videoElement.value.play().catch(console.error);
		}
	} catch (error) {
		console.error("Kamera başlatma hatası:", error);
	}
};

// IPC mesajlarını dinle
const setupIpcListeners = () => {
	addIpcListener("SELECT_VIDEO_DEVICE", async (deviceId) => {
		console.log("Yeni kamera seçildi:", deviceId);
		if (deviceId !== selectedVideoDevice.value) {
			selectedVideoDevice.value = deviceId;
			await startCamera();
		}
	});
};

onMounted(async () => {
	// IPC listener'ları ekle
	setupIpcListeners();

	// Kamerayı başlat
	await startCamera();

	// Kamera pozisyonunu al
	sendIpcMessage("GET_CAMERA_POSITION", null);
	addIpcListener("CAMERA_POSITION", (position) => {
		if (position) {
			cameraPosition.value = position;
		}
	});

	// Çift tıklama olayını dinle
	window.addEventListener("dblclick", toggleCameraSize);

	// Sallama algılama için mouse hareketlerini dinle
	window.addEventListener("mousemove", handleMouseMove);
});

onUnmounted(() => {
	// Stream'i kapat
	if (videoElement.value?.srcObject) {
		const stream = videoElement.value.srcObject as MediaStream;
		stream.getTracks().forEach((track) => track.stop());
	}

	// Event listener'ları temizle
	window.removeEventListener("dblclick", toggleCameraSize);
	window.removeEventListener("mousemove", handleMouseMove);
	removeIpcListener("SELECT_VIDEO_DEVICE", () => {});
	removeIpcListener("CAMERA_POSITION", () => {});

	// Pencereyi kapat
	sendIpcMessage("CLOSE_CAMERA_WINDOW", null);
});

// Sürükleme işleyicileri
const startDrag = (event: MouseEvent) => {
	if (event.button === 0) {
		// Sol tık
		isDragging.value = true;
		sendIpcMessage("START_WINDOW_DRAG", { x: event.clientX, y: event.clientY });
	}
};

const drag = (e: MouseEvent) => {
	if (!isDragging.value) return;
	sendIpcMessage("WINDOW_DRAGGING", {
		x: e.screenX,
		y: e.screenY,
	});
};

const endDrag = () => {
	if (isDragging.value) {
		isDragging.value = false;
		sendIpcMessage("END_WINDOW_DRAG", null);
	}
};

// Mouse hareketi işleyicisi
const handleMouseMove = (event: MouseEvent) => {
	const currentTime = Date.now();
	const { clientX, clientY } = event;

	// Son pozisyonu ekle
	lastMousePositions.value.push({ x: clientX, y: clientY });

	// Son 5 pozisyonu tut
	if (lastMousePositions.value.length > REQUIRED_MOVEMENTS) {
		lastMousePositions.value.shift();
	}

	// Sallama hareketini kontrol et
	if (lastMousePositions.value.length === REQUIRED_MOVEMENTS) {
		let totalDistance = 0;
		for (let i = 1; i < lastMousePositions.value.length; i++) {
			const prev = lastMousePositions.value[i - 1];
			const curr = lastMousePositions.value[i];
			const distance = Math.sqrt(
				Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
			);
			totalDistance += distance;
		}

		// Minimum mesafe ve zaman kontrolü
		const MIN_DISTANCE = 200; // Minimum toplam mesafe
		const MIN_TIME_BETWEEN_SHAKES = 1000; // Minimum sallamalar arası süre (ms)

		if (
			totalDistance > MIN_DISTANCE &&
			currentTime - lastShakeTime.value > MIN_TIME_BETWEEN_SHAKES
		) {
			lastShakeTime.value = currentTime;
			toggleCameraSize();
		}
	}
};

const toggleCameraSize = () => {
	sendIpcMessage("TOGGLE_CAMERA_SIZE", null);
};

// Sürükleme işleyicileri
const handleMouseDown = (event: MouseEvent) => {
	if (event.button === 0) {
		// Sol tık
		isDragging.value = true;
		sendIpcMessage("START_WINDOW_DRAG", { x: event.clientX, y: event.clientY });
	}
};

const handleMouseUp = () => {
	if (isDragging.value) {
		isDragging.value = false;
		sendIpcMessage("END_WINDOW_DRAG", null);
	}
};

const handleDrag = (event: MouseEvent) => {
	if (isDragging.value) {
		sendIpcMessage("WINDOW_DRAGGING", { x: event.clientX, y: event.clientY });
	}
};

const dragging = (event: MouseEvent) => {
	if (isDragging.value) {
		sendIpcMessage("WINDOW_DRAGGING", { x: event.clientX, y: event.clientY });
	}
};
</script>
