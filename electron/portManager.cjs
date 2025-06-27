const net = require("net");

class PortManager {
	constructor() {
		this.defaultPort = 3002;
		this.maxPort = 3030; // Sınırlı aralık
		this.currentPort = null;
		this.preferredPorts = [
			3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3020,
		]; // Tercih edilen portlar
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
	 * Akıllı port bulma - önce varsayılan portu dene, sonra tercih edilen portları
	 * @param {number} startPort - Başlangıç portu (varsayılan: 3002)
	 * @returns {Promise<number>} Kullanılabilir port numarası
	 */
	async findAvailablePort(startPort = this.defaultPort) {
		console.log(
			`[PortManager] Tercih edilen port ${startPort} kontrol ediliyor...`
		);

		// Önce başlangıç portunu dene
		const isStartPortAvailable = await this.isPortAvailable(startPort);
		if (isStartPortAvailable) {
			console.log(
				`[PortManager] Tercih edilen port ${startPort} kullanılabilir!`
			);
			this.currentPort = startPort;
			return startPort;
		}

		console.log(
			`[PortManager] Port ${startPort} kullanımda, alternatif portlar deneniyor...`
		);

		// Tercih edilen portları dene
		for (const port of this.preferredPorts) {
			if (port === startPort) continue; // Zaten denendi

			const isAvailable = await this.isPortAvailable(port);
			if (isAvailable) {
				console.log(`[PortManager] Kullanılabilir port bulundu: ${port}`);
				this.currentPort = port;
				return port;
			}
			console.log(`[PortManager] Port ${port} kullanımda...`);
		}

		// Son çare olarak küçük aralıkta dene
		console.log(
			"[PortManager] Son çare olarak 3011-3030 aralığında aranıyor..."
		);
		for (let port = 3011; port <= this.maxPort; port++) {
			const isAvailable = await this.isPortAvailable(port);
			if (isAvailable) {
				console.log(`[PortManager] Kullanılabilir port bulundu: ${port}`);
				this.currentPort = port;
				return port;
			}
		}

		throw new Error(
			`[PortManager] 3002-${this.maxPort} aralığında kullanılabilir port bulunamadı`
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
