<template>
	<div
		class="w-[320px] h-[320px] rounded-full overflow-hidden bg-black cursor-move"
		@mousedown.prevent="startDrag"
	>
		<video
			ref="videoElement"
			class="w-full h-full object-cover transform scale-x-[-1]"
			autoplay
			playsinline
		></video>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const videoElement = ref<HTMLVideoElement | null>(null);
const isDragging = ref(false);

// Sürükleme işleyicileri
const startDrag = (e: MouseEvent) => {
	isDragging.value = true;
	window.electron?.ipcRenderer.send("START_WINDOW_DRAG", {
		x: e.screenX,
		y: e.screenY,
	});

	// Global event listener'ları ekle
	window.addEventListener("mousemove", onDrag);
	window.addEventListener("mouseup", endDrag);
};

const onDrag = (e: MouseEvent) => {
	if (!isDragging.value) return;
	window.electron?.ipcRenderer.send("WINDOW_DRAGGING", {
		x: e.screenX,
		y: e.screenY,
	});
};

const endDrag = () => {
	if (!isDragging.value) return;
	isDragging.value = false;
	window.electron?.ipcRenderer.send("END_WINDOW_DRAG");

	// Global event listener'ları kaldır
	window.removeEventListener("mousemove", onDrag);
	window.removeEventListener("mouseup", endDrag);
};

onMounted(async () => {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: true,
			audio: false,
		});

		if (videoElement.value) {
			videoElement.value.srcObject = stream;
		}
	} catch (error) {
		console.error("Kamera erişimi hatası:", error);
	}
});

onUnmounted(() => {
	// Stream'i kapat
	if (videoElement.value && videoElement.value.srcObject) {
		const stream = videoElement.value.srcObject as MediaStream;
		stream.getTracks().forEach((track) => track.stop());
	}

	// Event listener'ları temizle
	window.removeEventListener("mousemove", onDrag);
	window.removeEventListener("mouseup", endDrag);
});
</script>
