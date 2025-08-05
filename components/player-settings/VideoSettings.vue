<template>
	<div class="flex flex-col w-full min-h-[550px] min-w-[350px] gap-12 pb-12">
		<!-- <div class="space-y-2">
			<h3 class="text-lg font-medium">Video Settings</h3>
			<p class="text-sm text-gray-400">
				You can configure video image settings from here.
			</p>
		</div> -->
		<SliderInput
			v-if="hasVideo"
			v-model="paddingValue"
			label="Padding"
			desc="Adds spacing to video edges for better appearance."
			:min="0"
			:max="200"
			:step="4"
			unit="px"
		/>

		<SliderInput
			v-if="hasVideo"
			v-model="radiusValue"
			label="Radius"
			desc="Adjusts video corner roundness."
			:min="0"
			:max="320"
			:step="2"
			unit="px"
		/>

		<SliderInput
			v-if="hasVideo"
			v-model="shadowValue"
			label="Shadow"
			desc="Adjusts video shadow opacity."
			:min="0"
			:max="100"
			:step="5"
			unit="px"
		/>

		<!-- Arkaplan Ayarları Tab Yapısı -->
		<div class="space-y-4">
			<div class="w-full">
				<h4 class="text-base font-semibold text-white mb-2">
					Background Settings
				</h4>
				<div class="flex border-b border-zinc-700 mb-4">
					<button
						@click="setActiveBackgroundTab('image')"
						:class="[
							'py-2 px-4 text-sm font-medium focus:outline-none',
							activeBackgroundTab === 'image'
								? 'text-blue-500 border-b-2 border-blue-500'
								: 'text-gray-400 hover:text-gray-300',
						]"
					>
						Image
					</button>
					<button
						@click="setActiveBackgroundTab('color')"
						:class="[
							'py-2 px-4 text-sm font-medium focus:outline-none',
							activeBackgroundTab === 'color'
								? 'text-blue-500 border-b-2 border-blue-500'
								: 'text-gray-400 hover:text-gray-300',
						]"
					>
						Color
					</button>
					<button
						@click="setActiveBackgroundTab('gradient')"
						:class="[
							'py-2 px-4 text-sm font-medium focus:outline-none',
							activeBackgroundTab === 'gradient'
								? 'text-blue-500 border-b-2 border-blue-500'
								: 'text-gray-400 hover:text-gray-300',
						]"
					>
						Gradient
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

				<!-- Gradient Tab İçeriği -->
				<div v-if="activeBackgroundTab === 'gradient'" class="space-y-4">
					<!-- Gradient Grid - Color tab tarzında -->
					<div class="gradient-grid">
						<button
							v-for="(gradient, index) in predefinedGradients"
							:key="index"
							@click="selectPredefinedGradient(gradient)"
							class="gradient-button"
							:class="[
								JSON.stringify(backgroundGradient.colors) === JSON.stringify(gradient.colors)
									? 'gradient-button-selected'
									: 'gradient-button-unselected'
							]"
							:style="{
								background: gradient.type === 'linear' 
									? `linear-gradient(${gradient.direction === 'to-bottom' ? 'to bottom' : 
									   gradient.direction === 'to-top' ? 'to top' :
									   gradient.direction === 'to-left' ? 'to left' :
									   gradient.direction === 'to-right' ? 'to right' :
									   gradient.direction === 'to-top-left' ? 'to top left' :
									   gradient.direction === 'to-top-right' ? 'to top right' :
									   gradient.direction === 'to-bottom-left' ? 'to bottom left' :
									   gradient.direction === 'to-bottom-right' ? 'to bottom right' : 'to bottom'}, ${gradient.colors.map(c => `${c.color} ${c.position}%`).join(', ')})`
									: `radial-gradient(circle, ${gradient.colors.map(c => `${c.color} ${c.position}%`).join(', ')})`
							}"
						></button>
					</div>

					<!-- Advanced Controls - Minimal ve İsteğe Bağlı -->
					<details class="group">
						<summary class="flex items-center justify-between cursor-pointer text-sm font-medium text-gray-300 hover:text-white transition-colors">
							<span>Advanced Settings</span>
							<svg class="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
							</svg>
						</summary>
						
						<div class="mt-3 space-y-3 pl-2">
							<!-- Gradient Type -->
							<div class="space-y-2">
								<label class="text-xs font-medium text-gray-400">Type</label>
								<div class="flex gap-1">
									<button
										@click="selectGradientType('linear')"
										:class="[
											'px-3 py-1.5 text-xs rounded-md transition-all border',
											backgroundGradient.type === 'linear'
												? 'bg-blue-500 border-blue-500 text-white shadow-md'
												: 'bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700 hover:border-zinc-600'
										]"
									>
										Linear
									</button>
									<button
										@click="selectGradientType('radial')"
										:class="[
											'px-3 py-1.5 text-xs rounded-md transition-all border',
											backgroundGradient.type === 'radial'
												? 'bg-blue-500 border-blue-500 text-white shadow-md'
												: 'bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700 hover:border-zinc-600'
										]"
									>
										Radial
									</button>
								</div>
							</div>

							<!-- Direction (linear için) -->
							<div v-if="backgroundGradient.type === 'linear'" class="space-y-2">
								<label class="text-xs font-medium text-gray-400">Direction</label>
								<div class="grid grid-cols-3 gap-1">
									<button
										v-for="direction in ['to-top-left', 'to-top', 'to-top-right', 'to-left', 'center', 'to-right', 'to-bottom-left', 'to-bottom', 'to-bottom-right']"
										:key="direction"
										@click="selectGradientDirection(direction)"
										:class="[
											'px-2 py-1 text-xs rounded transition-all border text-center',
											backgroundGradient.direction === direction
												? 'bg-blue-500 border-blue-500 text-white shadow-md'
												: 'bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700 hover:border-zinc-600'
										]"
									>
										{{ direction.replace('to-', '').replace('-', ' ').toUpperCase() }}
									</button>
								</div>
							</div>

							<!-- Custom Colors -->
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<label class="text-xs font-medium text-gray-400">Custom Colors</label>
									<button
										@click="addNewGradientColor"
										class="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors shadow-sm"
									>
										+ Add
									</button>
								</div>
								<div class="space-y-2">
									<div
										v-for="(colorStop, index) in backgroundGradient.colors"
										:key="index"
										class="flex items-center gap-2"
									>
										<input
											:value="colorStop.color"
											@input="updateGradientColorAtIndex(index, $event.target.value)"
											type="color"
											class="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
										/>
										<input
											:value="colorStop.color"
											@input="updateGradientColorAtIndex(index, $event.target.value)"
											type="text"
											class="flex-1 px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
											placeholder="#ffffff"
										/>
										<button
											v-if="backgroundGradient.colors.length > 2"
											@click="removeGradientColorAtIndex(index)"
											class="w-7 h-7 flex items-center justify-center text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors shadow-sm"
										>
											×
										</button>
									</div>
								</div>
							</div>
						</div>
					</details>
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
						desc="Adjusts video background blur."
						:min="0"
						:max="100"
						:step="5"
						unit="px"
					/>
				</div>
			</div>
		</div>

		<!-- Video Border Ayarları -->
		<div v-if="hasVideo" class="space-y-4">
			<!-- Border Kalınlığı -->
			<SliderInput
				v-model="borderWidthValue"
				label="Border Thickness"
				desc="Adjusts video border thickness."
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
					<h4 class="text-base font-semibold text-white">Border Color</h4>
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
						desc="Border opacity"
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
					<h4 class="text-base font-semibold text-white">macOS Dock</h4>
					<p class="text-sm text-gray-400">
						Show macOS Dock under video
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
					label="Dock Size"
					desc="Adjusts dock size"
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
	hasVideo: {
		type: Boolean,
		default: true,
	},
});

