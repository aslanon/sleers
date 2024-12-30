<template>
<<<<<<< Updated upstream
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
=======
	<div class="min-h-screen bg-[#1a1b26] text-white">
		<!-- Ana Düzenleme Alanı -->
		<div class="flex h-screen">
			<!-- Video Önizleme -->
			<div class="flex-1 p-4">
				<div
					class="aspect-video bg-gray-800 rounded-lg overflow-hidden relative"
				>
					<canvas ref="videoCanvas" class="w-full h-full"></canvas>
				</div>
			</div>

			<!-- Sağ Panel - Efektler ve Ayarlar -->
			<div class="w-64 bg-gray-900 p-4 border-l border-gray-700">
				<h3 class="text-lg font-semibold mb-4">Efektler</h3>
				<div class="space-y-2">
					<button
						class="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm"
					>
						Geçiş Efekti
					</button>
					<button
						class="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
					>
						Filtre
					</button>
					<button
						class="w-full px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm"
					>
						Metin
					</button>
				</div>
			</div>
		</div>

		<!-- Alt Panel - Timeline ve Kontroller -->
		<div
			class="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700"
		>
			<!-- Video Kontrolleri -->
			<div class="flex items-center space-x-4 p-4 border-b border-gray-700">
				<button @click="togglePlay" class="p-2 hover:bg-gray-700 rounded-lg">
					<Icon
						:name="
							isPlaying
								? 'material-symbols:pause'
								: 'material-symbols:play-arrow'
						"
						size="24"
					/>
				</button>

				<div class="flex items-center space-x-2 text-sm">
					<button class="p-1 hover:bg-gray-700 rounded">
						<Icon name="material-symbols:skip-previous" size="20" />
					</button>
					<span>{{ formatTime(currentTime) }}</span>
					<button class="p-1 hover:bg-gray-700 rounded">
						<Icon name="material-symbols:skip-next" size="20" />
					</button>
				</div>

				<div
					class="flex-1 h-1 bg-gray-700 rounded-full cursor-pointer relative"
					@click="seek"
				>
					<div
						class="absolute h-full bg-blue-500 rounded-full"
						:style="{ width: `${progress}%` }"
					></div>
					<div
						class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full -ml-1.5"
						:style="{ left: `${progress}%` }"
					></div>
				</div>

				<span class="text-sm">{{ formatTime(duration) }}</span>

				<button class="p-2 hover:bg-gray-700 rounded-lg">
					<Icon name="material-symbols:fullscreen" size="20" />
				</button>
			</div>

			<!-- Timeline -->
			<div class="p-4 timeline">
				<div class="flex items-center justify-between mb-4">
					<div class="flex space-x-2">
						<button
							class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
						>
							Kamera
						</button>
						<button
							class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded-lg text-sm"
						>
							Ekran
						</button>
						<button
							class="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm"
						>
							Efekt
						</button>
					</div>
					<div class="flex space-x-2">
						<button
							class="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-sm"
						>
							Böl
						</button>
						<button
							@click="exportVideo"
							class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
						>
							Dışa Aktar
						</button>
					</div>
				</div>

				<!-- Katmanlar -->
				<div class="space-y-2">
					<!-- Kamera Katmanı -->
					<div
						class="relative h-16 bg-gray-800 rounded-lg overflow-hidden group timeline-layer"
					>
						<div
							class="absolute inset-y-0 left-0 w-12 bg-blue-900 flex items-center justify-center"
						>
							<Icon name="material-symbols:videocam" size="20" />
>>>>>>> Stashed changes
						</div>
						<div class="absolute inset-y-0 left-12 right-0">
							<canvas class="w-full h-full"></canvas>
							<div class="relative h-full">
								<!-- Timeline içeriği -->
								<div class="absolute inset-0 flex">
									<template v-for="clip in cameraClips" :key="clip.id">
										<div
											class="absolute h-full bg-blue-500/30 border-l-2 border-r-2 border-blue-500 cursor-move"
											:style="{
												left: `${(clip.start / duration) * 100}%`,
												width: `${((clip.end - clip.start) / duration) * 100}%`,
											}"
											@mousedown="startDragging($event, clip, 'camera')"
										>
											<div
												class="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-b from-black/20"
											>
												<div
													class="absolute inset-x-0 top-0 h-2 cursor-move"
												></div>
												<div
													class="absolute inset-y-0 left-0 w-2 cursor-w-resize"
													@mousedown.stop="startResizing($event, clip, 'start')"
												></div>
												<div
													class="absolute inset-y-0 right-0 w-2 cursor-e-resize"
													@mousedown.stop="startResizing($event, clip, 'end')"
												></div>
											</div>
										</div>
									</template>
								</div>
							</div>
						</div>
					</div>

