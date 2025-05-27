#!/usr/bin/env node

const { spawn } = require("child_process");
const net = require("net");
const path = require("path");

// Port kontrolü fonksiyonu
async function isPortAvailable(port) {
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

// Kullanılabilir port bulma
async function findAvailablePort(startPort = 3002) {
	let port = startPort;
	const maxPort = 65535;

	while (port <= maxPort) {
		const isAvailable = await isPortAvailable(port);
		if (isAvailable) {
			console.log(`✅ Kullanılabilir port bulundu: ${port}`);
			return port;
		}
		console.log(`⚠️  Port ${port} kullanımda, sonraki port deneniyor...`);
		port++;
	}

	throw new Error(
		`❌ ${startPort} - ${maxPort} aralığında kullanılabilir port bulunamadı`
	);
}

async function startDevelopment() {
	try {
		console.log("🚀 Sleer geliştirme ortamı başlatılıyor...");

		// Kullanılabilir port bul
		const port = await findAvailablePort(3002);

		// Nuxt dev server'ı başlat
		console.log(`📦 Nuxt dev server port ${port} ile başlatılıyor...`);
		const nuxtProcess = spawn(
			"npx",
			["nuxt", "dev", "--port", port.toString(), "--host", "127.0.0.1"],
			{
				stdio: "inherit",
				env: {
					...process.env,
					BROWSER: "none",
					NUXT_PORT: port.toString(),
					PORT: port.toString(),
				},
			}
		);

		// Nuxt server'ın hazır olmasını bekle
		console.log(
			`⏳ Nuxt server'ın http://127.0.0.1:${port} adresinde hazır olması bekleniyor...`
		);

		// Wait-on kullanarak server'ın hazır olmasını bekle
		const waitOnProcess = spawn(
			"npx",
			["wait-on", "-t", "30000", `http://127.0.0.1:${port}`],
			{
				stdio: "inherit",
			}
		);

		waitOnProcess.on("close", (code) => {
			if (code === 0) {
				console.log("✅ Nuxt server hazır!");
				console.log("🖥️  Electron uygulaması başlatılıyor...");

				// Electron'u başlat
				const electronProcess = spawn("electron", ["electron/main.cjs"], {
					stdio: "inherit",
					env: { ...process.env, NODE_ENV: "development" },
				});

				// Process cleanup
				process.on("SIGINT", () => {
					console.log("\n🛑 Geliştirme ortamı kapatılıyor...");
					nuxtProcess.kill();
					electronProcess.kill();
					process.exit(0);
				});

				electronProcess.on("close", () => {
					console.log("🔚 Electron uygulaması kapatıldı");
					nuxtProcess.kill();
					process.exit(0);
				});
			} else {
				console.error("❌ Nuxt server başlatılamadı");
				nuxtProcess.kill();
				process.exit(1);
			}
		});

		waitOnProcess.on("error", (err) => {
			console.error("❌ Wait-on hatası:", err);
			nuxtProcess.kill();
			process.exit(1);
		});
	} catch (error) {
		console.error("❌ Geliştirme ortamı başlatılırken hata:", error);
		process.exit(1);
	}
}

// Script'i başlat
startDevelopment();
