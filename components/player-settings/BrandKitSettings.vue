<template>
	<div class="space-y-4">
		<div class="w-full">
			<h4 class="text-base font-semibold text-white mb-2">Brand Kit</h4>
			<p class="text-sm text-gray-400 mb-4">
				Görsel ve GIF'leri düzenleme alanına ekleyin.
			</p>

			<!-- Dosya seçme bölümü -->
			<div class="border border-white/10 rounded-lg p-4 mb-4">
				<div
					class="border-dashed border-2 border-white/20 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors"
					@click="triggerFileSelection"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-10 w-10 text-white/60 mb-2"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
						/>
					</svg>
					<p class="text-white/80 font-medium">
						Görsel veya GIF eklemek için tıklayın
					</p>
					<p class="text-xs text-white/60 mt-1">PNG, JPG, GIF desteklenir</p>
				</div>
				<input
					ref="fileInputRef"
					type="file"
					accept=".png,.jpg,.jpeg,.gif"
					class="hidden"
					@change="handleFileSelection"
				/>
			</div>

			<!-- Seçilen görseller listesi -->
			<div v-if="selectedMediaFiles.length > 0" class="space-y-2">
				<h5 class="text-sm font-medium text-white">Seçilen Görseller</h5>
				<div class="grid grid-cols-2 gap-2">
					<div
						v-for="(file, index) in selectedMediaFiles"
						:key="index"
						class="relative group border border-white/10 rounded-md overflow-hidden"
					>
						<img
							:src="file.previewUrl"
							class="w-full h-24 object-contain"
							:alt="`Selected media ${index + 1}`"
						/>
						<div
							class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
						>
							<button
								@click="placeOnCanvas(file)"
								class="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded mr-1"
							>
								Yerleştir
							</button>
							<button
								@click="removeFile(index)"
								class="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded"
							>
								Sil
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useIpcRenderer } from "~/composables/useIpcRenderer";

const props = defineProps({
	mediaPlayer: {
		type: Object,
		required: true,
	},
});

const { ipcRenderer } = useIpcRenderer();
const fileInputRef = ref(null);
const selectedMediaFiles = ref([]);

// Kullanıcının dosya seçmesini tetikler
const triggerFileSelection = () => {
	if (fileInputRef.value) {
		fileInputRef.value.click();
	}
};

// Dosya seçildiğinde çalışır
const handleFileSelection = (event) => {
	const file = event.target.files[0];
	if (!file) return;

	// Desteklenen dosya türleri
	const supportedTypes = ["image/png", "image/jpeg", "image/gif"];

	if (!supportedTypes.includes(file.type)) {
		alert("Lütfen desteklenen bir dosya türü seçin (PNG, JPG, GIF)");
		return;
	}

	// Dosyayı önizleme URL'i ile listeye ekle
	const previewUrl = URL.createObjectURL(file);
	selectedMediaFiles.value.push({
		file,
		previewUrl,
		type: file.type,
		name: file.name,
	});

	// Dosya girdisini temizle (aynı dosyayı tekrar seçebilmek için)
	event.target.value = "";
};

// Dosyayı listeden kaldır
const removeFile = (index) => {
	if (selectedMediaFiles.value[index]) {
		// URL'yi serbest bırak
		URL.revokeObjectURL(selectedMediaFiles.value[index].previewUrl);
		// Diziden kaldır
		selectedMediaFiles.value.splice(index, 1);
	}
};

// Görseli canvas'a yerleştir
const placeOnCanvas = (fileData) => {
	// IPC ile Electron'a bildir
	if (window.electron && window.electron.brandKit) {
		window.electron.brandKit.createElementSegment({
			filePath: fileData.previewUrl,
			fileType: fileData.type,
			fileName: fileData.name,
		});
		console.log("[BrandKitSettings] Element gönderildi:", fileData.name);
	} else {
		console.error("[BrandKitSettings] electron.brandKit bulunamadı");
	}
};

// Component kaldırıldığında temizlik yap
onBeforeUnmount(() => {
	// Tüm blob URL'leri temizle
	selectedMediaFiles.value.forEach((file) => {
		URL.revokeObjectURL(file.previewUrl);
	});
});
</script>

<style scoped>
button {
	cursor: pointer;
	user-select: none;
}
</style>
