<template>
	<div class="flex flex-col gap-12">
		<!-- <div class="space-y-2">
			<h3 class="text-lg font-medium">İmleç Ayarları</h3>
			<p class="text-sm text-gray-400">
				İmleç görüntüsü için ayarları buradan yapabilirsiniz.
			</p>
		</div> -->
		<div class="flex items-center justify-between">
			<div>
				<h4 class="text-base font-semibold text-white">İmleç Görünürlüğü</h4>
				<p class="text-sm font-normal text-gray-500">
					İmlecin videoda görünüp görünmeyeceğini ayarlar.
				</p>
			</div>
			<label class="relative inline-flex items-center cursor-pointer">
				<input type="checkbox" v-model="mouseVisible" class="sr-only peer" />
				<div
					class="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"
				></div>
			</label>
		</div>

		<div v-if="mouseVisible" class="flex items-center justify-between">
			<div>
				<h4 class="text-base font-semibold text-white">Otomatik Gizlenme</h4>
				<p class="text-sm font-normal text-gray-500">
					İmleç 3 saniye hareketsiz kaldığında otomatik olarak gizlenir.
				</p>
			</div>
			<label class="relative inline-flex items-center cursor-pointer">
				<input type="checkbox" v-model="autoHide" class="sr-only peer" />
				<div
					class="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"
				></div>
			</label>
		</div>

		<SliderInput
			v-if="mouseVisible"
			v-model="mouseSize"
			label="Mouse Size"
			desc="Mouse'un boyutunu ayarlar."
			:min="20"
			:max="400"
			:step="1"
			unit="px"
		/>

		<SliderInput
			v-if="mouseVisible"
			v-model="motionBlurValue"
			label="Motion Effect"
			desc="Mouse'un hareket ettiğinde görüntünün belirgin olmasını sağlar."
			:min="0"
			:max="1"
			:step="0.1"
		/>

		<!-- Cursor Transition Tipi Seçimi -->
		<div v-if="mouseVisible" class="flex flex-col gap-3">
			<div>
				<h4 class="text-base font-semibold text-white">Animasyon Türü</h4>
				<p class="text-sm font-normal text-gray-500">
					İmlecin hareket animasyon tipini belirler.
				</p>
			</div>

			<!-- Transition açıklaması - daha görsel bir kılavuz -->
			<div class="mt-4 grid grid-cols-4 gap-2">
				<div
					v-for="(value, key) in transitionTypes"
					:key="key"
					class="flex cursor-pointer p-1 border-2 border-transparent rounded-lg flex-col items-center"
					:class="{
						'border-2 !border-blue-500 rounded-lg ':
							selectedTransitionType === value,
					}"
					@click="selectTransitionType(value)"
					@mouseenter="startTypePreview(key)"
					@mouseleave="stopTypePreview(key)"
				>
					<div
						class="w-full h-8 bg-zinc-900 rounded-md relative overflow-hidden mb-1"
					>
						<div
							class="absolute top-1/2 w-full h-px bg-zinc-700 opacity-40"
						></div>
						<div
							class="w-3 h-3 bg-white rounded-full absolute top-1/2 transform -translate-y-1/2 transition-all duration-1500"
							:class="getTransitionClass(value)"
							:style="{
								left: isTypePreviews[key] ? 'calc(100% - 12px)' : '2px',
							}"
						></div>
					</div>
					<div class="text-xs text-center text-gray-300 truncate w-full">
						{{ getTransitionTypeShortName(value) }}
					</div>
				</div>
			</div>
			<!-- Transition tipi açıklaması -->
			<div class="mt-1">
				<p class="text-xs font-normal text-gray-500">
					{{ getTransitionTypeDescription(selectedTransitionType) }}
				</p>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, watch, onUnmounted, reactive } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import SliderInput from "~/components/ui/SliderInput.vue";

const {
	mouseSize: mouseSizeStore,
	motionBlurValue: motionBlurStore,
	mouseVisible: mouseVisibleStore,
	cursorTransitionType: cursorTransitionTypeStore,
	autoHideCursor: autoHideCursorStore,
	CURSOR_TRANSITION_TYPES: transitionTypes,
	updateMouseSize,
	updateMotionBlur,
	updateMouseVisible,
	updateCursorTransitionType,
	updateAutoHideCursor,
} = usePlayerSettings();

// Local state
const mouseSize = ref(mouseSizeStore.value);
const motionBlurValue = ref(motionBlurStore.value);
const mouseVisible = ref(mouseVisibleStore.value);
const selectedTransitionType = ref(cursorTransitionTypeStore.value);
const autoHide = ref(autoHideCursorStore.value);

// Önizleme için state
const isPreviewActive = ref(false);
const isTypePreviews = reactive({
	LINEAR: false,
	EASE: false,
	EASE_IN: false,
	EASE_OUT: false,
});
let previewTimer = null;
let typePreviewTimers = {};

