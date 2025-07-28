import { ref, reactive, watch, computed } from "vue";
import { usePlayerSettings } from "./usePlayerSettings";

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
	resizeHandle: null, // 'tl', 'tr', 'bl', 'br', 'top', 'right', 'bottom', 'left'
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
				const data = await window.electronAPI.invoke("search-gifs", searchQuery.value);
				console.log("Giphy API response:", data);
				
				searchResults.value = data.data || [];
				console.log("GIF search completed, found", searchResults.value.length, "GIFs");
			} else {
				// Fallback for non-electron environments
				console.log("Using fetch fallback for GIF search...");
				const response = await fetch(
					`https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${encodeURIComponent(
						searchQuery.value
					)}&limit=12&offset=0&rating=g&lang=en`
				);

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const data = await response.json();
				console.log("Giphy API response:", data);

				searchResults.value = data.data || [];
				console.log("GIF search completed, found", searchResults.value.length, "GIFs");
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

	// Add GIF to canvas with unique ID and timeline segment
	const addGifToCanvas = (gifData) => {
		const gifId = `gif_${Date.now()}_${Math.random()
			.toString(36)
			.substr(2, 9)}`;

		const newGif = {
			id: gifId,
			title: gifData.title || "Untitled GIF",
			url: gifData.images.fixed_width.url,
			originalUrl: gifData.images.original.url,
			webpUrl: gifData.images.fixed_width.webp,
			mp4Url: gifData.images.fixed_width.mp4,
			width: parseInt(gifData.images.fixed_width.width) || 200,
			height: parseInt(gifData.images.fixed_width.height) || 200,
			x: 100, // Default position
			y: 100,
			opacity: 1,
			startTime: 0,
			endTime: 5, // Default 5 seconds
			isSelected: false,
			isDragging: false,
			isResizing: false,
			giphyData: gifData, // Store original Giphy data
		};

		activeGifs.value.push(newGif);

		// Create GIF state for animation tracking
		gifStates.set(gifId, {
			currentFrame: 0,
			lastFrameTime: 0,
			frameRate: 30, // Default frame rate
			isPlaying: true,
		});

		// Auto-select the newly added GIF
		selectGif(gifId);

		// Emit event to timeline component to create segment
		if (typeof window !== "undefined") {
			window.dispatchEvent(
				new CustomEvent("gif-added", {
					detail: { gif: newGif },
				})
			);
		}

		return newGif;
	};

	// Remove GIF from canvas and timeline
	const removeGif = (gifId) => {
		const index = activeGifs.value.findIndex((gif) => gif.id === gifId);
		if (index !== -1) {
			activeGifs.value.splice(index, 1);
			gifStates.delete(gifId);

			if (selectedGifId.value === gifId) {
				selectedGifId.value = null;
			}

			// Emit event to timeline component to remove segment
			if (typeof window !== "undefined") {
				window.dispatchEvent(
					new CustomEvent("gif-removed", {
						detail: { gifId },
					})
				);
			}
		}
	};

	// Select GIF for editing
	const selectGif = (gifId) => {
		// Deselect all other GIFs
		activeGifs.value.forEach((gif) => {
			gif.isSelected = gif.id === gifId;
		});

		selectedGifId.value = gifId;

		// Emit selection event
		if (typeof window !== "undefined") {
			window.dispatchEvent(
				new CustomEvent("gif-selected", {
					detail: { gifId },
				})
			);
		}
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

	// Get GIF at specific time
	const getGifsAtTime = (currentTime) => {
		return activeGifs.value.filter(
			(gif) => currentTime >= gif.startTime && currentTime <= gif.endTime
		);
	};

	// Handle GIF click on canvas
	const handleGifClick = (event, canvasRect) => {
		const dpr = window.devicePixelRatio || 1;
		const scaleValue = 1; // Adjust if needed based on canvas scaling

		const x = (event.clientX - canvasRect.left) * dpr * scaleValue;
		const y = (event.clientY - canvasRect.top) * dpr * scaleValue;

		// Find clicked GIF (check from top to bottom - reverse order for z-index)
		const clickedGif = [...activeGifs.value].reverse().find((gif) => {
			const gifX = gif.x * dpr;
			const gifY = gif.y * dpr;
			const gifWidth = gif.width * dpr;
			const gifHeight = gif.height * dpr;

			return (
				x >= gifX && x <= gifX + gifWidth && y >= gifY && y <= gifY + gifHeight
			);
		});

		if (clickedGif) {
			selectGif(clickedGif.id);

			// Start drag for the clicked GIF
			const gifX = clickedGif.x * dpr;
			const gifY = clickedGif.y * dpr;

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

		// If no GIF clicked, deselect all
		selectedGifId.value = null;
		activeGifs.value.forEach((gif) => {
			gif.isSelected = false;
		});

		return null;
	};

	// Mouse event handlers for drag and resize
	const handleMouseMove = (event) => {
		if (!dragState.isDragging && !dragState.isResizing) return;

		const dpr = window.devicePixelRatio || 1;
		const scaleValue = 1;

		// Get canvas bounds
		const canvas = document.querySelector("#canvasID");
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const x = (event.clientX - rect.left) * dpr * scaleValue;
		const y = (event.clientY - rect.top) * dpr * scaleValue;

		if (dragState.isDragging) {
			const gif = activeGifs.value.find((g) => g.id === dragState.draggedGifId);
			if (gif) {
				// Calculate new position
				const newX = (x - dragState.offsetX) / dpr;
				const newY = (y - dragState.offsetY) / dpr;

				// Constrain to canvas bounds
				gif.x = Math.max(0, Math.min(newX, canvas.width / dpr - gif.width));
				gif.y = Math.max(0, Math.min(newY, canvas.height / dpr - gif.height));

				updateGifPosition();
			}
		} else if (dragState.isResizing) {
			const gif = activeGifs.value.find((g) => g.id === dragState.draggedGifId);
			if (gif) {
				// Handle resize based on handle type
				handleGifResize(gif, x, y, dragState.resizeHandle);
			}
		}
	};

	const handleMouseUp = () => {
		if (dragState.isDragging || dragState.isResizing) {
			dragState.isDragging = false;
			dragState.isResizing = false;
			dragState.draggedGifId = null;
			dragState.resizeHandle = null;

			// Remove event listeners
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		}
	};

	// Handle GIF drag (legacy method for compatibility)
	const handleGifDrag = (gifId, deltaX, deltaY) => {
		const gif = activeGifs.value.find((g) => g.id === gifId);
		if (gif) {
			gif.x = Math.max(0, gif.x + deltaX);
			gif.y = Math.max(0, gif.y + deltaY);
			updateGifPosition();
		}
	};

	// Handle GIF resize (updated for interactive resize)
	const handleGifResize = (gif, mouseX, mouseY, handle) => {
		if (!gif || !handle) return;

		const dpr = window.devicePixelRatio || 1;
		const minSize = 50;

		// Convert mouse position to canvas coordinates
		const x = mouseX / dpr;
		const y = mouseY / dpr;

		// Calculate new dimensions based on resize handle
		let newX = gif.x;
		let newY = gif.y;
		let newWidth = gif.width;
		let newHeight = gif.height;

		switch (handle) {
			case "tl": // Top-left
				newWidth = gif.x + gif.width - x;
				newHeight = gif.y + gif.height - y;
				newX = x;
				newY = y;
				break;
			case "tr": // Top-right
				newWidth = x - gif.x;
				newHeight = gif.y + gif.height - y;
				newY = y;
				break;
			case "bl": // Bottom-left
				newWidth = gif.x + gif.width - x;
				newHeight = y - gif.y;
				newX = x;
				break;
			case "br": // Bottom-right
				newWidth = x - gif.x;
				newHeight = y - gif.y;
				break;
			case "top":
				newHeight = gif.y + gif.height - y;
				newY = y;
				break;
			case "right":
				newWidth = x - gif.x;
				break;
			case "bottom":
				newHeight = y - gif.y;
				break;
			case "left":
				newWidth = gif.x + gif.width - x;
				newX = x;
				break;
		}

		// Apply constraints
		if (newWidth >= minSize) {
			gif.width = newWidth;
			gif.x = newX;
		}
		if (newHeight >= minSize) {
			gif.height = newHeight;
			gif.y = newY;
		}

		updateGifSize();
	};

	// Legacy resize function for compatibility
	const handleGifResizeLegacy = (gifId, newWidth, newHeight) => {
		const gif = activeGifs.value.find((g) => g.id === gifId);
		if (gif) {
			gif.width = Math.max(50, newWidth);
			gif.height = Math.max(50, newHeight);
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

		// Calculate animation progress
		const relativeTime = currentTime - gif.startTime;
		const frameIndex = Math.floor(relativeTime * state.frameRate) % 60; // Assume 60 frames max

		return {
			...gif,
			frameIndex,
			isVisible: true,
			isSelected: gif.id === selectedGifId.value,
			relativeTime,
			url: gif.url || gif.originalUrl,
		};
	};

	// Clear all GIFs
	const clearAllGifs = () => {
		activeGifs.value = [];
		gifStates.clear();
		selectedGifId.value = null;
		searchResults.value = [];
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
	};
};