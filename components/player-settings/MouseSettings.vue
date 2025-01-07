<template>
	<div class="space-y-4">
		<h2 class="text-xl font-bold mb-4">Mouse Ayarları</h2>
		<div>
			<label class="block text-sm font-medium mb-2">Mouse Boyutu</label>
			<div class="flex items-center space-x-2">
				<input
					type="range"
					v-model="localMouseSize"
					min="20"
					max="100"
					step="1"
					class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
				/>
				<span class="text-sm text-gray-300 w-8">{{ localMouseSize }}</span>
			</div>
		</div>
		<div>
			<label class="block text-sm font-medium mb-2">Motion Blur</label>
			<div class="flex items-center space-x-2">
				<input
					type="range"
					v-model="localMotionBlur"
					min="0"
					max="200"
					step="1"
					class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
				/>
				<span class="text-sm text-gray-300 w-8">{{ localMotionBlur }}</span>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, watch } from "vue";

const props = defineProps({
	mouseSize: {
		type: Number,
		default: 42,
	},
	motionBlurValue: {
		type: Number,
		default: 100,
	},
});

const emit = defineEmits(["update:mouseSize", "update:motionBlurValue"]);

// Yerel state'ler
const localMouseSize = ref(props.mouseSize);
const localMotionBlur = ref(props.motionBlurValue);

// Props değişikliklerini izle
watch(
	() => props.mouseSize,
	(newValue) => {
		localMouseSize.value = newValue;
	}
);

watch(
	() => props.motionBlurValue,
	(newValue) => {
		localMotionBlur.value = newValue;
	}
);

// Yerel değişiklikleri parent'a ilet
watch(localMouseSize, (newValue) => {
	emit("update:mouseSize", Number(newValue));
});

watch(localMotionBlur, (newValue) => {
	emit("update:motionBlurValue", Number(newValue));
});
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
