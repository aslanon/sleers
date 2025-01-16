<template>
	<div class="space-y-12">
		<div class="space-y-2">
			<h3 class="text-lg font-medium">Kamera Ayarları</h3>
			<p class="text-sm text-gray-400">
				Kamera görüntüsü için ayarları buradan yapabilirsiniz.
			</p>
		</div>

		<!-- Kamera Mouse Takibi -->
		<div class="flex items-center justify-between">
			<div>
				<h4 class="text-base font-medium">Mouse İmleci Takibi</h4>
				<p class="text-sm text-gray-400">
					Kamera görüntüsü mouse imlecini takip etsin
				</p>
			</div>
			<label class="relative inline-flex items-center cursor-pointer">
				<input type="checkbox" v-model="followMouse" class="sr-only peer" />
				<div
					class="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"
				></div>
			</label>
		</div>

		<!-- Kamera Yatay Çevirme -->
		<div class="flex items-center justify-between">
			<div>
				<h4 class="text-base font-medium">Kamerayı Yatay Çevir</h4>
				<p class="text-sm text-gray-400">
					Kamera görüntüsünü yatay olarak aynala
				</p>
			</div>
			<label class="relative inline-flex items-center cursor-pointer">
				<input type="checkbox" v-model="mirrorCamera" class="sr-only peer" />
				<div
					class="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"
				></div>
			</label>
		</div>

		<!-- Kamera Boyutu -->
		<SliderInput
			label="Kamera Boyutu"
			desc="Kamera'nın boyutunu ayarlar."
			v-model="cameraSize"
			:min="10"
			:max="100"
			:step="1"
			unit="%"
		/>
		<!-- Kamera Crop Ayarı -->
		<div class="space-y-2">
			<h4 class="text-base font-medium">Kamera Kırpma</h4>
			<p class="text-sm text-gray-400">
				Kamera görüntüsünün görünür alanını ayarlayın.
			</p>
			<div
				class="relative max-w-[150px] aspect-video border-zinc-800 bg-zinc-900 rounded-xl overflow-hidden"
			>
				<div
					ref="cropArea"
					class="absolute flex items-center justify-center overflow-hidden ring-inset ring-blue-500 rounded-xl cursor-grab"
					:style="{
						borderRadius: cameraRadius + 'px',
						left: `${cameraCrop.x}%`,
						top: `${cameraCrop.y}%`,
						width: '56.25%',
						height: '100%',
						aspectRatio: '1/1',
					}"
					@mousedown="startDrag"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						xmlns:xlink="http://www.w3.org/1999/xlink"
						version="1.1"
						width="80"
						height="80"
						viewBox="0 0 256 256"
						xml:space="preserve"
					>
						<defs></defs>
						<g
							style="
								stroke: none;
								stroke-width: 0;
								stroke-dasharray: none;
								stroke-linecap: butt;
								stroke-linejoin: miter;
								stroke-miterlimit: 10;
								fill: none;
								fill-rule: nonzero;
								opacity: 0.25;
							"
							transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)"
						>
							<path
								d="M 45 0 C 20.147 0 0 20.147 0 45 c 0 24.853 20.147 45 45 45 s 45 -20.147 45 -45 C 90 20.147 69.853 0 45 0 z M 45 22.007 c 8.899 0 16.14 7.241 16.14 16.14 c 0 8.9 -7.241 16.14 -16.14 16.14 c -8.9 0 -16.14 -7.24 -16.14 -16.14 C 28.86 29.248 36.1 22.007 45 22.007 z M 45 83.843 c -11.135 0 -21.123 -4.885 -27.957 -12.623 c 3.177 -5.75 8.144 -10.476 14.05 -13.341 c 2.009 -0.974 4.354 -0.958 6.435 0.041 c 2.343 1.126 4.857 1.696 7.473 1.696 c 2.615 0 5.13 -0.571 7.473 -1.696 c 2.083 -1 4.428 -1.015 6.435 -0.041 c 5.906 2.864 10.872 7.591 14.049 13.341 C 66.123 78.957 56.135 83.843 45 83.843 z"
								style="
									stroke: none;
									stroke-width: 1;
									stroke-dasharray: none;
									stroke-linecap: butt;
									stroke-linejoin: miter;
									stroke-miterlimit: 10;
									fill: rgb(255, 255, 255);
									fill-rule: nonzero;
									opacity: 1;
								"
								transform=" matrix(1 0 0 1 0 0) "
								stroke-linecap="round"
							/>
						</g>
					</svg>
				</div>
			</div>
		</div>
		<!-- Kamera Köşe Yuvarlaklığı -->
		<SliderInput
			label="Köşe Yuvarlaklığı"
			desc="Kamera'nın köşelerinin yuvarlaklığını ayarlar."
			v-model="cameraRadius"
			:min="0"
			:max="100"
			:step="1"
			unit="px"
		/>

		<!-- Kamera Gölgesi -->
		<SliderInput
			label="Shadow"
			desc="Kameraya gölge efekti ekler."
			v-model="cameraShadow"
			:min="0"
			:max="100"
			:step="1"
			unit="%"
		/>
	</div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import SliderInput from "~/components/ui/SliderInput.vue";

