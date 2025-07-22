<template>
	<div class="space-y-12">
		<!-- Preset Layouts Section -->
		<div class="space-y-4">
			<div>
				<h4 class="text-base font-semibold text-white">Default Layouts</h4>
				<p class="text-sm font-normal text-gray-500">
					Quick layout presets for common arrangements
				</p>
			</div>

			<div class="grid grid-cols-3 gap-3">
				<!-- Side by Side Layout -->
				<button
					@click="togglePresetLayout('side-by-side')"
					class="aspect-video p-3 outline-none rounded-xl transition-all duration-200 group hover:bg-zinc-800"
					:class="
						selectedPreset === 'side-by-side'
							? 'bg-zinc-800 '
							: 'bg-zinc-900 hover:bg-zinc-800'
					"
				>
					<div
						class="w-full h-full bg-zinc-800 rounded flex items-center justify-center relative overflow-hidden"
					>
						<div
							class="absolute left-1 top-1 bottom-1 w-[35%] border bg-zinc-500 border-zinc-500 rounded-lg"
						></div>
						<div
							class="absolute right-1 top-1 bottom-1 w-[50%] border border-zinc-500 rounded-lg"
						></div>
					</div>
					<div class="text-xs text-center mt-2 text-gray-300">Side by Side</div>
				</button>

				<!-- Camera Bottom Left Layout -->
				<button
					@click="togglePresetLayout('camera-bottom-left')"
					class="aspect-video p-3 outline-none rounded-xl transition-all duration-200 group hover:border-zinc-500"
					:class="
						selectedPreset === 'camera-bottom-left'
							? 'bg-zinc-800 '
							: 'bg-zinc-900 hover:bg-zinc-800'
					"
				>
					<div
						class="w-full h-full bg-zinc-800 rounded flex items-center justify-center relative overflow-hidden"
					>
						<div
							class="absolute inset-1 border border-zinc-500 rounded-lg"
						></div>
						<div
							class="absolute bottom-2 left-2 w-4 h-4 bg-zinc-500 rounded-full"
						></div>
					</div>
					<div class="text-xs text-center mt-2 text-gray-300">Bottom Left</div>
				</button>

				<!-- Camera Bottom Right Layout -->
				<button
					@click="togglePresetLayout('camera-bottom-right')"
					class="aspect-video p-3 outline-none rounded-xl transition-all duration-200 group hover:border-zinc-500"
					:class="
						selectedPreset === 'camera-bottom-right'
							? 'bg-zinc-800 '
							: 'bg-zinc-900 hover:bg-zinc-800'
					"
				>
					<div
						class="w-full h-full bg-zinc-800 rounded flex items-center justify-center relative overflow-hidden"
					>
						<div
							class="absolute inset-1 border border-zinc-500 rounded-lg"
						></div>
						<div
							class="absolute bottom-2 right-2 w-4 h-4 bg-zinc-500 rounded-full"
						></div>
					</div>
					<div class="text-xs text-center mt-2 text-gray-300">Bottom Right</div>
				</button>
			</div>
		</div>

		<!-- Save Current Layout -->
		<div class="flex items-center justify-between">
			<div>
				<h4 class="text-base font-semibold text-white">Save Current Layout</h4>
				<p class="text-sm font-normal text-gray-500">
					Save your current positions as a custom layout
				</p>
			</div>
			<button
				@click="saveCurrentLayout"
				class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all duration-200 shadow-lg shadow-blue-600/25 flex items-center gap-2"
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
						d="M12 4v16m8-8H4"
					/>
				</svg>
				Save
			</button>
		</div>

		<!-- Custom Layouts List -->
		<div class="space-y-4" v-if="savedLayouts.length > 0">
			<div>
				<h4 class="text-base font-semibold text-white">Saved Layouts</h4>
				<p class="text-sm font-normal text-gray-500">
					Your custom layout configurations
				</p>
			</div>

			<div class="space-y-2">
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
							class="flex-1 px-2 py-1 bg-zinc-900 rounded border border-gray-500 focus:outline-none focus:border-blue-500 text-white text-sm"
							@keyup.enter="saveLayoutName(layout.id)"
							@keyup.escape="cancelEditLayoutName"
						/>
						<button
							@click="saveLayoutName(layout.id)"
							class="text-green-500 hover:text-green-400 p-1"
							title="Save"
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
									d="M5 13l4 4L19 7"
								/>
							</svg>
						</button>
						<button
							@click="cancelEditLayoutName"
							class="text-red-500 hover:text-red-400 p-1"
							title="Cancel"
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
						</button>
					</div>

					<!-- Normal State -->
					<div v-else class="flex items-center justify-between">
						<button
							@click="applyLayout(layout.id)"
							class="flex-1 text-left text-white hover:text-blue-400 truncate font-medium text-sm"
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
										d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
									/>
								</svg>
							</button>
							<button
								@click="deleteLayout(layout.id)"
								class="text-gray-400 hover:text-red-500 p-1"
								title="Delete"
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
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Error state -->
		<div
			v-if="error"
			class="p-3 bg-red-900/20 border border-red-500/30 rounded-lg"
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
				<p class="text-red-400 text-xs">{{ error }}</p>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref } from "vue";
