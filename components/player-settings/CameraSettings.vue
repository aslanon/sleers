<template>
	<div class="space-y-12">
		<!-- <div class="space-y-2">
			<h3 class="text-lg font-medium">Camera Settings</h3>
			<p class="text-sm font-normal text-gray-500">
				You can configure camera image settings from here.
			</p>
		</div> -->

		<!-- Camera Visibility -->
		<div class="flex items-center justify-between">
			<div>
				<h4 class="text-base font-semibold text-white">Camera Visibility</h4>
				<p class="text-sm font-normal text-gray-500">
					Show/hide camera image on canvas
				</p>
			</div>
			<label class="relative inline-flex items-center cursor-pointer">
				<input type="checkbox" v-model="cameraVisible" class="sr-only peer" />
				<div
					class="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"
				></div>
			</label>
		</div>

		<!-- Camera Mouse Tracking -->
		<div v-if="cameraVisible" class="flex items-center justify-between">
			<div>
				<h4 class="text-base font-semibold text-white">
					Mouse Cursor Tracking
				</h4>
				<p class="text-sm font-normal text-gray-500">
					Camera image should follow mouse cursor
				</p>
			</div>
			<label class="relative inline-flex items-center cursor-pointer">
				<input type="checkbox" v-model="followMouse" class="sr-only peer" />
				<div
					class="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"
				></div>
			</label>
		</div>

		<!-- Merge with Cursor -->
		<div v-if="cameraVisible" class="flex items-center justify-between">
			<div>
				<h4 class="text-base font-semibold text-white">
					Merge with Cursor
				</h4>
				<p class="text-sm font-normal text-gray-500">
					Replace camera and cursor with new cursor-following camera
				</p>
			</div>
			<label class="relative inline-flex items-center cursor-pointer">
				<input type="checkbox" v-model="mergeWithCursor" class="sr-only peer" />
				<div
					class="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"
				></div>
			</label>
		</div>

		<!-- Optimized Background Removal -->
		<OptimizedBackgroundRemovalSettings
			v-if="cameraVisible"
			:media-player-ref="props.mediaPlayerRef"
		/>

		<!-- Camera Horizontal Flip -->
		<div v-if="cameraVisible" class="flex items-center justify-between">
			<div>
				<h4 class="text-base font-semibold text-white">
					Flip Camera Horizontally
				</h4>
				<p class="text-sm font-normal text-gray-500">
					Mirror camera image horizontally
				</p>
			</div>
			<label class="relative inline-flex items-center cursor-pointer">
				<input type="checkbox" v-model="mirrorCamera" class="sr-only peer" />
				<div
					class="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"
				></div>
			</label>
		</div>

		<!-- Camera Size -->
		<SliderInput
			v-if="cameraVisible"
			label="Camera Size"
			desc="Adjusts camera size."
			v-model="cameraSize"
			:min="10"
			:max="100"
			:step="1"
			unit="%"
		/>

		<!-- Camera Crop Settings -->
		<div v-if="cameraVisible" class="space-y-4">
			<div>
				<h4 class="text-base font-semibold text-white">Camera Image</h4>
				<p class="text-sm font-normal text-gray-500">
					Adjust the visible area of camera image.
				</p>
			</div>

			<!-- Aspect Ratio Seçimi -->
			<div class="flex items-center justify-between">
				<span class="text-sm text-gray-400">Aspect Ratio:</span>
				<div class="flex items-center space-x-2">
					<select
						v-model="selectedAspectRatio"
						class="bg-zinc-800 text-white text-sm rounded-md border border-zinc-700 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
						@change="applyAspectRatio"
					>
						<!-- <option value="free">Serbest</option> -->
						<!-- <option value="custom">Özel</option> -->
						<option value="1:1">1:1 Square</option>
						<option value="16:9">16:9 Horizontal</option>
						<option value="9:16">9:16 Vertical</option>
						<option value="4:3">4:3 Horizontal</option>
						<option value="3:4">3:4 Vertical</option>
					</select>

					<!-- Özel oran seçildiğinde göster -->
					<div
						v-if="selectedAspectRatio === 'custom'"
						class="flex items-center space-x-1"
					>
						<input
							type="number"
							v-model.number="customRatioWidth"
							min="1"
							max="16"
							class="w-12 bg-zinc-800 text-white text-sm rounded-md border border-zinc-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
						/>
						<span class="text-gray-400">:</span>
						<input
							type="number"
							v-model.number="customRatioHeight"
							min="1"
							max="16"
							class="w-12 bg-zinc-800 text-white text-sm rounded-md border border-zinc-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
						/>
						<button
							@click="applyCustomRatio"
							class="bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-md px-2 py-1"
						>
							Apply
						</button>
					</div>
				</div>
			</div>

			<div
				class="relative max-w-[150px] aspect-video border-zinc-900 border rounded-xl overflow-hidden"
			>
				<div
					ref="cropArea"
					class="absolute flex items-center justify-center overflow-hidden ring-4 ring-inset ring-blue-500 rounded-xl cursor-grab"
					:style="{
						borderRadius: cameraRadius + 'px',
						left: `${cameraCrop.x}%`,
						top: `${cameraCrop.y}%`,
						width: `${cameraCrop.width}%`,
						height: `${cameraCrop.height}%`,
						aspectRatio:
							selectedAspectRatio === 'free'
								? 'auto'
								: getAspectRatioValue(selectedAspectRatio),
					}"
					@mousedown="startDrag"
				>
					<!-- Resize Handles -->
					<div
						v-if="selectedAspectRatio === 'free'"
						class="absolute inset-0 pointer-events-none"
					>
						<div
							class="resize-handle resize-handle-nw pointer-events-auto"
							@mousedown.stop="(e) => startResize('nw', e)"
						></div>
						<div
							class="resize-handle resize-handle-ne pointer-events-auto"
							@mousedown.stop="(e) => startResize('ne', e)"
						></div>
						<div
							class="resize-handle resize-handle-sw pointer-events-auto"
							@mousedown.stop="(e) => startResize('sw', e)"
						></div>
						<div
							class="resize-handle resize-handle-se pointer-events-auto"
							@mousedown.stop="(e) => startResize('se', e)"
						></div>
					</div>
				</div>
			</div>
		</div>

		<!-- Kamera Köşe Yuvarlaklığı -->
		<SliderInput
			v-if="cameraVisible"
			label="Corner Roundness"
			desc="Adjusts camera corner roundness."
			v-model="cameraRadius"
			:min="0"
			:max="100"
			:step="1"
			unit="px"
		/>

		<!-- Kamera Gölgesi -->
		<SliderInput
			v-if="cameraVisible"
			label="Shadow"
			desc="Adds shadow effect to camera."
			v-model="cameraShadow"
			:min="0"
			:max="100"
			:step="1"
			unit="%"
		/>

		<!-- Kamera Border Ayarları -->
		<div v-if="cameraVisible" class="space-y-4">
			<!-- Border Kalınlığı -->
			<SliderInput
				label="Border Thickness"
				desc="Adjusts camera border thickness."
				v-model="cameraBorderWidth"
				:min="0"
				:max="50"
				:step="1"
				unit="px"
			/>

			<!-- Border Rengi -->
			<div
				v-if="cameraBorderWidth > 0"
				class="flex w-full flex-col gap-2 items-center justify-between"
			>
				<div class="w-full">
					<h4 class="text-base font-semibold text-white">Border Color</h4>
				</div>
				<div class="flex w-full items-center space-x-2">
					<input
						type="color"
						v-model="borderColorHex"
						class="w-8 h-8 rounded cursor-pointer"
						@input="updateBorderColor"
					/>
					<div class="flex flex-col space-y-1">
						<input
							type="text"
							v-model="borderColorHex"
							class="w-20 bg-zinc-800 text-white text-sm rounded-md border border-zinc-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
							placeholder="#RRGGBB"
							@input="updateBorderColor"
						/>
					</div>
				</div>
				<div class="flex w-full items-center space-x-2">
					<SliderInput
						class="w-full"
						v-model="borderOpacityValue"
						desc="Border opacity"
						:min="0"
						:max="1"
						:step="0.01"
						unit=""
					/>
				</div>
			</div>
		</div>

		<div class="mt-2" v-if="selectedAspectRatio === 'free'">
			<button
				@click="applyCurrentCropAsRatio"
				class="bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-md px-2 py-1 w-full"
			>
				Save Current Crop as Aspect Ratio
			</button>
		</div>
	</div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, defineProps } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import SliderInput from "~/components/ui/SliderInput.vue";
