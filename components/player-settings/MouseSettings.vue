<template>
	<div class="flex flex-col gap-12">
		<!-- <div class="space-y-2">
			<h3 class="text-lg font-medium">İmleç Ayarları</h3>
			<p class="text-sm text-gray-400">
				İmleç görüntüsü için ayarları buradan yapabilirsiniz.
			</p>
		</div> -->
		<div class="flex items-center justify-between">
			<div>
				<h4 class="text-base font-semibold text-white">İmleç Görünürlüğü</h4>
				<p class="text-sm font-normal text-gray-500">
					İmlecin videoda görünüp görünmeyeceğini ayarlar.
				</p>
			</div>
			<label class="relative inline-flex items-center cursor-pointer">
				<input type="checkbox" v-model="mouseVisible" class="sr-only peer" />
				<div
					class="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"
				></div>
			</label>
		</div>

		<SliderInput
			v-if="mouseVisible"
			v-model="mouseSize"
			label="Mouse Size"
			desc="Mouse'un boyutunu ayarlar."
			:min="20"
			:max="400"
			:step="1"
			unit="px"
		/>

		<SliderInput
			v-if="mouseVisible"
			v-model="motionBlurValue"
			label="Motion Effect"
			desc="Mouse'un hareket ettiğinde görüntünün belirgin olmasını sağlar."
			:min="0"
			:max="1"
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
	mouseVisible: mouseVisibleStore,
	updateMouseSize,
	updateMotionBlur,
	updateMouseVisible,
} = usePlayerSettings();

// Local state
const mouseSize = ref(mouseSizeStore.value);
const motionBlurValue = ref(motionBlurStore.value);
const mouseVisible = ref(mouseVisibleStore.value);

// Watch local changes
watch(mouseSize, (newValue) => {
	updateMouseSize(newValue);
});

watch(motionBlurValue, (newValue) => {
	updateMotionBlur(newValue);
});

watch(mouseVisible, (newValue) => {
	updateMouseVisible(newValue);
});

// Watch store changes
watch(mouseSizeStore, (newValue) => {
	mouseSize.value = newValue;
});

watch(motionBlurStore, (newValue) => {
	motionBlurValue.value = newValue;
});

watch(mouseVisibleStore, (newValue) => {
	mouseVisible.value = newValue;
});
</script>