<<<<<<< Updated upstream
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
=======
					<!-- Ekran Katmanı -->
					<div
						class="relative h-16 bg-gray-800 rounded-lg overflow-hidden group timeline-layer"
					>
						<div
							class="absolute inset-y-0 left-0 w-12 bg-green-900 flex items-center justify-center"
						>
							<Icon name="material-symbols:desktop-windows" size="20" />
						</div>
						<div class="absolute inset-y-0 left-12 right-0">
							<canvas class="w-full h-full"></canvas>
							<div class="relative h-full">
								<!-- Timeline içeriği -->
								<div class="absolute inset-0 flex">
									<template v-for="clip in screenClips" :key="clip.id">
										<div
											class="absolute h-full bg-green-500/30 border-l-2 border-r-2 border-green-500 cursor-move"
											:style="{
												left: `${(clip.start / duration) * 100}%`,
												width: `${((clip.end - clip.start) / duration) * 100}%`,
											}"
											@mousedown="startDragging($event, clip, 'screen')"
										>
											<div
												class="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-b from-black/20"
											>
												<div
													class="absolute inset-x-0 top-0 h-2 cursor-move"
												></div>
												<div
													class="absolute inset-y-0 left-0 w-2 cursor-w-resize"
													@mousedown.stop="startResizing($event, clip, 'start')"
												></div>
												<div
													class="absolute inset-y-0 right-0 w-2 cursor-e-resize"
													@mousedown.stop="startResizing($event, clip, 'end')"
												></div>
											</div>
										</div>
									</template>
								</div>
							</div>
						</div>
					</div>

					<!-- Efekt Katmanı -->
					<div
						class="relative h-12 bg-gray-800 rounded-lg overflow-hidden group timeline-layer"
					>
						<div
							class="absolute inset-y-0 left-0 w-12 bg-purple-900 flex items-center justify-center"
						>
							<Icon name="material-symbols:auto-fix" size="20" />
						</div>
						<div class="absolute inset-y-0 left-12 right-0">
							<canvas class="w-full h-full"></canvas>
							<div class="relative h-full">
								<!-- Timeline içeriği -->
								<div class="absolute inset-0 flex">
									<template v-for="effect in effects" :key="effect.id">
										<div
											class="absolute h-full bg-purple-500/30 border-l-2 border-r-2 border-purple-500 cursor-move"
											:style="{
												left: `${(effect.start / duration) * 100}%`,
												width: `${
													((effect.end - effect.start) / duration) * 100
												}%`,
											}"
											@mousedown="startDragging($event, effect, 'effect')"
										>
											<div class="px-2 text-xs truncate">{{ effect.name }}</div>
											<div
												class="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-b from-black/20"
											>
												<div
													class="absolute inset-x-0 top-0 h-2 cursor-move"
												></div>
												<div
													class="absolute inset-y-0 left-0 w-2 cursor-w-resize"
													@mousedown.stop="
														startResizing($event, effect, 'start')
													"
												></div>
												<div
													class="absolute inset-y-0 right-0 w-2 cursor-e-resize"
													@mousedown.stop="startResizing($event, effect, 'end')"
												></div>
											</div>
>>>>>>> Stashed changes
										</div>
									</template>
								</div>
							</div>
<<<<<<< Updated upstream

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
=======
						</div>
					</div>
				</div>

				<!-- Zaman Çizgisi -->
				<div class="mt-2 relative">
					<div class="absolute left-12 right-0 h-6">
						<div class="relative w-full h-full">
							<!-- Zaman işaretleri -->
							<div class="absolute inset-0 flex">
								<template v-for="i in 10" :key="i">
									<div class="flex-1 border-l border-gray-700 relative">
										<span class="absolute -top-4 left-1 text-xs text-gray-500">
											{{ formatTime((i - 1) * (duration / 10)) }}
										</span>
									</div>
								</template>
							</div>
							<!-- Oynatma çizgisi -->
							<div
								class="absolute top-0 bottom-0 w-0.5 bg-red-500"
								:style="{ left: `${progress}%` }"
							></div>
>>>>>>> Stashed changes
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Cursor -->
		<CustomCursor v-if="isRecording" />
	</div>
</template>

<<<<<<< Updated upstream
<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import CustomCursor from "~/components/CustomCursor.vue";
=======
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const videoCanvas = ref<HTMLCanvasElement | null>(null);
const audioCanvas = ref<HTMLCanvasElement | null>(null);
const timelineRef = ref<HTMLElement | null>(null);
let videoPath: string | null = null;
let animationFrame: number | null = null;
let videoBuffer: ArrayBuffer | null = null;
let videoBlob: Blob | null = null;
let videoElement: HTMLVideoElement | null = null;
>>>>>>> Stashed changes

