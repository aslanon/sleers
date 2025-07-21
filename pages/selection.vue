<template>
	<div class="selection-container" @keydown="handleKeyDown" tabindex="0">
		<!-- Aspect Ratio Seçici -->
		<div class="aspect-ratio-selector">
			<select v-model="selectedRatio" class="ratio-select">
				<option value="free">Free</option>
				<option value="1:1">1:1 Square</option>
				<option value="4:3">4:3 Landscape</option>
				<option value="16:9">16:9 Landscape</option>
				<option value="9:16">9:16 Portrait</option>
				<option value="3:4">3:4 Portrait</option>
			</select>
		</div>

		<div
			class="selection-area"
			@mousedown.prevent="startSelection"
			@mousemove="updateSelection"
		>
			<!-- Seçim kutusu - ya aktif seçim yapılıyorsa ya da seçim tamamlanmışsa görünür -->
			<div
				v-if="isSelecting || selectionCompleted"
				class="selection-box"
				:style="{
					left: `${Math.min(startPoint.x, endPoint.x)}px`,
					top: `${Math.min(startPoint.y, endPoint.y)}px`,
					width: `${Math.abs(endPoint.x - startPoint.x)}px`,
					height: `${Math.abs(endPoint.y - startPoint.y)}px`,
					cursor: isSelecting ? 'crosshair' : 'move',
				}"
				@mousedown.stop="selectionCompleted ? startDrag($event) : null"
			>
				<div class="selection-box-overlay"></div>
				<div class="selection-box-handles">
					<div
						class="handle handle-nw"
						@mousedown.stop="startResize('nw')"
					></div>
					<div
						class="handle handle-ne"
						@mousedown.stop="startResize('ne')"
					></div>
					<div
						class="handle handle-sw"
						@mousedown.stop="startResize('sw')"
					></div>
					<div
						class="handle handle-se"
						@mousedown.stop="startResize('se')"
					></div>
				</div>
				<!-- Çözünürlük Bilgisi -->
				<div class="resolution-info">
					{{ Math.abs(endPoint.x - startPoint.x) }} x
					{{ Math.abs(endPoint.y - startPoint.y) }}
				</div>
				<!-- Onay Butonu -->
				<button
					v-if="isValidSize"
					class="confirm-button z-50"
					@mousedown.stop
					@click.stop="confirmSelection"
				>
					Confirm Selection
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from "vue";

const electron = window.electron;
const isSelecting = ref(false); // Aktif seçim yapılıyor mu?
const selectionCompleted = ref(false); // Seçim tamamlandı mı?
const startPoint = ref({ x: 0, y: 0 });
const endPoint = ref({ x: 0, y: 0 });
const selectedArea = ref({ x: 0, y: 0, width: 0, height: 0 });
const isResizing = ref(false);
const resizeHandle = ref("");
const selectedRatio = ref("free");
const currentDisplay = ref(null);
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });

// Minimum boyut kontrolü
const MIN_SIZE = 100;
const isValidSize = computed(() => {
	const width = Math.abs(endPoint.value.x - startPoint.value.x);
	const height = Math.abs(endPoint.value.y - startPoint.value.y);
	return width >= MIN_SIZE && height >= MIN_SIZE;
});

// Aspect ratio uygulaması için watch
watch(selectedRatio, (newRatio) => {
	// Seçim tamamlandıysa veya seçim yapılıyorsa ve yeni bir oran seçildiyse
	if ((isSelecting.value || selectionCompleted.value) && newRatio !== "free") {
		applyAspectRatio();
	}
});

// Aspect ratio uygulama fonksiyonu
const applyAspectRatio = () => {
	if (selectedRatio.value === "free") return;

	let ratio;
	switch (selectedRatio.value) {
		case "1:1":
			ratio = 1;
			break;
		case "4:3":
			ratio = 4 / 3;
			break;
		case "16:9":
			ratio = 16 / 9;
			break;
		case "9:16":
			ratio = 9 / 16;
			break;
		case "3:4":
			ratio = 3 / 4;
			break;
		default:
			return;
	}

	// Mevcut genişliği koru, yüksekliği ayarla
	const width = Math.abs(endPoint.value.x - startPoint.value.x);
	const newHeight = width / ratio;

	// Başlangıç noktasına göre bitiş noktasını güncelle
	if (endPoint.value.x > startPoint.value.x) {
		endPoint.value.y = startPoint.value.y + newHeight;
	} else {
		endPoint.value.y = startPoint.value.y - newHeight;
	}
};

