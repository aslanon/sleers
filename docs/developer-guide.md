# Sleer Geliştirici Kılavuzu

## Otomatik Dokümantasyon Güncelleme

Bu dokümantasyon, sisteme yeni özellikler eklendikçe otomatik olarak güncellenir. Güncelleme süreci şu şekilde işler:

1. **Özellik Ekleme**:

   - Yeni bir özellik eklendiğinde, ilgili kod değişiklikleri yapılır
   - Değişiklikler commit edilmeden önce dokümantasyon güncellemesi yapılmalıdır

2. **Güncelleme Kuralları**:

   - Her yeni özellik ilgili bölüme eklenmeli
   - Mevcut yapıyı bozmadan güncelleme yapılmalı
   - Özelliğin detaylı açıklaması eklenmelidir

3. **Güncelleme Kontrol Listesi**:
   - [ ] İlgili bölüm belirlendi
   - [ ] Özellik detayları eklendi
   - [ ] Bağlantılı değişiklikler güncellendi
   - [ ] Dokümantasyon formatı korundu

### Son Güncelleme Bilgisi

- Tarih: 2024-12-19
- Sürüm: 1.3.0
- Değişiklik: Native Cursor Tracking Entegrasyonu

## 1. Temel Yapı ve Prensipler

### Teknoloji Yığını

- **Frontend**: Nuxt.js (SSR kapalı)
- **Desktop**: Electron
- **UI**: TailwindCSS
- **Video İşleme**: FFmpeg

### Temel Prensipler

1. **Modülerlik**: Her bileşen tek bir sorumluluğa sahip olmalı
2. **State Yönetimi**: `main.cjs` üzerinden merkezi state yönetimi
3. **Asenkron İşlemler**: `async/await` kullanımı
4. **Hata Yönetimi**: Try-catch blokları ile hata yakalama
5. **Kod Standardı**: ES6+ özellikleri

## 2. Uygulama Mimarisi

### Ana Bileşenler

1. **Electron Katmanı**

   - `main.cjs`: Ana süreç yönetimi
   - `preload.cjs`: Güvenli IPC köprüsü
   - `cameraManager.cjs`: Kamera yönetimi
   - `editorManager.cjs`: Video düzenleme yönetimi
   - `trayManager.cjs`: Sistem tepsisi yönetimi

2. **Vue/Nuxt Katmanı**
   - `pages/`: Sayfa bileşenleri
   - `components/`: Yeniden kullanılabilir bileşenler
   - `composables/`: Paylaşılan mantık
   - `assets/`: Statik dosyalar

### Pencere Yönetimi

1. **Ana Pencere**: Kontrol arayüzü
2. **Kamera Penceresi**: Kamera önizleme
3. **Seçim Penceresi**: Ekran alanı seçimi
4. **Editör Penceresi**: Video düzenleme

## 3. State Yönetimi

### Merkezi State (main.cjs)

```javascript
let mediaState = {
	videoPath: null,
	audioPath: null,
	systemAudioPath: null,
	selectedArea: null,
	processingStatus: {
		isProcessing: false,
		progress: 0,
	},
};
```

### IPC İletişimi

1. **Renderer -> Main**

   - `CAMERA_DEVICE_CHANGED`
   - `RECORDING_STATUS_CHANGED`
   - `START_AREA_SELECTION`
   - `AREA_SELECTED`
   - `UPDATE_SELECTED_AREA`
   - `CLOSE_EDITOR_WINDOW`
   - `RESET_FOR_NEW_RECORDING`
   - `SHOW_PROMPT`
   - `SHOW_CONFIRM`

2. **Main -> Renderer**
   - `UPDATE_CAMERA_DEVICE`
   - `CAMERA_STATUS_CHANGED`
   - `AREA_SELECTED`
   - `MERGE_STATUS`
   - `PROCESSING_COMPLETE`
   - `EDITOR_STATUS_CHANGED`
   - `START_EDITING`
   - `MEDIA_PATHS`

## 4. Video İşleme Akışı

### Kayıt Süreci

1. Alan seçimi
2. Kamera ayarları
3. Kayıt başlatma
4. Video ve ses kaydı
5. Kayıt sonlandırma

### Düzenleme Süreci

