// Valid channels

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
	ipcRenderer: {
		send: (channel, ...args) => ipcRenderer.send(channel, ...args),
		on: (channel, func) => {
			ipcRenderer.on(channel, (event, ...args) => func(...args));
		},
		invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
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
	globalState: {
		get: () => ipcRenderer.invoke("GET_GLOBAL_STATE"),
		update: (newState) => ipcRenderer.invoke("UPDATE_GLOBAL_STATE", newState),
		listen: (callback) => {
			ipcRenderer.on("GLOBAL_STATE_UPDATED", (event, updatedState) => {
				callback(updatedState); // Callback'i tetikle
			});
		},
	},
});
