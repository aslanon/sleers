<template>
	<div class="min-h-screen bg-[#1a1b26]">
		<!-- Üst Bar - Mevcut header'ı koruyoruz -->
		<div
			class="fixed top-0 left-0 right-0 px-4 bg-[#1a1b26]/50 backdrop-blur-3xl z-50"
			@mousedown.prevent="startDrag"
		>
			<div class="flex items-center justify-between p-4">
				<div class="flex items-center space-x-4">
					<button
						@click="closeWindow"
						class="p-2 hover:bg-gray-700 rounded-lg cursor-pointer"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5 text-white"
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
						class="px-4 py-2 bg-[#525252] text-white rounded-lg hover:bg-[#525252]/80 transition-colors flex items-center space-x-2"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
								clip-rule="evenodd"
							/>
						</svg>
						<span>Yeni Kayıt</span>
					</button>
				</div>
				<button
					@click="exportVideo"
					class="px-4 py-2 bg-[#2546ff] text-white rounded-lg hover:bg-[#E1A87A]/80 transition-colors flex items-center space-x-2"
					:disabled="isExporting"
				>
					<span v-if="isExporting">Dışa Aktarılıyor...</span>
					<span v-else>Dışa Aktar</span>
				</button>
			</div>
		</div>

		<!-- Yeni Layout -->
		<div class="pt-24 bg-neutral-800">
			<div class="mx-auto space-y-6">
				<!-- Video ve Araçlar -->
				<div class="flex p-8 gap-6 mb-6">
					<!-- Video Preview -->
					<div class="flex-1 rounded-lg p-4 overflow-hidden">
						<div class="relative aspect-video">
							<!-- Ekran Kaydı -->
							<video
								ref="screenPlayer"
								class="w-full h-full rounded-e-lg"
								:style="{
									objectFit:
										cropArea?.aspectRatio === 'free' ? 'contain' : 'cover',
									clipPath: cropArea
										? `inset(${(cropArea.y / cropArea.display.height) * 100}% ${
												((cropArea.display.width -
													(cropArea.x + cropArea.width)) /
													cropArea.display.width) *
												100
										  }% ${
												((cropArea.display.height -
													(cropArea.y + cropArea.height)) /
													cropArea.display.height) *
												100
										  }% ${(cropArea.x / cropArea.display.width) * 100}%)`
										: 'none',
								}"
								preload="auto"
								@loadedmetadata="onScreenLoaded"
								@error="
									(e) => console.error('Ekran kaydı yüklenirken hata:', e)
								"
							></video>

							<!-- Kamera Kaydı (PiP) -->
							<video
								v-if="cameraPath"
								ref="cameraPlayer"
								class="absolute right-4 bottom-4 w-48 h-48 object-cover rounded-full shadow-lg"
								preload="auto"
								@loadedmetadata="onCameraLoaded"
								@error="
									(e) => console.error('Kamera kaydı yüklenirken hata:', e)
								"
							></video>
						</div>

						<div class="flex items-center justify-between mt-4">
							<div class="flex items-center space-x-2">
								<!-- Play/Pause Button -->
								<button
									@click="togglePlay"
									class="p-2 rounded-full hover:bg-neutral-700/50 transition-colors"
								>
									<svg
										v-if="isPlaying"
										xmlns="http://www.w3.org/2000/svg"
										class="h-5 w-5 text-white"
										viewBox="0 0 20 20"
										fill="currentColor"
									>
										<path
											fill-rule="evenodd"
											d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
											clip-rule="evenodd"
										/>
									</svg>
									<svg
										v-else
										xmlns="http://www.w3.org/2000/svg"
										class="h-5 w-5 text-white"
										viewBox="0 0 20 20"
										fill="currentColor"
									>
										<path
											fill-rule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
											clip-rule="evenodd"
										/>
									</svg>
								</button>

								<!-- Time Display -->
								<div class="text-sm text-white font-medium">
									<span>{{ formatTime(currentTime) }}</span>
									<span class="text-neutral-400 mx-1">/</span>
									<span class="text-neutral-400">{{
										formatTime(duration)
									}}</span>
								</div>
							</div>

							<!-- Zoom Controls -->
							<div
								class="flex items-center space-x-1 bg-neutral-700/30 rounded-full p-1"
							>
								<button
									@click="zoomOut"
									class="p-1 rounded-full hover:bg-neutral-600/50 transition-colors"
									:class="{
										'opacity-50 cursor-not-allowed': timelineState.zoom <= 0.5,
									}"
									:disabled="timelineState.zoom <= 0.5"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-4 w-4 text-white"
										viewBox="0 0 20 20"
										fill="currentColor"
									>
										<path
											fill-rule="evenodd"
											d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
											clip-rule="evenodd"
										/>
									</svg>
								</button>
								<div class="w-px h-4 bg-neutral-600"></div>
								<button
									@click="zoomIn"
									class="p-1 rounded-full hover:bg-neutral-600/50 transition-colors"
									:class="{
										'opacity-50 cursor-not-allowed': timelineState.zoom >= 4,
									}"
									:disabled="timelineState.zoom >= 4"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-4 w-4 text-white"
										viewBox="0 0 20 20"
										fill="currentColor"
									>
										<path
											fill-rule="evenodd"
											d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
											clip-rule="evenodd"
										/>
									</svg>
								</button>
							</div>
						</div>
					</div>

					<!-- Araçlar -->
					<div
						class="w-72 bg-neutral-700 rounded-lg p-4 flex flex-col items-center justify-between"
					>
						<!-- Crop Listesi -->
						<div class="w-full">
							<h3 class="text-neutral-300 font-medium mb-2">Kırpma Alanları</h3>
							<div class="space-y-2">
								<!-- Crop alanları buraya gelecek -->
							</div>
						</div>

						<!-- Tool Properties -->
						<div class="w-full mt-4">
							<h3 class="text-neutral-300 font-medium mb-2">Özellikler</h3>
							<div class="bg-neutral-600 rounded p-4">
								<p class="text-sm text-neutral-300">Seçili bir araç yok</p>
							</div>
						</div>
					</div>
				</div>

				<!-- Timeline ve Kontroller -->
				<div class="p-4 bg-neutral-900 overflow-scroll h-[500px]">
					<!-- Timeline -->
					<div class="w-full relative">
						<!-- Timeline Container -->
						<div class="rounded-lg p-4">
							<!-- Time Scale -->
							<div class="flex text-xs text-neutral-400 mb-2 relative">
								<div class="absolute inset-x-0 flex">
									<template v-for="i in 600" :key="i">
										<div
											class="flex-shrink-0 relative"
											:style="{ width: '60px' }"
										>
											<div
												v-if="i % 10 === 0"
												class="absolute left-0 -bottom-1 w-px h-2 bg-neutral-600"
											></div>
											<div
												v-else
												class="absolute left-0 -bottom-1 w-px h-1 bg-neutral-600/50"
											></div>
											<span
												v-if="i % 10 === 0"
												class="absolute left-0 -top-5 transform -translate-x-1/2"
											>
												{{ formatTime(i) }}
											</span>
										</div>
									</template>
								</div>
							</div>

							<!-- Timeline Track -->
							<div class="relative h-20">
								<!-- Video Section -->
								<div
									class="absolute inset-y-0 left-0 w-[500px] group"
									:style="{
										transform: `translateX(${timelineState.scroll}px)`,
									}"
								>
									<!-- Video Bar -->
									<div
										class="h-full bg-gradient-to-r from-[#E1A87A] to-[#E1A87A]/80 rounded-2xl shadow-lg relative overflow-hidden"
									>
										<!-- Progress Overlay -->
										<div
											class="absolute inset-y-0 left-0 bg-gradient-to-r from-[#E1A87A] to-[#E1A87A] transition-all"
											:style="{ width: `${(currentTime / duration) * 100}%` }"
										>
											<div class="absolute inset-0 bg-white/10"></div>
										</div>

										<!-- Video Info -->
										<div
											class="absolute inset-x-0 top-0 p-2 text-xs text-white/90 font-medium bg-gradient-to-b from-black/20 to-transparent"
										>
											Video Timeline
										</div>

										<!-- Duration Label -->
										<div
											class="absolute right-2 bottom-2 px-2 py-1 text-xs text-white/90 bg-black/30 rounded"
										>
											{{ formatTime(duration) }}
										</div>
									</div>

									<!-- Hover Effect -->
									<div
										class="absolute inset-0 ring-4 ring-white/0 group-hover:ring-white/20 rounded-2xl transition-all"
									></div>
								</div>

								<!-- Playhead -->
								<div
									class="absolute top-0 bottom-0 z-10"
									:style="{
										left: `${(currentTime / duration) * 500}px`,
									}"
									@mousedown.stop="startPlayheadDrag"
								>
									<!-- Playhead Line -->
									<div
										class="absolute inset-y-0 left-1/2 w-px bg-red-500 transform -translate-x-1/2"
									>
										<div
											class="absolute inset-0 animate-pulse bg-red-500/50 w-0.5"
										></div>
									</div>

									<!-- Playhead Handle -->
									<div
										class="absolute -top-1 left-1/2 transform -translate-x-1/2 w-3 h-3"
									>
										<div
											class="absolute inset-0 bg-red-500 rounded-full cursor-ew-resize hover:scale-110 transition-transform shadow-lg"
										>
											<div
												class="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-50"
											></div>
										</div>
									</div>

									<!-- Time Label -->
									<div
										class="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-neutral-900/90 rounded text-xs text-white whitespace-nowrap"
									>
										{{ formatTime(currentTime) }}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";

