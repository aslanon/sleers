<template>
	<div class="flex flex-col gap-12 min-h-[800px] max-w-[400px]">
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
			<div class="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
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
							<p class="text-sm text-white font-medium truncate">
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

		<!-- GIF Controls (when gif is selected) -->
		<div v-if="selectedGif" class="space-y-6">
			<div>
				<h5 class="text-sm font-semibold text-white mb-4">GIF Controls</h5>

				<!-- Position Controls -->
				<div class="space-y-4">
					<SliderInput
						v-model="selectedGif.x"
						label="X Position"
						desc="Horizontal position on canvas"
						:min="0"
						:max="1920"
						:step="1"
						unit="px"
						@update:modelValue="updateGifPosition"
					/>

					<SliderInput
						v-model="selectedGif.y"
						label="Y Position"
						desc="Vertical position on canvas"
						:min="0"
						:max="1080"
						:step="1"
						unit="px"
						@update:modelValue="updateGifPosition"
					/>

					<!-- Size Controls -->
					<SliderInput
						v-model="selectedGif.width"
						label="Width"
						desc="GIF width in pixels"
						:min="50"
						:max="800"
						:step="1"
						unit="px"
						@update:modelValue="updateGifSize"
					/>

					<SliderInput
						v-model="selectedGif.height"
						label="Height"
						desc="GIF height in pixels"
						:min="50"
						:max="600"
						:step="1"
						unit="px"
						@update:modelValue="updateGifSize"
					/>

					<!-- Opacity Control -->
					<SliderInput
						v-model="selectedGif.opacity"
						label="Opacity"
						desc="GIF transparency"
						:min="0"
						:max="1"
						:step="0.1"
						@update:modelValue="updateGifOpacity"
					/>

					<!-- Timing Controls -->
					<SliderInput
						v-model="selectedGif.startTime"
						label="Start Time"
						desc="When GIF appears in video"
						:min="0"
						:max="duration"
						:step="0.1"
						unit="s"
						@update:modelValue="updateGifTiming"
					/>

					<SliderInput
						v-model="selectedGif.endTime"
						label="End Time"
						desc="When GIF disappears from video"
						:min="selectedGif.startTime + 0.1"
						:max="duration"
						:step="0.1"
						unit="s"
						@update:modelValue="updateGifTiming"
					/>
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
</script>