const {
	backgroundColor,
	backgroundType,
	backgroundGradient,
	padding,
	radius,
	shadowSize,
	basePadding,
	baseRadius,
	baseShadowSize,
	backgroundBlur,
	videoBorderSettings,
	updateBackgroundColor,
	updateBackgroundType,
	updateBackgroundGradient,
	updateGradientColor,
	addGradientColor,
	removeGradientColor,
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
} = usePlayerSettings(() => props.hasVideo);

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
const paddingValue = ref(basePadding.value);
const radiusValue = ref(baseRadius.value);
const shadowValue = ref(baseShadowSize.value);
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
// Tab yapısı için state - backgroundType ile senkronize
const activeBackgroundTab = ref(backgroundType.value || "image");

// Renk seçimi
const selectColor = (color) => {
	selectedColor.value = color;
	updateBackgroundColor(color);
	updateBackgroundType("color");
};

// Gradient fonksiyonları
const selectGradientType = (type) => {
	updateBackgroundGradient({
		...backgroundGradient.value,
		type: type
	});
	updateBackgroundType("gradient");
};

const selectGradientDirection = (direction) => {
	updateBackgroundGradient({
		...backgroundGradient.value,
		direction: direction
	});
	updateBackgroundType("gradient");
};

const updateGradientColorAtIndex = (index, color) => {
	updateGradientColor(index, color);
	updateBackgroundType("gradient");
};

