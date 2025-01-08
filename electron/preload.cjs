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
			ipcRenderer.invoke("DESKTOP_CAPTURER_GET_SOURCES", opts),
	},
	fileSystem: {
		saveTempVideo: (data, type) =>
			ipcRenderer.invoke("SAVE_TEMP_VIDEO", data, type),
		getTempVideoPath: () => ipcRenderer.invoke("GET_TEMP_VIDEO_PATH"),
	},
	windowControls: {
		close: () => ipcRenderer.send("WINDOW_CLOSE"),
		startDrag: (position) => ipcRenderer.send("START_WINDOW_DRAG", position),
		dragging: (position) => ipcRenderer.send("WINDOW_DRAGGING", position),
		endDrag: () => ipcRenderer.send("END_WINDOW_DRAG"),
	},
	recording: {
		getCropInfo: () => ipcRenderer.invoke("GET_CROP_INFO"),
	},
	mediaStateManager: {
		loadCursorData: () => ipcRenderer.invoke(IPC_EVENTS.LOAD_CURSOR_DATA),
	},
});
