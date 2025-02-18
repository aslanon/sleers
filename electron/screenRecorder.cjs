let recorder = null;

class ScreenRecorder {
	constructor() {
		this.isRecording = false;
		this.currentRecordingPath = null;
		this.initializeRecorder();
	}

	async initializeRecorder() {
		try {
			const aperture = await import("aperture");
			recorder = aperture.recorder;
			console.log("Aperture initialized successfully");
		} catch (error) {
			console.error("Failed to initialize Aperture:", error);
			throw error;
		}
	}

	async getScreens() {
		if (!recorder) await this.initializeRecorder();
		return await recorder.screens();
	}

	async getAudioDevices() {
		if (!recorder) await this.initializeRecorder();
		return await recorder.audioDevices();
	}

	async startRecording(options = {}) {
		if (!recorder) await this.initializeRecorder();

		if (this.isRecording) {
			throw new Error("Recording is already in progress");
		}

		const defaultOptions = {
			fps: 60,
			showCursor: false,
			highlightClicks: true,
			audioDeviceId: undefined,
			videoCodec: "h264",
		};

		const recordingOptions = { ...defaultOptions, ...options };

		try {
			await recorder.startRecording(recordingOptions);
			this.isRecording = true;

			// Wait for the file to be ready
			this.currentRecordingPath = await recorder.isFileReady;
			return this.currentRecordingPath;
		} catch (error) {
			console.error("Failed to start recording:", error);
			throw error;
		}
	}

	async stopRecording() {
		if (!recorder) await this.initializeRecorder();

		if (!this.isRecording) {
			throw new Error("No recording in progress");
		}

		try {
			const outputPath = await recorder.stopRecording();
			this.isRecording = false;
			this.currentRecordingPath = null;
			return outputPath;
		} catch (error) {
			console.error("Failed to stop recording:", error);
			throw error;
		}
	}

	async pauseRecording() {
		if (!recorder) await this.initializeRecorder();

		if (!this.isRecording) {
			throw new Error("No recording in progress");
		}

		try {
			await recorder.pause();
		} catch (error) {
			console.error("Failed to pause recording:", error);
			throw error;
		}
	}

	async resumeRecording() {
		if (!recorder) await this.initializeRecorder();

		if (!this.isRecording) {
			throw new Error("No recording in progress");
		}

		try {
			await recorder.resume();
		} catch (error) {
			console.error("Failed to resume recording:", error);
			throw error;
		}
	}

	async isPaused() {
		if (!recorder) await this.initializeRecorder();

		if (!this.isRecording) {
			return false;
		}

		try {
			return await recorder.isPaused();
		} catch (error) {
			console.error("Failed to check pause status:", error);
			throw error;
		}
	}

	async getVideoCodecs() {
		if (!recorder) await this.initializeRecorder();
		return recorder.videoCodecs;
	}
}

module.exports = new ScreenRecorder();
