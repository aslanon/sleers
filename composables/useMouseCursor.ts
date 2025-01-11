import { ref, onMounted, onUnmounted } from "vue";

declare global {
	interface Window {
		cursorMonitor: {
			create: () => {
				start: () => void;
				stop: () => void;
				onCursorChanged: (callback: (type: string) => void) => void;
			};
		};
	}
}

let cursorMonitor: ReturnType<Window["cursorMonitor"]["create"]> | null = null;

export function useMouseCursor() {
	const cursorType = ref("default");

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
