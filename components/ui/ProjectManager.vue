<template>
	<div class="relative">
		<!-- Project Button -->
		<button
			ref="projectButtonRef"
			class="btn-project flex flex-row gap-2 items-center px-4 py-1 rounded-lg"
			@click="toggleProjectPopover"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
				/>
			</svg>
			{{ currentProjectName || "Proje" }}
		</button>

		<!-- Popover Container -->
		<div v-if="isProjectPopoverOpen" class="popover-container">
			<!-- Backdrop for closing popover when clicking outside -->
			<div
				class="fixed inset-0 z-[90] bg-transparent"
				@click="isProjectPopoverOpen = false"
			></div>

			<!-- Project Popover -->
			<div
				ref="projectPopoverRef"
				class="fixed z-[100] bg-black border border-gray-700 rounded-xl shadow-lg p-4 w-[360px] max-h-[80vh] overflow-y-auto"
				:style="{
					top: popoverPosition.top + 'px',
					left: popoverPosition.left + 'px',
				}"
			>
				<div class="flex flex-col justify-between gap-2 items-start mb-4">
					<div class="w-full flex justify-between items-center">
						<h3 class="w-full text-md font-semibold">Proje Yönetimi</h3>
						<button
							@click="saveCurrentProject"
							class="w-full text-md rounded-lg text-blue-500 flex items-center justify-end gap-2"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-4 w-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 4v16m8-8H4"
								/>
							</svg>
							Projeyi Kaydet
						</button>
					</div>
					<p class="text-xs text-gray-400">
						Tüm proje ayarlarınızı, kamera ve video pozisyonlarınızı, timeline
						segmentlerinizi ve diğer ayarlarınızı kaydedebilirsiniz.
					</p>
				</div>

				<div class="max-h-[300px] overflow-y-auto">
					<div
						v-if="savedProjects.length === 0"
						class="text-gray-400 text-center py-4"
					>
						Kaydedilmiş proje bulunamadı.
					</div>
					<div
						v-for="project in savedProjects"
						:key="project.id"
						class="mb-2 py-2 border-b border-gray-700"
					>
						<div
							v-if="editingProjectId === project.id"
							class="flex items-center gap-2"
						>
							<input
								v-model="editingProjectName"
								class="flex-1 px-2 py-1 bg-black rounded border border-gray-500 focus:outline-none focus:border-blue-500"
								@keyup.enter="saveProjectName(project.id)"
							/>
							<button
								@click="saveProjectName(project.id)"
								class="text-green-500 hover:text-green-400"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
							</button>
							<button
								@click="cancelEditProjectName"
								class="text-red-500 hover:text-red-400"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>
						<div v-else class="flex items-center justify-between">
							<button
								@click="loadSelectedProject(project.id)"
								class="flex-1 text-left hover:text-blue-400 truncate"
								:title="project.name"
							>
								{{ project.name }}
								<span class="text-xs text-gray-500 ml-2">
									{{ formatDate(project.timestamp) }}
								</span>
							</button>
							<div class="flex items-center gap-1">
								<button
									@click="startEditProjectName(project)"
									class="text-gray-400 hover:text-white"
									title="Projeyi Yeniden Adlandır"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-4 w-4"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
										/>
									</svg>
								</button>
								<button
									@click="deleteSelectedProject(project.id)"
									class="text-gray-400 hover:text-red-500"
									title="Projeyi Sil"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-4 w-4"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
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
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from "vue";
import { useProjectManager } from "~/composables/useProjectManager";

const props = defineProps({
	mediaPlayer: {
		type: Object,
		required: true,
	},
	videoUrl: {
		type: String,
		default: "",
	},
	audioUrl: {
		type: String,
		default: "",
	},
	cameraUrl: {
		type: String,
		default: "",
	},
	segments: {
		type: Array,
		default: () => [],
	},
	mousePositions: {
		type: Array,
		default: () => [],
	},
});

