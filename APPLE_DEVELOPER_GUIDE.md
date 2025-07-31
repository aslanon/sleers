# Apple Developer Hesabı ile Uygulama İmzalama Rehberi

Bu rehber, Apple Developer hesabınızla Creavit Studio uygulamasını imzalamak ve dağıtmak için gerekli adımları içerir.

## 1. Apple Developer Sertifikası Oluşturma

### 1.1 Apple Developer Portal'a Giriş

1. https://developer.apple.com/account/ adresine gidin
2. Apple Developer hesabınızla giriş yapın

### 1.2 Certificate Signing Request (CSR) Oluşturma

```bash
# Private key oluştur
openssl genrsa -out private_key.pem 2048

# CSR oluştur
openssl req -new -key private_key.pem -out certificate_request.csr -subj "/C=TR/ST=Istanbul/L=Istanbul/O=Creavit/OU=Development/CN=ONUR ASLAN"
```

### 1.3 Apple Developer Portal'da Sertifika Oluşturma

1. **Certificates, Identifiers & Profiles** bölümüne gidin
2. **Certificates** sekmesine tıklayın
3. **+** butonuna tıklayın
4. **Developer ID Application** sertifikası seçin
5. Oluşturduğunuz CSR dosyasını yükleyin
6. Sertifikayı indirin ve çift tıklayarak Keychain'e yükleyin

## 2. App-Specific Password Oluşturma

Notarization için app-specific password gerekli:

1. https://appleid.apple.com/account/manage adresine gidin
2. **Security** sekmesine tıklayın
3. **App-Specific Passwords** bölümüne gidin
4. **Generate Password** butonuna tıklayın
5. "Creavit Studio Notarization" gibi bir isim verin
6. Oluşturulan şifreyi kaydedin

## 3. Uygulamayı İmzalama

### 3.1 Mevcut Sertifikaları Kontrol Etme

```bash
security find-identity -v -p codesigning
```

### 3.2 Apple Developer Sertifikası ile Build Alma

```bash
# Sertifika kimliğini kullanarak build al
npm run build:apple "Developer ID Application: ONUR ASLAN (XXXXXXXXXX)"
```

### 3.3 Manuel İmzalama (Gerekirse)

```bash
# Uygulamayı manuel olarak imzala
npm run sign:apple "dist/mac-arm64/Creavit Studio.app" "Developer ID Application: ONUR ASLAN (XXXXXXXXXX)"
```

## 4. Notarization İşlemi

macOS Catalina ve üzeri için notarization gerekli:

```bash
# Uygulamayı notarize et
npm run notarize "dist/mac-arm64/Creavit Studio.app" "your-apple-id@example.com" "your-app-specific-password"
```

## 5. DMG Oluşturma

Notarization sonrası DMG'yi yeniden oluşturun:

```bash
# DMG'yi yeniden oluştur
npm run electron:build:dmg
```

## 6. Test Etme

### 6.1 İmza Doğrulama

```bash
# İmzayı doğrula
codesign --verify --deep --strict "dist/mac-arm64/Creavit Studio.app"
```

### 6.2 Notarization Kontrolü

```bash
# Notarization durumunu kontrol et
spctl --assess --verbose "dist/mac-arm64/Creavit Studio.app"
```

## 7. Dağıtım

### 7.1 DMG Dosyası

- `dist/Creavit-Studio-1.0.0-arm64.dmg` dosyasını dağıtın
- Bu dosya artık Apple Developer sertifikası ile imzalanmış ve notarize edilmiş

### 7.2 Güvenlik Kontrolleri

- macOS Gatekeeper uyarıları görünmeyecek
- Kullanıcılar güvenle uygulamayı çalıştırabilecek
- App Store dışı dağıtım için uygun

## 8. Sorun Giderme

### 8.1 Sertifika Bulunamıyor

```bash
# Keychain'i kontrol et
security find-identity -v -p codesigning
```

### 8.2 İmza Hatası

```bash
# Mevcut imzaları temizle
codesign --remove-signature "dist/mac-arm64/Creavit Studio.app"
```

### 8.3 Notarization Hatası

- App-specific password'ün doğru olduğundan emin olun
- Apple ID'nin Apple Developer hesabına bağlı olduğunu kontrol edin
- Team ID'nin doğru olduğunu kontrol edin

## 9. Otomatik Build Script'i

Tüm işlemleri otomatikleştirmek için:

```bash
# Apple Developer sertifikası ile tam build
npm run build:apple "Developer ID Application: ONUR ASLAN (XXXXXXXXXX)"

# Notarization (build sonrası)
npm run notarize "dist/mac-arm64/Creavit Studio.app" "your-apple-id@example.com" "your-app-specific-password"
```

## 10. Önemli Notlar

- Apple Developer hesabı yıllık ücretlidir ($99/yıl)
- Sertifikalar 1 yıl geçerlidir
- Notarization işlemi internet bağlantısı gerektirir
- DMG dosyası büyük olabilir, dağıtım için sıkıştırma önerilir
- Her yeni sürüm için notarization gerekir

## 11. Güvenlik

- Private key dosyalarını güvenli tutun
- App-specific password'leri paylaşmayın
- Sertifika bilgilerini version control'e eklemeyin
- Production build'leri için ayrı sertifika kullanın
