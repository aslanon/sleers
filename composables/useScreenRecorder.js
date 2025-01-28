import { ref } from "vue";

export const useScreenRecorder = () => {
	const isRecording = ref(false);
	const mediaStream = ref(null);
	let mediaRecorder = null;

	const startScreenRecording = async (options = {}) => {
		try {
			const sources = await window.electron?.desktopCapturer.getSources({
				types: ["window", "screen"],
				thumbnailSize: { width: 100, height: 100 },
				fetchWindowIcons: true,
				excludeTypes: ["panel", "popup", "toolbar"],
			});

			if (!sources || sources.length === 0) {
				throw new Error("Ekran kaynakları bulunamadı");
			}

			// Kamera penceresini filtrele
			const filteredSources = sources.filter(
				(source) =>
					!source.name.includes("camera") &&
					!source.name.toLowerCase().includes("kamera") &&
					!source.name.includes("Sleer Camera")
			);

			let selectedSource = filteredSources[0];
			if (options?.sourceType === "display") {
				selectedSource =
					filteredSources.find((source) => source.id.startsWith("screen:")) ||
					filteredSources[0];
			} else if (options?.sourceType === "window") {
				selectedSource =
					filteredSources.find((source) => source.id.startsWith("window:")) ||
					filteredSources[0];
			}

			const screenStream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: {
					cursor: "never",
					mandatory: {
						cursor: "never",
						chromeMediaSource: "desktop",
						chromeMediaSourceId: selectedSource.id,
						...(options?.width && {
							minWidth: options.width,
							maxWidth: options.width,
							width: options.width,
						}),
						...(options?.height && {
							minHeight: options.height,
							maxHeight: options.height,
							height: options.height,
						}),
						...(options?.x &&
							options?.y && {
								x: options.x,
								y: options.y,
							}),
					},
				},
			});

			mediaStream.value = screenStream;
			isRecording.value = true;

			return screenStream;
		} catch (error) {
			console.error("Ekran kaydı başlatılırken hata:", error);
			throw error;
		}
	};

	const stopScreenRecording = async () => {
		if (mediaStream.value) {
			mediaStream.value.getTracks().forEach((track) => {
				track.stop();
			});
			mediaStream.value = null;
			isRecording.value = false;
		}
	};

	const saveScreenRecording = async (chunks) => {
		try {
			const screenBlob = new Blob(chunks, { type: "video/webm" });
			const screenBuffer = await screenBlob.arrayBuffer();
			const screenBase64 = btoa(
				new Uint8Array(screenBuffer).reduce(
					(data, byte) => data + String.fromCharCode(byte),
					""
				)
			);
			const screenDataUrl = `data:video/webm;base64,${screenBase64}`;
			const screenPath = await window.electron?.fileSystem.saveTempVideo(
				screenDataUrl,
				"screen"
			);

			console.log("Ekran kaydı kaydedildi:", {
				path: screenPath,
				size: screenBlob.size,
			});

			return screenPath;
		} catch (error) {
			console.error("Ekran kaydı kaydedilirken hata:", error);
			throw error;
		}
	};

	return {
		isRecording,
		mediaStream,
		startScreenRecording,
		stopScreenRecording,
		saveScreenRecording,
	};
};