const emit = defineEmits([
	"update:videoUrl",
	"update:audioUrl",
	"update:cameraUrl",
	"update:segments",
	"update:mousePositions",
	"projectLoaded",
	"projectSaved",
]);

const {
	currentProjectName,
	savedProjects,
	saveProject,
	loadProject,
	deleteProject,
	renameProject,
} = useProjectManager();

const projectButtonRef = ref(null);
const projectPopoverRef = ref(null);
const isProjectPopoverOpen = ref(false);
const editingProjectId = ref(null);
const editingProjectName = ref("");
const popoverPosition = ref({ top: 0, left: 0 });
const projectNameInput = ref("");

// Toggle project popover
const toggleProjectPopover = () => {
	console.log(
		"Toggle project popover called, current state:",
		isProjectPopoverOpen.value
	);
	isProjectPopoverOpen.value = !isProjectPopoverOpen.value;
	console.log("New popover state:", isProjectPopoverOpen.value);

	if (isProjectPopoverOpen.value) {
		// Use nextTick to ensure the popover is rendered before calculating position
		nextTick(() => {
			console.log("Updating popover position");
			updatePopoverPosition();
			// Add event listener for window resize
			window.addEventListener("resize", updatePopoverPosition);
		});
	} else {
		// Remove event listener when popover is closed
		window.removeEventListener("resize", updatePopoverPosition);
	}
};

// Update popover position
const updatePopoverPosition = () => {
	console.log("updatePopoverPosition called");

	if (!projectButtonRef.value || !projectPopoverRef.value) {
		console.warn("Missing refs:", {
			buttonRef: !!projectButtonRef.value,
			popoverRef: !!projectPopoverRef.value,
		});
		return;
	}

	const buttonRect = projectButtonRef.value.getBoundingClientRect();
	console.log("Button rect:", buttonRect);

	const popoverWidth = 360; // Width of the popover
	const windowWidth = window.innerWidth;
	console.log("Window width:", windowWidth);

	// Calculate left position to ensure popover is positioned to the left of the button
	// but still visible within the window
	let leftPosition = buttonRect.left - popoverWidth + buttonRect.width;
	console.log("Initial left position:", leftPosition);

	// Ensure popover is not positioned off-screen
	leftPosition = Math.max(
		10,
		Math.min(leftPosition, windowWidth - popoverWidth - 10)
	);
	console.log("Adjusted left position:", leftPosition);

	// Set position with a slight delay to ensure DOM is updated
	popoverPosition.value = {
		top: buttonRect.bottom + 10,
		left: leftPosition,
	};
	console.log("Final popover position:", popoverPosition.value);

	// Force a repaint
	projectPopoverRef.value.style.display = "none";
	projectPopoverRef.value.offsetHeight; // Force a repaint
	projectPopoverRef.value.style.display = "";
};

