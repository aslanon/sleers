<template>
	<div
		class="media-player-controls mt-4 flex justify-center items-center space-x-4"
	>
		<div class="flex flex-row space-x-4">
			<!-- Aspect Ratio Seçimi -->
			<div class="relative">
				<button
					ref="dropdownButton"
					@click="toggleDropdown"
					class="aspect-ratio-button px-3 py-1.5 w-[150px] rounded bg-black/80 border border-white/5 transition-all flex items-center justify-between space-x-2 hover:border-white/10"
				>
					<span class="text-sm text-white/90">{{
						getCurrentRatio?.label || "Auto"
					}}</span>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4 transition-transform text-white/70"
						:class="{ 'rotate-180': isAspectRatioOpen }"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 9l-7 7-7-7"
						/>
					</svg>
				</button>

				<!-- Dropdown Menu -->
				<div
					v-show="isAspectRatioOpen"
					class="fixed inset-0 z-50 bg-transparent"
					@click="isAspectRatioOpen = false"
				></div>
				<div
					v-show="isAspectRatioOpen"
					ref="dropdownMenu"
					class="fixed bg-zinc-900/95 backdrop-blur-sm rounded-lg border border-white/10 py-1 z-[60] shadow-xl"
				>
					<div class="max-h-[320px] overflow-y-auto" @mousedown.stop>
						<button
							v-for="ratio in aspectRatios"
							:key="ratio.value"
							@click="selectAspectRatio(ratio.value)"
							class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-white/5 transition-colors text-left group"
							:class="{ 'text-purple-400': cropRatio === ratio.value }"
						>
							<div
								class="aspect-icon-wrapper w-5 h-5 rounded bg-white/5 flex items-center justify-center group-hover:bg-white/10"
							>
								<div class="aspect-icon" :class="ratio.iconClass"></div>
							</div>
							<span class="text-sm flex-1">{{ ratio.label }}</span>
							<div
								v-if="cropRatio === ratio.value"
								class="w-4 h-4 flex items-center justify-center"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
							</div>
						</button>
					</div>
				</div>
			</div>

			<!-- Crop Butonu -->
			<button
				@click="$emit('update:isCropMode', !isCropMode)"
				class="px-3 py-1.5 rounded bg-black/80 border border-white/5 transition-all flex items-center space-x-2 hover:border-white/10"
				:class="{ 'bg-purple-600': isCropMode }"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M7 4v16M17 4v16M3 8h18M3 16h18"
					/>
				</svg>
				<span class="text-sm text-white/90">Crop</span>
			</button>
		</div>

		<div class="w-full flex justify-center items-center space-x-4">
			<div class="text-sm text-gray-300">{{ formatTime(displayTime) }}</div>

			<button
				@click="$emit('togglePlayback')"
				class="px-6 py-2 rounded-lg outline-none flex items-center"
				type="button"
			>
				<span v-if="isPlaying">
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
							d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</span>
				<span v-else>
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
							d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</span>
			</button>
			<button
				v-if="false"
				@click="$emit('toggleTrimMode')"
				class="px-4 py-2 rounded-lg flex items-center"
				:class="{ 'bg-purple-600': isTrimMode }"
				type="button"
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
						d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243zm8.486-.486a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"
					/>
				</svg>
			</button>
			<div class="text-sm text-gray-300">{{ formatTime(duration) }}</div>
		</div>

		<div class="flex flex-row space-x-2">
			<!-- Ses Kontrol Butonu -->
			<button
				@click="$emit('toggleMute')"
				class="px-4 py-2 rounded-lg flex items-center"
				type="button"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						v-if="!isMuted"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
					/>
					<path
						v-else
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
					/>
				</svg>
			</button>

			<!-- Segment Bölme Butonu -->
			<button
				@click="$emit('toggleSplitMode')"
				class="px-4 py-2 rounded-lg flex items-center"
				:class="{ 'bg-purple-600': isSplitMode }"
				type="button"
			>
				<svg
					viewBox="0 0 24 24"
					class="h-6 w-6"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						fill-rule="evenodd"
						clip-rule="evenodd"
						d="M21 17.3179L20.0708 18.6981L12.3352 13.4903L9.43172 15.445C9.57619 15.8178 9.65542 16.2232 9.65542 16.647C9.65542 18.4848 8.16555 19.9747 6.32771 19.9747C4.48986 19.9747 2.99999 18.4848 2.99999 16.647C2.99999 14.8092 4.48986 13.3193 6.32771 13.3193C7.13945 13.3193 7.8833 13.6099 8.46089 14.0928L10.8456 12.4874L8.46089 10.8819C7.8833 11.3648 7.13945 11.6554 6.32771 11.6554C4.48986 11.6554 2.99999 10.1656 2.99999 8.32771C2.99999 6.48987 4.48986 5 6.32771 5C8.16555 5 9.65542 6.48987 9.65542 8.32771C9.65542 8.75155 9.57619 9.15688 9.43172 9.52969L12.3352 11.4845L20.0708 6.27657L21 7.65678L13.8249 12.4874L21 17.3179ZM6.32771 9.99157C5.40878 9.99157 4.66385 9.24664 4.66385 8.32771C4.66385 7.40879 5.40878 6.66386 6.32771 6.66386C7.24663 6.66386 7.99156 7.40879 7.99156 8.32771C7.99156 9.24664 7.24663 9.99157 6.32771 9.99157ZM6.32771 18.3109C5.40878 18.3109 4.66385 17.5659 4.66385 16.647C4.66385 15.7281 5.40878 14.9831 6.32771 14.9831C7.24663 14.9831 7.99156 15.7281 7.99156 16.647C7.99156 17.5659 7.24663 18.3109 6.32771 18.3109Z"
						fill="currentColor"
					/>
				</svg>
			</button>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, onUnmounted, nextTick, onMounted } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";

