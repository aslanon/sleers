#!/bin/bash

# Creavit Studio uygulamasını build edip imzalayan script

set -e

echo "🚀 Creavit Studio build ve imzalama işlemi başlatılıyor..."

# 1. Nuxt generate
echo "📦 Nuxt generate çalıştırılıyor..."
NODE_ENV=production npm run generate

# 2. Electron builder ile DMG oluştur
echo "🔨 Electron builder ile DMG oluşturuluyor..."
npx electron-builder --mac --arm64 --config.removePackageScripts=false

# 3. Uygulamayı imzala
echo "🔐 Uygulama imzalanıyor..."
./scripts/sign-app.sh dist/mac-arm64/Creavit\ Studio.app

# 4. DMG'yi yeniden oluştur (imzalanmış uygulama ile)
echo "📀 İmzalanmış uygulama ile DMG yeniden oluşturuluyor..."
npx electron-builder --mac --arm64 --config.removePackageScripts=false

echo "✅ Build ve imzalama işlemi tamamlandı!"
echo ""
echo "📁 Çıktı dosyaları:"
echo "   - dist/Creavit-Studio-1.0.0-arm64.dmg"
echo "   - dist/mac-arm64/Creavit Studio.app"
echo ""
echo "🎉 Artık DMG dosyasını güvenle dağıtabilirsiniz!" 