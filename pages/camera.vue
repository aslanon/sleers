<template>
	<div class="camera-container">
		<video
			ref="videoRef"
			autoplay
			muted
			playsinline
			class="camera-video"
		></video>
		<svg class="circular-text" viewBox="0 0 100 100">
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

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const videoRef = ref<HTMLVideoElement | null>(null);
let currentStream: MediaStream | null = null;
const electron = window.electron;

const startCamera = async (deviceId?: string) => {
	try {
		console.log("camera.vue: Kamera başlatma fonksiyonu çağrıldı:", deviceId);

		// Eski stream varsa durduruyoruz
		if (currentStream) {
			currentStream.getTracks().forEach((track) => track.stop());
			console.log("camera.vue: Eski stream durduruldu");
		}

		// Video elementinin null olmadığından emin olalım
		if (!videoRef.value) {
			console.error("videoRef is not connected to the DOM");
			return;
		}

		// Video elementinin srcObject'ini sıfırlıyoruz (önceki stream'i temizlemek için)
		videoRef.value.srcObject = null;

		// Yeni stream'i başlatıyoruz
		const constraints: MediaStreamConstraints = {
			video: {
				deviceId: { exact: deviceId || undefined }, // deviceId doğru geçildiğinden emin olun
				width: { ideal: 1280 }, // Daha esnek çözünürlük
				height: { ideal: 720 }, // Daha esnek çözünürlük
				frameRate: { ideal: 30 }, // Daha esnek fps
			},
			audio: false,
		};

		console.log("camera.vue: Kullanılacak kısıtlamalar:", constraints);

		const stream = await navigator.mediaDevices.getUserMedia(constraints);

		// Kamera açıldığında yapılacak işlemler
		console.log("Kamera açıldı", stream);
		// Yeni stream'i video elementine aktaralım
		videoRef.value.srcObject = stream;

		// Yeni stream'i sakla
		currentStream = stream;

		console.log("camera.vue: Yeni stream başlatıldı");

		// Kamera başarıyla başlatıldı, main process'e bildir
		electron?.ipcRenderer.send("CAMERA_STATUS_UPDATE", {
			status: "active",
			deviceId: deviceId || "default",
		});
	} catch (error) {
		console.error("Kamera başlatılamadı:", error);
		if (error.name === "OverconstrainedError") {
			console.error(
				"Geçerli bir cihaz bulunamadı, çözünürlük veya frame rate gibi parametreler uyumsuz olabilir."
			);
		}
	}
};

const getDeviceList = async () => {
	const devices = await navigator.mediaDevices.enumerateDevices();
	devices.forEach((device) => {
		console.log(
			`Device kind: ${device.kind}, label: ${device.label}, deviceId: ${device.deviceId}`
		);
	});
};

onMounted(() => {
	console.log("camera.vue: Kamera penceresi mount edildi");

	// İlk kamera başlatma
	startCamera();

	electron?.ipcRenderer.on(
		"UPDATE_CAMERA_DEVICE",
		async function (deviceLabel) {
			console.log("yeni camera: ", deviceLabel);

			const devices = await navigator.mediaDevices.enumerateDevices();
			let device = devices.find((device) => device.label === deviceLabel);
			console.log(device);

			startCamera(device?.deviceId);
		}
	);
});

onUnmounted(() => {
	// Event listener'ı temizle
	electron?.ipcRenderer.removeAllListeners("UPDATE_CAMERA_DEVICE");

	// Aktif stream'i kapat
	if (currentStream) {
		currentStream.getTracks().forEach((track) => track.stop());
		currentStream = null;
	}
});
</script>

<style scoped>
.camera-container {
	width: 100%;
	height: 100%;
	border-radius: 50%;
	padding: 2rem;
	overflow: hidden;
	position: relative;
	display: flex;
	justify-content: center;
	align-items: center;
	aspect-ratio: 1;
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
	font-size: 4px;
	font-weight: bold;
	letter-spacing: 1px;
	animation: rotate 20s linear infinite;
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
