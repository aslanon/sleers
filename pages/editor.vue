<template>
	<div class="min-h-screen bg-black text-white">
		<!-- Üst Kontrol Çubuğu -->
		<div
			class="fixed top-0 left-0 right-0 bg-[#1a1b26]/80 backdrop-blur-sm p-4 border-b border-gray-700"
			@mousedown="startWindowDrag"
			@mousemove="windowDragging"
			@mouseup="endWindowDrag"
			@mouseleave="endWindowDrag"
		>
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-4">
					<button @click="closeWindow" class="p-2 hover:bg-gray-700 rounded-lg">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>

					<!-- Yeni Kayıt Butonu -->
					<button
						@click="startNewRecording"
						class="flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 4v16m8-8H4"
							/>
						</svg>
						<span>Yeni Kayıt</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Editör İçeriği -->
		<div class="pt-20 p-4">
			<div v-if="videoPath" class="max-w-4xl mx-auto">
				<video
					ref="videoPlayer"
					class="w-full rounded-lg"
					controls
					:src="videoPath"
				></video>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

const videoPlayer = ref<HTMLVideoElement | null>(null);
const videoPath = ref<string>("");
let isDragging = false;

const closeWindow = () => {
	window.electron?.windowControls.close();
};

const startNewRecording = () => {
	navigateTo("/");
};

// Pencere sürükleme işlemleri
const startWindowDrag = (event: MouseEvent) => {
	isDragging = true;
	window.electron?.windowControls.startDrag({
		x: event.screenX,
		y: event.screenY,
	});
};

const windowDragging = (event: MouseEvent) => {
	if (isDragging) {
		window.electron?.windowControls.dragging({
			x: event.screenX,
			y: event.screenY,
		});
	}
};

const endWindowDrag = () => {
	if (isDragging) {
		isDragging = false;
		window.electron?.windowControls.endDrag();
	}
};

onMounted(async () => {
	// Pencere yüksekliğini artır
	window.electron?.ipcRenderer.send("RESIZE_EDITOR_WINDOW");

	try {
		// Geçici video dosyasının yolunu al
		const tmpVideoPath = await window.electron?.getTempVideoPath();
		if (tmpVideoPath) {
			videoPath.value = `file://${tmpVideoPath}`;
			console.log("Video yolu:", videoPath.value);
		}
	} catch (error) {
		console.error("Video yolu alınırken hata:", error);
	}
});
</script>
