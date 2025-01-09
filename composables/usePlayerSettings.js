import { ref, computed } from "vue";

const mouseSize = ref(65);
const motionBlurValue = ref(50);
const backgroundColor = ref("#000000");
const padding = ref(0);
const radius = ref(0);
const shadowSize = ref(0);
const cropRatio = ref("");
const zoomRanges = ref([]);
const currentZoomRange = ref(null);

// Motion efekti için computed değer
const mouseMotionEnabled = computed(() => motionBlurValue.value > 0);

// Aktif zoom range için computed değerler
const activeZoomScale = computed(() => currentZoomRange.value?.scale || 2);
const activeZoomPosition = computed(
	() => currentZoomRange.value?.position || "center"
);

export const usePlayerSettings = () => {
	const updateMouseSize = (size) => {
		mouseSize.value = size;
	};

	const updateMotionBlur = (value) => {
		motionBlurValue.value = value;
	};

	const updateBackgroundColor = (color) => {
		backgroundColor.value = color;
	};

	const updatePadding = (value) => {
		padding.value = value;
	};

	const updateRadius = (value) => {
		radius.value = value;
	};

	const updateShadowSize = (value) => {
		shadowSize.value = value;
	};

	const updateCropRatio = (ratio) => {
		cropRatio.value = ratio;
	};

	const addZoomRange = (range) => {
		// Default değerleri ekle
		const newRange = {
			...range,
			scale: range.scale || 2,
			position: range.position || "center",
		};
		zoomRanges.value.push(newRange);
	};

	const removeZoomRange = (index) => {
		if (currentZoomRange.value === zoomRanges.value[index]) {
			currentZoomRange.value = null;
		}
		zoomRanges.value.splice(index, 1);
	};

	const updateZoomRange = (index, range) => {
		// Zoom range'i güncelle
		zoomRanges.value[index] = range;

		// Eğer aktif zoom range güncellendiyse, current'ı da güncelle
		if (
			currentZoomRange.value &&
			currentZoomRange.value.start === zoomRanges.value[index].start &&
			currentZoomRange.value.end === zoomRanges.value[index].end
		) {
			currentZoomRange.value = range;
		}
	};

	const setCurrentZoomRange = (range) => {
		currentZoomRange.value = range;
	};

	// Zoom efektlerini uygula
	const applyZoomEffect = (range) => {
		// Bu fonksiyon video preview'da zoom efektini uygulayacak
		// Örnek: Video elementinin transform ve scale değerlerini güncelle
		const scale = range.scale || 2;
		const position = range.position || "center";

		// Bu değerleri video preview'a uygulamak için kullanılacak
		return {
			scale,
			position,
			transform: getTransformForPosition(position, scale),
		};
	};

	// Pozisyona göre transform değerini hesapla
	const getTransformForPosition = (position, scale) => {
		const positions = {
			"top-left": "translate(0%, 0%)",
			"top-center": "translate(-50%, 0%)",
			"top-right": "translate(-100%, 0%)",
			"middle-left": "translate(0%, -50%)",
			center: "translate(-50%, -50%)",
			"middle-right": "translate(-100%, -50%)",
			"bottom-left": "translate(0%, -100%)",
			"bottom-center": "translate(-50%, -100%)",
			"bottom-right": "translate(-100%, -100%)",
		};

		return `${positions[position]} scale(${scale})`;
	};

	return {
		mouseSize,
		motionBlurValue,
		mouseMotionEnabled,
		backgroundColor,
		padding,
		radius,
		shadowSize,
		cropRatio,
		updateMouseSize,
		updateMotionBlur,
		updateBackgroundColor,
		updatePadding,
		updateRadius,
		updateShadowSize,
		updateCropRatio,
		zoomRanges,
		addZoomRange,
		removeZoomRange,
		updateZoomRange,
		currentZoomRange,
		setCurrentZoomRange,
		activeZoomScale,
		activeZoomPosition,
		applyZoomEffect,
	};
};
