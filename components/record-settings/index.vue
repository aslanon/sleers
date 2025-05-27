<template>
	<div
		class="w-full border border-gray-700 rounded-xl bg-[#1a1b26]/90 backdrop-blur-3xl p-4 shadow-lg mt-2"
	>
		<div class="flex flex-col space-y-4">
			<!-- Kayıt Kaynağı -->
			<div class="text-white">
				<div class="text-sm font-medium text-white mb-2">Kayıt Kaynağı</div>
				<div class="flex flex-wrap gap-2">
					<button
						v-for="source in sources"
						:key="source.id"
						@click="selectedSourceType = source.id"
						class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
						:class="
							selectedSourceType === source.id
								? 'bg-blue-600'
								: 'bg-gray-700 hover:bg-gray-600'
						"
					>
						<span v-html="source.icon"></span>
						{{ source.label }}
					</button>
				</div>

				<!-- Kaynak Listesi -->
				<div v-if="availableSources.length > 0" class="mt-3">
					<div class="flex flex-wrap gap-3">
						<button
							v-for="source in filteredSources"
							:key="source.id"
							@click="selectSource(source)"
							class="max-w h-28 flex flex-col items-center justify-between p-2 rounded-lg transition-all border"
							:class="[
								selectedSourceId === source.id
									? 'bg-blue-500/20 border-blue-500 text-blue-400'
									: 'border-gray-700 hover:border-gray-500 hover:bg-gray-700/50 text-gray-300',
							]"
						>
							<div
								class="w-full aspect-video rounded-lg overflow-hidden bg-black/50"
							>
								<img
									:src="source.thumbnail.toDataURL()"
									class="w-[100px] h-24 m-auto object-contain"
									:alt="source.name"
								/>
							</div>
							<span class="mt-2 text-xs text-center line-clamp-1">{{
								source.name
							}}</span>
						</button>
					</div>
				</div>
			</div>

			<div class="border-t border-gray-700 my-2"></div>
			<!-- Kayıt Gecikmesi -->
			<div class="text-white">
				<div class="text-sm font-medium text-white mb-2">Kayıt Gecikmesi</div>
				<div class="flex flex-wrap gap-2">
					<button
						v-for="delay in delayOptions"
						:key="delay"
						@click="selectDelay(delay)"
						class="px-3 py-1 rounded-lg text-sm"
						:class="
							modelValue === delay
								? 'bg-blue-600'
								: 'bg-gray-700 hover:bg-gray-600'
						"
					>
						{{ delay / 1000 }}sn
					</button>
				</div>
			</div>

			<div class="border-t border-gray-700 my-2"></div>

			<!-- Kamera Ayarları -->
			<div class="text-white">
				<div class="text-sm font-medium text-white mb-2">Kamera Ayarları</div>
				<div class="flex items-center gap-2">
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							:checked="followMouse"
							@change="toggleFollowMouse"
							class="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-700 bg-gray-800 focus:ring-blue-500"
						/>
						<span class="text-sm">Kamera fare imlecini takip etsin</span>
					</label>
				</div>
			</div>

			<div class="border-t border-gray-700 my-2"></div>

			<slot></slot>
		</div>
	</div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from "vue";
import { useMediaDevices } from "~/composables/useMediaDevices";

const { selectedDelay } = useMediaDevices();

const props = defineProps({
	delayOptions: {
		type: Array,
		default: () => [0, 1000, 3002, 5000, 10000],
	},
	modelValue: {
		type: Number,
		default: 1000,
	},
	selectedSource: {
		type: Object,
		default: () => ({
			type: "display",
			id: null,
			name: null,
		}),
	},
	followMouse: {
		type: Boolean,
		default: true,
	},
});

const emit = defineEmits([
	"update:modelValue",
	"update:selectedSource",
	"update:followMouse",
]);

