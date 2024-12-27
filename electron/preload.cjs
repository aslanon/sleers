const { contextBridge, ipcRenderer } = require("electron");

// Electron API'lerini expose et
contextBridge.exposeInMainWorld("electron", {
	desktopCapturer: {
		getSources: (opts) =>
			ipcRenderer.invoke("DESKTOP_CAPTURER_GET_SOURCES", opts),
	},
	close: () => ipcRenderer.send("WINDOW_CLOSE"),
	startDrag: (mousePosition) =>
		ipcRenderer.send("START_WINDOW_DRAG", mousePosition),
	endDrag: () => ipcRenderer.send("END_WINDOW_DRAG"),
	drag: (mousePosition) => ipcRenderer.send("WINDOW_DRAGGING", mousePosition),
});