// ESC tuşuna basılınca pencereyi kapat
const handleKeyDown = (e) => {
	if (e.key === "Escape") {

		// Doğrudan pencereyi kapat
		try {
			electron.selection.closeWindow();
		} catch (error) {
			console.error("ESC ile pencere kapatma hatası:", error);
			// Alternatif yöntem
			electron.ipcRenderer.send("CLOSE_SELECTION_WINDOW");
		}

		// Event'in yayılımını engelle
		e.stopPropagation();
		e.preventDefault();
	}
};

// Seçim penceresini kapat
const closeSelectionWindow = () => {
	// IPC üzerinden ana sürece gönder
	electron.selection.closeWindow();
};

const startSelection = (e) => {
	// Eğer zaten bir seçim tamamlanmışsa ve seçim alanının dışına tıklandıysa
	// yeni bir seçim başlat
	const clickedOnSelectionBox = isClickInsideSelectionBox(e);

	if (selectionCompleted.value && !clickedOnSelectionBox) {
		// Seçim alanının dışına tıklandı, yeni seçime başla
		selectionCompleted.value = false;
		isSelecting.value = true;
		startPoint.value = { x: e.clientX, y: e.clientY };
		endPoint.value = { x: e.clientX, y: e.clientY };
	} else if (!selectionCompleted.value && !isSelecting.value) {
		// Henüz seçim yapılmadı, yeni bir seçim başlat
		isSelecting.value = true;
		startPoint.value = { x: e.clientX, y: e.clientY };
		endPoint.value = { x: e.clientX, y: e.clientY };
	}

	// Ekran bilgilerini al
	if (window.screen) {
		currentDisplay.value = {
			width: window.screen.width,
			height: window.screen.height,
			availWidth: window.screen.availWidth,
			availHeight: window.screen.availHeight,
			devicePixelRatio: window.devicePixelRatio || 1,
		};
	}
};

// Tıklanan konumun seçim kutusu içinde olup olmadığını kontrol et
const isClickInsideSelectionBox = (e) => {
	if (!selectionCompleted.value) return false;

	const minX = Math.min(startPoint.value.x, endPoint.value.x);
	const maxX = Math.max(startPoint.value.x, endPoint.value.x);
	const minY = Math.min(startPoint.value.y, endPoint.value.y);
	const maxY = Math.max(startPoint.value.y, endPoint.value.y);

	return (
		e.clientX >= minX &&
		e.clientX <= maxX &&
		e.clientY >= minY &&
		e.clientY <= maxY
	);
};

const updateSelection = (e) => {
	if (!isSelecting.value) return;

	endPoint.value = { x: e.clientX, y: e.clientY };

	// Aspect ratio uygulanıyorsa oranı koru
	if (selectedRatio.value !== "free") {
		applyAspectRatio();
	}
};

// Seçim alanını sürükleme başlat
const startDrag = (e) => {

	if (!selectionCompleted.value) {
		return;
	}

	isDragging.value = true;
	dragOffset.value = {
		x: e.clientX - Math.min(startPoint.value.x, endPoint.value.x),
		y: e.clientY - Math.min(startPoint.value.y, endPoint.value.y),
	};


	document.addEventListener("mousemove", handleDrag);
	document.addEventListener("mouseup", stopDrag);

	e.preventDefault();
	e.stopPropagation();
};

// Sürükleme işlemini yönet
const handleDrag = (e) => {
	if (!isDragging.value) return;


	const width = Math.abs(endPoint.value.x - startPoint.value.x);
	const height = Math.abs(endPoint.value.y - startPoint.value.y);

	// Yeni başlangıç noktası
	const newX = e.clientX - dragOffset.value.x;
	const newY = e.clientY - dragOffset.value.y;

	// Ekran sınırlarını aşmasını engelle
	const maxX = window.innerWidth - width;
	const maxY = window.innerHeight - height;

	const boundedX = Math.max(0, Math.min(newX, maxX));
	const boundedY = Math.max(0, Math.min(newY, maxY));

	// Başlangıç ve bitiş noktalarını güncelle
	if (startPoint.value.x <= endPoint.value.x) {
		startPoint.value.x = boundedX;
		endPoint.value.x = boundedX + width;
	} else {
		endPoint.value.x = boundedX;
		startPoint.value.x = boundedX + width;
	}

	if (startPoint.value.y <= endPoint.value.y) {
		startPoint.value.y = boundedY;
		endPoint.value.y = boundedY + height;
	} else {
		endPoint.value.y = boundedY;
		startPoint.value.y = boundedY + height;
	}
};

