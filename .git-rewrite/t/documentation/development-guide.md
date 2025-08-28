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

- Tarih: YYYY-MM-DD
- Sürüm: X.Y.Z
- Değişiklik: [Özellik Adı]

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
5. Export işlemi

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

## 11. Katkıda Bulunma

1. **Kod Standartları**

   - ES6+ özellikleri
   - Açıklayıcı değişken isimleri
   - JSDoc ile dokümantasyon

2. **Pull Request Süreci**
   - Feature branch kullanımı
   - Code review
   - Test gereksinimleri
