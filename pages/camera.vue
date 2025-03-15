<template>
	<div
		class="camera-container"
		:class="{ 'cursor-grab': !isDragging, 'cursor-grabbing': isDragging }"
		@mousedown="startDrag"
	>
		<video
			v-show="!isLoading"
			ref="videoRef"
			autoplay
			muted
			playsinline
			class="camera-video"
			:style="{ visibility: isVideoReady ? 'visible' : 'hidden' }"
		></video>
		<div
			v-if="isLoading"
			class="text-white transition-all duration-300 ease-in-out text-center text-xs bg-[#1a1b26]/90 rounded-full w-full h-full flex items-center justify-center"
		>
			Camera is starting...
		</div>
		<div
			v-if="false"
			class="absolute max-w-[220px] bottom-6 text-xl text-white bg-purple-600 text-center rounded-full rounded-tl-none px-4 py-2"
		>
			aslanon
		</div>
		<svg v-if="false" class="circular-text" viewBox="0 0 100 100">
			<path
				id="curve"
				fill="transparent"
				d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0"
			/>
			<text>
				<textPath href="#curve" class="text-content">
					✌️ instagram/dev.onur
				</textPath>
			</text>
		</svg>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from "vue";

const electron = window.electron;
const videoRef = ref(null);
const isLoading = ref(true);
const isVideoReady = ref(false);
const activeDeviceId = ref(null);
let stream = null;
let streamStartTime = 0;
let loadingTimer = null;
let retryAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;

// Performans optimizasyonu için video ayarları
const videoConstraints = computed(() => ({
	deviceId: activeDeviceId.value ? { exact: activeDeviceId.value } : undefined,
	width: { ideal: 1280 }, // Daha düşük çözünürlük başlatma için
	height: { ideal: 720 },
	frameRate: { ideal: 30, max: 30 },
}));

// Sürükleme durumu için ref'ler
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

// Video hazır olduğunda tetiklenecek
const handleVideoReady = () => {
	if (videoRef.value && videoRef.value.readyState >= 2) {
		isVideoReady.value = true;
		isLoading.value = false;

		// Kamera başlatıldı, ana pencereye bildir
		if (activeDeviceId.value) {
			electron?.ipcRenderer.send("CAMERA_STATUS_CHANGED", {
				status: "active",
				deviceId: activeDeviceId.value,
			});
		}

		// Temizle
		if (loadingTimer) {
			clearTimeout(loadingTimer);
			loadingTimer = null;
		}
	}
};

// Kamerayı başlat
const startCamera = async () => {
	try {
		if (stream) {
			await stopCamera();
		}
		isLoading.value = true;
		isVideoReady.value = false;
		retryAttempts = 0;

		// MediaStream sınıfı temizlenir ve tekrar başlatılır
		stream = await navigator.mediaDevices.getUserMedia({
			video: videoConstraints.value,
			audio: false,
		});

		streamStartTime = performance.now();

		if (videoRef.value) {
			// Video elementini hazırla
			videoRef.value.srcObject = stream;

			// Video yükleme olaylarını dinle
			videoRef.value.onloadeddata = handleVideoReady;
			videoRef.value.oncanplay = handleVideoReady;

			// Yedek yükleme zamanlayıcısı (fallback)
			if (loadingTimer) clearTimeout(loadingTimer);
			loadingTimer = setTimeout(() => {
				if (!isVideoReady.value) {
					handleVideoReady();
				}
			}, 1000);
		}
	} catch (error) {
		console.error("Kamera başlatılırken hata:", error);
		isLoading.value = false;
		// Hata durumunu ana pencereye bildir
		electron?.ipcRenderer.send("CAMERA_STATUS_CHANGED", {
			status: "error",
			error: error.message,
		});

		// Yeniden deneme mekanizması
		if (retryAttempts < MAX_RETRY_ATTEMPTS) {
			retryAttempts++;
			setTimeout(() => {
				startCamera();
			}, 500 * retryAttempts);
		}
	}
};

