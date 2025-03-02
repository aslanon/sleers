# Sleer

Sleer, ekran kayıtlarınızı kolayca yapmanızı ve düzenlemenizi sağlayan bir masaüstü uygulamasıdır.

## Özellikler

- Ekran kaydı
- Kamera kaydı
- Sistem sesi kaydı
- Video düzenleme
  - Segment bölme ve yeniden sıralama
  - Kırpma (crop)
  - Aspect ratio değiştirme
  - Ses kontrolü
- Düzen yönetimi
  - Kamera ve video konumlarını kaydetme
  - Özel düzenleri saklama ve yükleme
  - Düzenleri yeniden adlandırma ve silme

## Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme modunda çalıştır
npm run electron:dev

# Üretim için build
npm run electron:build
```

## Kullanım

### Kayıt

1. Ana ekrandan "Yeni Kayıt" butonuna tıklayın
2. Kaydetmek istediğiniz ekran alanını seçin
3. Kamera ayarlarını yapın
4. Kayıt başlat butonuna tıklayın
5. Kaydı durdurmak için "Durdur" butonuna tıklayın

### Düzenleme

1. Kaydedilen videoyu düzenlemek için editör ekranını kullanın
2. Timeline üzerinde segmentleri bölün, sıralayın veya silin
3. Kırpma aracı ile videoyu kırpın
4. Aspect ratio değiştirin
5. Ses seviyesini ayarlayın
6. Düzenlerinizi kaydedin ve yönetin
7. İşlem tamamlandığında "Kaydet" butonuna tıklayın

### Düzen Yönetimi

1. Editör ekranında "Düzen" butonuna tıklayın
2. Mevcut düzeni kaydetmek için "Mevcut Düzeni Kaydet" butonuna tıklayın
3. Kaydedilen düzenleri görmek için düzen listesine bakın
4. Bir düzeni uygulamak için üzerine tıklayın
5. Düzenleri yeniden adlandırmak veya silmek için ilgili butonları kullanın

## Geliştirme

Sleer, aşağıdaki teknolojileri kullanır:

- Electron
- Vue.js / Nuxt.js
- FFmpeg
- TailwindCSS

## Lisans

MIT
