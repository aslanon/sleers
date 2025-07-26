import { ref, onMounted } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import { useLayoutSettings } from "~/composables/useLayoutSettings";

export const useProjectManager = () => {
	const playerSettings = usePlayerSettings();
	const { savedLayouts, setLayouts } = useLayoutSettings();

	const currentProjectName = ref("");
	const savedProjects = ref([]);

	// Projeyi kaydet
	const saveProject = async (
		name,
		mediaPlayer,
		videoUrl,
		audioUrl,
		cameraUrl,
		segments,
		mousePositions
	) => {
		try {
			// Benzersiz bir ID oluştur
			const projectId = `project_${Date.now()}_${Math.floor(
				Math.random() * 1000
			)}`;

			// Medya dosya yollarını al
			const electron = window.electron;
			const mediaState = await electron?.ipcRenderer?.invoke("GET_MEDIA_STATE");

			// Dosya yollarını koruma listesine ekle
			const filesToProtect = [];
			if (mediaState?.videoPath) {
				filesToProtect.push(mediaState.videoPath);
			}
			if (
				mediaState?.audioPath &&
				mediaState.audioPath !== mediaState.videoPath
			) {
				filesToProtect.push(mediaState.audioPath);
			}
			if (mediaState?.cameraPath) {
				filesToProtect.push(mediaState.cameraPath);
			}

			// Dosyaları koruma listesine ekle
			for (const filePath of filesToProtect) {
				await electron?.ipcRenderer?.invoke("PROTECT_FILE", filePath);
			}

			// Mevcut ayarları ve durumları al
			const projectData = {
				id: projectId,
				name: name,
				timestamp: new Date().toISOString(),
				// Medya URL'leri
				media: {
					videoUrl,
					audioUrl,
					cameraUrl,
				},
				// Medya dosya yolları
				mediaFiles: {
					videoPath: mediaState?.videoPath || null,
					audioPath: mediaState?.audioPath || null,
					cameraPath: mediaState?.cameraPath || null,
				},
				// Player ayarları
				playerSettings: {
					backgroundColor: playerSettings.backgroundColor.value,
					backgroundImage: playerSettings.backgroundImage.value,
					backgroundBlur: playerSettings.backgroundBlur.value,
					padding: playerSettings.padding.value,
					radius: playerSettings.radius.value,
					shadowSize: playerSettings.shadowSize.value,
					cropRatio: playerSettings.cropRatio.value,
					mouseSize: playerSettings.mouseSize.value,
					motionBlurValue: playerSettings.motionBlurValue.value,
					mouseVisible: playerSettings.mouseVisible.value,
					canvasSize: playerSettings.canvasSize?.value || {
						width: 800,
						height: 600,
					},
					cameraSettings: JSON.parse(
						JSON.stringify(playerSettings.cameraSettings.value || {})
					),
					videoBorderSettings: JSON.parse(
						JSON.stringify(playerSettings.videoBorderSettings.value || {})
					),
					mouseCursorSettings: JSON.parse(
						JSON.stringify(playerSettings.mouseCursorSettings?.value || {})
					),
					zoomRanges: JSON.parse(
						JSON.stringify(playerSettings.zoomRanges.value || [])
					),
					currentZoomRange: playerSettings.currentZoomRange.value
						? JSON.parse(JSON.stringify(playerSettings.currentZoomRange.value))
						: null,
				},
				// Pozisyonlar
				positions: {
					video: mediaPlayer?.getVideoPosition() || { x: 0, y: 0 },
					camera: mediaPlayer?.getCameraPosition() || { x: 0, y: 0 },
				},
				// Timeline segmentleri
				segments: JSON.parse(JSON.stringify(segments || [])),
				// Mouse pozisyonları
				mousePositions: JSON.parse(JSON.stringify(mousePositions || [])),
				// Kaydedilmiş düzenler
				layouts: JSON.parse(JSON.stringify(savedLayouts.value || [])),
				// Korunan dosyalar
				protectedFiles: filesToProtect,
			};

			// Projeyi kaydedilmiş projelere ekle
			const existingIndex = savedProjects.value.findIndex(
				(p) => p.name === name
			);
			if (existingIndex >= 0) {
				// Aynı isimde bir proje varsa güncelle
				savedProjects.value[existingIndex] = projectData;
			} else {
				// Yoksa yeni ekle
				savedProjects.value.push(projectData);
			}

			// localStorage'a kaydet
			try {
				localStorage.setItem(
					"creavit-studio-projects",
					JSON.stringify(savedProjects.value)
				);
			} catch (localStorageError) {
				console.error(
					"Failed to save projects to localStorage:",
					localStorageError
				);
			}

			// Mevcut proje adını güncelle
			currentProjectName.value = name;

			return projectData;
		} catch (error) {
			console.error("Failed to save project:", error);
			throw error;
		}
	};

	// Projeyi yükle
	const loadProject = async (projectId, callbacks) => {
		try {
			// Projeyi ID'ye göre bul
			const project = savedProjects.value.find((p) => p.id === projectId);
			if (!project) {
				console.error("Project not found with ID:", projectId);
				return false;
			}

			// Electron API'sini al
			const electron = window.electron;

			// Korunan dosyaları kontrol et ve gerekirse yeniden koru
			if (project.protectedFiles && Array.isArray(project.protectedFiles)) {
				for (const filePath of project.protectedFiles) {
					if (filePath) {
						await electron?.ipcRenderer?.invoke("PROTECT_FILE", filePath);
					}
				}
			}

			// Player ayarlarını uygula
			if (project.playerSettings) {
				const settings = project.playerSettings;

				// Temel ayarları uygula
				if (settings.backgroundColor !== undefined)
					playerSettings.backgroundColor.value = settings.backgroundColor;

				if (settings.backgroundImage !== undefined)
					playerSettings.backgroundImage.value = settings.backgroundImage;

				if (settings.backgroundBlur !== undefined)
					playerSettings.backgroundBlur.value = settings.backgroundBlur;

				if (settings.padding !== undefined)
					playerSettings.padding.value = settings.padding;

				if (settings.radius !== undefined)
					playerSettings.radius.value = settings.radius;

				if (settings.shadowSize !== undefined)
					playerSettings.shadowSize.value = settings.shadowSize;

				if (settings.cropRatio !== undefined)
					playerSettings.cropRatio.value = settings.cropRatio;

				if (settings.mouseSize !== undefined)
					playerSettings.mouseSize.value = settings.mouseSize;

				if (settings.motionBlurValue !== undefined)
					playerSettings.motionBlurValue.value = settings.motionBlurValue;

				if (settings.mouseVisible !== undefined)
					playerSettings.mouseVisible.value = settings.mouseVisible;

				// Karmaşık ayarları uygula
				if (settings.canvasSize && playerSettings.canvasSize)
					playerSettings.canvasSize.value = settings.canvasSize;

				if (settings.cameraSettings && playerSettings.cameraSettings)
					playerSettings.cameraSettings.value = settings.cameraSettings;

				if (settings.videoBorderSettings && playerSettings.videoBorderSettings)
					playerSettings.videoBorderSettings.value =
						settings.videoBorderSettings;

				if (settings.mouseCursorSettings && playerSettings.mouseCursorSettings)
					playerSettings.mouseCursorSettings.value =
						settings.mouseCursorSettings;

				// Zoom ayarlarını uygula
				if (settings.zoomRanges && playerSettings.zoomRanges) {
					playerSettings.zoomRanges.value = [];
					settings.zoomRanges.forEach((range) => {
						playerSettings.zoomRanges.value.push(range);
					});

					if (settings.currentZoomRange && playerSettings.currentZoomRange) {
						playerSettings.currentZoomRange.value = settings.currentZoomRange;
					}
				}
			}

			// Pozisyonları uygula
			if (project.positions && callbacks.setPositions) {
				if (project.positions.video && callbacks.setPositions.video) {
					callbacks.setPositions.video(project.positions.video);
				}

				if (project.positions.camera && callbacks.setPositions.camera) {
					callbacks.setPositions.camera(project.positions.camera);
				}
			}

			// Segmentleri uygula
			if (project.segments && callbacks.setSegments) {
				callbacks.setSegments(project.segments);
			}

			// Mouse pozisyonlarını uygula
			if (project.mousePositions && callbacks.setMousePositions) {
				callbacks.setMousePositions(project.mousePositions);
			}

			// Medya dosyalarını yükle
			if (project.mediaFiles && callbacks.loadMediaFiles) {
				callbacks.loadMediaFiles(project.mediaFiles);
			} else if (project.media && callbacks.setMedia) {
				// Eski yöntem: URL'leri kullan
				callbacks.setMedia(project.media);
			}

			// Düzenleri uygula
			if (project.layouts && Array.isArray(project.layouts)) {
				if (callbacks.setLayouts) {
					callbacks.setLayouts(project.layouts);
				} else if (setLayouts) {
					setLayouts(project.layouts);
				}
			}

			// Mevcut proje adını güncelle
			currentProjectName.value = project.name;

			return true;
		} catch (error) {
			console.error("Error loading project:", error);
			return false;
		}
	};

	// Projeyi sil
	const deleteProject = async (projectId) => {
		try {
			// Projeyi ID'ye göre bul ve sil
			const projectIndex = savedProjects.value.findIndex(
				(p) => p.id === projectId
			);
			if (projectIndex === -1) {
				console.error("Project not found with ID:", projectId);
				return false;
			}

			// Projeden korunan dosyaları al
			const project = savedProjects.value[projectIndex];
			const protectedFiles = project.protectedFiles || [];

			// Electron API'sini al
			const electron = window.electron;

			// Korunan dosyaları koruma listesinden çıkar
			// Not: Diğer projelerde de kullanılıyor olabilir, bu yüzden dikkatli olmalıyız
			// Önce diğer projelerde kullanılıp kullanılmadığını kontrol edelim
			for (const filePath of protectedFiles) {
				// Bu dosyayı kullanan başka proje var mı?
				const isUsedInOtherProjects = savedProjects.value.some((p, idx) => {
					if (idx === projectIndex) return false; // Kendisini sayma
					return p.protectedFiles && p.protectedFiles.includes(filePath);
				});

				// Başka projede kullanılmıyorsa koruma listesinden çıkar
				if (!isUsedInOtherProjects && filePath) {
					await electron?.ipcRenderer?.invoke("UNPROTECT_FILE", filePath);
				}
			}

			// Projeler listesinden kaldır
			savedProjects.value.splice(projectIndex, 1);

			// localStorage'a kaydet
			try {
				localStorage.setItem(
					"creavit-studio-projects",
					JSON.stringify(savedProjects.value)
				);
			} catch (localStorageError) {
				console.error(
					"Failed to save projects to localStorage:",
					localStorageError
				);
			}

			// Eğer silinen proje mevcut projeyse, mevcut proje adını temizle
			if (currentProjectName.value === project.name) {
				currentProjectName.value = "";
			}

			return true;
		} catch (error) {
			console.error("Error deleting project:", error);
			return false;
		}
	};

	// Projeyi yeniden adlandır
	const renameProject = async (projectId, newName) => {
		try {
			// Projeyi ID'ye göre bul
			const project = savedProjects.value.find((p) => p.id === projectId);
			if (!project) {
				console.error("Project not found with ID:", projectId);
				return false;
			}

			// Eski adı kaydet
			const oldName = project.name;

			// Adı güncelle
			project.name = newName;

			// localStorage'a kaydet
			try {
				localStorage.setItem(
					"creavit-studio-projects",
					JSON.stringify(savedProjects.value)
				);
			} catch (localStorageError) {
				console.error(
					"Failed to save projects to localStorage:",
					localStorageError
				);
			}

			// Eğer yeniden adlandırılan proje mevcut projeyse, mevcut proje adını güncelle
			if (currentProjectName.value === oldName) {
				currentProjectName.value = newName;
			}

			return true;
		} catch (error) {
			console.error("Error renaming project:", error);
			return false;
		}
	};

	// Kaydedilmiş projeleri yükle
	const loadSavedProjects = () => {
		try {
			const projectsJson = localStorage.getItem("creavit-studio-projects");
			if (projectsJson) {
				const parsedProjects = JSON.parse(projectsJson);
				if (Array.isArray(parsedProjects)) {
					savedProjects.value = parsedProjects;

					// Korunan dosyaları yeniden koruma listesine ekle
					const electron = window.electron;
					if (electron?.ipcRenderer) {
						// Her projedeki korunan dosyaları işle
						savedProjects.value.forEach((project) => {
							if (
								project.protectedFiles &&
								Array.isArray(project.protectedFiles)
							) {
								project.protectedFiles.forEach((filePath) => {
									if (filePath) {
										electron.ipcRenderer
											.invoke("PROTECT_FILE", filePath)
											.then(() => {})
											.catch((err) =>
												console.error(
													"Dosya koruma listesine eklenirken hata:",
													err
												)
											);
									}
								});
							}
						});
					}
				}
			}
		} catch (error) {
			console.error("Error loading saved projects:", error);
		}
	};

	// Component mount olduğunda projeleri yükle
	onMounted(() => {
		loadSavedProjects();
	});

	return {
		currentProjectName,
		savedProjects,
		saveProject,
		loadProject,
		deleteProject,
		renameProject,
		loadSavedProjects,
	};
};
