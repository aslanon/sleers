<template>
	<div
		class="media-player-settings bg-black w-[500px] min-w-[500px] rounded-lg"
	>
		<!-- Tab yapısı -->
		<div class="flex">
			<!-- Tab listesi -->
			<div class="space-y-2 border-r border-white/10 pr-4">
				<button
					v-for="tab in tabs.filter((tab) => tab.isShowInTab)"
					:key="tab.id"
					@click="currentTab = tab.id"
					class="w-12 flex items-center justify-center p-2 rounded-xl transition-colors"
					:class="{
						'bg-white/5': currentTab === tab.id,
						'hover:bg-white/5': currentTab !== tab.id,
					}"
					:title="tab.name"
				>
					<svg
						v-if="tab.id === 'video'"
						xmlns="http://www.w3.org/2000/svg"
						class="w-6 h-6"
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
						class="w-6 h-6"
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
					<svg
						v-if="tab.id === 'zoom'"
						xmlns="http://www.w3.org/2000/svg"
						class="w-6 h-6"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
						/>
					</svg>
					<svg
						v-if="tab.id === 'camera'"
						xmlns="http://www.w3.org/2000/svg"
						class="w-6 h-6"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
					>
						<!-- Köşe işaretleri -->
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4h3M4 4v3M20 4h-3M20 4v3M4 20h3M4 20v-3M20 20h-3M20 20v-3"
						/>
						<!-- Emoji yüz (daire) -->
						<circle cx="12" cy="11" r="4" stroke-width="2" />
						<!-- Gülümseyen gözler -->
						<path
							stroke-linecap="round"
							stroke-width="2"
							d="M10 10h0M14 10h0"
						/>
						<!-- Kamera -->
						<rect x="14" y="13" width="4" height="4" rx="1" stroke-width="2" />
						<!-- Kamera lensi -->
						<circle cx="16" cy="15" r="0.5" stroke-width="2" />
					</svg>
				</button>
			</div>

			<!-- Tab içerikleri -->
			<div
				class="flex-1 pt-2 pr-8 rounded-2xl max-h-[calc(100vh-400px)] px-8 overflow-y-auto"
			>
				<!-- Video Ayarları Tab -->
				<VideoSettings
					v-if="currentTab === 'video'"
					:duration="duration"
					:width="width"
					:height="height"
				/>

				<!-- Mouse Ayarları Tab -->
				<MouseSettings v-if="currentTab === 'mouse'" v-model="mouseSize" />

				<!-- Zoom Ayarları Tab -->
				<ZoomSettings v-if="currentTab === 'zoom'" />

				<!-- Kamera Ayarları Tab -->
				<CameraSettings v-if="currentTab === 'camera'" />
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, watch } from "vue";
import VideoSettings from "./player-settings/VideoSettings.vue";
import MouseSettings from "./player-settings/MouseSettings.vue";
import ZoomSettings from "./player-settings/ZoomSettings.vue";
import CameraSettings from "./player-settings/CameraSettings.vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";

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

// Store'dan currentZoomRange'i al
const { currentZoomRange } = usePlayerSettings();

// Tab yönetimi
const tabs = [
	{
		id: "video",
		name: "Video Ayarları",
		isShowInTab: true,
	},
	{
		id: "camera",
		name: "Kamera Ayarları",
		isShowInTab: true,
	},
	{
		id: "mouse",
		name: "Mouse Ayarları",
		isShowInTab: true,
	},
	{
		id: "zoom",
		name: "Zoom Ayarları",
		isShowInTab: false,
	},
];

const currentTab = ref("video");

// currentZoomRange değiştiğinde zoom sekmesine geç
watch(currentZoomRange, (newRange) => {
	if (newRange) {
		currentTab.value = "zoom";
	}
});

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
