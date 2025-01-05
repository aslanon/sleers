class RecordingManager {
	constructor() {
		this.isRecording = false;
		this.mediaStream = null;
		this.mediaRecorder = null;
		this.chunks = { screen: [], camera: [], audio: [] };
	}

	async startRecording(options) {
		try {
			// Initialize media streams and recorders
			const { screenStream, cameraStream } = await this.getMediaStreams(
				options
			);
			this.setupRecorders(screenStream, cameraStream);
			this.isRecording = true;
		} catch (error) {
			console.error("Error starting recording:", error);
		}
	}

	async stopRecording() {
		if (this.mediaRecorder) {
			this.mediaRecorder.stop();
			this.isRecording = false;
		}
	}

	async saveRecording() {
		// Logic to save the recording
	}

	async getMediaStreams(options) {
		try {
			const screenStream = await navigator.mediaDevices.getDisplayMedia({
				video: true,
				audio: options.systemAudio ? true : false,
			});

			let cameraStream = null;
			if (options.camera) {
				cameraStream = await navigator.mediaDevices.getUserMedia({
					video: { deviceId: { exact: options.cameraDeviceId } },
					audio: false,
				});
			}

			return { screenStream, cameraStream };
		} catch (error) {
			console.error("Error getting media streams:", error);
			throw error;
		}
	}

	setupRecorders(screenStream, cameraStream) {
		try {
			this.mediaRecorder = new MediaRecorder(screenStream, {
				mimeType: "video/webm; codecs=vp9",
			});

			this.mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					this.chunks.screen.push(event.data);
				}
			};

			this.mediaRecorder.onstop = async () => {
				await this.saveRecording();
			};

			this.mediaRecorder.start();

			if (cameraStream) {
				const cameraRecorder = new MediaRecorder(cameraStream, {
					mimeType: "video/webm; codecs=vp9",
				});

				cameraRecorder.ondataavailable = (event) => {
					if (event.data.size > 0) {
						this.chunks.camera.push(event.data);
					}
				};

				cameraRecorder.start();
			}
		} catch (error) {
			console.error("Error setting up recorders:", error);
		}
	}
}

exports.recordingManager = new RecordingManager();