const { cameraSettings, updateCameraSettings } = usePlayerSettings();

// Kamera ayarları için state
const cameraSize = ref(cameraSettings.value?.size || 30);
const cameraRadius = ref(cameraSettings.value?.radius || 12);
const cameraShadow = ref(cameraSettings.value?.shadow || 30);
const cameraCrop = ref(
	cameraSettings.value?.crop || {
		x: 21.875,
		y: 0,
		width: 56.25,
		height: 100,
	}
);
const followMouse = ref(cameraSettings.value?.followMouse || false);
const mirrorCamera = ref(cameraSettings.value?.mirror || false);

// Drag işlemleri için state
const isDragging = ref(false);
const startX = ref(0);
const startY = ref(0);
const cropArea = ref(null);

// Başlangıç boyutlarını ayarla
onMounted(() => {
	// Sadece cropArea ref'ini kullanmak için boş onMounted tutuyoruz
});

// Drag işlemleri
const startDrag = (e) => {
	isDragging.value = true;
	if (e.target.classList.contains("cursor-grab")) {
		e.target.classList.remove("cursor-grab");
		e.target.classList.add("cursor-grabbing");
	}
	const rect = cropArea.value.parentElement.getBoundingClientRect();
	startX.value = e.clientX - (cameraCrop.value.x * rect.width) / 100;
	startY.value = e.clientY - (cameraCrop.value.y * rect.height) / 100;
	document.addEventListener("mousemove", onDrag);
	document.addEventListener("mouseup", stopDrag);
};

const onDrag = (e) => {
	if (!isDragging.value) return;

	const rect = cropArea.value.parentElement.getBoundingClientRect();
	const newX = e.clientX - startX.value;
	const newY = e.clientY - startY.value;

	// Yüzde olarak pozisyonu hesapla
	let percentX = (newX / rect.width) * 100;
	let percentY = (newY / rect.height) * 100;

	// Sınırları kontrol et
	percentX = Math.max(0, Math.min(100 - cameraCrop.value.width, percentX));
	percentY = Math.max(0, Math.min(100 - cameraCrop.value.height, percentY));

	cameraCrop.value.x = percentX;
	cameraCrop.value.y = percentY;
};

const stopDrag = () => {
	isDragging.value = false;
	if (cropArea.value.classList.contains("cursor-grabbing")) {
		cropArea.value.classList.remove("cursor-grabbing");
		cropArea.value.classList.add("cursor-grab");
	}
	document.removeEventListener("mousemove", onDrag);
	document.removeEventListener("mouseup", stopDrag);
};

// Event listener'ları temizle
onUnmounted(() => {
	document.removeEventListener("mousemove", onDrag);
	document.removeEventListener("mouseup", stopDrag);
});

// Değişiklikleri izle ve store'u güncelle
watch(
	[
		cameraSize,
		cameraRadius,
		cameraShadow,
		cameraCrop,
		followMouse,
		mirrorCamera,
	],
	([size, radius, shadow, crop, follow, mirror]) => {
		updateCameraSettings({
			size,
			radius,
			shadow,
			crop,
			followMouse: follow,
			mirror,
		});
	},
	{ immediate: true, deep: true }
);
</script>

<style scoped>
.aspect-video {
	aspect-ratio: 16/9;
}
</style>
