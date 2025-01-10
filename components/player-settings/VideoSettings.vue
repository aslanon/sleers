<template>
	<div class="flex flex-col gap-4">
		<div class="setting-group">
			<label class="setting-label">Padding</label>
			<div class="setting-control">
				<input
					type="range"
					v-model="paddingValue"
					min="0"
					max="100"
					step="4"
					class="setting-slider"
				/>
				<span class="setting-value">{{ paddingValue }}px</span>
			</div>
		</div>

		<div class="setting-group">
			<label class="setting-label">Radius</label>
			<div class="setting-control">
				<input
					type="range"
					v-model="radiusValue"
					min="0"
					max="50"
					step="2"
					class="setting-slider"
				/>
				<span class="setting-value">{{ radiusValue }}px</span>
			</div>
		</div>

		<div class="setting-group">
			<label class="setting-label">Shadow</label>
			<div class="setting-control">
				<input
					type="range"
					v-model="shadowValue"
					min="0"
					max="100"
					step="5"
					class="setting-slider"
				/>
				<span class="setting-value">{{ shadowValue }}px</span>
			</div>
		</div>

		<div class="setting-group">
			<label class="setting-label">Arkaplan Rengi</label>
			<div class="color-grid">
				<button
					v-for="color in colors"
					:key="color"
					@click="selectColor(color)"
					class="color-button"
					:class="
						color === selectedColor
							? 'color-button-selected'
							: 'color-button-unselected'
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

<style scoped>
.setting-group {
	@apply flex flex-col gap-2;
}

.setting-label {
	@apply text-sm font-medium text-gray-300;
}

.setting-control {
	@apply flex items-center gap-3;
}

.setting-slider {
	@apply w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer;
}

.setting-slider::-webkit-slider-thumb {
	@apply appearance-none w-4 h-4 bg-blue-500 rounded-full cursor-pointer hover:bg-blue-400 transition-colors;
	box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.setting-slider::-webkit-slider-thumb:hover {
	@apply bg-blue-400;
	box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.2);
}

.setting-value {
	@apply text-sm text-gray-300 min-w-[3rem] text-right font-medium;
}

.setting-select {
	@apply w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
}

.color-grid {
	@apply grid grid-cols-12 gap-2 w-max mt-4;
}

.color-button {
	@apply w-6 h-6 m-auto rounded-lg border-2 border-white/20 transition-all hover:scale-110;
}

.color-button-selected {
	@apply border-white shadow-lg;
}

.color-button-unselected {
	@apply border-transparent;
}
</style>
