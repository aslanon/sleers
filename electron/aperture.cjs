const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// Aperture için değişkenler
let recording = false;
let recordingProcess = null;
let apertureModule = null;

/**
 * Çalışan aperture süreçlerini temizler
 */
async function killApertureProcesses() {
	try {
		if (process.platform === "darwin") {
			console.log("[Aperture] Çalışan aperture süreçleri temizleniyor...");
			execSync("pkill -f aperture || true");
			console.log("[Aperture] Aperture süreçleri temizlendi");
		}
	} catch (error) {
		console.warn(
			"[Aperture] Süreç temizleme hatası (önemli değil):",
			error.message
		);
	}
}

/**
 * Aperture modülünü yükler
 */
async function loadAperture() {
	if (apertureModule) return apertureModule;

	try {
		console.log("[Aperture] Modül yükleniyor...");
		// ESM modülünü dinamik olarak yükle
		apertureModule = await import("aperture");
		console.log("[Aperture] Modül yüklendi:", Object.keys(apertureModule));
		return apertureModule;
	} catch (error) {
		console.error("[Aperture] Modül yükleme hatası:", error);
		throw error;
	}
}

/**
 * Kayıt başlatır
 * @param {string} outputPath - Çıktı dosyasının yolu
 * @param {object} options - Kayıt seçenekleri
 */
