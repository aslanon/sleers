<template>
	<div class="space-y-4">
		<h2 class="text-xl font-bold mb-4">Video Ayarları</h2>
		<div>
			<label class="block text-sm font-medium mb-1">Video Süresi</label>
			<span class="text-gray-300">{{ formatDuration(duration) }}</span>
		</div>

		<div>
			<label class="block text-sm font-medium mb-1">Boyut</label>
			<span class="text-gray-300">{{ width }}x{{ height }}</span>
		</div>

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
			<label class="block text-sm font-medium mb-1">Arkaplan Rengi</label>
			<div class="grid grid-cols-4 gap-2">
				<button
					v-for="color in colors"
					:key="color"
					@click="selectColor(color)"
					class="w-8 h-8 rounded-lg border-2 transition-all"
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
	updateBackgroundColor,
	updatePadding,
	updateRadius,
} = usePlayerSettings();

// Renk paleti
const colors = [
	"#000000",
	"#1a1a1a",
	"#333333",
	"#4d4d4d",
	"#666666",
	"#808080",
	"#999999",
	"#b3b3b3",
	"#cccccc",
	"#e6e6e6",
	"#f2f2f2",
	"#ffffff",
	"#ff4444",
	"#44ff44",
	"#4444ff",
	"#ffff44",
];

// Local state
const selectedColor = ref(backgroundColor.value);
const paddingValue = ref(padding.value);
const radiusValue = ref(radius.value);

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

// Süre formatı
const formatDuration = (seconds) => {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};
</script>