import OptimizedBackgroundRemovalSettings from "~/components/player-settings/OptimizedBackgroundRemovalSettings.vue";

const { cameraSettings, updateCameraSettings } = usePlayerSettings();

const props = defineProps({
	mediaPlayerRef: { type: Object, default: null },
});

// Kamera ayarları için state
const cameraSize = ref(cameraSettings.value?.size || 30);
const cameraRadius = ref(cameraSettings.value?.radius || 15);
const cameraShadow = ref(cameraSettings.value?.shadow || 0);
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
const cameraVisible = ref(
	cameraSettings.value?.visible !== undefined
		? cameraSettings.value.visible
		: true
);
const mergeWithCursor = ref(cameraSettings.value?.mergeWithCursor || false);
const selectedAspectRatio = ref(cameraSettings.value?.aspectRatio || "1:1");
// Özel oran için değişkenler
const customRatioWidth = ref(cameraSettings.value?.customRatioWidth || 16);
const customRatioHeight = ref(cameraSettings.value?.customRatioHeight || 9);
// Border ayarları için değişkenler
const cameraBorderWidth = ref(cameraSettings.value?.borderWidth || 0);
const borderColorHex = ref(
	rgbaToHex(cameraSettings.value?.borderColor || "rgba(0, 0, 0, 1)")
);
const borderOpacityValue = ref(cameraSettings.value?.borderOpacity || 1);
const cameraBorderColor = ref(
	hexToRgba(borderColorHex.value, borderOpacityValue.value)
);

