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
			camera: null,
		};
		this.activeStreams = new Map(); // Aktif write stream'leri tutacak
		this.appDir = path.join(app.getPath("downloads"), ".sleer");
		this.protectedFiles = new Set(); // Korunan dosyaları tutacak set
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

	// Dosyayı koruma listesine ekle
	protectFile(filePath) {
		if (filePath && typeof filePath === "string") {
			this.protectedFiles.add(filePath);
			console.log(
				`[TempFileManager] Dosya koruma listesine eklendi:`,
				filePath
			);
			return true;
		}
		return false;
	}

	// Dosyayı koruma listesinden çıkar
	unprotectFile(filePath) {
		if (filePath && this.protectedFiles.has(filePath)) {
			this.protectedFiles.delete(filePath);
			console.log(
				`[TempFileManager] Dosya koruma listesinden çıkarıldı:`,
				filePath
			);
			return true;
		}
		return false;
	}

	// Tüm korunan dosyaları listele
	getProtectedFiles() {
		return Array.from(this.protectedFiles);
	}

	async cleanupFile(type) {
		const oldPath = this.tempFiles[type];
		if (oldPath) {
			try {
				// Dosya korunan listesinde mi kontrol et
				if (this.protectedFiles.has(oldPath)) {
					console.log(
						`[TempFileManager] ${type} için dosya koruma listesinde, silinmeyecek:`,
						oldPath
					);
					return;
				}

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

		// Önce state'deki dosyaları temizle
		const cleanupPromises = Object.keys(this.tempFiles).map((type) => {
			const filePath = this.tempFiles[type];
			// Dosya korunan listesinde mi kontrol et
			if (filePath && this.protectedFiles.has(filePath)) {
				console.log(
					`[TempFileManager] ${type} için dosya koruma listesinde, silinmeyecek:`,
					filePath
				);
				return Promise.resolve();
			}
			return this.cleanupFile(type);
		});

		await Promise.all(cleanupPromises);

		// FİZİKSEL DOSYA TEMİZLİĞİ - .sleer klasöründeki tüm temp dosyaları sil
		try {
			console.log(
				"[TempFileManager] 🧹 Fiziksel temp dosya taraması başlatılıyor..."
			);

			if (fs.existsSync(this.appDir)) {
				const files = await fs.promises.readdir(this.appDir);
				const tempFiles = files.filter(
					(file) => file.startsWith("temp_") || file.startsWith("temp-")
				);

				console.log(
					`[TempFileManager] ${tempFiles.length} fiziksel temp dosya bulundu:`,
					tempFiles
				);

				for (const file of tempFiles) {
					const filePath = path.join(this.appDir, file);

					// Korunan dosya kontrolü
					if (this.protectedFiles.has(filePath)) {
						console.log(`[TempFileManager] Korunan dosya atlanıyor: ${file}`);
						continue;
					}

					try {
						await fs.promises.unlink(filePath);
						console.log(`[TempFileManager] ✅ Fiziksel dosya silindi: ${file}`);
					} catch (deleteError) {
						console.error(
							`[TempFileManager] ❌ Dosya silinemedi ${file}:`,
							deleteError.message
						);
					}
				}
			}
		} catch (dirError) {
			console.error(
				"[TempFileManager] Fiziksel temizlik hatası:",
				dirError.message
			);
		}

		// Korunan dosyalar hariç tüm dosyaları null yap
		Object.keys(this.tempFiles).forEach((type) => {
			const filePath = this.tempFiles[type];
			if (filePath && !this.protectedFiles.has(filePath)) {
				this.tempFiles[type] = null;
			}
		});

		console.log("[TempFileManager] Geçici dosya temizliği tamamlandı");
	}

	getFilePath(type) {
		const streamInfo = this.activeStreams.get(type);
		return streamInfo ? streamInfo.path : this.tempFiles[type];
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

	// Yeni stream başlatma fonksiyonu
	startMediaStream(type) {
		// MacRecorder için uygun dosya uzantısı seç
		let extension = ".webm"; // Varsayılan
		if (type === "screen") {
			// MacRecorder çıktısı .mov formatında olacak
			extension = ".mov";
		}

		const filePath = path.join(
			this.appDir,
			`temp_${type}_${Date.now()}${extension}`
		);
		const writeStream = fs.createWriteStream(filePath);

		this.activeStreams.set(type, {
			stream: writeStream,
			path: filePath,
		});

		console.log(`[TempFileManager] ${type} için stream başlatıldı:`, filePath);
		return filePath;
	}

	// Stream'e chunk yazma fonksiyonu
	writeChunkToStream(type, chunk) {
		// Önce stream'in var olup olmadığını kontrol et
		const streamInfo = this.activeStreams.get(type);
		if (!streamInfo || !streamInfo.stream) {
			console.warn(
				`[TempFileManager] ${type} için aktif stream bulunamadı, chunk yazılamadı`
			);
			return false;
		}

		// Stream'in durumunu detaylı kontrol et
		const stream = streamInfo.stream;
		if (
			stream.destroyed ||
			stream.closed ||
			stream.writableEnded ||
			stream.writableFinished
		) {
			console.warn(`[TempFileManager] ${type} stream'i yazılamaz durumda:`, {
				destroyed: stream.destroyed,
				closed: stream.closed,
				writableEnded: stream.writableEnded,
				writableFinished: stream.writableFinished,
			});
			// Stream'i Map'ten kaldır
			this.activeStreams.delete(type);
			return false;
		}

		// Chunk'ın geçerli olup olmadığını kontrol et
		if (!chunk || chunk.byteLength === 0) {
			console.warn(`[TempFileManager] ${type} için geçersiz chunk, yazılamadı`);
			return false;
		}

		try {
			// Chunk'ı buffer'a çevir
			const buffer = Buffer.from(chunk);

			// Chunk boyutunu logla
			console.log(
				`[TempFileManager] ${type} chunk yazılıyor: ${buffer.length} bytes`
			);

			// Chunk'ı yaz ve sonucu döndür
			const result = stream.write(buffer);

			// Yazma işlemi başarısız olursa (backpressure)
			if (!result) {
				console.warn(
					`[TempFileManager] ${type} chunk yazma backpressure oluştu, drain bekleniyor`
				);

				// Drain olayını bekle
				stream.once("drain", () => {
					console.log(
						`[TempFileManager] ${type} stream drain oldu, yazma devam edebilir`
					);
				});
			}

			return result;
		} catch (error) {
			console.error(`[TempFileManager] ${type} chunk yazılırken hata:`, error);
			return false;
		}
	}

	// Stream'i sonlandırma fonksiyonu
	endMediaStream(type) {
		console.log(`[TempFileManager] ${type} stream sonlandırma isteği alındı`);

		// Stream'in var olup olmadığını kontrol et
		const streamInfo = this.activeStreams.get(type);
		if (!streamInfo || !streamInfo.stream) {
			console.warn(
				`[TempFileManager] ${type} için aktif stream bulunamadı, sonlandırılamadı`
			);
			return Promise.resolve(streamInfo ? streamInfo.path : null);
		}

		// Stream'in durumunu kontrol et
		const stream = streamInfo.stream;
		if (
			stream.destroyed ||
			stream.closed ||
			stream.writableEnded ||
			stream.writableFinished
		) {
			console.warn(
				`[TempFileManager] ${type} stream'i zaten sonlandırılmış durumda:`,
				{
					destroyed: stream.destroyed,
					closed: stream.closed,
					writableEnded: stream.writableEnded,
					writableFinished: stream.writableFinished,
					path: streamInfo.path,
				}
			);

			// Stream'i Map'ten kaldır ve dosya yolunu kaydet
			this.activeStreams.delete(type);
			this.tempFiles[type] = streamInfo.path;

			return Promise.resolve(streamInfo.path);
		}

		console.log(`[TempFileManager] ${type} stream sonlandırılıyor...`);

		return new Promise((resolve, reject) => {
			// Stream'i sonlandır ve tüm verilerin yazılmasını bekle
			stream.end((err) => {
				if (err) {
					console.error(
						`[TempFileManager] ${type} stream sonlandırılırken hata:`,
						err
					);

					// Hata olsa bile stream'i Map'ten kaldır ve dosya yolunu kaydet
					this.activeStreams.delete(type);
					this.tempFiles[type] = streamInfo.path;

					reject(err);
					return;
				}

				// Stream'in finish olayını bekle
				stream.on("finish", () => {
					console.log(
						`[TempFileManager] ${type} stream başarıyla sonlandırıldı`
					);

					// Stream'i Map'ten kaldır ve dosya yolunu kaydet
					this.activeStreams.delete(type);
					this.tempFiles[type] = streamInfo.path;

					console.log(
						`[TempFileManager] ${type} stream sonlandırıldı:`,
						streamInfo.path
					);
					resolve(streamInfo.path);
				});

				// Hata durumunda
				stream.on("error", (closeErr) => {
					console.error(
						`[TempFileManager] ${type} stream kapatılırken hata:`,
						closeErr
					);

					// Hata olsa bile stream'i Map'ten kaldır ve dosya yolunu kaydet
					this.activeStreams.delete(type);
					this.tempFiles[type] = streamInfo.path;

					reject(closeErr);
				});

				// Timeout ekle (5 saniye içinde finish olmazsa zorla kapat)
				const timeout = setTimeout(() => {
					console.warn(
						`[TempFileManager] ${type} stream sonlandırma timeout, zorla kapatılıyor`
					);

					// Stream'i Map'ten kaldır ve dosya yolunu kaydet
					this.activeStreams.delete(type);
					this.tempFiles[type] = streamInfo.path;

					resolve(streamInfo.path);
				}, 5000);

				// Finish olduğunda timeout'u temizle
				stream.on("finish", () => clearTimeout(timeout));
				stream.on("error", () => clearTimeout(timeout));
			});
		});
	}

	// Tüm stream'leri temizle
	cleanupStreams() {
		console.log("[TempFileManager] Tüm aktif stream'ler temizleniyor...");

		// Aktif stream yoksa hemen dön
		if (this.activeStreams.size === 0) {
			console.log(
				"[TempFileManager] Aktif stream bulunamadı, temizleme işlemi atlanıyor"
			);
			return Promise.resolve();
		}

		console.log(
			`[TempFileManager] ${this.activeStreams.size} aktif stream temizlenecek`
		);
		const promises = [];

		// Her stream için bir promise oluştur
		for (const [type, streamInfo] of this.activeStreams) {
			if (!streamInfo || !streamInfo.stream) {
				console.warn(
					`[TempFileManager] ${type} için geçersiz stream bilgisi, atlanıyor`
				);
				this.activeStreams.delete(type);
				continue;
			}

			const stream = streamInfo.stream;

			// Stream'in durumunu kontrol et
			if (
				stream.destroyed ||
				stream.closed ||
				stream.writableEnded ||
				stream.writableFinished
			) {
				console.warn(
					`[TempFileManager] ${type} stream'i zaten sonlandırılmış durumda:`,
					{
						destroyed: stream.destroyed,
						closed: stream.closed,
						writableEnded: stream.writableEnded,
						writableFinished: stream.writableFinished,
					}
				);

				// Stream'i Map'ten kaldır ve dosya yolunu kaydet
				this.activeStreams.delete(type);
				this.tempFiles[type] = streamInfo.path;
				continue;
			}

			console.log(`[TempFileManager] ${type} stream'i temizleniyor...`);

			// Her stream için bir promise oluştur
			const promise = new Promise((resolve) => {
				// Timeout ekle (5 saniye içinde finish olmazsa zorla kapat)
				const timeout = setTimeout(() => {
					console.warn(
						`[TempFileManager] ${type} stream temizleme timeout, zorla kapatılıyor`
					);

					try {
						// Stream'i zorla kapat
						stream.destroy();
					} catch (err) {
						console.error(
							`[TempFileManager] ${type} stream zorla kapatılırken hata:`,
							err
						);
					}

					// Stream'i Map'ten kaldır ve dosya yolunu kaydet
					this.activeStreams.delete(type);
					this.tempFiles[type] = streamInfo.path;

					resolve();
				}, 5000);

				// Stream'i sonlandır
				stream.end(() => {
					console.log(`[TempFileManager] ${type} stream'i sonlandırıldı`);

					// Timeout'u temizle
					clearTimeout(timeout);

					// Stream'i Map'ten kaldır ve dosya yolunu kaydet
					this.activeStreams.delete(type);
					this.tempFiles[type] = streamInfo.path;

					resolve();
				});

				// Hata durumunda da resolve et
				stream.on("error", (err) => {
					console.error(
						`[TempFileManager] ${type} stream temizlenirken hata:`,
						err
					);

					// Timeout'u temizle
					clearTimeout(timeout);

					// Stream'i Map'ten kaldır ve dosya yolunu kaydet
					this.activeStreams.delete(type);
					this.tempFiles[type] = streamInfo.path;

					resolve();
				});

				// Finish olayını da dinle
				stream.on("finish", () => {
					console.log(`[TempFileManager] ${type} stream finish olayı alındı`);

					// Timeout'u temizle
					clearTimeout(timeout);

					// Stream'i Map'ten kaldır ve dosya yolunu kaydet
					this.activeStreams.delete(type);
					this.tempFiles[type] = streamInfo.path;

					resolve();
				});
			});

			promises.push(promise);
		}

		// Tüm promise'ların tamamlanmasını bekle
		return Promise.all(promises).then(() => {
			// Tüm stream'leri temizle (eğer hala kalan varsa)
			this.activeStreams.clear();
			console.log("[TempFileManager] Tüm stream'ler temizlendi");
		});
	}
}

module.exports = TempFileManager;