// Sürükleme işlemini sonlandır
const stopDrag = () => {
	isDragging.value = false;
	document.removeEventListener("mousemove", handleDrag);
	document.removeEventListener("mouseup", stopDrag);
};

const startResize = (handle) => {
	isResizing.value = true;
	resizeHandle.value = handle;
	document.addEventListener("mousemove", handleResize);
	document.addEventListener("mouseup", stopResize);
};

const handleResize = (e) => {
	if (!isResizing.value) return;

	// Resize handle'a göre güncelleme yap
	switch (resizeHandle.value) {
		case "nw":
			startPoint.value = { x: e.clientX, y: e.clientY };
			break;
		case "ne":
			startPoint.value.y = e.clientY;
			endPoint.value.x = e.clientX;
			break;
		case "sw":
			startPoint.value.x = e.clientX;
			endPoint.value.y = e.clientY;
			break;
		case "se":
			endPoint.value = { x: e.clientX, y: e.clientY };
			break;
	}

	// Aspect ratio uygulanıyorsa oranı koru
	if (selectedRatio.value !== "free") {
		applyAspectRatio();
	}
};

const stopResize = () => {
	isResizing.value = false;
	document.removeEventListener("mousemove", handleResize);
	document.removeEventListener("mouseup", stopResize);
};

const confirmSelection = () => {
	// Son koordinatları hesapla
	const width = Math.abs(endPoint.value.x - startPoint.value.x);
	const height = Math.abs(endPoint.value.y - startPoint.value.y);
	const x = Math.min(startPoint.value.x, endPoint.value.x);
	const y = Math.min(startPoint.value.y, endPoint.value.y);

	// Seçim bilgisini detaylı olarak oluştur
	const selectionData = {
		x,
		y,
		width,
		height,
		aspectRatio: selectedRatio.value,
		display: currentDisplay.value,
		devicePixelRatio: window.devicePixelRatio || 1,
	};

	// Eğer aspect ratio belirtilmişse ekle
	if (selectedRatio.value !== "free") {
		switch (selectedRatio.value) {
			case "1:1":
				selectionData.aspectRatioValue = 1;
				break;
			case "4:3":
				selectionData.aspectRatioValue = 4 / 3;
				break;
			case "16:9":
				selectionData.aspectRatioValue = 16 / 9;
				break;
			case "9:16":
				selectionData.aspectRatioValue = 9 / 16;
				break;
			case "3:4":
				selectionData.aspectRatioValue = 3 / 4;
				break;
		}
	}


	// Önce verileri gönder, sonra pencereyi kapat
	try {
		// Ana sürece seçim verilerini gönder
		electron.ipcRenderer.send("AREA_SELECTED", selectionData);

		// Kısa bir gecikme ile pencereyi kapat (ana sürecin işlem yapması için)
		setTimeout(() => {
			electron.selection.closeWindow();
		}, 200);
	} catch (error) {
		console.error("Seçim onaylama hatası:", error);

		// Hata durumunda da pencereyi kapatmaya çalış
		try {
			electron.selection.closeWindow();
		} catch (e) {
			console.error("Pencere kapatma hatası:", e);
			// Son çare olarak doğrudan IPC gönder
			electron.ipcRenderer.send("CLOSE_SELECTION_WINDOW");
		}
	}
};

// Ana window event listenerları
onMounted(() => {
	// Sayfa yüklendiğinde focus ver ki, klavye eventlerini alabilsin
	const container = document.querySelector(".selection-container");
	if (container) {
		container.focus();
	}

	// ESC tuşu için global event listener
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {

			// Doğrudan pencereyi kapat
			try {
				electron.selection.closeWindow();
			} catch (error) {
				console.error("Global ESC ile pencere kapatma hatası:", error);
				// Alternatif yöntem
				electron.ipcRenderer.send("CLOSE_SELECTION_WINDOW");
			}

			// Event'in yayılımını engelle
			e.stopPropagation();
			e.preventDefault();
		}
	});

	// Çok sayıda event dinleme işlemi yerine tek bir dinleyici kullan
	document.addEventListener("mousedown", onMouseDown);
	document.addEventListener("mousemove", onMouseMove);
	document.addEventListener("mouseup", onMouseUp);
});