// Kamerayı durdur - asenkron yapıldı ve kaynaklar temizlendi
const stopCamera = async () => {
	if (loadingTimer) {
		clearTimeout(loadingTimer);
		loadingTimer = null;
	}

	isVideoReady.value = false;

	// Video elementinden dinleyicileri kaldır
	if (videoRef.value) {
		videoRef.value.onloadeddata = null;
		videoRef.value.oncanplay = null;
		videoRef.value.srcObject = null;
	}

	// Stream'i durdur ve hafızayı temizle
	if (stream) {
		const tracks = stream.getTracks();
		await Promise.all(
			tracks.map((track) => {
				track.stop();
				return new Promise((resolve) => setTimeout(resolve, 0));
			})
		);
		stream = null;
	}

	// GC'yi zorlayarak bellek temizleme ipucu ver
	if (window.gc) window.gc();
};

// Belirli bir kamera cihazına geçiş yapmak için yeni fonksiyon
const changeCamera = async (deviceId) => {
	if (!deviceId || deviceId === "undefined") return;

	try {
		console.log("[camera.vue] Kamera değiştiriliyor, deviceId:", deviceId);
		activeDeviceId.value = deviceId;

		await stopCamera();
		isLoading.value = true;

		// Yeni kamerayı başlat
		await startCamera();
	} catch (error) {
		console.error("[camera.vue] Kamera değiştirilirken hata:", error);
		isLoading.value = false;

		// Hata durumunu ana pencereye bildir
		electron?.ipcRenderer.send("CAMERA_STATUS_CHANGED", {
			status: "error",
			deviceId: deviceId,
			error: error.message,
		});
	}
};

// Component mount olduğunda
onMounted(() => {
	// Sayfa ayarları
	if (document) {
		document.body.style.overflow = "hidden";
		document.body.style.backgroundColor = "transparent";
		document.documentElement.style.backgroundColor = "transparent";
	}

	// Hardware acceleration ipucu
	if (videoRef.value) {
		videoRef.value.style.backfaceVisibility = "hidden";
		videoRef.value.style.transform = "translateZ(0) scaleX(-1)";
		videoRef.value.style.willChange = "transform";
	}

	// Kamera başlat
	startCamera();

	// Kamera kontrol mesajlarını dinle
	electron?.ipcRenderer.on("STOP_CAMERA", () => {
		stopCamera();
	});

	electron?.ipcRenderer.on("START_CAMERA", () => {
		startCamera();
	});

	// Kamera cihazı değişikliğini dinle
	electron?.ipcRenderer.on("UPDATE_CAMERA_DEVICE", (deviceId) => {
		console.log("[camera.vue] Kamera cihazı değişikliği alındı:", deviceId);
		if (deviceId && deviceId !== "undefined") {
			changeCamera(deviceId);
		}
	});
});

// Component unmount olduğunda
onUnmounted(() => {
	stopCamera();
	if (window.electron) {
		window.electron.ipcRenderer.removeAllListeners("STOP_CAMERA");
		window.electron.ipcRenderer.removeAllListeners("START_CAMERA");
		window.electron.ipcRenderer.removeAllListeners("UPDATE_CAMERA_DEVICE");
	}
	// Sürükleme event listener'larını temizle
	window.removeEventListener("mousemove", handleGlobalMouseMove);
	window.removeEventListener("mouseup", handleGlobalMouseUp);

	// Zamanlayıcıları temizle
	if (loadingTimer) {
		clearTimeout(loadingTimer);
		loadingTimer = null;
	}
});
</script>

<style scoped>
.camera-container {
	width: 100%;
	height: 100%;
	border-radius: 50%;
	padding: 0rem;
	overflow: hidden;
	position: relative;
	display: flex;
	justify-content: center;
	align-items: center;
	aspect-ratio: 1;
	-webkit-app-region: no-drag; /* Electron'un varsayılan sürükleme davranışını devre dışı bırak */
	background-color: transparent !important;
	background: transparent !important;
}

.camera-video {
	width: 100%;
	height: 100%;
	box-shadow: 0 0 10px 0px rgba(0, 0, 0, 0.25);
	object-fit: cover;
	border-radius: 50%;
	transform: scaleX(-1); /* Ayna görüntüsü için */
	/* Hardware-acceleration için ek stil */
	backface-visibility: hidden;
	will-change: transform;
	transform: translateZ(0) scaleX(-1);
}

.circular-text {
	position: absolute;
	width: 100%;
	height: 100%;
	font-size: 5px;
	font-weight: bold;
	letter-spacing: 1px;
	/* animation: rotate 20s linear infinite; */
}

.text-content {
	fill: white;
	stroke: black;
	stroke-width: 1px;
	paint-order: stroke fill; /* Önce stroke sonra fill uygula */
}

@keyframes rotate {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}
</style>