const props = defineProps({
	isPlaying: {
		type: Boolean,
		default: false,
	},
	currentTime: {
		type: Number,
		default: 0,
	},
	previewTime: {
		type: Number,
		default: null,
	},
	duration: {
		type: Number,
		default: 0,
	},
	isTrimMode: {
		type: Boolean,
		default: false,
	},
	isMuted: {
		type: Boolean,
		default: false,
	},
	isSplitMode: {
		type: Boolean,
		default: false,
	},
	isCropMode: {
		type: Boolean,
		default: false,
	},
});

const { cropRatio, updateCropRatio } = usePlayerSettings();

// Refs ve state
const dropdownButton = ref(null);
const dropdownMenu = ref(null);
const isAspectRatioOpen = ref(false);
let resizeObserver = null;

// Dropdown pozisyonunu güncelle
const updateDropdownPosition = () => {
	if (!isAspectRatioOpen.value || !dropdownButton.value) return;

	const buttonRect = dropdownButton.value.getBoundingClientRect();
	const windowHeight = window.innerHeight;
	const windowWidth = window.innerWidth;

	// Dropdown menüsünün tahmini yüksekliği
	const dropdownHeight = aspectRatios.length * 40 + 16;

	// Aşağıda yeterli alan var mı kontrol et
	const spaceBelow = windowHeight - buttonRect.bottom;
	const showBelow = spaceBelow >= dropdownHeight;

	// Sol tarafta yeterli alan var mı kontrol et
	const spaceRight = windowWidth - buttonRect.left;
	const alignLeft = spaceRight >= buttonRect.width;

	if (dropdownMenu.value) {
		dropdownMenu.value.style.position = "fixed";
		dropdownMenu.value.style.top = showBelow
			? `${buttonRect.bottom + 8}px`
			: `${buttonRect.top - dropdownHeight - 8}px`;
		dropdownMenu.value.style.left = alignLeft
			? `${buttonRect.left}px`
			: `${buttonRect.right - buttonRect.width}px`;
		dropdownMenu.value.style.minWidth = `${buttonRect.width}px`;
	}
};

