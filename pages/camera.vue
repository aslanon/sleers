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
import { ref, onMounted, onUnmounted } from "vue";

const electron = window.electron;
const videoRef = ref(null);
const isLoading = ref(true);
let stream = null;

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

// Kamerayı başlat
const startCamera = async () => {
	try {
		if (stream) {
			stopCamera();
		}
		isLoading.value = true;

		stream = await navigator.mediaDevices.getUserMedia({
			video: {
				width: { ideal: 1920 },
				height: { ideal: 1080 },
			},
		});

		if (videoRef.value) {
			videoRef.value.srcObject = stream;
			setTimeout(() => {
				isLoading.value = false;
			}, 500);
		}
	} catch (error) {
		console.error("Kamera başlatılırken hata:", error);
	}
};

// Kamerayı durdur
const stopCamera = () => {
	if (stream) {
		stream.getTracks().forEach((track) => track.stop());
		stream = null;
	}
	if (videoRef.value) {
		videoRef.value.srcObject = null;
	}
};

// Component mount olduğunda
onMounted(() => {
	if (document) {
		document.body.style.overflow = "hidden";
	}
	startCamera();

	// Kamera kontrol mesajlarını dinle
	electron?.ipcRenderer.on("STOP_CAMERA", () => {
		stopCamera();
	});

	electron?.ipcRenderer.on("START_CAMERA", () => {
		startCamera();
	});
});

// Component unmount olduğunda
onUnmounted(() => {
	stopCamera();
	if (window.electron) {
		window.electron.ipcRenderer.removeAllListeners("STOP_CAMERA");
		window.electron.ipcRenderer.removeAllListeners("START_CAMERA");
	}
	// Sürükleme event listener'larını temizle
	window.removeEventListener("mousemove", handleGlobalMouseMove);
	window.removeEventListener("mouseup", handleGlobalMouseUp);
});
</script>

<style scoped>
.camera-container {
	width: 100%;
	height: 100%;
	border-radius: 50%;
	padding: 5rem;
	overflow: hidden;
	position: relative;
	display: flex;
	justify-content: center;
	align-items: center;
	aspect-ratio: 1;
	-webkit-app-region: no-drag; /* Electron'un varsayılan sürükleme davranışını devre dışı bırak */
}

.camera-video {
	width: 100%;
	height: 100%;
	box-shadow: 0 0 10px 0px rgba(0, 0, 0, 0.25);
	object-fit: cover;
	border-radius: 50%;
	transform: scaleX(-1); /* Ayna görüntüsü için */
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
