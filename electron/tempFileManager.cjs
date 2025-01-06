const fs = require("fs");
const path = require("path");
const { app } = require("electron");

class TempFileManager {
	constructor() {
		this.tempFiles = new Map();
		this.appDir = path.join(app.getPath("downloads"), ".sleer");
		this.ensureAppDir();
	}

	ensureAppDir() {
		if (!fs.existsSync(this.appDir)) {
			fs.mkdirSync(this.appDir, { recursive: true });
		}
	}

	async saveTempVideo(data, type) {
		try {
			// Eski dosyayı temizle
			this.cleanupFile(type);

			// Yeni geçici dosya yolu
			const tempPath = path.join(
				this.appDir,
				`temp-${type}-${Date.now()}.webm`
			);

			// Base64 verisini dosyaya kaydet
			const base64Data = data.replace(/^data:(audio|video)\/\w+;base64,/, "");
			fs.writeFileSync(tempPath, base64Data, "base64");

			// Dosya varlığını ve boyutunu kontrol et
			if (!fs.existsSync(tempPath)) {
				throw new Error(`Geçici dosya oluşturulamadı: ${tempPath}`);
			}

			const stats = fs.statSync(tempPath);
			if (stats.size === 0) {
				fs.unlinkSync(tempPath); // Boş dosyayı sil
				throw new Error(`Geçici dosya boş: ${tempPath}`);
			}

			// Map'e kaydet
			this.tempFiles.set(type, tempPath);

			console.log(`${type} için geçici dosya kaydedildi:`, {
				path: tempPath,
				size: stats.size,
				type: type,
			});

			return tempPath;
		} catch (error) {
			console.error("Geçici dosya kaydedilirken hata:", error);
			throw error;
		}
	}

	cleanupFile(type) {
		const oldPath = this.tempFiles.get(type);
		if (oldPath && fs.existsSync(oldPath)) {
			try {
				fs.unlinkSync(oldPath);
				console.log(`${type} için eski geçici dosya silindi:`, oldPath);
			} catch (err) {
				console.error(`${type} için eski dosya silinirken hata:`, err);
			}
		}
	}

	cleanupAllFiles() {
		console.log("Geçici dosyalar temizleniyor...");
		console.log(
			"Mevcut geçici dosyalar:",
			Array.from(this.tempFiles.entries())
		);

		for (const [type, filePath] of this.tempFiles.entries()) {
			this.cleanupFile(type);
		}
		this.tempFiles.clear();
		console.log("Geçici dosya temizliği tamamlandı");
	}

	getFilePath(type) {
		return this.tempFiles.get(type);
	}

	getAllFiles() {
		return Object.fromEntries(this.tempFiles);
	}
}

module.exports = TempFileManager;
