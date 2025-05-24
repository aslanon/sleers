const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync } = require("child_process");

// file:///Applications/Finder.app/Contents/Resources/icon.icns

/**
 * macOS Dock içeriğini yöneten sınıf
 */
class DockManager {
	constructor() {
		this.isSupported = process.platform === "darwin";
		this.cachedItems = null;
		this.cacheTime = null;
		this.cacheDuration = 60000; // 1 dakika
		this.tempDir = path.join(os.tmpdir(), "sleer-dock-icons");

		// Temp dizini oluştur
		if (this.isSupported) {
			try {
				if (!fs.existsSync(this.tempDir)) {
					fs.mkdirSync(this.tempDir, { recursive: true });
				}
			} catch (error) {
				console.error("[DockManager] Error creating temp directory:", error);
			}
		}

		console.log(
			`[DockManager] Initialized, platform supported: ${this.isSupported}`
		);
	}

	/**
	 * macOS Dock uygulamalarını ve konumlarını döner
	 * @returns {Promise<Array>} Dock öğelerinin listesi
	 */
	async getDockItems() {
		if (!this.isSupported) {
			console.log(
				"[DockManager] Platform not supported, returning empty array"
			);
			return [];
		}

		// Cache süresi dolmadıysa cache'den döndür
		const now = Date.now();
		if (
			this.cachedItems &&
			this.cacheTime &&
			now - this.cacheTime < this.cacheDuration
		) {
			console.log("[DockManager] Returning cached dock items");
			return this.cachedItems;
		}

		try {
			const items = await this._getDockAppsFromDefaults();

			// App ikonlarını çıkart
			const itemsWithIcons = await Promise.all(
				items.map(async (item) => {
					if (item.path && item.path.endsWith(".app")) {
						try {
							const iconDataUrl = await this._extractAppIcon(
								item.path,
								item.name
							);
							return {
								...item,
								iconDataUrl,
							};
						} catch (error) {
							console.error(
								`[DockManager] Error extracting icon for ${item.name}:`,
								error
							);
							return item;
						}
					}
					return item;
				})
			);

			this.cachedItems = itemsWithIcons;
			this.cacheTime = now;
			return itemsWithIcons;
		} catch (error) {
			console.error("[DockManager] Error getting dock items:", error);
			return [];
		}
	}

