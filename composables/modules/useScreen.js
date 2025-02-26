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
				audioDeviceId: config.audioDeviceId || null, // null olarak değiştirdik
			};

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
				"Aperture kayıt ayarları:",
				JSON.stringify(recordingOptions, null, 2)
			);

			// 4. Kayıt başlatma
			console.log("Aperture kaydı başlatılıyor...");

			// Kayıt başlatma işlemi
			const recordingStarted = await window.electron.ipcRenderer.invoke(
				"START_APERTURE_RECORDING",
				screenPath.value,
				recordingOptions
			);

			if (!recordingStarted) {
				throw new Error("Aperture kaydı başlatılamadı");
			}

			console.log("Aperture kaydı başarıyla başlatıldı");
			isScreenActive.value = true;
			apertureStarted = true;

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
			console.log("Ekran kaydı durdurma başlatıldı");

			// Yerel bir değişkende IPC_EVENTS'i tut
			const IPC_EVENTS = window.electron?.ipcRenderer?.IPC_EVENTS;
			if (!IPC_EVENTS) {
				throw new Error("IPC events kullanılamıyor");
			}

			// Eğer kayıt aktif değilse, işlemi atla
			if (!isScreenActive.value) {
				console.warn("Ekran kaydı zaten durdurulmuş, işlem atlanıyor");
				return { success: false, message: "Kayıt zaten durdurulmuş" };
			}

			// Önce state'i false yap ki yeni kontroller yapılmasın
			isScreenActive.value = false;

			// Dosya boyutu kontrol aralığını temizle
			if (fileSizeCheckInterval.value) {
				clearInterval(fileSizeCheckInterval.value);
				fileSizeCheckInterval.value = null;
			}

			// Aperture kaydını durdur
			console.log("Aperture kaydı durduruluyor...");
			const recordingStopped = await window.electron?.ipcRenderer.invoke(
				"STOP_APERTURE_RECORDING",
				screenPath.value
			);

			if (!recordingStopped) {
				console.error("Aperture kaydı durdurulurken hata oluştu");
			} else {
				console.log("Aperture kaydı başarıyla durduruldu");
			}

			// Dosya boyutunu kontrol et
			try {
				const fileSize = await window.electron?.ipcRenderer.invoke(
					"GET_FILE_SIZE",
					screenPath.value
				);

				console.log(
					`Ekran kaydı dosya boyutu: ${(fileSize / (1024 * 1024)).toFixed(2)}MB`
				);

				if (fileSize === 0) {
					console.error("Ekran kaydı dosyası boş (0 byte)");
				}
			} catch (fileSizeError) {
				console.error("Dosya boyutu kontrol edilirken hata:", fileSizeError);
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

			// Ses stream'ini sonlandır (eğer varsa)
			if (audioPath.value) {
				try {
					console.log("Ses medya stream'i sonlandırılıyor...");
					await window.electron?.ipcRenderer.invoke(
						IPC_EVENTS.END_MEDIA_STREAM,
						"audio"
					);
					console.log("Ses medya stream'i sonlandırıldı");
				} catch (audioStreamError) {
					console.error(
						"Ses medya stream'i sonlandırılırken hata:",
						audioStreamError
					);
				}
			}

			// Kayıt durumunu güncelle
			window.electron?.ipcRenderer.send(IPC_EVENTS.RECORDING_STATUS_UPDATE, {
				type: "screen",
				isActive: false,
			});

			return {
				success: true,
				videoPath: screenPath.value,
				audioPath: audioPath.value,
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
