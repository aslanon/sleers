const { contextBridge, ipcRenderer } = require("electron");

// Electron API'lerini expose et
contextBridge.exposeInMainWorld("electron", {
	desktopCapturer: {
		getSources: (opts) =>
			ipcRenderer.invoke("DESKTOP_CAPTURER_GET_SOURCES", opts),
	},
	convertToMp4: async (webmBlob) => {
		try {
			const buffer = await webmBlob.arrayBuffer();
			const result = await ipcRenderer.invoke("CONVERT_TO_MP4", buffer);
			console.log("Dönüştürme başarılı:", result);
			return result;
		} catch (error) {
			console.error("Dönüştürme sırasında hata:", error);
			throw error;
		}
	},
});
