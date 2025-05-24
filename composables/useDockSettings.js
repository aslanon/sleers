import { ref, onMounted, computed } from "vue";

/**
 * macOS Dock ayarlarını yöneten composable
 * @returns {Object} Dock ayarları ve metodları
 */
export default function useDockSettings() {
	const isSupported = ref(false);
	const showDockItems = ref(true);
	const dockItems = ref([]);
	const isLoading = ref(false);
	const error = ref(null);

	// Finder için varsayılan ikon URL
	const finderIconDataUrl = ref(null);
	// Trash için varsayılan ikon URL
	const trashIconDataUrl = ref(null);

	// Base64 formatında Finder ikonu yükle (web için)
	const loadFinderIcon = async () => {
		try {
			// Bu fonksiyonu çağırdığımızda, Finder iconunu yükleyeceğiz
			// Web ortamında, resim yükleme yapmak için fetch kullanabiliriz
			// Veya statik bir ikon kullanabiliriz
			const finderIconPath = "/finder-icon.png"; // Public klasöründe olmalı

			try {
				const response = await fetch(finderIconPath);
				const blob = await response.blob();
				const reader = new FileReader();
				reader.onloadend = () => {
					finderIconDataUrl.value = reader.result;
				};
				reader.readAsDataURL(blob);
			} catch (err) {
				console.warn(
					"[useDockSettings] Could not load Finder icon from web, using default"
				);
				// Fallback: Base64 kodlanmış mini icon (düşük kalite)
				finderIconDataUrl.value =
					"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA9klEQVR4nGNgGPKAmZmZRVxcfLWkpOT/kJCQ/yEhIf/FxcVXMzMzszDQAnBycv7n4uL6Ly0t/V9GRua/tLT0fy4urv+cnJz/qW4AJyen/7y8vP/5+fn/CwgI/Ofn5//Py8v7n5OTk3oDBAUF/4uIiPwXFRX9LyYm9l9EROS/oKAg9QbIycn9V1BQ+K+kpPRfWVn5v4KCwn85OTnqDVBTU/uvpqb2X0ND47+mpuZ/NTW1/2pqatQboKen919PT++/gYHBf0NDw/96enr/9fT0qDfAzMzsv5mZ2X9LS8v/1tbW/83MzP6bmZlRbwADAwMDAD2NhPjsB4FCAAAAAElFTkSuQmCC";
			}
		} catch (err) {
			console.error("[useDockSettings] Error loading Finder icon:", err);
		}
	};

	// Base64 formatında Trash ikonu yükle (web için)
	const loadTrashIcon = async () => {
		try {
			const trashIconPath = "/trash-icon.png"; // Public klasöründe olmalı

			try {
				const response = await fetch(trashIconPath);
				const blob = await response.blob();
				const reader = new FileReader();
				reader.onloadend = () => {
					trashIconDataUrl.value = reader.result;
				};
				reader.readAsDataURL(blob);
			} catch (err) {
				console.warn(
					"[useDockSettings] Could not load Trash icon from web, using default"
				);
				// Fallback: Base64 kodlanmış mini icon (transparan, düşük kalite)
				trashIconDataUrl.value =
					"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA/UlEQVR4nK2TMUvDUBSFv5eXoZMWMmUIpVOHjhlKJwehW9f+BbNl6NSf4tKtm5MO/Q8OHQodOsTNzSGlU0lfBjHiixFtNHqnC/eec+/h3isq5QCPHa8QLIAl8AZ8ROZ19VdUc+Hx6jLF9QU/N59lYqbA2t2/A0O+UXlcAh/AUYpYAI0U16DyuKiWkFTKPrAFRsBD5fGUHLdV0hfwjj8GBuQ4kEIY+prKYxt4ASKgDD0tl5iR7wHoAGPgHXiMzEvTVMKO14TsCXCeQ9gzf/Lz/8RpZzw0IYMP4AQYAlfAFbAJsYN5TsmEHK+Bu9Bjw8zHKbHpIUfm8/QFWzVkL1h5J3QAAAAASUVORK5CYII=";
			}
		} catch (err) {
			console.error("[useDockSettings] Error loading Trash icon:", err);
		}
	};

	/**
	 * Dock öğelerini ana süreçten al
	 * @param {boolean} forceRefresh - Cache'i yoksay ve zorla yenile
	 */
	const fetchDockItems = async (forceRefresh = false) => {
		if (!window.dockAPI) {
			console.error("[useDockSettings] Dock API not available");
			return;
		}

		isLoading.value = true;
		error.value = null;

		// Eğer forceRefresh true ise, önbelleği temizle
		if (forceRefresh) {
			console.log("[useDockSettings] Force refresh requested, clearing cache");
			this.cachedItems = null;
			this.cacheTime = null;
		}

		try {
			// Finder ve Trash ikonlarını yükle
			await Promise.all([loadFinderIcon(), loadTrashIcon()]);

			// Dock öğelerini doğrudan al
			console.log("[useDockSettings] Fetching dock items");
			const items = await window.dockAPI.getDockIcons(forceRefresh);
			console.log(`[useDockSettings] Got ${items?.length || 0} dock items`);

			// Icon durumlarını kontrol et
			let validIconCount = 0;
			let invalidIconCount = 0;
			let hasFinderApp = false;
			let hasTrashApp = false;

			if (items && Array.isArray(items)) {
				// Finder ve Trash uygulamaları var mı kontrol et
				hasFinderApp = items.some(
					(item) =>
						item.name === "Finder" ||
						(item.path && item.path.includes("/System/Applications/Finder.app"))
				);

				hasTrashApp = items.some(
					(item) =>
						item.name === "Trash" ||
						(item.path && item.path.includes("/.Trash"))
				);

				items.forEach((item, index) => {
					if (item.iconDataUrl) {
						validIconCount++;
					} else {
						invalidIconCount++;
						console.warn(
							`[useDockSettings] Missing icon for ${
								item.name || "unknown"
							} at index ${index}`
						);
					}
				});

				console.log(
					`[useDockSettings] Icon stats: ${validIconCount} valid, ${invalidIconCount} invalid/missing`
				);

				// Başlangıç değeri olarak itemları al
				let finalItems = [...items];

				// Eğer Finder yoksa, ilk sırada ekle
				if (!hasFinderApp && finderIconDataUrl.value) {
					const finderItem = {
						name: "Finder",
						path: "/System/Applications/Finder.app",
						position: "0",
						iconDataUrl: finderIconDataUrl.value,
					};

					finalItems = [finderItem, ...finalItems];
					console.log(
						"[useDockSettings] Added default Finder app to dock items"
					);
				}

				// Eğer Trash yoksa, son sırada ekle
				if (!hasTrashApp && trashIconDataUrl.value) {
					const trashItem = {
						name: "Trash",
						path: "~/.Trash",
						position: "999", // Yüksek değer vererek sona koyuyoruz
						iconDataUrl: trashIconDataUrl.value,
						isDivider: true, // Trash'ten önce ayırıcı göster
					};

					finalItems = [...finalItems, trashItem];
					console.log("[useDockSettings] Added default Trash to dock items");
				}

				dockItems.value = finalItems;
				isSupported.value = true;
			} else {
				console.warn("[useDockSettings] Invalid dock items format", items);

				// Eğer öğe yoksa ve ikonlar varsa, sadece Finder ve Trash ekle
				const newItems = [];

				if (finderIconDataUrl.value) {
					newItems.push({
						name: "Finder",
						path: "/System/Applications/Finder.app",
						position: "0",
						iconDataUrl: finderIconDataUrl.value,
					});
				}

				if (trashIconDataUrl.value) {
					newItems.push({
						name: "Trash",
						path: "~/.Trash",
						position: "999",
						iconDataUrl: trashIconDataUrl.value,
						isDivider: true, // Trash'ten önce ayırıcı göster
					});
				}

				if (newItems.length > 0) {
					dockItems.value = newItems;
					isSupported.value = true;
				} else {
					dockItems.value = [];
				}
			}
		} catch (err) {
			console.error("[useDockSettings] Error fetching dock items:", err);
			error.value = err.message || "Failed to fetch dock items";

			// Hata durumunda, eğer ikonlar varsa, sadece onları göster
			const fallbackItems = [];

			if (finderIconDataUrl.value) {
				fallbackItems.push({
					name: "Finder",
					path: "/System/Applications/Finder.app",
					position: "0",
					iconDataUrl: finderIconDataUrl.value,
				});
			}

			if (trashIconDataUrl.value) {
				fallbackItems.push({
					name: "Trash",
					path: "~/.Trash",
					position: "999",
					iconDataUrl: trashIconDataUrl.value,
					isDivider: true, // Trash'ten önce ayırıcı göster
				});
			}

			if (fallbackItems.length > 0) {
				dockItems.value = fallbackItems;
				isSupported.value = true;
			} else {
				dockItems.value = [];
			}
		} finally {
			isLoading.value = false;
		}
	};

	/**
	 * Dock görünürlüğünü değiştir
	 * @param {boolean} value - Yeni değer
	 */
	const toggleDockVisibility = (value) => {
		console.log(`[useDockSettings] Toggling dock visibility: ${value}`);
		showDockItems.value = value;
	};

	// Görünür dock öğelerini hesapla
	const visibleDockItems = computed(() => {
		if (!showDockItems.value) return [];

		// Sadece ikonları olan öğeleri döndür
		const items = dockItems.value.filter((item) => item.iconDataUrl);
		console.log(
			`[useDockSettings] Visible dock items: ${items.length} of ${dockItems.value.length}`
		);
		return items;
	});

	// Component mounted olduğunda yükle
	onMounted(() => {
		// platform kontrolü
		const isMac = window.navigator.platform.toLowerCase().includes("mac");
		isSupported.value = isMac;

		if (isMac) {
			// Biraz gecikme ekleyerek preload scriptinin düzgün yüklenmesini bekle
			setTimeout(() => {
				fetchDockItems();
			}, 500);
		}
	});

	return {
		isSupported,
		showDockItems,
		dockItems,
		visibleDockItems,
		isLoading,
		error,
		fetchDockItems,
		toggleDockVisibility,
	};
}
