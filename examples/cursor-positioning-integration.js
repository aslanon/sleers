// MediaPlayer.vue içinde cursor positioning entegrasyonu örneği

import { useOptimizedRenderer } from '@/composables/useOptimizedRenderer'
import { useCursorPositioning } from '@/composables/useCursorPositioning'

export default {
  setup() {
    const canvasRef = ref(null)
    
    // Ana optimized renderer sistemi
    const {
      renderFrame,
      performanceMonitor,
      cursorOffscreen
    } = useOptimizedRenderer(canvasRef, {
      width: 1920,
      height: 1080,
      enableOffscreen: true,
      adaptiveOptimization: true
    })

    // Mouse event handler
    const handleMouseMove = (event) => {
      // Positioning system otomatik olarak normalize eder
      const position = cursorOffscreen.positioning.getPositionFromEvent(event)
      
      // Canvas koordinatları artık tüm cihazlarda tutarlı
      const { canvas: { x, y }, isWithinCanvas } = position
      
      if (isWithinCanvas) {
        // Render cursor at normalized position
        const cursorData = {
          x, y,
          visible: true,
          cursorType: 'default',
          size: 80,
          image: cursorImages.value.default
        }
        
        // Cursor effects
        const effects = {
          rotation: 0,
          scale: 1,
          motionBlur: true,
          blurIntensity: calculateBlurIntensity(x, y)
        }
        
        // Render frame with normalized cursor position
        renderFrame({
          cursorData,
          cursorEffects: effects,
          // ... other render data
        })
      }
    }

    // Canvas resize handler
    const handleCanvasResize = () => {
      // Update positioning system when canvas changes
      if (canvasRef.value) {
        cursorOffscreen.positioning.updateCanvasInfo(canvasRef.value)
        
        // Test coordinate accuracy after resize
        cursorOffscreen.positioning.testCoordinateTransform()
      }
    }

    // Zoom/transform handler
    const handleZoomChange = (scale, offsetX, offsetY) => {
      // Update transform info for accurate positioning
      cursorOffscreen.positioning.updateTransformInfo(scale, offsetX, offsetY)
    }

    // Timeline cursor rendering (for playback)
    const renderTimelineCursor = (mousePositions, currentTime) => {
      if (!mousePositions?.length) return
      
      // Find cursor position at current time
      const currentPos = findPositionAtTime(mousePositions, currentTime)
      if (!currentPos) return
      
      // Normalize recorded position to current canvas size
      const normalizedPos = cursorOffscreen.positioning.normalizeRecordedPosition(
        currentPos.x, 
        currentPos.y, 
        recordingCanvasWidth, 
        recordingCanvasHeight
      )
      
      // Render cursor at normalized position
      const cursorData = {
        x: normalizedPos.x,
        y: normalizedPos.y,
        visible: true,
        cursorType: currentPos.cursorType || 'default',
        size: 80,
        image: cursorImages.value[currentPos.cursorType || 'default']
      }
      
      renderFrame({
        cursorData,
        // ... other data
      })
    }

    // Performance monitoring
    const checkPerformance = () => {
      const stats = performanceMonitor.getPerformanceReport()
      
      if (stats.performanceStatus === 'critical') {
        // Disable cursor effects for better performance
        cursorOffscreen.clearCache()
        console.log('Performance critical - cursor effects disabled')
      }
    }

    // Device-specific optimizations
    const optimizeForDevice = () => {
      const dpr = window.devicePixelRatio || 1
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      const isLowEnd = dpr < 2 || navigator.hardwareConcurrency < 4
      
      if (isMobile || isLowEnd) {
        // Use simplified cursor rendering
        console.log('Low-end device detected, using simplified cursor')
        return {
          motionBlur: false,
          trailEffects: false,
          cacheSize: 10 // Reduced cache
        }
      }
      
      return {
        motionBlur: true,
        trailEffects: true,
        cacheSize: 50
      }
    }

    onMounted(() => {
      // Initialize with device optimizations
      const deviceSettings = optimizeForDevice()
      
      // Set up canvas resize observer
      const resizeObserver = new ResizeObserver(handleCanvasResize)
      if (canvasRef.value) {
        resizeObserver.observe(canvasRef.value)
      }
      
      // Set up performance monitoring
      setInterval(checkPerformance, 2000)
    })

    return {
      canvasRef,
      handleMouseMove,
      handleZoomChange,
      renderTimelineCursor,
      // ... other functions
    }
  }
}

// Kullanım örnekleri:

// 1. Mouse event handling
// <canvas @mousemove="handleMouseMove" @wheel="handleZoomChange" />

// 2. Timeline playback
// renderTimelineCursor(recordedMouseData, currentVideoTime)

// 3. Performance monitoring
// const stats = performanceMonitor.getPerformanceReport()
// console.log(`FPS: ${stats.fps}, Cursor cache hits: ${stats.cursor.cacheHitRatio}%`)

// 4. Debug coordinate transforms
// cursorOffscreen.positioning.testCoordinateTransform([
//   { x: 100, y: 100 },
//   { x: 500, y: 300 }
// ])