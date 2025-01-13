import { ref } from "vue";

export const useCameraDrag = () => {
	const isDragging = ref(false);
	const dragStart = ref({ x: 0, y: 0 });
	const cameraPosition = ref({ x: 0, y: 0 });

	const startDrag = (e, currentPosition) => {
		isDragging.value = true;
		dragStart.value = {
			x: e.clientX - currentPosition.x,
			y: e.clientY - currentPosition.y,
		};
		cameraPosition.value = currentPosition;

		// Add global event listeners
		window.addEventListener("mousemove", handleDrag);
		window.addEventListener("mouseup", stopDrag);
	};

	const handleDrag = (e) => {
		if (!isDragging.value) return;

		cameraPosition.value = {
			x: e.clientX - dragStart.value.x,
			y: e.clientY - dragStart.value.y,
		};
	};

	const stopDrag = () => {
		isDragging.value = false;
		window.removeEventListener("mousemove", handleDrag);
		window.removeEventListener("mouseup", stopDrag);
	};

	return {
		isDragging,
		cameraPosition,
		startDrag,
		handleDrag,
		stopDrag,
	};
};
