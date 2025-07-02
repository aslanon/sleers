import { ref } from "vue";

export const useMediaLoader = () => {
	const isLoading = ref(false);
	const loadingProgress = ref(0);

	const loadMediaFile = async (filePath, mimeType = "video/mp4") => {
		if (!filePath) {
			throw new Error("Dosya yolu belirtilmedi");
		}

		isLoading.value = true;
		loadingProgress.value = 0;

		try {
			const electron = window.electron;
			if (!electron?.ipcRenderer) {
				throw new Error("Electron IPC erişim hatası");
			}

			// Ana dosya okuma isteği
			const fileResponse = await electron.ipcRenderer.invoke(
				"READ_VIDEO_FILE",
				filePath
			);

			if (!fileResponse) {
				throw new Error("Dosya okunamadı");
			}

			loadingProgress.value = 25;

			let blob;

			// Tüm dosyalar için streaming yaklaşımı
			if (fileResponse.type === "stream") {
				// Streaming ile güvenli dosya okuma
				loadingProgress.value = 30;

				const streamData = await electron.ipcRenderer.invoke(
					"READ_VIDEO_STREAM",
					fileResponse.path,
					1024 * 1024 // 1MB chunks
				);

				if (!streamData?.chunks) {
					throw new Error("Stream verisi alınamadı");
				}

				loadingProgress.value = 60;

				// Her chunk'ı güvenli şekilde decode edip birleştir
				try {
					const allByteArrays = [];
					let totalLength = 0;

					// İlerleme güncelleme
					loadingProgress.value = 70;

					for (let i = 0; i < streamData.chunks.length; i++) {
						const chunk = streamData.chunks[i];
						if (chunk && chunk.length > 0) {
							const byteCharacters = atob(chunk);
							const chunkByteArray = new Uint8Array(byteCharacters.length);

							for (let j = 0; j < byteCharacters.length; j++) {
								chunkByteArray[j] = byteCharacters.charCodeAt(j);
							}

							allByteArrays.push(chunkByteArray);
							totalLength += chunkByteArray.length;
						}

						// Progress update
						loadingProgress.value =
							70 + Math.floor((i / streamData.chunks.length) * 15);

						// Allow UI to update
						if (i % 10 === 0) {
							await new Promise((resolve) => setTimeout(resolve, 0));
						}
					}

					// Tüm chunk'ları tek bir array'de birleştir
					const finalByteArray = new Uint8Array(totalLength);
					let offset = 0;

					for (const chunkArray of allByteArrays) {
						finalByteArray.set(chunkArray, offset);
						offset += chunkArray.length;
					}

					blob = new Blob([finalByteArray], { type: mimeType });
					loadingProgress.value = 90;
				} catch (decodeError) {
					throw new Error(`Base64 decode hatası: ${decodeError.message}`);
				}
			} else {
				throw new Error(`Bilinmeyen dosya türü: ${fileResponse.type}`);
			}

			loadingProgress.value = 95;
			const url = URL.createObjectURL(blob);
			loadingProgress.value = 100;

			return {
				url,
				blob,
				size: blob.size,
				type: mimeType,
			};
		} catch (error) {
			throw error;
		} finally {
			isLoading.value = false;
			loadingProgress.value = 0;
		}
	};

	const getMimeType = (filePath, mediaType = "video") => {
		const extension = filePath.split(".").pop()?.toLowerCase();

		if (mediaType === "video") {
			return extension === "webm" ? "video/webm" : "video/mp4";
		} else if (mediaType === "camera") {
			return "video/webm";
		} else {
			return extension === "webm" ? "audio/webm" : "audio/mp4";
		}
	};

	return {
		isLoading,
		loadingProgress,
		loadMediaFile,
		getMimeType,
	};
};
