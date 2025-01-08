import { ref } from "vue";

const mouseSize = ref(42);
const motionBlurValue = ref(0);
const backgroundColor = ref("#000000");
const padding = ref(0);
const radius = ref(0);
const shadowSize = ref(0);

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

	return {
		mouseSize,
		motionBlurValue,
		backgroundColor,
		padding,
		radius,
		shadowSize,
		updateMouseSize,
		updateMotionBlur,
		updateBackgroundColor,
		updatePadding,
		updateRadius,
		updateShadowSize,
	};
};
