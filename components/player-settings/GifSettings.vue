<template>
	<div class="flex flex-col gap-12 min-h-[800px] w-full max-w-[500px]">
		<!-- Video Ekleme Section -->
		<div class="space-y-4">
			<div class="flex items-center gap-2">
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M3.375 19.5H20.625M3.375 19.5C2.75368 19.5 2.25 18.9963 2.25 18.375M3.375 19.5H4.875C5.49632 19.5 6 18.9963 6 18.375M2.25 18.375V5.625M2.25 18.375V16.875C2.25 16.2537 2.75368 15.75 3.375 15.75M21.75 18.375V5.625M21.75 18.375C21.75 18.9963 21.2463 19.5 20.625 19.5M21.75 18.375V16.875C21.75 16.2537 21.2463 15.75 20.625 15.75M20.625 19.5H19.125C18.5037 19.5 18 18.9963 18 18.375M20.625 4.5H3.375M20.625 4.5C21.2463 4.5 21.75 5.00368 21.75 5.625M20.625 4.5H19.125C18.5037 4.5 18 5.00368 18 5.625M21.75 5.625V7.125C21.75 7.74632 21.2463 8.25 20.625 8.25M3.375 4.5C2.75368 4.5 2.25 5.00368 2.25 5.625M3.375 4.5H4.875C5.49632 4.5 6 5.00368 6 5.625M2.25 5.625V7.125C2.25 7.74632 2.75368 8.25 3.375 8.25M3.375 8.25H4.875M3.375 8.25C2.75368 8.25 2.25 8.75368 2.25 9.375V10.875C2.25 11.4963 2.75368 12 3.375 12M4.875 8.25C5.49632 8.25 6 7.74632 6 7.125V5.625M4.875 8.25C5.49632 8.25 6 8.75368 6 9.375V10.875M6 5.625V10.875M6 5.625C6 5.00368 6.50368 4.5 7.125 4.5H16.875C17.4963 4.5 18 5.00368 18 5.625M19.125 8.25H20.625M19.125 8.25C18.5037 8.25 18 7.74632 18 7.125V5.625M19.125 8.25C18.5037 8.25 18 8.75368 18 9.375V10.875M20.625 8.25C21.2463 8.25 21.75 8.75368 21.75 9.375V10.875C21.75 11.4963 21.2463 12 20.625 12M18 5.625V10.875M7.125 12H16.875M7.125 12C6.50368 12 6 11.4963 6 10.875M7.125 12C6.50368 12 6 12.5037 6 13.125M6 10.875C6 11.4963 5.49632 12 4.875 12M18 10.875C18 11.4963 17.4963 12 16.875 12M18 10.875C18 11.4963 18.5037 12 19.125 12M16.875 12C17.4963 12 18 12.5037 18 13.125M6 18.375V13.125M6 18.375C6 18.9963 6.50368 19.5 7.125 19.5H16.875C17.4963 19.5 18 18.9963 18 18.375M6 18.375V16.875C6 16.2537 5.49632 15.75 4.875 15.75M18 18.375V13.125M18 18.375V16.875C18 16.2537 18.5037 15.75 19.125 15.75M18 13.125V14.625C18 15.2463 18.5037 15.75 19.125 15.75M18 13.125C18 12.5037 18.5037 12 19.125 12M6 13.125V14.625C6 15.2463 5.49632 15.75 4.875 15.75M6 13.125C6 12.5037 5.49632 12 4.875 12M3.375 12H4.875M3.375 12C2.75368 12 2.25 12.5037 2.25 13.125V14.625C2.25 15.2463 2.75368 15.75 3.375 15.75M19.125 12H20.625M20.625 12C21.2463 12 21.75 12.5037 21.75 13.125V14.625C21.75 15.2463 21.2463 15.75 20.625 15.75M3.375 15.75H4.875M19.125 15.75H20.625"
						stroke="white"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				<h4 class="text-base font-semibold text-white">Add Video</h4>
			</div>
			<p class="text-sm font-normal text-gray-500">
				Add videos to your video as overlay elements.
			</p>

			<div class="space-y-3">
				<!-- Video File Input -->
				<div class="relative">
					<input
						ref="videoFileInput"
						type="file"
						accept="video/*"
						@change="handleVideoFileSelect"
						class="hidden"
					/>
					<button
						@click="$refs.videoFileInput.click()"
						class="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white hover:bg-zinc-700/50 transition-colors flex items-center justify-center space-x-2"
					>
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M3.375 19.5H20.625M3.375 19.5C2.75368 19.5 2.25 18.9963 2.25 18.375M3.375 19.5H4.875C5.49632 19.5 6 18.9963 6 18.375M2.25 18.375V5.625M2.25 18.375V16.875C2.25 16.2537 2.75368 15.75 3.375 15.75M21.75 18.375V5.625M21.75 18.375C21.75 18.9963 21.2463 19.5 20.625 19.5M21.75 18.375V16.875C21.75 16.2537 21.2463 15.75 20.625 15.75M20.625 19.5H19.125C18.5037 19.5 18 18.9963 18 18.375M20.625 4.5H3.375M20.625 4.5C21.2463 4.5 21.75 5.00368 21.75 5.625M20.625 4.5H19.125C18.5037 4.5 18 5.00368 18 5.625M21.75 5.625V7.125C21.75 7.74632 21.2463 8.25 20.625 8.25M3.375 4.5C2.75368 4.5 2.25 5.00368 2.25 5.625M3.375 4.5H4.875C5.49632 4.5 6 5.00368 6 5.625M2.25 5.625V7.125C2.25 7.74632 2.75368 8.25 3.375 8.25M3.375 8.25H4.875M3.375 8.25C2.75368 8.25 2.25 8.75368 2.25 9.375V10.875C2.25 11.4963 2.75368 12 3.375 12M4.875 8.25C5.49632 8.25 6 7.74632 6 7.125V5.625M4.875 8.25C5.49632 8.25 6 8.75368 6 9.375V10.875M6 5.625V10.875M6 5.625C6 5.00368 6.50368 4.5 7.125 4.5H16.875C17.4963 4.5 18 5.00368 18 5.625M19.125 8.25H20.625M19.125 8.25C18.5037 8.25 18 7.74632 18 7.125V5.625M19.125 8.25C18.5037 8.25 18 8.75368 18 9.375V10.875M20.625 8.25C21.2463 8.25 21.75 8.75368 21.75 9.375V10.875C21.75 11.4963 21.2463 12 20.625 12M18 5.625V10.875M7.125 12H16.875M7.125 12C6.50368 12 6 11.4963 6 10.875M7.125 12C6.50368 12 6 12.5037 6 13.125M6 10.875C6 11.4963 5.49632 12 4.875 12M18 10.875C18 11.4963 17.4963 12 16.875 12M18 10.875C18 11.4963 18.5037 12 19.125 12M16.875 12C17.4963 12 18 12.5037 18 13.125M6 18.375V13.125M6 18.375C6 18.9963 6.50368 19.5 7.125 19.5H16.875C17.4963 19.5 18 18.9963 18 18.375M6 18.375V16.875C6 16.2537 5.49632 15.75 4.875 15.75M18 18.375V13.125M18 18.375V16.875C18 16.2537 18.5037 15.75 19.125 15.75M18 13.125V14.625C18 15.2463 18.5037 15.75 19.125 15.75M18 13.125C18 12.5037 18.5037 12 19.125 12M6 13.125V14.625C6 15.2463 5.49632 15.75 4.875 15.75M6 13.125C6 12.5037 5.49632 12 4.875 12M3.375 12H4.875M3.375 12C2.75368 12 2.25 12.5037 2.25 13.125V14.625C2.25 15.2463 2.75368 15.75 3.375 15.75M19.125 12H20.625M20.625 12C21.2463 12 21.75 12.5037 21.75 13.125V14.625C21.75 15.2463 21.2463 15.75 20.625 15.75M3.375 15.75H4.875M19.125 15.75H20.625"
								stroke="white"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						<span>Select Video</span>
					</button>
				</div>

				<!-- Video Loading State -->
				<div v-if="isVideoLoading" class="space-y-2">
					<div class="bg-zinc-800/30 rounded-lg p-8 flex flex-col items-center justify-center">
						<div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
						<p class="text-sm text-gray-400">Loading video...</p>
					</div>
				</div>

				<!-- Video Load Error -->
				<div v-if="videoLoadError" class="space-y-2">
					<div class="bg-red-900/20 border border-red-700 rounded-lg p-4">
						<p class="text-sm text-red-400">{{ videoLoadError }}</p>
						<button
							@click="clearSelectedVideo"
							class="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
						>
							Try Again
						</button>
					</div>
				</div>

				<!-- Selected Video Preview -->
				<div v-if="selectedVideoFile && !isVideoLoading && !videoLoadError" class="space-y-2">
					<div class="relative bg-zinc-800/30 rounded-lg overflow-hidden">
						<video
							:src="selectedVideoPreview"
							class="w-full h-32 object-cover"
							controls
							muted
						/>
						<div class="absolute top-2 right-2">
							<button
								@click="clearSelectedVideo"
								class="bg-red-600 hover:bg-red-700 text-white p-1 rounded-full"
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M18 6L6 18M6 6L18 18"
										stroke="white"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</button>
						</div>
					</div>
					<button
						@click="addVideoToCanvas"
						:disabled="isVideoLoading"
						class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
					>
						<span v-if="isVideoLoading">Processing...</span>
						<span v-else>Add to canvas</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Görsel Ekleme Section -->
		<div class="space-y-4">
			<div class="flex items-center gap-2">
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M2.25 15.75L7.40901 10.591C8.28769 9.71231 9.71231 9.71231 10.591 10.591L15.75 15.75M14.25 14.25L15.659 12.841C16.5377 11.9623 17.9623 11.9623 18.841 12.841L21.75 15.75M3.75 19.5H20.25C21.0784 19.5 21.75 18.8284 21.75 18V6C21.75 5.17157 21.0784 4.5 20.25 4.5H3.75C2.92157 4.5 2.25 5.17157 2.25 6V18C2.25 18.8284 2.92157 19.5 3.75 19.5ZM14.25 8.25H14.2575V8.2575H14.25V8.25ZM14.625 8.25C14.625 8.45711 14.4571 8.625 14.25 8.625C14.0429 8.625 13.875 8.45711 13.875 8.25C13.875 8.04289 14.0429 7.875 14.25 7.875C14.4571 7.875 14.625 8.04289 14.625 8.25Z"
						stroke="white"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				<h4 class="text-base font-semibold text-white">Add Image</h4>
			</div>
			<p class="text-sm font-normal text-gray-500">
				Add images to your video as overlay elements.
			</p>

			<div class="space-y-3">
				<!-- File Input -->
				<div class="relative">
					<input
						ref="imageFileInput"
						type="file"
						accept="image/*"
						@change="handleImageFileSelect"
						class="hidden"
					/>
					<button
						@click="$refs.imageFileInput.click()"
						class="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white hover:bg-zinc-700/50 transition-colors flex items-center justify-center space-x-2"
					>
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M2.25 15.75L7.40901 10.591C8.28769 9.71231 9.71231 9.71231 10.591 10.591L15.75 15.75M14.25 14.25L15.659 12.841C16.5377 11.9623 17.9623 11.9623 18.841 12.841L21.75 15.75M3.75 19.5H20.25C21.0784 19.5 21.75 18.8284 21.75 18V6C21.75 5.17157 21.0784 4.5 20.25 4.5H3.75C2.92157 4.5 2.25 5.17157 2.25 6V18C2.25 18.8284 2.92157 19.5 3.75 19.5ZM14.25 8.25H14.2575V8.2575H14.25V8.25ZM14.625 8.25C14.625 8.45711 14.4571 8.625 14.25 8.625C14.0429 8.625 13.875 8.45711 13.875 8.25C13.875 8.04289 14.0429 7.875 14.25 7.875C14.4571 7.875 14.625 8.04289 14.625 8.25Z"
								stroke="white"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						<span>Select Image</span>
					</button>
				</div>

				<!-- Selected Image Preview -->
				<div v-if="selectedImageFile" class="space-y-2">
					<div class="relative bg-zinc-800/30 rounded-lg overflow-hidden">
						<img
							:src="selectedImagePreview"
							:alt="selectedImageFile.name"
							class="w-full h-32 object-cover"
						/>
						<div class="absolute top-2 right-2">
							<button
								@click="clearSelectedImage"
								class="bg-red-600 hover:bg-red-700 text-white p-1 rounded-full"
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M18 6L6 18M6 6L18 18"
										stroke="white"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</button>
						</div>
					</div>
					<button
						@click="addImageToCanvas"
						class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
					>
						Add to canvas
					</button>
				</div>
			</div>
		</div>

		<!-- GIF Search Section -->
		<div class="space-y-4">
			<div class="flex items-center gap-2">
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M12.75 8.25V15.75M18.75 8.25H15.75V12M15.75 12V15.75M15.75 12H18M9.75 9.34835C8.72056 7.88388 7.05152 7.88388 6.02208 9.34835C4.99264 10.8128 4.99264 13.1872 6.02208 14.6517C7.05152 16.1161 8.72056 16.1161 9.75 14.6517V12H8.25M4.5 19.5H19.5C20.7426 19.5 21.75 18.4926 21.75 17.25V6.75C21.75 5.50736 20.7426 4.5 19.5 4.5H4.5C3.25736 4.5 2.25 5.50736 2.25 6.75V17.25C2.25 18.4926 3.25736 19.5 4.5 19.5Z"
						stroke="white"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				<h4 class="text-base font-semibold text-white">Add GIF</h4>
			</div>
			<p class="text-sm font-normal text-gray-500">
				Search and add GIFs from Giphy to your video.
			</p>

			<div class="relative">
				<input
					v-model="searchQuery"
					@keyup.enter="searchGifs"
					@input="debounceSearch"
					type="text"
					placeholder="Search for GIFs..."
					class="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
				<button
					@click="searchGifs"
					:disabled="isSearching || !searchQuery.trim()"
					class="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded-md transition-colors"
				>
					<span v-if="isSearching">...</span>
					<span v-else>Search</span>
				</button>
			</div>
		</div>

		<!-- GIF Results -->
		<div v-if="searchResults.length > 0" class="space-y-4">
			<h5 class="text-sm font-semibold text-white">Search Results</h5>
			<div class="grid grid-cols-2 gap-3">
				<div
					v-for="gif in searchResults"
					:key="gif.id"
					@click="addGifToCanvas(gif, props.duration)"
					class="relative bg-zinc-800/30 rounded-lg overflow-hidden cursor-pointer hover:bg-zinc-700/50 transition-colors group"
				>
					<img
						:src="gif.images.fixed_width_small.url"
						:alt="gif.title"
						class="w-full h-24 object-cover"
						loading="lazy"
					/>
					<div
						class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center"
					>
						<svg
							class="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 6v6m0 0v6m0-6h6m-6 0H6"
							/>
						</svg>
					</div>
					<div
						class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2"
					>
						<p class="text-xs text-white truncate">{{ gif.title }}</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Active GIFs -->
		<div v-if="activeGifs.length > 0" class="space-y-4">
			<h5 class="text-sm font-semibold text-white">Active Media Elements</h5>
			<div class="space-y-3">
				<div
					v-for="gif in activeGifs"
					:key="gif.id"
					class="flex items-center justify-between p-3 bg-zinc-800/30 rounded-lg"
				>
					<div class="flex items-center space-x-3">
						<img
							:src="gif.url"
							:alt="gif.title"
							class="w-12 h-8 object-cover rounded"
						/>
						<div>
							<p class="text-sm text-white max-w-[100px] font-medium truncate">
								{{ gif.title }}
							</p>
							<p class="text-xs text-gray-400">
								{{ formatTime(gif.startTime) }} - {{ formatTime(gif.endTime) }}
							</p>
						</div>
					</div>
					<div class="flex items-center space-x-2">
						<button
							@click="selectGif(gif.id)"
							:class="{
								'bg-blue-600': selectedGifId === gif.id,
								'bg-zinc-600 hover:bg-zinc-500': selectedGifId !== gif.id,
							}"
							class="px-3 py-1 text-xs text-white rounded transition-colors"
						>
							{{ selectedGifId === gif.id ? "Selected" : "Select" }}
						</button>
						<button
							@click="removeGif(gif.id)"
							class="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
						>
							<svg
								class="w-4 h-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
								/>
							</svg>
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Instructions -->
		<div v-if="activeGifs.length === 0" class="text-center py-8">
			<svg
				class="w-16 h-16 text-gray-600 mx-auto mb-4"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2M7 4h10M7 4l-2 16h14l-2-16M10 9v8m4-8v8"
				/>
			</svg>
			<p class="text-gray-400 text-sm">
				Search for GIFs above to add them to your video
			</p>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useGifManager } from "~/composables/useGifManager";
