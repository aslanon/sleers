import { ref } from "vue";

export const useCameraDrag = () => {
	const isDragging = ref(false);
	const dragOffset = ref({ x: 0, y: 0 });
	const cameraPosition = ref({ x: 0, y: 0 });

	const startDrag = (e, currentPosition, mouseX, mouseY) => {
		isDragging.value = true;
		const dpr = window.devicePixelRatio || 1;

		// Mouse ile kamera arasındaki offset'i hesapla
		dragOffset.value = {
			x: mouseX - currentPosition.x,
			y: mouseY - currentPosition.y,
		};

		cameraPosition.value = currentPosition;

		window.addEventListener("mousemove", handleDrag);
		window.addEventListener("mouseup", stopDrag);
	};

	const handleDrag = (e) => {
		if (!isDragging.value) return;

		const dpr = window.devicePixelRatio || 1;
		const canvas = document.getElementById("canvasID");

		// Canvas elementini bulamazsak işlemi iptal et
		if (!canvas) {
			console.warn("Canvas element not found during camera drag");
			return;
		}

		const rect = canvas.getBoundingClientRect();
		const mouseX = (e.clientX - rect.left) * dpr * 3; // scaleValue = 3
		const mouseY = (e.clientY - rect.top) * dpr * 3;

		// Mouse pozisyonundan offset'i çıkararak kamera pozisyonunu hesapla
		cameraPosition.value = {
			x: mouseX - dragOffset.value.x,
			y: mouseY - dragOffset.value.y,
		};

		// Kamera pozisyonu değiştiğinde log
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