const videoRef = ref(null);
const audioRef = ref(null);
const currentTime = ref(0);
const duration = ref(0);
const isPlaying = ref(false);
const volume = ref(1);
const isMuted = ref(false);
const isFullscreen = ref(false);
const showControls = ref(true);
const isLoading = ref(true);
const electron = window.electron;
const timelineState = ref({
	scroll: 0,
	zoom: 1,
});

// Sürükleme işleyicileri
const startDrag = (e) => {
	// Butonlar ve ikonlar üzerinde sürüklemeyi engelle
	if (e.target instanceof HTMLButtonElement || e.target instanceof SVGElement) {
		return;
	}
	electron?.ipcRenderer.send("START_DRAG");
};

const endDrag = () => {
	electron?.ipcRenderer.send("END_DRAG");
};

// Video kontrolü
const togglePlay = () => {
	if (videoRef.value) {
		if (isPlaying.value) {
			videoRef.value.pause();
		} else {
			videoRef.value.play();
		}
	}
};

// Ses kontrolü
const toggleMute = () => {
	if (videoRef.value) {
		isMuted.value = !isMuted.value;
		videoRef.value.muted = isMuted.value;
	}
};

const updateVolume = (value) => {
	if (videoRef.value) {
		volume.value = value;
		videoRef.value.volume = value;
	}
};

