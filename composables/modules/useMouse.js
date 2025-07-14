import { ref } from "vue";

export const useMouse = () => {
	const mousePositions = ref([]);

	// Fare izleme için varsayılan konfigürasyon
	const defaultConfig = {
		throttleLimit: 50, // ms
		maxPositions: 1000, // Maksimum depolanacak pozisyon sayısı
		trackClicks: true, // Tıklamaları izle
		trackMovement: true, // Fare hareketlerini izle
	};

	// Konfigürasyon state'i
	const config = ref({ ...defaultConfig });

	// Konfigürasyonu güncelleme fonksiyonu
	const updateConfig = (newConfig) => {
		config.value = {
			...config.value,
			...newConfig,
		};
	};

	// Throttle fonksiyonu
	const throttle = (func, limit = config.value.throttleLimit) => {
		let inThrottle;
		return function (...args) {
			if (!inThrottle) {
				func.apply(this, args);
				inThrottle = true;
				setTimeout(() => (inThrottle = false), limit);
			}
		};
	};

	const startMouseTracking = () => {
		if (window.electron?.ipcRenderer) {
			window.electron.ipcRenderer.send("START_MOUSE_TRACKING", {
				trackClicks: config.value.trackClicks,
				trackMovement: config.value.trackMovement,
			});
		}
	};

	const stopMouseTracking = () => {
		if (window.electron?.ipcRenderer) {
			window.electron.ipcRenderer.send("STOP_MOUSE_TRACKING");
		}
	};

	const updateMousePosition = (x, y, isClick = false) => {
		mousePositions.value.push({
			x,
			y,
			timestamp: Date.now(),
			isClick,
		});

		// Limit the number of stored positions to prevent memory issues
		if (mousePositions.value.length > config.value.maxPositions) {
			mousePositions.value.shift();
		}
	};

	return {
		mousePositions,
		config,
		updateConfig,
		throttle,
		startMouseTracking,
		stopMouseTracking,
		updateMousePosition,
	};
};