import SliderInput from "~/components/ui/SliderInput.vue";

const props = defineProps({
	duration: {
		type: Number,
		default: 0,
	},
});

// Image file handling
const selectedImageFile = ref(null);
const selectedImagePreview = ref(null);

// Video file handling
const selectedVideoFile = ref(null);
const selectedVideoPreview = ref(null);
const isVideoLoading = ref(false);
const videoLoadError = ref(null);

// Use GIF manager composable
const {
	searchQuery,
	searchResults,
	activeGifs,
	selectedGifId,
	isSearching,
	searchGifs,
	addGifToCanvas,
	removeGif,
	selectGif,
	updateGifPosition,
	updateGifSize,
	updateGifOpacity,
	updateGifTiming,
} = useGifManager();

// Debug electronAPI on component mount
onMounted(() => {
	console.log("GifSettings: Checking electronAPI availability...");
	console.log("window.electronAPI:", window.electronAPI);
	if (window.electronAPI) {
		console.log(
			"Available electronAPI methods:",
			Object.keys(window.electronAPI)
		);
	}
});

// Debounced search
let searchTimeout = null;
const debounceSearch = () => {
	clearTimeout(searchTimeout);
	searchTimeout = setTimeout(() => {
		if (searchQuery.value.trim()) {
			searchGifs();
		}
	}, 500);
};

