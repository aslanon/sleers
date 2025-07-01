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

		<!-- Arkaplan Ayarları Tab Yapısı -->
		<div class="space-y-4">
			<div class="w-full">
				<h4 class="text-base font-semibold text-white mb-2">
					Arkaplan Ayarları
				</h4>
				<div class="flex border-b border-zinc-700 mb-4">
					<button
						@click="activeBackgroundTab = 'image'"
						:class="[
							'py-2 px-4 text-sm font-medium focus:outline-none',
							activeBackgroundTab === 'image'
								? 'text-blue-500 border-b-2 border-blue-500'
								: 'text-gray-400 hover:text-gray-300',
						]"
					>
						Görsel
					</button>
					<button
						@click="activeBackgroundTab = 'color'"
						:class="[
							'py-2 px-4 text-sm font-medium focus:outline-none',
							activeBackgroundTab === 'color'
								? 'text-blue-500 border-b-2 border-blue-500'
								: 'text-gray-400 hover:text-gray-300',
						]"
					>
						Renk
					</button>
				</div>

				<!-- Renk Tab İçeriği -->
				<div v-if="activeBackgroundTab === 'color'" class="space-y-4">
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

				<!-- Görsel Tab İçeriği -->
				<div v-if="activeBackgroundTab === 'image'" class="space-y-4">
					<div class="wallpaper-grid">
						<button
							v-for="index in 28"
							:key="`image${index}`"
							@click="selectBackgroundImage(`image${index}`)"
							class="wallpaper-button"
							:class="{
								'wallpaper-button-selected':
									selectedWallpaper === `image${index}`,
							}"
						>
							<img
								:src="`/backgrounds/image${index}.jpg`"
								:alt="`Wallpaper ${index}`"
								class="w-full h-full object-cover"
							/>
						</button>
					</div>

					<SliderInput
						v-model="blurValue"
						label="Blur"
						desc="Video'nun arkaplanının bulanıklığını ayarlar."
						:min="0"
						:max="100"
						:step="5"
						unit="px"
					/>
				</div>
			</div>
		</div>

		<!-- Video Border Ayarları -->
		<div class="space-y-4">
			<!-- Border Kalınlığı -->
			<SliderInput
				v-model="borderWidthValue"
				label="Kenarlık Kalınlığı"
				desc="Video kenarlığının kalınlığını ayarlar."
				:min="0"
				:max="20"
				:step="1"
				unit="px"
			/>

			<!-- Border Rengi -->
			<div
				v-if="borderWidthValue > 0"
				class="flex w-full flex-col gap-2 items-center justify-between"
			>
				<div class="w-full">
					<h4 class="text-base font-semibold text-white">Kenarlık Rengi</h4>
				</div>
				<div class="flex w-full items-center space-x-2">
					<input
						type="color"
						v-model="borderColorHex"
						class="w-8 h-8 rounded cursor-pointer"
						@input="updateBorderColor"
					/>
					<div class="flex flex-col space-y-1">
						<input
							type="text"
							v-model="borderColorHex"
							class="w-20 bg-zinc-800 text-white text-sm rounded-md border border-zinc-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
							placeholder="#RRGGBB"
							@input="updateBorderColor"
						/>
					</div>
				</div>
				<div class="flex w-full items-center space-x-2">
					<SliderInput
						class="w-full"
						v-model="borderOpacityValue"
						desc="Kenarlik opakligi"
						:min="0"
						:max="1"
						:step="0.01"
						unit=""
					/>
				</div>
			</div>
		</div>

		<!-- macOS Dock Ayarı -->
		<div v-if="false" class="space-y-4 border-zinc-700">
			<div class="flex items-center justify-between">
				<div>
					<h4 class="text-base font-semibold text-white">MacOS Dock</h4>
					<p class="text-sm text-gray-400">
						Video'nun altında macOS Dock'u göster
						<span v-if="!isDockSupported" class="text-yellow-500"
							>(Not supported on this platform)</span
						>
					</p>
				</div>
				<div class="flex items-center">
					<label class="switch">
						<input
							type="checkbox"
							v-model="showDockValue"
							@change="updateShowDock"
						/>
						<span class="slider round"></span>
					</label>
				</div>
			</div>

			<!-- Dock Size Slider - Only shown when dock is enabled -->
			<div v-if="showDockValue" class="mt-4">
				<SliderInput
					v-model="dockSizeValue"
					label="Dock Boyutu"
					desc="Dock'un boyutunu ayarlar"
					:min="1"
					:max="6"
					:step="0.1"
					unit="x"
					@input="updateDockSize"
				/>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import useDockSettings from "~/composables/useDockSettings";
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
	backgroundBlur,
	videoBorderSettings,
	updateBackgroundColor,
	updatePadding,
	updateRadius,
	updateShadowSize,
	updateBackgroundImage,
	updateBackgroundBlur,
	updateVideoBorderSettings,
	showDock,
	updateShowDock: updateDockVisibility,
	dockSize,
	updateDockSize: updateDockSizeValue,
} = usePlayerSettings();