import { useLayoutSettings } from "~/composables/useLayoutSettings";
import { usePlayerSettings } from "~/composables/usePlayerSettings";

const props = defineProps({
	mediaPlayerRef: {
		type: Object,
		required: true,
	},
});

// Layout composable
const {
	savedLayouts,
	saveLayout,
	applyLayout: applyLayoutSettings,
	renameLayout,
	deleteLayout: removeLayout,
} = useLayoutSettings();

// Player settings composable
const { updateCameraSettings, cameraSettings, updatePadding, updateCropRatio } =
	usePlayerSettings();

// Refs
const error = ref("");
const editingLayoutId = ref(null);
const editingLayoutName = ref("");
const selectedPreset = ref(null);
const previousCameraSettings = ref(null);
const originalVideoPosition = ref(null);
const originalCameraPosition = ref(null);

// Preset layout configurations - yüzde değerleri kullan
const presetLayouts = {
	"side-by-side": {
		video: {
			xPercent: 14,
			yPercent: 1.5,
			widthPercent: 30,
			heightPercent: 35,
			padding: 200,
		},
		camera: {
			xPercent: 3,
			yPercent: 11.5,
			widthPercent: 35,
			heightPercent: 30,
			sizePercent: 25,
			borderRadius: 25,
			aspectRatio: "9:16",
		},
		canvas: {
			cropRatio: "16:9",
		},
	},
	"camera-bottom-left": {
		video: {
			xPercent: 0,
			yPercent: 0,
			widthPercent: 100,
			heightPercent: 100,
			padding: 160,
		},
		camera: {
			xPercent: 5,
			yPercent: 62.5,
			widthPercent: 20,
			heightPercent: 20,
			sizePercent: 20,
			borderRadius: 100,
			aspectRatio: "1:1",
		},
		canvas: {
			cropRatio: "16:9",
		},
	},
	"camera-bottom-right": {
		video: {
			xPercent: 0,
			yPercent: 0,
			widthPercent: 100,
			heightPercent: 100,
			padding: 160,
		},
		camera: {
			xPercent: 75,
			yPercent: 62.5,
			widthPercent: 20,
			heightPercent: 20,
			sizePercent: 20,
			borderRadius: 100,
			aspectRatio: "1:1",
		},
		canvas: {
			cropRatio: "16:9",
		},
	},
};