// Toggle dropdown
const toggleDropdown = () => {
	isAspectRatioOpen.value = !isAspectRatioOpen.value;

	if (isAspectRatioOpen.value) {
		// Dropdown açıldığında event listener'ları ekle
		nextTick(() => {
			updateDropdownPosition();
			window.addEventListener("scroll", updateDropdownPosition, true);
			window.addEventListener("resize", updateDropdownPosition);

			// ResizeObserver ile parent elementlerin boyut değişikliklerini izle
			if (!resizeObserver) {
				resizeObserver = new ResizeObserver(updateDropdownPosition);
			}
			let parent = dropdownButton.value?.parentElement;
			while (parent) {
				resizeObserver.observe(parent);
				parent = parent.parentElement;
			}
		});
	} else {
		// Dropdown kapandığında event listener'ları kaldır
		window.removeEventListener("scroll", updateDropdownPosition, true);
		window.removeEventListener("resize", updateDropdownPosition);
		if (resizeObserver) {
			resizeObserver.disconnect();
		}
	}
};

// Component unmount olduğunda cleanup
onUnmounted(() => {
	window.removeEventListener("scroll", updateDropdownPosition, true);
	window.removeEventListener("resize", updateDropdownPosition);
	if (resizeObserver) {
		resizeObserver.disconnect();
		resizeObserver = null;
	}
});

// Aspect ratio seçenekleri
const aspectRatios = [
	{ value: "", label: "Auto", iconClass: "icon-auto", preview: "16/9" },
	{
		value: "16:9",
		label: "Wide 16:9",
		iconClass: "icon-wide",
		preview: "16/9",
	},
	{
		value: "9:16",
		label: "Vertical 9:16",
		iconClass: "icon-vertical",
		preview: "9/16",
	},
	{
		value: "1:1",
		label: "Square 1:1",
		iconClass: "icon-square",
		preview: "1/1",
	},
	{
		value: "4:3",
		label: "Classic 4:3",
		iconClass: "icon-classic",
		preview: "4/3",
	},
	{ value: "3:4", label: "Tall 3:4", iconClass: "icon-tall", preview: "3/4" },
];

// Mevcut seçili ratio'yu bul
const getCurrentRatio = computed(() => {
	return (
		aspectRatios.find((ratio) => ratio.value === cropRatio.value) ||
		aspectRatios[0]
	);
});

// Aspect ratio seçimi
const selectAspectRatio = (ratio) => {
	updateCropRatio(ratio);
	isAspectRatioOpen.value = false;
};

const emit = defineEmits([
	"togglePlayback",
	"toggle-playback",
	"toggle-trim-mode",
	"toggle-mute",
	"toggle-split-mode",
	"update:isCropMode",
]);

// Space tuşu için event handler
const handleKeyPress = (event) => {
	if (event.code === "Space" && !event.repeat) {
		event.preventDefault();
		emit("toggle-playback");
	}
};

// Component mount olduğunda
onMounted(() => {
	window.addEventListener("keydown", handleKeyPress);
});

const formatTime = (seconds) => {
	if (!seconds || isNaN(seconds)) return "00:00:00";

	const minutes = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	const centiseconds = Math.floor((seconds % 1) * 100);

	return `${minutes.toString().padStart(2, "0")}:${secs
		.toString()
		.padStart(2, "0")}:${centiseconds.toString().padStart(2, "0")}`;
};

// Gösterilecek zamanı hesapla
const displayTime = computed(() => {
	return props.previewTime !== null ? props.previewTime : props.currentTime;
});
</script>

<style scoped>
.aspect-ratio-button {
	cursor: pointer;
	user-select: none;
}

button {
	transition: all 0.2s ease;
}

button:active {
	transform: scale(0.95);
}

.aspect-icon {
	width: 12px;
	height: 12px;
	border: 1.5px solid currentColor;
	border-radius: 1px;
}

.icon-auto {
	width: 14px;
	height: 10px;
}

.icon-wide {
	width: 14px;
	height: 8px;
}

.icon-vertical {
	width: 8px;
	height: 14px;
}

.icon-square {
	width: 11px;
	height: 11px;
}

.icon-classic {
	width: 12px;
	height: 9px;
}

.icon-tall {
	width: 9px;
	height: 12px;
}
</style>
