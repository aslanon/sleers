<template>
	<div class="camera-container">
		<video
			ref="videoRef"
			autoplay
			muted
			playsinline
			class="camera-video"
		></video>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const videoRef = ref<HTMLVideoElement | null>(null);
let currentStream: MediaStream | null = null;

const startCamera = async (deviceId?: string) => {
	try {
		console.log("Kamera başlatma fonksiyonu çağrıldı:", deviceId);

		// Eğer aktif bir stream varsa kapatıyoruz
		if (currentStream) {
			console.log("Mevcut stream kapatılıyor");
			currentStream.getTracks().forEach((track) => track.stop());
		}

		// Önce mevcut cihazları listeleyelim
		const devices = await navigator.mediaDevices.enumerateDevices();
		const videoDevices = devices.filter(
			(device) => device.kind === "videoinput"
		);
		console.log("Mevcut kamera cihazları:", videoDevices);

		// deviceId'nin geçerli olup olmadığını kontrol edelim
		const isValidDevice = videoDevices.some(
			(device) => device.deviceId === deviceId
		);
		console.log("Geçerli cihaz mi?", isValidDevice);

		// Yeni stream'i başlatıyoruz
		const constraints: MediaStreamConstraints = {
			video:
				deviceId && isValidDevice
					? {
							deviceId: { exact: deviceId },
							width: { ideal: 1280 },
							height: { ideal: 1280 },
							aspectRatio: 1,
					  }
					: {
							width: { ideal: 1280 },
							height: { ideal: 1280 },
							aspectRatio: 1,
					  },
			audio: false,
		};

		console.log("Kullanılacak kısıtlamalar:", constraints);
		const stream = await navigator.mediaDevices.getUserMedia(constraints);

		console.log("Yeni stream başlatıldı");
		currentStream = stream;
		if (videoRef.value) {
			videoRef.value.srcObject = stream;
			console.log("Video elementi güncellendi");
		}
	} catch (error) {
		console.error("Kamera başlatılamadı:", error);
		// Hata durumunda varsayılan kamerayı deneyelim
		if (deviceId) {
			console.log("Varsayılan kamera deneniyor...");
			startCamera(); // deviceId olmadan tekrar dene
		}
	}
};

onMounted(() => {
	console.log("Kamera penceresi mount edildi");
	// İlk kamera başlatma
	startCamera();

	// Kamera değişikliği mesajını dinle
	const handleCameraUpdate = (deviceId: string) => {
		console.log("Kamera değişikliği mesajı alındı:", deviceId);
		startCamera(deviceId);
	};

	// Event listener'ı ekle
	window.electron?.ipcRenderer.on("UPDATE_CAMERA_DEVICE", handleCameraUpdate);

	// Test mesajı gönder
	console.log("IPC bağlantısı test ediliyor...");
	window.electron?.ipcRenderer.send("CAMERA_WINDOW_READY");
});

// Cleanup için fonksiyonu sakla
onUnmounted(() => {
	console.log("Kamera penceresi unmount ediliyor");
	// Stream'i temizle
	if (currentStream) {
		currentStream.getTracks().forEach((track) => track.stop());
	}

	// Event listener'ı temizle
	window.electron?.ipcRenderer.removeAllListeners("UPDATE_CAMERA_DEVICE");
	console.log("Event listener'lar temizlendi");
});
</script>

<style scoped>
.camera-container {
	width: 100%;
	height: 100%;
	border-radius: 50%;
	overflow: hidden;
	display: flex;
	justify-content: center;
	align-items: center;
	aspect-ratio: 1;
}

.camera-video {
	width: 100%;
	height: 100%;
	object-fit: cover;
	border-radius: 50%;
	transform: scaleX(-1); /* Ayna görüntüsü için */
}
</style>
