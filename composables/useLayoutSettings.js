import { ref, onMounted } from "vue";
import { usePlayerSettings } from "./usePlayerSettings";

// Store saved layouts
const savedLayouts = ref([]);

export const useLayoutSettings = () => {
	const playerSettings = usePlayerSettings();
	const electron = window.electron;

	// Save current settings as a layout
	const saveLayout = async (name, videoPos, cameraPos) => {
		console.log("Saving layout with name:", name);
		console.log("Video position:", videoPos);
		console.log("Camera position:", cameraPos);

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
					zoomRanges: JSON.parse(
						JSON.stringify(playerSettings.zoomRanges.value || [])
					),
					currentZoomRange: playerSettings.currentZoomRange.value
						? JSON.parse(JSON.stringify(playerSettings.currentZoomRange.value))
						: null,
					cameraSettings: JSON.parse(
						JSON.stringify(playerSettings.cameraSettings.value || {})
					),
					videoBorderSettings: JSON.parse(
						JSON.stringify(playerSettings.videoBorderSettings.value || {})
					),
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
	const applyLayout = (layoutId, setVideoPosition, setCameraPosition) => {
		try {
			console.log("Applying layout with ID:", layoutId);

			// Find the layout by ID
			const layout = savedLayouts.value.find((l) => l.id === layoutId);
			if (!layout) {
				console.error("Layout not found with ID:", layoutId);
				return false;
			}

			console.log("Found layout:", layout.name);
			const { settings } = layout;

			// Apply video and camera positions if callbacks are provided
			if (typeof setVideoPosition === "function" && settings.videoPosition) {
				console.log("Applying video position:", settings.videoPosition);
				setVideoPosition(settings.videoPosition);
			}

			if (typeof setCameraPosition === "function" && settings.cameraPosition) {
				console.log("Applying camera position:", settings.cameraPosition);
				setCameraPosition(settings.cameraPosition);
			}

			// Apply all settings
			playerSettings.updateMouseSize(settings.mouseSize);
			playerSettings.updateMotionBlur(settings.motionBlurValue);
			playerSettings.updateMouseVisible(settings.mouseVisible);
			playerSettings.updateBackgroundColor(settings.backgroundColor);
			playerSettings.updateBackgroundImage(settings.backgroundImage);
			playerSettings.updateBackgroundBlur(settings.backgroundBlur);
			playerSettings.updatePadding(settings.padding);
			playerSettings.updateRadius(settings.radius);
			playerSettings.updateShadowSize(settings.shadowSize);
			playerSettings.updateCropRatio(settings.cropRatio);

			// Clear existing zoom ranges and add saved ones
			playerSettings.zoomRanges.value = [];
			settings.zoomRanges.forEach((range) => {
				playerSettings.addZoomRange(range);
			});

			// Set current zoom range if exists
			if (settings.currentZoomRange) {
				playerSettings.setCurrentZoomRange(settings.currentZoomRange);
			}

			// Update camera settings
			playerSettings.updateCameraSettings(settings.cameraSettings);

			// Update video border settings
			playerSettings.updateVideoBorderSettings(settings.videoBorderSettings);

			console.log("Layout applied successfully");
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
