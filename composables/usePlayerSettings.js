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
		zoomRanges.value.push(range);
	};

	const removeZoomRange = (index) => {
		zoomRanges.value.splice(index, 1);
	};

	const updateZoomRange = (index, range) => {
		zoomRanges.value[index] = range;
	};

	const setCurrentZoomRange = (range) => {
		currentZoomRange.value = range;
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
	};
};
