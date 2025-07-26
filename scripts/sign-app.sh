#!/bin/bash

# Creavit Studio uygulamasını ad-hoc imzalama scripti
# Bu script, uygulamayı geliştirici sertifikası olmadan imzalar

set -e

APP_PATH="$1"
ENTITLEMENTS_PATH="build/entitlements.mac.plist"

if [ -z "$APP_PATH" ]; then
    echo "Kullanım: $0 <app_path>"
    echo "Örnek: $0 dist/mac-arm64/Creavit Studio.app"
    exit 1
fi

if [ ! -d "$APP_PATH" ]; then
    echo "Hata: Uygulama bulunamadı: $APP_PATH"
    exit 1
fi

if [ ! -f "$ENTITLEMENTS_PATH" ]; then
    echo "Hata: Entitlements dosyası bulunamadı: $ENTITLEMENTS_PATH"
    exit 1
fi

echo "🔐 Creavit Studio uygulaması ad-hoc imzalanıyor..."
echo "📁 Uygulama yolu: $APP_PATH"
echo "📄 Entitlements: $ENTITLEMENTS_PATH"

# Önce mevcut imzaları temizle
echo "🧹 Mevcut imzalar temizleniyor..."
codesign --remove-signature "$APP_PATH" 2>/dev/null || true

# Frameworks'leri imzala
echo "📚 Framework'ler imzalanıyor..."
find "$APP_PATH/Contents/Frameworks" -name "*.framework" -type d 2>/dev/null | while read framework; do
    echo "  - $(basename "$framework")"
    codesign --force --deep --sign - --entitlements "$ENTITLEMENTS_PATH" "$framework" || true
done

# Helper'ları imzala
echo "🔧 Helper uygulamaları imzalanıyor..."
find "$APP_PATH/Contents" -name "*.app" -type d 2>/dev/null | while read helper; do
    if [ "$helper" != "$APP_PATH" ]; then
        echo "  - $(basename "$helper")"
        codesign --force --deep --sign - --entitlements "$ENTITLEMENTS_PATH" "$helper" || true
    fi
done

# Executable'ları imzala
echo "⚙️  Executable dosyalar imzalanıyor..."
find "$APP_PATH/Contents" -type f -perm +111 2>/dev/null | while read executable; do
    if file "$executable" | grep -q "Mach-O"; then
        echo "  - $(basename "$executable")"
        codesign --force --sign - --entitlements "$ENTITLEMENTS_PATH" "$executable" || true
    fi
done

# Ana uygulamayı imzala
echo "🎯 Ana uygulama imzalanıyor..."
codesign --force --deep --sign - --entitlements "$ENTITLEMENTS_PATH" "$APP_PATH"

# İmzayı doğrula
echo "✅ İmza doğrulanıyor..."
codesign --verify --deep --strict "$APP_PATH"

echo "🎉 İmzalama tamamlandı!"
echo ""
echo "ℹ️  Not: Bu ad-hoc imzalama, uygulamanın yerel makinede çalışmasını sağlar."
echo "ℹ️  Dağıtım için Apple Developer sertifikası gereklidir." 