const { IPC_EVENTS } = require("./constants.cjs");

class MediaStateManager {
	constructor(mainWindow) {
		this.mainWindow = mainWindow;
		this.state = {
			videoPath: null,
			audioPath: null,
			systemAudioPath: null,
			lastRecordingTime: null,
			isEditing: false,
		};
	}

	updateState(newState) {
		this.state = {
			...this.state,
			...newState,
		};
		this.notifyRenderers();
	}

	resetState() {
		this.state = {
			videoPath: null,
			audioPath: null,
			systemAudioPath: null,
			lastRecordingTime: null,
			isEditing: false,
		};
		this.notifyRenderers();
	}

	getState() {
		return { ...this.state };
	}

	notifyRenderers(window = this.mainWindow) {
		if (window && !window.isDestroyed()) {
			window.webContents.send(IPC_EVENTS.MEDIA_STATE_UPDATE, this.state);
		}
	}

	handleRecordingStatusChange(status, tempFileManager) {
		if (status) {
			// Kayıt başladığında
			if (this.mainWindow) this.mainWindow.hide();
		} else {
			// Kayıt bittiğinde
			this.updateState({
				videoPath:
					tempFileManager.getFilePath("screen") ||
					tempFileManager.getFilePath("video") ||
					null,
				audioPath: tempFileManager.getFilePath("audio") || null,
				lastRecordingTime: new Date().toISOString(),
				isEditing: true,
			});
		}
	}
}

module.exports = MediaStateManager;