// Drag ve resize işlemleri için state
const isDragging = ref(false);
const isResizing = ref(false);
const resizeHandle = ref("");
const startX = ref(0);
const startY = ref(0);
const startWidth = ref(0);
const startHeight = ref(0);
const cropArea = ref(null);

// Aspect ratio değerini hesapla
const getAspectRatioValue = (ratio) => {
	switch (ratio) {
		case "1:1":
			return "1/1";
		case "16:9":
			return "16/9";
		case "9:16":
			return "9/16";
		case "4:3":
			return "4/3";
		case "3:4":
			return "3/4";
		case "custom":
			return `${customRatioWidth.value}/${customRatioHeight.value}`;
		default:
			return "auto";
	}
};

// Aspect ratio uygula
const applyAspectRatio = () => {
	if (selectedAspectRatio.value === "free") return;
	if (selectedAspectRatio.value === "custom") return;

	let ratioValue;
	switch (selectedAspectRatio.value) {
		case "1:1":
			ratioValue = 1;
			break;
		case "16:9":
			ratioValue = 16 / 9;
			break;
		case "9:16":
			ratioValue = 9 / 16;
			break;
		case "4:3":
			ratioValue = 4 / 3;
			break;
		case "3:4":
			ratioValue = 3 / 4;
			break;
		default:
			return;
	}

	// Mevcut genişliği koru, yüksekliği ayarla
	const containerWidth = 100; // Yüzde olarak
	const containerHeight = 100; // Yüzde olarak

	// Kare (1:1) için özel durum
	if (ratioValue === 1) {
		cameraCrop.value.width = 56.25;
		cameraCrop.value.height = 56.25;
		cameraCrop.value.x = 21.875;
		cameraCrop.value.y = 21.875;
		return;
	}

	// Diğer oranlar için hesaplama
	if (ratioValue > 1) {
		// Yatay (16:9, 4:3)
		cameraCrop.value.width = 75;
		cameraCrop.value.height = 75 / ratioValue;
		cameraCrop.value.x = 12.5;
		cameraCrop.value.y = (containerHeight - cameraCrop.value.height) / 2;
	} else {
		// Dikey (9:16, 3:4)
		cameraCrop.value.height = 75;
		cameraCrop.value.width = 75 * ratioValue;
		cameraCrop.value.y = 12.5;
		cameraCrop.value.x = (containerWidth - cameraCrop.value.width) / 2;
	}
};

// Özel oranı uygula
const applyCustomRatio = () => {
	if (customRatioWidth.value <= 0 || customRatioHeight.value <= 0) return;

	const ratioValue = customRatioWidth.value / customRatioHeight.value;
	const containerWidth = 100; // Yüzde olarak
	const containerHeight = 100; // Yüzde olarak

	// Özel oranı uygula
	if (ratioValue > 1) {
		// Yatay oran
		cameraCrop.value.width = 75;
		cameraCrop.value.height = 75 / ratioValue;
		cameraCrop.value.x = 12.5;
		cameraCrop.value.y = (containerHeight - cameraCrop.value.height) / 2;
	} else if (ratioValue < 1) {
		// Dikey oran
		cameraCrop.value.height = 75;
		cameraCrop.value.width = 75 * ratioValue;
		cameraCrop.value.y = 12.5;
		cameraCrop.value.x = (containerWidth - cameraCrop.value.width) / 2;
	} else {
		// Kare oran (1:1)
		cameraCrop.value.width = 56.25;
		cameraCrop.value.height = 56.25;
		cameraCrop.value.x = 21.875;
		cameraCrop.value.y = 21.875;
	}
};

