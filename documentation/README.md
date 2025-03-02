# Layout Yönetimi Özelliği

## Genel Bakış

Layout Yönetimi özelliği, kullanıcıların mevcut düzen ayarlarını kaydetmelerine, yönetmelerine ve daha sonra yeniden uygulamalarına olanak tanır. Bu özellik, farklı video düzenleme senaryoları için çeşitli yapılandırmaları hızlıca değiştirmeyi kolaylaştırır.

## Özellikler

- **Layout Kaydetme**: Mevcut tüm ayarları bir layout olarak kaydetme
- **Layout Uygulama**: Kaydedilmiş bir layoutu tek tıklamayla uygulama
- **Layout Yeniden Adlandırma**: Kaydedilmiş layoutları yeniden adlandırma
- **Layout Silme**: İstenmeyen layoutları kaldırma

## Teknik Detaylar

### Veri Yapısı

Her layout aşağıdaki bilgileri içerir:

```javascript
{
  id: String,           // Benzersiz tanımlayıcı
  name: String,         // Layout adı
  timestamp: String,    // Oluşturulma zamanı
  settings: {
    // Fare ayarları
    mouseSize: Number,
    motionBlurValue: Number,
    mouseVisible: Boolean,

    // Arka plan ayarları
    backgroundColor: String,
    backgroundImage: String,
    backgroundBlur: Number,

    // Video ayarları
    padding: Number,
    radius: Number,
    shadowSize: Number,
    cropRatio: String,

    // Zoom ayarları
    zoomRanges: Array,
    currentZoomRange: Object,

    // Kamera ayarları
    cameraSettings: Object,

    // Video kenar ayarları
    videoBorderSettings: Object
  }
}
```

### Depolama

Layoutlar, tarayıcının `localStorage` özelliği kullanılarak yerel olarak saklanır. Bu, kullanıcının tarayıcı oturumları arasında layoutların korunmasını sağlar.

### Bileşenler

1. **useLayoutSettings.js**: Layout verilerini yöneten composable
2. **LayoutManager.vue**: Layout butonunu ve popover arayüzünü içeren UI bileşeni

## Kullanım

1. Editör sayfasında, sağ üst köşedeki "Layout" butonuna tıklayın
2. Açılan popover'da "Layoutu Kaydet" butonuna tıklayarak mevcut ayarları kaydedin
3. Kaydedilen layoutlar listede görünecektir
4. Bir layoutu uygulamak için adına tıklayın
5. Layoutu yeniden adlandırmak veya silmek için sağdaki düğmeleri kullanın

## Gelecek Geliştirmeler

- Layout dışa/içe aktarma özelliği
- Layout önizleme görüntüleri
- Layout kategorileri veya etiketleri
- Bulut tabanlı layout depolama ve paylaşım
