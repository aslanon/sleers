<template>
	<BaseModal
		v-model="isModalOpen"
		title="Export Video"
		subtitle="Configure your export settings for the perfect video output"
		size="2xl"
		@close="handleClose"
	>
		<!-- Main Content Grid -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
			<!-- Left Column: File Settings -->
			<div class="space-y-6">
				<div>
					<h3
						class="text-lg font-medium text-white mb-4 flex items-center gap-2"
					>
						<svg
							class="w-5 h-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
							/>
						</svg>
						File Settings
					</h3>
				</div>

				<!-- Filename Input -->
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-2">
						Filename
					</label>
					<input
						v-model="filename"
						type="text"
						class="w-full bg-zinc-800/60 border border-zinc-600/60 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
						placeholder="Enter filename"
						:class="{
							'border-red-500 focus:border-red-500 focus:ring-red-500/20':
								filenameError,
						}"
					/>
					<p v-if="filenameError" class="text-red-400 text-xs mt-1">
						{{ filenameError }}
					</p>
					<p v-else class="text-gray-400 text-xs mt-1">
						Name of the exported file (without extension)
					</p>
				</div>

				<!-- Directory Selection -->
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-2">
						Save Location
					</label>
					<div class="flex gap-2">
						<input
							v-model="directory"
							type="text"
							readonly
							class="flex-1 bg-zinc-800/40 border border-zinc-600/60 rounded-lg px-4 py-3 text-gray-300 cursor-not-allowed text-sm"
							placeholder="Select a directory"
						/>
						<button
							@click="selectDirectory"
							:disabled="isSelectingDirectory"
							class="px-4 py-3 rounded-lg bg-zinc-700/60 hover:bg-zinc-600/80 disabled:bg-zinc-800/40 disabled:text-gray-500 text-white font-medium transition-all duration-200 flex items-center gap-2 min-w-[100px]"
						>
							<svg
								v-if="!isSelectingDirectory"
								class="w-4 h-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
								/>
							</svg>
							<div
								v-else
								class="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"
							></div>
							{{ isSelectingDirectory ? "Selecting..." : "Browse" }}
						</button>
					</div>
					<p class="text-gray-400 text-xs mt-1">
						Directory where the file will be saved
					</p>
				</div>
			</div>

			<!-- Middle Column: Format & Quality -->
			<div class="space-y-6">
				<div>
					<h3
						class="text-lg font-medium text-white mb-4 flex items-center gap-2"
					>
						<svg
							class="w-5 h-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						Export Settings
					</h3>
				</div>

				<!-- Format Selection -->
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-3">
						Output Format
					</label>
					<div class="grid grid-cols-1 gap-3">
						<button
							@click="format = 'mp4'"
							class="p-4 rounded-lg border-2 transition-all duration-200 group"
							:class="
								format === 'mp4'
									? 'bg-blue-600/20 border-blue-500 text-blue-300'
									: 'bg-zinc-800/40 border-zinc-600/60 hover:border-zinc-500/80 text-gray-300 hover:text-white'
							"
						>
							<div class="flex items-center gap-3">
								<svg
									class="w-8 h-8"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="1.5"
										d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
									/>
								</svg>
								<div class="text-left">
									<div class="text-sm font-medium">MP4</div>
									<div class="text-xs opacity-70">High quality with audio</div>
								</div>
							</div>
						</button>
						<button
							@click="format = 'gif'"
							class="p-4 rounded-lg border-2 transition-all duration-200 group"
							:class="
								format === 'gif'
									? 'bg-blue-600/20 border-blue-500 text-blue-300'
									: 'bg-zinc-800/40 border-zinc-600/60 hover:border-zinc-500/80 text-gray-300 hover:text-white'
							"
						>
							<div class="flex items-center gap-3">
								<svg
									class="w-8 h-8"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="1.5"
										d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
									/>
								</svg>
								<div class="text-left">
									<div class="text-sm font-medium">GIF</div>
									<div class="text-xs opacity-70">Animated, no audio</div>
								</div>
							</div>
						</button>
					</div>
					<p class="text-gray-400 text-xs mt-2">{{ formatDescription }}</p>
				</div>

				<!-- Resolution Selection -->
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-2">
						Resolution
					</label>
					<select
						v-model="resolution"
						class="w-full bg-zinc-800/60 border border-zinc-600/60 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
					>
						<option value="small">Small - Canvas scaled down (50%)</option>
						<option value="medium">Medium - Canvas scaled (75%)</option>
						<option value="large">Large - Original canvas size</option>
						<option value="1080p">HD - Max 1920×1080 (aspect preserved)</option>
						<option value="4k">4K - Max 3840×2160 (aspect preserved)</option>
					</select>
					<p class="text-gray-400 text-xs mt-1">{{ resolutionDescription }}</p>
					<p v-if="resolution === '4k'" class="text-yellow-400 text-xs mt-1">
						⚠️ 4K export may take longer and require more memory
					</p>
				</div>
			</div>

			<!-- Right Column: Quality & Preview -->
			<div class="space-y-6">
				<div>
					<h3
						class="text-lg font-medium text-white mb-4 flex items-center gap-2"
					>
						<svg
							class="w-5 h-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 10V3L4 14h7v7l9-11h-7z"
							/>
						</svg>
						Video Quality & Summary
					</h3>
				</div>

				<!-- Quality Selection -->
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-3">
						Video Bitrate
					</label>
					<div class="space-y-3">
						<div
							v-for="qualityOption in qualityOptions"
							:key="qualityOption.value"
							@click="quality = qualityOption.value"
							class="p-3 rounded-lg border transition-all duration-200 cursor-pointer"
							:class="
								quality === qualityOption.value
									? 'bg-blue-600/20 border-blue-500 text-blue-300'
									: 'bg-zinc-800/40 border-zinc-600/60 hover:border-zinc-500/80 text-gray-300 hover:text-white'
							"
						>
							<div class="flex items-center justify-between">
								<div>
									<div class="font-medium text-sm">
										{{ qualityOption.label }}
									</div>
									<div class="text-xs opacity-70">
										{{ qualityOption.description }}
									</div>
								</div>
								<div class="flex items-center gap-2">
									<div class="text-xs text-gray-400">
										{{ qualityOption.fileSize }}
									</div>
									<div
										class="w-2 h-2 rounded-full"
										:class="
											quality === qualityOption.value
												? 'bg-blue-500'
												: 'bg-zinc-600'
										"
									></div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Advanced Settings -->
				<div>
					<div class="flex items-center justify-between mb-3">
						<label class="block text-sm font-medium text-gray-300">
							Advanced Settings
						</label>
						<button
							@click="showAdvanced = !showAdvanced"
							class="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
						>
							<span>{{ showAdvanced ? 'Hide' : 'Show' }}</span>
							<svg
								class="w-3 h-3 transition-transform duration-200"
								:class="{ 'rotate-180': showAdvanced }"
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
					</div>
					
					<div v-show="showAdvanced" class="space-y-4 mb-6">
						<!-- FPS Settings -->
						<div>
							<label class="block text-xs font-medium text-gray-400 mb-2">
								Frame Rate (FPS)
							</label>
							<select
								v-model="fps"
								class="w-full bg-zinc-800/60 border border-zinc-600/60 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all duration-200"
							>
								<option value="15">15 FPS (GIF optimized)</option>
								<option value="24">24 FPS (Cinematic)</option>
								<option value="30">30 FPS (Standard)</option>
								<option value="60">60 FPS (Smooth)</option>
							</select>
							<p class="text-gray-500 text-xs mt-1">Higher FPS = smoother motion, larger file</p>
						</div>

						<!-- Encoding Speed -->
						<div>
							<label class="block text-xs font-medium text-gray-400 mb-2">
								Export Speed Priority
							</label>
							<div class="space-y-2">
								<div
									v-for="speedOption in speedOptions"
									:key="speedOption.value"
									@click="encodingSpeed = speedOption.value"
									class="p-2 rounded-md border text-xs cursor-pointer transition-all duration-200"
									:class="
										encodingSpeed === speedOption.value
											? 'bg-blue-600/20 border-blue-500 text-blue-300'
											: 'bg-zinc-800/40 border-zinc-600/60 hover:border-zinc-500/80 text-gray-300'
									"
								>
									<div class="flex items-center justify-between">
										<span class="font-medium">{{ speedOption.label }}</span>
										<div
											class="w-1.5 h-1.5 rounded-full"
											:class="
												encodingSpeed === speedOption.value
													? 'bg-blue-500'
													: 'bg-zinc-600'
											"
										></div>
									</div>
									<div class="text-xs opacity-70 mt-1">{{ speedOption.description }}</div>
								</div>
							</div>
						</div>

						<!-- Hardware Acceleration -->
						<div>
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium text-gray-400">GPU Acceleration</span>
								<div
									class="relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer"
									:class="useHardwareAccel ? 'bg-blue-600' : 'bg-zinc-600'"
									@click="useHardwareAccel = !useHardwareAccel"
								>
									<div
										class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 pointer-events-none"
										:class="{ 'translate-x-5': useHardwareAccel }"
									></div>
								</div>
							</div>
							<p class="text-gray-500 text-xs mt-1">
								{{ useHardwareAccel ? 'Using VideoToolbox (faster)' : 'Using software encoding (slower)' }}
							</p>
						</div>

						<!-- Audio Quality (sadece MP4 için) -->
						<div v-if="format === 'mp4'">
							<label class="block text-xs font-medium text-gray-400 mb-2">
								Audio Quality
							</label>
							<select
								v-model="audioQuality"
								class="w-full bg-zinc-800/60 border border-zinc-600/60 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all duration-200"
							>
								<option value="96">96 kbps (Small file)</option>
								<option value="128">128 kbps (Good quality)</option>
								<option value="192">192 kbps (High quality)</option>
								<option value="256">256 kbps (Premium)</option>
							</select>
						</div>
					</div>
				</div>

				<!-- Export Preview -->
				<div class="p-4 bg-zinc-800/40 rounded-lg border border-zinc-600/60">
					<div class="flex items-center gap-2 mb-3">
						<svg
							class="w-4 h-4 text-gray-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span class="text-sm font-medium text-gray-300"
							>Export Summary</span
						>
					</div>
					<div class="space-y-2 text-sm">
						<div class="flex justify-between">
							<span class="text-gray-400">File:</span>
							<span class="text-white font-mono text-xs"
								>{{ filename || "unnamed" }}.{{ format }}</span
							>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-400">Format:</span>
							<span class="text-white">{{ format.toUpperCase() }}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-400">Resolution:</span>
							<span class="text-white">{{ resolutionDescription }}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-400">Bitrate:</span>
							<span class="text-white">{{
								quality.charAt(0).toUpperCase() + quality.slice(1)
							}}</span>
						</div>
						<div v-if="showAdvanced" class="border-t border-zinc-600/40 pt-2 mt-3">
							<div class="flex justify-between">
								<span class="text-gray-400">Frame Rate:</span>
								<span class="text-white">{{ fps }} FPS</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-400">Speed:</span>
								<span class="text-white">{{ currentSpeedOption?.label || 'Balanced' }}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-400">GPU Accel:</span>
								<span class="text-white">{{ useHardwareAccel ? 'Enabled' : 'Disabled' }}</span>
							</div>
							<div v-if="format === 'mp4'" class="flex justify-between">
								<span class="text-gray-400">Audio Quality:</span>
								<span class="text-white">{{ audioQuality }} kbps</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Error state -->
		<div
			v-if="error"
			class="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg"
		>
			<div class="flex items-center gap-2">
				<svg
					class="w-4 h-4 text-red-400"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<p class="text-red-400 text-sm">{{ error }}</p>
			</div>
		</div>

		<!-- Export Progress Overlay -->
		<div
			v-if="isExporting"
			class="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 rounded-2xl"
		>
			<div
				class="bg-zinc-800 p-8 rounded-xl shadow-3xl text-white max-w-md w-full mx-4"
			>
				<div class="text-center mb-6">
					<h3 class="text-xl font-bold mb-2">Exporting Video</h3>
					<p class="text-gray-300">
						Please wait while your video is being processed...
					</p>
				</div>

				<!-- Progress Bar -->
				<div class="w-full bg-zinc-700 rounded-full h-3 mb-3">
					<div
						class="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
						:style="`width: ${exportProgress}%`"
					></div>
				</div>
				<p class="text-center text-sm text-gray-400 mb-6">
					{{ exportProgress }}%
				</p>

				<!-- Cancel Button -->
				<div class="flex justify-center">
					<button
						@click="cancelExport"
						class="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all duration-200 flex items-center gap-2"
					>
						<svg
							class="w-4 h-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
						Cancel Export
					</button>
				</div>
			</div>
		</div>

		<!-- Export Error Overlay -->
		<div
			v-if="exportError"
			class="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 rounded-2xl"
		>
			<div
				class="bg-zinc-800 p-8 rounded-xl shadow-3xl text-white max-w-md w-full mx-4"
			>
				<div class="text-center mb-6">
					<div
						class="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4"
					>
						<svg
							class="w-8 h-8 text-white"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<h3 class="text-xl font-bold mb-2 text-red-400">Export Failed</h3>
					<p class="text-gray-300 max-h-[200px] overflow-y-auto mb-4">
						{{ exportError }}
					</p>
				</div>

				<!-- Close Button -->
				<div class="flex justify-center">
					<button
						@click="clearError"
						class="px-6 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white font-medium transition-all duration-200"
					>
						Close
					</button>
				</div>
			</div>
		</div>

		<template #footer>
			<button
				@click="handleClose"
				class="px-4 py-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/80 text-gray-300 hover:text-white transition-all duration-200"
			>
				Cancel
			</button>
			<button
				@click="exportVideo"
				:disabled="!isFormValid || isExporting"
				class="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-gray-500 text-white font-medium transition-all duration-200 shadow-lg shadow-blue-600/25 flex items-center gap-2"
			>
				<div
					v-if="isExporting"
					class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
				></div>
				<svg
					v-else
					class="w-4 h-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
				{{ isExporting ? "Exporting..." : "Export Video" }}
			</button>
		</template>
	</BaseModal>
