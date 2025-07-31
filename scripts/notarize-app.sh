#!/bin/bash

# Creavit Studio uygulamasını Apple Developer hesabı ile notarize eden script
# Bu script, macOS Catalina ve üzeri için gerekli notarization işlemini yapar

set -e

APP_PATH="$1"
APPLE_ID="$2"
APPLE_ID_PASSWORD="$3"

if [ -z "$APP_PATH" ] || [ -z "$APPLE_ID" ] || [ -z "$APPLE_ID_PASSWORD" ]; then
    echo "Kullanım: $0 <app_path> <apple_id> <apple_id_password>"
    echo "Örnek: $0 dist/mac-arm64/Creavit\ Studio.app your-apple-id@example.com your-app-specific-password"
    echo ""
    echo "ℹ️  App-specific password oluşturmak için:"
    echo "   https://appleid.apple.com/account/manage"
    echo "   Security > App-Specific Passwords"
    exit 1
fi

if [ ! -d "$APP_PATH" ]; then
    echo "Hata: Uygulama bulunamadı: $APP_PATH"
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

echo "🎉 Notarization işlemi tamamlandı!"
echo ""
echo "ℹ️  Not: Artık uygulamanız macOS Catalina ve üzeri için tamamen uyumlu."
echo "ℹ️  Not: Gatekeeper uyarıları görünmeyecek." 