onUnmounted(() => {
	// Tüm event listenerları temizle
	document.removeEventListener("mousedown", onMouseDown);
	document.removeEventListener("mousemove", onMouseMove);
	document.removeEventListener("mouseup", onMouseUp);
	document.removeEventListener("keydown", handleKeyDown);

	// Resize ve drag event listenerlarını temizle
	document.removeEventListener("mousemove", handleResize);
	document.removeEventListener("mouseup", stopResize);
	document.removeEventListener("mousemove", handleDrag);
	document.removeEventListener("mouseup", stopDrag);
});

const onMouseDown = (e) => {
	if (e.button === 0) {
		// Zaten seçim tamamlanmışsa ve seçim alanına tıklanmışsa, sürükleme başlat
		if (selectionCompleted.value && isClickInsideSelectionBox(e)) {
			startDrag(e);
			return;
		}

		// Aksi takdirde yeni bir seçim başlat
		isSelecting.value = true;
		selectionCompleted.value = false;
		startPoint.value = { x: e.clientX, y: e.clientY };
		endPoint.value = { x: e.clientX, y: e.clientY };
	}
};

const onMouseMove = (e) => {
	// Sürükleme işlemi devam ediyorsa
	if (isDragging.value) {
		handleDrag(e);
		return;
	}

	// Aktif seçim yapılıyorsa
	if (isSelecting.value) {
		endPoint.value = { x: e.clientX, y: e.clientY };

		// Aspect ratio uygulanıyorsa oranı koru
		if (selectedRatio.value !== "free") {
			applyAspectRatio();
		}
	}
};

const onMouseUp = (e) => {
	// Sürükleme işlemi bitiyorsa
	if (isDragging.value) {
		stopDrag();
		return;
	}

	// Aktif seçim bitiyorsa
	if (isSelecting.value) {
		isSelecting.value = false;

		// Seçim minimum boyuttan büyükse tamamlandı olarak işaretle
		const width = Math.abs(endPoint.value.x - startPoint.value.x);
		const height = Math.abs(endPoint.value.y - startPoint.value.y);

		if (width >= MIN_SIZE && height >= MIN_SIZE) {
			selectionCompleted.value = true;

			selectedArea.value = {
				x: Math.min(startPoint.value.x, endPoint.value.x),
				y: Math.min(startPoint.value.y, endPoint.value.y),
				width,
				height,
			};

		} else {
			// Minimum boyut sağlanmıyorsa seçimi iptal et
			selectionCompleted.value = false;
		}
	}
};
</script>

<style scoped>
.selection-container {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.5);
	cursor: crosshair;
	outline: none; /* focus görünümünü gizler */
}

.aspect-ratio-selector {
	position: fixed;
	top: 20px;
	left: 50%;
	transform: translateX(-50%);
	z-index: 1000;
}

.ratio-select {
	background: #2563eb;
	color: white;
	padding: 8px 16px;
	border: none;
	border-radius: 6px;
	font-size: 14px;
	cursor: pointer;
}

.ratio-select:hover {
	background: #1d4ed8;
}

.selection-area {
	position: absolute;
	inset: 0;
}

.selection-box {
	position: absolute;
	border: 2px solid #2563eb;
	background: rgba(37, 99, 235, 0.1);
	pointer-events: all;
}

.selection-box-overlay {
	position: absolute;
	inset: 0;
	border: 1px solid rgba(255, 255, 255, 0.3);
}

.selection-box-handles {
	position: absolute;
	inset: 0;
	pointer-events: all;
}

.handle {
	position: absolute;
	width: 10px;
	height: 10px;
	background: #2563eb;
	border: 1px solid white;
}

.handle-nw {
	top: -5px;
	left: -5px;
	cursor: nw-resize;
}
.handle-ne {
	top: -5px;
	right: -5px;
	cursor: ne-resize;
}
.handle-sw {
	bottom: -5px;
	left: -5px;
	cursor: sw-resize;
}
.handle-se {
	bottom: -5px;
	right: -5px;
	cursor: se-resize;
}

.resolution-info {
	position: absolute;
	top: -30px;
	left: 50%;
	transform: translateX(-50%);
	background: #2563eb;
	color: white;
	padding: 4px 8px;
	border-radius: 4px;
	font-size: 14px;
	white-space: nowrap;
}

.confirm-button {
	position: absolute;
	bottom: -40px;
	left: 50%;
	transform: translateX(-50%);
	background: #2563eb;
	color: white;
	padding: 8px 16px;
	border-radius: 6px;
	font-size: 14px;
	cursor: pointer;
	pointer-events: all;
	border: none;
	transition: background-color 0.2s;
	z-index: 100;
}

.confirm-button:hover {
	background: #1d4ed8;
}
</style>
