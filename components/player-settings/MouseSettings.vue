<template>
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-2">
			<label class="text-sm text-gray-500">Mouse Size</label>
			<input
				type="range"
				:min="20"
				:max="100"
				:step="1"
				:value="mouseSize"
				@input="updateMouseSize($event.target.value)"
				class="w-full"
			/>
			<div class="text-xs text-gray-400">{{ mouseSize }}px</div>
		</div>

		<div class="flex flex-col gap-2">
			<label class="text-sm text-gray-500">Motion Effect</label>
			<input
				type="range"
				:min="0"
				:max="10"
				:step="0.1"
				:value="motionBlurValue"
				@input="updateMotionBlur($event.target.value)"
				class="w-full"
			/>
			<div class="text-xs text-gray-400">{{ motionBlurValue }}</div>
		</div>
	</div>
</template>

<script setup>
import { usePlayerSettings } from "~/composables/usePlayerSettings";

const { mouseSize, motionBlurValue, updateMouseSize, updateMotionBlur } =
	usePlayerSettings();
</script>
