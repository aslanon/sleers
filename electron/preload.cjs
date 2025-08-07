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
	GET_DOCK_ITEMS: "GET_DOCK_ITEMS",

	RECORDING_STATUS_CHANGED: "RECORDING_STATUS_CHANGED",
	RECORDING_STATUS_UPDATE: "RECORDING_STATUS_UPDATE",
	START_RECORDING: "START_RECORDING",
	STOP_RECORDING: "STOP_RECORDING",
	RECORDING_ERROR: "RECORDING_ERROR",
	RECORDING_PROGRESS: "RECORDING_PROGRESS",
	UPDATE_RECORDING_SOURCE: "UPDATE_RECORDING_SOURCE",
	UPDATE_RECORDING_DELAY: "UPDATE_RECORDING_DELAY",
	START_MAC_RECORDING: "START_MAC_RECORDING",
	STOP_MAC_RECORDING: "STOP_MAC_RECORDING",

	// Media Streaming
	START_MEDIA_STREAM: "START_MEDIA_STREAM",
	WRITE_MEDIA_CHUNK: "WRITE_MEDIA_CHUNK",
	END_MEDIA_STREAM: "END_MEDIA_STREAM",

	// Editor
	OPEN_EDITOR: "OPEN_EDITOR",
	EDITOR_CLOSED: "EDITOR_CLOSED",
	CLOSE_EDITOR_WINDOW: "CLOSE_EDITOR_WINDOW",
	EDITOR_LOAD_ERROR: "EDITOR_LOAD_ERROR",
	START_EDITING: "START_EDITING",
	PROCESSING_COMPLETE: "PROCESSING_COMPLETE",
	OPEN_EDITOR_MODE: "OPEN_EDITOR_MODE",

	// Media State
	GET_MEDIA_STATE: "GET_MEDIA_STATE",
	MEDIA_STATE_UPDATE: "MEDIA_STATE_UPDATE",
	MEDIA_READY: "MEDIA_READY",
	MEDIA_ERROR: "MEDIA_ERROR",
	GET_MEDIA_PATHS: "GET_MEDIA_PATHS",
	MEDIA_PATHS: "MEDIA_PATHS",

	// Camera
	CAMERA_DEVICE_CHANGED: "CAMERA_DEVICE_CHANGED",
	CAMERA_STATUS_CHANGED: "CAMERA_STATUS_CHANGED",
	START_CAMERA: "START_CAMERA",
	STOP_CAMERA: "STOP_CAMERA",
	GET_CAMERA_STATUS: "GET_CAMERA_STATUS",
	SHOW_CAMERA_WINDOW: "SHOW_CAMERA_WINDOW",
	HIDE_CAMERA_WINDOW: "HIDE_CAMERA_WINDOW",

	// Audio
	AUDIO_DEVICE_CHANGED: "AUDIO_DEVICE_CHANGED",
	AUDIO_STATUS_CHANGED: "AUDIO_STATUS_CHANGED",

	// Area Selection
	START_AREA_SELECTION: "START_AREA_SELECTION",
	AREA_SELECTED: "AREA_SELECTED",
	UPDATE_SELECTED_AREA: "UPDATE_SELECTED_AREA",
	GET_CROP_INFO: "GET_CROP_INFO",

	// Window Management
	WINDOW_CLOSE: "WINDOW_CLOSE",
	START_WINDOW_DRAG: "START_WINDOW_DRAG",
	WINDOW_DRAGGING: "WINDOW_DRAGGING",
	END_WINDOW_DRAG: "END_WINDOW_DRAG",
	GET_WINDOW_POSITION: "GET_WINDOW_POSITION",
	UPDATE_WINDOW_SIZE: "UPDATE_WINDOW_SIZE",

	// File Operations
	SAVE_TEMP_VIDEO: "SAVE_TEMP_VIDEO",
	GET_TEMP_VIDEO_PATH: "GET_TEMP_VIDEO_PATH",
	SHOW_SAVE_DIALOG: "SHOW_SAVE_DIALOG",
	READ_VIDEO_FILE: "READ_VIDEO_FILE",
	SAVE_VIDEO_FILE: "SAVE_VIDEO_FILE",
	SAVE_CANVAS_RECORDING: "SAVE_CANVAS_RECORDING",
	GET_DOCUMENTS_PATH: "GET_DOCUMENTS_PATH",
	SAVE_VIDEO: "SAVE_VIDEO",
	SAVE_GIF: "SAVE_GIF",
	GET_HOME_DIR: "GET_HOME_DIR",
	SHOW_FILE_IN_FOLDER: "SHOW_FILE_IN_FOLDER",
	GET_PATH: "GET_PATH",
	SHOW_DIRECTORY_DIALOG: "SHOW_DIRECTORY_DIALOG",

	// Desktop Capturer
	DESKTOP_CAPTURER_GET_SOURCES: "DESKTOP_CAPTURER_GET_SOURCES",

	// Reset
	RESET_FOR_NEW_RECORDING: "RESET_FOR_NEW_RECORDING",

	// Audio Settings
	UPDATE_AUDIO_SETTINGS: "UPDATE_AUDIO_SETTINGS",
	AUDIO_SETTINGS_UPDATED: "AUDIO_SETTINGS_UPDATED",
	GET_AUDIO_SETTINGS: "GET_AUDIO_SETTINGS",

	// Mouse Position
	MOUSE_POSITION_UPDATED: "MOUSE_POSITION_UPDATED",

	// Recording Delay
	GET_RECORDING_DELAY: "GET_RECORDING_DELAY",

	// Load Cursor Data
	LOAD_CURSOR_DATA: "LOAD_CURSOR_DATA",

	// Editor Settings
	UPDATE_EDITOR_SETTINGS: "UPDATE_EDITOR_SETTINGS",
	GET_EDITOR_SETTINGS: "GET_EDITOR_SETTINGS",

	// Save Screenshot
	SAVE_SCREENSHOT: "SAVE_SCREENSHOT",

	// Permissions
	CHECK_PERMISSIONS: "CHECK_PERMISSIONS",
	REQUEST_PERMISSION: "REQUEST_PERMISSION",
	OPEN_SYSTEM_PREFERENCES: "OPEN_SYSTEM_PREFERENCES",

	// File Protection
	PROTECT_FILE: "PROTECT_FILE",
	UNPROTECT_FILE: "UNPROTECT_FILE",
	GET_PROTECTED_FILES: "GET_PROTECTED_FILES",
	GET_FILE_SIZE: "GET_FILE_SIZE",

	// MacRecorder

	GET_MAC_SCREENS: "GET_MAC_SCREENS",
	GET_MAC_WINDOWS: "GET_MAC_WINDOWS",
	GET_MAC_AUDIO_DEVICES: "GET_MAC_AUDIO_DEVICES",
	VALIDATE_MAC_SCREEN_ID: "VALIDATE_MAC_SCREEN_ID",

	// Utility
	SHOW_PROMPT: "SHOW_PROMPT",
	SHOW_CONFIRM: "SHOW_CONFIRM",
	STORE_GET: "STORE_GET",
	STORE_SET: "STORE_SET",
	DEBUG_CHECK_STATIC_FILES: "DEBUG_CHECK_STATIC_FILES",
};

