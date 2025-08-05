import { ref, reactive, watch, computed } from "vue";
import { usePlayerSettings } from "./usePlayerSettings";

// Undo/Redo callback
let undoRedoCallback = null;

const setUndoRedoCallback = (callback) => {
	undoRedoCallback = callback;
};

const triggerUndoRedoSave = (actionType, description) => {
	if (undoRedoCallback) {
		undoRedoCallback(actionType, description);
	}
};

const searchQuery = ref("");
const searchResults = ref([]);
const activeGifs = ref([]);
const selectedGifId = ref(null);
const isSearching = ref(false);
const giphyApiKey = "DCabEPYut33Xk4DzYdL44AXsRcUAKjPp";

// GIF state management
const gifStates = reactive(new Map());

// Drag and interaction state
const dragState = reactive({
	isDragging: false,
	draggedGifId: null,
	startX: 0,
	startY: 0,
	offsetX: 0,
	offsetY: 0,
	isResizing: false,
	isRotating: false,
	resizeHandle: null, // 'nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'
	originalRotation: 0,
	elementCenterX: 0,
	elementCenterY: 0,
});

export const useGifManager = () => {
	// Search GIFs using Giphy API
	const searchGifs = async () => {
		if (!searchQuery.value.trim()) return;

		isSearching.value = true;
		try {
			console.log("Searching for GIFs with query:", searchQuery.value);

			// Use Giphy API through IPC for security
			if (typeof window !== "undefined" && window.electronAPI) {
				console.log("Using IPC for GIF search...");
				const data = await window.electronAPI.invoke(
					"search-gifs",
					searchQuery.value
				);
				console.log("Giphy API response:", data);

				searchResults.value = data.data || [];
				console.log(
					"GIF search completed, found",
					searchResults.value.length,
					"GIFs"
				);
			} else {
				// Fallback for non-electron environments
				console.log("Using fetch fallback for GIF search...");
				const response = await fetch(
					`https://api.giphy.com/v1/stickers/search?api_key=${giphyApiKey}&q=${encodeURIComponent(
						searchQuery.value
					)}&limit=12&offset=0&rating=g&lang=en`
				);

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const data = await response.json();
				console.log("Giphy API response:", data);

				searchResults.value = data.data || [];
				console.log(
					"GIF search completed, found",
					searchResults.value.length,
					"GIFs"
				);
			}
		} catch (error) {
			console.error("Error searching GIFs:", error);
			searchResults.value = [];

			// Show user-friendly error message
			if (typeof window !== "undefined") {
				console.warn("GIF search failed, falling back to empty results");
			}
		} finally {
			isSearching.value = false;
		}
	};

	// Add GIF or Image to canvas with unique ID and timeline segment
	const addGifToCanvas = (gifData, videoDuration = null) => {
		// Check if it's a copied GIF (already processed)
		const isCopiedGif = gifData.url && !gifData.images && (gifData.type === "gif" || !gifData.type);
		
		// Always generate new unique ID for copied GIFs to avoid conflicts
		const shouldGenerateNewId = isCopiedGif || gifData.id?.includes('copied_') || gifData.isCopy;
		const gifId = shouldGenerateNewId
			? `gif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
			: gifData.id || `gif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			
		// Debug: Log GIF processing for copied elements
		if (shouldGenerateNewId) {
			console.log('[addGifToCanvas] Creating new GIF with unique ID:', gifId, 'from original:', gifData.id);
		}
		
		// Check if it's an image or video (not a GIF)
		const isImage = gifData.type === "image";
		const isVideo = gifData.type === "video";

		// Default duration: video duration if available, otherwise 10 seconds
		const defaultDuration = videoDuration || 10;

		let newGif;

		if (isCopiedGif || gifData.isCopy) {
			// Handle copied GIFs (already processed)
			const cleanedGifData = { ...gifData };
			// Remove copy-specific properties to avoid confusion
			delete cleanedGifData.isCopy;
			delete cleanedGifData.originalId;
			
			newGif = {
				...cleanedGifData, // Copy all existing properties
				id: gifId,  // Use new unique ID
			};
		} else if (isImage) {
			// Handle image files
			newGif = {
				id: gifId,
				title: gifData.title || "Untitled Image",
				url: gifData.url,
				type: "image",
				width: gifData.width || 200,
				height: gifData.height || 150,
				x: gifData.x || 100,
				y: gifData.y || 100,
				opacity: gifData.opacity || 1,
				startTime: gifData.startTime || 0,
				endTime: gifData.endTime || 10, // Image için sabit 10 saniye
				file: gifData.file,
				originalUrl: gifData.url,
				webpUrl: gifData.url,
				mp4Url: gifData.url,
				originalWidth: gifData.originalWidth,
				originalHeight: gifData.originalHeight,
				aspectRatio: gifData.aspectRatio,
				rotation: 0, // Default rotation
			};
		} else if (isVideo) {
			// Handle video files
			newGif = {
				id: gifId,
				title: gifData.title || "Untitled Video",
				url: gifData.url,
				type: "video",
				width: gifData.width || 400,
				height: gifData.height || 300,
				x: gifData.x || 100,
				y: gifData.y || 100,
				opacity: gifData.opacity || 1,
				startTime: gifData.startTime || 0,
				endTime: gifData.endTime || defaultDuration, // Video için kendi duration'ı, yoksa defaultDuration
				file: gifData.file,
				originalUrl: gifData.url,
				webpUrl: gifData.url,
				mp4Url: gifData.url,
				originalWidth: gifData.originalWidth,
				originalHeight: gifData.originalHeight,
				aspectRatio: gifData.aspectRatio,
				duration: gifData.duration || 0,
				rotation: 0, // Default rotation
			};
		} else {
			// Handle GIFs from Giphy
			// Get original dimensions and scale them up while maintaining aspect ratio
			const originalWidth = parseInt(gifData.images.fixed_width.width) || 200;
			const originalHeight = parseInt(gifData.images.fixed_width.height) || 200;

			// Scale factor to make GIFs bigger by default (1.5x larger)
			const scaleFactor = 1.5;
			const scaledWidth = originalWidth * scaleFactor;
			const scaledHeight = originalHeight * scaleFactor;

			newGif = {
				id: gifId,
				title: gifData.title || "Untitled GIF",
				url: gifData.images.fixed_width.url,
				type: "gif",
				originalUrl: gifData.images.original.url,
				webpUrl: gifData.images.fixed_width.webp,
				mp4Url: gifData.images.fixed_width.mp4,
				width: scaledWidth,
				height: scaledHeight,
				x: gifData.x || 100,
				y: gifData.y || 100,
				opacity: 1,
				startTime: 0,
				endTime: 10, // GIF'ler için sabit 10 saniye
				isSelected: false,
				isDragging: false,
				isResizing: false,
				rotation: 0, // Default rotation
				giphyData: gifData, // Store original Giphy data
			};
		}

		activeGifs.value.push(newGif);
		
		// Trigger undo/redo save
		triggerUndoRedoSave('GIF_ADD', `Added ${newGif.type || 'GIF'}: ${newGif.title || 'Untitled'}`);

		// Create GIF state for animation tracking - initially paused
		const frameRate = isVideo ? 240 : 60; // Much higher frame rate for videos
		gifStates.set(gifId, {
			currentFrame: 0,
			lastFrameTime: 0,
			frameRate: frameRate, // Dynamic frame rate based on type
			isPlaying: false, // Start paused, will be controlled by canvas play state
			videoStartTime: isVideo ? 0 : null, // Track video start time
			videoDuration: isVideo ? gifData.duration || 10 : null, // Track video duration
			playbackRate: isVideo ? 1.0 : 1.0, // Normal playback rate
			lastUpdateTime: 0, // Track last update for smooth animation
		});

		// Auto-select the newly added GIF
		selectGif(gifId);

		// Emit event to timeline component to create segment
		if (typeof window !== "undefined") {
			// Debounce event dispatch to prevent excessive updates
			if (window.gifEventTimeout) {
				clearTimeout(window.gifEventTimeout);
			}
			window.gifEventTimeout = setTimeout(() => {
				window.dispatchEvent(
					new CustomEvent("gif-added", {
						detail: { gif: newGif },
					})
				);
			}, 50);
		}

		// Save state for undo/redo
		const actionType = isCopiedGif ? 'GIF_PASTE' : 'GIF_ADD';
		const description = isCopiedGif ? `Pasted ${newGif.title || 'GIF'}` : `Added ${newGif.title || 'GIF'}`;
		triggerUndoRedoSave(actionType, description);

		return newGif;
	};

	// Remove GIF from canvas and timeline
	const removeGif = (gifId) => {
		const index = activeGifs.value.findIndex((gif) => gif.id === gifId);
		if (index !== -1) {
			const removedGif = activeGifs.value[index];
			
			activeGifs.value.splice(index, 1);
			gifStates.delete(gifId);

			if (selectedGifId.value === gifId) {
				selectedGifId.value = null;
			}

			// Save state for undo/redo
			triggerUndoRedoSave('GIF_REMOVE', `Removed ${removedGif.title || 'GIF'}`);

			// Emit event to timeline component to remove segment
			if (typeof window !== "undefined") {
				// Debounce event dispatch to prevent excessive updates
				if (window.gifEventTimeout) {
					clearTimeout(window.gifEventTimeout);
				}
				window.gifEventTimeout = setTimeout(() => {
					window.dispatchEvent(
						new CustomEvent("gif-removed", {
							detail: { gifId },
						})
					);
				}, 50);
			}
		}
	};

	// Select GIF for editing
	const selectGif = (gifId) => {
		console.log('[selectGif] Selecting GIF:', gifId);
		
		// Deselect all other GIFs
		activeGifs.value.forEach((gif) => {
			gif.isSelected = gif.id === gifId;
		});

		selectedGifId.value = gifId;

		// DON'T clear handle data - let it persist for better re-selection
		// The handles will be recalculated naturally on next render

		// Emit selection event immediately without debouncing for faster response
		if (typeof window !== "undefined") {
			window.dispatchEvent(
				new CustomEvent("gif-selected", {
					detail: { gifId },
				})
			);
		}
		
		console.log('[selectGif] Selected GIF ID set to:', selectedGifId.value);
	};

	// Update GIF position
	const updateGifPosition = () => {
		const selectedGif = activeGifs.value.find(
			(gif) => gif.id === selectedGifId.value
		);
		if (selectedGif) {
			// Emit position update event
			if (typeof window !== "undefined") {
				window.dispatchEvent(
					new CustomEvent("gif-position-updated", {
						detail: {
							gifId: selectedGif.id,
							x: selectedGif.x,
							y: selectedGif.y,
						},
					})
				);
			}
		}
	};

	// Update GIF size
	const updateGifSize = () => {
		const selectedGif = activeGifs.value.find(
			(gif) => gif.id === selectedGifId.value
		);
		if (selectedGif) {
			// Emit size update event
			if (typeof window !== "undefined") {
				window.dispatchEvent(
					new CustomEvent("gif-size-updated", {
						detail: {
							gifId: selectedGif.id,
							width: selectedGif.width,
							height: selectedGif.height,
						},
					})
				);
			}
		}
	};

	// Update GIF opacity
	const updateGifOpacity = () => {
		const selectedGif = activeGifs.value.find(
			(gif) => gif.id === selectedGifId.value
		);
		if (selectedGif) {
			// Emit opacity update event
			if (typeof window !== "undefined") {
				window.dispatchEvent(
					new CustomEvent("gif-opacity-updated", {
						detail: {
							gifId: selectedGif.id,
							opacity: selectedGif.opacity,
						},
					})
				);
			}
		}
	};

	// Update GIF timing
	const updateGifTiming = () => {
		const selectedGif = activeGifs.value.find(
			(gif) => gif.id === selectedGifId.value
		);
		if (selectedGif) {
			// Emit timing update event
			if (typeof window !== "undefined") {
				window.dispatchEvent(
					new CustomEvent("gif-timing-updated", {
						detail: {
							gifId: selectedGif.id,
							startTime: selectedGif.startTime,
							endTime: selectedGif.endTime,
						},
					})
				);
			}
		}
	};

	// Update GIF rotation
	const updateGifRotation = () => {
		// Trigger canvas update to reflect rotation changes
		if (typeof window !== "undefined") {
			window.dispatchEvent(new CustomEvent("gifRotationUpdated"));
		}
	};

	// Get GIF at specific time
	const getGifsAtTime = (currentTime) => {
		return activeGifs.value.filter(
			(gif) => currentTime >= gif.startTime && currentTime <= gif.endTime
		);
	};

	// Handle GIF click on canvas
	const handleGifClick = (event, canvasRect) => {
		const dpr = 1;
		const scaleValue = 3; // Match MediaPlayer scale value

		const x = (event.clientX - canvasRect.left) * dpr * scaleValue;
		const y = (event.clientY - canvasRect.top) * dpr * scaleValue;

		// Check for rotate zone clicks first (highest priority) - diagonal rotation zones
		if (
			typeof window !== "undefined" &&
			window.gifRotateZones &&
			window.gifRotateZones.size > 0
		) {
			for (const [gifId, rotateInfo] of window.gifRotateZones.entries()) {
				// Calculate distance from rotation zone center
				const distanceFromRotateZone = Math.sqrt(
					Math.pow(x - rotateInfo.centerX, 2) +
						Math.pow(y - rotateInfo.centerY, 2)
				);

				const rotateZoneRadius = 12 * dpr * scaleValue; // Rotation zone radius

				// Check if click is in rotate zone
				if (distanceFromRotateZone <= rotateZoneRadius) {
					const gif = activeGifs.value.find((g) => g.id === gifId);
					if (gif) {
						selectGif(gifId);

						// Start rotate operation
						dragState.isRotating = true;
						dragState.draggedGifId = gifId;
						dragState.startX = x;
						dragState.startY = y;

						// Store original rotation and element center (use actual element center, not rotateInfo center)
						dragState.originalRotation = gif.rotation || 0;
						dragState.elementCenterX =
							gif.x * dpr * scaleValue + (gif.width * dpr * scaleValue) / 2;
						dragState.elementCenterY =
							gif.y * dpr * scaleValue + (gif.height * dpr * scaleValue) / 2;

						// Add mouse move and up listeners
						document.addEventListener("mousemove", handleMouseMove);
						document.addEventListener("mouseup", handleMouseUp);

						return gif;
					}
				}
			}
		}

		// Check for transform handle clicks (higher priority)
		if (
			typeof window !== "undefined" &&
			window.gifHandleData &&
			window.gifHandleData.size > 0
		) {
			for (const [gifId, handleData] of window.gifHandleData.entries()) {
				const handles = handleData.handles;

				if (handles && handles.length > 0) {
					// Check each transform handle
					for (const handle of handles) {
						if (
							x >= handle.x &&
							x <= handle.x + handle.width &&
							y >= handle.y &&
							y <= handle.y + handle.height
						) {
							const gif = activeGifs.value.find((g) => g.id === gifId);
							if (gif) {
								selectGif(gifId);

								// Start resize operation with the specific handle type
								dragState.isResizing = true;
								dragState.draggedGifId = gifId;
								dragState.resizeHandle = handle.type; // nw, ne, se, sw, n, e, s, w
								dragState.startX = x;
								dragState.startY = y;

								// Store original dimensions in CANVAS coordinates for natural movement
								const dpr = 1;
								const scaleValue = 3;
								dragState.originalWidth = gif.width * dpr * scaleValue;
								dragState.originalHeight = gif.height * dpr * scaleValue;
								dragState.originalX = gif.x * dpr * scaleValue;
								dragState.originalY = gif.y * dpr * scaleValue;
								
								// Store handle offset for natural resize behavior
								dragState.handleOffsetX = x - handle.x;
								dragState.handleOffsetY = y - handle.y;

								// Add mouse move and up listeners
								document.addEventListener("mousemove", handleMouseMove);
								document.addEventListener("mouseup", handleMouseUp);

								return gif;
							}
						}
					}
				}
			}
		}

		// Find clicked GIF (check from top to bottom - reverse order for z-index)
		const clickedGif = [...activeGifs.value].reverse().find((gif) => {
			const gifX = gif.x * dpr * scaleValue;
			const gifY = gif.y * dpr * scaleValue;
			const gifWidth = gif.width * dpr * scaleValue;
			const gifHeight = gif.height * dpr * scaleValue;

			return (
				x >= gifX && x <= gifX + gifWidth && y >= gifY && y <= gifY + gifHeight
			);
		});

		if (clickedGif) {
			selectGif(clickedGif.id);

			// Start drag for the clicked GIF
			const gifX = clickedGif.x * dpr * scaleValue;
			const gifY = clickedGif.y * dpr * scaleValue;

			dragState.isDragging = true;
			dragState.draggedGifId = clickedGif.id;
			dragState.startX = x;
			dragState.startY = y;
			dragState.offsetX = x - gifX;
			dragState.offsetY = y - gifY;

			// Add mouse move and up listeners
			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);

			return clickedGif;
		}

		// No GIF clicked - return null without clearing selections
		console.log('[handleGifClick] No GIF clicked');
		return null;
	};

	// Helper function to get normalized coordinates
	const getNormalizedCoordinates = (event) => {
		const canvas = document.querySelector("#canvasID");
		if (!canvas) return null;

		const rect = canvas.getBoundingClientRect();
		const dpr = 1;
		const scaleValue = 3;
		
		return {
			x: (event.clientX - rect.left) * dpr * scaleValue,
			y: (event.clientY - rect.top) * dpr * scaleValue,
			dpr,
			scaleValue,
			rect
		};
	};

	// Mouse event handlers for drag, resize and rotate - optimized for smooth performance
	const handleMouseMove = (event) => {
		if (!dragState.isDragging && !dragState.isResizing && !dragState.isRotating)
			return;

		const coords = getNormalizedCoordinates(event);
		if (!coords) return;

		// Find the GIF being manipulated once
		const gif = activeGifs.value.find((g) => g.id === dragState.draggedGifId);
		if (!gif) return;

		if (dragState.isDragging) {
			// Natural 1:1 dragging - mouse position directly controls element position
			const newX = (coords.x - dragState.offsetX) / (coords.dpr * coords.scaleValue);
			const newY = (coords.y - dragState.offsetY) / (coords.dpr * coords.scaleValue);
			
			// Immediate position update for natural feel - no rounding for smooth movement
			gif.x = newX;
			gif.y = newY;

			// Immediate update without throttling for 1:1 mouse sync
			updateGifPosition();
		} else if (dragState.isResizing) {
			// Natural resize handling with immediate feedback
			handleGifResize(
				gif,
				event.clientX,
				event.clientY,
				dragState.resizeHandle
			);
			
			// Immediate updates for natural feel
			updateGifPosition();
			updateGifSize();
		} else if (dragState.isRotating) {
			// Natural rotation - calculate angle from center to current mouse position
			const deltaX = coords.x - dragState.elementCenterX;
			const deltaY = coords.y - dragState.elementCenterY;
			const currentAngle = Math.atan2(deltaY, deltaX);

			// Calculate the initial angle when rotation started
			const startDeltaX = dragState.startX - dragState.elementCenterX;
			const startDeltaY = dragState.startY - dragState.elementCenterY;
			const startAngle = Math.atan2(startDeltaY, startDeltaX);

			// Calculate the rotation difference in degrees
			let rotationDelta = (currentAngle - startAngle) * (180 / Math.PI);

			// Apply smooth natural rotation
			const newRotation = dragState.originalRotation + rotationDelta;
			
			// Normalize to 0-360 range
			let normalizedRotation = newRotation % 360;
			if (normalizedRotation < 0) normalizedRotation += 360;

			// Apply rotation with 5-degree snapping for more natural feel
			gif.rotation = Math.round(normalizedRotation / 5) * 5;

			// Immediate update for natural responsiveness
			updateGifRotation();
		}

		// Force immediate canvas update for smooth visual feedback during interaction
		if (typeof window !== "undefined") {
			window.dispatchEvent(new CustomEvent("gif-transform-update"));
		}
	};

	const handleMouseUp = () => {
		if (dragState.isDragging || dragState.isResizing || dragState.isRotating) {
			// Save state for undo/redo before resetting
			const draggedGif = activeGifs.value.find(gif => gif.id === dragState.draggedGifId);
			if (draggedGif) {
				if (dragState.isDragging) {
					triggerUndoRedoSave('GIF_MOVE', `Moved ${draggedGif.title || 'GIF'}`);
				} else if (dragState.isResizing) {
					triggerUndoRedoSave('GIF_RESIZE', `Resized ${draggedGif.title || 'GIF'}`);
				} else if (dragState.isRotating) {
					triggerUndoRedoSave('GIF_ROTATE', `Rotated ${draggedGif.title || 'GIF'}`);
				}
			}
			
			// Reset drag state
			dragState.isDragging = false;
			dragState.isResizing = false;
			dragState.isRotating = false;
			dragState.draggedGifId = null;
			dragState.resizeHandle = null;
			dragState.originalRotation = 0;
			dragState.elementCenterX = 0;
			dragState.elementCenterY = 0;
			dragState.handleOffsetX = 0;
			dragState.handleOffsetY = 0;

			// Clear rotate zones
			if (typeof window !== "undefined" && window.gifRotateZones) {
				window.gifRotateZones.clear();
			}

			// DON'T clear handle data - let it persist for stable re-selection

			// Clear throttle flags to prevent stale state
			if (typeof window !== "undefined") {
				window.gifUpdateThrottle = false;
				window.gifRotateThrottle = false;
				window.gifSizeThrottle = false;
				window.gifResizeThrottle = false;
				window.transformUpdatePending = false;
			}

			// Remove event listeners immediately to prevent conflicts
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);

			// Force canvas update to refresh handles
			if (typeof window !== "undefined") {
				// Immediate update to refresh handle positions
				window.dispatchEvent(new CustomEvent("gif-interaction-ended"));

				// Additional update after a short delay to ensure stability
				setTimeout(() => {
					window.dispatchEvent(new CustomEvent("gif-handles-refresh"));
				}, 100);

				// Final update to ensure everything is synchronized
				setTimeout(() => {
					window.dispatchEvent(new CustomEvent("gif-handles-refresh"));
				}, 300);
			}
		}
	};

	// Handle GIF drag (legacy method for compatibility)
	const handleGifDrag = (gifId, deltaX, deltaY) => {
		const gif = activeGifs.value.find((g) => g.id === gifId);
		if (gif) {
			// Remove canvas boundaries - allow GIFs/images to go outside canvas
			gif.x = gif.x + deltaX;
			gif.y = gif.y + deltaY;
			updateGifPosition();
		}
	};

	// Handle GIF rotate based on mouse position
	const handleGifRotate = (gif, mouseX, mouseY) => {
		if (!gif) return;

		const dpr = 1;
		const scaleValue = 3; // Match MediaPlayer scale value

		// Get canvas bounds
		const canvas = document.querySelector("#canvasID");
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();

		// Calculate GIF center in canvas coordinates
		const gifCenterX =
			gif.x * dpr * scaleValue + (gif.width * dpr * scaleValue) / 2;
		const gifCenterY =
			gif.y * dpr * scaleValue + (gif.height * dpr * scaleValue) / 2;

		// Calculate mouse position in canvas coordinates
		const mouseXCanvas = (mouseX - rect.left) * dpr * scaleValue;
		const mouseYCanvas = (mouseY - rect.top) * dpr * scaleValue;

		// Calculate distance from center to determine rotation speed
		const deltaX = mouseXCanvas - gifCenterX;
		const deltaY = mouseYCanvas - gifCenterY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

		// Minimum distance threshold to start rotation
		const minDistance = 30 * dpr; // Reduced for more responsive rotation

		if (distance < minDistance) {
			return; // Don't rotate if too close to center
		}

		// Store initial mouse position for first click to prevent sudden rotation
		if (!dragState.initialMouseX) {
			dragState.initialMouseX = mouseXCanvas;
			dragState.initialMouseY = mouseYCanvas;
			return; // Skip first frame to prevent sudden rotation
		}

		// Calculate the angle from the previous mouse position to current position
		// This creates a more natural rotation based on mouse movement direction
		const prevDeltaX = dragState.initialMouseX - gifCenterX;
		const prevDeltaY = dragState.initialMouseY - gifCenterY;

		// Calculate the angle change based on mouse movement
		const prevAngle = Math.atan2(prevDeltaY, prevDeltaX);
		const currentAngle = Math.atan2(deltaY, deltaX);

		// Calculate the angle difference (rotation amount)
		let angleDiff = currentAngle - prevAngle;

		// Handle angle wrapping for smooth rotation
		if (angleDiff > Math.PI) {
			angleDiff -= 2 * Math.PI;
		} else if (angleDiff < -Math.PI) {
			angleDiff += 2 * Math.PI;
		}

		// Convert to degrees
		const rotationDegrees = angleDiff * (180 / Math.PI);

		// Apply smooth rotation with lerp
		const currentRotation = gif.rotation || 0;
		const lerpFactor = 0.3; // Increased for more responsive rotation

		// Apply the rotation change
		gif.rotation = currentRotation + rotationDegrees * lerpFactor;

		// Update the initial mouse position for next frame
		dragState.initialMouseX = mouseXCanvas;
		dragState.initialMouseY = mouseYCanvas;

		// Update GIF rotation
		updateGifRotation();
	};

	// Handle GIF resize with Figma-like natural movement
	const handleGifResize = (gif, mouseX, mouseY, handleType) => {
		if (!gif || !handleType) return;

		const dpr = 1;
		const minSize = 20;

		const canvas = document.getElementById("canvasID");
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const scaleValue = 3; // Match MediaPlayer scale value

		// Current mouse position in canvas coordinates (matching the coordinate system)
		const currentMouseX = (mouseX - rect.left) * dpr * scaleValue;
		const currentMouseY = (mouseY - rect.top) * dpr * scaleValue;

		// Convert original dimensions to canvas coordinates for calculations
		const origX = dragState.originalX;
		const origY = dragState.originalY;
		const origW = dragState.originalWidth;
		const origH = dragState.originalHeight;

		// Calculate the position where mouse should be for natural movement
		// This makes the element move naturally with the mouse like in Figma
		let newX = origX;
		let newY = origY;
		let newW = origW;
		let newH = origH;

		// Calculate aspect ratio from original dimensions
		const aspectRatio = origW / origH;

		switch (handleType) {
			case "nw": // Top-left corner - maintain aspect ratio
				{
					// Calculate potential new dimensions
					const potentialW = Math.max(minSize, origX + origW - currentMouseX);
					const potentialH = Math.max(minSize, origY + origH - currentMouseY);

					// Choose the dimension that gives the smaller scale to maintain aspect ratio
					const scaleFromW = potentialW / origW;
					const scaleFromH = potentialH / origH;
					const scale = Math.min(scaleFromW, scaleFromH);

					// Apply scale to both dimensions to maintain aspect ratio
					newW = Math.max(minSize, origW * scale);
					newH = Math.max(minSize, origH * scale);

					// Position to keep bottom-right corner fixed
					newX = origX + origW - newW;
					newY = origY + origH - newH;
				}
				break;

			case "ne": // Top-right corner - maintain aspect ratio
				{
					const potentialW = Math.max(minSize, currentMouseX - origX);
					const potentialH = Math.max(minSize, origY + origH - currentMouseY);

					const scaleFromW = potentialW / origW;
					const scaleFromH = potentialH / origH;
					const scale = Math.min(scaleFromW, scaleFromH);

					newW = Math.max(minSize, origW * scale);
					newH = Math.max(minSize, origH * scale);

					// Position to keep bottom-left corner fixed
					newX = origX;
					newY = origY + origH - newH;
				}
				break;

			case "se": // Bottom-right corner - maintain aspect ratio
				{
					const potentialW = Math.max(minSize, currentMouseX - origX);
					const potentialH = Math.max(minSize, currentMouseY - origY);

					const scaleFromW = potentialW / origW;
					const scaleFromH = potentialH / origH;
					const scale = Math.min(scaleFromW, scaleFromH);

					newW = Math.max(minSize, origW * scale);
					newH = Math.max(minSize, origH * scale);

					// Position to keep top-left corner fixed
					newX = origX;
					newY = origY;
				}
				break;

			case "sw": // Bottom-left corner - maintain aspect ratio
				{
					const potentialW = Math.max(minSize, origX + origW - currentMouseX);
					const potentialH = Math.max(minSize, currentMouseY - origY);

					const scaleFromW = potentialW / origW;
					const scaleFromH = potentialH / origH;
					const scale = Math.min(scaleFromW, scaleFromH);

					newW = Math.max(minSize, origW * scale);
					newH = Math.max(minSize, origH * scale);

					// Position to keep top-right corner fixed
					newX = origX + origW - newW;
					newY = origY;
				}
				break;

			case "n": // Top edge
				newH = Math.max(minSize, origY + origH - currentMouseY);
				newY = currentMouseY;
				if (newH < minSize) {
					newY = origY + origH - minSize;
					newH = minSize;
				}
				break;

			case "e": // Right edge
				newW = Math.max(minSize, currentMouseX - origX);
				break;

			case "s": // Bottom edge
				newH = Math.max(minSize, currentMouseY - origY);
				break;

			case "w": // Left edge
				newW = Math.max(minSize, origX + origW - currentMouseX);
				newX = currentMouseX;
				if (newW < minSize) {
					newX = origX + origW - minSize;
					newW = minSize;
				}
				break;

			default:
				return;
		}

		// Apply the new values for natural movement
		// Convert back from canvas coordinates to gif coordinates
		gif.x = newX / (dpr * scaleValue);
		gif.y = newY / (dpr * scaleValue);
		gif.width = newW / (dpr * scaleValue);
		gif.height = newH / (dpr * scaleValue);

		// Immediate size update for natural feel - no throttling
		updateGifSize();
	};

	// Legacy resize function for compatibility
	const handleGifResizeLegacy = (gifId, newWidth, newHeight) => {
		const gif = activeGifs.value.find((g) => g.id === gifId);
		if (gif) {
			// Remove size constraints - allow unlimited resizing
			gif.width = newWidth;
			gif.height = newHeight;
			updateGifSize();
		}
	};

	// Handle keyboard events (delete selected GIF)
	const handleKeyDown = (event) => {
		if (event.key === "Backspace" || event.key === "Delete") {
			if (selectedGifId.value) {
				removeGif(selectedGifId.value);
			}
		}
	};

	// Get GIF render data for canvas
	const getGifRenderData = (gifId, currentTime) => {
		const gif = activeGifs.value.find((g) => g.id === gifId);
		if (!gif || currentTime < gif.startTime || currentTime > gif.endTime) {
			return null;
		}

		const state = gifStates.get(gifId);
		if (!state) return null;

		// Calculate animation progress - only if playing
		const relativeTime = currentTime - gif.startTime;
		let frameIndex = 0;

		if (state.isPlaying) {
			if (gif.type === "video") {
				// For videos, use real video timing for smooth playback
				// Calculate video time based on relative time and video duration
				const videoTime = relativeTime % (gif.duration || 10);
				frameIndex = Math.floor(videoTime * 120); // Use 120fps for smoother video timing

				// Update last update time for smooth animation
				state.lastUpdateTime = currentTime;
			} else {
				// For GIFs and images, use standard calculation
				frameIndex = Math.floor(relativeTime * state.frameRate) % 120;
			}
		} else {
			// If paused, keep current frame
			frameIndex = state.currentFrame || 0;
		}

		return {
			...gif,
			id: gifId, // Use the passed gifId parameter
			frameIndex,
			isVisible: true,
			isSelected: gif.id === selectedGifId.value,
			relativeTime,
			url: gif.url || gif.originalUrl,
			rotation: gif.rotation || 0,
			isPlaying: state.isPlaying, // Pass playing state to renderer
			videoTime: gif.type === "video" ? relativeTime : null, // Add video time for video elements
			playbackRate: gif.type === "video" ? 1.0 : 1.0, // Normal playback rate for videos
			videoDuration: gif.type === "video" ? gif.duration || 10 : null, // Video duration for timing
			lastUpdateTime: state.lastUpdateTime || 0, // Track last update for smooth animation
		};
	};

	// Control GIF animation based on canvas play state
	const playAllGifs = () => {
		gifStates.forEach((state) => {
			state.isPlaying = true;
		});
	};

	const pauseAllGifs = () => {
		gifStates.forEach((state) => {
			state.isPlaying = false;
		});
	};

	// Clear all GIFs
	const clearAllGifs = () => {
		activeGifs.value = [];
		gifStates.clear();
		selectedGifId.value = null;
		searchResults.value = [];
	};

	// Clear all selections (called on play/export)
	const clearAllSelections = () => {
		selectedGifId.value = null;
		activeGifs.value.forEach((gif) => {
			gif.isSelected = false;
		});

		// Clear handle data when selections are cleared
		if (typeof window !== "undefined" && window.gifHandleData) {
			window.gifHandleData.clear();
		}
	};

	// Get maximum duration from all active GIFs
	const getMaxGifDuration = () => {
		if (activeGifs.value.length === 0) {
			return 0;
		}

		const maxEndTime = Math.max(
			...activeGifs.value.map((gif) => gif.endTime || 0)
		);
		return maxEndTime;
	};

	return {
		// State
		searchQuery,
		searchResults,
		activeGifs,
		selectedGifId,
		isSearching,
		gifStates,
		dragState,

		// Methods
		searchGifs,
		addGifToCanvas,
		removeGif,
		selectGif,
		updateGifPosition,
		updateGifSize,
		updateGifOpacity,
		updateGifTiming,
		getGifsAtTime,
		handleGifClick,
		handleGifDrag,
		handleGifResize,
		handleGifResizeLegacy,
		handleMouseMove,
		handleMouseUp,
		handleKeyDown,
		getGifRenderData,
		clearAllGifs,
		clearAllSelections,
		playAllGifs,
		pauseAllGifs,
		getMaxGifDuration,
		
		// Undo/Redo integration
		setUndoRedoCallback,
	};
};
