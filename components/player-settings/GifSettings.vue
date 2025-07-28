<template>
	<div class="flex flex-col gap-12 min-h-[800px] w-full max-w-[500px]">
		<!-- Görsel Ekleme Section -->
		<div class="space-y-4">
			<div>
				<h4 class="text-base font-semibold text-white">Add Image</h4>
				<p class="text-sm font-normal text-gray-500">
					Add images to your video as overlay elements.
				</p>
			</div>

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
								d="M12.75 8.25V15.75M18.75 8.25H15.75V12M15.75 12V15.75M15.75 12H18M9.75 9.34835C8.72056 7.88388 7.05152 7.88388 6.02208 9.34835C4.99264 10.8128 4.99264 13.1872 6.02208 14.6517C7.05152 16.1161 8.72056 16.1161 9.75 14.6517V12H8.25M4.5 19.5H19.5C20.7426 19.5 21.75 18.4926 21.75 17.25V6.75C21.75 5.50736 20.7426 4.5 19.5 4.5H4.5C3.25736 4.5 2.25 5.50736 2.25 6.75V17.25C2.25 18.4926 3.25736 19.5 4.5 19.5Z"
								stroke="white"
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
			<div>
				<h4 class="text-base font-semibold text-white">GIF Search</h4>
				<p class="text-sm font-normal text-gray-500">
					Search and add GIFs from Giphy to your video.
				</p>
			</div>

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
					@click="addGifToCanvas(gif)"
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
			<h5 class="text-sm font-semibold text-white">Active GIFs</h5>
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
		addGifToCanvas(imageObject);

		// Clear selection
		clearSelectedImage();
	};

	img.src = selectedImagePreview.value;
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
