<template>
	<div class="camera-window" @mousemove="handleDrag">
		<video ref="videoElement" autoplay class="camera-feed"></video>
	</div>
</template>

<script setup>
const { ipcRenderer } = window.electron;
const videoElement = ref(null);
let isDragging = false;

onMounted(async () => {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: {
				width: 320,
				height: 320,
			},
		});
		videoElement.value.srcObject = stream;
	} catch (error) {
		console.error("Kamera erişimi hatası:", error);
	}
});

const handleDrag = (e) => {
	ipcRenderer.send("CAMERA_WINDOW_DRAG", {
		mouseX: e.screenX,
		mouseY: e.screenY,
	});
};

onBeforeUnmount(() => {
	if (videoElement.value && videoElement.value.srcObject) {
		videoElement.value.srcObject.getTracks().forEach((track) => track.stop());
	}
});
</script>

<style scoped>
.camera-window {
	width: 320px;
	height: 320px;
	position: relative;
	background: transparent;
	-webkit-app-region: drag;
	border-radius: 50%;
	overflow: hidden;
}

.camera-feed {
	width: 100%;
	height: 100%;
	object-fit: cover;
	border-radius: 50%;
	transform: scaleX(-1);
}
</style>
