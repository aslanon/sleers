<template>
	<div
		class="media-player-settings bg-black w-[500px] min-w-[500px] rounded-lg p-4"
	>
		<!-- Tab yapısı -->
		<div class="flex">
			<!-- Tab listesi -->
			<div class="w-12 space-y-2 border-r border-white/10 pr-2">
				<button
					v-for="tab in tabs"
					:key="tab.id"
					@click="currentTab = tab.id"
					class="w-full flex items-center justify-center p-2 rounded-lg transition-colors"
					:class="{
						'bg-white/10': currentTab === tab.id,
						'hover:bg-white/5': currentTab !== tab.id,
					}"
					:title="tab.name"
				>
					<svg
						v-if="tab.id === 'video'"
						xmlns="http://www.w3.org/2000/svg"
						class="w-5 h-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
						/>
					</svg>
					<svg
						v-if="tab.id === 'mouse'"
						xmlns="http://www.w3.org/2000/svg"
						class="w-5 h-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
						/>
					</svg>
				</button>
			</div>

			<!-- Tab içerikleri -->
			<div class="flex-1 pt-0 p-8">
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
