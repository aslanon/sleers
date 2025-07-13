# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sleer is a macOS desktop screen recording application similar to Screen Studio. It provides screen recording, camera recording, audio recording, and video editing capabilities with layout management features.

## Development Commands

### Core Commands
- `npm run dev` - Start Nuxt.js development server
- `npm run electron:dev` - Start Electron app in development mode with hot reload
- `npm run build` - Build Nuxt.js application
- `npm run generate` - Generate static version of the app

### Build Commands
- `npm run electron:build` - Build Electron app for current platform
- `npm run electron:build:mac` - Build for macOS ARM64
- `npm run electron:build:dmg` - Create DMG installer for production
- `npm run electron:build:dmg:signed` - Create signed DMG (requires certificates)
- `npm run build:signed` - Build and sign app using scripts/build-and-sign.sh

### Utility Commands
- `npm run cleanup` - Kill processes on ports 3002-3020
- `npm run prepare:arm64` - Rebuild native modules for ARM64

## Architecture

### Tech Stack
- **Frontend**: Nuxt.js 3 with Vue.js
- **Desktop**: Electron 37
- **Styling**: TailwindCSS
- **Video Processing**: FFmpeg with fluent-ffmpeg
- **Native Recording**: node-mac-recorder for macOS
- **AI/ML**: TensorFlow.js for background removal
- **State**: Electron-store for persistence

### Key Directories
- `electron/` - Electron main process and IPC handlers
- `components/` - Vue.js components (MediaPlayer, Timeline, Settings)
- `composables/` - Vue.js composables for business logic
- `pages/` - Nuxt.js pages (index, editor, selection, camera)
- `assets/` - Static assets (CSS, fonts, images, cursors)
- `public/` - Public assets and AI models
- `services/` - Service layer (ExportService)

### Component Architecture
The application follows a modular component and composable pattern:

- **MediaPlayer.vue** - Main video player with canvas rendering
- **TimelineComponent.vue** - Timeline editing interface
- **Layout System** - Components for managing camera/video layouts
- **Settings Components** - Modular settings for camera, video, mouse, zoom

### Composables Pattern
Business logic is organized in composables:

- `usePlayerSettings` - Video player configuration
- `useLayoutRenderer` - Layout rendering and management
- `useCameraRenderer` - Camera stream handling
- `useBackgroundRemoval` - AI-powered background removal
- `useVideoEvents` - Video playback event handling
- `useProjectManager` - Project save/load functionality

### Electron Architecture
- **main.cjs** - Main process with window management
- **preload.cjs** - Secure IPC bridge
- **Manager modules** - cameraManager, dockManager, editorManager, etc.
- **Native integration** - Screen recording, permissions, file handling

### Development Guidelines
From .cursorrules:
- Build features using modular components and composables
- Don't break existing functionality when adding features
- Use ES6+ features and async/await
- Follow Vue.js composition API patterns
- Maintain component reusability

### IPC Communication
The app uses Electron IPC for communication between main and renderer processes:
- Camera controls and permissions
- File system operations
- Screen capture APIs
- Native macOS integrations

### AI/ML Features
- Background removal using TensorFlow.js BodyPix model
- Models stored in `public/models/bodypix/`
- Optimized background removal pipeline
- Real-time video processing

### Development Server
- Nuxt.js runs on port 3002
- Electron loads localhost:3002 in development
- Hot reload enabled for both frontend and Electron

## Important Notes

- This is a macOS-specific application using native recording APIs
- Requires camera and screen recording permissions
- Built for ARM64 architecture (Apple Silicon)
- Uses ad-hoc code signing to avoid "damaged app" warnings
- FFmpeg integration for video processing and export