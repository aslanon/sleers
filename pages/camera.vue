<template>
	<div class="camera-container">
		<video
			ref="videoRef"
			autoplay
			muted
			playsinline
			class="camera-video"
		></video>
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

const videoRef = ref(null);
let currentStream = null;
const electron = window.electron;

const startCamera = async (deviceLabel) => {
	try {
		console.log(
			"[camera.vue] startCamera başlatıldı, istenen label:",
			deviceLabel
		);
		// Önce mevcut stream'i durdur
		stopCamera();

		// Tüm kamera cihazlarını al
		const devices = await navigator.mediaDevices.enumerateDevices();
		const videoDevices = devices.filter(
			(device) => device.kind === "videoinput"
		);

		console.log(
			"[camera.vue] Mevcut kameralar:",
			videoDevices.map((d) => ({ label: d.label, id: d.deviceId }))
		);

		// Label'a göre cihazı bul
		let selectedDevice;
		if (deviceLabel) {
			selectedDevice = videoDevices.find(
				(device) => device.label === deviceLabel
			);
			console.log("[camera.vue] Label'a göre bulunan kamera:", selectedDevice);
		}

		// Eğer belirli bir cihaz bulunamadıysa veya label belirtilmediyse
		// ilk kamerayı kullan
		if (!selectedDevice && videoDevices.length > 0) {
			selectedDevice = videoDevices[0];
			console.log(
				"[camera.vue] Varsayılan kamera kullanılıyor:",
				selectedDevice
			);
		}

		if (!selectedDevice) {
			throw new Error("Kullanılabilir kamera bulunamadı");
		}

		console.log("[camera.vue] Kamera başlatılıyor:", {
			deviceId: selectedDevice.deviceId,
			label: selectedDevice.label,
		});

		// Seçilen kamera ile stream başlat
		const stream = await navigator.mediaDevices.getUserMedia({
			video: {
				deviceId: { exact: selectedDevice.deviceId },
				width: { ideal: 1920 },
				height: { ideal: 1080 },
				frameRate: { ideal: 60 },
			},
			audio: false,
		});

		currentStream = stream;
		if (videoRef.value) {
			videoRef.value.srcObject = stream;
			await videoRef.value
				.play()
				.catch((e) => console.error("[camera.vue] Video oynatma hatası:", e));
		}

		// Kamera durumunu ana pencereye bildir
		if (electron) {
			electron.ipcRenderer.send("CAMERA_STATUS_UPDATE", {
				status: "active",
				deviceId: selectedDevice.deviceId,
				label: selectedDevice.label,
			});
			console.log("[camera.vue] Kamera durumu ana pencereye bildirildi");
		}
	} catch (error) {
		console.error("[camera.vue] Kamera erişimi hatası:", error);
		if (electron) {
			electron.ipcRenderer.send("CAMERA_STATUS_UPDATE", {
				status: "error",
				error: error.message,
			});
		}
	}
};

const stopCamera = () => {
	if (currentStream) {
		currentStream.getTracks().forEach((track) => track.stop());
		currentStream = null;
	}
};

onMounted(() => {
	console.log("[camera.vue] Component mount edildi");

	// İlk açılışta varsayılan kamera ile başlat
	startCamera();

	// Ana pencereden gelecek kamera seçimi için event listener ekle
	if (electron) {
		console.log("[camera.vue] Electron bulundu, event listener ekleniyor");
		electron.ipcRenderer.on("UPDATE_CAMERA_DEVICE", (deviceLabel) => {
			console.log(
				"[camera.vue] UPDATE_CAMERA_DEVICE eventi alındı, label:",
				deviceLabel
			);
			// Sadece geçerli bir label geldiğinde kamerayı değiştir
			if (deviceLabel) {
				startCamera(deviceLabel);
			}
		});
		console.log("[camera.vue] Event listener eklendi");
	}
});

onUnmounted(() => {
	stopCamera();
	// Event listener'ı temizle
	if (electron) {
		electron.ipcRenderer.removeAllListeners("UPDATE_CAMERA_DEVICE");
	}
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
