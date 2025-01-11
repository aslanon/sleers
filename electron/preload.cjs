// Valid channels

const { contextBridge, ipcRenderer } = require("electron");
const { IPC_EVENTS } = require("./constants.cjs");
const path = require("path");

// Cursor monitor'ü yükle
let CursorMonitor;
try {
	const cursorMonitorPath = path.join(__dirname, "..", "cursor-monitor");
	console.log("Cursor monitor path:", cursorMonitorPath);
	CursorMonitor = require(cursorMonitorPath);
	console.log("Cursor monitor loaded successfully");
} catch (error) {
	console.error("Cursor monitor yüklenemedi:", error);
}

// Cursor monitor API'sini expose et
if (CursorMonitor) {
	contextBridge.exposeInMainWorld("cursorMonitor", {
		create: () => {
			try {
				const monitor = new CursorMonitor();
				console.log("Cursor monitor instance created");
				return {
					start: () => {
						console.log("Starting cursor monitor");
						return monitor.start();
					},
					stop: () => {
						console.log("Stopping cursor monitor");
						return monitor.stop();
					},
					onCursorChanged: (callback) => {
						console.log("Setting up cursor change listener");
						monitor.on("cursor-changed", callback);
						return () => monitor.removeListener("cursor-changed", callback);
					},
				};
			} catch (error) {
				console.error("Cursor monitor oluşturulamadı:", error);
				return null;
			}
		},
	});
}

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
