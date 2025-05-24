// electron-shim.js - Renderer tarafında electron modülünü taklit eder
// ESM/CJS uyumluluğu için kullanılır

let electron = { ipcRenderer: null };

// window.electron API'si varsa (preload script ile yüklenmişse) kullan
if (typeof window !== "undefined" && window.electron) {
	electron = window.electron;
}

// ESM için default export
export default electron;

// CommonJS uyumluluğu
export const ipcRenderer = electron.ipcRenderer;
export const desktopCapturer = electron.desktopCapturer;
export const aperture = electron.aperture;
export const permissions = electron.permissions;
export const fileSystem = electron.fileSystem;
export const windowControls = electron.windowControls;
export const recording = electron.recording;
export const mediaStateManager = electron.mediaStateManager;
export const selection = electron.selection;
export const dialog = electron.dialog;
export const store = electron.store;
