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
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							fill-rule="evenodd"
							clip-rule="evenodd"
							d="M0 6C0 2.68629 2.68629 0 6 0H18C21.3137 0 24 2.68629 24 6V18C24 21.3137 21.3137 24 18 24H6C2.68629 24 0 21.3137 0 18V6ZM9.43207 2H14.139L2 14.5305V9.89658L9.43207 2ZM2 17.4049L16.9235 2H18C18.8774 2 19.6889 2.28252 20.3483 2.76155L2.95815 20.5976C2.36075 19.8987 2 18.9915 2 18V17.4049ZM4.62182 21.7562C5.05147 21.9139 5.51568 22 6 22H7.58578L22 7.58579V6C22 5.39752 21.8668 4.82616 21.6282 4.31374L4.62182 21.7562ZM14.5858 22H10.4142L22 10.4142V14.5858L14.5858 22ZM17.4142 22H18C20.2091 22 22 20.2091 22 18V17.4142L17.4142 22ZM6.68558 2H6C3.79086 2 2 3.79086 2 6V6.97842L6.68558 2Z"
							fill="white"
						/>
					</svg>

					<svg
						v-if="tab.id === 'mouse'"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M9.75474 1.7231C9.60167 1.19245 9.04741 0.886364 8.51676 1.03944C7.98611 1.19251 7.68003 1.74677 7.8331 2.27742C7.87404 2.41934 7.91516 2.56361 7.95677 2.70961C8.12737 3.30814 8.30621 3.93558 8.51446 4.54853C8.53452 4.60759 8.54553 4.65079 8.56249 4.71735C8.57569 4.76913 8.59249 4.83508 8.61996 4.93361C8.66686 5.10186 8.74665 5.36354 8.90271 5.61323C9.19542 6.08157 9.81237 6.22394 10.2807 5.93123C10.749 5.63852 10.8914 5.02157 10.5987 4.55323C10.5959 4.54719 10.5776 4.50799 10.5465 4.39654C10.5347 4.35409 10.525 4.317 10.5134 4.27219L10.4908 4.18561C10.47 4.10656 10.4428 4.00708 10.4082 3.90516C10.2175 3.3441 10.0559 2.77735 9.88659 2.18362C9.84337 2.03208 9.79957 1.8785 9.75474 1.7231Z"
							fill="white"
						/>
						<path
							d="M17.0386 4.42836C17.3836 4.85962 17.3137 5.48891 16.8824 5.83392L16.8518 5.85847C16.4602 6.17167 16.1289 6.43664 15.8382 6.736C15.7543 6.8225 15.6742 6.91992 15.5595 7.05953L15.5586 7.06065C15.4537 7.1883 15.3166 7.35522 15.1576 7.51427C14.7671 7.90479 14.1339 7.90479 13.7434 7.51427C13.3528 7.12374 13.3528 6.49058 13.7434 6.10005C13.8239 6.01953 13.9031 5.92517 14.014 5.79013L14.0327 5.76732C14.1316 5.64682 14.2595 5.49091 14.4034 5.34274C14.7841 4.95063 15.2048 4.61443 15.57 4.32261L15.633 4.27219C16.0643 3.92718 16.6936 3.9971 17.0386 4.42836Z"
							fill="white"
						/>
						<path
							fill-rule="evenodd"
							clip-rule="evenodd"
							d="M16.0985 14.8422L22.5361 13.2004L8.25909 7.22446L12.0268 22.2318L14.6138 16.1822L18.3353 20.2758L19.8151 18.9305L16.0985 14.8422ZM12.3276 16.4418L11.5 11L16.7408 12.6144L13.6244 13.4091L12.3276 16.4418Z"
							fill="white"
						/>
						<path
							d="M7.94319 13.5315C8.41108 13.2381 8.55251 12.621 8.25909 12.1531C7.96567 11.6852 7.3485 11.5437 6.88061 11.8372C6.6515 11.9808 6.40764 12.1124 6.13176 12.2593L6.07878 12.2875C5.82569 12.4222 5.54426 12.572 5.26908 12.7389C4.23674 13.3651 3.3065 14.0549 2.38901 14.7631C1.95182 15.1006 1.87099 15.7286 2.20847 16.1658C2.54594 16.6029 3.17393 16.6838 3.61111 16.3463C4.51249 15.6505 5.37186 15.0158 6.30638 14.4489C6.53176 14.3122 6.76674 14.187 7.03141 14.0461L7.07191 14.0246C7.34378 13.8798 7.64633 13.7177 7.94319 13.5315Z"
							fill="white"
						/>
						<path
							d="M2.20006 6.13103C2.53143 5.6892 3.15823 5.59965 3.60006 5.93103C4.31402 6.4665 5.13196 6.93552 5.94098 7.22446C6.46108 7.41021 6.73213 7.98243 6.54638 8.50254C6.36063 9.02265 5.78841 9.2937 5.2683 9.10794C4.23255 8.73803 3.23903 8.16026 2.40006 7.53103C1.95823 7.19965 1.86869 6.57285 2.20006 6.13103Z"
							fill="white"
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
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M0 18V16.5H2V18C2 20.2091 3.79086 22 6 22H7.5V24H6C2.68629 24 0 21.3137 0 18Z"
							fill="white"
						/>
						<path
							d="M0 7.5V6C0 2.68629 2.68629 0 6 0H7.5V2H6C3.79086 2 2 3.79086 2 6V7.5H0Z"
							fill="white"
						/>
						<path
							d="M16.5 0H18C21.3137 0 24 2.68629 24 6V7.5H22V6C22 3.79086 20.2091 2 18 2H16.5V0Z"
							fill="white"
						/>
						<path
							d="M24 16.5V18C24 21.3137 21.3137 24 18 24H16.5V22H18C20.2091 22 22 20.2091 22 18V16.5H24Z"
							fill="white"
						/>
						<path
							fill-rule="evenodd"
							clip-rule="evenodd"
							d="M20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12ZM17.3333 10C17.3333 10.8396 16.816 10.788 16.0828 10.7149C15.8513 10.6919 15.5983 10.6667 15.3333 10.6667C15.0683 10.6667 14.8154 10.6919 14.5839 10.7149C13.8507 10.788 13.3333 10.8396 13.3333 10C13.3333 8.89543 14.2288 8 15.3333 8C16.4379 8 17.3333 8.89543 17.3333 10ZM10.4764 13.7282C9.78541 13.532 9.33333 13.4037 9.33333 14.0622C9.33333 15.1324 10.5272 16 12 16C13.4728 16 14.6667 15.1324 14.6667 14.0622C14.6667 13.4037 14.2146 13.5321 13.5236 13.7282C13.0917 13.8509 12.5665 14 12 14C11.4335 14 10.9083 13.8509 10.4764 13.7282ZM10.6667 10C10.6667 10.8396 10.1494 10.788 9.41613 10.7149C9.18468 10.6919 8.93167 10.6667 8.66667 10.6667C8.40166 10.6667 8.1487 10.6919 7.91725 10.7149C7.18401 10.788 6.66667 10.8396 6.66667 10C6.66667 8.89543 7.5621 8 8.66667 8C9.77124 8 10.6667 8.89543 10.6667 10Z"
							fill="white"
						/>
					</svg>

					<svg
						v-if="tab.id === 'gifs'"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M18 4H6C4.9 4 4 4.9 4 6V18C4 19.1 4.9 20 6 20H18C19.1 20 20 19.1 20 18V6C20 4.9 19.1 4 18 4ZM11 10.5V13.5C11 14.3 10.3 15 9.5 15H8.5C7.7 15 7 14.3 7 13.5V10.5C7 9.7 7.7 9 8.5 9C9.3 9 10 9.7 10 10.5V11H9V10.5C9 10.2 8.8 10 8.5 10C8.2 10 8 10.2 8 10.5V13.5C8 13.8 8.2 14 8.5 14C8.8 14 9 13.8 9 13.5V12H8V11H11V10.5ZM12 15H11V9H12V15ZM16.5 11H15.5V15H14.5V11H13.5V10H16.5V11Z"
							fill="white"
						/>
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
				<ZoomSettings
					v-if="currentTab === 'zoom'"
					:media-player="mediaPlayer"
				/>

				<!-- Kamera Ayarları Tab -->
				<CameraSettings v-if="currentTab === 'camera'" />

				<!-- Gif Ayarları Tab -->
				<GifSettings
					v-if="currentTab === 'gifs'"
					:media-player="mediaPlayer"
					@gif-selected="handleGifSelected"
				/>
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
import GifSettings from "./player-settings/GifSettings.vue";
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
	mediaPlayer: {
		type: Object,
		required: true,
	},
});

const emit = defineEmits(["update:modelValue", "gif-selected"]);

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
		id: "gifs",
		name: "Gif Ekle",
		isShowInTab: true,
	},
	{
		id: "zoom",
		name: "Zoom Ayarları",
		isShowInTab: false,
	},
];

const currentTab = ref("video");

// Gif seçildiğinde
const handleGifSelected = (gif) => {
	emit("gif-selected", gif);
};

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
