# Creavit Studio

Creavit Studio, ekran kayıtlarınızı kolayca yapmanızı ve düzenlemenizi sağlayan bir masaüstü uygulamasıdır.

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

# İmzalanmış DMG oluştur (macOS için önerilen)
npm run build:signed
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

Creavit Studio, aşağıdaki teknolojileri kullanır:

- Electron
- Vue.js / Nuxt.js
- FFmpeg
- TailwindCSS

## Sorun Giderme

### macOS "Damaged" Hatası

Eğer macOS'ta "Creavit Studio is damaged and can't be opened" hatası alıyorsanız:

#### Yöntem 1: Terminal ile Çözüm (En Kolay)

```bash
# DMG dosyası için
sudo xattr -rd com.apple.quarantine /path/to/Creavit-Studio-1.0.0-arm64.dmg

# Veya kurulu uygulama için
sudo xattr -rd com.apple.quarantine /Applications/Creavit Studio.app
```

#### Yöntem 2: Sistem Ayarları

1. **Sistem Ayarları** > **Gizlilik ve Güvenlik** bölümüne gidin
2. **Güvenlik** sekmesinde "Her yerden" uygulamalara izin verin
3. Uygulamayı tekrar açmayı deneyin

#### Yöntem 3: Geliştirici İçin İmzalama

```bash
# İmzalanmış sürüm oluştur (önerilen)
npm run build:signed

# Veya manuel imzalama
npm run electron:build:dmg
./scripts/sign-app.sh dist/mac-arm64/Sleer.app
```

**Not:** `build:signed` komutu uygulamayı ad-hoc imzalar, bu da çoğu "damaged" hatasını çözer. Ancak tam güvenlik için Apple Developer sertifikası gereklidir.

### İzin Sorunları

Uygulama kamera, mikrofon veya ekran kaydı izni istiyorsa:

1. **Sistem Ayarları** > **Gizlilik ve Güvenlik** > **Kamera/Mikrofon/Ekran Kaydı**
2. Creavit Studio uygulamasını listede bulun ve etkinleştirin
3. Uygulamayı yeniden başlatın

## Lisans

MIT
