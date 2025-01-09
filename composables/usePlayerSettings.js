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

		// Aynı start-end aralığında başka bir range varsa güncelle
		const existingIndex = zoomRanges.value.findIndex(
			(r) => r.start === range.start && r.end === range.end
		);

		if (existingIndex !== -1) {
			zoomRanges.value[existingIndex] = newRange;
			if (
				currentZoomRange.value?.start === range.start &&
				currentZoomRange.value?.end === range.end
			) {
				currentZoomRange.value = newRange;
			}
		} else {
			zoomRanges.value.push(newRange);
		}
	};

	const removeZoomRange = (index) => {
		if (currentZoomRange.value === zoomRanges.value[index]) {
			currentZoomRange.value = null;
		}
		zoomRanges.value.splice(index, 1);
	};

	const updateZoomRange = (index, range) => {
		// Sadece değiştirilmiş değerleri güncelle
		const currentRange = zoomRanges.value[index];
		const updatedRange = {
			...currentRange,
			...range,
		};

		zoomRanges.value[index] = updatedRange;

		// Eğer aktif zoom range güncellendiyse, current'ı da güncelle
		if (
			currentZoomRange.value &&
			currentZoomRange.value.start === range.start &&
			currentZoomRange.value.end === range.end
		) {
			currentZoomRange.value = updatedRange;
		}
	};

	const setCurrentZoomRange = (range) => {
		if (range) {
			// Eğer range zaten zoomRanges içinde varsa, o referansı kullan
			const existingRange = zoomRanges.value.find(
				(r) => r.start === range.start && r.end === range.end
			);
			// Sadece manuel olarak ayarlanmış değerleri kullan
			if (existingRange) {
				currentZoomRange.value = existingRange;
			} else {
				currentZoomRange.value = range;
			}
		} else {
			currentZoomRange.value = null;
		}
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
	};
};
