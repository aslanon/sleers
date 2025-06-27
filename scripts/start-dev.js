#!/usr/bin/env node

const { spawn } = require("child_process");
const net = require("net");
const path = require("path");

// Global process references for cleanup
let nuxtProcess = null;
let electronProcess = null;
let waitOnProcess = null;

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

// Cleanup function
function cleanup() {
	console.log("\n🛑 Geliştirme ortamı kapatılıyor...");

	// Tüm process'leri sonlandır
	if (nuxtProcess && !nuxtProcess.killed) {
		console.log("🔸 Nuxt server kapatılıyor...");
		nuxtProcess.kill("SIGTERM");
		setTimeout(() => {
			if (!nuxtProcess.killed) {
				nuxtProcess.kill("SIGKILL");
			}
		}, 2000);
	}

	if (electronProcess && !electronProcess.killed) {
		console.log("🔸 Electron uygulaması kapatılıyor...");
		electronProcess.kill("SIGTERM");
		setTimeout(() => {
			if (!electronProcess.killed) {
				electronProcess.kill("SIGKILL");
			}
		}, 2000);
	}

	if (waitOnProcess && !waitOnProcess.killed) {
		console.log("🔸 Wait-on process kapatılıyor...");
		waitOnProcess.kill("SIGTERM");
	}

	// Port'ları temizle
	setTimeout(() => {
		const { execSync } = require("child_process");
		try {
			console.log("🧹 Açık port'ları temizleniyor...");
			execSync(
				"lsof -ti:3002,3003,3004,3005,3006,3007,3008,3009,3010,3011,3012,3013,3014,3015,3016,3017,3018,3019,3020 2>/dev/null | xargs kill -9 2>/dev/null || true",
				{ stdio: "inherit" }
			);
		} catch (err) {
			// Port temizleme hatası önemli değil
		}
		console.log("✅ Cleanup tamamlandı");
		process.exit(0);
	}, 3000);
}

// Process exit handlers
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("SIGQUIT", cleanup);

// Akıllı port bulma - önce varsayılan portu dene, sonra sınırlı aralıkta ara
async function findAvailablePort(preferredPort = 3002) {
	const quickPorts = [3002, 3003, 3004]; // Sadece 3 tane hızlı port dene

	console.log(`🔍 Tercih edilen port ${preferredPort} kontrol ediliyor...`);

	// Önce tercih edilen portu dene
	const isPreferredAvailable = await isPortAvailable(preferredPort);
	if (isPreferredAvailable) {
		console.log(`✅ Tercih edilen port ${preferredPort} kullanılabilir!`);
		return preferredPort;
	}

	console.log(
		`⚠️  Port ${preferredPort} kullanımda, hızlı alternatifler deneniyor...`
	);

	// Sadece birkaç hızlı alternatif dene
	for (const port of quickPorts) {
		if (port === preferredPort) continue; // Zaten denendi

		const isAvailable = await isPortAvailable(port);
		if (isAvailable) {
			console.log(`✅ Kullanılabilir port bulundu: ${port}`);
			return port;
		}
	}

	// Hemen sıçrama yaparak 3011'den başla
	console.log("🚀 Hızlı port aralığında aranıyor (3011-3020)...");
	for (let port = 3011; port <= 3020; port++) {
		const isAvailable = await isPortAvailable(port);
		if (isAvailable) {
			console.log(`✅ Kullanılabilir port bulundu: ${port}`);
			return port;
		}
	}

	throw new Error(
		`❌ 3002-3020 aralığında kullanılabilir port bulunamadı. Lütfen diğer uygulamaları kapatmayı deneyin.`
	);
}

async function startDevelopment() {
	try {
		console.log("🚀 Sleer geliştirme ortamı başlatılıyor...");
		console.log(
			"📍 Akıllı port seçimi kullanılıyor (önce 3002, sonra alternatifler)"
		);

		// Akıllı port bulma - her zaman 3002'yi tercih et
		const port = await findAvailablePort(3002);

		// Nuxt dev server'ı başlat (ARM64 native)
		console.log(
			`📦 Nuxt dev server port ${port} ile başlatılıyor (ARM64 native)...`
		);
		nuxtProcess = spawn(
			"arch",
			[
				"-arm64",
				"npx",
				"nuxt",
				"dev",
				"--port",
				port.toString(),
				"--host",
				"127.0.0.1",
			],
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

		// Nuxt process error handling
		nuxtProcess.on("error", (err) => {
			console.error("❌ Nuxt process hatası:", err);
			cleanup();
		});

		// Nuxt server'ın hazır olmasını bekle
		console.log(
			`⏳ Nuxt server'ın http://127.0.0.1:${port} adresinde hazır olması bekleniyor...`
		);

		// Wait-on kullanarak server'ın hazır olmasını bekle (ARM64 native)
		waitOnProcess = spawn(
			"arch",
			["-arm64", "npx", "wait-on", "-t", "30000", `http://127.0.0.1:${port}`],
			{
				stdio: "inherit",
			}
		);

		waitOnProcess.on("close", (code) => {
			if (code === 0) {
				console.log("✅ Nuxt server hazır!");
				console.log("🖥️  Electron uygulaması başlatılıyor (ARM64 native)...");

				// Electron'u başlat (ARM64 native)
				electronProcess = spawn(
					"arch",
					["-arm64", "electron", "electron/main.cjs"],
					{
						stdio: "inherit",
						env: { ...process.env, NODE_ENV: "development" },
					}
				);

				// Electron process error handling
				electronProcess.on("error", (err) => {
					console.error("❌ Electron process hatası:", err);
					cleanup();
				});

				electronProcess.on("close", (code) => {
					console.log(`🔚 Electron uygulaması kapatıldı (exit code: ${code})`);
					cleanup();
				});
			} else {
				console.error("❌ Nuxt server başlatılamadı");
				cleanup();
			}
		});

		waitOnProcess.on("error", (err) => {
			console.error("❌ Wait-on hatası:", err);
			cleanup();
		});
	} catch (error) {
		console.error("❌ Geliştirme ortamı başlatılırken hata:", error);
		cleanup();
	}
}

// Script'i başlat
startDevelopment();
