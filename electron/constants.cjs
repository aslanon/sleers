// IPC Event Constants
const IPC_EVENTS = {
	// Recording
	RECORDING_STATUS_CHANGED: "RECORDING_STATUS_CHANGED",
	START_RECORDING: "START_RECORDING",
	STOP_RECORDING: "STOP_RECORDING",

	// Editor
	EDITOR_CLOSED: "EDITOR_CLOSED",
	CLOSE_EDITOR_WINDOW: "CLOSE_EDITOR_WINDOW",

	// Media State
	GET_MEDIA_STATE: "GET_MEDIA_STATE",
	MEDIA_STATE_UPDATE: "MEDIA_STATE_UPDATE",

	// Camera
	CAMERA_DEVICE_CHANGED: "CAMERA_DEVICE_CHANGED",
	CAMERA_STATUS_CHANGED: "CAMERA_STATUS_CHANGED",
	START_CAMERA: "START_CAMERA",
	STOP_CAMERA: "STOP_CAMERA",

	// Area Selection
	START_AREA_SELECTION: "START_AREA_SELECTION",
	AREA_SELECTED: "AREA_SELECTED",
	UPDATE_SELECTED_AREA: "UPDATE_SELECTED_AREA",
	GET_CROP_INFO: "GET_CROP_INFO",

	// Window Management
	WINDOW_CLOSE: "WINDOW_CLOSE",
	START_WINDOW_DRAG: "START_WINDOW_DRAG",
	WINDOW_DRAGGING: "WINDOW_DRAGGING",
	END_WINDOW_DRAG: "END_WINDOW_DRAG",
	GET_WINDOW_POSITION: "GET_WINDOW_POSITION",

	// File Operations
	SAVE_TEMP_VIDEO: "SAVE_TEMP_VIDEO",
	SHOW_SAVE_DIALOG: "SHOW_SAVE_DIALOG",

	// Desktop Capturer
	DESKTOP_CAPTURER_GET_SOURCES: "DESKTOP_CAPTURER_GET_SOURCES",

	// Reset
	RESET_FOR_NEW_RECORDING: "RESET_FOR_NEW_RECORDING",
};

module.exports = {
	IPC_EVENTS,
};
