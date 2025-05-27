const { BrowserWindow, screen } = require("electron");
const path = require("path");
const isDev = process.env.NODE_ENV === "development";
const fs = require("fs");
const { IPC_EVENTS } = require("./constants.cjs");

class EditorManager {
	constructor(mainWindow) {
		this.mainWindow = mainWindow;
		this.editorWindow = null;
		this.isOpen = false;
	}

	async createEditorWindow() {
		try {
			console.log("[EditorManager] Editör penceresi oluşturuluyor...");

			// Eğer halihazırda bir editör penceresi açıksa, onu kapatalım
			if (this.editorWindow && !this.editorWindow.isDestroyed()) {
				console.log(
					"[EditorManager] Halihazırda bir editör penceresi var, kapatılıyor..."
				);
				this.editorWindow.close();
			}

			// Yeni bir editör penceresi oluştur
			const { width, height } = screen.getPrimaryDisplay().workAreaSize;
			this.editorWindow = new BrowserWindow({
				width: Math.min(1600, width - 100),
				height: Math.min(900, height - 100),
				minWidth: 1000,
				minHeight: 600,
				show: false,
				frame: false,
				webPreferences: {
					nodeIntegration: true,
					contextIsolation: true,
					webSecurity: false,
					allowRunningInsecureContent: true,
					preload: path.join(__dirname, "preload.cjs"),
				},
				icon: path.join(__dirname, "../build/icon.png"),
				title: "Sleer - Video Editor",
				backgroundColor: "#121212",
				titleBarOverlay: false,
				titleBarStyle: "hidden",
				trafficLightPosition: { x: 15, y: 20 },
				hasShadow: true,
				roundedCorners: true,
				visualEffectState: "active",
				movable: true,
			});

			// Editör sayfasını yükle
			const isDev = process.env.NODE_ENV === "development";

			try {
				if (isDev) {
					// Geliştirme modunda Nuxt sunucusundan yükle
					await this.editorWindow.loadURL(
						`http://127.0.0.1:${global.serverPort}/editor`
					);
					this.editorWindow.webContents.openDevTools({ mode: "detach" });
				} else {
					// Express sunucusu kullanıldığında
					const serverPort = global.serverPort || 3030; // Global değişkenden portu al

					// Ana sayfa ile yükle, hash zaten kaldırıldı
					const serverBaseUrl = `http://localhost:${serverPort}`;

					console.log(
						`[EditorManager] Editör sayfası yükleniyor: ${serverBaseUrl}/editor`
					);
					try {
						await this.editorWindow.loadURL(`${serverBaseUrl}/editor`);
						console.log("[EditorManager] Editör sayfası başarıyla yüklendi");
					} catch (urlError) {
						console.error("[EditorManager] URL yükleme hatası:", urlError);

						// Alternatif olarak index.html'i yükle
						const indexPath = path.join(
							__dirname,
							"../.output/public/index.html"
						);
						if (fs.existsSync(indexPath)) {
							console.log(`[EditorManager] Dosyadan yükleniyor: ${indexPath}`);
							await this.editorWindow.loadFile(indexPath);

							// JavaScript ile editör sayfasına yönlendir
							await this.editorWindow.webContents.executeJavaScript(`
								console.log("Editor sayfasına manuel yönlendirme yapılıyor");
								// URL kontrolü
								if (window.location.pathname !== '/editor') {
									window.location.href = '/editor';
								}
							`);
						} else {
							// Hiçbir şey işe yaramazsa, basit bir fallback içeriği yükle
							console.log("[EditorManager] Fallback içerik oluşturuluyor");
							const htmlContent = `
								<!DOCTYPE html>
								<html>
								<head>
									<meta charset="utf-8">
									<title>Sleer - Video Editor</title>
									<style>
										body {
											font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
											background-color: #121212;
											color: white;
											margin: 0;
											padding: 0;
											display: flex;
											flex-direction: column;
											align-items: center;
											justify-content: center;
											height: 100vh;
											text-align: center;
										}
										h1 { margin-bottom: 1rem; }
										p { margin-bottom: 2rem; max-width: 600px; }
										.btn {
											background: #3366ff;
											color: white;
											border: none;
											padding: 10px 20px;
											border-radius: 4px;
											cursor: pointer;
											font-size: 16px;
										}
										.btn:hover { background: #2952cc; }
									</style>
								</head>
								<body>
									<h1>Sleer Video Düzenleyici</h1>
									<p>Düzenleyici yüklenirken bir sorun oluştu. Lütfen kaydedilmiş videoyu kullanarak devam edin.</p>
									<button class="btn" id="closeBtn">Pencereyi Kapat</button>
									<script>
										document.getElementById('closeBtn').addEventListener('click', () => {
											if (window.electronAPI) {
												window.electronAPI.sendToMain('CLOSE_EDITOR_WINDOW');
											}
										});
									</script>
								</body>
								</html>
							`;
							await this.editorWindow.loadURL(
								`data:text/html;charset=utf-8,${encodeURIComponent(
									htmlContent
								)}`
							);
						}
					}
				}

				// Her durumda pencereyi göster - yani content hatasına rağmen pencere açılacak
				this.editorWindow.once("ready-to-show", () => {
					if (this.editorWindow && !this.editorWindow.isDestroyed()) {
						this.editorWindow.show();
						console.log(
							"[EditorManager] Editör penceresi gösteriliyor (ready-to-show)"
						);
					}
				});

				// Güvenlik için 1 saniye sonra da kontrol et
				setTimeout(() => {
					if (
						this.editorWindow &&
						!this.editorWindow.isDestroyed() &&
						!this.editorWindow.isVisible()
					) {
						this.editorWindow.show();
						console.log(
							"[EditorManager] Editör penceresi gösteriliyor (timeout)"
						);
					}
				}, 1000);

				this.setupWindowEvents();
				this.isOpen = true;

				// Ana pencereyi event'ı gönder - hata oluşan yer burasıydı
				if (this.mainWindow && !this.mainWindow.isDestroyed()) {
					try {
						// Sabit kanal adı kullan (IPC_EVENTS constant'ı kullanmak yerine)
						this.mainWindow.webContents.send("EDITOR_STATUS_CHANGED", {
							isOpen: true,
						});
						console.log(
							"[EditorManager] Ana pencereye EDITOR_STATUS_CHANGED eventi gönderildi"
						);
					} catch (error) {
						console.error(
							"[EditorManager] IPC mesajı gönderilirken hata:",
							error
						);
					}
				}

				return true;
			} catch (loadError) {
				console.error(
					"[EditorManager] Editör sayfası yükleme hatası:",
					loadError
				);

				// Daha önce eklediğimiz alternatif yükleme kısmı yerine,
				// basit bir hata görünümü yükleme ekleyelim
				try {
					// Basit hata sayfası
					console.log("[EditorManager] Basit hata sayfası yükleniyor");
					const errorHtml = `
						<!DOCTYPE html>
						<html>
						<head>
							<meta charset="utf-8">
							<title>Sleer - Video Editor</title>
							<style>
								body {
									font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
									background-color: #121212;
									color: white;
									margin: 0;
									padding: 20px;
									display: flex;
									flex-direction: column;
									align-items: center;
									justify-content: center;
									height: 100vh;
									text-align: center;
								}
								h1 { color: #ff5555; margin-bottom: 10px; }
								p { margin-bottom: 20px; max-width: 600px; }
								button {
									background: #3366ff;
									color: white;
									border: none;
									padding: 10px 20px;
									border-radius: 4px;
									cursor: pointer;
								}
							</style>
						</head>
						<body>
							<h1>Düzenleyici Yüklenemedi</h1>
							<p>Düzenleyici açılırken bir sorun oluştu. Lütfen uygulamayı yeniden başlatın.</p>
							<button id="closeBtn">Pencereyi Kapat</button>
							<script>
								document.getElementById('closeBtn').addEventListener('click', () => {
									if (window.electronAPI && window.electronAPI.sendToMain) {
										window.electronAPI.sendToMain('CLOSE_EDITOR_WINDOW');
									}
								});
							</script>
						</body>
						</html>
					`;

					if (this.editorWindow && !this.editorWindow.isDestroyed()) {
						await this.editorWindow.loadURL(
							`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`
						);
						this.editorWindow.show();
						console.log("[EditorManager] Hata sayfası gösteriliyor");
					}
					return false;
				} catch (alternativeLoadError) {
					console.error(
						"[EditorManager] Alternatif yükleme de başarısız:",
						alternativeLoadError
					);
					if (this.editorWindow && !this.editorWindow.isDestroyed()) {
						this.editorWindow.close();
						this.editorWindow = null;
					}
					this.isOpen = false;
					return false;
				}
			}
		} catch (error) {
			console.error(
				"[EditorManager] Editör penceresi oluşturma hatası:",
				error
			);
			this.isOpen = false;
			return false;
		}
	}