// Save current project
const saveCurrentProject = async () => {
	try {
		// Generate a default name with an incrementing number and date
		const now = new Date();
		const dateStr = `${now.getDate().toString().padStart(2, "0")}.${(
			now.getMonth() + 1
		)
			.toString()
			.padStart(2, "0")}.${now.getFullYear()} ${now
			.getHours()
			.toString()
			.padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

		// Use current project name if exists, otherwise create a new name
		const projectName =
			currentProjectName.value ||
			`Proje ${savedProjects.value.length + 1} - ${dateStr}`;

		console.log("Saving project with name:", projectName);

		// Save the project with all settings
		const result = await saveProject(
			projectName,
			props.mediaPlayer,
			props.videoUrl,
			props.audioUrl,
			props.cameraUrl,
			props.segments,
			props.mousePositions
		);

		console.log("Project saved:", result);
		emit("projectSaved", result);

		// Force update popover position after adding a new project
		nextTick(() => {
			updatePopoverPosition();
		});
	} catch (error) {
		console.error("Error saving project:", error);
		alert("Proje kaydedilirken bir hata oluştu: " + error.message);
	}
};

// Load a project
const loadSelectedProject = async (projectId) => {
	try {
		console.log("Loading project with ID:", projectId);

		if (!props.mediaPlayer) {
			console.error("MediaPlayer reference not available");
			alert("Proje yüklenemedi: MediaPlayer referansı bulunamadı");
			return;
		}

		// Define callbacks for setting positions and other data
		const callbacks = {
			setPositions: {
				video: (position) => {
					if (props.mediaPlayer.setVideoPosition) {
						props.mediaPlayer.setVideoPosition(position);
					}
				},
				camera: (position) => {
					if (props.mediaPlayer.setCameraPosition) {
						props.mediaPlayer.setCameraPosition(position);
					}
				},
			},
			setSegments: (segments) => {
				emit("update:segments", segments);
			},
			setMousePositions: (mousePositions) => {
				emit("update:mousePositions", mousePositions);
			},
			setMedia: (media) => {
				if (media.videoUrl) emit("update:videoUrl", media.videoUrl);
				if (media.audioUrl) emit("update:audioUrl", media.audioUrl);
				if (media.cameraUrl) emit("update:cameraUrl", media.cameraUrl);
			},
			setLayouts: (layouts) => {
				// Bu kısmı useLayoutSettings composable'ına eklemek gerekebilir
				console.log("Layouts loaded:", layouts);
			},
		};

		// Load the project with callbacks
		const result = await loadProject(projectId, callbacks);

		if (result) {
			console.log("Project loaded successfully");
			emit(
				"projectLoaded",
				savedProjects.value.find((p) => p.id === projectId)
			);
			// Close the popover after loading
			isProjectPopoverOpen.value = false;
		} else {
			console.error("Failed to load project");
			alert("Proje yüklenemedi");
		}
	} catch (error) {
		console.error("Error loading project:", error);
		alert("Proje yüklenirken bir hata oluştu: " + error.message);
	}
};

// Start editing project name
const startEditProjectName = (project) => {
	editingProjectId.value = project.id;
	editingProjectName.value = project.name;
};

// Save project name
const saveProjectName = async (projectId) => {
	console.log(
		"Saving new name for project:",
		projectId,
		editingProjectName.value
	);

	if (editingProjectName.value.trim()) {
		try {
			const result = await renameProject(
				projectId,
				editingProjectName.value.trim()
			);
			console.log("Project renamed:", result);
			cancelEditProjectName();
		} catch (error) {
			console.error("Error renaming project:", error);
		}
	} else {
		// If name is empty, just cancel editing
		cancelEditProjectName();
	}
};

// Cancel edit project name
const cancelEditProjectName = () => {
	editingProjectId.value = null;
	editingProjectName.value = "";
};

// Delete project
const deleteSelectedProject = async (projectId) => {
	try {
		console.log("Deleting project with ID:", projectId);

		// Delete the project directly without confirmation
		const result = await deleteProject(projectId);
		console.log("Project deleted:", result);

		// Force update popover position after removing a project
		nextTick(() => {
			updatePopoverPosition();
		});
	} catch (error) {
		console.error("Error deleting project:", error);
		alert("Proje silinirken bir hata oluştu: " + error.message);
	}
};

// Format date for display
const formatDate = (timestamp) => {
	if (!timestamp) return "";

	try {
		const date = new Date(timestamp);
		return `${date.getDate().toString().padStart(2, "0")}.${(
			date.getMonth() + 1
		)
			.toString()
			.padStart(2, "0")}.${date.getFullYear()} ${date
			.getHours()
			.toString()
			.padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
	} catch (error) {
		console.error("Error formatting date:", error);
		return "";
	}
};

// Reset editing state when popover is closed
watch(isProjectPopoverOpen, (isOpen) => {
	if (!isOpen) {
		cancelEditProjectName();
	}
});

// Clean up event listeners
onUnmounted(() => {
	window.removeEventListener("resize", updatePopoverPosition);
});
</script>

<style scoped>
/* Add any additional styling here */
.popover-container {
	position: relative;
}

.fixed {
	animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(-10px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
</style>
