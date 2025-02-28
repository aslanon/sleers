<template>
	<div class="gif-settings">
		<h3 class="text-white text-lg font-semibold mb-4">Gif Galerisi</h3>

		<!-- Yükleme durumu -->
		<div v-if="isLoading" class="text-white/60 text-center py-8">
			<div
				class="animate-spin h-8 w-8 border-4 border-white/20 border-t-white/80 rounded-full mx-auto mb-2"
			></div>
			<p>GIF'ler yükleniyor...</p>
		</div>

		<!-- GIF listesi -->
		<div v-else-if="gifs.length > 0" class="grid grid-cols-3 gap-4">
			<div
				v-for="gif in gifs"
				:key="gif.id"
				class="gif-item p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
				@click="selectGif(gif)"
			>
				<div
					class="relative w-full h-32 rounded border border-white/10 overflow-hidden"
				>
					<img
						:src="gif.displaySrc"
						:alt="gif.name"
						class="w-full h-full object-cover"
						@error="handleGifError($event, gif)"
					/>
					<!-- Yükleme hatası durumunda gösterilecek uyarı -->
					<div
						v-if="gif.hasError"
						class="absolute inset-0 bg-black/50 flex items-center justify-center"
					>
						<span class="text-white/80 text-xs text-center px-2"
							>Görüntü yüklenemedi</span
						>
					</div>
				</div>
				<p class="text-white/80 text-sm mt-2 truncate">{{ gif.name }}</p>
			</div>
		</div>

		<!-- GIF bulunamadı durumu -->
		<div v-else class="text-white/60 text-center py-8">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-12 w-12 mx-auto mb-2 text-white/40"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
			<p>Yüklenecek gif bulunamadı.</p>
			<p class="text-xs mt-2">public/gifs klasörünü kontrol edin</p>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useGifLibrary } from "~/composables/useGifLibrary";

const props = defineProps({
	mediaPlayer: {
		type: Object,
		required: false,
	},
});

const emit = defineEmits(["gif-selected"]);

// Yükleme durumu
const isLoading = ref(true);

// GIF kütüphanesini kullan
const { gifs, prepareGifs, handleImageError, formatGifForSelection } =
	useGifLibrary();

// Bileşen yüklendiğinde GIF'leri hazırla
onMounted(async () => {
	try {
		isLoading.value = true;
		await prepareGifs();
		console.log("GIF'ler hazırlandı:", gifs.value);
	} catch (error) {
		console.error("GIF hazırlama hatası:", error);
	} finally {
		isLoading.value = false;
	}
});

// Görüntü yükleme hatası
const handleGifError = (event, gif) => {
	console.error(`${gif.name} resmi yüklenirken hata:`, event);

	// Hata durumunu işaretle
	gif.hasError = true;

	// Hata işleme fonksiyonunu çağır
	handleImageError(event, gif);

	// 500ms sonra tekrar yüklemeyi dene
	setTimeout(() => {
		console.log(`${gif.name} için tekrar yükleme deneniyor...`);
		// Yeni bir görüntü elementi oluştur ve src'yi güncelle
		const img = new Image();
		img.onload = () => {
			console.log(`${gif.name} başarıyla yeniden yüklendi`);
			gif.hasError = false;
			gif.displaySrc = img.src;
		};
		img.onerror = () => {
			console.error(`${gif.name} tekrar yüklenemedi`);
			gif.hasError = true;
		};
		img.src = gif.dataUrl || gif.filePath || gif.path;
	}, 500);
};

// GIF seçildiğinde
const selectGif = (gif) => {
	// Hata durumunda seçime izin verme
	if (gif.hasError) {
		console.warn("Hatalı GIF seçilemez:", gif.name);
		return;
	}

	// Debug log
	console.log("GIF seçildi:", gif);

	// Seçilen GIF'i formatlayarak MediaPlayer'a uygun hale getir
	const formattedGif = formatGifForSelection(gif);

	// Event'i gönder
	emit("gif-selected", formattedGif);

	// Media player varsa ve gif ekleme metodu varsa kullan
	if (props.mediaPlayer && typeof props.mediaPlayer.addGif === "function") {
		try {
			// İki yolu da dene - addGif içinde hata işlenecek
			props.mediaPlayer.addGif({
				// Önce data URL'i dene, yoksa dosya yolunu kullan
				primaryPath: formattedGif.primaryPath,
				fallbackPath: formattedGif.fallbackPath,
			});
			console.log("GIF ekleme çağrısı yapıldı:", formattedGif.primaryPath);
		} catch (error) {
			console.error("GIF eklenirken hata:", error);
		}
	} else {
		console.warn("MediaPlayer hazır değil veya addGif metodu bulunamadı");
	}
};
</script>

<style scoped>
.gif-settings {
	padding: 0 1rem;
}

.gif-item {
	transition: transform 0.2s ease-in-out;
}

.gif-item:hover {
	transform: scale(1.05);
}

@keyframes spin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

.animate-spin {
	animation: spin 1s linear infinite;
}
</style>
