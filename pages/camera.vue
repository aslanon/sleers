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

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useMediaDevices } from "~/composables/useMediaDevices";

const videoRef = ref(null);
let currentStream = null;
const electron = window.electron;

const startCamera = async () => {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({ video: true });
		currentStream = stream;
		if (videoRef.value) {
			videoRef.value.srcObject = stream;
		}
	} catch (error) {
		console.error("Kamera erişimi hatası:", error);
	}
};

const stopCamera = () => {
	if (currentStream) {
		currentStream.getTracks().forEach((track) => track.stop());
		currentStream = null;
	}
};

onMounted(() => {
	startCamera();
});

onUnmounted(() => {
	stopCamera();
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
