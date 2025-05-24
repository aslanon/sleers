// Preload script: Renderer ile Main süreç arasında güvenli bir köprü sağlar
const { contextBridge, ipcRenderer } = require("electron");

// Sabit olay isimleri
const IPC_EVENTS = {
	// Ana olaylar
	WINDOW_CLOSE: "WINDOW_CLOSE",
	START_WINDOW_DRAG: "START_WINDOW_DRAG",
	WINDOW_DRAGGING: "WINDOW_DRAGGING",
	END_WINDOW_DRAG: "END_WINDOW_DRAG",
	DESKTOP_CAPTURER_GET_SOURCES: "DESKTOP_CAPTURER_GET_SOURCES",
	CAMERA_DEVICE_CHANGED: "CAMERA_DEVICE_CHANGED",
	CAMERA_STATUS_CHANGED: "CAMERA_STATUS_CHANGED",
	UPDATE_CAMERA_DEVICE: "UPDATE_CAMERA_DEVICE",
	RECORDING_STATUS_CHANGED: "RECORDING_STATUS_CHANGED",
	START_AREA_SELECTION: "START_AREA_SELECTION",
	AREA_SELECTED: "AREA_SELECTED",
	UPDATE_SELECTED_AREA: "UPDATE_SELECTED_AREA",
	GET_CROP_INFO: "GET_CROP_INFO",
	SAVE_TEMP_VIDEO: "SAVE_TEMP_VIDEO",
	GET_TEMP_VIDEO_PATH: "GET_TEMP_VIDEO_PATH",
	SAVE_SCREENSHOT: "SAVE_SCREENSHOT",
	OPEN_EDITOR_MODE: "OPEN_EDITOR_MODE",
	START_EDITING: "START_EDITING",
	CLOSE_EDITOR_WINDOW: "CLOSE_EDITOR_WINDOW",
	LOAD_CURSOR_DATA: "LOAD_CURSOR_DATA",
	RESET_FOR_NEW_RECORDING: "RESET_FOR_NEW_RECORDING",
	MEDIA_PATHS: "MEDIA_PATHS",
	EDITOR_STATUS_CHANGED: "EDITOR_STATUS_CHANGED",
	PROCESSING_COMPLETE: "PROCESSING_COMPLETE",
	MERGE_STATUS: "MERGE_STATUS",
	CHECK_PERMISSIONS: "CHECK_PERMISSIONS",
	UPDATE_EDITOR_SETTINGS: "UPDATE_EDITOR_SETTINGS",
	GET_EDITOR_SETTINGS: "GET_EDITOR_SETTINGS",
	UPDATE_RECORDING_DELAY: "UPDATE_RECORDING_DELAY",
	GET_RECORDING_DELAY: "GET_RECORDING_DELAY",
	PROTECT_FILE: "PROTECT_FILE",
	UNPROTECT_FILE: "UNPROTECT_FILE",
	GET_PROTECTED_FILES: "GET_PROTECTED_FILES",
};

// Electron API güvenli wrapper fonksiyonu
function createSafeElectronAPI() {
	// Temel köprü fonksiyonları
	return {
		ipcRenderer: {
			IPC_EVENTS,
			on: (channel, func) => {
				if (typeof channel !== "string") return;
				ipcRenderer.on(channel, (event, ...args) => func(...args));
			},
			once: (channel, func) => {
				if (typeof channel !== "string") return;
				ipcRenderer.once(channel, (event, ...args) => func(...args));
			},
			send: (channel, ...args) => {
				if (typeof channel !== "string") return;
				ipcRenderer.send(channel, ...args);
			},
			invoke: (channel, ...args) => {
				if (typeof channel !== "string")
					return Promise.reject(new Error("Invalid channel"));
				return ipcRenderer.invoke(channel, ...args);
			},
			removeAllListeners: (channel) => {
				if (typeof channel !== "string") return;
				ipcRenderer.removeAllListeners(channel);
			},
		},
		desktopCapturer: {
			getSources: (opts) =>
				ipcRenderer.invoke(IPC_EVENTS.DESKTOP_CAPTURER_GET_SOURCES, opts),
		},
		aperture: {
			getScreens: () => ipcRenderer.invoke("GET_APERTURE_SCREENS"),
			validateScreenId: (screenId) =>
				ipcRenderer.invoke("VALIDATE_APERTURE_SCREEN_ID", screenId),
		},
		permissions: {
			check: () => ipcRenderer.invoke(IPC_EVENTS.CHECK_PERMISSIONS),
			request: (type) => ipcRenderer.invoke("REQUEST_PERMISSION", type),
			openSettings: () => ipcRenderer.send("OPEN_SYSTEM_PREFERENCES"),
		},
		fileSystem: {
			saveTempVideo: (data, type) =>
				ipcRenderer.invoke(IPC_EVENTS.SAVE_TEMP_VIDEO, data, type),
			getTempVideoPath: () =>
				ipcRenderer.invoke(IPC_EVENTS.GET_TEMP_VIDEO_PATH),
			saveScreenshot: (imageData, filePath) =>
				ipcRenderer.invoke(IPC_EVENTS.SAVE_SCREENSHOT, imageData, filePath),
		},
		windowControls: {
			close: () => ipcRenderer.send(IPC_EVENTS.WINDOW_CLOSE),
			startDrag: (position) =>
				ipcRenderer.send(IPC_EVENTS.START_WINDOW_DRAG, position),
			dragging: (position) =>
				ipcRenderer.send(IPC_EVENTS.WINDOW_DRAGGING, position),
			endDrag: () => ipcRenderer.send(IPC_EVENTS.END_WINDOW_DRAG),
		},
		recording: {
			getCropInfo: () => ipcRenderer.invoke(IPC_EVENTS.GET_CROP_INFO),
		},
		mediaStateManager: {
			loadCursorData: () => ipcRenderer.invoke(IPC_EVENTS.LOAD_CURSOR_DATA),
		},
		selection: {
			closeWindow: () => ipcRenderer.send("CLOSE_SELECTION_WINDOW"),
		},
		dialog: {
			showPrompt: (options) => ipcRenderer.invoke("SHOW_PROMPT", options),
			showConfirm: (options) => ipcRenderer.invoke("SHOW_CONFIRM", options),
		},
		store: {
			get: (key) => ipcRenderer.invoke("STORE_GET", key),
			set: (key, value) => ipcRenderer.invoke("STORE_SET", key, value),
		},
		// Mouse event handlers
		on: (channel, callback) => {
			if (
				channel === "MOUSE_POSITION" ||
				channel === "MOUSE_CLICK" ||
				channel === "MOUSE_WHEEL"
			) {
				ipcRenderer.on(channel, callback);
			}
		},
		removeListener: (channel, callback) => {
			if (
				channel === "MOUSE_POSITION" ||
				channel === "MOUSE_CLICK" ||
				channel === "MOUSE_WHEEL"
			) {
				ipcRenderer.removeListener(channel, callback);
			}
		},
	};
}

// Güvenli köprü oluştur
try {
	// Electron API'yi güvenli şekilde exposeInMainWorld ile uygulama dünyasına aç
	contextBridge.exposeInMainWorld("electron", createSafeElectronAPI());
	console.log("Preload script başarıyla yüklendi!");
} catch (error) {
	console.error("Preload script yüklenirken hata:", error);
}
