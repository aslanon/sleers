<template>
	<div class="setting-group">
		<label class="setting-label">{{ label }}</label>
		<span v-if="desc" class="setting-desc">{{ desc }}</span>
		<div class="setting-control">
			<input
				type="range"
				:value="modelValue"
				@input="updateValue"
				:min="min"
				:max="max"
				:step="step"
				class="setting-slider"
			/>
			<span class="setting-value">{{ modelValue }}{{ unit }}</span>
		</div>
	</div>
</template>

<script setup>
import { onMounted } from "vue";

const props = defineProps({
	label: {
		type: String,
		required: true,
	},
	modelValue: {
		type: [Number, String],
		required: true,
	},
	min: {
		type: [Number, String],
		default: 0,
	},
	max: {
		type: [Number, String],
		default: 100,
	},
	step: {
		type: [Number, String],
		default: 1,
	},
	unit: {
		type: String,
		default: "",
	},
	desc: {
		type: String,
		default: "",
	},
});

const emit = defineEmits(["update:modelValue"]);

const updateValue = (event) => {
	const value = event.target.value;
	emit("update:modelValue", Number(value));
	updateProgress(event);
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
	const slider = document.querySelector(".setting-slider");
	if (slider) {
		updateProgress({ target: slider });
	}
});
</script>

<style scoped>
.setting-group {
	@apply flex flex-col gap-2;
}

.setting-label {
	@apply text-base font-semibold text-white;
}

.setting-desc {
	@apply text-sm font-normal text-gray-500;
}

.setting-control {
	@apply flex items-center gap-3;
}

.setting-slider {
	@apply w-full h-[1px] bg-gray-500/50 rounded-full appearance-none cursor-pointer relative;
}

.setting-slider::-webkit-slider-runnable-track {
	@apply w-full h-[1px] rounded-full cursor-pointer;
	background: linear-gradient(
		to right,
		#0040ff var(--progress),
		rgba(55, 65, 81, 0.5) 0
	);
}

.setting-slider::-webkit-slider-thumb {
	@apply appearance-none w-5 h-5 bg-[#0040ff] rounded-full cursor-pointer shadow-lg transition-all duration-150 border-4 border-blue-500;
	margin-top: -8px;
}

.setting-slider::-webkit-slider-thumb:hover {
	@apply border-blue-400;
	transform: scale(1.2);
}

.setting-slider::-webkit-slider-thumb:active {
	@apply border-blue-600;
	transform: scale(0.95);
}

.setting-slider:focus {
	@apply outline-none;
}

.setting-value {
	@apply text-xs text-gray-300 bg-gray-800/50 rounded-full px-2 py-1  text-right font-medium;
}
</style>
