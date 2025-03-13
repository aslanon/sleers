<template>
	<div
		v-if="position !== null"
		class="absolute h-full transition-all rounded-[10px] duration-75 opacity-30 bg-white/20 ring-1 ring-white/20"
		:style="{
			left: `${position}%`,
			width: `${width}%`,
			background: 'linear-gradient(rgb(87, 62, 244) 0%, rgb(134 119 233) 100%)',
		}"
	>
		<div
			class="absolute inset-0 flex flex-col items-center justify-center text-center"
		>
			<span class="text-white text-[14px] font-medium tracking-wide">{{
				label
			}}</span>
		</div>
	</div>
</template>

<script setup>
const props = defineProps({
	position: {
		type: Number,
		default: null,
	},
	width: {
		type: Number,
		required: true,
	},
	label: {
		type: String,
		default: "Add zoom effect",
	},
});
</script>
