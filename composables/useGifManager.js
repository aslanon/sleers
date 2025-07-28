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
	const addGifToCanvas = (gifData) => {
		const gifId =
			gifData.id ||
			`gif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// Check if it's an image or video (not a GIF)
		const isImage = gifData.type === "image";
		const isVideo = gifData.type === "video";

		let newGif;

		if (isImage) {
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
				endTime: gifData.endTime || 10,
				file: gifData.file,
				originalUrl: gifData.url,
				webpUrl: gifData.url,
				mp4Url: gifData.url,
				originalWidth: gifData.originalWidth,
				originalHeight: gifData.originalHeight,
				aspectRatio: gifData.aspectRatio,
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
				endTime: gifData.endTime || 10,
				file: gifData.file,
				originalUrl: gifData.url,
				webpUrl: gifData.url,
				mp4Url: gifData.url,
				originalWidth: gifData.originalWidth,
				originalHeight: gifData.originalHeight,
				aspectRatio: gifData.aspectRatio,
				duration: gifData.duration || 0,
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
		}

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
		const scaleValue = 3; // Match MediaPlayer scale value

		const x = (event.clientX - canvasRect.left) * dpr * scaleValue;
		const y = (event.clientY - canvasRect.top) * dpr * scaleValue;

		// Check for resize handle clicks first (higher priority)
		if (typeof window !== "undefined" && window.gifHandleData) {
			for (const [gifId, handleData] of window.gifHandleData.entries()) {
				const handle = handleData.handle;

				// Check if click is on resize handle
				if (
					x >= handle.x &&
					x <= handle.x + handle.width &&
					y >= handle.y &&
					y <= handle.y + handle.height
				) {
					const gif = activeGifs.value.find((g) => g.id === gifId);
					if (gif) {
						selectGif(gifId);

						// Start resize operation
						dragState.isResizing = true;
						dragState.draggedGifId = gifId;
						dragState.resizeHandle = "tl"; // Top-left resize
						dragState.startX = x;
						dragState.startY = y;

						// Store original dimensions for resize calculations (in canvas coordinates)
						const dpr = window.devicePixelRatio || 1;
						dragState.originalWidth = gif.width * dpr;
						dragState.originalHeight = gif.height * dpr;
						dragState.originalX = gif.x * dpr;
						dragState.originalY = gif.y * dpr;

						// Add mouse move and up listeners
						document.addEventListener("mousemove", handleMouseMove);
						document.addEventListener("mouseup", handleMouseUp);

						return gif;
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
		const scaleValue = 3; // Match MediaPlayer scale value

		// Get canvas bounds
		const canvas = document.querySelector("#canvasID");
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const x = (event.clientX - rect.left) * dpr * scaleValue;
		const y = (event.clientY - rect.top) * dpr * scaleValue;

		if (dragState.isDragging) {
			const gif = activeGifs.value.find((g) => g.id === dragState.draggedGifId);
			if (gif) {
				// Calculate new position (accounting for scale)
				const newX = (x - dragState.offsetX) / (dpr * scaleValue);
				const newY = (y - dragState.offsetY) / (dpr * scaleValue);

				// Remove canvas boundaries - allow GIFs/images to go outside canvas
				gif.x = newX;
				gif.y = newY;

				updateGifPosition();
			}
		} else if (dragState.isResizing) {
			const gif = activeGifs.value.find((g) => g.id === dragState.draggedGifId);
			if (gif) {
				// Handle resize based on handle type - pass raw event for camera-style resize
				handleGifResize(
					gif,
					event.clientX,
					event.clientY,
					dragState.resizeHandle
				);
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
			// Remove canvas boundaries - allow GIFs/images to go outside canvas
			gif.x = gif.x + deltaX;
			gif.y = gif.y + deltaY;
			updateGifPosition();
		}
	};

	// Handle GIF resize (more responsive and easier to use)
	const handleGifResize = (gif, mouseX, mouseY, handle) => {
		if (!gif || !handle) return;

		const dpr = window.devicePixelRatio || 1;
		const canvas = document.getElementById("canvasID");
		if (!canvas) {
			console.warn("Canvas element not found during GIF resize");
			return;
		}

		const rect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;

		const mouseXCanvas = (mouseX - rect.left) * scaleX;
		const mouseYCanvas = (mouseY - rect.top) * scaleY;

		// Use stored aspect ratio for images, calculate for GIFs
		const aspectRatio =
			gif.aspectRatio || dragState.originalWidth / dragState.originalHeight;

		// More responsive resize logic - directional scaling
		const centerX = dragState.originalX + dragState.originalWidth / 2;
		const centerY = dragState.originalY + dragState.originalHeight / 2;

		// Calculate current distance from center
		const currentDistanceX = mouseXCanvas - centerX;
		const currentDistanceY = mouseYCanvas - centerY;
		const currentDistance = Math.sqrt(
			currentDistanceX * currentDistanceX + currentDistanceY * currentDistanceY
		);

		// Calculate original distance when resize started
		const originalCenterX = dragState.originalX + dragState.originalWidth / 2;
		const originalCenterY = dragState.originalY + dragState.originalHeight / 2;
		const startDistanceX = dragState.startX - originalCenterX;
		const startDistanceY = dragState.startY - originalCenterY;
		const startDistance = Math.sqrt(
			startDistanceX * startDistanceX + startDistanceY * startDistanceY
		);

		// Calculate scale factor based on distance change (more responsive)
		const distanceRatio = currentDistance / Math.max(startDistance, 50); // Prevent division by zero
		// More flexible scaling - allow unlimited size changes
		const scaleFactor = distanceRatio; // Direct ratio for unlimited scaling

		let newWidth = dragState.originalWidth * scaleFactor;
		let newHeight = newWidth / aspectRatio;

		// Position from center
		let newX = centerX - newWidth / 2;
		let newY = centerY - newHeight / 2;

		// Remove size constraints - allow unlimited resizing
		// const minSize = 30 * dpr; // Smaller minimum
		// const maxSize = 800 * dpr; // Maximum size limit

		// if (newWidth < minSize) {
		// 	newWidth = minSize;
		// 	newHeight = newWidth / aspectRatio;
		// } else if (newWidth > maxSize) {
		// 	newWidth = maxSize;
		// 	newHeight = newWidth / aspectRatio;
		// }

		// if (newHeight < minSize) {
		// 	newHeight = minSize;
		// 	newWidth = newHeight * aspectRatio;
		// } else if (newHeight > maxSize) {
		// 	newHeight = maxSize;
		// 	newWidth = newHeight * aspectRatio;
		// }

		// Re-center after size constraints
		newX = centerX - newWidth / 2;
		newY = centerY - newHeight / 2;

		// Update GIF properties with proper coordinate conversion
		gif.width = newWidth / dpr;
		gif.height = newHeight / dpr;
		gif.x = newX / dpr;
		gif.y = newY / dpr;

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