async function start(outputPath, options = {}) {
	try {
		console.log("[Aperture] Kayıt başlatılıyor:", {
			outputPath,
			options: JSON.stringify(options, null, 2),
		});

		// İlk olarak çalışan aperture süreçlerini temizle
		await killApertureProcesses();

		// Daha önceki kaydı durdur
		if (recording) {
			try {
				console.log("[Aperture] Önceki kayıt durdurulacak");
				await stop();
			} catch (error) {
				console.warn("[Aperture] Önceki kayıt durdurma hatası:", error.message);
			}
		}

		recording = false;

		// Aperture modülünü yükle
		const aperture = await loadAperture();

		// Varsayılan seçenekleri ayarla
		const defaultOptions = {
			fps: 30,
			showCursor: false,
			highlightClicks: false,
			audioDeviceId: null, // Sistem sesi için null olmalı
			includeSystemAudio: true, // Sistem sesini dahil et
			includeDeviceAudio: true, // Mikrofon sesini dahil et
		};

		// Seçenekleri birleştir
		const recordingOptions = { ...defaultOptions, ...options };

		// Kullanıcının ses tercihleri varsa, bunları da ekle
		if (options.audio) {
			recordingOptions.includeSystemAudio =
				options.audio.captureSystemAudio !== false;
			recordingOptions.includeDeviceAudio =
				options.audio.captureDeviceAudio !== false;
		}

		// Kullanıcının mikrofon cihazı ayarı varsa, bunu ekle
		if (options.audioSourceId) {
			recordingOptions.audioDeviceId = options.audioSourceId;
			console.log(
				"[Aperture] Mikrofon cihazı ID'si ayarlandı:",
				options.audioSourceId
			);
		} else if (options.audioDeviceId) {
			recordingOptions.audioDeviceId = options.audioDeviceId;
			console.log(
				"[Aperture] Mikrofon cihazı ID'si ayarlandı:",
				options.audioDeviceId
			);
		}

		// Ses kaydı özelliklerini detaylı log'a yaz
		console.log("[Aperture] Ses kayıt ayarları:", {
			includeSystemAudio: recordingOptions.includeSystemAudio,
			includeDeviceAudio: recordingOptions.includeDeviceAudio,
			audioDeviceId: recordingOptions.audioDeviceId,
		});

		// Mikrofon kullanılıyorsa cihazın geçerliliğini kontrol et
		if (recordingOptions.includeDeviceAudio && recordingOptions.audioDeviceId) {
			const isValidDevice = await isValidAudioDevice(
				recordingOptions.audioDeviceId
			);
			if (!isValidDevice) {
				console.warn(
					"[Aperture] Belirtilen mikrofon cihazı bulunamadı:",
					recordingOptions.audioDeviceId
				);

				// Yine de devam et, Aperture varsayılan cihazı seçecektir
				console.log("[Aperture] Varsayılan mikrofon cihazı kullanılacak");
			} else {
				console.log("[Aperture] Mikrofon cihazı geçerli ve kullanıma hazır");
			}
		}

		// Crop alanı kontrolü
		if (options.cropArea) {
			try {
				// Crop alanını kontrol et ve geçerli ise ekle
				const { x, y, width, height } = options.cropArea;

				// Değerleri sayısal olduğunu kontrol et
				if (
					typeof x === "number" &&
					typeof y === "number" &&
					typeof width === "number" &&
					typeof height === "number" &&
					width > 0 &&
					height > 0
				) {
					// Aperture'da crop özelliği henüz tam desteklenmediği için
					// bu bilgiyi daha sonra kullanmak üzere kaydedelim
					recordingOptions.cropArea = {
						x: Math.round(x),
						y: Math.round(y),
						width: Math.round(width),
						height: Math.round(height),
					};

					console.log(
						"[Aperture] Crop alanı ayarlandı:",
						recordingOptions.cropArea
					);

					// FFmpeg ile post-processing yapılacağını belirt
					recordingOptions.shouldCrop = true;
				} else {
					console.warn("[Aperture] Geçersiz crop değerleri:", options.cropArea);
				}
			} catch (error) {
				console.error("[Aperture] Crop işlemi ayarlanırken hata:", error);
			}
		}

		// Kaynak ID'si varsa ekle
		if (options.sourceId) {
			// Kaynak türünü kontrol et - main.cjs'den gelen sourceType kullan
			let sourceType = options.sourceType || "screen"; // sourceType yoksa varsayılan olarak screen kabul et
			let cleanSourceId = options.sourceId;

			// Pencere kaynağı seçilmişse
			if (
				sourceType === "window" ||
				(typeof options.sourceId === "string" &&
					options.sourceId.startsWith("window:"))
			) {
				console.log(
					"[Aperture] Pencere kaynağı seçildi. Aperture sadece ekranları desteklediği için varsayılan ekran kullanılacak"
				);
				// Pencere kaynakları için screenId kullanma, Aperture varsayılan ekranı seçsin
				delete recordingOptions.screenId;

				// Ana ekranı otomatik olarak bulup kullanmayı dene
				try {
					const screens = await getScreens();
					if (screens && screens.length > 0) {
						// Ana ekranı bul (genellikle ilk ekran)
						const mainScreen = screens[0];
						console.log(
							"[Aperture] Pencere kaydı için varsayılan ekran kullanılıyor:",
							{
								id: mainScreen.id,
								name: mainScreen.name,
							}
						);

						// Özel kayıt modu ayarla - varsayılan ekranı ama daha esnek ayarlarla kullan
						recordingOptions.screenId = mainScreen.id;
						recordingOptions.showCursor = options.showCursor !== false; // İmleci göstermeyi varsayılan olarak aç

						// Video kalitesini artır
						recordingOptions.fps = Math.max(recordingOptions.fps || 30, 30); // En az 30 FPS
						if (!recordingOptions.videoCodec) {
							recordingOptions.videoCodec = "h264"; // Daha iyi codec kullan
						}

						// Pencere kaydı yapılıyor bilgisini log'a yaz
						console.log(
							"[Aperture] Pencere kaydı için özel ayarlar kullanılıyor:",
							recordingOptions
						);
					} else {
						console.warn(
							"[Aperture] Kullanılabilir ekran bulunamadı, varsayılan ekran kullanılacak"
						);
					}
				} catch (error) {
					console.error("[Aperture] Varsayılan ekran bulunurken hata:", error);
				}
			}
			// Ekran kaynağı ise ID'yi ayıkla ve sayıya çevir
			else if (
				sourceType === "screen" ||
				(typeof options.sourceId === "string" &&
					options.sourceId.startsWith("screen:"))
			) {
				if (
					typeof options.sourceId === "string" &&
					options.sourceId.startsWith("screen:")
				) {
					cleanSourceId = options.sourceId.split(":")[1];
				}

				// String değeri sayıya çevir (screenId bir UInt32 olmalı)
				const numericScreenId = parseInt(cleanSourceId, 10);

				// Sadece geçerli bir sayı ise ekle
				if (!isNaN(numericScreenId)) {
					// Önce screen ID'sinin geçerli olup olmadığını kontrol et
					const screenExists = await isValidScreenId(numericScreenId);

					if (screenExists) {
						recordingOptions.screenId = numericScreenId;
						console.log("[Aperture] Özel kaynak ID'si kullanılıyor:", {
							original: options.sourceId,
							sourceType: sourceType,
							cleaned: cleanSourceId,
							numeric: numericScreenId,
						});
					} else {
						console.warn(
							"[Aperture] Belirtilen Ekran ID'si mevcut değil:",
							numericScreenId
						);
						// Burada id kullanmamak daha güvenli, Aperture varsayılan ekranı seçecek
						delete recordingOptions.screenId;
					}
				} else {
					console.warn(
						"[Aperture] Geçersiz kaynak ID'si, sayıya dönüştürülemedi:",
						cleanSourceId
					);
				}
			} else {
				console.warn("[Aperture] Bilinmeyen kaynak türü:", sourceType);
				// Bilinmeyen bir tür için varsayılan ekranı kullan
				delete recordingOptions.screenId;
			}
		}

		console.log(
			"[Aperture] Kayıt seçenekleri:",
			JSON.stringify(recordingOptions, null, 2)
		);

		// Modern API kullanımı - GitHub örneğindeki gibi
		try {
			console.log("[Aperture] recorder.startRecording çağrılıyor");

			// Daha uzun timeout ile çalıştır
			await Promise.race([
				aperture.recorder.startRecording(recordingOptions),
				new Promise((_, reject) => {
					setTimeout(() => {
						reject(new Error("Kayıt başlatma zaman aşımı (20 saniye)"));
					}, 20000); // 20 saniye timeout
				}),
			]);

			console.log("[Aperture] Kayıt başladı");

			// Ses kaydıyla ilgili durumu log'a yaz
			if (recordingOptions.includeDeviceAudio) {
				console.log("[Aperture] Mikrofon kaydı aktif:", {
					audioDeviceId: recordingOptions.audioDeviceId || "varsayılan",
				});
			} else {
				console.log("[Aperture] Mikrofon kaydı devre dışı");
			}

			if (recordingOptions.includeSystemAudio) {
				console.log("[Aperture] Sistem sesi kaydı aktif");
			} else {
				console.log("[Aperture] Sistem sesi kaydı devre dışı");
			}

			// Dosya hazır olduğunda
			console.log("[Aperture] Dosya hazır olana kadar bekleniyor...");
			const filePath = await Promise.race([
				aperture.recorder.isFileReady,
				new Promise((_, reject) => {
					setTimeout(() => {
						reject(new Error("Dosya hazır olma zaman aşımı (20 saniye)"));
					}, 20000); // 20 saniye timeout
				}),
			]);

			console.log("[Aperture] Dosya hazır:", filePath);

			// Dosya yolunu kaydet ve outputPath'e taşı
			if (filePath && outputPath) {
				fs.copyFileSync(filePath, outputPath);
				console.log(`[Aperture] Dosya ${outputPath} konumuna kopyalandı`);
			}

			recording = true;
			return true;
		} catch (error) {
			console.error("[Aperture] Kayıt başlatma hatası:", error);
			recording = false;
			throw error;
		}
	} catch (error) {
		console.error("[Aperture] Start fonksiyonu hatası:", error);
		recording = false;
		throw error;
	}
}

