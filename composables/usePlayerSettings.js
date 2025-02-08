import { ref, computed } from "vue";

const mouseSize = ref(124);
const motionBlurValue = ref(50);
const backgroundColor = ref("");
const backgroundImage = ref(`/backgrounds/image7.jpg`);
const backgroundBlur = ref(0);
const padding = ref(128);
const radius = ref(64);
const shadowSize = ref(50);
const cropRatio = ref("");
const zoomRanges = ref([]);
const currentZoomRange = ref(null);
const cameraSettings = ref({
	mirror: true,
	size: 15,
	radius: 50,
	shadow: 0,
	blur: 0,
	followMouse: false,
	crop: {
		x: 21.875,
		y: 0,
		width: 56.25,
		height: 100,
	},
});
// Motion blur için sabitler
const MOTION_BLUR_CONSTANTS = {
	MIN_SPEED_THRESHOLD: 1.1,
	MAX_SPEED: 3.0,
	MIN_DISTANCE_THRESHOLD: 10,
	TRAIL_STEPS: 3,
	TRAIL_OPACITY_BASE: 0.35,
	TRAIL_OFFSET_MULTIPLIER: 1,
	BLUR_BASE: 0.5,
	MOVEMENT_ANGLE: -10,
	SKEW_FACTOR: 0.05,
	STRETCH_FACTOR: 0.099,
};

// Motion efekti için computed değer
const mouseMotionEnabled = computed(() => motionBlurValue.value > 0);

// Aktif zoom range için computed değerler
const activeZoomScale = computed(() => currentZoomRange.value?.scale || 1.25);
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

	const updateBackgroundImage = (imagePath) => {
		backgroundImage.value = imagePath;
	};

	const updateBackgroundBlur = (value) => {
		backgroundBlur.value = value;
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
			scale: range.scale || 1.25,
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

	const updateCameraSettings = (settings) => {
		cameraSettings.value = {
			...cameraSettings.value,
			...settings,
		};
	};

	return {
		mouseSize,
		motionBlurValue,
		backgroundColor,
		backgroundImage,
		backgroundBlur,
		padding,
		radius,
		shadowSize,
		cropRatio,
		zoomRanges,
		currentZoomRange,
		cameraSettings,
		mouseMotionEnabled,
		activeZoomScale,
		activeZoomPosition,
		MOTION_BLUR_CONSTANTS,
		updateMouseSize,
		updateMotionBlur,
		updateBackgroundColor,
		updateBackgroundImage,
		updateBackgroundBlur,
		updatePadding,
		updateRadius,
		updateShadowSize,
		updateCropRatio,
		addZoomRange,
		removeZoomRange,
		updateZoomRange,
		setCurrentZoomRange,
		updateCameraSettings,
	};
};
