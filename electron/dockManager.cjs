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
		this.tempDir = path.join(os.tmpdir(), "creavit-studio-dock-icons");

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
			// Özel olarak Finder ikonunu ekle
			let items = await this._getDockAppsFromDefaults();

			// Dock item'larında Finder var mı kontrol et
			const hasFinderApp = items.some(
				(item) =>
					item.name === "Finder" ||
					(item.path &&
						(item.path.includes("/System/Applications/Finder.app") ||
							item.path.includes("/Applications/Finder.app")))
			);

			// Dock item'larında Trash var mı kontrol et
			const hasTrashApp = items.some(
				(item) =>
					item.name === "Trash" || (item.path && item.path.includes("/.Trash"))
			);

			// Finder yoksa ekle
			if (!hasFinderApp) {
				console.log("[DockManager] Adding Finder to dock items");
				const finderPath = "/System/Applications/Finder.app";
				const alternativeFinderPath = "/Applications/Finder.app";

				// Finder uygulamasının yolunu kontrol et
				let finderAppPath = "";
				if (fs.existsSync(finderPath)) {
					finderAppPath = finderPath;
				} else if (fs.existsSync(alternativeFinderPath)) {
					finderAppPath = alternativeFinderPath;
				}

				if (finderAppPath) {
					items.unshift({
						name: "Finder",
						path: finderAppPath,
						position: "0",
						iconPath: path.join(
							finderAppPath,
							"Contents",
							"Resources",
							"icon.icns"
						),
					});
				}
			}

			// Trash yoksa ekle
			if (!hasTrashApp) {
				console.log("[DockManager] Adding Trash to dock items");

				// Trash'in sistem yolu
				const trashPath = path.join(os.homedir(), ".Trash");

				items.push({
					name: "Trash",
					path: trashPath,
					position: "999", // Yüksek değer vererek sona koyuyoruz
					iconPath:
						"/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/TrashIcon.icns",
				});
			}

			// App ikonlarını çıkart
			const itemsWithIcons = await Promise.all(
				items.map(async (item) => {
					// Özel olarak Finder için işlem yap
					if (item.name === "Finder") {
						try {
							const finderIcon = await this._extractFinderIcon(item.path);
							if (finderIcon) {
								return {
									...item,
									iconDataUrl: finderIcon,
								};
							}
						} catch (error) {
							console.error(
								"[DockManager] Error extracting Finder icon:",
								error
							);
						}
					}

					// Özel olarak Trash için işlem yap
					if (item.name === "Trash") {
						try {
							const trashIcon = await this._extractTrashIcon();
							if (trashIcon) {
								return {
									...item,
									iconDataUrl: trashIcon,
								};
							}
						} catch (error) {
							console.error(
								"[DockManager] Error extracting Trash icon:",
								error
							);
						}
					}

					// Diğer uygulamalar için normal süreci izle
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

	/**
	 * Özel olarak Finder uygulamasının ikonunu çıkart
	 * @param {string} finderPath - Finder uygulamasının yolu
	 * @returns {Promise<string>} İkon data URL'i
	 */
	async _extractFinderIcon(finderPath) {
		try {
			console.log("[DockManager] Extracting Finder icon");

			// Finder ikonunun standart yolu
			const finderIconPath = path.join(
				finderPath,
				"Contents",
				"Resources",
				"icon.icns"
			);
			const tempIconPath = path.join(this.tempDir, "finder_icon.png");

			// Finder ikonu varsa dönüştür
			if (fs.existsSync(finderIconPath)) {
				console.log(`[DockManager] Found Finder icon at ${finderIconPath}`);

				try {
					// Icns dosyasını PNG'ye çevir
					const sipsCmd = `sips -s format png "${finderIconPath}" --out "${tempIconPath}" 2>/dev/null`;
					execSync(sipsCmd, { stdio: "pipe" });

					if (
						fs.existsSync(tempIconPath) &&
						fs.statSync(tempIconPath).size > 0
					) {
						console.log("[DockManager] Successfully converted Finder icon");
						const iconData = fs.readFileSync(tempIconPath);
						const base64 = iconData.toString("base64");
						try {
							fs.unlinkSync(tempIconPath);
						} catch (e) {}
						return `data:image/png;base64,${base64}`;
					}
				} catch (error) {
					console.error("[DockManager] Error converting Finder icon:", error);
				}
			}

			// Alternatif yöntem: Finder.app içinde diğer icon dosyalarını ara
			const resourcesPath = path.join(finderPath, "Contents", "Resources");
			if (fs.existsSync(resourcesPath)) {
				const files = fs.readdirSync(resourcesPath);
				const icnsFiles = files.filter((file) => file.endsWith(".icns"));

				for (const icnsFile of icnsFiles) {
					try {
						const icnsPath = path.join(resourcesPath, icnsFile);
						console.log(
							`[DockManager] Trying alternative Finder icon: ${icnsPath}`
						);

						const sipsCmd = `sips -s format png "${icnsPath}" --out "${tempIconPath}" 2>/dev/null`;
						execSync(sipsCmd, { stdio: "pipe" });

						if (
							fs.existsSync(tempIconPath) &&
							fs.statSync(tempIconPath).size > 0
						) {
							const iconData = fs.readFileSync(tempIconPath);
							const base64 = iconData.toString("base64");
							try {
								fs.unlinkSync(tempIconPath);
							} catch (e) {}
							return `data:image/png;base64,${base64}`;
						}
					} catch (error) {
						console.log(`[DockManager] Failed to convert ${icnsFile}`);
					}
				}
			}

			// Son çare: AppleScript yöntemi
			return this._extractAppIcon(finderPath, "Finder");
		} catch (error) {
			console.error("[DockManager] Error in Finder icon extraction:", error);
			return null;
		}
	}

	/**
	 * Özel olarak Trash ikonunu çıkart
	 * @returns {Promise<string>} İkon data URL'i
	 */
	async _extractTrashIcon() {
		try {
			console.log("[DockManager] Extracting Trash icon");

			// Trash ikonunun olası yolları
			const possibleTrashIconPaths = [
				"/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/TrashIcon.icns",
				"/System/Library/CoreServices/Dock.app/Contents/Resources/trashempty.png",
				"/System/Library/CoreServices/Dock.app/Contents/Resources/trashfull.png",
				"/System/Library/PrivateFrameworks/Dock.framework/Versions/A/Resources/trashempty.png",
				"/System/Library/PrivateFrameworks/Dock.framework/Versions/A/Resources/trashfull.png",
			];

			const tempIconPath = path.join(this.tempDir, "trash_icon.png");

			// Her olası yolu dene
			for (const iconPath of possibleTrashIconPaths) {
				if (fs.existsSync(iconPath)) {
					console.log(`[DockManager] Found Trash icon at ${iconPath}`);

					try {
						// Icon formatına göre uygun komutu belirle
						let conversionCmd;
						if (iconPath.endsWith(".icns")) {
							conversionCmd = `sips -s format png "${iconPath}" --out "${tempIconPath}" 2>/dev/null`;
						} else if (iconPath.endsWith(".png")) {
							// Doğrudan kopyala
							fs.copyFileSync(iconPath, tempIconPath);
							conversionCmd = null;
						}

						// Dönüştürme komutu varsa çalıştır
						if (conversionCmd) {
							execSync(conversionCmd, { stdio: "pipe" });
						}

						if (
							fs.existsSync(tempIconPath) &&
							fs.statSync(tempIconPath).size > 0
						) {
							console.log("[DockManager] Successfully converted Trash icon");
							const iconData = fs.readFileSync(tempIconPath);
							const base64 = iconData.toString("base64");
							try {
								fs.unlinkSync(tempIconPath);
							} catch (e) {}
							return `data:image/png;base64,${base64}`;
						}
					} catch (error) {
						console.error("[DockManager] Error converting Trash icon:", error);
					}
				}
			}

			// Alternatif yöntem: AppleScript kullanarak Trash ikonunu al
			try {
				console.log("[DockManager] Trying AppleScript method for Trash icon");
				const trashPath = path.join(os.homedir(), ".Trash");

				const iconScript = `
				tell application "Finder"
					set thePath to "${tempIconPath}"
					tell application "System Events"
						set srcFile to disk item (POSIX path of "${trashPath}")
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
					"trash_icon_script.applescript"
				);
				fs.writeFileSync(tempScriptPath, iconScript);

				execSync(`osascript "${tempScriptPath}"`, { stdio: "pipe" });
				try {
					fs.unlinkSync(tempScriptPath);
				} catch (e) {}

				if (fs.existsSync(tempIconPath) && fs.statSync(tempIconPath).size > 0) {
					console.log(
						"[DockManager] Successfully extracted Trash icon with AppleScript"
					);
					const iconData = fs.readFileSync(tempIconPath);
					const base64 = iconData.toString("base64");
					try {
						fs.unlinkSync(tempIconPath);
					} catch (e) {}
					return `data:image/png;base64,${base64}`;
				}
			} catch (error) {
				console.error(
					"[DockManager] AppleScript method failed for Trash icon:",
					error
				);
			}

			// Son çare: Transparan SVG trash ikonu oluştur
			console.log("[DockManager] Creating transparent SVG Trash icon");
			const svgTemplate = `
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="512" height="512">
				<path fill="#5a5a5a" d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/>
			</svg>
			`;
			fs.writeFileSync(tempIconPath + ".svg", svgTemplate);

			// SVG'yi PNG'ye çevir (transparanlığı koru)
			execSync(
				`sips -s format png "${tempIconPath}.svg" --out "${tempIconPath}" 2>/dev/null`,
				{ stdio: "pipe" }
			);
			try {
				fs.unlinkSync(tempIconPath + ".svg");
			} catch (e) {}

			if (fs.existsSync(tempIconPath) && fs.statSync(tempIconPath).size > 0) {
				const iconData = fs.readFileSync(tempIconPath);
				const base64 = iconData.toString("base64");
				try {
					fs.unlinkSync(tempIconPath);
				} catch (e) {}
				return `data:image/png;base64,${base64}`;
			}

			console.warn("[DockManager] Could not create any Trash icon");
			return null;
		} catch (error) {
			console.error("[DockManager] Error in Trash icon extraction:", error);
			return null;
		}
	}
}

module.exports = DockManager;
