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
		console.log("camera.vue: Kamera başlatma fonksiyonu çağrıldı:", deviceId);

		// Eğer aktif bir stream varsa kapatıyoruz
		if (currentStream) {
			console.log("camera.vue: Mevcut stream kapatılıyor");
			currentStream.getTracks().forEach((track) => track.stop());
		}

		// Yeni stream'i başlatıyoruz
		const constraints: MediaStreamConstraints = {
			video: deviceId
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

		console.log("camera.vue: Kullanılacak kısıtlamalar:", constraints);
		const stream = await navigator.mediaDevices.getUserMedia(constraints);

		console.log("camera.vue: Yeni stream başlatıldı");
		currentStream = stream;

		if (videoRef.value) {
			// Stream'i video elementine bağla
			videoRef.value.srcObject = null;
			videoRef.value.srcObject = stream;

			// Stream hazır olduğunda işlem yap
			return new Promise<void>((resolve) => {
				if (videoRef.value) {
					const handleLoadedMetadata = () => {
						console.log(
							"camera.vue: Video elementi güncellendi ve stream hazır"
						);
						videoRef.value?.removeEventListener(
							"loadedmetadata",
							handleLoadedMetadata
						);
						resolve();
					};

					videoRef.value.addEventListener(
						"loadedmetadata",
						handleLoadedMetadata
					);

					// Timeout ekleyelim
					setTimeout(() => {
						if (videoRef.value) {
							videoRef.value.removeEventListener(
								"loadedmetadata",
								handleLoadedMetadata
							);
							console.log(
								"camera.vue: Stream yükleme timeout'a uğradı, devam ediliyor"
							);
							resolve();
						}
					}, 2000); // 2 saniye timeout
				} else {
					resolve();
				}
			});
		}
	} catch (error) {
		console.error("Kamera başlatılamadı:", error);
		// Hata durumunda varsayılan kamerayı deneyelim
		if (deviceId) {
			console.log("camera.vue: Varsayılan kamera deneniyor...");
			await startCamera(); // deviceId olmadan tekrar dene
		}
	}
};

onMounted(() => {
	console.log("camera.vue: Kamera penceresi mount edildi");
	// İlk kamera başlatma
	startCamera();

	// Kamera değişikliği mesajını dinle
	const handleCameraUpdate = async (deviceId: string) => {
		console.log("camera.vue: Kamera değişikliği mesajı alındı:", deviceId);
		await startCamera(deviceId);
		console.log("camera.vue: Kamera değişikliği tamamlandı");
	};

	// Event listener'ı ekle
	window.electron?.ipcRenderer.on("UPDATE_CAMERA_DEVICE", handleCameraUpdate);

	// Test mesajı gönder
	console.log("camera.vue: IPC bağlantısı test ediliyor...");
	window.electron?.ipcRenderer.send("CAMERA_WINDOW_READY");
});

// Cleanup için fonksiyonu sakla
onUnmounted(() => {
	console.log("camera.vue: Kamera penceresi unmount ediliyor");
	// Stream'i temizle
	if (currentStream) {
		currentStream.getTracks().forEach((track) => track.stop());
	}

	// Event listener'ı temizle
	window.electron?.ipcRenderer.removeAllListeners("UPDATE_CAMERA_DEVICE");
	console.log("camera.vue: Event listener'lar temizlendi");
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