</template>

<script setup>
import { ref, computed, watch, nextTick } from "vue";
import BaseModal from "./BaseModal.vue";

const props = defineProps({
	isOpen: {
		type: Boolean,
		default: false,
	},
});

const emit = defineEmits(["close", "export"]);

// Refs
const isModalOpen = ref(false);
const isSelectingDirectory = ref(false);
const isExporting = ref(false);
const exportProgress = ref(0);
const exportError = ref("");
const error = ref("");

// Form data
const format = ref("mp4");
const resolution = ref("medium");
const quality = ref("high");
const filename = ref("");
const directory = ref("");

// Advanced settings
const showAdvanced = ref(false);
const fps = ref("30");
const encodingSpeed = ref("balanced");
const useHardwareAccel = ref(true);
const audioQuality = ref("128");

// Watch props
watch(
	() => props.isOpen,
	(newVal) => {
		isModalOpen.value = newVal;
		if (newVal) {
			resetForm();
		}
	}
);

// Quality options - FPS removed (now in advanced)
const qualityOptions = [
	{
		value: "high",
		label: "High Quality",
		description: "Premium bitrate (8 Mbps)",
		fileSize: "~60MB/min",
	},
	{
		value: "medium",
		label: "Medium Quality", 
		description: "Great bitrate (5 Mbps)",
		fileSize: "~38MB/min",
	},
	{
		value: "low",
		label: "Low Quality",
		description: "Good bitrate (2.5 Mbps)",
		fileSize: "~19MB/min",
	},
];

