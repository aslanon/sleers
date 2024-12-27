<template>
	<div class="camera-window" @mousemove="handleDrag">
		<video ref="videoElement" autoplay class="camera-feed"></video>
		<div class="controls">
			<button @click="closeWindow" class="close-btn">✕</button>
		</div>
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
				height: 240,
			},
		});
		videoElement.value.srcObject = stream;
	} catch (error) {
		console.error("Kamera erişimi hatası:", error);
	}
});

const closeWindow = () => {
	ipcRenderer.send("CLOSE_CAMERA_WINDOW");
};

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
	height: 240px;
	position: relative;
	background: transparent;
	-webkit-app-region: drag;
}

.camera-feed {
	width: 100%;
	height: 100%;
	object-fit: cover;
	border-radius: 8px;
}

.controls {
	position: absolute;
	top: 8px;
	right: 8px;
	-webkit-app-region: no-drag;
}

.close-btn {
	background: rgba(0, 0, 0, 0.5);
	border: none;
	color: white;
	width: 20px;
	height: 20px;
	border-radius: 10px;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 12px;
}

.close-btn:hover {
	background: rgba(0, 0, 0, 0.7);
}
</style>