// Selected GIF computed
const selectedGif = computed(() => {
	return activeGifs.value.find((gif) => gif.id === selectedGifId.value);
});

// Time formatting helper
const formatTime = (seconds) => {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Image handling functions
const handleImageFileSelect = (event) => {
	const file = event.target.files[0];
	if (file && file.type.startsWith("image/")) {
		selectedImageFile.value = file;

		// Create preview URL
		const reader = new FileReader();
		reader.onload = (e) => {
			selectedImagePreview.value = e.target.result;
		};
		reader.readAsDataURL(file);
	}
};

const clearSelectedImage = () => {
	selectedImageFile.value = null;
	selectedImagePreview.value = null;
	// Clear file input
	const fileInput = document.querySelector('input[type="file"]');
	if (fileInput) {
		fileInput.value = "";
	}
};

const addImageToCanvas = () => {
	if (!selectedImageFile.value) return;

	// Create a temporary image to get dimensions
	const img = new Image();
	img.onload = () => {
		// Calculate aspect ratio
		const aspectRatio = img.width / img.height;

		// Set default size while maintaining aspect ratio
		const defaultWidth = 300; // Base width
		const defaultHeight = defaultWidth / aspectRatio;

		// Create image object similar to GIF structure
		const imageId = `image_${Date.now()}`;
		const imageObject = {
			id: imageId,
			title: selectedImageFile.value.name,
			url: selectedImagePreview.value,
			type: "image", // Distinguish from GIFs
			x: 100,
			y: 100,
			width: defaultWidth,
			height: defaultHeight,
			opacity: 1,
			startTime: 0,
			endTime: props.duration || 10,
			file: selectedImageFile.value,
			originalWidth: img.width,
			originalHeight: img.height,
			aspectRatio: aspectRatio,
		};

		// Add to active GIFs (images will be handled as GIFs in the system)
		addGifToCanvas(imageObject, props.duration);

		// Clear selection
		clearSelectedImage();
	};

	img.src = selectedImagePreview.value;
};

// Video handling functions
const handleVideoFileSelect = (event) => {
	const file = event.target.files[0];
	if (file && file.type.startsWith("video/")) {
		// Reset states
		videoLoadError.value = null;
		isVideoLoading.value = true;
		
		// Check file size (warn if > 100MB)
		const maxSize = 100 * 1024 * 1024; // 100MB
		const fileSize = file.size;
		
		if (fileSize > maxSize) {
			console.warn(`Large video file detected: ${(fileSize / 1024 / 1024).toFixed(1)}MB`);
		}

		selectedVideoFile.value = file;

		// Create preview URL with timeout and error handling
		const reader = new FileReader();
		
		reader.onload = (e) => {
			selectedVideoPreview.value = e.target.result;
			isVideoLoading.value = false;
		};
		
		reader.onerror = () => {
			videoLoadError.value = "Failed to load video file. Please try a different file.";
			isVideoLoading.value = false;
			selectedVideoFile.value = null;
		};
		
		// Add timeout for very large files
		const loadTimeout = setTimeout(() => {
			if (isVideoLoading.value) {
				reader.abort();
				videoLoadError.value = "Video loading timed out. File may be too large.";
				isVideoLoading.value = false;
				selectedVideoFile.value = null;
			}
		}, 30000); // 30 second timeout
		
		reader.onloadend = () => {
			clearTimeout(loadTimeout);
		};
		
		reader.readAsDataURL(file);
	}
};

const clearSelectedVideo = () => {
	selectedVideoFile.value = null;
	selectedVideoPreview.value = null;
	isVideoLoading.value = false;
	videoLoadError.value = null;
	// Clear file input
	const fileInput = document.querySelector(
		'input[type="file"][accept="video/*"]'
	);
	if (fileInput) {
		fileInput.value = "";
	}
};

const addVideoToCanvas = () => {
	if (!selectedVideoFile.value || isVideoLoading.value) return;

	isVideoLoading.value = true;
	videoLoadError.value = null;

	// Create a temporary video element to get dimensions
	const video = document.createElement("video");
	video.preload = "metadata"; // Only load metadata, not the full video
	
	// Set timeout for metadata loading
	const metadataTimeout = setTimeout(() => {
		videoLoadError.value = "Failed to load video metadata. The file may be corrupted or in an unsupported format.";
		isVideoLoading.value = false;
	}, 15000); // 15 second timeout for metadata
	
	video.onloadedmetadata = () => {
		clearTimeout(metadataTimeout);
		
		try {
			// Validate video properties
			if (!video.videoWidth || !video.videoHeight) {
				throw new Error("Invalid video dimensions");
			}
			
			// Calculate aspect ratio
			const aspectRatio = video.videoWidth / video.videoHeight;

			// Set default size while maintaining aspect ratio
			const defaultWidth = 400; // Base width for videos
			const defaultHeight = defaultWidth / aspectRatio;

			// Get video duration (fallback to 10 if not available)
			const videoDuration = isFinite(video.duration) && video.duration > 0 ? video.duration : 10;
			
			console.log(`Video loaded: ${video.videoWidth}x${video.videoHeight}, duration: ${videoDuration}s`);

			// Create video object similar to GIF structure
			const videoId = `video_${Date.now()}`;
			const videoObject = {
				id: videoId,
				title: selectedVideoFile.value.name,
				url: selectedVideoPreview.value,
				type: "video", // Distinguish from GIFs and images
				x: 100,
				y: 100,
				width: defaultWidth,
				height: defaultHeight,
				opacity: 1,
				startTime: 0,
				endTime: videoDuration, // Video'nun kendi duration'ını kullan
				file: selectedVideoFile.value,
				originalWidth: video.videoWidth,
				originalHeight: video.videoHeight,
				aspectRatio: aspectRatio,
				duration: videoDuration,
			};

			// Add to active GIFs (videos will be handled as GIFs in the system)
			addGifToCanvas(videoObject, videoDuration);

			// Clear selection
			clearSelectedVideo();
			
		} catch (error) {
			console.error("Error processing video:", error);
			videoLoadError.value = `Error processing video: ${error.message}`;
		} finally {
			isVideoLoading.value = false;
		}
	};
	
	video.onerror = (e) => {
		clearTimeout(metadataTimeout);
		console.error("Video loading error:", e);
		videoLoadError.value = "Failed to load video. Please check the file format and try again.";
		isVideoLoading.value = false;
	};

	// Set video source to trigger loading
	video.src = selectedVideoPreview.value;
};

// Update size while preserving aspect ratio for images
const updateGifSizeWithAspectRatio = () => {
	if (
		selectedGif.value &&
		selectedGif.value.type === "image" &&
		selectedGif.value.aspectRatio
	) {
		// For images, maintain aspect ratio
		const aspectRatio = selectedGif.value.aspectRatio;

		// Update height based on width change
		if (selectedGif.value.width) {
			selectedGif.value.height = selectedGif.value.width / aspectRatio;
		}
		// Update width based on height change
		else if (selectedGif.value.height) {
			selectedGif.value.width = selectedGif.value.height * aspectRatio;
		}
	}

	// Call the original update function
	updateGifSize();
};
</script>
