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
		setRecordingStatus: (status) =>
			ipcRenderer.send(IPC_EVENTS.RECORDING_STATUS_CHANGED, status),
		onRecordingError: (callback) =>
			ipcRenderer.on(IPC_EVENTS.RECORDING_ERROR, (event, error) =>
				callback(error)
			),
	},
	mediaStateManager: {
		loadCursorData: () => ipcRenderer.invoke(IPC_EVENTS.LOAD_CURSOR_DATA),
		getState: () => ipcRenderer.invoke(IPC_EVENTS.GET_MEDIA_STATE),
		onStateUpdate: (callback) =>
			ipcRenderer.on(IPC_EVENTS.MEDIA_STATE_UPDATE, (event, state) =>
				callback(state)
			),
	},
	removeAllListeners: () => {
		Object.values(IPC_EVENTS).forEach((channel) => {
			ipcRenderer.removeAllListeners(channel);
		});
	},
});