const videoRef = ref(null);
const audioRef = ref(null);
const currentTime = ref(0);
const duration = ref(0);
<<<<<<< Updated upstream
const isPlaying = ref(false);
const volume = ref(1);
const isMuted = ref(false);
const isFullscreen = ref(false);
const showControls = ref(true);
const isLoading = ref(true);
const electron = window.electron;

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
=======
const progress = ref(0);
const zoomLevel = ref(1);

// Timeline state
interface Clip {
	id: number;
	start: number;
	end: number;
	type: "camera" | "screen";
}

interface Effect {
	id: number;
	name: string;
	start: number;
	end: number;
	type: string;
}

const cameraClips = ref<Clip[]>([]);
const screenClips = ref<Clip[]>([]);
const effects = ref<Effect[]>([]);

// Sürükleme state'i
let isDragging = false;
let currentDragItem: any = null;
let currentDragType: "camera" | "screen" | "effect" | null = null;
let dragStartX = 0;
let dragStartTime = 0;
let isResizing = false;
let resizeEdge: "start" | "end" | null = null;

// Sürükleme işlemleri
const startDragging = (
	event: MouseEvent,
	item: Clip | Effect,
	type: "camera" | "screen" | "effect"
) => {
	isDragging = true;
	currentDragItem = item;
	currentDragType = type;
	dragStartX = event.clientX;
	dragStartTime = item.start;

	window.addEventListener("mousemove", handleDrag);
	window.addEventListener("mouseup", stopDragging);
};

const handleDrag = (event: MouseEvent) => {
	if (!isDragging || !currentDragItem || !timelineRef.value) return;

	const deltaX = event.clientX - dragStartX;
	const timelineWidth = timelineRef.value.clientWidth;
	const deltaTime = (deltaX / timelineWidth) * duration.value;

	// Yeni pozisyonu hesapla
	let newStart = Math.max(0, dragStartTime + deltaTime);
	const clipDuration = currentDragItem.end - currentDragItem.start;

	// Sınırları kontrol et
	if (newStart + clipDuration > duration.value) {
		newStart = duration.value - clipDuration;
	}

	// Pozisyonu güncelle
	currentDragItem.start = newStart;
	currentDragItem.end = newStart + clipDuration;
};

// Yeniden boyutlandırma işlemleri
const startResizing = (
	event: MouseEvent,
	item: Clip | Effect,
	edge: "start" | "end"
) => {
	event.stopPropagation();
	isResizing = true;
	currentDragItem = item;
	resizeEdge = edge;
	dragStartX = event.clientX;

	window.addEventListener("mousemove", handleResize);
	window.addEventListener("mouseup", stopResizing);
};

const handleResize = (event: MouseEvent) => {
	if (!isResizing || !currentDragItem || !timelineRef.value) return;

	const deltaX = event.clientX - dragStartX;
	const timelineWidth = timelineRef.value.clientWidth;
	const deltaTime = (deltaX / timelineWidth) * duration.value;

	if (resizeEdge === "start") {
		const newStart = Math.max(
			0,
			Math.min(currentDragItem.end - 0.5, currentDragItem.start + deltaTime)
		);
		currentDragItem.start = newStart;
	} else {
		const newEnd = Math.min(
			duration.value,
			Math.max(currentDragItem.start + 0.5, currentDragItem.end + deltaTime)
		);
		currentDragItem.end = newEnd;
	}

	dragStartX = event.clientX;
};

const stopResizing = () => {
	isResizing = false;
	currentDragItem = null;
	resizeEdge = null;

	window.removeEventListener("mousemove", handleResize);
	window.removeEventListener("mouseup", stopResizing);
};

const stopDragging = () => {
	isDragging = false;
	currentDragItem = null;
	currentDragType = null;

	window.removeEventListener("mousemove", handleDrag);
	window.removeEventListener("mouseup", stopDragging);
};

