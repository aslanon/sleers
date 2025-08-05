import { ref, computed } from 'vue'

// Global undo/redo state
const undoStack = ref([])
const redoStack = ref([])
const maxHistorySize = ref(50) // Limit history to prevent memory issues

export const useUndoRedo = () => {
  // Add state to undo stack
  const saveState = (actionType, state, description = '') => {
    // Create deep copy of state to prevent mutation
    const stateCopy = JSON.parse(JSON.stringify(state))
    
    const historyEntry = {
      id: `${actionType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      actionType,
      state: stateCopy,
      description,
      timestamp: Date.now()
    }
    
    // Add to undo stack
    undoStack.value.push(historyEntry)
    
    // Clear redo stack when new action is performed
    redoStack.value = []
    
    // Limit history size
    if (undoStack.value.length > maxHistorySize.value) {
      undoStack.value.shift()
    }
    
    console.log(`[UndoRedo] State saved: ${actionType} - ${description}`)
    console.log(`[UndoRedo] Undo stack size: ${undoStack.value.length}, Redo stack size: ${redoStack.value.length}`)
  }
  
  // Undo last action
  const undo = () => {
    if (undoStack.value.length === 0) {
      console.log('[UndoRedo] Nothing to undo')
      return null
    }
    
    // Get current state before undo (for redo)
    const currentEntry = undoStack.value.pop()
    redoStack.value.push(currentEntry)
    
    // Get previous state
    const previousEntry = undoStack.value[undoStack.value.length - 1]
    
    console.log(`[UndoRedo] Undoing: ${currentEntry.actionType} - ${currentEntry.description}`)
    console.log(`[UndoRedo] Undo stack size: ${undoStack.value.length}, Redo stack size: ${redoStack.value.length}`)
    
    return previousEntry ? previousEntry.state : null
  }
  
  // Redo last undone action
  const redo = () => {
    if (redoStack.value.length === 0) {
      console.log('[UndoRedo] Nothing to redo')
      return null
    }
    
    const redoEntry = redoStack.value.pop()
    undoStack.value.push(redoEntry)
    
    console.log(`[UndoRedo] Redoing: ${redoEntry.actionType} - ${redoEntry.description}`)
    console.log(`[UndoRedo] Undo stack size: ${undoStack.value.length}, Redo stack size: ${redoStack.value.length}`)
    
    return redoEntry.state
  }
  
  // Clear all history
  const clearHistory = () => {
    undoStack.value = []
    redoStack.value = []
    console.log('[UndoRedo] History cleared')
  }
  
  // Get current state snapshot for all application data
  const createStateSnapshot = (activeGifs, timelineSegments, playerSettings, zoomRanges, layoutRanges, cameraSettings, cursorSettings, backgroundSettings, videoSettings) => {
    return {
      activeGifs: JSON.parse(JSON.stringify(activeGifs || [])),
      timelineSegments: JSON.parse(JSON.stringify(timelineSegments || [])),
      playerSettings: JSON.parse(JSON.stringify(playerSettings || {})),
      zoomRanges: JSON.parse(JSON.stringify(zoomRanges || [])),
      layoutRanges: JSON.parse(JSON.stringify(layoutRanges || [])),
      cameraSettings: JSON.parse(JSON.stringify(cameraSettings || {})),
      cursorSettings: JSON.parse(JSON.stringify(cursorSettings || {})),
      backgroundSettings: JSON.parse(JSON.stringify(backgroundSettings || {})),
      videoSettings: JSON.parse(JSON.stringify(videoSettings || {})),
      timestamp: Date.now()
    }
  }

  // Create a comprehensive state from all available composables
  const createComprehensiveState = (stateProviders = {}) => {
    try {
      return {
        activeGifs: stateProviders.getActiveGifs?.() || [],
        timelineSegments: stateProviders.getTimelineSegments?.() || [],
        playerSettings: stateProviders.getPlayerSettings?.() || {},
        zoomRanges: stateProviders.getZoomRanges?.() || [],
        layoutRanges: stateProviders.getLayoutRanges?.() || [],
        cameraSettings: stateProviders.getCameraSettings?.() || {},
        cursorSettings: stateProviders.getCursorSettings?.() || {},
        backgroundSettings: stateProviders.getBackgroundSettings?.() || {},
        videoSettings: stateProviders.getVideoSettings?.() || {},
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('[UndoRedo] Error creating comprehensive state:', error)
      return null
    }
  }

  // Helper to capture current timeline state automatically
  let globalStateProviders = null
  
  const setStateProviders = (providers) => {
    globalStateProviders = providers
  }
  
  const captureTimelineState = () => {
    try {
      if (!globalStateProviders) {
        console.warn('[UndoRedo] No state providers set for automatic capture')
        return {
          activeGifs: [],
          timelineSegments: [],
          playerSettings: {},
          zoomRanges: [],
          layoutRanges: []
        }
      }
      
      return createComprehensiveState(globalStateProviders)
    } catch (error) {
      console.error('[UndoRedo] Error capturing timeline state:', error)
      return null
    }
  }

  // Save state with automatic timeline capture
  const saveTimelineState = (actionType, description = '', customState = null) => {
    const state = customState || captureTimelineState()
    if (state) {
      saveState(actionType, state, description)
    }
  }
  
  // Computed properties
  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)
  const historySize = computed(() => undoStack.value.length)
  
  // Get last action info for UI feedback
  const lastAction = computed(() => {
    if (undoStack.value.length === 0) return null
    return undoStack.value[undoStack.value.length - 1]
  })
  
  // Get next redo action info
  const nextRedoAction = computed(() => {
    if (redoStack.value.length === 0) return null
    return redoStack.value[redoStack.value.length - 1]
  })
  
  return {
    // State management
    saveState,
    createStateSnapshot,
    createComprehensiveState,
    saveTimelineState,
    captureTimelineState,
    setStateProviders,
    
    // Actions
    undo,
    redo,
    clearHistory,
    
    // State
    canUndo,
    canRedo,
    historySize,
    lastAction,
    nextRedoAction,
    
    // Configuration
    maxHistorySize,
    
    // Debug access
    undoStack: computed(() => undoStack.value),
    redoStack: computed(() => redoStack.value)
  }
}