	showEditorWindow() {
		if (!this.editorWindow || this.editorWindow.isDestroyed()) {
			this.createEditorWindow();
		} else {
			this.editorWindow.show();
		}
	}

	hideEditorWindow() {
		if (this.editorWindow && !this.editorWindow.isDestroyed()) {
			this.editorWindow.hide();
			if (this.mainWindow && !this.mainWindow.isDestroyed()) {
				if (isDev) {
					this.mainWindow.loadURL(`http://127.0.0.1:${global.serverPort}`);
				} else {
					this.mainWindow.loadFile(
						path.join(__dirname, "../.output/public/index.html")
					);
				}
				this.mainWindow.once("ready-to-show", () => {
					this.mainWindow.show();
				});
			}
		}
	}

	closeEditorWindow() {
		if (this.editorWindow && !this.editorWindow.isDestroyed()) {
			this.editorWindow.destroy();
			this.editorWindow = null;

			// EDITOR_CLOSED eventini gönder
			const { ipcMain } = require("electron");
			ipcMain.emit(IPC_EVENTS.EDITOR_CLOSED);

			console.log(
				"[editorManager.cjs] Editor penceresi kapatıldı, EDITOR_CLOSED eventi gönderildi"
			);
		}
	}

	handleEditorStatusUpdate(statusData) {
		console.log("[editorManager.cjs] Editor durumu güncelleniyor:", statusData);
		if (this.mainWindow && !this.mainWindow.isDestroyed()) {
			this.mainWindow.webContents.send("EDITOR_STATUS_CHANGED", statusData);
			console.log("[editorManager.cjs] Ana pencere bilgilendirildi");
		}
	}

