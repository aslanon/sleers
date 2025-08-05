// Unified Element Zoom Example - Yeni zoom yaklaşımı
// Canvas zoom yerine elementleri transform eder, native çözünürlük korunur

import { useMediaPlayerOffscreen } from '@/composables/useMediaPlayerOffscreen'
import { ref } from 'vue'

export default {
  setup() {
    const canvasRef = ref(null)
    const videoRef = ref(null)
    const cameraRef = ref(null)
    
    // Offscreen media player with unified element zoom
    const {
      renderFrame,
      elementZoom,
      startRendering,
      stopRendering,
      getPerformanceStats
    } = useMediaPlayerOffscreen(canvasRef, {
      width: 1920,
      height: 1080,
      enableOptimizations: true
    })

    // Zoom kontrolleri
    const currentZoom = ref(1.0)
    const zoomOrigin = ref({ x: 50, y: 50 })

    // Element pozisyonları (örnek)
    const cameraPosition = ref({ x: 1670, y: 50 }) // Sağ üst köşe
    const cameraSettings = ref({
      size: 10, // Canvas genişliğinin %10'u
      mirror: true,
      borderRadius: 15,
      opacity: 1.0
    })

    const cursorData = ref({
      x: 960,
      y: 540,
      visible: true,
      size: 80,
      hotspot: { x: 10, y: 10 },
      cursorType: 'pointer'
    })

    const gifElements = ref([
      {
        element: null, // GIF video element
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        rotation: 0,
        scale: 1.0
      }
    ])

    // Unified zoom fonksiyonu
    const setZoom = (zoomLevel, origin = null) => {
      currentZoom.value = zoomLevel
      if (origin) {
        zoomOrigin.value = origin
      }

      // Render data hazırla
      const renderData = {
        videoElement: videoRef.value,
        videoState: {
          isPlaying: !videoRef.value?.paused,
          currentTime: videoRef.value?.currentTime || 0
        },
        cameraElement: cameraRef.value,
        cameraSettings: cameraSettings.value,
        cameraPosition: cameraPosition.value,
        cursorData: cursorData.value,
        gifElements: gifElements.value,
        zoomLevel: zoomLevel,
        zoomOrigin: zoomOrigin.value
      }

      // Render frame with zoom
      renderFrame(renderData)
      
      console.log(`[UnifiedZoomExample] Zoom set to ${zoomLevel}x`, {
        origin: zoomOrigin.value,
        viewport: elementZoom.calculateZoomViewport()
      })
    }

    // Zoom presets
    const zoomPresets = {
      reset: () => setZoom(1.0, { x: 50, y: 50 }),
      zoom2x: () => setZoom(2.0),
      zoom3x: () => setZoom(3.0),
      zoom4x: () => setZoom(4.0),
      zoom5x: () => setZoom(5.0), // Ultra zoom threshold
      zoom6x: () => setZoom(6.0)  // Maximum zoom
    }

    // Zoom to specific element
    const zoomToCamera = () => {
      const camera = cameraPosition.value
      const origin = {
        x: (camera.x / 1920) * 100,
        y: (camera.y / 1080) * 100
      }
      setZoom(3.0, origin)
    }

    const zoomToCursor = () => {
      const cursor = cursorData.value
      const origin = {
        x: (cursor.x / 1920) * 100,
        y: (cursor.y / 1080) * 100
      }
      setZoom(4.0, origin)
    }

    // Element konfigürasyonu güncelleme
    const updateElementConfig = (elementType, config) => {
      elementZoom.updateElementConfig(elementType, config)
      
      // Re-render with current zoom
      if (currentZoom.value > 1.001) {
        setZoom(currentZoom.value)
      }
    }

    // Koordinat dönüşümleri
    const getWorldCoordinates = (screenX, screenY) => {
      return elementZoom.screenToWorld(screenX, screenY)
    }

    const getScreenCoordinates = (worldX, worldY) => {
      return elementZoom.worldToScreen(worldX, worldY)
    }

    // Performance monitoring
    const getZoomPerformance = () => {
      const mediaStats = getPerformanceStats()
      const zoomStats = elementZoom.getPerformanceStats()
      
      return {
        ...mediaStats,
        ...zoomStats,
        isZooming: currentZoom.value > 1.001,
        zoomLevel: currentZoom.value
      }
    }

    // Mouse/touch event handlers
    const handleCanvasClick = (event) => {
      const rect = canvasRef.value.getBoundingClientRect()
      const screenX = event.clientX - rect.left
      const screenY = event.clientY - rect.top
      
      // Convert to canvas coordinates
      const canvasX = (screenX / rect.width) * 1920
      const canvasY = (screenY / rect.height) * 1080
      
      // Zoom to clicked point
      const origin = {
        x: (canvasX / 1920) * 100,
        y: (canvasY / 1080) * 100
      }
      
      // Toggle between zoom levels
      const newZoom = currentZoom.value > 3.5 ? 1.0 : 4.0
      setZoom(newZoom, origin)
    }

    // Initialization
    const initialize = () => {
      // Configure element zoom for this setup
      updateElementConfig('video', {
        enabled: true,
        maintainAspectRatio: true,
        allowCropping: true
      })
      
      updateElementConfig('camera', {
        enabled: true,
        scaleWithZoom: true,
        maintainRelativePosition: true
      })
      
      updateElementConfig('cursor', {
        enabled: true,
        scaleWithZoom: true,
        maintainHotspot: true
      })
      
      updateElementConfig('gifs', {
        enabled: true,
        scaleWithZoom: true,
        maintainRelativePositions: true
      })

      // Update canvas dimensions
      elementZoom.updateCanvasDimensions(1920, 1080)
      
      // Start rendering pipeline
      startRendering()
      
      console.log('[UnifiedZoomExample] Initialized with element zoom')
    }

    // Cleanup
    const cleanup = () => {
      stopRendering()
    }

    return {
      canvasRef,
      videoRef,
      cameraRef,
      
      // Zoom controls
      setZoom,
      zoomPresets,
      zoomToCamera,
      zoomToCursor,
      currentZoom,
      zoomOrigin,
      
      // Element management
      cameraPosition,
      cameraSettings,
      cursorData,
      gifElements,
      updateElementConfig,
      
      // Coordinate conversion
      getWorldCoordinates,
      getScreenCoordinates,
      
      // Performance
      getZoomPerformance,
      
      // Event handlers
      handleCanvasClick,
      
      // Lifecycle
      initialize,
      cleanup,
      
      // Direct access to zoom system
      elementZoom
    }
  }
}

