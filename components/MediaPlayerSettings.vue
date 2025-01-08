<template>
	<div
		class="media-player-settings bg-white/10 w-[500px] min-w-[500px] ml-4 rounded-lg p-4"
	>
		<!-- Tab yapısı -->
		<div class="flex">
			<!-- Tab listesi -->
			<div class="w-1/3 space-y-2 border-r border-white/10 pr-4">
				<button
					v-for="tab in tabs"
					:key="tab.id"
					@click="currentTab = tab.id"
					class="w-full text-left px-3 py-2 rounded-lg transition-colors"
					:class="{
						'bg-white/10 font-medium': currentTab === tab.id,
						'hover:bg-white/5': currentTab !== tab.id,
					}"
				>
					{{ tab.name }}
				</button>
			</div>

			<!-- Tab içerikleri -->
			<div class="w-2/3 pl-4">
				<!-- Video Ayarları Tab -->
				<VideoSettings
					v-if="currentTab === 'video'"
					:duration="duration"
					:width="width"
					:height="height"
				/>

				<!-- Mouse Ayarları Tab -->
				<MouseSettings v-if="currentTab === 'mouse'" v-model="mouseSize" />
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, watch } from "vue";
import VideoSettings from "./player-settings/VideoSettings.vue";
import MouseSettings from "./player-settings/MouseSettings.vue";

const props = defineProps({
	duration: {
		type: Number,
		required: true,
		validator: (value) => value >= 0,
	},
	width: {
		type: Number,
		required: true,
		default: 1920,
	},
	height: {
		type: Number,
		required: true,
		default: 1080,
	},
	modelValue: {
		type: Number,
		default: 42,
	},
});

const emit = defineEmits(["update:modelValue"]);

// Tab yönetimi
const tabs = [
	{ id: "video", name: "Video" },
	{ id: "mouse", name: "Mouse" },
];

const currentTab = ref("video");

// Mouse ayarları
const mouseSize = ref(props.modelValue);

// Mouse size değişikliğini izle
watch(mouseSize, (newValue) => {
	emit("update:modelValue", newValue);
});

// Prop değişikliğini izle ve local state'i güncelle
watch(
	() => props.modelValue,
	(newValue) => {
		if (newValue !== mouseSize.value) {
			mouseSize.value = newValue;
		}
	},
	{ immediate: true }
);
</script>

<style scoped>
button {
	cursor: pointer;
	user-select: none;
}
</style>
