# Optimize Edilmiş Arka Plan Kaldırma

Bu dokümantasyon, [TensorFlow.js makalesinden](https://selvamsubbiah.com/change-background-for-videos-using-tensorflow-js/) esinlenerek geliştirilen optimize edilmiş arka plan kaldırma özelliğini açıklar.

## Özellik Özeti

Yeni optimize edilmiş arka plan kaldırma sistemi, mevcut BodyPix implementasyonuna ek olarak daha hızlı ve etkili bir alternatif sunar. Bu sistem, makalede açıklanan teknikleri kullanarak webcam görüntüsünden gerçek zamanlı arka plan kaldırma işlemi yapar.

## Teknik Özellikler

### 1. Backend Optimizasyonu

- **WebGL Backend**: GPU hızlandırması için öncelikli WebGL kullanımı
- **CPU Fallback**: WebGL kullanılamadığında CPU backend'ine geçiş
- **Otomatik Seçim**: En uygun backend'i otomatik olarak belirler

### 2. Canvas İyileştirmeleri

- **Çift Canvas Sistemi**:
  - Processing Canvas: BodyPix için optimize edilmiş
  - Output Canvas: Final görüntü için optimize edilmiş
- **Context Optimizasyonu**:
  - `desynchronized: true` - Asenkron işleme
  - `willReadFrequently: false` - GPU optimizasyonu
  - `alpha: true/false` - Gereksiz alfa kanalını devre dışı bırakma

### 3. Performans Kontrolleri

- **FPS Kontrolü**: 15-60 FPS arası ayarlanabilir
- **Frame Timing**: Exponential moving average ile düzgün FPS
- **Memory Management**: Otomatik garbage collection
- **Metrics Tracking**: Gerçek zamanlı performans izleme

## Kullanım

### Kamera Ayarlarından Aktivasyon

1. Editör ekranında sağ taraftaki ayarlar panelini açın
2. "Kamera" sekmesine geçin
3. "Optimize Edilmiş Arka Plan Kaldırma" bölümünü bulun
4. Geçiş düğmesini etkinleştirin
5. Model yüklenirken bekleyin (ilk kez ~3-5 saniye)

### Test Sayfası

Optimize edilmiş sistem için özel bir test sayfası mevcuttur:

1. Kamera ayarlarından "Test Sayfasını Aç" butonuna tıklayın
2. Yeni sekmede test sayfası açılır
3. Kamerayı başlatın ve ayarları test edin
4. Gerçek zamanlı performans metriklerini görün

### Ayarlar

#### Segmentasyon Eşiği (0.0 - 1.0)

- **0.0-0.3**: Esnek, daha fazla alan kişi olarak kabul edilir
- **0.4-0.7**: Dengeli, çoğu durum için ideal
- **0.8-1.0**: Katı, sadece yüksek güvenli alanlar korunur

#### Çözünürlük

- **Düşük**: En hızlı işleme, temel kalite
- **Orta**: Dengeli performans/kalite (önerilen)
- **Yüksek**: Daha iyi kalite, daha yavaş
- **Tam**: En iyi kalite, en yavaş

#### Hedef FPS

- **15-20**: Düşük performanslı cihazlar için
- **25-30**: Dengeli kullanım (önerilen)
- **45-60**: Yüksek performanslı cihazlar için

## Performans Metrikleri

Sistem şu metrikleri gerçek zamanlı olarak takip eder:

- **Gerçek FPS**: Saniyede işlenen kare sayısı
- **Ortalama İşlem Süresi**: Her kare için geçen milisaniye
- **İşlenen Kare Sayısı**: Toplam işlenen kare sayacı

## Mevcut Sistemle Karşılaştırma

| Özellik        | Mevcut Sistem | Optimize Sistem      |
| -------------- | ------------- | -------------------- |
| Backend        | CPU Ağırlıklı | WebGL + CPU Fallback |
| Canvas         | Tek Canvas    | Çift Canvas          |
| FPS Kontrolü   | Temel         | Gelişmiş             |
| Metrics        | Sınırlı       | Detaylı              |
| Configuration  | Standart      | Optimize             |
| Test Interface | Yok           | Özel Test Sayfası    |

## Geliştirici Notları

### Dosya Yapısı

```
composables/
  └── useTensorFlowWebcam.js           # Ana composable
components/
  └── player-settings/
      └── OptimizedBackgroundRemovalSettings.vue  # Ayarlar bileşeni
pages/
  └── tensorflow-webcam-test.vue      # Test sayfası
docs/
  └── optimized-background-removal.md # Bu dokümantasyon
```

### API Referansı

#### useTensorFlowWebcam()

```javascript
const {
	// State
	isInitialized,
	isProcessing,

	// Methods
	initialize,
	processFrame,
	startProcessing,
	stopProcessing,
	updateSettings,
	getMetrics,
	cleanup,

	// Settings
	segmentationThreshold,
	internalResolution,
	flipHorizontal,
	targetFps,

	// Metrics
	averageProcessingTime,
	processedFrameCount,
} = useTensorFlowWebcam();
```

### Entegrasyon

Mevcut kamera renderer ile entegrasyon için:

```javascript
// Optimize edilmiş arka plan kaldırma kontrolü
if (cameraSettings.value?.optimizedBackgroundRemoval) {
	// Yeni sistemi kullan
	const processedCanvas = await optimizedBackgroundRemoval.processFrame(
		videoElement
	);
	// Canvas'ı render et
} else if (cameraSettings.value?.removeBackground) {
	// Mevcut sistemi kullan
	const processedCanvas = await backgroundRemoval.processFrame(videoElement);
	// Canvas'ı render et
}
```

## Sorun Giderme

### Model Yüklenmiyor

1. İnternet bağlantınızı kontrol edin
2. Tarayıcı konsolu hatalarını inceleyin
3. WebGL desteğini kontrol edin (`about:gpu` - Chrome'da)

### Düşük Performans

1. Çözünürlüğü "Düşük" yapın
2. Hedef FPS'i azaltın (15-20)
3. Segmentasyon eşiğini artırın (0.7-0.8)

### Webcam Erişim Hatası

1. Tarayıcı kamera izinlerini kontrol edin
2. Başka uygulamaların kamerayı kullanmadığından emin olun
3. Kamerayı yeniden başlatın

## Güncellemeler

- **v1.0.0**: İlk implementasyon
- TensorFlow.js 4.22.0 desteği
- WebGL backend optimizasyonu
- Test sayfası eklendi
- Performans metrikleri sistemi

## Katkıda Bulunma

Bu özellik sürekli geliştirilmektedir. Öneriler için:

1. Performance profiling sonuçları paylaşın
2. Farklı cihazlarda test sonuçları bildirin
3. Yeni optimizasyon fikirleri önerin

## Referanslar

- [TensorFlow.js Background Removal Article](https://selvamsubbiah.com/change-background-for-videos-using-tensorflow-js/)
- [BodyPix Model Documentation](https://github.com/tensorflow/tfjs-models/tree/master/body-pix)
- [TensorFlow.js Backend Optimization](https://www.tensorflow.org/js/guide/platform_environment)
