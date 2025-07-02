<template>
	<div
		class="fixed z-[9999] bg-[#1a1a1a] rounded-lg shadow-xl border border-white/10 w-48 py-1"
		:style="position"
		@click.stop
	>
		<button
			v-for="type in layoutTypes"
			:key="type.id"
			class="w-full px-4 py-2 flex items-center gap-2 hover:bg-white/5 transition-colors text-left"
			@click="selectType(type.id)"
		>
			<!-- Type indicator -->
			<div
				class="w-4 h-4 rounded"
				:class="{
					'bg-green-600': type.id === 'camera-full',
					'bg-purple-600': type.id === 'screen-full',
				}"
			></div>

			<!-- Type name -->
			<span class="text-sm text-white">{{ type.name }}</span>
		</button>
	</div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from "vue";

const props = defineProps({
	isOpen: {
		type: Boolean,
		required: true,
	},
	x: {
		type: Number,
		required: true,
	},
	y: {
		type: Number,
		required: true,
	},
});

const emit = defineEmits(["select", "close"]);

const layoutTypes = [
	{
		id: "camera-full",
		name: "Full Camera",
	},
	{
		id: "screen-full",
		name: "Full Screen",
	},
];

const position = computed(() => {
	return {
		left: `${props.x}px`,
		top: `${props.y}px`,
		transform: "translate(-50%, -100%)",
		pointerEvents: "auto",
	};
});

const selectType = (typeId) => {
	emit("select", typeId);
};

// Handle ESC key
const handleKeyDown = (e) => {
	if (e.key === "Escape") {
		emit("close");
	}
};

onMounted(() => {
	window.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
	window.removeEventListener("keydown", handleKeyDown);
});
</script>

<style scoped>
.fixed {
	position: fixed !important;
}
</style>