// Tam ekran kontrolü
const toggleFullscreen = () => {
	if (!document.fullscreenElement) {
		document.documentElement.requestFullscreen();
		isFullscreen.value = true;
	} else {
		document.exitFullscreen();
		isFullscreen.value = false;
	}
};

// Video olayları
const onTimeUpdate = () => {
	if (videoRef.value) {
		currentTime.value = videoRef.value.currentTime;
	}
};

const onLoadedMetadata = () => {
	if (videoRef.value) {
		duration.value = videoRef.value.duration;
		isLoading.value = false;
	}
};

const formatTime = (d) => d;

const onPlay = () => {
	isPlaying.value = true;
};

const onPause = () => {
	isPlaying.value = false;
};

const onEnded = () => {
	isPlaying.value = false;
};

// Kontrol çubuğu görünürlüğü
let controlsTimeout;
const showControlsTemporarily = () => {
	showControls.value = true;
	clearTimeout(controlsTimeout);
	controlsTimeout = setTimeout(() => {
		if (!isPlaying.value) return;
		showControls.value = false;
	}, 3000);
};

// Klavye kısayolları
const onKeyDown = (e) => {
	if (e.code === "Space") {
		e.preventDefault();
		togglePlay();
	} else if (e.code === "KeyM") {
		toggleMute();
	} else if (e.code === "KeyF") {
		toggleFullscreen();
	}
};

// Yaşam döngüsü
onMounted(() => {
	window.addEventListener("keydown", onKeyDown);
	document.addEventListener("fullscreenchange", () => {
		isFullscreen.value = !!document.fullscreenElement;
	});
});

onUnmounted(() => {
	window.removeEventListener("keydown", onKeyDown);
	clearTimeout(controlsTimeout);
});
</script>

<style>
.camera-preview {
	pointer-events: none;
}

/* Kamera önizlemesini gizle */
video[ref="cameraPlayer"] {
	display: none !important;
}
</style>
