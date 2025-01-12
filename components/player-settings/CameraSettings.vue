<template>
	<div class="space-y-12">
		<div class="space-y-2">
			<h3 class="text-lg font-medium">Kamera Ayarları</h3>
			<p class="text-sm text-gray-400">
				Kamera görüntüsü için ayarları buradan yapabilirsiniz.
			</p>
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
			label="Gölge Opaklığı"
			desc="Kamera'nın gölgesinin opaklığını ayarlar."
			v-model="cameraShadow"
			:min="0"
			:max="100"
			:step="1"
			unit="%"
		/>
	</div>
</template>

<script setup>
import { ref, watch } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import SliderInput from "~/components/ui/SliderInput.vue";

const { cameraSettings, updateCameraSettings } = usePlayerSettings();

// Kamera ayarları için state
const cameraSize = ref(cameraSettings.value?.size || 30);
const cameraRadius = ref(cameraSettings.value?.radius || 12);
const cameraShadow = ref(cameraSettings.value?.shadow || 30);

// Değişiklikleri izle ve store'u güncelle
watch(
	[cameraSize, cameraRadius, cameraShadow],
	([size, radius, shadow]) => {
		updateCameraSettings({
			size,
			radius,
			shadow,
		});
	},
	{ immediate: true }
);
</script>
