<template>
	<div class="relative">
		<!-- Layout Button -->
		<button
			ref="layoutButtonRef"
			class="btn-layout flex flex-row gap-2 items-center px-4 py-1 rounded-lg"
			@click="toggleLayoutPopover"
		>
			<svg
				class="h-5 w-5"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M2.25 7.125C2.25 6.50368 2.75368 6 3.375 6H9.375C9.99632 6 10.5 6.50368 10.5 7.125V10.875C10.5 11.4963 9.99632 12 9.375 12H3.375C2.75368 12 2.25 11.4963 2.25 10.875V7.125Z"
					stroke="white"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<path
					d="M14.25 8.625C14.25 8.00368 14.7537 7.5 15.375 7.5H20.625C21.2463 7.5 21.75 8.00368 21.75 8.625V16.875C21.75 17.4963 21.2463 18 20.625 18H15.375C14.7537 18 14.25 17.4963 14.25 16.875V8.625Z"
					stroke="white"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<path
					d="M3.75 16.125C3.75 15.5037 4.25368 15 4.875 15H10.125C10.7463 15 11.25 15.5037 11.25 16.125V18.375C11.25 18.9963 10.7463 19.5 10.125 19.5H4.875C4.25368 19.5 3.75 18.9963 3.75 18.375V16.125Z"
					stroke="white"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>

			Düzen
		</button>

		<!-- Popover Container -->
		<div v-if="isLayoutPopoverOpen" class="popover-container">
			<!-- Backdrop for closing popover when clicking outside -->
			<div
				class="fixed inset-0 z-[90] bg-transparent"
				@click="isLayoutPopoverOpen = false"
			></div>

			<!-- Layout Popover -->
			<div
				ref="layoutPopoverRef"
				class="fixed z-[100] bg-black border border-gray-700 rounded-xl shadow-lg p-4 w-[360px] max-h-[80vh] overflow-y-auto"
				:style="{
					top: popoverPosition.top + 'px',
					left: popoverPosition.left + 'px',
				}"
			>
				<div class="flex flex-col justify-between gap-2 items-start mb-4">
					<div class="w-full flex justify-between items-center">
						<h3 class="w-full text-md font-semibold">Düzen Yönetimi</h3>
						<button
							@click="saveCurrentLayout"
							class="w-full text-md mb-2 rounded-lg text-blue-500 flex items-center justify-end gap-2"
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
							Düzeni Kaydet
						</button>
					</div>
					<p class="text-xs text-gray-400">
						Yerleşim düzeninizi ve bazı ayarlarınızı daha sonradan kullanmak
						için kaydedebilirsiniz.
					</p>
				</div>

				<div class="max-h-[300px] overflow-y-auto">
					<div
						v-if="savedLayouts.length === 0"
						class="text-gray-400 text-center py-4"
					>
						Kaydedilmiş düzen bulunamadı.
					</div>
					<div
						v-for="layout in savedLayouts"
						:key="layout.id"
						class="mb-2 py-2 border-b border-gray-700"
					>
						<div
							v-if="editingLayoutId === layout.id"
							class="flex items-center gap-2"
						>
							<input
								v-model="editingLayoutName"
								class="flex-1 px-2 py-1 bg-black rounded border border-gray-500 focus:outline-none focus:border-blue-500"
								@keyup.enter="saveLayoutName(layout.id)"
							/>
							<button
								@click="saveLayoutName(layout.id)"
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
								@click="cancelEditLayoutName"
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
								@click="applyLayout(layout.id)"
								class="flex-1 text-left hover:text-blue-400 truncate"
								:title="layout.name"
							>
								{{ layout.name }}
							</button>
							<div class="flex items-center gap-1">
								<button
									@click="startEditLayoutName(layout)"
									class="text-gray-400 hover:text-white"
									title="Düzeni Yeniden Adlandır"
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
									@click="deleteLayout(layout.id)"
									class="text-gray-400 hover:text-red-500"
									title="Düzeni Sil"
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
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useLayoutSettings } from "~/composables/useLayoutSettings";

const props = defineProps({
	mediaPlayer: {
		type: Object,
		required: true,
	},
});

const {
	savedLayouts,
	saveLayout,
	applyLayout: applyLayoutSettings,
	renameLayout,
	deleteLayout: removeLayout,
} = useLayoutSettings();

const layoutButtonRef = ref(null);
const layoutPopoverRef = ref(null);
const isLayoutPopoverOpen = ref(false);
const editingLayoutId = ref(null);
const editingLayoutName = ref("");
const popoverPosition = ref({ top: 0, left: 0 });

