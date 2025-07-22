<template>
	<BaseModal
		v-model="isModalOpen"
		title="Layout Manager"
		subtitle="Choose from presets or manage your custom layouts"
		size="2xl"
		@close="handleClose"
	>
		<!-- Main Content Grid -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
			
			<!-- Left Column: Preset Layouts -->
			<div class="space-y-6">
				<div>
					<h3 class="text-lg font-medium text-white mb-4 flex items-center gap-2">
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
						</svg>
						Default Layouts
					</h3>
				</div>

				<!-- Preset Layout Options -->
				<div class="space-y-4">
					<!-- Side by Side Layout -->
					<button
						@click="applyPresetLayout('side-by-side')"
						class="w-full p-4 rounded-lg border-2 transition-all duration-200 group bg-zinc-800/40 border-zinc-600/60 hover:border-blue-500/80 hover:bg-zinc-700/60"
					>
						<div class="flex items-center gap-4">
							<!-- Preview Icon -->
							<div class="w-16 h-10 bg-zinc-700 rounded flex items-center justify-center relative overflow-hidden">
								<div class="absolute left-1 top-1 bottom-1 w-6 bg-blue-500/60 rounded-sm"></div>
								<div class="absolute right-1 top-1 bottom-1 w-6 bg-green-500/60 rounded-full"></div>
							</div>
							<div class="text-left">
								<div class="text-sm font-medium text-white">Side by Side</div>
								<div class="text-xs text-gray-400">Video and camera 1:1 ratio</div>
							</div>
						</div>
					</button>

					<!-- Camera Bottom Left Layout -->
					<button
						@click="applyPresetLayout('camera-bottom-left')"
						class="w-full p-4 rounded-lg border-2 transition-all duration-200 group bg-zinc-800/40 border-zinc-600/60 hover:border-blue-500/80 hover:bg-zinc-700/60"
					>
						<div class="flex items-center gap-4">
							<!-- Preview Icon -->
							<div class="w-16 h-10 bg-zinc-700 rounded flex items-center justify-center relative overflow-hidden">
								<div class="absolute inset-1 bg-blue-500/60 rounded-sm"></div>
								<div class="absolute bottom-1 left-1 w-4 h-4 bg-green-500/60 rounded-full"></div>
							</div>
							<div class="text-left">
								<div class="text-sm font-medium text-white">Camera Bottom Left</div>
								<div class="text-xs text-gray-400">Full video with round camera overlay</div>
							</div>
						</div>
					</button>

					<!-- Camera Bottom Right Layout -->
					<button
						@click="applyPresetLayout('camera-bottom-right')"
						class="w-full p-4 rounded-lg border-2 transition-all duration-200 group bg-zinc-800/40 border-zinc-600/60 hover:border-blue-500/80 hover:bg-zinc-700/60"
					>
						<div class="flex items-center gap-4">
							<!-- Preview Icon -->
							<div class="w-16 h-10 bg-zinc-700 rounded flex items-center justify-center relative overflow-hidden">
								<div class="absolute inset-1 bg-blue-500/60 rounded-sm"></div>
								<div class="absolute bottom-1 right-1 w-4 h-4 bg-green-500/60 rounded-full"></div>
							</div>
							<div class="text-left">
								<div class="text-sm font-medium text-white">Camera Bottom Right</div>
								<div class="text-xs text-gray-400">Full video with round camera overlay</div>
							</div>
						</div>
					</button>
				</div>
			</div>

			<!-- Middle Column: Custom Layouts -->
			<div class="space-y-6">
				<div>
					<h3 class="text-lg font-medium text-white mb-4 flex items-center gap-2">
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
						</svg>
						Custom Layouts
					</h3>
				</div>

				<!-- Custom Layouts List -->
				<div class="max-h-[400px] overflow-y-auto space-y-3">
					<div
						v-if="savedLayouts.length === 0"
						class="text-gray-400 text-center py-8 border border-zinc-600/60 rounded-lg bg-zinc-800/20"
					>
						<svg class="w-12 h-12 text-gray-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
						</svg>
						<div class="text-sm">No custom layouts saved</div>
						<div class="text-xs text-gray-500 mt-1">Save your current layout to get started</div>
					</div>

					<div
						v-for="layout in savedLayouts"
						:key="layout.id"
						class="p-3 rounded-lg border border-zinc-600/60 bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
					>
						<!-- Editing State -->
						<div
							v-if="editingLayoutId === layout.id"
							class="flex items-center gap-2"
						>
							<input
								v-model="editingLayoutName"
								class="flex-1 px-2 py-1 bg-zinc-900 rounded border border-gray-500 focus:outline-none focus:border-blue-500 text-white"
								@keyup.enter="saveLayoutName(layout.id)"
								@keyup.escape="cancelEditLayoutName"
							/>
							<button
								@click="saveLayoutName(layout.id)"
								class="text-green-500 hover:text-green-400 p-1"
								title="Save"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
							</button>
							<button
								@click="cancelEditLayoutName"
								class="text-red-500 hover:text-red-400 p-1"
								title="Cancel"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						<!-- Normal State -->
						<div v-else class="flex items-center justify-between">
							<button
								@click="applyLayout(layout.id)"
								class="flex-1 text-left text-white hover:text-blue-400 truncate font-medium"
								:title="layout.name"
							>
								{{ layout.name }}
							</button>
							<div class="flex items-center gap-1">
								<button
									@click="startEditLayoutName(layout)"
									class="text-gray-400 hover:text-white p-1"
									title="Rename"
								>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
									</svg>
								</button>
								<button
									@click="deleteLayout(layout.id)"
									class="text-gray-400 hover:text-red-500 p-1"
									title="Delete"
								>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
									</svg>
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Right Column: Actions & Info -->
			<div class="space-y-6">
				<div>
					<h3 class="text-lg font-medium text-white mb-4 flex items-center gap-2">
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
						</svg>
						Actions
					</h3>
				</div>

				<!-- Save Current Layout -->
				<div class="p-4 bg-zinc-800/40 rounded-lg border border-zinc-600/60">
					<div class="flex items-center gap-2 mb-3">
						<svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
						</svg>
						<span class="text-sm font-medium text-gray-300">Save Current</span>
					</div>
					<p class="text-xs text-gray-400 mb-3">
						Save your current video and camera positions as a custom layout
					</p>
					<button
						@click="saveCurrentLayout"
						class="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all duration-200 shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Save Layout
					</button>
				</div>

				<!-- Layout Info -->
				<div class="p-4 bg-zinc-800/40 rounded-lg border border-zinc-600/60">
					<div class="flex items-center gap-2 mb-3">
						<svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span class="text-sm font-medium text-gray-300">Layout Info</span>
					</div>
					<div class="space-y-2 text-xs text-gray-400">
						<div>• Preset layouts apply instantly</div>
						<div>• Custom layouts save all positions and settings</div>
						<div>• Layouts include camera, video, and styling settings</div>
						<div>• Use presets as starting points for customization</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Error state -->
		<div v-if="error" class="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
			<div class="flex items-center gap-2">
				<svg class="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<p class="text-red-400 text-sm">{{ error }}</p>
			</div>
		</div>

		<template #footer>
			<button
				@click="handleClose"
				class="px-4 py-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/80 text-gray-300 hover:text-white transition-all duration-200"
			>
				Close
			</button>
		</template>
	</BaseModal>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue"
