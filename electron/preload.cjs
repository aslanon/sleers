// Valid channels

const { contextBridge, ipcRenderer } = require("electron");
const { IPC_EVENTS } = require("./constants.cjs");

contextBridge.exposeInMainWorld("electron", {
	ipcRenderer: {
		IPC_EVENTS,
		on: (channel, func) => {
			ipcRenderer.on(channel, (event, ...args) => func(...args));
		},
		once: (channel, func) => {
			ipcRenderer.once(channel, (event, ...args) => func(...args));
		},
		send: (channel, ...args) => {
			ipcRenderer.send(channel, ...args);
		},
		invoke: (channel, ...args) => {
			return ipcRenderer.invoke(channel, ...args);
		},
		removeAllListeners: (channel) => {
			ipcRenderer.removeAllListeners(channel);
		},
	},
	desktopCapturer: {
		getSources: (opts) =>
			ipcRenderer.invoke(IPC_EVENTS.DESKTOP_CAPTURER_GET_SOURCES, opts),
	},
	fileSystem: {
		saveTempVideo: (data, type) =>
			ipcRenderer.invoke(IPC_EVENTS.SAVE_TEMP_VIDEO, data, type),
		getTempVideoPath: () => ipcRenderer.invoke(IPC_EVENTS.GET_TEMP_VIDEO_PATH),
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
});

// Mouse event IPC handlers
contextBridge.exposeInMainWorld("electron", {
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
});
