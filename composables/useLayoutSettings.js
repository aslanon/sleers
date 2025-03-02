import { ref, onMounted } from "vue";
import { usePlayerSettings } from "./usePlayerSettings";

// Store saved layouts
const savedLayouts = ref([]);

export const useLayoutSettings = () => {
	const playerSettings = usePlayerSettings();
	const electron = window.electron;

	// Save current settings as a layout
	const saveLayout = async (
		name,
		videoPos,
		cameraPos,
		additionalSettings = {}
	) => {
		console.log("Saving layout with name:", name);
		console.log("Video position:", videoPos);
		console.log("Camera position:", cameraPos);
		console.log("Additional settings:", additionalSettings);

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
									position: { x: 0, y: 0 }, // Camera position
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

			// Add to saved layouts
			savedLayouts.value.push(currentSettings);

			// Save to localStorage for web
			try {
				localStorage.setItem(
					"sleer-layouts",
					JSON.stringify(savedLayouts.value)
				);
				console.log("Layouts saved to localStorage");
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
			console.log(`Applying layout with ID: ${layoutId}`);

			// Find the layout by ID
			const layout = savedLayouts.value.find((l) => l.id === layoutId);

			if (!layout) {
				console.error(`Layout with ID ${layoutId} not found`);
				return false;
			}

			console.log(`Found layout: ${layout.name}`);

			// Apply video and camera positions if callbacks are provided
			try {
				if (setVideoPosition && layout.settings.videoPosition) {
					console.log(
						`Setting video position to:`,
						layout.settings.videoPosition
					);
					setVideoPosition(layout.settings.videoPosition);
				}

				if (setCameraPosition && layout.settings.cameraPosition) {
					console.log(
						`Setting camera position to:`,
						layout.settings.cameraPosition
					);
					setCameraPosition(layout.settings.cameraPosition);
				}
			} catch (positionError) {
				console.error("Error applying positions:", positionError);
			}

			// Apply player settings
			try {
				console.log("Applying player settings...");

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
					console.log("Setting canvas size to:", layout.settings.canvasSize);
					playerSettings.canvasSize.value = layout.settings.canvasSize;
				}

				// Apply camera settings
				if (layout.settings.cameraSettings && playerSettings.cameraSettings) {
					console.log(
						"Setting camera settings to:",
						layout.settings.cameraSettings
					);
					playerSettings.cameraSettings.value = layout.settings.cameraSettings;
				}

				// Apply video border settings
				if (
					layout.settings.videoBorderSettings &&
					playerSettings.videoBorderSettings
				) {
					console.log(
						"Setting video border to:",
						layout.settings.videoBorderSettings
					);
					playerSettings.videoBorderSettings.value =
						layout.settings.videoBorderSettings;
				}

				// Apply mouse cursor settings
				if (
					layout.settings.mouseCursorSettings &&
					playerSettings.mouseCursorSettings
				) {
					console.log(
						"Setting mouse cursor to:",
						layout.settings.mouseCursorSettings
					);
					playerSettings.mouseCursorSettings.value =
						layout.settings.mouseCursorSettings;
				}

				// Apply zoom settings
				if (layout.settings.zoomRanges && playerSettings.zoomRanges) {
					console.log("Setting zoom ranges");
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

				console.log("Player settings applied successfully");
			} catch (settingsError) {
				console.error("Error applying player settings:", settingsError);
			}

			console.log(`Layout "${layout.name}" applied successfully`);
			return true;
		} catch (error) {
			console.error("Error applying layout:", error);
			return false;
		}
	};

	// Rename a layout
	const renameLayout = async (layoutId, newName) => {
		console.log("Renaming layout", layoutId, "to", newName);

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
					"sleer-layouts",
					JSON.stringify(savedLayouts.value)
				);
				console.log("Layouts saved to localStorage after rename");
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
		console.log("Deleting layout", layoutId);

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
					"sleer-layouts",
					JSON.stringify(savedLayouts.value)
				);
				console.log("Layouts saved to localStorage after delete");
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
		console.log("Loading saved layouts...");

		try {
			// Try to load from localStorage
			const storedLayouts = localStorage.getItem("sleer-layouts");
			if (storedLayouts) {
				try {
					const layouts = JSON.parse(storedLayouts);
					if (layouts && Array.isArray(layouts)) {
						savedLayouts.value = layouts;
						console.log(
							"Loaded layouts:",
							savedLayouts.value.map((l) => l.name).join(", ")
						);
					}
				} catch (error) {
					console.error("Error parsing layouts from localStorage:", error);
					savedLayouts.value = [];
				}
			} else {
				console.log("No saved layouts found in localStorage");
				savedLayouts.value = [];
			}
		} catch (error) {
			console.error("Failed to load layouts:", error);
			savedLayouts.value = [];
		}
	};

	// Call load on initialization
	onMounted(() => {
		console.log("useLayoutSettings mounted, loading saved layouts");
		loadSavedLayouts();
	});

	return {
		savedLayouts,
		saveLayout,
		applyLayout,
		renameLayout,
		deleteLayout,
		loadSavedLayouts,
	};
};