// Önizlemeyi tetikle
const togglePreview = () => {
	if (isPreviewActive.value) {
		// Önceki animasyonu sıfırla ve yeniden başlat
		isPreviewActive.value = false;
		setTimeout(() => {
			isPreviewActive.value = true;
		}, 50);
	} else {
		// İlk kez başlat
		isPreviewActive.value = true;
	}

	// 2 saniye sonra önizlemeyi sıfırla
	clearTimeout(previewTimer);
	previewTimer = setTimeout(() => {
		isPreviewActive.value = false;
	}, 2000);
};

// Transition tipini seç
const selectTransitionType = (type) => {
	selectedTransitionType.value = type;
	togglePreview(); // Seçildiğinde hemen önizleme yap
};

// Belirli bir transition tipi için önizleme başlat
const startTypePreview = (key) => {
	// Önce varsa önceki timerı temizle
	if (typePreviewTimers[key]) {
		clearTimeout(typePreviewTimers[key]);
	}

	// Önizlemeyi aktifleştir
	isTypePreviews[key] = true;

	// 2 saniye sonra sıfırla
	typePreviewTimers[key] = setTimeout(() => {
		isTypePreviews[key] = false;
	}, 2000);
};

// Belirli bir transition tipi için önizlemeyi durdur
const stopTypePreview = (key) => {
	// Önizlemeyi baştan yap - mouseout olduğunda reset et
	isTypePreviews[key] = false;
};

// Component temizlendiğinde timer'ları temizle
onUnmounted(() => {
	clearTimeout(previewTimer);
	Object.values(typePreviewTimers).forEach((timer) => {
		clearTimeout(timer);
	});
});

// Transition tiplerini insan dostu formatta göster
const getTransitionTypeDisplay = (type) => {
	switch (type) {
		case transitionTypes.LINEAR:
			return "Doğrusal (Linear)";
		case transitionTypes.EASE:
			return "Yumuşak (Ease)";
		case transitionTypes.EASE_IN:
			return "Başlangıçta Yavaş (Ease-in)";
		case transitionTypes.EASE_OUT:
			return "Sonunda Yavaş (Ease-out)";
		default:
			return type;
	}
};

// Kısa transition tipleri için (grid gösterimi)
const getTransitionTypeShortName = (type) => {
	switch (type) {
		case transitionTypes.LINEAR:
			return "Doğrusal";
		case transitionTypes.EASE:
			return "Yumuşak";
		case transitionTypes.EASE_IN:
			return "Başta Yavaş";
		case transitionTypes.EASE_OUT:
			return "Sonda Yavaş";
		default:
			return type;
	}
};

// Transition tipi açıklaması
const getTransitionTypeDescription = (type) => {
	switch (type) {
		case transitionTypes.LINEAR:
			return "Sabit hızda hareket eder, geçiş sırasında hız değişmez.";
		case transitionTypes.EASE:
			return "Hareketin başında yavaş, ortasında hızlı, sonunda tekrar yavaşlar.";
		case transitionTypes.EASE_IN:
			return "Hareketin başında yavaş başlar, giderek hızlanır.";
		case transitionTypes.EASE_OUT:
			return "Hareketin başında hızlı, sona doğru yavaşlayarak durur.";
		default:
			return "";
	}
};

// Önizleme için transition class'ı
const getTransitionClass = (type) => {
	switch (type) {
		case transitionTypes.LINEAR:
			return "transition-timing-function-linear";
		case transitionTypes.EASE:
			return "transition-timing-function-ease";
		case transitionTypes.EASE_IN:
			return "transition-timing-function-ease-in";
		case transitionTypes.EASE_OUT:
			return "transition-timing-function-ease-out";
		default:
			return "transition-timing-function-ease";
	}
};

// Watch local changes
watch(mouseSize, (newValue) => {
	updateMouseSize(newValue);
});

watch(motionBlurValue, (newValue) => {
	updateMotionBlur(newValue);
});

watch(mouseVisible, (newValue) => {
	updateMouseVisible(newValue);
});

watch(selectedTransitionType, (newValue) => {
	updateCursorTransitionType(newValue);
});

// Watch store changes
watch(mouseSizeStore, (newValue) => {
	mouseSize.value = newValue;
});

watch(motionBlurStore, (newValue) => {
	motionBlurValue.value = newValue;
});

watch(mouseVisibleStore, (newValue) => {
	mouseVisible.value = newValue;
});

watch(cursorTransitionTypeStore, (newValue) => {
	selectedTransitionType.value = newValue;
});

// Watch autoHide changes
watch(autoHide, (newValue) => {
	updateAutoHideCursor(newValue);
});
</script>

<style scoped>
.transition-timing-function-linear {
	transition-timing-function: linear;
}
.transition-timing-function-ease {
	transition-timing-function: ease;
}
.transition-timing-function-ease-in {
	transition-timing-function: ease-in;
}
.transition-timing-function-ease-out {
	transition-timing-function: ease-out;
}
</style>
