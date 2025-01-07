<template>
	<div class="space-y-4">
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
		<div>
			<label class="block text-sm font-medium mb-2">Motion Blur</label>
			<div class="flex items-center space-x-2">
				<input
					type="range"
					:value="motionBlurValue"
					@input="updateMotionBlur($event.target.value)"
					min="0"
					max="100"
					step="1"
					class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
				/>
				<span class="text-sm text-gray-300 w-8">{{ motionBlurValue }}</span>
			</div>
		</div>
	</div>
</template>

<script setup>
const props = defineProps({
	mouseSize: {
		type: Number,
		default: 42,
	},
	motionBlurValue: {
		type: Number,
		default: 50,
	},
});

const emit = defineEmits(["update:mouseSize", "update:motionBlurValue"]);

const updateMouseSize = (value) => {
	emit("update:mouseSize", Number(value));
};

const updateMotionBlur = (value) => {
	emit("update:motionBlurValue", Number(value));
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
