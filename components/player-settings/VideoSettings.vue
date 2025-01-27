<template>
	<div class="flex flex-col gap-12 pb-12">
		<!-- <div class="space-y-2">
			<h3 class="text-lg font-medium">Video Ayarları</h3>
			<p class="text-sm text-gray-400">
				Video görüntüsü için ayarları buradan yapabilirsiniz.
			</p>
		</div> -->
		<SliderInput
			v-model="paddingValue"
			label="Padding"
			desc="Video'nun kenarlarına eklenen boşluk vererek daha güzel görünmesini sağlar."
			:min="0"
			:max="200"
			:step="4"
			unit="px"
		/>

		<SliderInput
			v-model="radiusValue"
			label="Radius"
			desc="Video'nun köşelerinin yuvarlaklığını ayarlar."
			:min="0"
			:max="320"
			:step="2"
			unit="px"
		/>

		<SliderInput
			v-model="shadowValue"
			label="Shadow"
			desc="Video'nun gölgesinin opaklığını ayarlar."
			:min="0"
			:max="100"
			:step="5"
			unit="px"
		/>

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

		<div class="setting-group">
			<label class="setting-label">Arkaplan Görseli</label>
			<div class="wallpaper-grid">
				<button
					v-for="index in 23"
					:key="`image${index}`"
					@click="selectBackgroundImage(`image${index}`)"
					class="wallpaper-button"
					:class="{
						'wallpaper-button-selected': selectedWallpaper === `image${index}`,
					}"
				>
					<img
						:src="`/backgrounds/image${index}.jpg`"
						:alt="`Wallpaper ${index}`"
						class="w-full h-full object-cover"
					/>
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, watch } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import SliderInput from "~/components/ui/SliderInput.vue";

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
	updateBackgroundImage,
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
const selectedWallpaper = ref(null);

// Renk seçimi
const selectColor = (color) => {
	selectedColor.value = color;
	updateBackgroundColor(color);
};

// Arkaplan görseli seçimi
const selectBackgroundImage = (imageName) => {
	selectedWallpaper.value = imageName;
	updateBackgroundImage(`/backgrounds/${imageName}.jpg`);
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

// Progress çizgisini güncelle
const updateProgress = (e) => {
	const input = e.target;
	const value = input.value;
	const min = input.min || 0;
	const max = input.max || 100;
	const progress = ((value - min) / (max - min)) * 100;
	input.style.setProperty("--progress", `${progress}%`);
};

// Event listener'ları ekle
onMounted(() => {
	const sliders = document.querySelectorAll(".setting-slider");
	sliders.forEach((slider) => {
		// Initial progress
		updateProgress({ target: slider });
		// Input event
		slider.addEventListener("input", updateProgress);
	});
});
</script>

<style scoped>
.setting-label {
	@apply text-base font-semibold text-gray-300;
}

.setting-desc {
	@apply text-sm font-semibold text-gray-500;
}

.setting-group {
	@apply flex flex-col gap-2;
}

.color-grid {
	@apply grid grid-cols-12 gap-2 w-max mt-4;
}

.color-button {
	@apply w-6 h-6 m-auto rounded-lg border-2 border-white/20 transition-all hover:scale-150;
}

.color-button-selected {
	@apply border-white shadow-lg;
}

.color-button-unselected {
	@apply border-transparent;
}

.wallpaper-grid {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 8px;
	margin-top: 8px;
}

.wallpaper-button {
	aspect-ratio: 16/9;
	border-radius: 8px;
	overflow: hidden;
	border: 2px solid transparent;
	transition: all 0.2s;
	cursor: pointer;
}

.wallpaper-button:hover {
	transform: scale(1.2);
}

.wallpaper-button-selected {
	border-color: #ffffff;
}
</style>
