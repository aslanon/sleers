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
					class="aspect-ratio-button px-3 py-1.5 w-[200px] rounded bg-black/80 border border-white/5 transition-all flex items-center justify-between space-x-2 hover:border-white/10"
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
					<div class="max-h-[320px] w-[200px] overflow-y-auto" @mousedown.stop>
						<!-- Custom Resolution Inputs -->
						<div
							v-if="showCustomInputs"
							class="px-3 py-2 border-t border-white/10"
						>
							<div class="grid grid-cols-2 gap-2 mb-2">
								<div>
									<label class="block text-xs font-medium text-gray-400 mb-1">
										Width (px)
									</label>
									<input
										v-model="customWidth"
										type="number"
										min="100"
										max="7680"
										class="w-full bg-zinc-800/60 border border-zinc-600/60 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
										placeholder="1920"
									/>
								</div>
								<div>
									<label class="block text-xs font-medium text-gray-400 mb-1">
										Height (px)
									</label>
									<input
										v-model="customHeight"
										type="number"
										min="100"
										max="4320"
										class="w-full bg-zinc-800/60 border border-zinc-600/60 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
										placeholder="1080"
									/>
								</div>
							</div>
							<button
								@click="applyCustomResolution"
								class="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-all duration-200 flex items-center justify-center gap-1"
							>
								<svg
									class="w-3 h-3"
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
								Apply Resolution
							</button>
						</div>
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
			<div class="text-sm text-gray-300 text-right min-w-[100px]">
				{{ formatTime(displayTime) }}
			</div>

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
			<div class="text-sm text-gray-300 text-left min-w-[100px]">
				{{ formatTime(duration) }}
			</div>
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

			<!-- Screenshot Butonu -->
			<button
				@click="captureScreenshot"
				class="px-4 py-2 rounded-lg flex items-center hover:bg-white/5 transition-colors"
				type="button"
				title="Ekran görüntüsü al"
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
						d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
			</button>

			<!-- Segment Split Butonu -->
			<button
				@click="$emit('splitCurrentSegment')"
				class="px-4 py-2 rounded-lg flex items-center hover:bg-white/5 transition-colors"
				type="button"
				title="Mevcut segmenti böl"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						d="M7.84786 8.25007L9.38443 9.13721M7.84786 8.25007C7.01943 9.68494 5.18501 10.1765 3.75013 9.34809C2.31526 8.51966 1.82363 6.68489 2.65206 5.25001C3.48049 3.81513 5.31526 3.32351 6.75013 4.15194C8.18501 4.98036 8.67629 6.81519 7.84786 8.25007ZM9.38443 9.13721C10.043 9.51742 10.4538 10.2153 10.4666 10.9756C10.4725 11.3272 10.5207 11.6706 10.607 12.0001M9.38443 9.13721L11.4608 10.336M7.84786 15.7501L9.38443 14.863M7.84786 15.7501C8.67629 17.185 8.18501 19.0197 6.75013 19.8481C5.31526 20.6765 3.48049 20.1849 2.65206 18.75C1.82363 17.3151 2.31526 15.4804 3.75013 14.6519C5.18501 13.8235 7.01943 14.3153 7.84786 15.7501ZM9.38443 14.863C10.043 14.4828 10.4538 13.7849 10.4666 13.0246C10.4725 12.673 10.5207 12.3296 10.607 12.0001M9.38443 14.863L11.4608 13.6642M11.4608 10.336C11.9882 9.699 12.6991 9.21096 13.5294 8.95702L18.8541 7.32855C19.6606 7.08189 20.5202 7.06684 21.3348 7.28513L22.1373 7.50014L14.3431 12.0001M11.4608 10.336C11.062 10.8178 10.7681 11.3848 10.607 12.0001M14.3431 12.0001L22.1373 16.5001L21.3348 16.7151C20.5202 16.9334 19.6606 16.9183 18.8541 16.6717L13.5294 15.0432C12.6991 14.7892 11.9882 14.3012 11.4608 13.6642M14.3431 12.0001L11.4608 13.6642"
						stroke="#ffffff"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
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
		default: 0,
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

// Custom resolution data
const customWidth = ref("1920");
const customHeight = ref("1080");
const showCustomInputs = ref(false);

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
	{
		value: "custom",
		label: "Custom",
		iconClass: "icon-custom",
		preview: "Custom",
	},
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
	// Custom seçiliyse ve inputlar görünüyorsa
	if (showCustomInputs.value) {
		return {
			label: `Custom (${customWidth.value}×${customHeight.value})`,
			value: "custom",
		};
	}

	return (
		aspectRatios.find((ratio) => ratio.value === cropRatio.value) ||
		aspectRatios[0]
	);
});

// Aspect ratio seçimi
const selectAspectRatio = (ratio) => {
	// Custom seçildiğinde sadece dropdown'ı açık tut, hiçbir değer gönderme
	if (ratio === "custom") {
		// Custom inputları göster, hiçbir değer gönderme
		showCustomInputs.value = true;
		return;
	}

	// Normal aspect ratio seçimleri için
	showCustomInputs.value = false;
	updateCropRatio(ratio);
	isAspectRatioOpen.value = false;
};

// Apply custom resolution
const applyCustomResolution = () => {
	const width = parseInt(customWidth.value);
	const height = parseInt(customHeight.value);

	if (!width || !height || width < 100 || height < 100) {
		console.error("Please enter valid width and height values (minimum 100px)");
		return;
	}

	if (width > 7680 || height > 4320) {
		console.error("Resolution too high. Maximum supported: 7680×4320");
		return;
	}

	console.log(`Applied custom resolution: ${width}×${height}`);

	// Emit custom resolution change event
	emit("customResolutionChange", { width, height });

	// Apply butonuna basıldıktan sonra dropdown'ı kapat ama custom label'ı koru
	isAspectRatioOpen.value = false;
	// showCustomInputs'i false yapma, label'ın custom olarak kalması için
};

const emit = defineEmits([
	"togglePlayback",
	"timeUpdate",
	"previewTimeUpdate",
	"toggleMute",
	"toggleSplitMode",
	"toggleTrimMode",
	"update:isCropMode",
	"captureScreenshot",
	"splitCurrentSegment",
	"customResolutionChange",
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

// Screenshot alma fonksiyonu
const captureScreenshot = () => {
	emit("captureScreenshot");
};
</script>

<style scoped>
.aspect-ratio-button {
	cursor: pointer;
	user-select: none;
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

.icon-custom {
	width: 12px;
	height: 12px;
	border-style: dashed;
}
</style>
