const { app, dialog } = require("electron");
const fs = require("fs");
const path = require("path");

class ProjectManager {
	constructor(mainWindow) {
		this.mainWindow = mainWindow;
		this.currentProject = null;
		this.recentProjects = this.loadRecentProjects();
	}

	// Yeni proje oluştur
	async createProject() {
		const result = await dialog.showSaveDialog({
			title: "Yeni Proje Oluştur",
			defaultPath: path.join(app.getPath("documents"), "Yeni Proje.sleer"),
			filters: [{ name: "Sleer Projesi", extensions: ["sleer"] }],
		});

		if (!result.canceled) {
			const projectData = {
				name: path.basename(result.filePath, ".sleer"),
				created: new Date().toISOString(),
				modified: new Date().toISOString(),
				videoPath: null,
				audioPath: null,
				segments: [],
				settings: {
					volume: 1.0,
					playbackSpeed: 1.0,
				},
			};

			await this.saveProject(result.filePath, projectData);
			this.addToRecentProjects({
				name: projectData.name,
				path: result.filePath,
			});
			return projectData;
		}
	}

	// Projeyi aç
	async openProject(filePath) {
		try {
			const data = await fs.promises.readFile(filePath, "utf8");
			const projectData = JSON.parse(data);

			// Dosya yollarını mutlak yola çevir
			if (projectData.videoPath) {
				projectData.videoPath = path.resolve(
					path.dirname(filePath),
					projectData.videoPath
				);
			}
			if (projectData.audioPath) {
				projectData.audioPath = path.resolve(
					path.dirname(filePath),
					projectData.audioPath
				);
			}

			this.currentProject = {
				path: filePath,
				...projectData,
			};

			this.addToRecentProjects({
				name: projectData.name,
				path: filePath,
			});

			return projectData;
		} catch (error) {
			console.error("Proje açma hatası:", error);
			throw error;
		}
	}

	// Projeyi kaydet
	async saveProject(filePath, projectData) {
		try {
			// Dosya yollarını göreceli yola çevir
			const projectDir = path.dirname(filePath);
			const relativeData = { ...projectData };

			if (projectData.videoPath) {
				relativeData.videoPath = path.relative(
					projectDir,
					projectData.videoPath
				);
			}
			if (projectData.audioPath) {
				relativeData.audioPath = path.relative(
					projectDir,
					projectData.audioPath
				);
			}

			await fs.promises.writeFile(
				filePath,
				JSON.stringify(relativeData, null, 2),
				"utf8"
			);

			this.currentProject = {
				path: filePath,
				...projectData,
			};
		} catch (error) {
			console.error("Proje kaydetme hatası:", error);
			throw error;
		}
	}

	// Son projeleri yükle
	loadRecentProjects() {
		try {
			const recentProjectsPath = path.join(
				app.getPath("userData"),
				"recentProjects.json"
			);
			if (fs.existsSync(recentProjectsPath)) {
				const data = fs.readFileSync(recentProjectsPath, "utf8");
				return JSON.parse(data);
			}
		} catch (error) {
			console.error("Son projeler yüklenirken hata:", error);
		}
		return [];
	}

	// Son projelere ekle
	addToRecentProjects(project) {
		this.recentProjects = [
			project,
			...this.recentProjects.filter((p) => p.path !== project.path),
		].slice(0, 10); // Son 10 projeyi tut

		try {
			const recentProjectsPath = path.join(
				app.getPath("userData"),
				"recentProjects.json"
			);
			fs.writeFileSync(
				recentProjectsPath,
				JSON.stringify(this.recentProjects, null, 2)
			);
		} catch (error) {
			console.error("Son projeler kaydedilirken hata:", error);
		}

		// Tray menüsünü güncelle
		if (this.mainWindow) {
			this.mainWindow.webContents.send(
				"UPDATE_RECENT_PROJECTS",
				this.recentProjects
			);
		}
	}

	// Geçerli projeyi al
	getCurrentProject() {
		return this.currentProject;
	}

	// Son projeleri al
	getRecentProjects() {
		return this.recentProjects;
	}
}

module.exports = ProjectManager;
