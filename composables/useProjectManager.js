import { ref, onMounted } from "vue";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import { useLayoutSettings } from "~/composables/useLayoutSettings";

export const useProjectManager = () => {
	const playerSettings = usePlayerSettings();
	const { savedLayouts } = useLayoutSettings();

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
			console.log("Saving project with name:", name);

			// Benzersiz bir ID oluştur
			const projectId = `project_${Date.now()}_${Math.floor(
				Math.random() * 1000
			)}`;

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
					"sleer-projects",
					JSON.stringify(savedProjects.value)
				);
				console.log("Projects saved to localStorage");
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
			console.log("Loading project with ID:", projectId);

			// Projeyi ID'ye göre bul
			const project = savedProjects.value.find((p) => p.id === projectId);
			if (!project) {
				console.error("Project not found with ID:", projectId);
				return false;
			}

			console.log("Found project:", project.name);

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

			// Medya URL'lerini uygula
			if (project.media && callbacks.setMedia) {
				callbacks.setMedia(project.media);
			}

			// Düzenleri uygula
			if (project.layouts && callbacks.setLayouts) {
				callbacks.setLayouts(project.layouts);
			}

			// Mevcut proje adını güncelle
			currentProjectName.value = project.name;

			console.log(`Project "${project.name}" loaded successfully`);
			return true;
		} catch (error) {
			console.error("Error loading project:", error);
			return false;
		}
	};

	// Projeyi sil
	const deleteProject = async (projectId) => {
		try {
			console.log("Deleting project with ID:", projectId);

			// Projeyi ID'ye göre bul ve sil
			const projectIndex = savedProjects.value.findIndex(
				(p) => p.id === projectId
			);
			if (projectIndex === -1) {
				console.error("Project not found with ID:", projectId);
				return false;
			}

			// Projeler listesinden kaldır
			savedProjects.value.splice(projectIndex, 1);

			// localStorage'a kaydet
			try {
				localStorage.setItem(
					"sleer-projects",
					JSON.stringify(savedProjects.value)
				);
				console.log("Projects saved to localStorage after deletion");
			} catch (localStorageError) {
				console.error(
					"Failed to save projects to localStorage:",
					localStorageError
				);
			}

			// Eğer silinen proje mevcut projeyse, mevcut proje adını temizle
			if (
				currentProjectName.value === savedProjects.value[projectIndex]?.name
			) {
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
			console.log("Renaming project with ID:", projectId, "to:", newName);

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
					"sleer-projects",
					JSON.stringify(savedProjects.value)
				);
				console.log("Projects saved to localStorage after rename");
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
			const projectsJson = localStorage.getItem("sleer-projects");
			if (projectsJson) {
				const parsedProjects = JSON.parse(projectsJson);
				if (Array.isArray(parsedProjects)) {
					savedProjects.value = parsedProjects;
					console.log(
						"Loaded saved projects from localStorage:",
						savedProjects.value.length
					);
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