// Thumbnail oluşturma
const generateThumbnails = async () => {
	if (!videoElement || !duration.value) return;

	// Her katman için thumbnail canvas'ı oluştur
	const layers = document.querySelectorAll(".timeline-layer");
	layers.forEach(async (layer) => {
		const canvas = layer.querySelector("canvas");
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Canvas boyutlarını ayarla
		const rect = layer.getBoundingClientRect();
		canvas.width = rect.width - 48; // Sol ikon genişliğini çıkar
		canvas.height = rect.height;

		// Thumbnail sayısı ve aralığı
		const numThumbnails = 20;
		const interval = duration.value / numThumbnails;

		// Arka planı temizle
		ctx.fillStyle = "#1f2937";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Thumbnailleri çiz
		for (let i = 0; i < numThumbnails; i++) {
			const time = i * interval;
			if (!isFinite(time)) continue;

			videoElement.currentTime = time;
			await new Promise((resolve) => {
				videoElement.addEventListener("seeked", resolve, { once: true });
			});

			const x = (i / numThumbnails) * canvas.width;
			const width = canvas.width / numThumbnails;

			ctx.drawImage(videoElement, x, 0, width, canvas.height);

			// Dikey ayraç çiz
			ctx.fillStyle = "#374151";
			ctx.fillRect(x, 0, 1, canvas.height);
		}
	});

	// Video'yu başa sar
	videoElement.currentTime = 0;
};

// Video frame çizimi için animasyon
const animate = () => {
	drawFrame();
	if (isPlaying.value) {
		animationFrame = requestAnimationFrame(animate);
	}
};

// Video yükleme işlemini güncelle
onMounted(async () => {
	try {
		videoPath = await window.electron?.getTempVideoPath();
		console.log("Video yolu:", videoPath);

		if (videoPath && videoCanvas.value) {
			const videoData = await window.electron?.readVideoFile(videoPath);
			if (videoData) {
				const binaryData = atob(videoData);
				const bytes = new Uint8Array(binaryData.length);
				for (let i = 0; i < binaryData.length; i++) {
					bytes[i] = binaryData.charCodeAt(i);
				}

				videoBuffer = bytes.buffer;
				videoBlob = new Blob([videoBuffer], { type: "video/mp4" });

				videoElement = document.createElement("video");
				videoElement.src = URL.createObjectURL(videoBlob);

				// Video olaylarını dinle
				videoElement.addEventListener("loadedmetadata", () => {
					duration.value = videoElement?.duration || 0;
					updateCanvasSize();

					// İlk frame'i çiz
					drawFrame();

					// Örnek klipler ekle
					if (duration.value > 0) {
						cameraClips.value.push({
							id: Date.now(),
							start: 0,
							end: duration.value,
							type: "camera",
						});

						// Thumbnail'leri oluştur
						generateThumbnails();
					}
				});

				videoElement.addEventListener("timeupdate", () => {
					currentTime.value = videoElement?.currentTime || 0;
					progress.value = (currentTime.value / duration.value) * 100;
				});

				videoElement.addEventListener("ended", () => {
					isPlaying.value = false;
					cancelAnimationFrame(animationFrame!);
				});

				videoElement.load();
			}
		}
	} catch (error) {
		console.error("Video yüklenirken hata oluştu:", error);
	}
});

// Canvas boyutunu güncelle
const updateCanvasSize = () => {
	if (!videoCanvas.value || !videoElement) return;

	const canvas = videoCanvas.value;
	const container = canvas.parentElement;
	if (!container) return;

	const rect = container.getBoundingClientRect();
	canvas.width = rect.width;
	canvas.height = rect.height;
};

// Video frame'ini canvas'a çiz
const drawFrame = () => {
	if (!videoCanvas.value || !videoElement) return;

	const ctx = videoCanvas.value.getContext("2d");
	if (!ctx) return;

	// Video boyutlarını al
	const videoWidth = videoElement.videoWidth;
	const videoHeight = videoElement.videoHeight;

	// Canvas boyutlarını al
	const canvasWidth = videoCanvas.value.width;
	const canvasHeight = videoCanvas.value.height;

	// En-boy oranını koru
	const aspectRatio = videoWidth / videoHeight;
	const canvasAspectRatio = canvasWidth / canvasHeight;

	let drawWidth = canvasWidth;
	let drawHeight = canvasHeight;
	let offsetX = 0;
	let offsetY = 0;

	if (aspectRatio > canvasAspectRatio) {
		// Video daha geniş
		drawHeight = canvasWidth / aspectRatio;
		offsetY = (canvasHeight - drawHeight) / 2;
	} else {
		// Video daha uzun
		drawWidth = canvasHeight * aspectRatio;
		offsetX = (canvasWidth - drawWidth) / 2;
>>>>>>> Stashed changes
	}

	// Arka planı temizle
	ctx.fillStyle = "#1f2937";
	ctx.fillRect(0, 0, canvasWidth, canvasHeight);

	// Frame'i çiz
	ctx.drawImage(videoElement, offsetX, offsetY, drawWidth, drawHeight);
};