// Toggle preset layout (radio button behavior with toggle off)
const togglePresetLayout = (layoutType) => {
	try {
		if (!props.mediaPlayerRef) {
			throw new Error("MediaPlayer reference not available");
		}

		// Eğer aynı preset tekrar tıklanırsa, kapat (toggle off)
		if (selectedPreset.value === layoutType) {
			restoreOriginalLayout();
			return;
		}

		// İlk kez preset uyguluyorsak, orijinal pozisyonları kaydet
		if (!selectedPreset.value) {
			saveOriginalPositions();
		}

		// Seçili preset'i güncelle
		selectedPreset.value = layoutType;

		// Preset layout'u uygula
		applyPresetLayout(layoutType);

		console.log(`Applied preset layout: ${layoutType}`);
		error.value = "";
	} catch (err) {
		error.value = `Failed to toggle preset layout: ${err.message}`;
		console.error("Error toggling preset layout:", err);
	}
};

// Orijinal pozisyonları kaydet
const saveOriginalPositions = () => {
	try {
		if (props.mediaPlayerRef.getVideoPosition) {
			originalVideoPosition.value = props.mediaPlayerRef.getVideoPosition();
		}
		if (props.mediaPlayerRef.getCameraPosition) {
			originalCameraPosition.value = props.mediaPlayerRef.getCameraPosition();
		}
		// Camera settings'i usePlayerSettings'ten al
		previousCameraSettings.value = JSON.parse(
			JSON.stringify(cameraSettings.value)
		);
		console.log("Saved original positions:", {
			video: originalVideoPosition.value,
			camera: originalCameraPosition.value,
			settings: previousCameraSettings.value,
		});
	} catch (err) {
		console.error("Error saving original positions:", err);
	}
};

// Orijinal layout'a geri dön
const restoreOriginalLayout = () => {
	try {
		// Preset seçimini kaldır
		selectedPreset.value = null;

		// Orijinal video pozisyonunu geri yükle
		if (originalVideoPosition.value && props.mediaPlayerRef.setVideoPosition) {
			props.mediaPlayerRef.setVideoPosition(originalVideoPosition.value);
		}

		// Orijinal camera pozisyonunu geri yükle
		if (
			originalCameraPosition.value &&
			props.mediaPlayerRef.setCameraPosition
		) {
			props.mediaPlayerRef.setCameraPosition(originalCameraPosition.value);
		}

		// Orijinal camera ayarlarını geri yükle (tüm ayarları restore et)
		if (previousCameraSettings.value) {
			updateCameraSettings(previousCameraSettings.value);
		}

		console.log("Restored original layout:", {
			video: originalVideoPosition.value,
			camera: originalCameraPosition.value,
			settings: previousCameraSettings.value,
		});

		// Kayıtları temizle
		originalVideoPosition.value = null;
		originalCameraPosition.value = null;
		previousCameraSettings.value = null;

		error.value = "";
	} catch (err) {
		error.value = `Failed to restore original layout: ${err.message}`;
		console.error("Error restoring original layout:", err);
	}
};

