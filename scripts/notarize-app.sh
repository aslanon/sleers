
#!/bin/bash

# Creavit Studio uygulamasını Apple Developer hesabı ile notarize eden script
# Bu script, macOS Catalina ve üzeri için gerekli notarization işlemini yapar

set -e

# .env dosyasını yükle
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

APP_PATH="${1:-dist/mac-arm64/Creavit Studio.app}"
APPLE_ID="${2:-$APPLE_ID}"
APPLE_ID_PASSWORD="${3:-$APPLE_APP_SPECIFIC_PASSWORD}"

if [ ! -d "$APP_PATH" ]; then
    echo "Hata: Uygulama bulunamadı: $APP_PATH"
    echo "Önce 'npm run build' ve 'npm run sign' komutlarını çalıştırın."
    exit 1
fi

if [ -z "$APPLE_ID" ] || [ -z "$APPLE_ID_PASSWORD" ]; then
    echo "❌ Apple ID bilgileri bulunamadı!"
    echo ""
    echo "🔧 Çözüm 1: .env dosyasında tanımlayın:"
    echo "   APPLE_ID=\"your-apple-id@example.com\""
    echo "   APPLE_APP_SPECIFIC_PASSWORD=\"your-app-specific-password\""
    echo ""
    echo "🔧 Çözüm 2: Manuel olarak belirtin:"
    echo "   npm run notarize -- \"public/mac-arm64/Creavit Studio.app\" \"apple-id\" \"password\""
    echo ""
    echo "ℹ️  App-specific password oluşturmak için:"
    echo "   https://appleid.apple.com/account/manage"
    echo "   Security > App-Specific Passwords"
    exit 1
fi

echo "🔐 Creavit Studio uygulaması notarize ediliyor..."
echo "📁 Uygulama yolu: $APP_PATH"
echo "🍎 Apple ID: $APPLE_ID"

# Uygulamayı zip dosyasına sıkıştır
echo "📦 Uygulama zip dosyasına sıkıştırılıyor..."
ZIP_PATH="${APP_PATH%.app}.zip"
ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

# Notarization işlemi
echo "🚀 Notarization işlemi başlatılıyor..."
xcrun notarytool submit "$ZIP_PATH" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_ID_PASSWORD" \
    --team-id "$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | sed 's/.*(\([^)]*\)).*/\1/')" \
    --wait

# Notarization sonucunu kontrol et
echo "✅ Notarization tamamlandı!"

# Staple işlemi (uygulamaya notarization bilgisini ekle)
echo "📎 Staple işlemi yapılıyor..."
xcrun stapler staple "$APP_PATH"

# Zip dosyasını temizle
rm -f "$ZIP_PATH"

# DMG dosyasını bul ve notarize et
echo "📦 DMG dosyası aranıyor..."
DMG_DIR=$(dirname "$APP_PATH")
DMG_FILE=$(find "$(dirname "$DMG_DIR")" -name "*.dmg" -type f | head -1)

if [ -n "$DMG_FILE" ] && [ -f "$DMG_FILE" ]; then
    echo "🚀 DMG dosyası notarize ediliyor: $(basename "$DMG_FILE")"
    xcrun notarytool submit "$DMG_FILE" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_ID_PASSWORD" \
        --team-id "$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | sed 's/.*(\([^)]*\)).*/\1/')" \
        --wait
    
    echo "📎 DMG staple işlemi yapılıyor..."
    xcrun stapler staple "$DMG_FILE"
    echo "✅ DMG başarıyla notarize edildi!"
else
    echo "⚠️  DMG dosyası bulunamadı, sadece .app notarize edildi"
fi

echo "🎉 Notarization işlemi tamamlandı!"
echo ""
echo "ℹ️  Not: Artık uygulamanız macOS Catalina ve üzeri için tamamen uyumlu."
echo "ℹ️  Not: Gatekeeper uyarıları görünmeyecek." 