<template>
	<BaseModal
		v-model="isModalOpen"
		title="Export Video"
		subtitle="Configure your export settings for the perfect video output"
		size="2xl"
		@close="handleClose"
	>
		<!-- Main Content Grid -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
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

				<!-- Format Selection -->
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-3">
						Output Format
					</label>
					<div class="flex justify-center">
						<button
							@click="format = 'webm'"
							class="p-6 rounded-lg border-2 transition-all duration-200 bg-blue-600/20 border-blue-500 text-blue-300 cursor-default"
						>
							<div class="text-center">
								<svg
									class="w-10 h-10 mx-auto mb-3"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="1.5"
										d="M13 10V3L4 14h7v7l9-11h-7z"
									/>
								</svg>
								<div class="text-lg font-medium">WebM</div>
								<div class="text-sm opacity-70">Ultra fast export with audio</div>
							</div>
						</button>
					</div>
					<p class="text-gray-400 text-xs mt-2 text-center">Modern web video format - instant export, perfect quality, includes audio</p>
				</div>
			</div>

			<!-- Right Column: Export Settings -->
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

				<!-- Resolution Selection -->
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-2">
						Resolution
					</label>
					<select
						v-model="resolution"
						class="w-full bg-zinc-800/60 border border-zinc-600/60 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
					>
						<option value="medium">Medium - Canvas scaled (75%)</option>
						<option value="large">Large - Original canvas size</option>
						<option value="1080p">HD - Max 1920×1080 (best quality)</option>
					</select>
					<p class="text-gray-400 text-xs mt-1">{{ resolutionDescription }}</p>
				</div>

				<!-- Quality Selection -->
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-3">
						Video Quality
					</label>
					<div class="space-y-3">
						<div
							v-for="qualityOption in simplifiedQualityOptions"
							:key="qualityOption.value"
							@click="quality = qualityOption.value"
							class="p-4 rounded-lg border transition-all duration-200 cursor-pointer"
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
							<span class="text-gray-400">Quality:</span>
							<span class="text-white">{{
								quality.charAt(0).toUpperCase() + quality.slice(1)
							}}</span>
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

// Form data - sadece WebM
const format = ref("webm");
const resolution = ref("medium");
const quality = ref("high");
const filename = ref("");
const directory = ref("");

// Optimized default settings for best performance
const fps = ref("30");
const encodingSpeed = ref("fast");
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

// Simplified quality options - only 3 most important
const simplifiedQualityOptions = [
	{
		value: "high",
		label: "Best Quality",
		description: "Premium bitrate (8 Mbps) - Highest quality",
		fileSize: "~60MB/min",
	},
	{
		value: "medium",
		label: "Balanced", 
		description: "Great bitrate (5 Mbps) - Good speed & quality",
		fileSize: "~38MB/min",
	},
	{
		value: "low",
		label: "Fast Export",
		description: "Good bitrate (2.5 Mbps) - Fastest export",
		fileSize: "~19MB/min",
	},
];

// Computed properties
const formatDescription = computed(() => {
	return "Modern web video format - instant export, perfect quality, includes audio";
});

const resolutionDescription = computed(() => {
	const resMap = {
		"medium": "75% of canvas size (balanced)",
		"large": "Original canvas size (best quality)",
		"1080p": "HD quality, max 1920×1080 (best quality)",
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
	
	// Throttle progress updates to avoid UI lag
	if (newProgress !== exportProgress.value) {
		console.log("[ExportModal] Progress update:", newProgress + "%");
		
		// Vue reactivity için nextTick kullan
		nextTick(() => {
			exportProgress.value = newProgress;
		});
	}
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
