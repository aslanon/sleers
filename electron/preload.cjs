const { contextBridge, ipcRenderer, desktopCapturer } = require("electron");

// Electron API'lerini expose et
contextBridge.exposeInMainWorld("electron", {
	desktopCapturer: {
		getSources: async (opts) => {
			try {
				return await desktopCapturer.getSources(opts);
			} catch (error) {
				console.error("Ekran kaynakları alınırken hata:", error);
				throw error;
			}
		},
	},
	close: () => ipcRenderer.send("WINDOW_CLOSE"),
	startDrag: (mousePosition) =>
		ipcRenderer.send("START_WINDOW_DRAG", mousePosition),
	endDrag: () => ipcRenderer.send("END_WINDOW_DRAG"),
	drag: (mousePosition) => ipcRenderer.send("WINDOW_DRAGGING", mousePosition),
});
