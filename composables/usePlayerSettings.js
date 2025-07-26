import { ref, computed } from "vue";
import {
	CURSOR_TRANSITION_TYPES,
	setCursorTransitionType as setTransitionInMotionBlur,
} from "~/composables/utils/motionBlur";

const mouseSize = ref(180);
const motionBlurValue = ref(0.5);
const mouseVisible = ref(true);
const cursorTransitionType = ref(CURSOR_TRANSITION_TYPES.EASE);
const autoHideCursor = ref(true);
const enhancedMotionBlur = ref(true);
const motionBlurIntensity = ref(0.8);
const cursorSmoothness = ref(0);
const cursorOffset = ref(1); // Cursor timing offset in seconds (-2 to +2)
const synchronizedTimestamps = ref(null); // Synchronized recording timestamps
const backgroundColor = ref("");
const backgroundImage = ref(`/backgrounds/image7.jpg`);
const backgroundBlur = ref(0);
const padding = ref(128);
const radius = ref(64);
const shadowSize = ref(50);
const cropRatio = ref("");
const zoomRanges = ref([]);
const currentZoomRange = ref(null);
const showDock = ref(false);
const dockSize = ref(4);
const cameraSettings = ref({
	size: 15,
	radius: 50,
	shadow: 10,
	followMouse: true,
	mirror: true,
	visible: true,
	aspectRatio: "1:1",
	crop: {
		x: 21.875,
		y: 0,
		width: 56.25,
		height: 100,
	},
	customRatioWidth: 16,
	customRatioHeight: 9,
	borderWidth: 0,
	borderColor: "rgba(0, 0, 0, 1)",
	borderOpacity: 1,
	removeBackground: false,
	backgroundRemovalSettings: {
		segmentationThreshold: 0.6,
		internalResolution: "medium",
		flipHorizontal: false,
		targetFps: 30,
	},
});

// Ekran kaydı videosu için border ayarları
const videoBorderSettings = ref({
	width: 0,
	color: "rgba(0, 0, 0, 1)",
	radius: 0,
	opacity: 1,
});

// Motion blur için sabitler
const DEFAULT_MOTION_BLUR_VALUE = 0.6;
const MOTION_BLUR_CONSTANTS = {
	MIN_SPEED_THRESHOLD: 2.0,
	MAX_SPEED: 3.5,
	MIN_DISTANCE_THRESHOLD: 15,
	TRAIL_STEPS: 3,
	TRAIL_OPACITY_BASE: 0.35,
	TRAIL_OFFSET_MULTIPLIER: 0.9,
	BLUR_BASE: 0.7,
	MOVEMENT_ANGLE: 10,
	SKEW_FACTOR: 0.12,
	STRETCH_FACTOR: 0.2,
};

// Motion efekti için computed değer
const mouseMotionEnabled = computed(() => motionBlurValue.value > 0);

// Aktif zoom range için computed değerler
const activeZoomScale = computed(() => currentZoomRange.value?.scale || 1.25);
const activeZoomPosition = computed(
	() => currentZoomRange.value?.position || "center"
);

export const usePlayerSettings = () => {
	// Synchronized recording service integration
	const getSynchronizedTimestamp = (recordingType, timestamp) => {
		if (synchronizedTimestamps.value && synchronizedTimestamps.value.offsets) {
			const offset = synchronizedTimestamps.value.offsets[recordingType] || 0;
			return Math.max(0, timestamp - offset);
		}
		return timestamp; // Fallback
	};

	const setSynchronizedTimestamps = (timestamps) => {
		synchronizedTimestamps.value = timestamps;
		console.log('[usePlayerSettings] Synchronized timestamps set:', timestamps);
	};

	const updateMouseSize = (size) => {
		mouseSize.value = size;
	};

	const updateMotionBlur = (value) => {
		motionBlurValue.value = value;
	};

	const updateMouseVisible = (visible) => {
		mouseVisible.value = visible;
	};

	const updateCursorTransitionType = (type) => {
		if (Object.values(CURSOR_TRANSITION_TYPES).includes(type)) {
			cursorTransitionType.value = type;
			setTransitionInMotionBlur(type);
		}
	};

	const updateAutoHideCursor = (value) => {
		autoHideCursor.value = value;
	};

	const updateEnhancedMotionBlur = (value) => {
		enhancedMotionBlur.value = value;
	};

	const updateMotionBlurIntensity = (value) => {
		motionBlurIntensity.value = value;
	};

	const updateCursorSmoothness = (value) => {
		cursorSmoothness.value = value;
	};

	const updateCursorOffset = (value) => {
		cursorOffset.value = value;
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

	// Ekran kaydı videosu için border ayarlarını güncelleme fonksiyonu
	const updateVideoBorderSettings = (settings) => {
		videoBorderSettings.value = {
			...videoBorderSettings.value,
			...settings,
		};
	};

	const updateShowDock = (value) => {
		showDock.value = value;
	};

	const updateDockSize = (value) => {
		dockSize.value = value;
	};

	return {
		mouseSize,
		motionBlurValue,
		mouseVisible,
		cursorTransitionType,
		autoHideCursor,
		enhancedMotionBlur,
		motionBlurIntensity,
		cursorSmoothness,
		cursorOffset,
		synchronizedTimestamps,
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
		videoBorderSettings,
		mouseMotionEnabled,
		activeZoomScale,
		activeZoomPosition,
		MOTION_BLUR_CONSTANTS,
		showDock,
		dockSize,
		updateMouseSize,
		updateMotionBlur,
		updateMouseVisible,
		updateCursorTransitionType,
		updateAutoHideCursor,
		updateEnhancedMotionBlur,
		updateMotionBlurIntensity,
		updateCursorSmoothness,
		updateCursorOffset,
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
		updateVideoBorderSettings,
		updateShowDock,
		updateDockSize,
		getSynchronizedTimestamp,
		setSynchronizedTimestamps,
		CURSOR_TRANSITION_TYPES,
	};
};