// Mevcut kırpmayı oran olarak kaydet
const applyCurrentCropAsRatio = () => {
	// Mevcut kırpma alanının oranını hesapla
	const currentRatio = cameraCrop.value.width / cameraCrop.value.height;

	// En yakın tam sayı oranını bul
	let foundStandardRatio = false;
	const standardRatios = [
		{ name: "1:1", value: 1 },
		{ name: "16:9", value: 16 / 9 },
		{ name: "9:16", value: 9 / 16 },
		{ name: "4:3", value: 4 / 3 },
		{ name: "3:4", value: 3 / 4 },
	];

	// Standart oranlarla karşılaştır (0.1 tolerans ile)
	for (const ratio of standardRatios) {
		if (Math.abs(currentRatio - ratio.value) < 0.1) {
			selectedAspectRatio.value = ratio.name;
			foundStandardRatio = true;
			break;
		}
	}

	// Standart oran bulunamadıysa özel oran olarak ayarla
	if (!foundStandardRatio) {
		// Oranı basitleştir (örn. 1.77 -> 16:9)
		const simplifiedRatio = simplifyRatio(currentRatio);
		customRatioWidth.value = simplifiedRatio.width;
		customRatioHeight.value = simplifiedRatio.height;
		selectedAspectRatio.value = "custom";
	}
};

// Oranı basitleştir (ondalık sayıyı tam sayı oranına çevir)
const simplifyRatio = (ratio) => {
	// Yaygın oranları kontrol et
	const commonRatios = [
		{ width: 16, height: 9, value: 16 / 9 },
		{ width: 4, height: 3, value: 4 / 3 },
		{ width: 3, height: 2, value: 3 / 2 },
		{ width: 5, height: 4, value: 5 / 4 },
		{ width: 21, height: 9, value: 21 / 9 },
	];

	for (const r of commonRatios) {
		if (Math.abs(ratio - r.value) < 0.1) {
			return { width: r.width, height: r.height };
		}
	}

	// Yaygın oranlar bulunamadıysa, en yakın tam sayı oranını hesapla
	if (ratio >= 1) {
		// Yatay oran
		return { width: Math.round(ratio * 10), height: 10 };
	} else {
		// Dikey oran
		return { width: 10, height: Math.round(10 / ratio) };
	}
};

// Başlangıç boyutlarını ayarla
onMounted(() => {
	// Aspect ratio varsa uygula
	if (
		selectedAspectRatio.value !== "free" &&
		selectedAspectRatio.value !== "custom"
	) {
		applyAspectRatio();
	}
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
	if (cropArea.value && cropArea.value.classList.contains("cursor-grabbing")) {
		cropArea.value.classList.remove("cursor-grabbing");
		cropArea.value.classList.add("cursor-grab");
	}
	document.removeEventListener("mousemove", onDrag);
	document.removeEventListener("mouseup", stopDrag);
};

// Resize işlemleri
const startResize = (handle, e) => {
	isResizing.value = true;
	resizeHandle.value = handle;

	const rect = cropArea.value.parentElement.getBoundingClientRect();
	startX.value = e.clientX;
	startY.value = e.clientY;
	startWidth.value = cameraCrop.value.width;
	startHeight.value = cameraCrop.value.height;

	document.addEventListener("mousemove", onResize);
	document.addEventListener("mouseup", stopResize);
};

const onResize = (e) => {
	if (!isResizing.value) return;

	const rect = cropArea.value.parentElement.getBoundingClientRect();
	const deltaX = e.clientX - startX.value;
	const deltaY = e.clientY - startY.value;

	// Yüzde olarak değişimi hesapla
	const percentDeltaX = (deltaX / rect.width) * 100;
	const percentDeltaY = (deltaY / rect.height) * 100;

	// Hangi köşeden resize yapıldığına göre işlem yap
	switch (resizeHandle.value) {
		case "nw": // Sol üst
			cameraCrop.value.x = Math.max(0, cameraCrop.value.x + percentDeltaX);
			cameraCrop.value.y = Math.max(0, cameraCrop.value.y + percentDeltaY);
			cameraCrop.value.width = Math.max(10, startWidth.value - percentDeltaX);
			cameraCrop.value.height = Math.max(10, startHeight.value - percentDeltaY);
			break;
		case "ne": // Sağ üst
			cameraCrop.value.y = Math.max(0, cameraCrop.value.y + percentDeltaY);
			cameraCrop.value.width = Math.max(10, startWidth.value + percentDeltaX);
			cameraCrop.value.height = Math.max(10, startHeight.value - percentDeltaY);
			break;
		case "sw": // Sol alt
			cameraCrop.value.x = Math.max(0, cameraCrop.value.x + percentDeltaX);
			cameraCrop.value.width = Math.max(10, startWidth.value - percentDeltaX);
			cameraCrop.value.height = Math.max(10, startHeight.value + percentDeltaY);
			break;
		case "se": // Sağ alt
			cameraCrop.value.width = Math.max(10, startWidth.value + percentDeltaX);
			cameraCrop.value.height = Math.max(10, startHeight.value + percentDeltaY);
			break;
	}

	// Sınırları kontrol et
	cameraCrop.value.width = Math.min(
		100 - cameraCrop.value.x,
		cameraCrop.value.width
	);
	cameraCrop.value.height = Math.min(
		100 - cameraCrop.value.y,
		cameraCrop.value.height
	);
};

const stopResize = () => {
	isResizing.value = false;
	document.removeEventListener("mousemove", onResize);
	document.removeEventListener("mouseup", stopResize);
};

// Event listener'ları temizle
onUnmounted(() => {
	document.removeEventListener("mousemove", onDrag);
	document.removeEventListener("mouseup", stopDrag);
	document.removeEventListener("mousemove", onResize);
	document.removeEventListener("mouseup", stopResize);
});

// RGBA'dan HEX'e dönüştürme fonksiyonu
function rgbaToHex(rgba) {
	// RGBA formatını parçalara ayır (rgba(r,g,b,a))
	const match = rgba.match(
		/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*\.?\d+))?\)/
	);
	if (!match) return "#000000"; // Varsayılan değer

	const r = parseInt(match[1]);
	const g = parseInt(match[2]);
	const b = parseInt(match[3]);

	// RGB değerlerini HEX'e dönüştür
	return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// HEX'ten RGBA'ya dönüştürme fonksiyonu
