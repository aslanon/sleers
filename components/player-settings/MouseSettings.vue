<template>
	<div class="flex flex-col gap-4">
		<div class="setting-group">
			<label class="setting-label">Mouse Size</label>
			<div class="setting-control">
				<input
					type="range"
					:min="20"
					:max="100"
					:step="1"
					:value="mouseSize"
					@input="updateMouseSize($event.target.value)"
					class="setting-slider"
				/>
				<span class="setting-value">{{ mouseSize }}px</span>
			</div>
		</div>

		<div class="setting-group">
			<label class="setting-label">Motion Effect</label>
			<div class="setting-control">
				<input
					type="range"
					:min="0"
					:max="10"
					:step="0.1"
					:value="motionBlurValue"
					@input="updateMotionBlur($event.target.value)"
					class="setting-slider"
				/>
				<span class="setting-value">{{ motionBlurValue }}</span>
			</div>
		</div>
	</div>
</template>

<script setup>
import { usePlayerSettings } from "~/composables/usePlayerSettings";

const { mouseSize, motionBlurValue, updateMouseSize, updateMotionBlur } =
	usePlayerSettings();
</script>

<style scoped>
.setting-group {
	@apply flex flex-col gap-2;
}

.setting-label {
	@apply text-sm font-medium text-gray-300;
}

.setting-control {
	@apply flex items-center gap-3;
}

.setting-slider {
	@apply w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer;
}

.setting-slider::-webkit-slider-thumb {
	@apply appearance-none w-4 h-4 bg-blue-500 rounded-full cursor-pointer hover:bg-blue-400 transition-colors;
	box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.setting-slider::-webkit-slider-thumb:hover {
	@apply bg-blue-400;
	box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.2);
}

.setting-value {
	@apply text-sm text-gray-300 min-w-[3rem] text-right font-medium;
}
</style>
