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
		this.activeStreams = new Map();
		this.appDir = path.join(app.getPath("downloads"), ".creavit-studio");
		this.protectedFiles = new Set();
		this.ensureAppDir();
	}

	ensureAppDir() {
		try {
			if (!fs.existsSync(this.appDir)) {
				fs.mkdirSync(this.appDir, { recursive: true });
			}
		} catch (error) {
			throw error;
		}
	}

	async saveTempVideo(data, type) {
		try {
			await this.cleanupFile(type);
			const tempPath = path.join(
				this.appDir,
				`temp-${type}-${Date.now()}.webm`
			);

			if (!data || typeof data !== "string") {
				throw new Error(`Geçersiz veri formatı: ${typeof data}`);
			}

			const base64Data = data.replace(/^data:(audio|video)\/\w+;base64,/, "");
			const buffer = Buffer.from(base64Data, "base64");

			if (buffer.length < 1024) {
				throw new Error(`Geçersiz veri boyutu: ${buffer.length} bytes`);
			}

			await fs.promises.writeFile(tempPath, buffer);

			const stats = await fs.promises.stat(tempPath);
			if (stats.size === 0) {
				throw new Error(`Boş dosya oluşturuldu: ${tempPath}`);
			}

			const fd = await fs.promises.open(tempPath, "r");
			const testBuffer = Buffer.alloc(1024);
			const { bytesRead } = await fd.read(testBuffer, 0, 1024, 0);
			await fd.close();

			if (bytesRead < 1) {
				throw new Error(`Dosya okunamıyor: ${tempPath}`);
			}

			this.tempFiles[type] = tempPath;
			return tempPath;
		} catch (error) {
			throw error;
		}
	}

	protectFile(filePath) {
		if (filePath && typeof filePath === "string") {
			this.protectedFiles.add(filePath);
			return true;
		}
		return false;
	}

	unprotectFile(filePath) {
		if (filePath && this.protectedFiles.has(filePath)) {
			this.protectedFiles.delete(filePath);
			return true;
		}
		return false;
	}

	getProtectedFiles() {
		return Array.from(this.protectedFiles);
	}

	async cleanupFile(type) {
		const oldPath = this.tempFiles[type];
		if (oldPath) {
			try {
				if (this.protectedFiles.has(oldPath)) {
					return;
				}

				if (fs.existsSync(oldPath)) {
					await fs.promises.unlink(oldPath);
				}
				this.tempFiles[type] = null;
			} catch (err) {
				// Error handling preserved without logging
			}
		}
	}

	async cleanupAllFiles() {
		const cleanupPromises = Object.keys(this.tempFiles).map((type) => {
			const filePath = this.tempFiles[type];
			if (filePath && this.protectedFiles.has(filePath)) {
				return Promise.resolve();
			}
			return this.cleanupFile(type);
		});

		await Promise.all(cleanupPromises);

		try {
			if (fs.existsSync(this.appDir)) {
				const files = await fs.promises.readdir(this.appDir);
				const tempFiles = files.filter(
					(file) => file.startsWith("temp_") || file.startsWith("temp-")
				);

				for (const file of tempFiles) {
					const filePath = path.join(this.appDir, file);

					if (this.protectedFiles.has(filePath)) {
						continue;
					}

					try {
						await fs.promises.unlink(filePath);
					} catch (deleteError) {
						// Error handling preserved without logging
					}
				}
			}
		} catch (dirError) {
			// Error handling preserved without logging
		}

		Object.keys(this.tempFiles).forEach((type) => {
			const filePath = this.tempFiles[type];
			if (filePath && !this.protectedFiles.has(filePath)) {
				this.tempFiles[type] = null;
			}
		});
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
			await this.cleanupFile(type);
			const tempPath = path.join(
				this.appDir,
				`temp-${type}-${Date.now()}${extension}`
			);

			await fs.promises.writeFile(tempPath, data);
			await fs.promises.stat(tempPath);

			this.tempFiles[type] = tempPath;
			return tempPath;
		} catch (error) {
			return null;
		}
	}

	startMediaStream(type) {
		let extension = ".webm";
		if (type === "screen") {
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

		return filePath;
	}

	writeChunkToStream(type, chunk) {
		const streamInfo = this.activeStreams.get(type);
		if (!streamInfo || !streamInfo.stream) {
			return false;
		}

		const stream = streamInfo.stream;
		if (
			stream.destroyed ||
			stream.closed ||
			stream.writableEnded ||
			stream.writableFinished
		) {
			this.activeStreams.delete(type);
			return false;
		}

		if (!chunk || chunk.byteLength === 0) {
			return false;
		}

		try {
			const buffer = Buffer.from(chunk);
			const result = stream.write(buffer);

			if (!result) {
				stream.once("drain", () => {});
			}

			return result;
		} catch (error) {
			return false;
		}
	}

	endMediaStream(type) {
		const streamInfo = this.activeStreams.get(type);
		if (!streamInfo || !streamInfo.stream) {
			return Promise.resolve(streamInfo ? streamInfo.path : null);
		}

		const stream = streamInfo.stream;
		if (
			stream.destroyed ||
			stream.closed ||
			stream.writableEnded ||
			stream.writableFinished
		) {
			this.activeStreams.delete(type);
			this.tempFiles[type] = streamInfo.path;
			return Promise.resolve(streamInfo.path);
		}

		return new Promise((resolve, reject) => {
			stream.end((err) => {
				if (err) {
					this.activeStreams.delete(type);
					this.tempFiles[type] = streamInfo.path;
					reject(err);
					return;
				}

				stream.on("finish", () => {
					this.activeStreams.delete(type);
					this.tempFiles[type] = streamInfo.path;
					resolve(streamInfo.path);
				});

				stream.on("error", (closeErr) => {
					this.activeStreams.delete(type);
					this.tempFiles[type] = streamInfo.path;
					reject(closeErr);
				});

				const timeout = setTimeout(() => {
					this.activeStreams.delete(type);
					this.tempFiles[type] = streamInfo.path;
					resolve(streamInfo.path);
				}, 5000);

				stream.on("finish", () => clearTimeout(timeout));
				stream.on("error", () => clearTimeout(timeout));
			});
		});
	}

	cleanupStreams() {
		if (this.activeStreams.size === 0) {
			return Promise.resolve();
		}

		const promises = [];

		for (const [type, streamInfo] of this.activeStreams) {
			if (!streamInfo || !streamInfo.stream) {
				this.activeStreams.delete(type);
				continue;
			}

			const stream = streamInfo.stream;

			if (
				stream.destroyed ||
				stream.closed ||
				stream.writableEnded ||
				stream.writableFinished
			) {
				this.activeStreams.delete(type);
				this.tempFiles[type] = streamInfo.path;
				continue;
			}

			const promise = new Promise((resolve) => {
				const timeout = setTimeout(() => {
					try {
						stream.destroy();
					} catch (err) {}

					this.activeStreams.delete(type);
					this.tempFiles[type] = streamInfo.path;
					resolve();
				}, 5000);

				stream.end(() => {
					clearTimeout(timeout);
					this.activeStreams.delete(type);
					this.tempFiles[type] = streamInfo.path;
					resolve();
				});

				stream.on("error", () => {
					clearTimeout(timeout);
					this.activeStreams.delete(type);
					this.tempFiles[type] = streamInfo.path;
					resolve();
				});

				stream.on("finish", () => {
					clearTimeout(timeout);
					this.activeStreams.delete(type);
					this.tempFiles[type] = streamInfo.path;
					resolve();
				});
			});

			promises.push(promise);
		}

		return Promise.all(promises).then(() => {
			this.activeStreams.clear();
		});
	}
}

module.exports = TempFileManager;
