
#!/bin/bash

# Creavit Studio uygulamasını Apple Developer sertifikası ile imzalama scripti
# Bu script, Apple Developer hesabından alınan sertifika ile uygulamayı imzalar

set -e

# .env dosyasını yükle
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

APP_PATH="${1:-public/mac-arm64/Creavit Studio.app}"
ENTITLEMENTS_PATH="build/entitlements.mac.plist"

# Apple Developer sertifika kimliği (.env'den al)
CERTIFICATE_ID="${2:-$APPLE_CERTIFICATE_ID}"

if [ ! -d "$APP_PATH" ]; then
    echo "Hata: Uygulama bulunamadı: $APP_PATH"
    echo "Önce 'npm run build' komutunu çalıştırın."
    exit 1
fi

if [ ! -f "$ENTITLEMENTS_PATH" ]; then
    echo "Hata: Entitlements dosyası bulunamadı: $ENTITLEMENTS_PATH"
    exit 1
fi

# Eğer sertifika kimliği belirtilmemişse, hata ver
if [ -z "$CERTIFICATE_ID" ]; then
    echo "❌ Apple Developer sertifika kimliği bulunamadı!"
    echo ""
    echo "🔧 Çözüm 1: .env dosyasında APPLE_CERTIFICATE_ID tanımlayın:"
    echo "   APPLE_CERTIFICATE_ID=\"Developer ID Application: Your Name (TEAM123456)\""
    echo ""
    echo "🔧 Çözüm 2: Manuel olarak belirtin:"
    echo "   npm run sign -- \"public/mac-arm64/Creavit Studio.app\" \"Certificate ID\""
    echo ""
    echo "🔍 Mevcut Apple Developer sertifikaları:"
    security find-identity -v -p codesigning
    exit 1
fi

echo "🔐 Creavit Studio uygulaması Apple Developer sertifikası ile imzalanıyor..."
echo "📁 Uygulama yolu: $APP_PATH"
echo "📄 Entitlements: $ENTITLEMENTS_PATH"
echo "🔑 Sertifika: $CERTIFICATE_ID"

# Önce mevcut imzaları temizle
echo "🧹 Mevcut imzalar temizleniyor..."
codesign --remove-signature "$APP_PATH" 2>/dev/null || true

# Frameworks'leri imzala
echo "📚 Framework'ler imzalanıyor..."
find "$APP_PATH/Contents/Frameworks" -name "*.framework" -type d 2>/dev/null | while read framework; do
    echo "  - $(basename "$framework")"
    codesign --force --deep --sign "$CERTIFICATE_ID" --entitlements "$ENTITLEMENTS_PATH" "$framework" || true
done

# Helper'ları imzala
echo "🔧 Helper uygulamaları imzalanıyor..."
find "$APP_PATH/Contents" -name "*.app" -type d 2>/dev/null | while read helper; do
    if [ "$helper" != "$APP_PATH" ]; then
        echo "  - $(basename "$helper")"
        codesign --force --deep --sign "$CERTIFICATE_ID" --entitlements "$ENTITLEMENTS_PATH" "$helper" || true
    fi
done

# Executable'ları imzala
echo "⚙️  Executable dosyalar imzalanıyor..."
find "$APP_PATH/Contents" -type f -perm +111 2>/dev/null | while read executable; do
    if file "$executable" | grep -q "Mach-O"; then
        echo "  - $(basename "$executable")"
        codesign --force --sign "$CERTIFICATE_ID" --entitlements "$ENTITLEMENTS_PATH" "$executable" || true
    fi
done

# Ana uygulamayı imzala
echo "🎯 Ana uygulama imzalanıyor..."
codesign --force --deep --sign "$CERTIFICATE_ID" --entitlements "$ENTITLEMENTS_PATH" "$APP_PATH"

# İmzayı doğrula
echo "✅ İmza doğrulanıyor..."
codesign --verify --deep --strict "$APP_PATH"

echo "🎉 Apple Developer sertifikası ile imzalama tamamlandı!"
echo ""
echo "ℹ️  Not: Bu imzalama ile uygulamanız App Store dışı dağıtım için hazır."
echo "ℹ️  Notarization işlemi de gerekebilir (macOS Catalina ve üzeri için)." 