function hexToRgba(hex, opacity = 1) {
	// HEX formatını parçalara ayır
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!result) return "rgba(0, 0, 0, " + opacity + ")"; // Varsayılan değer

	const r = parseInt(result[1], 16);
	const g = parseInt(result[2], 16);
	const b = parseInt(result[3], 16);

	// RGBA formatına dönüştür
	return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Renk değişikliğini güncelle
function updateBorderColor() {
	cameraBorderColor.value = hexToRgba(
		borderColorHex.value,
		borderOpacityValue.value
	);
}

// Opacity değişikliğini güncelle
function updateBorderOpacity() {
	cameraBorderColor.value = hexToRgba(
		borderColorHex.value,
		borderOpacityValue.value
	);
}

// Değişiklikleri izle ve store'u güncelle
watch(
	[
		cameraSize,
		cameraRadius,
		cameraShadow,
		cameraCrop,
		followMouse,
		mirrorCamera,
		cameraVisible,
		mergeWithCursor,
		selectedAspectRatio,
		customRatioWidth,
		customRatioHeight,
		cameraBorderWidth,
		borderColorHex,
		borderOpacityValue,
	],
	([
		size,
		radius,
		shadow,
		crop,
		follow,
		mirror,
		visible,
		merge,
		aspectRatio,
		customWidth,
		customHeight,
		borderWidth,
		borderColorHex,
		borderOpacity,
	]) => {
		const borderColor = hexToRgba(borderColorHex, borderOpacity);
		updateCameraSettings({
			size,
			radius,
			shadow,
			crop,
			followMouse: follow,
			mirror,
			visible,
			mergeWithCursor: merge,
			aspectRatio,
			customRatioWidth: customWidth,
			customRatioHeight: customHeight,
			borderWidth,
			borderColor,
			borderOpacity,
		});
	},
	{ immediate: false, deep: true }
);
</script>

<style scoped>
.aspect-video {
	aspect-ratio: 16/9;
}

.resize-handle {
	position: absolute;
	width: 10px;
	height: 10px;
	background: #2563eb;
	border: 1px solid white;
	z-index: 10;
}

.resize-handle-nw {
	top: -5px;
	left: -5px;
	cursor: nw-resize;
}

.resize-handle-ne {
	top: -5px;
	right: -5px;
	cursor: ne-resize;
}

.resize-handle-sw {
	bottom: -5px;
	left: -5px;
	cursor: sw-resize;
}

.resize-handle-se {
	bottom: -5px;
	right: -5px;
	cursor: se-resize;
}
</style>
