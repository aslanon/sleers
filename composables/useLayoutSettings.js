import { ref, onMounted, computed, watch } from "vue";
import { usePlayerSettings } from "./usePlayerSettings";

// Store saved layouts
const savedLayouts = ref([]);
const layoutRanges = ref([]);

export const useLayoutSettings = () => {
	const playerSettings = usePlayerSettings();
	const electron = window.electron;
	const selectedLayoutIndex = ref(null);
	const currentLayout = ref("camera-full"); // Default layout type

	// Watch for layout range changes
	watch(layoutRanges, (newRanges) => {}, { deep: true });

	// Save current settings as a layout
	const saveLayout = async (
		name,
		videoPos,
		cameraPos,
		additionalSettings = {}
	) => {
		try {
			// Generate a unique ID
			const layoutId = `layout_${Date.now()}_${Math.floor(
				Math.random() * 1000
			)}`;

			// Get current settings
			const currentSettings = {
				id: layoutId,
				name: name || `Düzen ${savedLayouts.value.length + 1}`,
				timestamp: new Date().toISOString(),
				settings: {
					// Video and camera positions
					videoPosition: videoPos || { x: 0, y: 0 },
					cameraPosition: cameraPos || { x: 0, y: 0 },

					// Player settings
					mouseSize: playerSettings.mouseSize.value,
					motionBlurValue: playerSettings.motionBlurValue.value,
					mouseVisible: playerSettings.mouseVisible.value,
					backgroundColor: playerSettings.backgroundColor.value,
					backgroundImage: playerSettings.backgroundImage.value,
					backgroundBlur: playerSettings.backgroundBlur.value,
					padding: playerSettings.padding.value,
					radius: playerSettings.radius.value,
					shadowSize: playerSettings.shadowSize.value,
					cropRatio: playerSettings.cropRatio.value,
					showDock: playerSettings.showDock.value,

					// Canvas size settings - use provided values or defaults
					canvasSize: additionalSettings.canvasSize ||
						playerSettings.canvasSize?.value || { width: 800, height: 600 },

					// Camera settings - use provided values or defaults
					cameraSettings:
						additionalSettings.cameraSettings ||
						JSON.parse(
							JSON.stringify(
								playerSettings.cameraSettings?.value || {
									size: 20, // Camera size percentage
									opacity: 1, // Camera opacity
									borderRadius: 50, // Camera border radius
									borderWidth: 2, // Camera border width
									borderColor: "#ffffff", // Camera border color
									followMouse: true, // Whether camera follows mouse
									visible: true, // Camera visibility
									position: cameraPos || { x: 0, y: 0 }, // Use provided camera position
								}
							)
						),

					// Video border settings - use provided values or defaults
					videoBorderSettings:
						additionalSettings.videoBorderSettings ||
						JSON.parse(
							JSON.stringify(
								playerSettings.videoBorderSettings?.value || {
									width: 0,
									color: "rgba(255, 255, 255, 1)",
									style: "solid",
								}
							)
						),

					// Mouse cursor settings
					mouseCursorSettings:
						additionalSettings.mouseCursorSettings ||
						JSON.parse(
							JSON.stringify(
								playerSettings.mouseCursorSettings?.value || {
									type: "default",
									color: "#ffffff",
									size: playerSettings.mouseSize.value || 20,
									visible: playerSettings.mouseVisible.value || true,
								}
							)
						),

					// Zoom settings
					zoomRanges:
						additionalSettings.zoomRanges ||
						JSON.parse(JSON.stringify(playerSettings.zoomRanges?.value || [])),

					currentZoomRange:
						additionalSettings.currentZoomRange ||
						(playerSettings.currentZoomRange?.value
							? JSON.parse(
									JSON.stringify(playerSettings.currentZoomRange.value)
							  )
							: null),
				},
			};

			// Ensure camera position is properly set in camera settings
			if (cameraPos && currentSettings.settings.cameraSettings) {
				currentSettings.settings.cameraSettings.position = { ...cameraPos };
			}

			// Add to saved layouts
			savedLayouts.value.push(currentSettings);

			// Save to localStorage for web
			try {
				localStorage.setItem(
					"creavit-studio-layouts",
					JSON.stringify(savedLayouts.value)
				);
			} catch (localStorageError) {
				console.error(
					"Failed to save layouts to localStorage:",
					localStorageError
				);
			}

			return currentSettings;
		} catch (error) {
			console.error("Failed to save layout:", error);
			throw error;
		}
	};

	// Apply a saved layout
	const applyLayout = async (layoutId, setVideoPosition, setCameraPosition) => {
		try {
			// Find the layout by ID
			const layout = savedLayouts.value.find((l) => l.id === layoutId);

			if (!layout) {
				console.error(`Layout with ID ${layoutId} not found`);
				return false;
			}

			// Apply video and camera positions if callbacks are provided
			try {
				// Apply video position
				if (setVideoPosition && layout.settings.videoPosition) {
					setVideoPosition(layout.settings.videoPosition);
				}

				// Apply camera position - check both direct cameraPosition and position in cameraSettings
				if (setCameraPosition) {
					let cameraPos = null;

					// First try to get the direct camera position
					if (layout.settings.cameraPosition) {
						cameraPos = layout.settings.cameraPosition;
					}
					// If not available, try to get it from camera settings
					else if (
						layout.settings.cameraSettings &&
						layout.settings.cameraSettings.position
					) {
						cameraPos = layout.settings.cameraSettings.position;
					}

					// Apply the camera position if we found one
					if (cameraPos) {
						setCameraPosition(cameraPos);
					} else {
						console.warn("No camera position found in layout settings");
					}
				}
			} catch (positionError) {
				console.error("Error applying positions:", positionError);
			}

			// Apply player settings
			try {
				// Apply basic settings
				if (layout.settings.mouseSize !== undefined) {
					playerSettings.mouseSize.value = layout.settings.mouseSize;
				}

				if (layout.settings.motionBlurValue !== undefined) {
					playerSettings.motionBlurValue.value =
						layout.settings.motionBlurValue;
				}

				if (layout.settings.mouseVisible !== undefined) {
					playerSettings.mouseVisible.value = layout.settings.mouseVisible;
				}

				if (layout.settings.backgroundColor !== undefined) {
					playerSettings.backgroundColor.value =
						layout.settings.backgroundColor;
				}

				if (layout.settings.backgroundImage !== undefined) {
					playerSettings.backgroundImage.value =
						layout.settings.backgroundImage;
				}

				if (layout.settings.backgroundBlur !== undefined) {
					playerSettings.backgroundBlur.value = layout.settings.backgroundBlur;
				}

				if (layout.settings.padding !== undefined) {
					playerSettings.padding.value = layout.settings.padding;
				}

				if (layout.settings.radius !== undefined) {
					playerSettings.radius.value = layout.settings.radius;
				}

				if (layout.settings.shadowSize !== undefined) {
					playerSettings.shadowSize.value = layout.settings.shadowSize;
				}

				if (layout.settings.cropRatio !== undefined) {
					playerSettings.cropRatio.value = layout.settings.cropRatio;
				}

				// Apply canvas size
				if (layout.settings.canvasSize && playerSettings.canvasSize) {
					playerSettings.canvasSize.value = layout.settings.canvasSize;
				}

				// Apply camera settings
				if (layout.settings.cameraSettings && playerSettings.cameraSettings) {
					// Make a copy of the camera settings to avoid reference issues
					const cameraSettingsCopy = JSON.parse(
						JSON.stringify(layout.settings.cameraSettings)
					);

					// If we have a camera position in the settings, make sure it's preserved
					if (layout.settings.cameraPosition && !cameraSettingsCopy.position) {
						cameraSettingsCopy.position = layout.settings.cameraPosition;
					}

					playerSettings.cameraSettings.value = cameraSettingsCopy;
				}

				// Apply video border settings
				if (
					layout.settings.videoBorderSettings &&
					playerSettings.videoBorderSettings
				) {
					playerSettings.videoBorderSettings.value =
						layout.settings.videoBorderSettings;
				}

				// Apply mouse cursor settings
				if (
					layout.settings.mouseCursorSettings &&
					playerSettings.mouseCursorSettings
				) {
					playerSettings.mouseCursorSettings.value =
						layout.settings.mouseCursorSettings;
				}

				// Apply zoom settings
				if (layout.settings.zoomRanges && playerSettings.zoomRanges) {
					// Clear existing zoom ranges
					playerSettings.zoomRanges.value = [];

					// Add saved zoom ranges
					layout.settings.zoomRanges.forEach((range) => {
						playerSettings.zoomRanges.value.push(range);
					});

					// Set current zoom range if it exists
					if (
						layout.settings.currentZoomRange &&
						playerSettings.currentZoomRange
					) {
						playerSettings.currentZoomRange.value =
							layout.settings.currentZoomRange;
					}
				}
			} catch (settingsError) {
				console.error("Error applying player settings:", settingsError);
			}

			return true;
		} catch (error) {
			console.error("Error applying layout:", error);
			return false;
		}
	};

	// Rename a layout
	const renameLayout = async (layoutId, newName) => {
		try {
			const layoutIndex = savedLayouts.value.findIndex(
				(l) => l.id === layoutId
			);
			if (layoutIndex === -1) {
				console.error("Layout not found with ID:", layoutId);
				return false;
			}

			savedLayouts.value[layoutIndex].name = newName;

			// Update localStorage
			try {
				localStorage.setItem(
					"creavit-studio-layouts",
					JSON.stringify(savedLayouts.value)
				);
			} catch (error) {
				console.error("Failed to save layouts after rename:", error);
			}

			return true;
		} catch (error) {
			console.error("Failed to rename layout:", error);
			return false;
		}
	};

	// Delete a layout
	const deleteLayout = async (layoutId) => {
		try {
			const layoutIndex = savedLayouts.value.findIndex(
				(l) => l.id === layoutId
			);
			if (layoutIndex === -1) {
				console.error("Layout not found with ID:", layoutId);
				return false;
			}

			savedLayouts.value.splice(layoutIndex, 1);

			// Update localStorage
			try {
				localStorage.setItem(
					"creavit-studio-layouts",
					JSON.stringify(savedLayouts.value)
				);
			} catch (error) {
				console.error("Failed to save layouts after delete:", error);
			}

			return true;
		} catch (error) {
			console.error("Failed to delete layout:", error);
			return false;
		}
	};

	// Load layouts from localStorage on initialization
	const loadSavedLayouts = async () => {
		try {
			// Try to load from localStorage
			const storedLayouts = localStorage.getItem("creavit-studio-layouts");
			if (storedLayouts) {
				try {
					const layouts = JSON.parse(storedLayouts);
					if (layouts && Array.isArray(layouts)) {
						savedLayouts.value = layouts;
					}
				} catch (error) {
					console.error("Error parsing layouts from localStorage:", error);
					savedLayouts.value = [];
				}
			} else {
				savedLayouts.value = [];
			}
		} catch (error) {
			console.error("Failed to load layouts:", error);
			savedLayouts.value = [];
		}
	};

	// Call load on initialization
	onMounted(() => {
		loadSavedLayouts();
	});

	// Düzenleri dışarıdan ayarla (proje yüklenirken kullanılır)
	const setLayouts = (layouts) => {
		try {
			if (Array.isArray(layouts)) {
				savedLayouts.value = layouts;
				// localStorage'a kaydet
				localStorage.setItem(
					"creavit-studio-layouts",
					JSON.stringify(savedLayouts.value)
				);
				return true;
			} else {
				console.error("Invalid layouts format, expected array:", layouts);
				return false;
			}
		} catch (error) {
			console.error("Error setting layouts:", error);
			return false;
		}
	};

	// Add a new layout range
	const addLayoutRange = (range) => {
		layoutRanges.value.push({
			...range,
			type: currentLayout.value,
		});
	};

	// Remove a layout range
	const removeLayoutRange = (index) => {
		layoutRanges.value.splice(index, 1);
		if (selectedLayoutIndex.value === index) {
			selectedLayoutIndex.value = null;
		}
	};

	// Update a layout range
	const updateLayoutRange = (index, updatedRange) => {
		if (index >= 0 && index < layoutRanges.value.length) {
			layoutRanges.value[index] = {
				...updatedRange,
				type: updatedRange.type || layoutRanges.value[index].type,
			};
		}
	};

	// Set the current layout range
	const setCurrentLayoutRange = (index) => {
		selectedLayoutIndex.value = index;
	};

	// Set the current layout type
	const setCurrentLayoutType = (type) => {
		currentLayout.value = type;
	};

	// Get the current layout at a specific time
	const getCurrentLayoutAtTime = (time) => {
		for (let i = 0; i < layoutRanges.value.length; i++) {
			const range = layoutRanges.value[i];
			if (time >= range.start && time <= range.end) {
				return {
					type: range.type,
					index: i,
				};
			}
		}
		return {
			type: "normal", // Default layout if no range is active
			index: -1,
		};
	};

	// Check if a new range would overlap with existing ranges
	const wouldOverlap = (newRange, excludeIndex = -1) => {
		return layoutRanges.value.some((range, index) => {
			if (index === excludeIndex) return false;
			return newRange.start < range.end && newRange.end > range.start;
		});
	};

	// Available layout types
	const layoutTypes = computed(() => [
		{
			id: "camera-full",
			label: "Full Camera",
			description: "Show only the camera in full width",
		},
		{
			id: "screen-full",
			label: "Full Screen",
			description: "Show only the screen recording in full width",
		},
	]);

	return {
		savedLayouts,
		saveLayout,
		applyLayout,
		renameLayout,
		deleteLayout,
		loadSavedLayouts,
		setLayouts,
		layoutRanges,
		selectedLayoutIndex,
		currentLayout,
		layoutTypes,
		addLayoutRange,
		removeLayoutRange,
		updateLayoutRange,
		setCurrentLayoutRange,
		setCurrentLayoutType,
		getCurrentLayoutAtTime,
		wouldOverlap,
	};
};