// Allowed IPC channels to invoke
const validChannels = [
	"RECORDING_STATUS_CHANGED",
	"RECORDING_STATUS_UPDATE",
	"START_RECORDING",
	"STOP_RECORDING",
	"RECORDING_ERROR",
	"RECORDING_PROGRESS",
	"UPDATE_RECORDING_SOURCE",
	"UPDATE_RECORDING_DELAY",
	"START_MAC_RECORDING",
	"STOP_MAC_RECORDING",
	"START_MEDIA_STREAM",
	"WRITE_MEDIA_CHUNK",
	"END_MEDIA_STREAM",
	"OPEN_EDITOR",
	"EDITOR_CLOSED",
	"CLOSE_EDITOR_WINDOW",
	"EDITOR_LOAD_ERROR",
	"START_EDITING",
	"PROCESSING_COMPLETE",
	"OPEN_EDITOR_MODE",
	"GET_MEDIA_STATE",
	"MEDIA_STATE_UPDATE",
	"MEDIA_READY",
	"MEDIA_ERROR",
	"GET_MEDIA_PATHS",
	"MEDIA_PATHS",
	"CAMERA_DEVICE_CHANGED",
	"CAMERA_STATUS_CHANGED",
	"START_CAMERA",
	"STOP_CAMERA",
	"GET_CAMERA_STATUS",
	"SHOW_CAMERA_WINDOW",
	"HIDE_CAMERA_WINDOW",
	"AUDIO_DEVICE_CHANGED",
	"AUDIO_STATUS_CHANGED",
	"START_AREA_SELECTION",
	"AREA_SELECTED",
	"UPDATE_SELECTED_AREA",
	"GET_CROP_INFO",
	"WINDOW_CLOSE",
	"START_WINDOW_DRAG",
	"WINDOW_DRAGGING",
	"END_WINDOW_DRAG",
	"GET_WINDOW_POSITION",
	"UPDATE_WINDOW_SIZE",
	"SAVE_TEMP_VIDEO",
	"GET_TEMP_VIDEO_PATH",
	"SHOW_SAVE_DIALOG",
	"READ_VIDEO_FILE",
	"READ_VIDEO_STREAM",
	"SAVE_VIDEO_FILE",
	"SAVE_CANVAS_RECORDING",
	"GET_DOCUMENTS_PATH",
	"SAVE_VIDEO",
	"SAVE_GIF",
	"GET_HOME_DIR",
	"SHOW_FILE_IN_FOLDER",
	"GET_PATH",
	"SHOW_DIRECTORY_DIALOG",
	"DESKTOP_CAPTURER_GET_SOURCES",
	"RESET_FOR_NEW_RECORDING",
	"UPDATE_AUDIO_SETTINGS",
	"AUDIO_SETTINGS_UPDATED",
	"GET_AUDIO_SETTINGS",
	"MOUSE_POSITION_UPDATED",
	"GET_RECORDING_DELAY",
	"LOAD_CURSOR_DATA",
	"UPDATE_EDITOR_SETTINGS",
	"SAVE_SCREENSHOT",
	"CHECK_PERMISSIONS",
	"REQUEST_PERMISSION",
	"OPEN_SYSTEM_PREFERENCES",
	"PROTECT_FILE",
	"UNPROTECT_FILE",
	"GET_PROTECTED_FILES",
	"GET_FILE_SIZE",

	"GET_MAC_SCREENS",
	"GET_MAC_WINDOWS",
	"GET_MAC_AUDIO_DEVICES",
	"VALIDATE_MAC_SCREEN_ID",
	"SHOW_PROMPT",
	"SHOW_CONFIRM",
	"STORE_GET",
	"STORE_SET",
	"DEBUG_CHECK_STATIC_FILES",
	"GET_DOCK_ITEMS",
];

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
		macRecorder: {
			getDisplays: () => ipcRenderer.invoke("GET_MAC_SCREENS"),
			getWindows: () => ipcRenderer.invoke("GET_MAC_WINDOWS"),
			getAudioDevices: () => ipcRenderer.invoke("GET_MAC_AUDIO_DEVICES"),
			validateScreenId: (screenId) =>
				ipcRenderer.invoke("VALIDATE_MAC_SCREEN_ID", screenId),
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
	// Create a safe API object to expose to the renderer
	const safeElectronAPI = createSafeElectronAPI();

	// Electron API'yi güvenli şekilde exposeInMainWorld ile uygulama dünyasına aç
	contextBridge.exposeInMainWorld("electron", safeElectronAPI);

	// For backward compatibility, also expose as electronAPI
	contextBridge.exposeInMainWorld("electronAPI", {
		invoke: safeElectronAPI.ipcRenderer.invoke,
		send: safeElectronAPI.ipcRenderer.send,
		on: safeElectronAPI.ipcRenderer.on,
		once: safeElectronAPI.ipcRenderer.once,
		removeAllListeners: safeElectronAPI.ipcRenderer.removeAllListeners,
		// GIF search functionality
		searchGifs: async (query) => {
			return await ipcRenderer.invoke('search-gifs', query);
		},
		// Dynamic window overlay functionality
		startDynamicWindowOverlay: () => {
			ipcRenderer.send('START_DYNAMIC_WINDOW_OVERLAY');
		},
		stopDynamicWindowOverlay: () => {
			ipcRenderer.send('STOP_DYNAMIC_WINDOW_OVERLAY');
		},
		onUpdateWindowHighlight: (callback) => {
			ipcRenderer.on('UPDATE_WINDOW_HIGHLIGHT', (event, windowData) => {
				callback(windowData);
			});
		},
		// Dynamic screen overlay functionality  
		startDynamicScreenOverlay: () => {
			ipcRenderer.send('START_DYNAMIC_SCREEN_OVERLAY');
		},
		stopDynamicScreenOverlay: () => {
			ipcRenderer.send('STOP_DYNAMIC_SCREEN_OVERLAY');
		},
		// Event listeners for recording triggers from overlays
		onStartWindowRecording: (callback) => {
			ipcRenderer.on('START_WINDOW_RECORDING', callback);
		},
		onStartScreenRecording: (callback) => {
			ipcRenderer.on('START_SCREEN_RECORDING', callback);
		},
	});

	// Dock API'sini expose et - Ana süreçle iletişim kuran sürüm
	contextBridge.exposeInMainWorld("dockAPI", {
		getDockIcons: async () => {
			try {
				// Doğrudan GET_DOCK_ITEMS eventini kullan
				return await ipcRenderer.invoke(IPC_EVENTS.GET_DOCK_ITEMS);
			} catch (error) {
				console.error("[Preload] Error getting dock icons:", error);
				return [];
			}
		},
	});

	console.log("Preload script başarıyla yüklendi! Exposed APIs:", {
		electron: Object.keys(safeElectronAPI),
		electronAPI: ["invoke", "send", "on", "once", "removeAllListeners"],
		dockAPI: ["getDockIcons"],
	});
} catch (error) {
	console.error("Preload script yüklenirken hata:", error);
}