import BaseModal from "./BaseModal.vue"
import { useLayoutSettings } from "~/composables/useLayoutSettings"

const props = defineProps({
	isOpen: {
		type: Boolean,
		default: false
	},
	mediaPlayer: {
		type: Object,
		required: true
	}
})

const emit = defineEmits(["close"])

// Refs
const isModalOpen = ref(false)
const error = ref("")
const editingLayoutId = ref(null)
const editingLayoutName = ref("")

// Layout composable
const {
	savedLayouts,
	saveLayout,
	applyLayout: applyLayoutSettings,
	renameLayout,
	deleteLayout: removeLayout,
} = useLayoutSettings()

// Watch props
watch(() => props.isOpen, (newVal) => {
	isModalOpen.value = newVal
	if (newVal) {
		error.value = ""
	}
})

// Preset layout configurations
const presetLayouts = {
	'side-by-side': {
		video: { x: 0, y: 0, width: 640, height: 480 },
		camera: { x: 640, y: 0, width: 640, height: 480, borderRadius: 0 }
	},
	'camera-bottom-left': {
		video: { x: 0, y: 0, width: 1280, height: 720 },
		camera: { x: 40, y: 580, width: 120, height: 120, borderRadius: 60 }
	},
	'camera-bottom-right': {
		video: { x: 0, y: 0, width: 1280, height: 720 },
		camera: { x: 1120, y: 580, width: 120, height: 120, borderRadius: 60 }
	}
}

