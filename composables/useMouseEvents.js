import { ref, onMounted, onUnmounted } from "vue";

export const useMouseEvents = () => {
	const mousePosition = ref({ x: 0, y: 0 });
	const lastClick = ref({ button: null, x: 0, y: 0 });
	const wheelInfo = ref({ rotation: 0, direction: 0, x: 0, y: 0 });

	const handleMousePosition = (event, data) => {
		mousePosition.value = data;
	};

	const handleMouseClick = (event, data) => {
		lastClick.value = data;
	};

	const handleMouseWheel = (event, data) => {
		wheelInfo.value = data;
	};

	onMounted(() => {
		// IPC event dinleyicilerini ekle
		window.electron.on("MOUSE_POSITION", handleMousePosition);
		window.electron.on("MOUSE_CLICK", handleMouseClick);
		window.electron.on("MOUSE_WHEEL", handleMouseWheel);
	});

	onUnmounted(() => {
		// Event dinleyicilerini temizle
		window.electron.removeListener("MOUSE_POSITION", handleMousePosition);
		window.electron.removeListener("MOUSE_CLICK", handleMouseClick);
		window.electron.removeListener("MOUSE_WHEEL", handleMouseWheel);
	});

	return {
		mousePosition,
		lastClick,
		wheelInfo,
	};
};
