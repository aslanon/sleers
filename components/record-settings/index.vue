<template>
	<div
		class="w-full border border-gray-700 rounded-xl bg-[#1a1b26]/90 backdrop-blur-3xl p-4 shadow-lg mt-2"
	>
		<div class="flex flex-col space-y-4">
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
							selectedDelay === delay
								? 'bg-blue-600'
								: 'bg-gray-700 hover:bg-gray-600'
						"
					>
						{{ delay / 1000 }}sn
					</button>
				</div>
			</div>

			<div class="border-t border-gray-700 my-2"></div>

			<!-- Kayıt Kaynağı -->
			<div class="text-white">
				<div class="text-sm font-medium text-white mb-2">Kayıt Kaynağı</div>
				<div class="flex flex-wrap gap-2">
					<button
						v-for="source in sources"
						:key="source.id"
						@click="selectSource(source.id)"
						class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
						:class="
							selectedSource === source.id
								? 'bg-blue-600'
								: 'bg-gray-700 hover:bg-gray-600'
						"
					>
						<span v-html="source.icon"></span>
						{{ source.label }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
	delayOptions: {
		type: Array,
		default: () => [0, 1000, 3000, 5000],
	},
	selectedDelay: {
		type: Number,
		default: 1000,
	},
	selectedSource: {
		type: String,
		default: "display",
	},
});

const emit = defineEmits(["update:selectedDelay", "update:selectedSource"]);

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

// Delay seçimi
const selectDelay = (delay) => {
	emit("update:selectedDelay", delay);
};

// Kaynak seçimi
const selectSource = (source) => {
	emit("update:selectedSource", source);
	// Alan seçimi yapılacaksa electron event'ini tetikle
	if (source === "area") {
		window.electron?.ipcRenderer.send("START_AREA_SELECTION");
	}
};
</script>