// Speed options
const speedOptions = [
	{
		value: "ultrafast",
		label: "Ultra Fast",
		description: "Fastest export, slightly lower quality"
	},
	{
		value: "fast",
		label: "Fast",
		description: "Quick export with good quality"
	},
	{
		value: "balanced",
		label: "Balanced",
		description: "Good balance of speed and quality"
	},
	{
		value: "quality",
		label: "Quality First",
		description: "Slower export, highest quality"
	}
];

// Computed properties
const formatDescription = computed(() => {
	if (format.value === "mp4") {
		return "High-quality video with audio, perfect for tutorials and presentations";
	} else {
		return "Animated GIF format, ideal for short clips and quick previews (no audio)";
	}
});

const currentSpeedOption = computed(() => {
	return speedOptions.find(option => option.value === encodingSpeed.value);
});

const resolutionDescription = computed(() => {
	const resMap = {
		"small": "50% of canvas size (faster export)",
		"medium": "75% of canvas size (balanced)",
		"large": "Original canvas size (best quality)",
		"1080p": "HD quality, max 1920×1080, aspect preserved",
		"4k": "Ultra HD, max 3840×2160, aspect preserved",
	};
	return resMap[resolution.value] || "";
});

const filenameError = computed(() => {
	if (!filename.value.trim()) {
		return "Filename is required";
	}
	if (!/^[a-zA-Z0-9_-]+$/.test(filename.value.trim())) {
		return "Only letters, numbers, hyphens and underscores allowed";
	}
	return "";
});

