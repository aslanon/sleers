<template>
	<div class="space-y-4">
		<!-- <h2 class="text-xl font-bold mb-4">Video Ayarları</h2>
		<div>
			<label class="block text-sm font-medium mb-1">Video Süresi</label>
			<span class="text-gray-300">{{ formatDuration(duration) }}</span>
		</div>

		<div>
			<label class="block text-sm font-medium mb-1">Boyut</label>
			<span class="text-gray-300">{{ width }}x{{ height }}</span>
		</div> -->

		<div>
			<label class="block text-sm font-medium mb-1">Padding</label>
			<input
				type="range"
				v-model="paddingValue"
				min="0"
				max="100"
				step="4"
				class="w-full"
			/>
			<span class="text-gray-300">{{ paddingValue }}px</span>
		</div>

		<div>
			<label class="block text-sm font-medium mb-1">Radius</label>
			<input
				type="range"
				v-model="radiusValue"
				min="0"
				max="50"
				step="2"
				class="w-full"
			/>
			<span class="text-gray-300">{{ radiusValue }}px</span>
		</div>

		<div>
			<label class="block text-sm font-medium mb-1">Shadow</label>
			<input
				type="range"
				v-model="shadowValue"
				min="0"
				max="100"
				step="5"
				class="w-full"
			/>
			<span class="text-gray-300">{{ shadowValue }}px</span>
		</div>

		<div>
			<label class="block text-sm font-medium mb-1">Arkaplan Rengi</label>
			<div class="grid grid-cols-12 gap-2 w-max mt-4">
				<button
					v-for="color in colors"
					:key="color"
					@click="selectColor(color)"
					class="w-6 h-6 m-auto rounded-lg border-2 transition-all"
					:class="
						color === selectedColor ? 'border-white' : 'border-transparent'
					"
					:style="{ backgroundColor: color }"
				></button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, watch } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";

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
});

const {
	backgroundColor,
	padding,
	radius,
	shadowSize,
	updateBackgroundColor,
	updatePadding,
	updateRadius,
	updateShadowSize,
} = usePlayerSettings();

// Renk paleti
const colors = [
	"#000000", // Siyah
	"#F8F9FA", // Beyaz
	"#1A1A1A", // Koyu Gri
	"#2C3E50", // Slate
	"#34495E", // Wet Asphalt
	"#95A5A6", // Concrete

	"#FF6B6B", // Canlı Kırmızı
	"#FF8787", // Açık Kırmızı
	"#FFB3BA", // Pastel Pembe
	"#FEC8D8", // Açık Pembe
	"#FF69B4", // Hot Pink
	"#E84393", // Fuşya

	"#4ECB71", // Canlı Yeşil
	"#BAFFC9", // Pastel Yeşil
	"#A8E6CF", // Nane Yeşili
	"#98FB98", // Açık Yeşil
	"#00B894", // Mint Leaf
	"#20BF6B", // Emerald

	"#4B7BEC", // Canlı Mavi
	"#BAE1FF", // Pastel Mavi
	"#74B9FF", // Elektrik Mavi
	"#00CEC9", // Robin's Egg Blue
	"#48DBFB", // Picton Mavi
	"#0984E3", // Elektrik Mavi

	"#FDA7DF", // Orkide
	"#E0BBE4", // Pastel Mor
	"#D4A5A5", // Rosy Brown
	"#9B59B6", // Ametist
	"#8E44AD", // Wisteria
	"#DCD3FF", // Pastel Leylak

	"#FFA502", // Turuncu
	"#FFE4B5", // Pastel Turuncu
	"#F4D03F", // Sarı
	"#F1C40F", // Güneş Sarısı
	"#FFCCB6", // Şeftali
	"#FFC8A2", // Somon
];

// Local state
const selectedColor = ref(backgroundColor.value);
const paddingValue = ref(padding.value);
const radiusValue = ref(radius.value);
const shadowValue = ref(shadowSize.value);

// Renk seçimi
const selectColor = (color) => {
	selectedColor.value = color;
	updateBackgroundColor(color);
};

// Padding değişikliğini izle
watch(paddingValue, (newValue) => {
	updatePadding(Number(newValue));
});

// Radius değişikliğini izle
watch(radiusValue, (newValue) => {
	updateRadius(Number(newValue));
});

// Shadow değişikliğini izle
watch(shadowValue, (newValue) => {
	updateShadowSize(Number(newValue));
});

// Store'dan gelen değişiklikleri izle
watch(
	() => backgroundColor.value,
	(newValue) => {
		selectedColor.value = newValue;
	}
);

watch(
	() => padding.value,
	(newValue) => {
		paddingValue.value = newValue;
	}
);

watch(
	() => radius.value,
	(newValue) => {
		radiusValue.value = newValue;
	}
);

watch(
	() => shadowSize.value,
	(newValue) => {
		shadowValue.value = newValue;
	}
);

// Süre formatı
const formatDuration = (seconds) => {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};
</script>
