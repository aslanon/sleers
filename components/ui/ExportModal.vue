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
						<option value="720p">720p HD (1280×720)</option>
						<option value="1080p">1080p Full HD (1920×1080)</option>
						<option value="480p">480p SD (854×480)</option>
					</select>
					<p class="text-gray-400 text-xs mt-1">{{ resolutionDescription }}</p>
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
						Quality & Summary
					</h3>
				</div>

				<!-- Quality Selection -->
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-3">
						Quality Settings
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
import { ref, computed, watch } from "vue";
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
const error = ref("");

// Form data
const format = ref("mp4");
const resolution = ref("720p");
const quality = ref("high");
const filename = ref("");
const directory = ref("");

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

// Quality options
const qualityOptions = [
	{
		value: "high",
		label: "High Quality",
		description: "Premium quality, 60fps, 8 Mbps",
		fileSize: "~60MB/min",
	},
	{
		value: "medium",
		label: "Medium Quality",
		description: "Great quality, 60fps, 5 Mbps",
		fileSize: "~38MB/min",
	},
	{
		value: "low",
		label: "Low Quality",
		description: "Good quality, 30fps, 2.5 Mbps",
		fileSize: "~19MB/min",
	},
];

// Computed properties
const formatDescription = computed(() => {
	if (format.value === "mp4") {
		return "High-quality video with audio, perfect for tutorials and presentations";
	} else {
		return "Animated GIF format, ideal for short clips and quick previews (no audio)";
	}
});

const resolutionDescription = computed(() => {
	const resMap = {
		"480p": "854×480px",
		"720p": "1280×720px",
		"1080p": "1920×1080px",
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
	};

	emit("export", settings);
	handleClose();
};

const handleClose = () => {
	isModalOpen.value = false;
	emit("close");
};
</script>
