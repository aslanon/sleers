const net = require("net");

class PortManager {
	constructor() {
		this.defaultPort = 3002;
		this.maxPort = 65535;
		this.currentPort = null;
	}

	/**
	 * Belirtilen portta bir sunucu çalışıp çalışmadığını kontrol eder
	 * @param {number} port - Kontrol edilecek port
	 * @returns {Promise<boolean>} Port kullanılabilirse true, değilse false
	 */
	async isPortAvailable(port) {
		return new Promise((resolve) => {
			const server = net.createServer();

			server.listen(port, "127.0.0.1", () => {
				server.once("close", () => {
					resolve(true);
				});
				server.close();
			});

			server.on("error", () => {
				resolve(false);
			});
		});
	}

	/**
	 * Belirtilen port'tan başlayarak kullanılabilir bir port bulur
	 * @param {number} startPort - Başlangıç portu (varsayılan: 3002)
	 * @returns {Promise<number>} Kullanılabilir port numarası
	 */
	async findAvailablePort(startPort = this.defaultPort) {
		let port = startPort;

		while (port <= this.maxPort) {
			const isAvailable = await this.isPortAvailable(port);
			if (isAvailable) {
				console.log(`[PortManager] Kullanılabilir port bulundu: ${port}`);
				this.currentPort = port;
				return port;
			}
			console.log(
				`[PortManager] Port ${port} kullanımda, sonraki port deneniyor...`
			);
			port++;
		}

		throw new Error(
			`[PortManager] ${startPort} - ${this.maxPort} aralığında kullanılabilir port bulunamadı`
		);
	}

	/**
	 * Mevcut kullanılan portu döndürür
	 * @returns {number|null} Mevcut port veya null
	 */
	getCurrentPort() {
		return this.currentPort;
	}

	/**
	 * Port URL'ini döndürür
	 * @param {string} path - Opsiyonel path (varsayılan: '')
	 * @returns {string} Tam URL
	 */
	getUrl(path = "") {
		if (!this.currentPort) {
			throw new Error("[PortManager] Port henüz atanmamış");
		}
		return `http://127.0.0.1:${this.currentPort}${path}`;
	}

	/**
	 * Port manager'ı sıfırlar
	 */
	reset() {
		this.currentPort = null;
	}
}

module.exports = PortManager;