// Apply preset layout
const applyPresetLayout = (layoutType) => {
	try {
		const config = presetLayouts[layoutType]
		if (!config) {
			throw new Error(`Unknown layout type: ${layoutType}`)
		}

		if (!props.mediaPlayer) {
			throw new Error("MediaPlayer reference not available")
		}

		// Apply video position
		if (props.mediaPlayer.setVideoPosition) {
			props.mediaPlayer.setVideoPosition(config.video)
		}

		// Apply camera position and settings
		if (props.mediaPlayer.setCameraPosition) {
			props.mediaPlayer.setCameraPosition(config.camera)
		}

		// Set camera border radius for circular effect
		if (props.mediaPlayer.setCameraSettings && config.camera.borderRadius) {
			props.mediaPlayer.setCameraSettings({
				borderRadius: config.camera.borderRadius
			})
		}

		console.log(`Applied preset layout: ${layoutType}`)
	} catch (err) {
		error.value = `Failed to apply preset layout: ${err.message}`
		console.error("Error applying preset layout:", err)
	}
}

// Get current positions and settings from MediaPlayer
const getCurrentPositions = () => {
	if (!props.mediaPlayer) {
		console.warn("MediaPlayer reference not available")
		return {
			videoPosition: null,
			cameraPosition: null,
			canvasSize: { width: 800, height: 600 },
			cameraSettings: {},
			videoBorderSettings: {},
			mouseCursorSettings: {},
			zoomSettings: { zoomRanges: [], currentZoomRange: null },
		}
	}

	try {
		// Get video and camera positions
		const videoPosition = props.mediaPlayer.getVideoPosition?.() || null
		let cameraPosition = null
		if (props.mediaPlayer.getCameraPosition) {
			cameraPosition = props.mediaPlayer.getCameraPosition()
		}

		// Get canvas size
		let canvasSize = { width: 800, height: 600 }
		if (props.mediaPlayer.getCanvasSize) {
			canvasSize = props.mediaPlayer.getCanvasSize()
		}

		// Get camera settings
		let cameraSettings = {}
		if (props.mediaPlayer.getCameraSettings) {
			cameraSettings = props.mediaPlayer.getCameraSettings()
			if (cameraPosition) {
				cameraSettings.position = { ...cameraPosition }
			}
		}

		// Get video border settings
		let videoBorderSettings = {}
		if (props.mediaPlayer.getVideoBorderSettings) {
			videoBorderSettings = props.mediaPlayer.getVideoBorderSettings()
		}

		// Get mouse cursor settings
		let mouseCursorSettings = {}
		if (props.mediaPlayer.getMouseCursorSettings) {
			mouseCursorSettings = props.mediaPlayer.getMouseCursorSettings()
		}

		// Get zoom settings
		let zoomSettings = { zoomRanges: [], currentZoomRange: null }
		if (props.mediaPlayer.getZoomSettings) {
			zoomSettings = props.mediaPlayer.getZoomSettings()
		}

		return {
			videoPosition,
			cameraPosition,
			canvasSize,
			cameraSettings,
			videoBorderSettings,
			mouseCursorSettings,
			zoomSettings,
		}
	} catch (error) {
		console.error("Error getting positions and settings from MediaPlayer:", error)
		return {
			videoPosition: null,
			cameraPosition: null,
			canvasSize: { width: 800, height: 600 },
			cameraSettings: {},
			videoBorderSettings: {},
			mouseCursorSettings: {},
			zoomSettings: { zoomRanges: [], currentZoomRange: null },
		}
	}
}