// Dock ayarları
const {
	isSupported: isDockSupported,
	showDockItems,
	toggleDockVisibility,
} = useDockSettings();
const showDockValue = ref(showDock.value);
const dockSizeValue = ref(dockSize.value);

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
const blurValue = ref(backgroundBlur.value);
const selectedWallpaper = ref(null);
// Border ayarları için state
const borderWidthValue = ref(videoBorderSettings.value?.width || 0);
const borderColorHex = ref(
	rgbaToHex(videoBorderSettings.value?.color || "rgba(0, 0, 0, 1)")
);
const borderOpacityValue = ref(videoBorderSettings.value?.opacity || 1);
const borderColorValue = ref(
	hexToRgba(borderColorHex.value, borderOpacityValue.value)
);
// Tab yapısı için state
const activeBackgroundTab = ref("image"); // Varsayılan olarak renk tab'ı aktif

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

// Blur değişikliğini izle
watch(blurValue, (newValue) => {
	updateBackgroundBlur(Number(newValue));
});

// Border ayarları değişikliklerini izle
watch(
	[borderWidthValue, borderColorHex, borderOpacityValue],
	([width, colorHex, opacity]) => {
		const rgbaColor = hexToRgba(colorHex, opacity);
		updateVideoBorderSettings({
			width: Number(width),
			color: rgbaColor,
			opacity: opacity,
		});
	}
);

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

watch(
	() => backgroundBlur.value,
	(newValue) => {
		blurValue.value = newValue;
	}
);

// Store'dan gelen border ayarları değişikliklerini izle
watch(
	() => videoBorderSettings.value,
	(newValue) => {
		if (newValue) {
			borderWidthValue.value = newValue.width;
			borderOpacityValue.value = newValue.opacity;
			borderColorHex.value = rgbaToHex(newValue.color);
			borderColorValue.value = newValue.color;
		}
	},
	{ deep: true }
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

// RGBA'dan HEX'e dönüştürme fonksiyonu
function rgbaToHex(rgba) {
	// RGBA formatını parçalara ayır (rgba(r,g,b,a))
	const match = rgba.match(
		/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*\.?\d+))?\)/
	);
	if (!match) return "#000000"; // Varsayılan değer

	const r = parseInt(match[1]);
	const g = parseInt(match[2]);
	const b = parseInt(match[3]);

	// RGB değerlerini HEX'e dönüştür
	return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// HEX'ten RGBA'ya dönüştürme fonksiyonu
function hexToRgba(hex, opacity = 1) {
	// HEX formatını parçalara ayır
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!result) return "rgba(0, 0, 0, " + opacity + ")"; // Varsayılan değer

	const r = parseInt(result[1], 16);
	const g = parseInt(result[2], 16);
	const b = parseInt(result[3], 16);

	// RGBA formatına dönüştür
	return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Renk değişikliğini güncelle
function updateBorderColor() {
	borderColorValue.value = hexToRgba(
		borderColorHex.value,
		borderOpacityValue.value
	);
	updateVideoBorderSettings({
		color: borderColorValue.value,
	});
}

// Opacity değişikliğini güncelle
function updateBorderOpacity() {
	borderColorValue.value = hexToRgba(
		borderColorHex.value,
		borderOpacityValue.value
	);
	updateVideoBorderSettings({
		color: borderColorValue.value,
		opacity: borderOpacityValue.value,
	});
}

// Update dock visibility
function updateShowDock() {
	console.log("[VideoSettings] Updating dock visibility:", {
		oldValue: showDock.value,
		newValue: showDockValue.value,
	});
	toggleDockVisibility(showDockValue.value);
	updateDockVisibility(showDockValue.value);
}

// Update dock size
function updateDockSize() {
	console.log("[VideoSettings] Updating dock size:", {
		oldValue: dockSize.value,
		newValue: dockSizeValue.value,
	});
	updateDockSizeValue(dockSizeValue.value);
}

// Store'dan gelen dock ayarlarını izle
watch(
	() => showDockItems.value,
	(newValue) => {
		showDockValue.value = newValue;
	}
);

// Store'dan gelen dock size ayarını izle
watch(
	() => dockSize.value,
	(newValue) => {
		dockSizeValue.value = newValue;
	}
);
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
	@apply grid grid-cols-9 gap-2 w-max mt-4;
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
	grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
	gap: 4px;
	margin-top: 8px;
}

.wallpaper-button {
	aspect-ratio: 16/9;
	border-radius: 8px;
	overflow: hidden;
	border: 2px solid transparent;
	transition: all 0.2s;
	cursor: pointer;
	width: 48px;
}

.wallpaper-button:hover {
	transform: scale(1.2);
}

.wallpaper-button-selected {
	border-color: #ffffff;
}

/* Switch toggle styles */
.switch {
	position: relative;
	display: inline-block;
	width: 50px;
	height: 24px;
}

.switch input {
	opacity: 0;
	width: 0;
	height: 0;
}

.slider {
	position: absolute;
	cursor: pointer;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-color: #3a3a3a;
	transition: 0.4s;
}

.slider:before {
	position: absolute;
	content: "";
	height: 18px;
	width: 18px;
	left: 3px;
	bottom: 3px;
	background-color: white;
	transition: 0.4s;
}

input:checked + .slider {
	background-color: #2196f3;
}

input:focus + .slider {
	box-shadow: 0 0 1px #2196f3;
}

input:checked + .slider:before {
	transform: translateX(26px);
}

.slider.round {
	border-radius: 24px;
}

.slider.round:before {
	border-radius: 50%;
}
</style>
