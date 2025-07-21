<template>
	<div
		v-if="isOpen"
		class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
	>
		<div class="bg-[#121212] rounded-lg w-full max-w-md p-6 text-white">
			<div class="flex justify-between items-center mb-2">
				<h2 class="text-xl font-semibold">Export Video</h2>
				<button @click="close" class="text-white hover:text-gray-300">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
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
			</div>

			<p class="text-gray-400 text-sm mb-6">
				Choose your export settings. Higher quality will take longer to process.
			</p>

			<!-- Filename Input -->
			<div class="mb-4">
				<label class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium">Filename</span>
				</label>
				<input
					v-model="filename"
					type="text"
					class="w-full bg-[#1A1A1A] border border-[#333] rounded-md px-3 py-2 text-white focus:outline-none focus:border-[#432af4]"
					placeholder="Enter filename"
				/>
				<p class="text-gray-400 text-xs mt-1">
					Name of the exported file (without extension)
				</p>
			</div>

			<!-- Directory Selection -->
			<div class="mb-4">
				<label class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium">Save Location</span>
				</label>
				<div class="flex gap-2">
					<input
						v-model="directory"
						type="text"
						disabled
						class="w-full bg-[#1A1A1A] border border-[#333] rounded-md px-3 py-2 text-white focus:outline-none"
						placeholder="Select a directory"
					/>
					<button
						@click="selectDirectory"
						class="px-3 py-2 rounded-md text-white bg-[#2A2A2A] hover:bg-[#333] transition"
					>
						Browse
					</button>
				</div>
				<p class="text-gray-400 text-xs mt-1">
					Directory where the file will be saved
				</p>
			</div>

			<!-- Format Selection -->
			<div class="mb-4">
				<div class="flex items-center justify-between mb-2">
					<label class="text-sm font-medium">Format</label>
				</div>
				<div class="grid grid-cols-2 gap-2">
					<button
						class="flex items-center justify-center px-4 py-2 rounded-md transition"
						:class="
							format === 'mp4'
								? 'bg-[#2A2A2A] border border-[#432af4]'
								: 'bg-[#1A1A1A] hover:bg-[#282828]'
						"
						@click="format = 'mp4'"
					>
						<span class="mr-2">
							<svg
								width="20"
								height="20"
								viewBox="0 0 20 20"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M15 8.5V5.5C15 4.94772 14.5523 4.5 14 4.5H4C3.44772 4.5 3 4.94772 3 5.5V14.5C3 15.0523 3.44772 15.5 4 15.5H14C14.5523 15.5 15 15.0523 15 14.5V11.5M16.5 10H8.5M16.5 10L13.5 7M16.5 10L13.5 13"
									stroke="white"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</span>
						MP4
					</button>
					<button
						class="flex items-center justify-center px-4 py-2 rounded-md transition"
						:class="
							format === 'gif'
								? 'bg-[#2A2A2A] border border-[#432af4]'
								: 'bg-[#1A1A1A] hover:bg-[#282828]'
						"
						@click="format = 'gif'"
					>
						<span class="mr-2">
							<svg
								width="20"
								height="20"
								viewBox="0 0 20 20"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M8 3V7M12 3V7M16 3V7M6 11.5H10M6 15.5H14M3.5 3H16.5C17.0523 3 17.5 3.44772 17.5 4V16C17.5 16.5523 17.0523 17 16.5 17H3.5C2.94772 17 2.5 16.5523 2.5 16V4C2.5 3.44772 2.94772 3 3.5 3Z"
									stroke="white"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</span>
						GIF
					</button>
				</div>
				<p class="text-gray-400 text-xs mt-1">
					{{ formatDescription }}
				</p>
			</div>

			<!-- Resolution Selection -->
			<div class="mb-4">
				<label class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium">Resolution</span>
				</label>
				<select
					v-model="resolution"
					class="w-full bg-[#1A1A1A] border border-[#333] rounded-md px-3 py-2 text-white focus:outline-none focus:border-[#432af4]"
				>
					<option value="720p">720p</option>
					<option value="1080p">1080p</option>
					<option value="480p">480p</option>
				</select>
				<p class="text-gray-400 text-xs mt-1">{{ resolutionDescription }}</p>
			</div>

			<!-- Quality Selection -->
			<div class="mb-6">
				<label class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium">Quality</span>
				</label>
				<select
					v-model="quality"
					class="w-full bg-[#1A1A1A] border border-[#333] rounded-md px-3 py-2 text-white focus:outline-none focus:border-[#432af4]"
				>
					<option value="medium">Medium</option>
					<option value="high">High</option>
					<option value="low">Low</option>
				</select>
				<p class="text-gray-400 text-xs mt-1">{{ qualityDescription }}</p>
			</div>

			<!-- Action Buttons -->
			<div class="flex justify-end gap-3">
				<button
					@click="close"
					class="px-4 py-2 rounded-md text-white bg-transparent hover:bg-[#2A2A2A] transition"
				>
					Cancel
				</button>
				<button
					@click="exportVideo"
					class="px-4 py-2 rounded-md text-white bg-[#432af4] hover:bg-[#3821d3] transition flex items-center gap-2"
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 20 20"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M16.5 14.25V11.625C16.5 9.76104 14.989 8.25 13.125 8.25H11.625C11.0037 8.25 10.5 7.74632 10.5 7.125V5.625C10.5 3.76104 8.98896 2.25 7.125 2.25H6M6 14.25L9 17.25M9 17.25L12 14.25M9 17.25L9 11.25M7.5 2.25H2.625C2.00368 2.25 1.5 2.75368 1.5 3.375V20.625C1.5 21.2463 2.00368 21.75 2.625 21.75H15.375C15.9963 21.75 16.5 21.2463 16.5 20.625V11.25C16.5 6.27944 12.4706 2.25 7.5 2.25Z"
							stroke="white"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
					Export Video
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";

