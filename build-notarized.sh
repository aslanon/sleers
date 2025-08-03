#!/bin/bash

# Notarized Build Script for Creavit Studio
# This script checks for notarization prerequisites and builds a notarized DMG

set -e  # Exit on any error

# =========================
# LOAD ENVIRONMENT VARIABLES
# =========================
# Set production environment for build
export NODE_ENV=production

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    echo -e "${BLUE}📄 Loading environment variables from .env file...${NC}"
    while IFS= read -r line; do
        if [[ $line != *=* ]]; then
            continue
        fi
        key=$(echo "$line" | cut -d'=' -f1)
        value=$(echo "$line" | cut -d'=' -f2-)
        export $key="$value"
    done < .env
else
    echo -e "${YELLOW}⚠️ No .env file found. Please create one with your Apple Developer credentials.${NC}"
    echo -e "${YELLOW}💡 You can copy .env.example to .env and fill in your values.${NC}"
fi

echo -e "${GREEN}🔧 Environment: ${NODE_ENV}${NC}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Creavit Studio Notarized Build Process${NC}"

# Check if required environment variables are set
check_env_vars() {
    echo -e "${YELLOW}📋 Checking environment variables...${NC}"
    
    local missing_vars=()
    
    if [ -z "$APPLE_ID" ]; then
        missing_vars+=("APPLE_ID")
    fi
    
    if [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
        missing_vars+=("APPLE_APP_SPECIFIC_PASSWORD")
    fi
    
    if [ -z "$APPLE_TEAM_ID" ]; then
        missing_vars+=("APPLE_TEAM_ID")
    fi
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        echo -e "${RED}❌ Missing required environment variables:${NC}"
        for var in "${missing_vars[@]}"; do
            echo -e "${RED}   - $var${NC}"
        done
        echo -e "${YELLOW}💡 Please create a .env file with your Apple Developer credentials:${NC}"
        echo -e "${YELLOW}   cp .env.example .env${NC}"
        echo -e "${YELLOW}   Then edit .env and fill in your actual values${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All environment variables are set${NC}"
    echo -e "${BLUE}   Apple ID: $APPLE_ID${NC}"
    echo -e "${BLUE}   Team ID: $APPLE_TEAM_ID${NC}"
    echo -e "${BLUE}   App Password: [HIDDEN]${NC}"
}

# Check if required tools are installed
check_tools() {
    echo -e "${YELLOW}🔧 Checking required tools...${NC}"
    
    local missing_tools=()
    
    if ! command -v npm &> /dev/null; then
        missing_tools+=("npm")
    fi
    
    if ! command -v xcrun &> /dev/null; then
        missing_tools+=("xcrun (Xcode Command Line Tools)")
    fi
    
    if ! command -v security &> /dev/null; then
        missing_tools+=("security (macOS Keychain)")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        echo -e "${RED}❌ Missing required tools:${NC}"
        for tool in "${missing_tools[@]}"; do
            echo -e "${RED}   - $tool${NC}"
        done
        exit 1
    fi
    
    echo -e "${GREEN}✅ All required tools are available${NC}"
}

# Check code signing certificates
check_certificates() {
    echo -e "${YELLOW}🔐 Checking code signing certificates...${NC}"
    
    # Check for Developer ID Application certificate
    if ! security find-certificate -c "Developer ID Application" -p > /dev/null 2>&1; then
        echo -e "${RED}❌ Developer ID Application certificate not found${NC}"
        echo -e "${YELLOW}💡 Please install your Developer ID Application certificate in Keychain${NC}"
        exit 1
    fi
    
    # Check for Developer ID Installer certificate (for DMG signing)
    if ! security find-certificate -c "Developer ID Installer" -p > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️ Developer ID Installer certificate not found${NC}"
        echo -e "${YELLOW}💡 This is optional but recommended for DMG signing${NC}"
    fi
    
    echo -e "${GREEN}✅ Code signing certificates are available${NC}"
}

# Clean previous builds
clean_builds() {
    echo -e "${YELLOW}🧹 Cleaning previous builds...${NC}"
    
    # Remove dist directories
    if [ -d "dist" ]; then
        rm -rf dist
        echo -e "${GREEN}   - Removed dist/ directory${NC}"
    fi
    
    # Remove electron-builder output
    if [ -d "dist-electron" ]; then
        rm -rf dist-electron
        echo -e "${GREEN}   - Removed dist-electron/ directory${NC}"
    fi
    
    # Remove any previous DMG files
    if ls *.dmg 1> /dev/null 2>&1; then
        rm -f *.dmg
        echo -e "${GREEN}   - Removed previous DMG files${NC}"
    fi
    
    echo -e "${GREEN}✅ Build directories cleaned${NC}"
}

# Build the application
build_app() {
    echo -e "${YELLOW}🏗️ Building Nuxt application...${NC}"
    npm run build
    
    echo -e "${YELLOW}📦 Building Electron application...${NC}"
    npm run electron:build:mac
    
    echo -e "${GREEN}✅ Application built successfully${NC}"
}

# Sign the application
sign_app() {
    echo -e "${YELLOW}🔐 Signing application...${NC}"
    
    APP_PATH="dist/mac-arm64/Creavit Studio.app"
    CERT_ID="790F632019AE0FEBFC485B9AE0A6AB7FF03CC40A"
    
    # Check if signing script exists
    if [ -f "scripts/sign-apple-developer.sh" ]; then
        echo -e "${BLUE}Running Apple Developer signing with parameters...${NC}"
        scripts/sign-apple-developer.sh "$APP_PATH" "$CERT_ID"
    elif [ -f "scripts/sign-app.sh" ]; then
        echo -e "${BLUE}Running app signing...${NC}"
        scripts/sign-app.sh "$APP_PATH"
    else
        echo -e "${YELLOW}⚠️ No signing script found, skipping additional signing...${NC}"
        echo -e "${YELLOW}App was already signed by electron-builder during build${NC}"
    fi
    
    echo -e "${GREEN}✅ Application signing completed${NC}"
}

# Create and sign DMG
create_dmg() {
    echo -e "${YELLOW}💿 Creating signed DMG...${NC}"
    
    # Use the existing npm script for DMG creation
    echo -e "${BLUE}Running DMG creation command...${NC}"
    NODE_ENV=production npx electron-builder --mac --arm64 --config.removePackageScripts=false
    
    # Check if DMG was created
    if find . -name "*.dmg" -type f | head -1 | read dmg_file; then
        echo -e "${GREEN}✅ DMG created: $dmg_file${NC}"
    else
        echo -e "${RED}❌ DMG creation failed${NC}"
        exit 1
    fi
}

# Notarize the DMG
notarize_dmg() {
    echo -e "${YELLOW}📋 Starting notarization process...${NC}"
    
    # Find the DMG file
    DMG_FILE=$(find . -name "*.dmg" -type f | head -1)
    
    if [ -z "$DMG_FILE" ]; then
        echo -e "${RED}❌ No DMG file found${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}📤 Uploading $DMG_FILE for notarization...${NC}"
    
    # Submit for notarization
    NOTARIZATION_INFO=$(xcrun notarytool submit "$DMG_FILE" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_APP_SPECIFIC_PASSWORD" \
        --team-id "$APPLE_TEAM_ID" \
        --wait)
    
    echo "$NOTARIZATION_INFO"
    
    # Check if notarization was successful
    if echo "$NOTARIZATION_INFO" | grep -q "status: Accepted"; then
        echo -e "${GREEN}✅ Notarization successful!${NC}"
        
        # Staple the notarization
        echo -e "${YELLOW}📎 Stapling notarization to DMG...${NC}"
        xcrun stapler staple "$DMG_FILE"
        
        echo -e "${GREEN}✅ DMG stapled successfully${NC}"
        echo -e "${GREEN}🎉 Notarized build complete: $DMG_FILE${NC}"
    else
        echo -e "${RED}❌ Notarization failed${NC}"
        echo -e "${YELLOW}💡 Check the notarization log for details${NC}"
        exit 1
    fi
}

# Verify notarization
verify_notarization() {
    DMG_FILE=$(find . -name "*.dmg" -type f | head -1)
    
    echo -e "${YELLOW}🔍 Verifying notarization...${NC}"
    
    if xcrun stapler validate "$DMG_FILE"; then
        echo -e "${GREEN}✅ Notarization verification successful${NC}"
    else
        echo -e "${RED}❌ Notarization verification failed${NC}"
        exit 1
    fi
}

# Main execution
main() {
    echo -e "${BLUE}=========================${NC}"
    echo -e "${BLUE} Creavit Studio Notarized Build${NC}"
    echo -e "${BLUE}=========================${NC}"
    echo ""
    
    check_env_vars
    check_tools
    check_certificates
    clean_builds
    build_app
    sign_app
    create_dmg
    notarize_dmg
    verify_notarization
    
    echo ""
    echo -e "${GREEN}🎉 Build process completed successfully!${NC}"
    echo -e "${BLUE}📁 Your notarized DMG is ready for distribution${NC}"
}

# Run main function
main "$@"