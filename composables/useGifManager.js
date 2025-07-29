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
	initialMouseX: null, // Added for rotate handle
	initialMouseY: null, // Added for rotate handle
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
	const addGifToCanvas = (gifData, videoDuration = null) => {
		const gifId =
			gifData.id ||
			`gif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// Check if it's an image or video (not a GIF)
		const isImage = gifData.type === "image";
		const isVideo = gifData.type === "video";

		// Default duration: video duration if available, otherwise 10 seconds
		const defaultDuration = videoDuration || 10;

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

		// Create GIF state for animation tracking - initially paused
		gifStates.set(gifId, {
			currentFrame: 0,
			lastFrameTime: 0,
			frameRate: 30, // Default frame rate
			isPlaying: false, // Start paused, will be controlled by canvas play state
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
		// Deselect all other GIFs
		activeGifs.value.forEach((gif) => {
			gif.isSelected = gif.id === gifId;
		});

		selectedGifId.value = gifId;

		// Emit selection event
		if (typeof window !== "undefined") {
			// Debounce event dispatch to prevent excessive updates
			if (window.gifEventTimeout) {
				clearTimeout(window.gifEventTimeout);
			}
			window.gifEventTimeout = setTimeout(() => {
				window.dispatchEvent(
					new CustomEvent("gif-selected", {
						detail: { gifId },
					})
				);
			}, 50);
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

		// Check for resize and rotate handle clicks first (higher priority)
		if (
			typeof window !== "undefined" &&
			window.gifHandleData &&
			window.gifHandleData.size > 0
		) {
			console.log(
				`[useGifManager] Checking ${window.gifHandleData.size} handle entries for click at (${x}, ${y})`
			);
			for (const [gifId, handleData] of window.gifHandleData.entries()) {
				const handle = handleData.handle;
				const rotateHandle = handleData.rotateHandle;

				// Check if click is on resize handle (handle coordinates are already in canvas space)
				if (
					handle &&
					handle.x !== undefined &&
					handle.y !== undefined &&
					handle.width !== undefined &&
					handle.height !== undefined &&
					x >= handle.x &&
					x <= handle.x + handle.width &&
					y >= handle.y &&
					y <= handle.y + handle.height
				) {
					console.log(
						`[useGifManager] Resize handle clicked for ${gifId} at (${x}, ${y})`
					);
					console.log(
						`[useGifManager] Handle bounds: (${handle.x}, ${handle.y}) to (${
							handle.x + handle.width
						}, ${handle.y + handle.height})`
					);
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
						const dpr = 1;
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

				// Check if click is on rotate handle
				if (
					rotateHandle &&
					rotateHandle.x !== undefined &&
					rotateHandle.y !== undefined &&
					rotateHandle.width !== undefined &&
					rotateHandle.height !== undefined &&
					x >= rotateHandle.x &&
					x <= rotateHandle.x + rotateHandle.width &&
					y >= rotateHandle.y &&
					y <= rotateHandle.y + rotateHandle.height
				) {
					console.log(
						`[useGifManager] Rotate handle clicked for ${gifId} at (${x}, ${y})`
					);
					console.log(
						`[useGifManager] Rotate handle bounds: (${rotateHandle.x}, ${
							rotateHandle.y
						}) to (${rotateHandle.x + rotateHandle.width}, ${
							rotateHandle.y + rotateHandle.height
						})`
					);
					const gif = activeGifs.value.find((g) => g.id === gifId);
					if (gif) {
						selectGif(gifId);

						// Start rotate operation
						dragState.isRotating = true;
						dragState.draggedGifId = gifId;
						dragState.startX = x;
						dragState.startY = y;

						// Store original rotation
						dragState.originalRotation = gif.rotation || 0;

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

	// Mouse event handlers for drag, resize and rotate
	const handleMouseMove = (event) => {
		if (!dragState.isDragging && !dragState.isResizing && !dragState.isRotating)
			return;

		const dpr = 1;
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
		} else if (dragState.isRotating) {
			const gif = activeGifs.value.find((g) => g.id === dragState.draggedGifId);
			if (gif) {
				// Handle rotate based on mouse position
				handleGifRotate(gif, event.clientX, event.clientY);
			}
		}
	};

	const handleMouseUp = () => {
		if (dragState.isDragging || dragState.isResizing || dragState.isRotating) {
			// Reset drag state
			dragState.isDragging = false;
			dragState.isResizing = false;
			dragState.isRotating = false;
			dragState.draggedGifId = null;
			dragState.resizeHandle = null;
			dragState.initialMouseX = null; // Reset initial mouse position
			dragState.initialMouseY = null; // Reset initial mouse position

			// Remove event listeners immediately to prevent conflicts
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);

			// Force canvas update to ensure handles are properly rendered
			if (typeof window !== "undefined") {
				// Single update with longer delay for better stability
				setTimeout(() => {
					window.dispatchEvent(new CustomEvent("gif-interaction-ended"));
				}, 200); // Longer delay to ensure all operations are complete
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

	// Handle GIF resize (more responsive and easier to use)
	const handleGifResize = (gif, mouseX, mouseY, handle) => {
		if (!gif || !handle) return;

		const dpr = 1;
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

		// For top-left resize handle, analyze mouse movement direction
		const deltaX = mouseXCanvas - dragState.startX;
		const deltaY = mouseYCanvas - dragState.startY;

		console.log(`[Resize] Mouse movement: deltaX=${deltaX}, deltaY=${deltaY}`);

		// Stabilize resize by using a minimum movement threshold
		const minMovementThreshold = 3; // Reduced threshold for smoother response
		const absDeltaX = Math.abs(deltaX);
		const absDeltaY = Math.abs(deltaY);

		// Only resize if movement is significant enough
		if (absDeltaX < minMovementThreshold && absDeltaY < minMovementThreshold) {
			return;
		}

		// For top-left handle:
		// - Moving RIGHT (positive deltaX) should DECREASE width (reversed)
		// - Moving DOWN (positive deltaY) should DECREASE height (reversed)
		// - Moving LEFT (negative deltaX) should INCREASE width (reversed)
		// - Moving UP (negative deltaY) should INCREASE height (reversed)

		// Calculate scale factors based on movement direction with enhanced smoothing
		const scaleFactorX = 1 - (deltaX / dragState.originalWidth) * 0.3; // Reduced sensitivity for smoother resize
		const scaleFactorY = 1 - (deltaY / dragState.originalHeight) * 0.3; // Reduced sensitivity for smoother resize

		// Use the larger scale factor to maintain aspect ratio, but with enhanced smoothing
		const scaleFactor = Math.max(scaleFactorX, scaleFactorY, 0.1); // Minimum 10% size

		// Apply enhanced smoothing to prevent jittery resize
		const smoothedScaleFactor = Math.max(0.1, Math.min(5.0, scaleFactor)); // Limit scale range

		// Apply additional smoothing for even smoother resize
		const finalScaleFactor = Math.pow(smoothedScaleFactor, 0.8); // Smoothing curve

		let newWidth = dragState.originalWidth * finalScaleFactor;
		let newHeight = newWidth / aspectRatio;

		// For top-left handle, position should move as size changes
		// Keep the bottom-right corner fixed, move top-left corner
		// When size increases, X and Y should decrease (move left and up)
		// When size decreases, X and Y should increase (move right and down)
		let newX = dragState.originalX + (dragState.originalWidth - newWidth);
		let newY = dragState.originalY + (dragState.originalHeight - newHeight);

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

		// Calculate animation progress - only if playing
		const relativeTime = currentTime - gif.startTime;
		let frameIndex = 0;

		if (state.isPlaying) {
			frameIndex = Math.floor(relativeTime * state.frameRate) % 60; // Assume 60 frames max
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
		playAllGifs,
		pauseAllGifs,
	};
};