// Get current positions and settings from MediaPlayer
const getCurrentPositions = () => {
	if (!props.mediaPlayer) {
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
		const videoPosition = props.mediaPlayer.getVideoPosition?.() || null;

		// Get camera position - ensure we're getting the actual position
		let cameraPosition = null;
		if (props.mediaPlayer.getCameraPosition) {
			cameraPosition = props.mediaPlayer.getCameraPosition();
		}

		// Get canvas size
		let canvasSize = { width: 800, height: 600 };
		if (props.mediaPlayer.getCanvasSize) {
			canvasSize = props.mediaPlayer.getCanvasSize();
		}

		// Get camera settings
		let cameraSettings = {};
		if (props.mediaPlayer.getCameraSettings) {
			cameraSettings = props.mediaPlayer.getCameraSettings();

			// Düzen kaydedilirken, kamera pozisyonunu cameraSettings içine de kaydet
			// Bu, düzen uygulandığında kameranın doğru konuma gitmesini sağlar
			if (cameraPosition) {
				cameraSettings.position = { ...cameraPosition };
			}
		}

		// Get video border settings
		let videoBorderSettings = {};
		if (props.mediaPlayer.getVideoBorderSettings) {
			videoBorderSettings = props.mediaPlayer.getVideoBorderSettings();
		}

		// Get mouse cursor settings
		let mouseCursorSettings = {};
		if (props.mediaPlayer.getMouseCursorSettings) {
			mouseCursorSettings = props.mediaPlayer.getMouseCursorSettings();
		}

		// Get zoom settings
		let zoomSettings = { zoomRanges: [], currentZoomRange: null };
		if (props.mediaPlayer.getZoomSettings) {
			zoomSettings = props.mediaPlayer.getZoomSettings();
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

// Toggle layout popover
const toggleLayoutPopover = () => {
	isLayoutPopoverOpen.value = !isLayoutPopoverOpen.value;

	if (isLayoutPopoverOpen.value) {
		// Use nextTick to ensure the popover is rendered before calculating position
		nextTick(() => {
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

	if (!layoutButtonRef.value || !layoutPopoverRef.value) {
		console.warn("Missing refs:", {
			buttonRef: !!layoutButtonRef.value,
			popoverRef: !!layoutPopoverRef.value,
		});
		return;
	}

	const buttonRect = layoutButtonRef.value.getBoundingClientRect();

	const popoverWidth = 280; // Width of the popover
	const windowWidth = window.innerWidth;

	// Calculate left position to ensure popover is positioned to the left of the button
	// but still visible within the window
	let leftPosition = buttonRect.left - popoverWidth + buttonRect.width;

	// Ensure popover is not positioned off-screen
	leftPosition = Math.max(
		10,
		Math.min(leftPosition, windowWidth - popoverWidth - 10)
	);

	// Set position with a slight delay to ensure DOM is updated
	popoverPosition.value = {
		top: buttonRect.bottom + 10,
		left: leftPosition,
	};

	// Force a repaint
	layoutPopoverRef.value.style.display = "none";
	layoutPopoverRef.value.offsetHeight; // Force a repaint
	layoutPopoverRef.value.style.display = "";
};

// Save current layout
const saveCurrentLayout = async () => {
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
		const layoutName = `Düzen ${savedLayouts.value.length + 1} - ${dateStr}`;


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


		// Force update popover position after adding a new layout
		nextTick(() => {
			updatePopoverPosition();
		});
	} catch (error) {
		console.error("Error saving layout:", error);
		alert("Düzen kaydedilirken bir hata oluştu: " + error.message);
	}
};

// Apply a layout
const applyLayout = async (layoutId) => {
	try {

		if (!props.mediaPlayer) {
			console.error("MediaPlayer reference not available");
			alert("Düzen uygulanamadı: MediaPlayer referansı bulunamadı");
			return;
		}

		// Define callbacks for setting positions
		const setVideoPosition = (position) => {
			if (props.mediaPlayer.setVideoPosition) {
				props.mediaPlayer.setVideoPosition(position);
			}
		};

		const setCameraPosition = (position) => {
			if (props.mediaPlayer.setCameraPosition) {
				props.mediaPlayer.setCameraPosition(position);
			}
		};

		// Apply the layout with callbacks
		const result = await applyLayoutSettings(
			layoutId,
			setVideoPosition,
			setCameraPosition
		);

		if (result) {
		} else {
			console.error("Failed to apply layout");
			alert("Düzen uygulanamadı");
		}
	} catch (error) {
		console.error("Error applying layout:", error);
		alert("Düzen uygulanırken bir hata oluştu: " + error.message);
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
		} catch (error) {
			console.error("Error renaming layout:", error);
		}
	} else {
		// If name is empty, just cancel editing
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
		// Delete the layout directly without confirmation
		const result = await removeLayout(layoutId);

		// Force update popover position after removing a layout
		nextTick(() => {
			updatePopoverPosition();
		});
	} catch (error) {
		console.error("Error deleting layout:", error);
		alert("Düzen silinirken bir hata oluştu: " + error.message);
	}
};

// Reset editing state when popover is closed
watch(isLayoutPopoverOpen, (isOpen) => {
	if (!isOpen) {
		cancelEditLayoutName();
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
