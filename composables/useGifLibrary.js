import { ref, reactive } from "vue";

// GIF kütüphanesini yöneten composable
export function useGifLibrary() {
	// GIF listesi - standart ve düzenli bir şekilde bir yerde tanımlanır
	const gifItems = reactive([
		{
			id: "duck",
			name: "Duck Dance",
			filename: "duck.gif",
			path: "/gifs/duck.gif",
		},
		{
			id: "expose",
			name: "Expose",
			filename: "expose.gif",
			path: "/gifs/expose.gif",
		},
		{
			id: "loading",
			name: "Loading",
			filename: "loading.gif",
			path: "/gifs/loading.gif",
		},
		{
			id: "pulp",
			name: "Pulp Fiction",
			filename: "pulp.gif",
			path: "/gifs/pulp.gif",
		},
		{
			id: "scrum",
			name: "Scrum",
			filename: "scrum.gif",
			path: "/gifs/scrum.gif",
		},
	]);

	// Uygulamada kullanılacak GIF listesi
	const gifs = ref([]);

	// GIF listesini hazırla - Electron API ile entegre et
	const prepareGifs = async () => {
		if (window.electron) {
			try {
				// GIF dosyalarının konumlarını bul
				const { foundPaths, gifFiles } =
					await window.electron.app.locateGifFiles();
				console.log("GIF dosya yolları:", foundPaths);
				console.log("Bulunan GIF dosyaları:", gifFiles);

				// Her GIF için özellikler ayarla
				const preparedGifs = gifItems.map((item) => {
					// Temel bilgileri al
					const gif = { ...item };

					// Gerçek dosya yolunu ekle - bulunduysa
					if (gifFiles[item.filename]) {
						gif.filePath = gifFiles[item.filename];
					}

					// Gösterim için yol - varsayılan olarak path özelliğini kullan
					gif.displaySrc = gif.path;

					return gif;
				});

				// Hazırlanan GIF'leri ata
				gifs.value = preparedGifs;

				// GIF'leri data URL'e çevir
				if (window.electron && window.electron.app.getFileAsDataUrl) {
					await loadDataUrls();
				}
			} catch (error) {
				console.error("GIF yükleme hatası:", error);
				// Hata durumunda normal yolları kullan
				gifs.value = gifItems.map((item) => ({
					...item,
					displaySrc: item.path,
				}));
			}
		} else {
			// Tarayıcı ortamında veya Electron olmadığında
			gifs.value = gifItems.map((item) => ({ ...item, displaySrc: item.path }));
		}

		return gifs.value;
	};

	// Data URL'leri yükle
	const loadDataUrls = async () => {
		for (const gif of gifs.value) {
			if (gif.filePath) {
				try {
					const dataUrl = await window.electron.app.getFileAsDataUrl(
						gif.filePath
					);
					if (dataUrl) {
						gif.dataUrl = dataUrl;
						gif.displaySrc = dataUrl;
						console.log(`${gif.name} için data URL oluşturuldu`);
					} else {
						// Data URL oluşturulamadıysa, fallback olarak web yolunu kullan
						gif.displaySrc = gif.path;
						console.warn(
							`${gif.name} için data URL oluşturulamadı, web yolu kullanılıyor`
						);
					}
				} catch (error) {
					console.error(`${gif.name} data URL dönüşümü başarısız:`, error);
					// Hata durumunda web yolunu kullan
					gif.displaySrc = gif.path;
				}
			} else {
				// filePath yoksa web yolunu kullan
				gif.displaySrc = gif.path;
				console.warn(
					`${gif.name} için dosya yolu bulunamadı, web yolu kullanılıyor`
				);
			}
		}
	};

	// Yükleme hatası için yardımcı metod
	const handleImageError = (event, gif) => {
		console.error(`${gif.name} resmi yüklenirken hata:`, event);
		// Hata durumunda alternatif yolları dene
		if (gif.dataUrl) {
			console.log(`${gif.name} için data URL kullanılıyor`);
			gif.displaySrc = gif.dataUrl;
		} else if (gif.filePath) {
			console.log(`${gif.name} için dosya yolu kullanılıyor`);
			gif.displaySrc = gif.filePath;
		} else {
			console.log(`${gif.name} için web yolu kullanılıyor`);
			// Yolu düzelt - başında ./ olmadan
			gif.displaySrc = gif.path.startsWith("./")
				? gif.path.substring(2)
				: gif.path;
		}
	};

	// GIF'i formatlanmış şekilde seçmek için yardımcı metod
	const formatGifForSelection = (gif) => {
		return {
			name: gif.name,
			path: gif.filePath || gif.path,
			fallbackPath: gif.path,
			dataUrl: gif.dataUrl,
			// MediaPlayer bileşenine göndermek için ek özellikler eklenebilir
			primaryPath: gif.dataUrl || gif.filePath || gif.path,
		};
	};

	return {
		gifs,
		prepareGifs,
		handleImageError,
		formatGifForSelection,
	};
}
