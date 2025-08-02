#!/bin/bash

# Notarization için gerekli environment variables'ları kontrol et

echo "🔍 Notarization environment variables kontrol ediliyor..."
echo ""

if [ -z "$APPLE_ID" ]; then
    echo "❌ APPLE_ID environment variable ayarlanmamış"
    echo "   export APPLE_ID='your-apple-id@example.com'"
    exit 1
else
    echo "✅ APPLE_ID: $APPLE_ID"
fi

if [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
    echo "❌ APPLE_APP_SPECIFIC_PASSWORD environment variable ayarlanmamış"
    echo "   export APPLE_APP_SPECIFIC_PASSWORD='your-app-specific-password'"
    exit 1
else
    echo "✅ APPLE_APP_SPECIFIC_PASSWORD: [HIDDEN]"
fi

if [ -z "$APPLE_TEAM_ID" ]; then
    echo "❌ APPLE_TEAM_ID environment variable ayarlanmamış"
    echo "   export APPLE_TEAM_ID='SX892ZQNJF'"
    exit 1
else
    echo "✅ APPLE_TEAM_ID: $APPLE_TEAM_ID"
fi

echo ""
echo "🎉 Tüm environment variables doğru şekilde ayarlanmış!"
echo "🚀 Artık notarization ile build yapabilirsiniz:"
echo "   npm run electron:build:dmg:notarized"