// Apply preset layout
const applyPresetLayout = (layoutType) => {
	try {
		const config = presetLayouts[layoutType];
		if (!config) {
			throw new Error(`Unknown layout type: ${layoutType}`);
		}

		if (!props.mediaPlayerRef) {
			throw new Error("MediaPlayer reference not available");
		}

		// Canvas boyutunu al
		const canvasSize = props.mediaPlayerRef.getCanvasSize?.() || {
			width: 800,
			height: 600,
		};
		console.log("Canvas size:", canvasSize);

		// Seçili preset'i güncelle
		selectedPreset.value = layoutType;

		// Camera mouse tracking'i tamamen kapat ve diğer camera ayarlarını uygula
		updateCameraSettings({
			followMouse: false,
			size: config.camera.sizePercent || 15,
			radius: config.camera.borderRadius || 0,
			aspectRatio: config.camera.aspectRatio || "1:1",
		});

		// Video padding ayarını uygula (eğer varsa)
		if (config.video.padding) {
			updatePadding(config.video.padding);
		}

		// Canvas crop ratio ayarını uygula (eğer varsa)
		if (config.canvas && config.canvas.cropRatio) {
			updateCropRatio(config.canvas.cropRatio);
		}

		// Canvas boyutuna göre pozisyonları hesapla
		const cameraX = (config.camera.xPercent * canvasSize.width) / 100;
		const cameraY = (config.camera.yPercent * canvasSize.height) / 100;
		const videoX = (config.video.xPercent * canvasSize.width) / 100;
		const videoY = (config.video.yPercent * canvasSize.height) / 100;
		const videoWidth = (config.video.widthPercent * canvasSize.width) / 100;
		const videoHeight = (config.video.heightPercent * canvasSize.height) / 100;

		// Apply video position
		if (props.mediaPlayerRef.setVideoPosition) {
			props.mediaPlayerRef.setVideoPosition({
				x: videoX,
				y: videoY,
				width: videoWidth,
				height: videoHeight,
			});
		}

		// Apply camera position
		if (props.mediaPlayerRef.setCameraPosition) {
			props.mediaPlayerRef.setCameraPosition({
				x: cameraX,
				y: cameraY,
			});
		}

		console.log(`Applied preset layout: ${layoutType}`, {
			canvasSize,
			video: { x: videoX, y: videoY, width: videoWidth, height: videoHeight },
			camera: { x: cameraX, y: cameraY },
		});
		error.value = "";
	} catch (err) {
		error.value = `Failed to apply preset layout: ${err.message}`;
		console.error("Error applying preset layout:", err);
	}
};

// Get current positions and settings from MediaPlayer
const getCurrentPositions = () => {
	if (!props.mediaPlayerRef) {
		console.warn("MediaPlayer reference not available");
		return {
			videoPosition: null,
			cameraPosition: null,
			canvasSize: { width: 800, height: 600 },
			cameraSettings: {},
			videoBorderSettings: {},
			mouseCursorSettings: {},
			zoomSettings: { zoomRanges: [], currentZoomRange: null },
		};
	}

	try {
		// Get video and camera positions
		const videoPosition = props.mediaPlayerRef.getVideoPosition?.() || null;
		let cameraPosition = null;
		if (props.mediaPlayerRef.getCameraPosition) {
			cameraPosition = props.mediaPlayerRef.getCameraPosition();
		}

		// Get canvas size
		let canvasSize = { width: 800, height: 600 };
		if (props.mediaPlayerRef.getCanvasSize) {
			canvasSize = props.mediaPlayerRef.getCanvasSize();
		}

		// Get camera settings
		let cameraSettings = {};
		if (props.mediaPlayerRef.getCameraSettings) {
			cameraSettings = props.mediaPlayerRef.getCameraSettings();
			if (cameraPosition) {
				cameraSettings.position = { ...cameraPosition };
			}
		}

		// Get video border settings
		let videoBorderSettings = {};
		if (props.mediaPlayerRef.getVideoBorderSettings) {
			videoBorderSettings = props.mediaPlayerRef.getVideoBorderSettings();
		}

		// Get mouse cursor settings
		let mouseCursorSettings = {};
		if (props.mediaPlayerRef.getMouseCursorSettings) {
			mouseCursorSettings = props.mediaPlayerRef.getMouseCursorSettings();
		}

		// Get zoom settings
		let zoomSettings = { zoomRanges: [], currentZoomRange: null };
		if (props.mediaPlayerRef.getZoomSettings) {
			zoomSettings = props.mediaPlayerRef.getZoomSettings();
		}

		return {
			videoPosition,
			cameraPosition,
			canvasSize,
			cameraSettings,
			videoBorderSettings,
			mouseCursorSettings,
			zoomSettings,
		};
	} catch (error) {
		console.error(
			"Error getting positions and settings from MediaPlayer:",
			error
		);
		return {
			videoPosition: null,
			cameraPosition: null,
			canvasSize: { width: 800, height: 600 },
			cameraSettings: {},
			videoBorderSettings: {},
			mouseCursorSettings: {},
			zoomSettings: { zoomRanges: [], currentZoomRange: null },
		};
	}
};

