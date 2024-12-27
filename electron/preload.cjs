const { contextBridge, ipcRenderer } = require("electron");

// Electron API'lerini expose et
contextBridge.exposeInMainWorld("electron", {
	desktopCapturer: {
		getSources: (opts) =>
			ipcRenderer.invoke("DESKTOP_CAPTURER_GET_SOURCES", opts),
	},
	close: () => ipcRenderer.send("WINDOW_CLOSE"),
	moveWindow: (deltaX, deltaY) =>
		ipcRenderer.send("WINDOW_MOVE", { deltaX, deltaY }),
});