<<<<<<< Updated upstream
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
=======
// Oynatma kontrolünü güncelle
const togglePlay = () => {
	if (!videoElement) return;

	if (isPlaying.value) {
		videoElement.pause();
		isPlaying.value = false;
		cancelAnimationFrame(animationFrame!);
	} else {
		videoElement.play();
		isPlaying.value = true;
		animate();
	}
};

// İlerleme çubuğunda tıklama
const seek = (event: MouseEvent) => {
	if (!videoElement) return;
>>>>>>> Stashed changes

const onLoadedMetadata = () => {
	if (videoRef.value) {
		duration.value = videoRef.value.duration;
		isLoading.value = false;
	}
};

<<<<<<< Updated upstream
const onPlay = () => {
	isPlaying.value = true;
=======
	videoElement.currentTime = percentage * duration.value;
	drawFrame();
>>>>>>> Stashed changes
};

const onPause = () => {
	isPlaying.value = false;
};

const onEnded = () => {
	isPlaying.value = false;
};

<<<<<<< Updated upstream
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
=======
	try {
		const timestamp = Date.now();
		const savePath = await window.electron?.showSaveDialog({
			defaultPath: `kayit-${timestamp}.mp4`,
			filters: [
				{ name: "MP4 Video", extensions: ["mp4"] },
				{ name: "WebM Video", extensions: ["webm"] },
			],
		});
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
	window.removeEventListener("keydown", onKeyDown);
	clearTimeout(controlsTimeout);
=======
	if (animationFrame !== null) {
		cancelAnimationFrame(animationFrame);
	}

	if (videoElement?.src) {
		URL.revokeObjectURL(videoElement.src);
	}

	if (videoElement) {
		videoElement.remove();
		videoElement = null;
	}

	videoBuffer = null;
	videoBlob = null;
});

// Event listener'ları
onMounted(() => {
	window.addEventListener("mousemove", handleResize);
	window.addEventListener("mouseup", stopDragging);

	// Ses dalga formu çizimi
	if (videoElement && audioCanvas.value) {
		const audioContext = new AudioContext();
		const source = audioContext.createMediaElementSource(videoElement);
		const analyser = audioContext.createAnalyser();
		source.connect(analyser);
		analyser.connect(audioContext.destination);

		const drawAudioWaveform = () => {
			if (!audioCanvas.value) return;
			const ctx = audioCanvas.value.getContext("2d");
			if (!ctx) return;

			const bufferLength = analyser.frequencyBinCount;
			const dataArray = new Uint8Array(bufferLength);
			analyser.getByteTimeDomainData(dataArray);

			ctx.fillStyle = "#374151";
			ctx.fillRect(0, 0, audioCanvas.value.width, audioCanvas.value.height);

			ctx.lineWidth = 2;
			ctx.strokeStyle = "#60A5FA";
			ctx.beginPath();

			const sliceWidth = audioCanvas.value.width / bufferLength;
			let x = 0;

			for (let i = 0; i < bufferLength; i++) {
				const v = dataArray[i] / 128.0;
				const y = (v * audioCanvas.value.height) / 2;

				if (i === 0) {
					ctx.moveTo(x, y);
				} else {
					ctx.lineTo(x, y);
				}

				x += sliceWidth;
			}

			ctx.lineTo(audioCanvas.value.width, audioCanvas.value.height / 2);
			ctx.stroke();

			requestAnimationFrame(drawAudioWaveform);
		};

		drawAudioWaveform();
	}
});

onUnmounted(() => {
	window.removeEventListener("mousemove", handleResize);
	window.removeEventListener("mouseup", stopDragging);
>>>>>>> Stashed changes
});
</script>

<style>
<<<<<<< Updated upstream
.camera-preview {
	pointer-events: none;
}

/* Kamera önizlemesini gizle */
video[ref="cameraPlayer"] {
	display: none !important;
=======
.timeline {
	height: 200px;
	position: relative;
}

.timeline-layer {
	position: relative;
}

.timeline-layer canvas {
	position: absolute;
	top: 0;
	left: 48px; /* Sol ikon genişliği */
	right: 0;
	bottom: 0;
	pointer-events: none;
}

.timeline-ruler {
	height: 20px;
	position: relative;
	border-bottom: 1px solid #374151;
}

.timeline-ruler-mark {
	position: absolute;
	width: 1px;
	height: 10px;
	background-color: #4b5563;
	bottom: 0;
}

.timeline-ruler-mark.major {
	height: 15px;
	background-color: #6b7280;
}

.timeline-ruler-label {
	position: absolute;
	bottom: 20px;
	transform: translateX(-50%);
	font-size: 10px;
	color: #9ca3af;
>>>>>>> Stashed changes
}
</style>