// Save current layout
const saveCurrentLayout = async () => {
	try {
		// Generate a default name with date
		const now = new Date();
		const dateStr = `${now.getDate().toString().padStart(2, "0")}.${(
			now.getMonth() + 1
		)
			.toString()
			.padStart(2, "0")}.${now.getFullYear()} ${now
			.getHours()
			.toString()
			.padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
		const layoutName = `Layout ${savedLayouts.value.length + 1} - ${dateStr}`;

		// Get all positions and settings
		const {
			videoPosition,
			cameraPosition,
			canvasSize,
			cameraSettings,
			videoBorderSettings,
			mouseCursorSettings,
			zoomSettings,
		} = getCurrentPositions();

		// Save the layout with all settings
		const result = await saveLayout(layoutName, videoPosition, cameraPosition, {
			canvasSize,
			cameraSettings,
			videoBorderSettings,
			mouseCursorSettings,
			zoomRanges: zoomSettings?.zoomRanges || [],
			currentZoomRange: zoomSettings?.currentZoomRange || null,
		});

		console.log("Layout saved successfully");
		error.value = "";
	} catch (err) {
		error.value = `Failed to save layout: ${err.message}`;
		console.error("Error saving layout:", err);
	}
};

// Apply a custom layout
const applyLayout = async (layoutId) => {
	try {
		if (!props.mediaPlayerRef) {
			throw new Error("MediaPlayer reference not available");
		}

		// Custom layout uygulandığında preset seçimini kaldır ve orijinal layout'a dön
		if (selectedPreset.value) {
			restoreOriginalLayout();
		}

		// Define callbacks for setting positions
		const setVideoPosition = (position) => {
			if (props.mediaPlayerRef.setVideoPosition) {
				props.mediaPlayerRef.setVideoPosition(position);
			}
		};

		const setCameraPosition = (position) => {
			if (props.mediaPlayerRef.setCameraPosition) {
				props.mediaPlayerRef.setCameraPosition(position);
			}
		};

		// Apply the layout with callbacks
		const result = await applyLayoutSettings(
			layoutId,
			setVideoPosition,
			setCameraPosition
		);

		if (!result) {
			throw new Error("Failed to apply layout");
		}

		console.log("Layout applied successfully");
		error.value = "";
	} catch (err) {
		error.value = `Failed to apply layout: ${err.message}`;
		console.error("Error applying layout:", err);
	}
};

// Start editing layout name
const startEditLayoutName = (layout) => {
	editingLayoutId.value = layout.id;
	editingLayoutName.value = layout.name;
};

// Save layout name
const saveLayoutName = async (layoutId) => {
	if (editingLayoutName.value.trim()) {
		try {
			const result = await renameLayout(
				layoutId,
				editingLayoutName.value.trim()
			);
			cancelEditLayoutName();
			error.value = "";
		} catch (err) {
			error.value = `Failed to rename layout: ${err.message}`;
			console.error("Error renaming layout:", err);
		}
	} else {
		cancelEditLayoutName();
	}
};

// Cancel edit layout name
const cancelEditLayoutName = () => {
	editingLayoutId.value = null;
	editingLayoutName.value = "";
};

// Delete layout
const deleteLayout = async (layoutId) => {
	try {
		const result = await removeLayout(layoutId);
		console.log("Layout deleted successfully");
		error.value = "";
	} catch (err) {
		error.value = `Failed to delete layout: ${err.message}`;
		console.error("Error deleting layout:", err);
	}
};

// Manuel değişiklik yapıldığında preset seçimini kaldır
const resetPresetSelection = () => {
	if (selectedPreset.value) {
		restoreOriginalLayout();
	}
};

// Component expose et ki dışarıdan erişilebilsin
defineExpose({
	resetPresetSelection,
});
</script>
