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

	/**
	 * Dock öğelerini ana süreçten al
	 */
	const fetchDockItems = async () => {
		if (!window.dockAPI) {
			console.error("[useDockSettings] Dock API not available");
			return;
		}

		isLoading.value = true;
		error.value = null;

		try {
			// Dock öğelerini doğrudan al
			console.log("[useDockSettings] Fetching dock items");
			const items = await window.dockAPI.getDockIcons();
			console.log(`[useDockSettings] Got ${items?.length || 0} dock items`);

			// Icon durumlarını kontrol et
			let validIconCount = 0;
			let invalidIconCount = 0;

			if (items && Array.isArray(items)) {
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
				dockItems.value = items;
				isSupported.value = true;
			} else {
				console.warn("[useDockSettings] Invalid dock items format", items);
				dockItems.value = [];
			}
		} catch (err) {
			console.error("[useDockSettings] Error fetching dock items:", err);
			error.value = err.message || "Failed to fetch dock items";
			dockItems.value = [];
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
