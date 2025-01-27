import { ref } from "vue";

export const useCameraDrag = () => {
	const isDragging = ref(false);
	const dragOffset = ref({ x: 0, y: 0 });
	const cameraPosition = ref({ x: 0, y: 0 });

	const startDrag = (e, currentPosition, mouseX, mouseY) => {
		isDragging.value = true;

		// Mouse ile kamera arasındaki offset'i hesapla
		dragOffset.value = {
			x: mouseX - (currentPosition?.x || 0),
			y: mouseY - (currentPosition?.y || 0),
		};

		cameraPosition.value = currentPosition || { x: 0, y: 0 };

		window.addEventListener("mousemove", handleDrag);
		window.addEventListener("mouseup", stopDrag);
	};

	const handleDrag = (e) => {
		if (!isDragging.value) return;

		const canvas = e.target.closest("canvas");
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		const scaleValue = 3;

		const mouseX = (e.clientX - rect.left) * dpr * scaleValue;
		const mouseY = (e.clientY - rect.top) * dpr * scaleValue;

		cameraPosition.value = {
			x: mouseX - dragOffset.value.x,
			y: mouseY - dragOffset.value.y,
		};
	};

	const stopDrag = () => {
		isDragging.value = false;
		window.removeEventListener("mousemove", handleDrag);
		window.removeEventListener("mouseup", stopDrag);
	};

	return {
		isDragging,
		dragOffset,
		cameraPosition,
		startDrag,
		handleDrag,
		stopDrag,
	};
};
