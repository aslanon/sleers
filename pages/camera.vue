<template>
	<div
		class="rounded-full overflow-hidden cursor-move"
		:style="{
			width: '100%',
			height: '100%',
		}"
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
import { ref, onMounted, onUnmounted, watch } from "vue";

const videoElement = ref<HTMLVideoElement | null>(null);
const isDragging = ref(false);

const { selectedVideoDevice, getDevices } = useMediaDevices();

watch(
	() => selectedVideoDevice.value,
	async (newDeviceId) => {
		if (newDeviceId) {
			console.log(1231231231231);
			if (videoElement.value && videoElement.value.srcObject) {
				const stream = videoElement.value.srcObject as MediaStream;
				stream.getTracks().forEach((track) => track.stop());
			}
			await getCamera();
		}
	},
	{ deep: true }
);

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

const getCamera = async () => {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: {
				deviceId: { exact: selectedVideoDevice.value },
				aspectRatio: 1,
			},
			audio: false,
		});

		if (videoElement.value) {
			videoElement.value.srcObject = stream;
		}
	} catch (error) {
		console.error("Kamera erişimi hatası:", error);
	}
};

onMounted(async () => {
	// Cihazları listele
	await getDevices();
	await getCamera();
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
