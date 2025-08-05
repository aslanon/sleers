import { ref } from "vue";

// Undo/Redo callback for video transformations
let videoUndoRedoCallback = null;

const setVideoUndoRedoCallback = (callback) => {
	videoUndoRedoCallback = callback;
};

const triggerVideoUndoRedoSave = (actionType, description) => {
	if (videoUndoRedoCallback) {
		videoUndoRedoCallback(actionType, description);
	}
};

export const useVideoDrag = () => {
	const isDragging = ref(false);
	const dragOffset = ref({ x: 0, y: 0 });
	const videoPosition = ref({ x: 0, y: 0 });

	const startDrag = (e, currentPosition, mouseX, mouseY) => {
		isDragging.value = true;
		const dpr = 1;

		// Mouse ile video arasındaki offset'i hesapla
		dragOffset.value = {
			x: mouseX - currentPosition.x,
			y: mouseY - currentPosition.y,
		};

		videoPosition.value = currentPosition;

		window.addEventListener("mousemove", handleDrag);
		window.addEventListener("mouseup", stopDrag);
	};

	const handleDrag = (e) => {
		if (!isDragging.value) return;

		const dpr = 1;
		const rect = document.getElementById("canvasID").getBoundingClientRect();
		const mouseX = (e.clientX - rect.left) * dpr * 3; // scaleValue = 3
		const mouseY = (e.clientY - rect.top) * dpr * 3;

		// Mouse pozisyonundan offset'i çıkararak video pozisyonunu hesapla
		videoPosition.value = {
			x: mouseX - dragOffset.value.x,
			y: mouseY - dragOffset.value.y,
		};
	};

	const stopDrag = () => {
		if (isDragging.value) {
			// Save state for undo/redo before stopping drag
			triggerVideoUndoRedoSave('VIDEO_MOVE', 'Video moved');
		}
		isDragging.value = false;
		window.removeEventListener("mousemove", handleDrag);
		window.removeEventListener("mouseup", stopDrag);
	};

	return {
		isDragging,
		videoPosition,
		startDrag,
		handleDrag,
		stopDrag,
		
		// Undo/Redo support
		setVideoUndoRedoCallback,
	};
};

// Export the callback setter for external access
export { setVideoUndoRedoCallback };
