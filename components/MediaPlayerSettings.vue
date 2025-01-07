<template>
	<div class="media-player-settings bg-white/10 w-80 ml-4 rounded-lg p-4">
		<!-- Tab yapısı -->
		<div class="flex">
			<!-- Tab listesi -->
			<div class="w-1/3 space-y-2 border-r border-white/10 pr-4">
				<button
					v-for="tab in tabs"
					:key="tab.id"
					@click="currentTab = tab.id"
					class="w-full text-left px-3 py-2 rounded-lg transition-colors"
					:class="{
						'bg-white/10 font-medium': currentTab === tab.id,
						'hover:bg-white/5': currentTab !== tab.id,
					}"
				>
					{{ tab.name }}
				</button>
			</div>

			<!-- Tab içerikleri -->
			<div class="w-2/3 pl-4">
				<!-- Video Bilgileri Tab -->
				<div v-if="currentTab === 'video'" class="space-y-4">
					<h2 class="text-xl font-bold mb-4">Video Ayarları</h2>
					<div>
						<label class="block text-sm font-medium mb-1">Video Süresi</label>
						<span class="text-gray-300">{{ formatDuration(duration) }}</span>
					</div>

					<div>
						<label class="block text-sm font-medium mb-1">Boyut</label>
						<span class="text-gray-300">{{ width }}x{{ height }}</span>
					</div>
				</div>

				<!-- Mouse Ayarları Tab -->
				<div v-if="currentTab === 'mouse'" class="space-y-4">
					<h2 class="text-xl font-bold mb-4">Mouse Ayarları</h2>
					<div>
						<label class="block text-sm font-medium mb-2">Mouse Boyutu</label>
						<div class="flex items-center space-x-2">
							<input
								type="range"
								:value="mouseSize"
								@input="updateMouseSize($event.target.value)"
								min="20"
								max="100"
								step="1"
								class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
							/>
							<span class="text-sm text-gray-300 w-8">{{ mouseSize }}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, watch } from "vue";

const props = defineProps({
	duration: {
		type: Number,
		required: true,
		validator: (value) => value >= 0,
	},
	width: {
		type: Number,
		required: true,
		default: 1920,
	},
	height: {
		type: Number,
		required: true,
		default: 1080,
	},
	modelValue: {
		type: Number,
		default: 42,
	},
});

const emit = defineEmits(["update:modelValue"]);

// Tab yönetimi
const tabs = [
	{ id: "video", name: "Video" },
	{ id: "mouse", name: "Mouse" },
];
const currentTab = ref("video");

// Mouse ayarları
const mouseSize = ref(props.modelValue);

// Mouse size güncelleme fonksiyonu
const updateMouseSize = (value) => {
	const numValue = Number(value);
	mouseSize.value = numValue;
	emit("update:modelValue", numValue);
};

// Prop değişikliğini izle ve local state'i güncelle
watch(
	() => props.modelValue,
	(newValue) => {
		if (newValue !== mouseSize.value) {
			mouseSize.value = newValue;
		}
	},
	{ immediate: true }
);

// Süre formatı
const formatDuration = (seconds) => {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};
</script>

<style scoped>
/* Range input stil */
input[type="range"]::-webkit-slider-thumb {
	-webkit-appearance: none;
	appearance: none;
	width: 16px;
	height: 16px;
	background: white;
	border-radius: 50%;
	cursor: pointer;
}

input[type="range"]::-moz-range-thumb {
	width: 16px;
	height: 16px;
	background: white;
	border-radius: 50%;
	cursor: pointer;
	border: none;
}
</style>