// Kayıt kaynakları
const sources = computed(() => [
	{
		id: "display",
		label: "Ekran",
		icon: `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      `,
	},
	{
		id: "window",
		label: "Pencere",
		icon: `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      `,
	},
	{
		id: "area",
		label: "Alan",
		icon: `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      `,
	},
]);

// Kaynak yönetimi için state'ler
const selectedSourceType = ref("display");
const selectedSourceId = ref(null);
const availableSources = ref([]);

// Kaynak türüne göre filtreleme
const filteredSources = computed(() => {
	return availableSources.value.filter((source) =>
		source.id.startsWith(
			selectedSourceType.value === "display" ? "screen:" : "window:"
		)
	);
});

// Kaynakları yükle
const loadSources = async () => {
	try {
		// Desktop Capturer kaynakları
		const sources = await window.electron?.desktopCapturer.getSources({
			types: ["window", "screen"],
			thumbnailSize: { width: 150, height: 150 },
		});
		availableSources.value = sources || [];

		// Aperture ekran listesini de al
		const apertureScreens = await window.electron?.aperture.getScreens();
		console.log("Aperture ekranları:", apertureScreens);

		// Ekranlara Aperture ID'lerini ekle
		if (apertureScreens && apertureScreens.length) {
			availableSources.value.forEach((source) => {
				if (source.apertureId) {
					console.log(
						`Ekran: ${source.name} - Aperture ID: ${source.apertureId}`
					);
				}
			});
		}

		// Eğer önceden seçili bir kaynak yoksa ve kaynaklar yüklendiyse ilk kaynağı seç
		if (availableSources.value.length > 0 && !selectedSourceId.value) {
			const defaultSource = filteredSources.value[0];
			if (defaultSource) {
				selectSource(defaultSource);
			}
		}
	} catch (error) {
		console.error("Kaynaklar yüklenirken hata:", error);
	}
};

// Kaynak seçimi
const selectSource = (source) => {
	console.log("Kaynak seçildi:", source);
	selectedSourceId.value = source.id;

	// Aperture ID varsa kullan
	let sourceData = {
		type: selectedSourceType.value,
		id: source.id,
		name: source.name,
	};

	// Aperture ID varsa ekle
	if (source.apertureId) {
		sourceData.apertureId = source.apertureId;
	}

	// Seçilen kaynağı screen config'e de güncelle
	if (window.electron?.ipcRenderer) {
		// Kaynak türü ve ID'sini içeren yapılandırma
		const screenConfig = {
			sourceType: selectedSourceType.value,
			sourceId: source.id,
			sourceName: source.name,
			apertureId: source.apertureId,
		};

		// Alan seçimi ise alanı seçme penceresini aç
		if (selectedSourceType.value === "area") {
			console.log("Alan seçimi başlatılıyor");
			window.electron.ipcRenderer.send(
				window.electron.ipcRenderer.IPC_EVENTS.START_AREA_SELECTION
			);
		} else {
			// Alan seçimi değilse direk olarak kaynak bilgisini güncelle
			console.log("Kayıt kaynağı güncelleniyor:", screenConfig);
			window.electron.ipcRenderer.send("UPDATE_RECORDING_SOURCE", screenConfig);
		}
	} else {
		console.error("Electron API bulunamadı - kaynak seçimi güncellenemedi");
	}

	emit("update:selectedSource", sourceData);
};

// Kaynak türü değişince kaynakları yeniden yükle
watch(selectedSourceType, () => {
	loadSources();
});

onMounted(() => {
	loadSources();
});

// Delay seçimi
const selectDelay = (delay) => {
	emit("update:modelValue", delay);
};

// Kamera takip ayarı
const toggleFollowMouse = (event) => {
	const isChecked = event.target.checked;

	window.electron.ipcRenderer.send("UPDATE_EDITOR_SETTINGS", {
		camera: {
			followMouse: isChecked,
		},
	});

	emit("update:followMouse", isChecked);
};
</script>