	/**
	 * macOS'un sips komutunu kullanarak app ikonunu çıkart
	 * @param {string} appPath - Uygulama yolu
	 * @param {string} appName - Uygulama adı
	 * @returns {Promise<string>} İkon data URL'i
	 */
	async _extractAppIcon(appPath, appName) {
		return new Promise(async (resolve, reject) => {
			try {
				// Geçici dosya yolları
				const tempIconPath = path.join(
					this.tempDir,
					`${appName.replace(/[^a-zA-Z0-9]/g, "_")}_icon.png`
				);

				// Önce temizle
				if (fs.existsSync(tempIconPath)) {
					fs.unlinkSync(tempIconPath);
				}

				// Yöntem 1: fileicon kullanarak doğrudan app'in ikonunu al
				try {
					console.log(
						`[DockManager] Extracting icon for ${appName} using fileicon`
					);
					const fileIconCmd = `PATH=$PATH:/usr/local/bin:/opt/homebrew/bin; if command -v fileicon >/dev/null 2>&1; then fileicon get "${appPath}" "${tempIconPath}" 2>/dev/null; else echo "fileicon not found"; fi`;
					execSync(fileIconCmd, { stdio: "pipe" });

					if (
						fs.existsSync(tempIconPath) &&
						fs.statSync(tempIconPath).size > 0
					) {
						console.log(
							`[DockManager] Successfully extracted icon for ${appName} using fileicon`
						);
						const iconData = fs.readFileSync(tempIconPath);
						const base64 = iconData.toString("base64");
						try {
							fs.unlinkSync(tempIconPath);
						} catch (e) {}
						return resolve(`data:image/png;base64,${base64}`);
					}
				} catch (error) {
					console.log(
						`[DockManager] fileicon method failed for ${appName}, trying alternative methods`
					);
				}

				// Yöntem 2: sips kullanarak icns dosyalarını dönüştür
				// Olası tüm icns dosyalarını dene
				const resourcesPath = path.join(appPath, "Contents", "Resources");
				if (fs.existsSync(resourcesPath)) {
					try {
						const files = fs.readdirSync(resourcesPath);
						const icnsFiles = files.filter((file) => file.endsWith(".icns"));

						// Önce app adını içeren veya tipik icon dosyaları dene
						const priorityNames = [
							`${appName}.icns`,
							"AppIcon.icns",
							"app.icns",
							"icon.icns",
							"application.icns",
						];

						// Önce öncelikli dosyaları, sonra diğer tüm icns dosyalarını dene
						const allIcnsFiles = [
							...priorityNames.filter((name) => icnsFiles.includes(name)),
							...icnsFiles.filter((name) => !priorityNames.includes(name)),
						];

						for (const icnsFile of allIcnsFiles) {
							const icnsPath = path.join(resourcesPath, icnsFile);
							console.log(
								`[DockManager] Trying to extract icon from ${icnsPath}`
							);

							try {
								const sipsCmd = `sips -s format png "${icnsPath}" --out "${tempIconPath}" 2>/dev/null`;
								execSync(sipsCmd, { stdio: "pipe" });

								if (
									fs.existsSync(tempIconPath) &&
									fs.statSync(tempIconPath).size > 0
								) {
									console.log(
										`[DockManager] Successfully extracted icon from ${icnsFile}`
									);
									const iconData = fs.readFileSync(tempIconPath);
									const base64 = iconData.toString("base64");
									try {
										fs.unlinkSync(tempIconPath);
									} catch (e) {}
									return resolve(`data:image/png;base64,${base64}`);
								}
							} catch (e) {
								console.log(`[DockManager] sips failed for ${icnsFile}`);
							}
						}
					} catch (error) {
						console.log(`[DockManager] Resources scan failed for ${appName}`);
					}
				}

				// Yöntem 3: AppleScript kullanarak Finder'dan icon al
				try {
					console.log(`[DockManager] Trying AppleScript method for ${appName}`);
					const iconScript = `
					tell application "Finder"
						set theFile to POSIX file "${appPath}"
						set thePath to "${tempIconPath}"
						tell application "System Events"
							set srcFile to disk item (POSIX path of theFile)
							set iconOfFile to icon of srcFile
							set allReps to representations of iconOfFile
							set pngData to (first item of allReps) as «class PNGf»
							set outFile to open for access file thePath with write permission
							set eof of outFile to 0
							write pngData to outFile
							close access outFile
						end tell
					end tell
					`;

					const tempScriptPath = path.join(
						this.tempDir,
						`${appName}_icon_script.applescript`
					);
					fs.writeFileSync(tempScriptPath, iconScript);

					execSync(`osascript "${tempScriptPath}"`, { stdio: "pipe" });
					try {
						fs.unlinkSync(tempScriptPath);
					} catch (e) {}

					if (
						fs.existsSync(tempIconPath) &&
						fs.statSync(tempIconPath).size > 0
					) {
						console.log(
							`[DockManager] Successfully extracted icon using AppleScript for ${appName}`
						);
						const iconData = fs.readFileSync(tempIconPath);
						const base64 = iconData.toString("base64");
						try {
							fs.unlinkSync(tempIconPath);
						} catch (e) {}
						return resolve(`data:image/png;base64,${base64}`);
					}
				} catch (error) {
					console.log(`[DockManager] AppleScript method failed for ${appName}`);
				}

				// Son çare: Basit bir icon oluştur
				try {
					console.log(`[DockManager] Creating placeholder icon for ${appName}`);
					// Basit bir icon oluşturmak için html2canvas API kullanarak html'den bir canvas oluşturup png'ye çeviriyoruz
					const svgTemplate = `
					<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
						<rect width="512" height="512" rx="128" fill="#${Math.floor(
							Math.random() * 16777215
						).toString(16)}"/>
						<text x="256" y="256" font-family="Arial" font-size="280" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">${appName
							.charAt(0)
							.toUpperCase()}</text>
					</svg>
					`;
					fs.writeFileSync(tempIconPath + ".svg", svgTemplate);

					// SVG'yi PNG'ye çevir
					execSync(
						`sips -s format png "${tempIconPath}.svg" --out "${tempIconPath}" 2>/dev/null`,
						{ stdio: "pipe" }
					);
					try {
						fs.unlinkSync(tempIconPath + ".svg");
					} catch (e) {}

					if (
						fs.existsSync(tempIconPath) &&
						fs.statSync(tempIconPath).size > 0
					) {
						const iconData = fs.readFileSync(tempIconPath);
						const base64 = iconData.toString("base64");
						try {
							fs.unlinkSync(tempIconPath);
						} catch (e) {}
						return resolve(`data:image/png;base64,${base64}`);
					}

					console.warn(
						`[DockManager] Could not create any icon for ${appName}`
					);
					resolve(null);
				} catch (error) {
					console.error(
						`[DockManager] Error creating placeholder icon: ${error}`
					);
					resolve(null);
				}
			} catch (error) {
				console.error(
					`[DockManager] Error extracting icon for ${appName}:`,
					error
				);
				resolve(null);
			}
		});
	}

	/**
	 * `defaults read` komutunun çıktısını al ve parse et
	 */
	async _getDockAppsFromDefaults() {
		return new Promise((resolve, reject) => {
			exec(
				"defaults read com.apple.dock persistent-apps",
				(error, stdout, stderr) => {
					if (error) {
						console.error("[DockManager] defaults read error:", error);
						return reject(error);
					}

					const items = this._parseDefaultsOutput(stdout);
					resolve(items);
				}
			);
		});
	}

	/**
	 * Komut çıktısını parse eder
	 */
	_parseDefaultsOutput(output) {
		const entries = output.split("},").filter(Boolean);

		return entries.map((entry, index) => {
			let appName = "Unknown";
			let appPath = "";
			const labelMatch = entry.match(/"file-label"\s*=\s*("?)(.+?)\1;/);
			const pathMatch = entry.match(/"_CFURLString"\s*=\s*"([^"]+)";/);

			if (labelMatch && labelMatch[2]) {
				appName = labelMatch[2].trim();
			}

			if (pathMatch && pathMatch[1]) {
				appPath = decodeURIComponent(pathMatch[1].replace("file://", ""));
			}

			// Sondaki '/' karakterini kaldır
			if (appPath.endsWith("/")) {
				appPath = appPath.slice(0, -1);
			}

			let iconPath = "Icon bulunamadı";
			if (appPath && appPath.endsWith(".app")) {
				const possibleNames = [
					"AppIcon.icns",
					"app.icns",
					"icon.icns",
					"application.icns",
				];

				for (const name of possibleNames) {
					const testPath = path.join(appPath, "Contents", "Resources", name);
					if (fs.existsSync(testPath)) {
						iconPath = testPath;
						break;
					}
				}
			}

			return {
				name: appName,
				path: appPath,
				position: (index + 1).toString(),
				iconPath,
			};
		});
	}
}

module.exports = DockManager;
