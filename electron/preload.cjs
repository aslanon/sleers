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
});

contextBridge.exposeInMainWorld("api", {
	startMouseTracking: () => {
		console.log("[preload.cjs] Mouse tracking başlatılıyor");
		return ipcRenderer.invoke("START_MOUSE_TRACKING");
	},
	stopMouseTracking: () => {
		console.log("[preload.cjs] Mouse tracking durduruluyor");
		return ipcRenderer.invoke("STOP_MOUSE_TRACKING");
	},
	getMouseEvents: (filePath) => {
		console.log("[preload.cjs] Mouse events alınıyor, filePath:", filePath);
		return ipcRenderer.invoke("GET_MOUSE_EVENTS", filePath);
	},
});

// Mouse event listener'ları
window.addEventListener("click", (e) => {
	ipcRenderer.send("mouse-click", { mouseButton: "left" });
});

window.addEventListener("contextmenu", (e) => {
	ipcRenderer.send("mouse-click", { mouseButton: "right" });
});

window.addEventListener("mousedown", (e) => {
	ipcRenderer.send("mouse-down", {
		mouseButton: e.button === 0 ? "left" : "right",
	});
});

window.addEventListener("mouseup", (e) => {
	ipcRenderer.send("mouse-up", {
		mouseButton: e.button === 0 ? "left" : "right",
	});
});
