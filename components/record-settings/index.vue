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
							class="w-32 h-32 flex flex-col items-center justify-between p-3 rounded-xl transition-all border hover:scale-105 transform"
							:class="[
								selectedSourceId === source.id
									? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/25'
									: 'border-gray-700 hover:border-gray-500 hover:bg-gray-700/50 text-gray-300 hover:shadow-lg',
							]"
						>
							<div
								class="w-full h-24 rounded-lg overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center"
							>
								<img
									v-if="source.thumbnail"
									:src="source.thumbnail"
									class="w-full h-full object-contain rounded-lg"
									:alt="source.name"
									loading="lazy"
								/>
								<div
									v-else
									class="w-full h-full flex items-center justify-center text-gray-400 text-xs"
								>
									<div class="flex flex-col items-center gap-1">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-6 w-6"
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
										<span>Yükleniyor...</span>
									</div>
								</div>
							</div>
							<span class="mt-2 text-xs text-center line-clamp-1 font-medium">{{
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
const loading = ref(true);

// Kaynak türüne göre filtreleme - MacRecorder uyumlu
const filteredSources = computed(() => {
	if (selectedSourceType.value === "area") {
		// Alan seçimi için boş liste döndür (alan seçimi manuel yapılır)
		return [];
	}

	return availableSources.value.filter((source) => {
		if (selectedSourceType.value === "display") {
			return source.type === "display" || source.id.startsWith("screen:");
		} else if (selectedSourceType.value === "window") {
			return source.type === "window" || source.id.startsWith("window:");
		}
		return false;
	});
});

// Kaynakları yükle - node-mac-recorder kullan
const loadSources = async () => {
	console.log("[RecordSettings] loadSources başlıyor...");
	try {
		// Electron API kontrolü
		if (!window.electron?.ipcRenderer) {
			console.error("[RecordSettings] Electron IPC bulunamadı!");
			return;
		}

		console.log(
			"[RecordSettings] MacRecorder API'leri kullanılarak kaynaklar alınıyor..."
		);

		try {
			// MacRecorder'dan direkt kaynak al
			const sources = await window.electron?.ipcRenderer.invoke(
				"DESKTOP_CAPTURER_GET_SOURCES",
				{
					types: ["window", "screen"],
					thumbnailSize: { width: 150, height: 150 },
				}
			);

			if (sources && sources.length > 0) {
				console.log(
					`[RecordSettings] ${sources.length} kaynak bulundu (MacRecorder)`
				);

				// Thumbnail'ları yükle - README best practices ile optimize edildi
				const thumbnailPromises = sources.map(async (source) => {
					try {
						// Type özelliği ekle
						if (source.id.startsWith("screen:")) {
							source.type = "display";
						} else if (source.id.startsWith("window:")) {
							source.type = "window";
						}

						let thumbnail = null;

						// README'den optimize edilmiş thumbnail boyutları
						const thumbnailOptions = {
							maxWidth: 160, // Daha iyi görünüm için biraz büyük
							maxHeight: 120,
						};

						if (source.id.startsWith("screen:")) {
							// Display thumbnail'ı al (README API)
							thumbnail = await window.electron?.ipcRenderer.invoke(
								"GET_MAC_SCREEN_THUMBNAIL",
								source.macRecorderId,
								thumbnailOptions
							);
						} else if (source.id.startsWith("window:")) {
							// Window thumbnail'ı al (README API)
							thumbnail = await window.electron?.ipcRenderer.invoke(
								"GET_MAC_WINDOW_THUMBNAIL",
								source.macRecorderId,
								thumbnailOptions
							);
						}

						if (thumbnail) {
							// README'de belirtildiği gibi base64 format gelir
							source.thumbnail = thumbnail;
							console.log(
								`[RecordSettings] Thumbnail başarıyla yüklendi: ${source.name}`
							);
						} else {
							console.warn(
								`[RecordSettings] ${source.name} için thumbnail null geldi`
							);
						}

						return source;
					} catch (thumbnailError) {
						console.warn(
							`[RecordSettings] ${source.name} için thumbnail alınamadı:`,
							thumbnailError.message
						);
						// Hata durumunda da source'u döndür (thumbnail olmadan)
						return source;
					}
				});

				// Tüm thumbnail'ları paralel olarak yükle (README best practice)
				await Promise.allSettled(thumbnailPromises);

				availableSources.value = sources;
				console.log(
					"[RecordSettings] MacRecorder kaynakları başarıyla yüklendi"
				);
				loading.value = false;

				// Default olarak ilk screen item'ını seç
				if (sources.length > 0) {
					const displaySources = sources.filter((source) =>
						source.id.startsWith("screen:")
					);
					if (displaySources.length > 0) {
						console.log(
							"[RecordSettings] Default olarak ilk ekran seçiliyor:",
							displaySources[0]
						);
						selectSource(displaySources[0]);

						// UI'da da seçili göster
						selectedSourceId.value = displaySources[0].id;
					} else if (sources.length > 0) {
						// Hiç ekran yoksa ilk kaynağı seç
						console.log(
							"[RecordSettings] Ekran bulunamadı, ilk kaynağı seçiyor:",
							sources[0]
						);
						selectSource(sources[0]);
						selectedSourceId.value = sources[0].id;
					}
				}

				return;
			} else {
				console.warn("[RecordSettings] MacRecorder'dan kaynak alınamadı");
			}
		} catch (macError) {
			console.error(
				"[RecordSettings] MacRecorder kaynakları alınırken hata:",
				macError
			);
		}

		// MacRecorder başarısız olursa hata mesajı göster
		console.error(
			"[RecordSettings] MacRecorder kullanılamıyor, kaynak bulunamadı"
		);
		availableSources.value = [];
		loading.value = false;
	} catch (error) {
		console.error("Kaynaklar yüklenirken hata:", error);
		loading.value = false;
	}
};

// Kaynak seçimi - MacRecorder uyumlu
const selectSource = async (source) => {
	console.log("🔥🔥🔥 [RecordSettings] KAYNAK SEÇİLDİ:", source);
	console.log(
		"🔥🔥🔥 [RecordSettings] selectedSourceType:",
		selectedSourceType.value
	);
	selectedSourceId.value = source.id;

	// MacRecorder ID'sini kullan
	let sourceData = {
		type: selectedSourceType.value,
		id: source.id,
		name: source.name,
		macRecorderId: source.macRecorderId, // MacRecorder'ın gerçek ID'si
	};

	// Ekstra bilgileri ekle
	if (source.width && source.height) {
		sourceData.width = source.width;
		sourceData.height = source.height;
	}
	if (source.isPrimary !== undefined) {
		sourceData.isPrimary = source.isPrimary;
	}
	if (source.bounds) {
		sourceData.bounds = source.bounds;
	}

	// Seçilen kaynağı screen config'e de güncelle
	if (window.electron?.ipcRenderer) {
		// Kaynak türü ve ID'sini içeren yapılandırma
		const screenConfig = {
			sourceType: selectedSourceType.value,
			sourceId: source.id, // Asıl kaynak ID'sini kullan (screen:0, window:123 format)
			sourceName: source.name,
			// MacRecorder için gerçek ID
			macRecorderId: source.macRecorderId,
		};

		// Alan seçimi ise alanı seçme penceresini aç
		if (selectedSourceType.value === "area") {
			console.log("Alan seçimi başlatılıyor");
			window.electron.ipcRenderer.send("START_AREA_SELECTION");
		} else {
			// Alan seçimi değilse direk olarak kaynak bilgisini güncelle
			console.log(
				"🔧 [RecordSettings] Kayıt kaynağı güncelleniyor:",
				screenConfig
			);

			try {
				const result = await window.electron.ipcRenderer.invoke(
					"UPDATE_RECORDING_SOURCE",
					screenConfig
				);
				console.log(
					"🔧 [RecordSettings] ✅ Kaynak güncelleme başarılı:",
					result
				);

				// Güncellemeden sonra MediaState'i kontrol et
				setTimeout(async () => {
					try {
						const mediaState = await window.electron.ipcRenderer.invoke(
							"GET_MEDIA_STATE"
						);
						console.log(
							"🔧 [RecordSettings] Güncelleme sonrası MediaState:",
							mediaState?.recordingSource
						);
					} catch (stateError) {
						console.error(
							"🔧 [RecordSettings] MediaState kontrol hatası:",
							stateError
						);
					}
				}, 100);
			} catch (error) {
				console.error(
					"🔧 [RecordSettings] ❌ Kaynak güncelleme hatası:",
					error
				);
			}
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