// Save current layout
const saveCurrentLayout = async () => {
	try {
		// Generate a default name with date
		const now = new Date()
		const dateStr = `${now.getDate().toString().padStart(2, "0")}.${(now.getMonth() + 1).toString().padStart(2, "0")}.${now.getFullYear()} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
		const layoutName = `Layout ${savedLayouts.value.length + 1} - ${dateStr}`

		// Get all positions and settings
		const {
			videoPosition,
			cameraPosition,
			canvasSize,
			cameraSettings,
			videoBorderSettings,
			mouseCursorSettings,
			zoomSettings,
		} = getCurrentPositions()

		// Save the layout with all settings
		const result = await saveLayout(layoutName, videoPosition, cameraPosition, {
			canvasSize,
			cameraSettings,
			videoBorderSettings,
			mouseCursorSettings,
			zoomRanges: zoomSettings?.zoomRanges || [],
			currentZoomRange: zoomSettings?.currentZoomRange || null,
		})

		console.log("Layout saved successfully")
	} catch (err) {
		error.value = `Failed to save layout: ${err.message}`
		console.error("Error saving layout:", err)
	}
}

// Apply a custom layout
const applyLayout = async (layoutId) => {
	try {
		if (!props.mediaPlayer) {
			throw new Error("MediaPlayer reference not available")
		}

		// Define callbacks for setting positions
		const setVideoPosition = (position) => {
			if (props.mediaPlayer.setVideoPosition) {
				props.mediaPlayer.setVideoPosition(position)
			}
		}

		const setCameraPosition = (position) => {
			if (props.mediaPlayer.setCameraPosition) {
				props.mediaPlayer.setCameraPosition(position)
			}
		}

		// Apply the layout with callbacks
		const result = await applyLayoutSettings(
			layoutId,
			setVideoPosition,
			setCameraPosition
		)

		if (!result) {
			throw new Error("Failed to apply layout")
		}

		console.log("Layout applied successfully")
	} catch (err) {
		error.value = `Failed to apply layout: ${err.message}`
		console.error("Error applying layout:", err)
	}
}

// Start editing layout name
const startEditLayoutName = (layout) => {
	editingLayoutId.value = layout.id
	editingLayoutName.value = layout.name
}

// Save layout name
const saveLayoutName = async (layoutId) => {
	if (editingLayoutName.value.trim()) {
		try {
			const result = await renameLayout(layoutId, editingLayoutName.value.trim())
			cancelEditLayoutName()
		} catch (err) {
			error.value = `Failed to rename layout: ${err.message}`
			console.error("Error renaming layout:", err)
		}
	} else {
		cancelEditLayoutName()
	}
}

// Cancel edit layout name
const cancelEditLayoutName = () => {
	editingLayoutId.value = null
	editingLayoutName.value = ""
}

// Delete layout
const deleteLayout = async (layoutId) => {
	try {
		const result = await removeLayout(layoutId)
		console.log("Layout deleted successfully")
	} catch (err) {
		error.value = `Failed to delete layout: ${err.message}`
		console.error("Error deleting layout:", err)
	}
}

const handleClose = () => {
	isModalOpen.value = false
	emit("close")
}

// Reset editing state when modal is closed
watch(isModalOpen, (isOpen) => {
	if (!isOpen) {
		cancelEditLayoutName()
		error.value = ""
	}
})
</script>