// Template örneği:
/*
<template>
  <div class="unified-zoom-player">
    <canvas 
      ref="canvasRef" 
      class="main-canvas"
      @click="handleCanvasClick"
      :width="1920"
      :height="1080"
    />
    
    <video ref="videoRef" style="display: none" />
    <video ref="cameraRef" style="display: none" />
    
    <div class="zoom-controls">
      <h3>Unified Element Zoom</h3>
      <p>Canvas zoom yerine elementleri transform eder - native çözünürlük korunur</p>
      
      <!-- Zoom Buttons -->
      <div class="zoom-buttons">
        <button @click="zoomPresets.reset">1x (Reset)</button>
        <button @click="zoomPresets.zoom2x">2x</button>
        <button @click="zoomPresets.zoom3x">3x</button>
        <button @click="zoomPresets.zoom4x">4x</button>
        <button @click="zoomPresets.zoom5x">5x</button>
        <button @click="zoomPresets.zoom6x">6x</button>
      </div>
      
      <!-- Element-specific Zoom -->
      <div class="element-zoom">
        <button @click="zoomToCamera">Zoom to Camera</button>
        <button @click="zoomToCursor">Zoom to Cursor</button>
      </div>
      
      <!-- Current State -->
      <div class="zoom-info">
        <p>Current Zoom: {{ currentZoom.toFixed(1) }}x</p>
        <p>Origin: {{ zoomOrigin.x.toFixed(0) }}%, {{ zoomOrigin.y.toFixed(0) }}%</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.unified-zoom-player {
  display: flex;
  gap: 20px;
}

.main-canvas {
  border: 1px solid #ccc;
  cursor: crosshair;
}

.zoom-controls {
  width: 300px;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
}

.zoom-buttons,
.element-zoom {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0;
}

.zoom-buttons button,
.element-zoom button {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.zoom-buttons button:hover,
.element-zoom button:hover {
  background: #e9e9e9;
}

.zoom-info {
  margin-top: 15px;
  font-size: 14px;
}
</style>
*/

// Avantajları:
// ✅ Native video çözünürlüğü korunur
// ✅ Tüm elementler (video, camera, cursor, GIF) tutarlı şekilde zoom'lanır
// ✅ Performans optimizasyonu (canvas resize yok)
// ✅ Koordinat dönüşümleri doğru çalışır
// ✅ Element-specific zoom kontrolleri
// ✅ Smooth zoom transitions mümkün