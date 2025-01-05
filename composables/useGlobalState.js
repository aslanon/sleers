import { ref, onUnmounted } from "vue";

export const useGlobalState = () => {
	if (window && window.electron && window.electron.globalState) {
		// Tek bir reaktif state tanımlanır
		const state = ref({});
		let isListening = false; // Dinleyicinin kurulu olup olmadığını kontrol eder

		// Global state'i preload API'den al ve güncelle
		const get = async () => {
			try {
				const fetchedState = await window.electron.globalState.get();
				state.value = fetchedState; // Tepkisel state'i güncelle
				return fetchedState;
			} catch (error) {
				console.error("Global state alınırken hata:", error);
			}
		};

		// Global state'i güncelle
		const update = async (newState) => {
			try {
				const updatedState = await window.electron.globalState.update(newState);
				state.value = updatedState; // Tepkisel state'i güncelle
				return updatedState;
			} catch (error) {
				console.error("Global state güncellenirken hata:", error);
			}
		};

		// Tek bir dinleyici kur
		const setupListener = () => {
			if (!isListening) {
				window.electron.globalState.listen((updatedState) => {
					state.value = updatedState; // Tepkisel state'i güncelle
				});
				isListening = true; // Dinleyicinin kurulu olduğunu işaretle
			}
		};

		// Bileşen unmount edildiğinde temizle (isteğe bağlı)
		onUnmounted(() => {
			// Eğer dinleyici kaldırılmak istenirse buraya bir `removeListener` eklenebilir
			isListening = false; // Gerekirse dinleyici durumunu sıfırla
		});

		// İlk kurulumda global state'i al ve dinleyiciyi ayarla
		get();
		setupListener();

		return {
			state, // Tepkisel state
			get,
			update,
		};
	} else {
		console.warn("Electron veya globalState API'si mevcut değil!");
		return null;
	}
};