	startEditing(videoData) {
		if (this.editorWindow && !this.editorWindow.isDestroyed()) {
			this.editorWindow.webContents.send("START_EDITING", videoData);
			console.log("[editorManager.cjs] Düzenleme başlatıldı:", videoData);
		}
	}

	cleanup() {
		this.closeEditorWindow();
	}

	getEditorWindow() {
		return this.editorWindow;
	}

	setupWindowEvents() {
		// Yükleme tamamlandığında pencereyi göster
		this.editorWindow.webContents.once("did-finish-load", () => {
			console.log("[editorManager.cjs] Editor sayfası yükleme tamamlandı");

			if (this.mainWindow && !this.mainWindow.isDestroyed()) {
				this.mainWindow.hide();
			}

			// MEDIA_READY eventini gönder
			if (this.editorWindow && !this.editorWindow.isDestroyed()) {
				// Sabit kanal adı kullan
				this.editorWindow.webContents.send("MEDIA_READY");
				console.log("[editorManager.cjs] MEDIA_READY eventi gönderildi");
			}
		});

		// Kapatıldığında temizlik yap
		this.editorWindow.on("closed", () => {
			console.log("[editorManager.cjs] Editor penceresi kapatıldı");
			this.editorWindow = null;
			this.isOpen = false;

			// EDITOR_CLOSED eventini gönder
			const { ipcMain } = require("electron");
			ipcMain.emit("EDITOR_CLOSED");

			// Ana pencereyi göster
			if (this.mainWindow && !this.mainWindow.isDestroyed()) {
				this.mainWindow.show();
			}
		});

		// Editor penceresi içinde olup bitenleri dinleyen event handler'ları
		const { ipcMain } = require("electron");

		// İşleme durumu güncellemeleri
		ipcMain.on("PROCESSING_COMPLETE", (event, result) => {
			if (this.mainWindow && !this.mainWindow.isDestroyed()) {
				this.mainWindow.webContents.send("PROCESSING_COMPLETE", result);
				console.log(
					"[editorManager.cjs] İşleme tamamlandı bilgisi ana pencereye iletildi"
				);
			}
		});

		// Medya dosya yolları ile ilgili güncellemeler
		ipcMain.on("MEDIA_PATHS", (event, paths) => {
			if (this.mainWindow && !this.mainWindow.isDestroyed()) {
				this.mainWindow.webContents.send("MEDIA_PATHS", paths);
				console.log(
					"[editorManager.cjs] Medya dosya yolları ana pencereye iletildi"
				);
			}
		});

		// Birleştirme durumu
		ipcMain.on("MERGE_STATUS", (event, status) => {
			if (this.mainWindow && !this.mainWindow.isDestroyed()) {
				this.mainWindow.webContents.send("MERGE_STATUS", status);
				console.log(
					"[editorManager.cjs] Birleştirme durumu ana pencereye iletildi"
				);
			}
		});
	}
}

module.exports = EditorManager;