/**
 * Kaydı durdurur
 * @param {string} outputPath - Sonuç dosyasının yolu (opsiyonel)
 */
async function stop(outputPath) {
	try {
		console.log("[Aperture] Kayıt durduruluyor");

		// Eğer kayıt yoksa, başarıyla tamamlandı olarak dön
		if (!recording) {
			console.log("[Aperture] Durduracak kayıt yok, başarılı dönüyoruz");
			return true;
		}

		// Aperture modülünü yükle
		const aperture = await loadAperture();

		// Kaydı durdur
		try {
			console.log("[Aperture] Kaydı durdurma komutu gönderiliyor");
			const filePath = await Promise.race([
				aperture.recorder.stopRecording(),
				new Promise((_, reject) => {
					setTimeout(() => {
						reject(new Error("Kayıt durdurma zaman aşımı (20 saniye)"));
					}, 20000); // 20 saniye timeout
				}),
			]);

			console.log("[Aperture] Kayıt durduruldu, dosya:", filePath);

			// Dosyayı istenen konuma kopyala
			if (filePath && outputPath) {
				fs.copyFileSync(filePath, outputPath);
				console.log(`[Aperture] Dosya ${outputPath} konumuna kopyalandı`);
			}

			recording = false;
			return true;
		} catch (error) {
			console.error("[Aperture] Kayıt durdurma hatası:", error);
			recording = false;
			throw error;
		}
	} catch (error) {
		console.error("[Aperture] Stop fonksiyonu hatası:", error);
		recording = false;
		return false;
	}
}

