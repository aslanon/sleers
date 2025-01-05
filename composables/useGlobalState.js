// export const useGlobalState = () => {
// 	if (window && window.electron) {
// 		const get = () => {
// 			return window.electron.globalState.get();
// 		};

// 		const update = (newState) => {
// 			return window.electron.globalState.update(newState);
// 		};

// 		const listen = (func) => {
// 			return window.electron.globalState.listen(func);
// 		};

// 		return {
// 			get,
// 			update,
// 			listen,
// 		};
// 	}

// 	return null;
// };
import { ref, onUnmounted } from "vue";

export const useGlobalState = () => {
	if (window && window.electron && window.electron.globalState) {
		const state = ref({}); // Tepkisel global state
		let listener = null; // Tek bir listener'ı saklamak için

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

		// Global state güncellemelerini dinle
		const listen = (callback) => {
			if (listener) {
				// Zaten bir listener varsa, önce temizle
				window.electron.globalState.removeListener(
					"GLOBAL_STATE_UPDATED",
					listener
				);
			}

			listener = (updatedState) => {
				state.value = updatedState; // Tepkisel state'i güncelle
				if (callback) callback(updatedState); // Kullanıcı callback'ini çağır
			};

			window.electron.globalState.listen(listener);
		};

		// Bileşen unmount edildiğinde dinleyiciyi temizle
		onUnmounted(() => {
			if (listener) {
				window.electron.globalState.removeListener(
					"GLOBAL_STATE_UPDATED",
					listener
				);
			}
		});

		// Başlangıçta state'i yükle
		get();

		return {
			state, // Tepkisel state
			get,
			update,
			listen,
		};
	} else {
		console.warn("Electron veya globalState API'si mevcut değil!");
		return null;
	}
};
