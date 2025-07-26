<template>
	<div class="flex flex-col gap-12 min-h-[800px]">
		<!-- <div class="space-y-2">
			<h3 class="text-lg font-medium">İmleç Ayarları</h3>
			<p class="text-sm text-gray-400">
				İmleç görüntüsü için ayarları buradan yapabilirsiniz.
			</p>
		</div> -->
		<div class="flex items-center justify-between">
			<div>
				<h4 class="text-base font-semibold text-white">Cursor Visibility</h4>
				<p class="text-sm font-normal text-gray-500">
					Controls whether the cursor is visible in the video.
				</p>
			</div>
			<label class="relative inline-flex items-center cursor-pointer">
				<input type="checkbox" v-model="mouseVisible" class="sr-only peer" />
				<div
					class="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"
				></div>
			</label>
		</div>

		<div v-if="mouseVisible" class="flex items-center justify-between">
			<div>
				<h4 class="text-base font-semibold text-white">Auto Hide</h4>
				<p class="text-sm font-normal text-gray-500">
					Cursor automatically hides when inactive for 3 seconds.
				</p>
			</div>
			<label class="relative inline-flex items-center cursor-pointer">
				<input type="checkbox" v-model="autoHide" class="sr-only peer" />
				<div
					class="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"
				></div>
			</label>
		</div>

		<SliderInput
			v-if="mouseVisible"
			v-model="mouseSize"
			label="Mouse Size"
			desc="Adjusts the size of the cursor."
			:min="20"
			:max="400"
			:step="1"
			unit="px"
		/>

		<!-- <SliderInput
			v-if="mouseVisible"
			v-model="motionBlurValue"
			label="Motion Effect"
			desc="Mouse'un hareket ettiğinde görüntünün belirgin olmasını sağlar."
			:min="0"
			:max="1"
			:step="0.1"
		/> -->

		<div v-if="mouseVisible" class="flex items-center justify-between">
			<div>
				<h4 class="text-base font-semibold text-white">Advanced Motion Blur</h4>
				<p class="text-sm font-normal text-gray-500">
					Applies canvas-based motion blur effect during fast movement.
				</p>
			</div>
			<label class="relative inline-flex items-center cursor-pointer">
				<input
					type="checkbox"
					v-model="enhancedMotionBlur"
					class="sr-only peer"
				/>
				<div
					class="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"
				></div>
			</label>
		</div>

		<SliderInput
			v-if="mouseVisible && enhancedMotionBlur"
			v-model="motionBlurIntensity"
			label="Motion Blur Intensity"
			desc="Adjusts the intensity of canvas-based motion blur effect."
			:min="0.1"
			:max="1"
			:step="0.1"
		/>

		<SliderInput
			v-if="mouseVisible"
			v-model="cursorOffset"
			label="Cursor Offset"
			desc="Adjusts the timing offset of the cursor relative to video. Negative values make cursor appear earlier, positive values make it appear later."
			:min="-2"
			:max="2"
			:step="0.1"
			unit="s"
		/>

		<!-- <SliderInput
			v-if="mouseVisible"
			v-model="cursorSmoothness"
			label="Cursor Smoothness"
			desc="Yüksek değerler daha hızlı ve responsive cursor hareketi sağlar."
			:min="0"
			:max="1"
			:step="0.1"
		/> -->
	</div>
</template>

<script setup>
import { ref, watch, onUnmounted, reactive } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import SliderInput from "~/components/ui/SliderInput.vue";

const {
	mouseSize: mouseSizeStore,
	motionBlurValue: motionBlurStore,
	mouseVisible: mouseVisibleStore,
	autoHideCursor: autoHideCursorStore,
	enhancedMotionBlur: enhancedMotionBlurStore,
	motionBlurIntensity: motionBlurIntensityStore,
	cursorSmoothness: cursorSmoothnessStore,
	cursorOffset: cursorOffsetStore,
	updateMouseSize,
	updateMotionBlur,
	updateMouseVisible,
	updateAutoHideCursor,
	updateEnhancedMotionBlur,
	updateMotionBlurIntensity,
	updateCursorSmoothness,
	updateCursorOffset,
} = usePlayerSettings();

// Local state
const mouseSize = ref(mouseSizeStore.value);
const motionBlurValue = ref(motionBlurStore.value);
const mouseVisible = ref(mouseVisibleStore.value);
const autoHide = ref(autoHideCursorStore.value);
const enhancedMotionBlur = ref(enhancedMotionBlurStore.value);
const motionBlurIntensity = ref(motionBlurIntensityStore.value);
const cursorSmoothness = ref(cursorSmoothnessStore.value);
const cursorOffset = ref(cursorOffsetStore.value);

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

// Watch autoHide changes
watch(autoHide, (newValue) => {
	updateAutoHideCursor(newValue);
});

// Watch enhanced motion blur changes
watch(enhancedMotionBlur, (newValue) => {
	updateEnhancedMotionBlur(newValue);
});

watch(motionBlurIntensity, (newValue) => {
	updateMotionBlurIntensity(newValue);
});

watch(cursorSmoothness, (newValue) => {
	updateCursorSmoothness(newValue);
});

watch(cursorOffset, (newValue) => {
	updateCursorOffset(newValue);
});

// Watch store changes for new settings
watch(enhancedMotionBlurStore, (newValue) => {
	enhancedMotionBlur.value = newValue;
});

watch(motionBlurIntensityStore, (newValue) => {
	motionBlurIntensity.value = newValue;
});

watch(cursorSmoothnessStore, (newValue) => {
	cursorSmoothness.value = newValue;
});

watch(cursorOffsetStore, (newValue) => {
	cursorOffset.value = newValue;
});
</script>