/**
 * Ekranların listesini döndürür
 */
async function getScreens() {
	try {
		const aperture = await loadAperture();
		const screens = await aperture.screens();

		// Ekranları konsola yazdır ve ID'leri göster
		if (screens && screens.length) {
			console.log("[Aperture] Kullanılabilir ekranlar:");
			screens.forEach((screen) => {
				console.log(
					`- ID: ${screen.id} (${typeof screen.id}), Name: ${screen.name}`
				);
			});
		}

		return screens;
	} catch (error) {
		console.error("[Aperture] Ekran listesi alınamadı:", error);
		return [];
	}
}

/**
 * Belirli bir screen ID'sinin geçerli olup olmadığını kontrol eder
 * @param {string|number} screenId - Kontrol edilecek ekran ID'si
 */
async function isValidScreenId(screenId) {
	try {
		// Sayısal değere dönüştür
		const numericId = parseInt(screenId, 10);
		if (isNaN(numericId)) {
			return false;
		}

		// Mevcut ekranları al
		const screens = await getScreens();

		// ID'nin mevcut ekranlardan birinde olup olmadığını kontrol et
		return screens.some((screen) => screen.id === numericId);
	} catch (error) {
		console.error("[Aperture] Screen ID doğrulaması sırasında hata:", error);
		return false;
	}
}

/**
 * Ses cihazlarının listesini döndürür
 */
async function getAudioDevices() {
	try {
		const aperture = await loadAperture();
		const devices = await aperture.audioDevices();

		// Ses cihazlarını detaylı olarak log'a yaz
		if (devices && devices.length) {
			console.log("[Aperture] Kullanılabilir ses cihazları:", devices.length);
			devices.forEach((device, index) => {
				console.log(`[Aperture] Ses cihazı #${index + 1}:`, {
					id: device.id,
					name: device.name,
					type: device.type || "bilinmiyor",
				});
			});
		} else {
			console.warn("[Aperture] Kullanılabilir ses cihazı bulunamadı!");
		}

		return devices;
	} catch (error) {
		console.error("[Aperture] Ses cihazları listesi alınamadı:", error);
		return [];
	}
}

/**
 * Belirli bir ses cihazının varlığını ve geçerliliğini kontrol eder
 * @param {string} deviceId - Kontrol edilecek cihaz ID'si
 */
async function isValidAudioDevice(deviceId) {
	try {
		if (!deviceId) return false;

		const devices = await getAudioDevices();
		const isValid = devices.some((device) => device.id === deviceId);

		console.log(`[Aperture] Ses cihazı geçerliliği kontrol edildi:`, {
			deviceId,
			isValid,
		});

		return isValid;
	} catch (error) {
		console.error("[Aperture] Ses cihazı doğrulama hatası:", error);
		return false;
	}
}

// CommonJS modül ihracı
module.exports = {
	start,
	stop,
	getScreens,
	getAudioDevices,
	killApertureProcesses,
	isValidScreenId,
	isValidAudioDevice,
};