1. Video yükleme
2. Segment işlemleri
   - Segment bölme
   - Segment yeniden sıralama
   - Segment silme
3. Efekt uygulama
   - Kırpma (Crop)
   - Aspect ratio değiştirme
4. Ses kontrolü
   - Ses açma/kapama
   - Ses seviyesi ayarlama
5. Düzen yönetimi
   - Düzen kaydetme
   - Düzen uygulama
   - Düzen yeniden adlandırma
   - Düzen silme
6. Export işlemi

## 5. Güvenlik Önlemleri

1. **IPC Güvenliği**

   - Preload script ile izole edilmiş IPC
   - Validasyon kontrolleri

2. **Dosya Sistemi**

   - Güvenli dosya yolları
   - Geçici dosya temizliği
   - Blob URL yönetimi

3. **Pencere Güvenliği**
   - WebPreferences ayarları
   - contextIsolation: true

## 6. Geliştirme Kuralları

1. **Yeni Özellik Ekleme**

   - Mevcut yapıyı bozmadan geliştirme
   - Modüler yapıya uygun ekleme
   - Test ve hata kontrolü

2. **State Değişiklikleri**

   - main.cjs üzerinden yönetim
   - IPC eventlerinin doğru kullanımı

3. **UI Geliştirmeleri**
   - TailwindCSS kullanımı
   - Responsive tasarım
   - Tutarlı UI/UX

## 7. Build ve Deploy

### Development

```bash
npm run electron:dev
```

### Production

```bash
npm run electron:build
```

## 8. Performans Optimizasyonu

1. **Video İşleme**

   - FFmpeg optimizasyonu
   - Buffer yönetimi
   - Asenkron işlemler
   - Blob ve URL yönetimi

2. **UI Performansı**
   - Gereksiz render önleme
   - Lazy loading
   - Computed property kullanımı
   - Event listener temizliği

## 9. Hata Ayıklama

1. **Electron DevTools**

   - Main süreç logları
   - Renderer süreç debugger
   - IPC iletişim logları

2. **Video Debug**
   - FFmpeg hata logları
   - Kayıt/düzenleme durumu takibi
   - Segment işlemleri logları

## 10. Yeni Özellikler

1. **Timeline Geliştirmeleri**

   - Segment bölme özelliği
   - Sürükle-bırak ile segment yeniden sıralama
   - Çoklu segment seçimi ve yönetimi
   - Segment pozisyonlarını güncelleme
   - Segment zaman kontrolü

2. **Video Düzenleme**

   - Gelişmiş kırpma araçları
   - Aspect ratio kontrolü
   - Ses kontrolü ve yönetimi
   - Video boyut optimizasyonu
   - Kırpma alanı validasyonu

3. **Medya Yönetimi**

   - Çoklu medya desteği (video, ses, sistem sesi)
   - Blob ve URL optimizasyonu
   - Geçici dosya yönetimi
   - Medya dosyası önbelleği
   - Otomatik temizleme mekanizması

4. **Kullanıcı Arayüzü**

   - Gelişmiş timeline kontrolü
   - Sürüklenebilir pencere yönetimi
   - Responsive video önizleme
   - Gerçek zamanlı efekt önizleme
   - İşlem durumu göstergeleri

5. **Performans İyileştirmeleri**

   - Video işleme optimizasyonu
   - Bellek yönetimi
   - Event listener optimizasyonu
   - Asenkron işlem yönetimi
   - Geçici dosya yönetimi

6. **Optimize Edilmiş Arka Plan Kaldırma**

   - TensorFlow.js makale tekniklerini kullanarak geliştirilen yeni sistem
   - WebGL backend optimizasyonu ile hızlandırılmış işleme
   - Geliştirilmiş kişi segmentasyonu algoritması
   - Gerçek zamanlı performans metrikleri
   - Çift canvas sistemi ile optimizasyon
   - Exponential moving average ile FPS kontrolü
   - Modern BodyPix konfigürasyonu
   - Test sayfası ile performans analizi

7. **Düzen Yönetimi**

   - Kamera ve video konumlarını kaydetme
   - Düzen kaydetme ve yükleme
   - Düzen yeniden adlandırma
   - Düzen silme
   - Electron.store ile kalıcı depolama

