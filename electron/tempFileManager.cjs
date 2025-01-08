const fs = require("fs");
const path = require("path");
const { app } = require("electron");

class TempFileManager {
	constructor() {
		this.tempFiles = {
			video: null,
			audio: null,
			screen: null,
			cursor: null,
		};
		this.appDir = path.join(app.getPath("downloads"), ".sleer");
		this.ensureAppDir();
	}

	ensureAppDir() {
		try {
			if (!fs.existsSync(this.appDir)) {
				fs.mkdirSync(this.appDir, { recursive: true });
			}
			console.log("[TempFileManager] Geçici dosya dizini hazır:", this.appDir);
		} catch (error) {
			console.error("[TempFileManager] Dizin oluşturma hatası:", error);
			throw error;
		}
	}

	async saveTempVideo(data, type) {
		console.log(`[TempFileManager] ${type} için geçici dosya kaydediliyor...`);

		try {
			// Eski dosyayı temizle
			await this.cleanupFile(type);

			// Yeni geçici dosya yolu
			const tempPath = path.join(
				this.appDir,
				`temp-${type}-${Date.now()}.webm`
			);
			console.log(`[TempFileManager] Hedef dosya yolu:`, tempPath);

			// Base64 verisini kontrol et
			if (!data || typeof data !== "string") {
				throw new Error(`Geçersiz veri formatı: ${typeof data}`);
			}

			// Base64 verisini dosyaya kaydet
			const base64Data = data.replace(/^data:(audio|video)\/\w+;base64,/, "");
			const buffer = Buffer.from(base64Data, "base64");

			// Buffer boyutunu kontrol et
			if (buffer.length < 1024) {
				throw new Error(`Geçersiz veri boyutu: ${buffer.length} bytes`);
			}

			// Dosyayı yaz
			await fs.promises.writeFile(tempPath, buffer);

			// Dosya varlığını ve boyutunu kontrol et
			const stats = await fs.promises.stat(tempPath);
			console.log(`[TempFileManager] Dosya kaydedildi:`, {
				path: tempPath,
				size: stats.size,
				sizeInMB: (stats.size / (1024 * 1024)).toFixed(2) + "MB",
			});

			if (stats.size === 0) {
				throw new Error(`Boş dosya oluşturuldu: ${tempPath}`);
			}

			// Dosya okuma testi
			const fd = await fs.promises.open(tempPath, "r");
			const testBuffer = Buffer.alloc(1024);
			const { bytesRead } = await fd.read(testBuffer, 0, 1024, 0);
			await fd.close();

			if (bytesRead < 1) {
				throw new Error(`Dosya okunamıyor: ${tempPath}`);
			}

			// Objeye kaydet
			this.tempFiles[type] = tempPath;

			return tempPath;
		} catch (error) {
			console.error(
				`[TempFileManager] ${type} için dosya kaydedilirken hata:`,
				error
			);
			throw error;
		}
	}

	async cleanupFile(type) {
		const oldPath = this.tempFiles[type];
		if (oldPath) {
			try {
				if (fs.existsSync(oldPath)) {
					await fs.promises.unlink(oldPath);
					console.log(
						`[TempFileManager] ${type} için eski dosya silindi:`,
						oldPath
					);
				}
				this.tempFiles[type] = null;
			} catch (err) {
				console.error(
					`[TempFileManager] ${type} için eski dosya silinirken hata:`,
					err
				);
			}
		}
	}

	async cleanupAllFiles() {
		console.log("[TempFileManager] Tüm geçici dosyalar temizleniyor...");
		console.log("Mevcut dosyalar:", this.tempFiles);

		const cleanupPromises = Object.keys(this.tempFiles).map((type) =>
			this.cleanupFile(type)
		);

		await Promise.all(cleanupPromises);

		// Tüm dosyaları null yap
		Object.keys(this.tempFiles).forEach((type) => {
			this.tempFiles[type] = null;
		});

		console.log("[TempFileManager] Geçici dosya temizliği tamamlandı");
	}

	getFilePath(type) {
		const path = this.tempFiles[type];
		if (this._lastLoggedPaths?.[type] !== path) {
			console.log(`[TempFileManager] ${type} için dosya yolu istendi:`, path);
			if (!this._lastLoggedPaths) this._lastLoggedPaths = {};
			this._lastLoggedPaths[type] = path;
		}
		return path;
	}

	getAllFiles() {
		return { ...this.tempFiles };
	}

	async saveTempFile(data, type, extension) {
		try {
			// Eski dosyayı temizle
			await this.cleanupFile(type);

			// Yeni dosya yolu (.sleer klasörü altında)
			const tempPath = path.join(
				this.appDir,
				`temp-${type}-${Date.now()}${extension}`
			);

			console.log(
				`[TempFileManager] ${type} için geçici dosya kaydediliyor:`,
				tempPath
			);

			await fs.promises.writeFile(tempPath, data);

			// Dosya varlığını ve boyutunu kontrol et
			const stats = await fs.promises.stat(tempPath);
			console.log(`[TempFileManager] Dosya kaydedildi:`, {
				path: tempPath,
				size: stats.size,
				type: type,
			});

			this.tempFiles[type] = tempPath;
			return tempPath;
		} catch (error) {
			console.error(`[TempFileManager] ${type} kaydedilirken hata:`, error);
			return null;
		}
	}
}

module.exports = TempFileManager;
