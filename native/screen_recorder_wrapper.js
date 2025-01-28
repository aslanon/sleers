const { desktopCapturer } = require("electron");

class ScreenRecorderWrapper {
	constructor() {
		this.mediaRecorder = null;
		this.stream = null;
		this.chunks = [];
		this.outputPath = null;
	}

	async startRecording(options = {}) {
		try {
			// Mevcut kaydı durdur
			if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
				await this.stopRecording();
			}

			// Ekran kaynaklarını al
			const sources = await desktopCapturer.getSources({
				types: ["screen"],
				thumbnailSize: { width: 100, height: 100 },
			});

			if (!sources || sources.length === 0) {
				throw new Error("Ekran kaynağı bulunamadı");
			}

			// Tüm ekranı seç
			const source = sources[0];

			// Stream al
			this.stream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: {
					mandatory: {
						chromeMediaSource: "desktop",
						chromeMediaSourceId: source.id,
						minWidth: 1280,
						maxWidth: 1920,
						minHeight: 720,
						maxHeight: 1080,
						frameRate: options.fps || 60,
						cursor: options.showCursor ? "always" : "never",
					},
				},
			});

			// MediaRecorder oluştur
			this.mediaRecorder = new MediaRecorder(this.stream, {
				mimeType: "video/webm;codecs=vp9",
				videoBitsPerSecond: options.quality === "high" ? 8000000 : 4000000,
			});

			this.chunks = [];
			this.outputPath = options.outputPath;

			// Event listeners
			this.mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					this.chunks.push(event.data);
				}
			};

			this.mediaRecorder.onstop = async () => {
				const blob = new Blob(this.chunks, { type: "video/webm" });
				const buffer = Buffer.from(await blob.arrayBuffer());
				require("fs").writeFileSync(this.outputPath, buffer);
				this.chunks = [];
			};

			// Kaydı başlat
			this.mediaRecorder.start(1000);
			return true;
		} catch (error) {
			console.error("Ekran kaydı başlatılırken hata:", error);
			throw error;
		}
	}

	async stopRecording() {
		return new Promise((resolve, reject) => {
			try {
				if (!this.mediaRecorder || this.mediaRecorder.state !== "recording") {
					resolve();
					return;
				}

				this.mediaRecorder.onstop = () => {
					if (this.stream) {
						this.stream.getTracks().forEach((track) => track.stop());
						this.stream = null;
					}
					this.mediaRecorder = null;
					resolve();
				};

				this.mediaRecorder.stop();
			} catch (error) {
				console.error("Ekran kaydı durdurulurken hata:", error);
				reject(error);
			}
		});
	}
}

module.exports = ScreenRecorderWrapper;