8. **Cursor Tracking Sistemi**
   - node-mac-recorder entegrasyonu ile native cursor tracking
   - Kayıt sırasında otomatik cursor pozisyon takibi
   - Cursor tipi ve click event detection
   - JSON formatında cursor data export
   - Production kararlılığı ve ARM64 uyumluluğu

## 11. Cursor Tracking Implementasyonu

### Native Cursor Tracking

Sleer artık cursor tracking için node-mac-recorder paketinin native cursor tracking özelliğini kullanır:

```javascript
// main.cjs içinde cursor tracking başlatma
async function startMouseTracking() {
	const macRecorder = getMacRecorderInstance();
	if (!macRecorder) return;

	const cursorFilePath = path.join(recordingDir, `cursor-${Date.now()}.json`);
	await macRecorder.startCursorTracking(cursorFilePath);
	mediaStateManager.setMousePath(cursorFilePath);
}

// Cursor tracking durdurma
async function stopMouseTracking() {
	const macRecorder = getMacRecorderInstance();
	if (!macRecorder) return;

	await macRecorder.stopCursorTracking();
	// Veriler otomatik olarak dosyaya kaydedilir
}
```

### Avantajları

1. **Native Performance**: Electron API yerine native macOS APIs kullanır
2. **Production Stability**: uIOhook dependency eliminated
3. **ARM64 Compatibility**: Apple Silicon için tam destek
4. **Automatic Data Export**: JSON formatında otomatik veri kaydetme
5. **Better Accuracy**: Native cursor type detection ve click events

### Dosya Formatı

Cursor data JSON formatında kaydedilir:

```json
[
	{
		"x": 1234,
		"y": 567,
		"timestamp": 1640995200000,
		"type": "move",
		"cursorType": "default"
	},
	{
		"x": 1240,
		"y": 570,
		"timestamp": 1640995200016,
		"type": "click",
		"button": "left",
		"cursorType": "pointer"
	}
]
```

## 12. Katkıda Bulunma

1. **Kod Standartları**

   - ES6+ özellikleri
   - Açıklayıcı değişken isimleri
   - JSDoc ile dokümantasyon

2. **Pull Request Süreci**
   - Feature branch kullanımı
   - Code review
   - Test gereksinimleri

## 13. Composable'lar

### useLayoutSettings

Düzen ayarlarını yönetmek için kullanılan composable.

```javascript
import { ref, onMounted } from "vue";
import { usePlayerSettings } from "./usePlayerSettings";

export function useLayoutSettings() {
	const savedLayouts = ref([]);

	// Düzen kaydetme
	const saveLayout = async (name, videoPosition, cameraPosition) => {
		// Düzen kaydetme işlemleri
	};

	// Düzen uygulama
	const applyLayout = (layout, setVideoPosition, setCameraPosition) => {
		// Düzen uygulama işlemleri
	};

	// Düzen yeniden adlandırma
	const renameLayout = async (layoutId, newName) => {
		// Düzen yeniden adlandırma işlemleri
	};

	// Düzen silme
	const deleteLayout = async (layoutId) => {
		// Düzen silme işlemleri
	};

	// Kaydedilmiş düzenleri yükleme
	const loadSavedLayouts = () => {
		// Kaydedilmiş düzenleri yükleme işlemleri
	};

	// Component mount olduğunda düzenleri yükle
	onMounted(() => {
		loadSavedLayouts();
	});

	return {
		savedLayouts,
		saveLayout,
		applyLayout,
		renameLayout,
		deleteLayout,
	};
}
```

## 14. Bileşenler

### LayoutManager

Düzen yönetimi için kullanılan UI bileşeni.

```vue
<template>
	<div class="relative">
		<button @click="toggleLayoutPopover">Düzen</button>
		<div v-if="isLayoutPopoverOpen" class="layout-popover">
			<!-- Düzen yönetimi arayüzü -->
		</div>
	</div>
</template>

<script setup>
import { ref, watch } from "vue";
import { useLayoutSettings } from "~/composables/useLayoutSettings";

const props = defineProps({
	mediaPlayer: {
		type: Object,
		required: true,
	},
});

// Düzen yönetimi işlemleri
</script>
```
