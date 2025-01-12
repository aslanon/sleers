<template>
	<div class="space-y-12">
		<div class="space-y-2">
			<h3 class="text-lg font-medium">Kamera Ayarları</h3>
			<p class="text-sm text-gray-400">
				Kamera görüntüsü için ayarları buradan yapabilirsiniz.
			</p>
		</div>

		<!-- Kamera Crop Ayarı -->
		<div class="space-y-2">
			<h4 class="text-base font-medium">Kamera Kırpma</h4>
			<p class="text-sm text-gray-400">
				Kamera görüntüsünün görünür alanını ayarlayın.
			</p>
			<div class="relative aspect-video bg-red-500 rounded-lg overflow-hidden">
				<div
					ref="cropArea"
					class="absolute bg-green-500/50 cursor-move"
					:style="{
						left: `${cameraCrop.x}%`,
						top: `${cameraCrop.y}%`,
						width: `${cameraCrop.width}%`,
						height: `${cameraCrop.height}%`,
						aspectRatio: '1/1',
					}"
					@mousedown="startDrag"
				></div>
			</div>
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

		<!-- Kamera Köşe Yuvarlaklığı -->
		<SliderInput
			label="Köşe Yuvarlaklığı"
			desc="Kamera'nın köşelerinin yuvarlaklığını ayarlar."
			v-model="cameraRadius"
			:min="0"
			:max="50"
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
	cameraSettings.value?.crop || { x: 0, y: 0, width: 56.25, height: 56.25 }
);

// Drag işlemleri için state
const isDragging = ref(false);
const startX = ref(0);
const startY = ref(0);
const cropArea = ref(null);

// Başlangıç boyutlarını ayarla
onMounted(() => {
	// Container yüksekliğine göre kare boyutunu hesapla
	const containerHeight = cropArea.value.parentElement.offsetHeight;
	const squareSize =
		(containerHeight / cropArea.value.parentElement.offsetWidth) * 100;

	cameraCrop.value.width = squareSize;
	cameraCrop.value.height = squareSize;

	// Merkeze konumlandır
	cameraCrop.value.x = (100 - cameraCrop.value.width) / 2;
	cameraCrop.value.y = 0;
});

// Drag işlemleri
const startDrag = (e) => {
	isDragging.value = true;
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
	[cameraSize, cameraRadius, cameraShadow, cameraCrop],
	([size, radius, shadow, crop]) => {
		updateCameraSettings({
			size,
			radius,
			shadow,
			crop,
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
