import { ref, onMounted, onUnmounted } from "vue";

const cursorType = ref("default");
let cursorMonitor = null;

export function useMouseCursor() {
	onMounted(() => {
		if (window.cursorMonitor) {
			cursorMonitor = window.cursorMonitor.create();
			cursorMonitor.onCursorChanged((type) => {
				cursorType.value = type;
			});
			cursorMonitor.start();
		}
	});

	onUnmounted(() => {
		if (cursorMonitor) {
			cursorMonitor.stop();
		}
	});

	return {
		cursorType,
	};
}

export default useMouseCursor;
