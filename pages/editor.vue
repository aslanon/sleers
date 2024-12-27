<template>
	<div class="min-h-screen bg-[#1a1b26] text-white">
		<!-- Üst Kontrol Çubuğu -->
		<div
			class="fixed top-0 left-0 right-0 bg-[#1a1b26]/80 backdrop-blur-sm p-4 border-b border-gray-700"
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
					<span class="text-lg font-semibold">Video Düzenleyici</span>
				</div>
				<div class="flex items-center space-x-2">
					<button
						class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
						@click="saveVideo"
					>
						Kaydet
					</button>
				</div>
			</div>
		</div>

		<!-- Video Önizleme -->
		<div class="pt-20 p-4">
			<div
				class="aspect-video bg-gray-800 rounded-lg overflow-hidden mx-auto max-w-4xl"
			>
				<video ref="videoPlayer" class="w-full h-full" controls>
					<source :src="videoUrl" type="video/webm" />
				</video>
			</div>
		</div>

		<!-- Timeline -->
		<div
			class="fixed bottom-0 left-0 right-0 bg-[#1a1b26]/80 backdrop-blur-sm p-4 border-t border-gray-700"
		>
			<div class="max-w-4xl mx-auto">
				<!-- Zaman Çizelgesi -->
				<div class="relative h-24 bg-gray-800 rounded-lg overflow-hidden">
					<!-- Video Küçük Resimler -->
					<div class="absolute inset-0 flex">
						<div
							v-for="i in 10"
							:key="i"
							class="flex-1 border-r border-gray-700"
						>
							<!-- Küçük resimler buraya gelecek -->
						</div>
					</div>

					<!-- Zaman İşaretçisi -->
					<div
						class="absolute top-0 bottom-0 w-0.5 bg-red-500"
						:style="{ left: timelinePosition + '%' }"
					></div>

					<!-- Kırpma Kontrolleri -->
					<div class="absolute bottom-0 left-0 right-0 h-8 bg-gray-700/50">
						<div
							class="absolute inset-y-0 bg-blue-500/30"
							:style="{ left: trimStart + '%', right: 100 - trimEnd + '%' }"
						>
							<!-- Sol Tutamaç -->
							<div
								class="absolute inset-y-0 -left-1 w-2 bg-blue-500 cursor-ew-resize"
								@mousedown="startTrimDrag('start', $event)"
							></div>
							<!-- Sağ Tutamaç -->
							<div
								class="absolute inset-y-0 -right-1 w-2 bg-blue-500 cursor-ew-resize"
								@mousedown="startTrimDrag('end', $event)"
							></div>
						</div>
					</div>
				</div>

				<!-- Kontrol Butonları -->
				<div class="flex items-center justify-center space-x-4 mt-4">
					<button
						class="p-2 hover:bg-gray-700 rounded-lg"
						@click="seekBackward"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z"
							/>
						</svg>
					</button>
					<button class="p-2 hover:bg-gray-700 rounded-lg" @click="togglePlay">
						<svg
							v-if="!isPlaying"
							xmlns="http://www.w3.org/2000/svg"
							class="h-8 w-8"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
							/>
						</svg>
						<svg
							v-else
							xmlns="http://www.w3.org/2000/svg"
							class="h-8 w-8"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</button>
					<button class="p-2 hover:bg-gray-700 rounded-lg" @click="seekForward">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z"
							/>
						</svg>
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const videoPlayer = ref<HTMLVideoElement | null>(null);
const videoUrl = ref("");
const isPlaying = ref(false);
const timelinePosition = ref(0);
const trimStart = ref(0);
const trimEnd = ref(100);
let isDragging = false;
let currentTrim: "start" | "end" | null = null;

// Pencere kontrolü
const closeWindow = () => {
	// @ts-ignore
	window.electron?.close();
};

// Video kontrolü
const togglePlay = () => {
	if (!videoPlayer.value) return;
	if (isPlaying.value) {
		videoPlayer.value.pause();
	} else {
		videoPlayer.value.play();
	}
	isPlaying.value = !isPlaying.value;
};

const seekForward = () => {
	if (!videoPlayer.value) return;
	videoPlayer.value.currentTime += 5;
};

const seekBackward = () => {
	if (!videoPlayer.value) return;
	videoPlayer.value.currentTime -= 5;
};

// Timeline kontrolü
const updateTimelinePosition = () => {
	if (!videoPlayer.value) return;
	const position =
		(videoPlayer.value.currentTime / videoPlayer.value.duration) * 100;
	timelinePosition.value = position;
};

// Kırpma kontrolü
const startTrimDrag = (type: "start" | "end", event: MouseEvent) => {
	isDragging = true;
	currentTrim = type;
	document.addEventListener("mousemove", handleTrimDrag);
	document.addEventListener("mouseup", stopTrimDrag);
};

const handleTrimDrag = (event: MouseEvent) => {
	if (!isDragging || !currentTrim) return;

	const timeline = event.currentTarget as HTMLElement;
	const rect = timeline.getBoundingClientRect();
	const position = ((event.clientX - rect.left) / rect.width) * 100;

	if (currentTrim === "start") {
		trimStart.value = Math.max(0, Math.min(trimEnd.value - 1, position));
	} else {
		trimEnd.value = Math.max(trimStart.value + 1, Math.min(100, position));
	}
};

const stopTrimDrag = () => {
	isDragging = false;
	currentTrim = null;
	document.removeEventListener("mousemove", handleTrimDrag);
	document.removeEventListener("mouseup", stopTrimDrag);
};

// Video kaydetme
const saveVideo = () => {
	// FFmpeg ile video kırpma ve kaydetme işlemi burada yapılacak
	console.log("Video kaydediliyor...");
};

onMounted(() => {
	// Video URL'ini localStorage'dan al
	const savedVideoUrl = localStorage.getItem("editingVideo");
	if (savedVideoUrl) {
		videoUrl.value = savedVideoUrl;
	}

	if (videoPlayer.value) {
		videoPlayer.value.addEventListener("timeupdate", updateTimelinePosition);
		videoPlayer.value.addEventListener("play", () => (isPlaying.value = true));
		videoPlayer.value.addEventListener(
			"pause",
			() => (isPlaying.value = false)
		);
	}
});

onUnmounted(() => {
	if (videoPlayer.value) {
		videoPlayer.value.removeEventListener("timeupdate", updateTimelinePosition);
	}
	// Video URL'ini temizle
	if (videoUrl.value) {
		URL.revokeObjectURL(videoUrl.value);
		localStorage.removeItem("editingVideo");
	}
});
</script>
