<template>
	<div class="flex flex-col gap-12">
		<!-- <div class="space-y-2">
			<h3 class="text-lg font-medium">İmleç Ayarları</h3>
			<p class="text-sm text-gray-400">
				İmleç görüntüsü için ayarları buradan yapabilirsiniz.
			</p>
		</div> -->
		<SliderInput
			v-model="mouseSize"
			label="Mouse Size"
			desc="Mouse'un boyutunu ayarlar."
			:min="20"
			:max="100"
			:step="1"
			unit="px"
		/>

		<SliderInput
			v-model="motionBlurValue"
			label="Motion Effect"
			desc="Mouse'un hareket ettiğinde görüntünün belirgin olmasını sağlar."
			:min="0"
			:max="10"
			:step="0.1"
		/>
	</div>
</template>

<script setup>
import { ref, watch } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import SliderInput from "~/components/ui/SliderInput.vue";

const {
	mouseSize: mouseSizeStore,
	motionBlurValue: motionBlurStore,
	updateMouseSize,
	updateMotionBlur,
} = usePlayerSettings();

// Local state
const mouseSize = ref(mouseSizeStore.value);
const motionBlurValue = ref(motionBlurStore.value);

// Watch local changes
watch(mouseSize, (newValue) => {
	updateMouseSize(newValue);
});

watch(motionBlurValue, (newValue) => {
	updateMotionBlur(newValue);
});

// Watch store changes
watch(mouseSizeStore, (newValue) => {
	mouseSize.value = newValue;
});

watch(motionBlurStore, (newValue) => {
	motionBlurValue.value = newValue;
});
</script>
