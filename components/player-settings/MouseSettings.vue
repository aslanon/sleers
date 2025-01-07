<template>
	<div class="space-y-4">
		<h2 class="text-xl font-bold mb-4">Mouse Ayarları</h2>
		<div>
			<label class="block text-sm font-medium mb-2">Mouse Boyutu</label>
			<div class="flex items-center space-x-2">
				<input
					type="range"
					:value="modelValue"
					@input="updateValue($event.target.value)"
					min="20"
					max="100"
					step="1"
					class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
				/>
				<span class="text-sm text-gray-300 w-8">{{ modelValue }}</span>
			</div>
		</div>
	</div>
</template>

<script setup>
const props = defineProps({
	modelValue: {
		type: Number,
		default: 42,
	},
});

const emit = defineEmits(["update:modelValue"]);

const updateValue = (value) => {
	emit("update:modelValue", Number(value));
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
