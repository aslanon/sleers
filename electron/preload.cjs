const { contextBridge, ipcRenderer } = require("electron");

// Electron API'lerini expose et
contextBridge.exposeInMainWorld("electron", {
	desktopCapturer: {
		getSources: (opts) =>
			ipcRenderer.invoke("DESKTOP_CAPTURER_GET_SOURCES", opts),
	},
	windowControls: {
		close: () => ipcRenderer.send("WINDOW_CLOSE"),
		startDrag: (mousePosition) =>
			ipcRenderer.send("START_WINDOW_DRAG", mousePosition),
		dragging: (mousePosition) =>
			ipcRenderer.send("WINDOW_DRAGGING", mousePosition),
		endDrag: () => ipcRenderer.send("END_WINDOW_DRAG"),
	},
	fileSystem: {
		saveTempVideo: (blob) => ipcRenderer.invoke("SAVE_TEMP_VIDEO", blob),
		getTempVideoPath: () => ipcRenderer.invoke("GET_TEMP_VIDEO_PATH"),
		cleanupTempVideo: () => ipcRenderer.send("CLEANUP_TEMP_VIDEO"),
	},
	saveTempVideo: (blob) => ipcRenderer.invoke("SAVE_TEMP_VIDEO", blob),
	getTempVideoPath: () => ipcRenderer.invoke("GET_TEMP_VIDEO_PATH"),
	showSaveDialog: (options) => ipcRenderer.invoke("SHOW_SAVE_DIALOG", options),
	copyFile: (src, dest) => ipcRenderer.invoke("COPY_FILE", src, dest),
	readVideoFile: (filePath) => ipcRenderer.invoke("READ_VIDEO_FILE", filePath),
});
