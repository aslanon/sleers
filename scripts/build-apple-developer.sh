#!/bin/bash

# Creavit Studio uygulamasını Apple Developer sertifikası ile build edip imzalayan script

set -e

CERTIFICATE_ID="$1"

if [ -z "$CERTIFICATE_ID" ]; then
    echo "🔍 Mevcut Apple Developer sertifikaları:"
    security find-identity -v -p codesigning
    echo ""
    echo "❌ Lütfen bir sertifika kimliği belirtin."
    echo "Kullanım: $0 <certificate_id>"
    echo ""
    echo "ℹ️  Sertifika kimliği örneği: 'Developer ID Application: ONUR ASLAN (XXXXXXXXXX)'"
    exit 1
fi

echo "🚀 Creavit Studio Apple Developer build işlemi başlatılıyor..."
echo "🔑 Kullanılan sertifika: $CERTIFICATE_ID"

# 1. Nuxt generate
echo "📦 Nuxt generate çalıştırılıyor..."
NODE_ENV=production npm run generate

# 2. Electron builder ile DMG oluştur (imzalamadan)
echo "🔨 Electron builder ile DMG oluşturuluyor..."
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --arm64 --config.removePackageScripts=false

# 3. Uygulamayı Apple Developer sertifikası ile imzala
echo "🔐 Uygulama Apple Developer sertifikası ile imzalanıyor..."
./scripts/sign-apple-developer.sh "dist/mac-arm64/Creavit Studio.app" "$CERTIFICATE_ID"

# 4. DMG'yi yeniden oluştur (imzalanmış uygulama ile)
echo "📀 İmzalanmış uygulama ile DMG yeniden oluşturuluyor..."
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --arm64 --config.removePackageScripts=false

echo "✅ Apple Developer build işlemi tamamlandı!"
echo ""
echo "📁 Çıktı dosyaları:"
echo "   - dist/Creavit-Studio-1.0.0-arm64.dmg"
echo "   - dist/mac-arm64/Creavit Studio.app"
echo ""
echo "🎉 Artık DMG dosyasını güvenle dağıtabilirsiniz!"
echo ""
echo "ℹ️  Not: macOS Catalina ve üzeri için notarization işlemi gerekebilir." 