const props = defineProps({
	isOpen: {
		type: Boolean,
		default: false,
	},
});

const emit = defineEmits(["close", "export"]);

// Generate default filename with current date and time
const generateDefaultFilename = () => {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	const seconds = String(now.getSeconds()).padStart(2, "0");

	return `sleer-${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
};

// Export settings
const format = ref("mp4");
const resolution = ref("720p");
const quality = ref("high");
const filename = ref(generateDefaultFilename());
const directory = ref("");

// Reset filename when modal opens
onMounted(() => {
	if (props.isOpen) {
		filename.value = generateDefaultFilename();
	}
});

// Update filename when modal opens
watch(
	() => props.isOpen,
	(isOpen) => {
		if (isOpen) {
			filename.value = generateDefaultFilename();

			// Set default directory (if any)
			if (!directory.value) {
				setDefaultDirectory();
			}
		}
	}
);

// Set default directory
const setDefaultDirectory = async () => {
	try {

		// Electron API check
		if (!window.electron?.ipcRenderer) {
			console.error("Electron API not found");
			return;
		}

		// First try to get downloads folder
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

		// Alternatively get home directory
		try {
			const homeDir = await window.electron.ipcRenderer.invoke("GET_HOME_DIR");

			if (homeDir) {
				directory.value = homeDir;
				return;
			}
		} catch (error) {
			console.warn("Could not get home directory:", error);
		}

		console.warn("Could not set any default directory");
	} catch (error) {
		console.error("Error setting default directory:", error);
	}
};

// Directory selection function
const selectDirectory = async () => {
	try {

		// Check existence of Electron object
		if (!window.electron || !window.electron.ipcRenderer) {
			console.error("Electron or ipcRenderer not found");
			return;
		}

		// Use direct string
		const result = await window.electron.ipcRenderer.invoke(
			"SHOW_DIRECTORY_DIALOG",
			{
				title: "Select Save Folder",
				buttonLabel: "Select",
				defaultPath: directory.value || undefined,
			}
		);


		if (
			result &&
			!result.canceled &&
			result.filePaths &&
			result.filePaths.length > 0
		) {
			directory.value = result.filePaths[0];
		} else {
		}
	} catch (error) {
		console.error("Directory selection error:", error);
		alert("An error occurred while selecting directory: " + error.message);
	}
};

// Helper computed properties
const formatDescription = computed(() => {
	if (format.value === "mp4") {
		return "High-quality video with audio, best for detailed tutorials";
	} else {
		return "Animated GIF format, best for short clips without audio";
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

const qualityDescription = computed(() => {
	const qualityMap = {
		low: "Better performance, 30fps, moderate file size (2.5 Mbps)",
		medium: "Great quality, 60fps, larger file size (5 Mbps)",
		high: "Premium quality, 60fps, largest file size (8 Mbps)",
	};
	return qualityMap[quality.value] || "";
});

// Functions
const close = () => {
	emit("close");
};

const exportVideo = () => {
	// Use default filename if empty
	if (!filename.value.trim()) {
		filename.value = generateDefaultFilename();
	}

	const settings = {
		format: format.value,
		resolution: resolution.value,
		quality: quality.value,
		filename: filename.value.trim(),
		directory: directory.value,
	};
	emit("export", settings);
	close();
};
</script>