const addNewGradientColor = () => {
	addGradientColor("#ffffff", 50); // Add white at 50%
	updateBackgroundType("gradient");
};

const removeGradientColorAtIndex = (index) => {
	removeGradientColor(index);
	updateBackgroundType("gradient");
};

// Predefined gradients - expanded collection
const predefinedGradients = [
	// First row - warm colors
	{
		type: "linear",
		direction: "to-bottom",
		colors: [
			{ color: "#ff7eb3", position: 0 },
			{ color: "#ff758c", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-right",
		colors: [
			{ color: "#f093fb", position: 0 },
			{ color: "#f5576c", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-bottom-right",
		colors: [
			{ color: "#ff9a9e", position: 0 },
			{ color: "#fecfef", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-bottom",
		colors: [
			{ color: "#ffecd2", position: 0 },
			{ color: "#fcb69f", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-right",
		colors: [
			{ color: "#ff6b6b", position: 0 },
			{ color: "#ffa500", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-bottom-right",
		colors: [
			{ color: "#ff4081", position: 0 },
			{ color: "#ff6ec7", position: 100 }
		]
	},
	// Second row - cool colors  
	{
		type: "linear",
		direction: "to-right",
		colors: [
			{ color: "#2196F3", position: 0 },
			{ color: "#21CBF3", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-bottom",
		colors: [
			{ color: "#667eea", position: 0 },
			{ color: "#764ba2", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-bottom-right",
		colors: [
			{ color: "#4facfe", position: 0 },
			{ color: "#00f2fe", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-top",
		colors: [
			{ color: "#11998e", position: 0 },
			{ color: "#38ef7d", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-right",
		colors: [
			{ color: "#3b82f6", position: 0 },
			{ color: "#1d4ed8", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-bottom",
		colors: [
			{ color: "#06b6d4", position: 0 },
			{ color: "#0891b2", position: 100 }
		]
	},
	// Third row - dark & elegant
	{
		type: "linear",
		direction: "to-bottom-right",
		colors: [
			{ color: "#232526", position: 0 },
			{ color: "#414345", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-right",
		colors: [
			{ color: "#1a1a1a", position: 0 },
			{ color: "#2d2d2d", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-bottom",
		colors: [
			{ color: "#434343", position: 0 },
			{ color: "#000000", position: 100 }
		]
	},
	{
		type: "radial",
		direction: "center",
		colors: [
			{ color: "#667eea", position: 0 },
			{ color: "#764ba2", position: 100 }
		]
	},
	{
		type: "radial",
		direction: "center",
		colors: [
			{ color: "#ff7eb3", position: 0 },
			{ color: "#ff758c", position: 100 }
		]
	},
	{
		type: "radial",
		direction: "center",
		colors: [
			{ color: "#11998e", position: 0 },
			{ color: "#38ef7d", position: 100 }
		]
	},
	// Fourth row - vibrant & neon
	{
		type: "linear",
		direction: "to-bottom-right",
		colors: [
			{ color: "#a8edea", position: 0 },
			{ color: "#fed6e3", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-right",
		colors: [
			{ color: "#ff6b35", position: 0 },
			{ color: "#f7931e", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-bottom",
		colors: [
			{ color: "#74b9ff", position: 0 },
			{ color: "#0984e3", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-top-right",
		colors: [
			{ color: "#fd79a8", position: 0 },
			{ color: "#fdcb6e", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-bottom-left",
		colors: [
			{ color: "#6c5ce7", position: 0 },
			{ color: "#a29bfe", position: 100 }
		]
	},
	{
		type: "radial",
		direction: "center",
		colors: [
			{ color: "#fd79a8", position: 0 },
			{ color: "#6c5ce7", position: 100 }
		]
	},
	// Fifth row - nature & earth
	{
		type: "linear",
		direction: "to-bottom",
		colors: [
			{ color: "#56ab2f", position: 0 },
			{ color: "#a8e6cf", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-right",
		colors: [
			{ color: "#8360c3", position: 0 },
			{ color: "#2ebf91", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-bottom-right",
		colors: [
			{ color: "#ff7f50", position: 0 },
			{ color: "#87ceeb", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-top",
		colors: [
			{ color: "#91eae4", position: 0 },
			{ color: "#86a8e7", position: 50 },
			{ color: "#7f7fd5", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-right",
		colors: [
			{ color: "#f83600", position: 0 },
			{ color: "#f9d423", position: 100 }
		]
	},
	{
		type: "radial",
		direction: "center",
		colors: [
			{ color: "#56ab2f", position: 0 },
			{ color: "#a8e6cf", position: 100 }
		]
	},
	// Sixth row - galaxy & cosmic
	{
		type: "linear",
		direction: "to-bottom-right",
		colors: [
			{ color: "#8b5cf6", position: 0 },
			{ color: "#06b6d4", position: 50 },
			{ color: "#10b981", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-right",
		colors: [
			{ color: "#4c1d95", position: 0 },
			{ color: "#7c3aed", position: 50 },
			{ color: "#c084fc", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-bottom",
		colors: [
			{ color: "#1e3a8a", position: 0 },
			{ color: "#3b82f6", position: 50 },
			{ color: "#06b6d4", position: 100 }
		]
	},
	{
		type: "radial",
		direction: "center",
		colors: [
			{ color: "#4c1d95", position: 0 },
			{ color: "#1e3a8a", position: 100 }
		]
	},
	{
		type: "linear",
		direction: "to-top-left",
		colors: [
			{ color: "#f59e0b", position: 0 },
			{ color: "#ef4444", position: 50 },
			{ color: "#dc2626", position: 100 }
		]
	},
	{
		type: "radial",
		direction: "center",
		colors: [
			{ color: "#f59e0b", position: 0 },
			{ color: "#ef4444", position: 50 },
			{ color: "#7c2d12", position: 100 }
		]
	}
];

const selectPredefinedGradient = (gradient) => {
	updateBackgroundGradient(gradient);
	updateBackgroundType("gradient");
};

// Background tab değiştirme - sadece UI tab'ını değiştir, backgroundType'ı değiştirme
const setActiveBackgroundTab = (tabType) => {
	activeBackgroundTab.value = tabType;
	// backgroundType'ı değiştirme - sadece kullanıcı konkret seçim yaptığında değişsin
};

// Arkaplan görseli seçimi
const selectBackgroundImage = (imageName) => {
	selectedWallpaper.value = imageName;
	updateBackgroundImage(`/backgrounds/${imageName}.jpg`);
	updateBackgroundType("image");
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

// backgroundType değiştiğinde activeBackgroundTab'ı senkronize et
watch(backgroundType, (newType) => {
	if (activeBackgroundTab.value !== newType) {
		activeBackgroundTab.value = newType;
	}
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
	() => basePadding.value,
	(newValue) => {
		paddingValue.value = newValue;
	}
);

watch(
	() => baseRadius.value,
	(newValue) => {
		radiusValue.value = newValue;
	}
);

watch(
	() => baseShadowSize.value,
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
	toggleDockVisibility(showDockValue.value);
	updateDockVisibility(showDockValue.value);
}

// Update dock size
function updateDockSize() {
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

.gradient-grid {
	@apply grid grid-cols-9 gap-2 w-max mt-4;
}

.gradient-button {
	@apply w-6 h-6 m-auto rounded-lg border-2 border-white/20 transition-all hover:scale-150;
}

.gradient-button-selected {
	@apply border-white shadow-lg;
}

.gradient-button-unselected {
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