const isFormValid = computed(() => {
	return !filenameError.value && directory.value.trim() && !isExporting.value;
});

// Methods
const generateDefaultFilename = () => {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	const seconds = String(now.getSeconds()).padStart(2, "0");

	return `creavit-studio-${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
};

const resetForm = () => {
	filename.value = generateDefaultFilename();
	error.value = "";
	exportError.value = "";
	exportProgress.value = 0;
	setDefaultDirectory();
};

const setDefaultDirectory = async () => {
	try {
		if (!window.electron?.ipcRenderer) {
			console.error("Electron API not found");
			return;
		}

		// Try downloads folder first
		try {
			const downloadsDir = await window.electron.ipcRenderer.invoke(
				"GET_PATH",
				"downloads"
			);
			if (downloadsDir) {
				directory.value = downloadsDir;
				return;
			}
		} catch (error) {
			console.warn("Could not get downloads directory:", error);
		}

		// Fallback to home directory
		try {
			const homeDir = await window.electron.ipcRenderer.invoke("GET_HOME_DIR");
			if (homeDir) {
				directory.value = homeDir;
			}
		} catch (error) {
			console.warn("Could not get home directory:", error);
		}
	} catch (error) {
		console.error("Error setting default directory:", error);
	}
};

const selectDirectory = async () => {
	if (isSelectingDirectory.value) return;

	try {
		isSelectingDirectory.value = true;
		error.value = "";

		if (!window.electron?.ipcRenderer) {
			throw new Error("Electron API not available");
		}

		const result = await window.electron.ipcRenderer.invoke(
			"SHOW_DIRECTORY_DIALOG",
			{
				title: "Select Save Folder",
				buttonLabel: "Select",
				defaultPath: directory.value || undefined,
			}
		);

		if (result && !result.canceled && result.filePaths?.length > 0) {
			directory.value = result.filePaths[0];
		}
	} catch (err) {
		error.value = "Failed to select directory: " + err.message;
		console.error("Directory selection error:", err);
	} finally {
		isSelectingDirectory.value = false;
	}
};

const exportVideo = () => {
	if (!isFormValid.value) return;

	const settings = {
		format: format.value,
		resolution: resolution.value,
		quality: quality.value,
		filename: filename.value.trim(),
		directory: directory.value,
		
		// Advanced settings
		fps: parseInt(fps.value),
		encodingSpeed: encodingSpeed.value,
		useHardwareAccel: useHardwareAccel.value,
		audioQuality: parseInt(audioQuality.value),
	};

	// Export başlat
	isExporting.value = true;
	exportProgress.value = 0;
	exportError.value = "";

	emit("export", settings);
	// Modal'ı kapatma - progress overlay gösterilecek
};

const cancelExport = () => {
	// Export iptal flag'ini set et
	window.exportCancelled = true;
	isExporting.value = false;
	exportProgress.value = 0;
	console.log("[ExportModal] Export cancelled by user");
};

const clearError = () => {
	exportError.value = "";
	isExporting.value = false;
	exportProgress.value = 0;
};

const updateProgress = (progress) => {
	const newProgress = Math.round(progress);
	console.log("[ExportModal] Progress update:", newProgress + "%");
	
	// Vue reactivity için nextTick kullan
	nextTick(() => {
		exportProgress.value = newProgress;
	});
};

const showError = (errorMessage) => {
	exportError.value = errorMessage;
	isExporting.value = false;
};

const completeExport = () => {
	isExporting.value = false;
	exportProgress.value = 100;
	// Modal'ı kapat
	setTimeout(() => {
		handleClose();
	}, 1000);
};

const handleClose = () => {
	// Export devam ediyorsa iptal et
	if (isExporting.value) {
		cancelExport();
	}
	isModalOpen.value = false;
	emit("close");
};

// Methods'ları expose et - parent component'ten erişilebilsin
defineExpose({
	updateProgress,
	showError,
	completeExport,
});
</script>
