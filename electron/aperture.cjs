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
		console.log("[Aperture] Kayıt başlatılıyor:", { outputPath, options });

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
			audioDeviceId: null,
		};

		// Seçenekleri birleştir
		const recordingOptions = { ...defaultOptions, ...options };
		console.log("[Aperture] Kayıt seçenekleri:", recordingOptions);

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
		return await aperture.screens();
	} catch (error) {
		console.error("[Aperture] Ekran listesi alınamadı:", error);
		return [];
	}
}

/**
 * Ses cihazlarının listesini döndürür
 */
async function getAudioDevices() {
	try {
		const aperture = await loadAperture();
		return await aperture.audioDevices();
	} catch (error) {
		console.error("[Aperture] Ses cihazları listesi alınamadı:", error);
		return [];
	}
}

// CommonJS modül ihracı
module.exports = {
	start,
	stop,
	getScreens,
	getAudioDevices,
	killApertureProcesses,
};
