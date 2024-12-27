<template>
	<div
		class="camera-window"
		@mousemove="handleDrag"
		@mouseenter="handleMouseEnter"
		@mouseleave="handleMouseLeave"
		:class="{ 'camera-hover': isHovered }"
		:style="hoverStyle"
	>
		<video ref="videoElement" autoplay class="camera-feed"></video>
	</div>
</template>

<script setup>
const { ipcRenderer } = window.electron;
const videoElement = ref(null);
const isHovered = ref(false);
const hoverStyle = ref({});
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

const handleMouseEnter = () => {
	isHovered.value = true;
};

const handleMouseLeave = () => {
	isHovered.value = false;
	hoverStyle.value = {};
};

const handleDrag = (e) => {
	if (isHovered.value) {
		// Mouse pozisyonuna göre pencereyi kaydır
		const rect = e.target.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		// Mouse'un merkeze göre konumu
		const deltaX = e.clientX - centerX;
		const deltaY = e.clientY - centerY;

		// Maksimum 50px kaydırma
		const moveX = Math.min(Math.max(-50, deltaX / 2), 50);
		const moveY = Math.min(Math.max(-50, deltaY / 2), 50);

		hoverStyle.value = {
			transform: `translate(${moveX}px, ${moveY}px)`,
			opacity: "0.3",
			transition: "transform 0.3s ease, opacity 0.3s ease",
		};
	} else {
		ipcRenderer.send("CAMERA_WINDOW_DRAG", {
			mouseX: e.screenX,
			mouseY: e.screenY,
		});
	}
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
	transition: transform 0.3s ease, opacity 0.3s ease;
}

.camera-feed {
	width: 100%;
	height: 100%;
	object-fit: cover;
	border-radius: 50%;
	transform: scaleX(-1);
}

.camera-hover {
	pointer-events: all;
	z-index: 9999;
}
</style>
