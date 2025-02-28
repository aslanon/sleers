import { ref, reactive, computed } from "vue";

export const useScreen = () => {
	const isScreenActive = ref(false);
	const screenPath = ref(null);
	const audioPath = ref(null);
	const fileSizeCheckInterval = ref(null);
	let recording = null;
	let aperture = null;

	// Ekran kaydı için varsayılan konfigürasyon
	const defaultConfig = {
		sourceType: "display", // "display" veya "window"
		width: null,
		height: null,
		x: null,
		y: null,
		cursor: false, // Aperture için cursor gösterme ayarı
		videoBitsPerSecond: 50000000,
		audioBitsPerSecond: 320000,
		videoMimeType: "video/mp4",
		audioMimeType: "audio/mp4",
		systemAudio: true,
		microphone: true,
		microphoneDeviceId: null,
		chunkInterval: 100, // Daha sık chunk gönderimi için
	};

	// Konfigürasyon state'i
	const config = reactive({ ...defaultConfig });

	// Konfigürasyonu güncelleme fonksiyonu
	const updateConfig = (newConfig) => {
		Object.assign(config, newConfig);
		console.log("Ekran konfigürasyonu güncellendi:", config);
	};

	// Aperture modülünü yükle
	const initializeAperture = async () => {
		try {
			if (!aperture) {
				console.log("Aperture modülü yükleniyor...");
				// Electron ortamında dinamik import kullanımı
				if (window.electron?.ipcRenderer) {
					// IPC üzerinden Aperture modülünü yükle
					aperture = await window.electron.ipcRenderer.invoke(
						"LOAD_APERTURE_MODULE"
					);
					console.log(
						"Aperture modülü yüklendi:",
						aperture ? "Başarılı" : "Başarısız"
					);
				} else {
					console.error("Electron IPC kullanılamıyor, Aperture yüklenemedi");
				}
			}
			return aperture;
		} catch (error) {
			console.error("Aperture modülü yüklenirken hata:", error);
			return null;
		}
	};

	const startScreenStream = async () => {
		try {
			// Aperture doğrudan stream dönmüyor, sadece kayıt yapıyor
			// Bu nedenle eski API uyumluluğu için null dönüyoruz
			console.log("Aperture stream başlatma isteği (uyumluluk için)");
			return null;
		} catch (error) {
			console.error("Ekran stream'i başlatılırken hata:", error);
			return null;
		}
	};

	const startScreenRecording = async () => {
		// Tüm blokların erişebileceği değişkenleri burada tanımlıyoruz
		const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;
		let apertureStarted = false;

		try {
			// Temel kontroller
			if (!window.electron?.ipcRenderer) {
				throw new Error("Electron IPC Renderer kullanılamıyor");
			}

			if (!IPC_EVENTS) {
				throw new Error("IPC events kullanılamıyor");
			}

			console.log("Ekran kaydı başlatılıyor...");

			// MediaState'ten ses ve kaynak ayarlarını al
			let mediaState = null;
			try {
				mediaState = await window.electron.ipcRenderer.invoke(
					IPC_EVENTS.GET_MEDIA_STATE
				);

				if (mediaState?.audioSettings) {
					console.log("Ses ayarları alındı:", mediaState.audioSettings);
					// Media State'ten alınan ses ayarlarını konfigürasyona aktar
					config.systemAudio = mediaState.audioSettings.systemAudioEnabled;
					config.microphone = mediaState.audioSettings.microphoneEnabled;
					config.microphoneDeviceId =
						mediaState.audioSettings.selectedAudioDevice;

					console.log("Ekran kaydı için ses ayarları güncellendi:", {
						systemAudio: config.systemAudio,
						microphone: config.microphone,
						microphoneDeviceId: config.microphoneDeviceId,
					});
				}

				// Kayıt kaynağı ayarlarını al
				if (mediaState?.recordingSource) {
					console.log(
						"Kayıt kaynağı ayarları alındı:",
						mediaState.recordingSource
					);

					// Kaynak türünü ve ID'sini yapılandırmaya aktar
					const { sourceType, sourceId } = mediaState.recordingSource;

					// Alan seçimi yapılmışsa ve kaynak türü "area" ise
					if (sourceType === "area" && mediaState.selectedArea) {
						console.log("Alan seçimi bilgisi alındı:", mediaState.selectedArea);

						// Kırpma bilgilerini aktararak konfigürasyonu güncelle
						config.x = mediaState.selectedArea.x;
						config.y = mediaState.selectedArea.y;
						config.width = mediaState.selectedArea.width;
						config.height = mediaState.selectedArea.height;
					}
					// Diğer kaynak türleri için (display veya window)
					else if (sourceId) {
						// Kaynak ID'sini yapılandırma nesnesine aktar
						config.sourceId = sourceId;
						config.sourceType = sourceType;
					}
				}
			} catch (mediaStateError) {
				console.warn("MediaState bilgileri alınamadı:", mediaStateError);
			}

			// 1. Aperture modülünü yükle
			console.log("Aperture modülü yükleniyor...");
			const apertureLoaded = await window.electron.ipcRenderer.invoke(
				"LOAD_APERTURE_MODULE"
			);

			if (!apertureLoaded) {
				throw new Error("Aperture modülü yüklenemedi");
			}

			console.log("Aperture modülü başarıyla yüklendi");

			// 2. Geçici dosya oluştur
			console.log("Ekran kaydı için geçici dosya oluşturuluyor...");
			screenPath.value = await window.electron.ipcRenderer.invoke(
				IPC_EVENTS.START_MEDIA_STREAM,
				"screen"
			);

			if (!screenPath.value) {
				throw new Error("Ekran kaydı için geçici dosya oluşturulamadı");
			}

			console.log(
				"Ekran kaydı için geçici dosya oluşturuldu:",
				screenPath.value
			);

			// 3. Kayıt seçeneklerini hazırla
			const recordingOptions = {
				fps: config.fps || 30,
				showCursor: false, //  config.showCursor !== false,
				highlightClicks: false, // config.highlightClicks !== false,
				audioDeviceId: null, // Sistem sesini kaydetmek için null olmalı
				// Kullanıcı mikrofon ayarlarını kontrol et ve ayarla
				audioSourceId:
					config.microphone && config.microphoneDeviceId
						? config.microphoneDeviceId
						: null,
				// Ses kaydını aktifleştir - aperture kütüphanesi için gerekli özel formatta
				audio: {
					captureSystemAudio: config.systemAudio, // Sistem sesini kaydet
					captureDeviceAudio: config.microphone, // Mikrofon sesini kaydet
				},
				// Kaynak ID'si varsa ekle
				sourceId: config.sourceId || null,
			};

			// Açıkça audio=true parametresini de ekle - aperture kütüphanesi için gerekli
			if (config.systemAudio || config.microphone) {
				recordingOptions.audio = true;
				console.log("[useScreen] Audio explicitly enabled:", {
					systemAudio: config.systemAudio,
					microphone: config.microphone,
					microphoneDeviceId: config.microphoneDeviceId,
				});
			} else {
				console.warn(
					"[useScreen] Neither system audio nor microphone is enabled"
				);
			}

			// Ayrıntılı ses ayarlarını logla
			console.log("[useScreen] Detailed audio configuration:", {
				systemAudio: config.systemAudio,
				microphone: config.microphone,
				microphoneDeviceId: config.microphoneDeviceId,
				audioSourceId: recordingOptions.audioSourceId,
				audioDeviceId: recordingOptions.audioDeviceId,
				audioObj: recordingOptions.audio,
				explicitAudio: recordingOptions.audio === true,
			});

			// Kırpma alanı varsa ekle
			if (config.width && config.height) {
				recordingOptions.cropArea = {
					x: config.x,
					y: config.y,
					width: config.width,
					height: config.height,
				};
			}

			console.log(
				"Ekran kaydı için seçenekler:",
				JSON.stringify(
					{
						...recordingOptions,
						sourceId: recordingOptions.sourceId,
						sourceType: config.sourceType,
						cropArea: recordingOptions.cropArea,
					},
					null,
					2
				)
			);

			// 4. Kayıt başlatma
			console.log("Aperture kaydı başlatılıyor...");

			// Kayıt başlatma işlemi
			try {
				const recordingStarted = await window.electron.ipcRenderer.invoke(
					"START_APERTURE_RECORDING",
					screenPath.value,
					recordingOptions
				);

				if (!recordingStarted) {
					console.error("Aperture kaydı başlatılamadı - false döndü");
					throw new Error("Aperture kaydı başlatılamadı");
				}

				console.log("Aperture kaydı başarıyla başlatıldı");
				isScreenActive.value = true;
				apertureStarted = true;

				// Ses dosyası yolunu da ayarla - Aperture'ın gömülü ses kaydını kullanıyoruz
				if (config.systemAudio || config.microphone) {
					// Same file path for audio since Aperture combines them
					audioPath.value = screenPath.value;
				}

				// RECORDING_STATUS_UPDATE ile ana süreç bilgilendir
				window.electron.ipcRenderer.send(IPC_EVENTS.RECORDING_STATUS_UPDATE, {
					type: "screen",
					isActive: true,
					filePath: screenPath.value,
					audioPath: audioPath.value, // Ses yolunu da ekle
				});
			} catch (error) {
				console.error("Aperture kaydı başlatılırken hata:", error);
				throw new Error(`Aperture kaydı başlatılamadı: ${error.message}`);
			}

			// 5. Dosya boyutu kontrolü için interval başlat
			fileSizeCheckInterval.value = setInterval(async () => {
				if (isScreenActive.value) {
					try {
						const fileSize = await window.electron?.ipcRenderer.invoke(
							"GET_FILE_SIZE",
							screenPath.value
						);

						if (fileSize > 0) {
							console.log(
								`Ekran kaydı dosya boyutu: ${(fileSize / (1024 * 1024)).toFixed(
									2
								)}MB`
							);
							window.electron?.ipcRenderer.send(
								IPC_EVENTS.RECORDING_STATUS_UPDATE,
								{
									type: "screen",
									fileSize,
									isActive: true,
								}
							);
						} else {
							console.warn("Ekran kaydı dosyası boş veya bulunamadı");
						}
					} catch (error) {
						console.error("Dosya boyutu kontrol edilirken hata:", error);
					}
				} else {
					clearInterval(fileSizeCheckInterval.value);
				}
			}, 1000);

			return true;
		} catch (error) {
			console.error("Ekran kaydı başlatılırken hata:", error);
			isScreenActive.value = false;

			// Güvenlik kontrolü - eğer kayıt başlatma tam olarak tamamlanmadıysa ve bir dosya oluşturulduysa
			if (screenPath.value && IPC_EVENTS && !apertureStarted) {
				try {
					console.log("Hata sonrası dosya temizleniyor:", screenPath.value);
					await window.electron?.ipcRenderer.invoke(
						IPC_EVENTS.END_MEDIA_STREAM,
						"screen"
					);
					screenPath.value = null;
				} catch (cleanupError) {
					console.error("Hata sonrası temizlik yapılırken hata:", cleanupError);
				}
			}

			// Hata mesajını ilettiğimizden emin ol
			if (error instanceof Error) {
				throw error;
			} else {
				throw new Error("Ekran kaydı başlatılırken bilinmeyen bir hata oluştu");
			}
		}
	};

	const stopScreenRecording = async () => {
		try {
			console.log("Ekran kaydı durduruluyor...");

			// Kaydın aktif olup olmadığını kontrol et
			if (!isScreenActive.value) {
				console.log("Ekran kaydı zaten durdurulmuş");
				return {
					success: true,
					videoPath: screenPath.value,
					audioPath: audioPath.value,
				};
			}

			// Kaydı durdur ve sonuç bekle
			const recordingStopped = await window.electron?.ipcRenderer.invoke(
				"STOP_APERTURE_RECORDING",
				screenPath.value
			);

			if (!recordingStopped) {
				throw new Error("Aperture kaydı durdurulamadı");
			}

			// Kayıt durumunu pasif olarak işaretle
			isScreenActive.value = false;

			// Dosya boyutunu alıp kontrol et
			let fileSize = 0;
			try {
				console.log("Oluşan dosyanın boyutu kontrol ediliyor...");
				const stats = await window.electron?.ipcRenderer.invoke(
					IPC_EVENTS.GET_FILE_SIZE,
					screenPath.value
				);
				if (stats) {
					fileSize = stats.size;
					console.log(
						`Dosya boyutu: ${fileSize} byte (${(
							fileSize /
							(1024 * 1024)
						).toFixed(2)}MB)`
					);

					// Boyut çok küçükse uyarı
					if (fileSize < 10240) {
						// 10KB
						console.warn("Dosya boyutu çok küçük, kayıt sorunlu olabilir!");
					}
				}
			} catch (error) {
				console.error("Dosya boyutu kontrol edilirken hata:", error);
			}

			// Stream'leri sonlandır
			try {
				console.log("Ekran medya stream'i sonlandırılıyor...");
				await window.electron?.ipcRenderer.invoke(
					IPC_EVENTS.END_MEDIA_STREAM,
					"screen"
				);
				console.log("Ekran medya stream'i sonlandırıldı");
			} catch (streamError) {
				console.error(
					"Ekran medya stream'i sonlandırılırken hata:",
					streamError
				);
			}

			// Aperture, video ve sesi aynı dosyaya kaydeder, ayrı bir ses dosyası yok
			// Bu nedenle audioPath.value'yu kontrol etmemize gerek yok
			console.log("Ekran kaydı ses durumu:", {
				systemAudio: config.systemAudio,
				microphone: config.microphone,
				audioPath: audioPath.value,
				audioPathMatches: audioPath.value === screenPath.value,
				fileSize: fileSize,
			});

			// Ses dosyasının varlığını ve boyutunu kontrol et
			if (audioPath.value) {
				try {
					const audioFileSize = await window.electron?.ipcRenderer.invoke(
						IPC_EVENTS.GET_FILE_SIZE,
						audioPath.value
					);
					console.log(
						`[useScreen] Audio file size: ${audioFileSize} bytes (${(
							audioFileSize /
							(1024 * 1024)
						).toFixed(2)}MB)`
					);
				} catch (audioError) {
					console.error("[useScreen] Error checking audio file:", audioError);
				}
			}

			// Kayıt durumunu güncelle
			window.electron?.ipcRenderer.send(IPC_EVENTS.RECORDING_STATUS_UPDATE, {
				type: "screen",
				isActive: false,
			});

			// RECORDING_STATUS_CHANGED ile ana süreç bilgilendir
			window.electron?.ipcRenderer.send(
				IPC_EVENTS.RECORDING_STATUS_CHANGED,
				false
			);

			// Dosya boyutunu son bir kez daha kontrol et ve bilgilendir
			if (fileSize > 0) {
				window.electron?.ipcRenderer.send(IPC_EVENTS.RECORDING_STATUS_UPDATE, {
					type: "screen",
					fileSize: fileSize,
					isActive: false,
					filePath: screenPath.value,
				});

				// Medya dosyalarını bildir
				console.log("Medya dosyalarının hazır olduğu bildiriliyor...", {
					videoPath: screenPath.value,
					audioPath: audioPath.value, // Video ve ses aynı dosyada
				});

				window.electron?.ipcRenderer.send(IPC_EVENTS.MEDIA_PATHS, {
					videoPath: screenPath.value,
					audioPath: audioPath.value, // Video ve ses aynı dosyada
				});

				// İşleme tamamlandı bildirimi
				window.electron?.ipcRenderer.send(IPC_EVENTS.PROCESSING_COMPLETE, {
					videoPath: screenPath.value,
					audioPath: audioPath.value, // Video ve ses aynı dosyada
					cameraPath: null,
				});
			}

			// Başarılı sonuç döndür
			return {
				success: true,
				videoPath: screenPath.value,
				audioPath: audioPath.value, // Video ve ses aynı dosyada
			};
		} catch (error) {
			console.error("Ekran kaydı durdurulurken hata:", error);
			isScreenActive.value = false;

			// Emin olmak için IPC_EVENTS'i tekrar al
			const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;

			// Hata durumunda da stream'leri temizlemeye çalış
			if (IPC_EVENTS) {
				try {
					await window.electron?.ipcRenderer.invoke(
						IPC_EVENTS.END_MEDIA_STREAM,
						"screen"
					);
				} catch (cleanupError) {
					console.error(
						"Hata sonrası stream temizliği yapılırken hata:",
						cleanupError
					);
				}
			}

			return {
				success: false,
				error: error.message,
				videoPath: screenPath.value,
				audioPath: audioPath.value,
			};
		}
	};

	return {
		isScreenActive,
		screenPath: screenPath,
		audioPath: audioPath,
		config,
		updateConfig,
		startScreenStream,
		startScreenRecording,
		stopScreenRecording,
	};
};
