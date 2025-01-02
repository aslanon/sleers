<template>
	<div class="editor-container">
		<!-- Yükleme ekranı -->
		<div v-if="isProcessing" class="loading-overlay">
			<div class="loading-content">
				<div class="spinner"></div>
				<div class="loading-text">
					Video İşleniyor... {{ processingProgress }}%
				</div>
			</div>
		</div>

		<div class="toolbar">
			<button @click="saveProject" :disabled="isSaving || isProcessing">
				{{ isSaving ? "Kaydediliyor..." : "Projeyi Kaydet" }}
			</button>
			<button @click="exportVideo" :disabled="isExporting || isProcessing">
				{{ isExporting ? "Dışa Aktarılıyor..." : "Dışa Aktar" }}
			</button>
		</div>

		<div class="media-player">
			<video ref="videoPlayer" controls>
				<source :src="videoSrc" type="video/webm" />
			</video>
		</div>

		<div class="timeline">
			<TimelineComponent
				:duration="videoDuration"
				:segments="segments"
				@segmentUpdated="handleSegmentUpdate"
			/>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import TimelineComponent from "./TimelineComponent.vue";

const props = defineProps({
	videoPath: String,
	audioPath: String,
	systemAudioPath: String,
});

const emit = defineEmits(["saved", "exported", "error"]);

const videoPlayer = ref(null);
const videoSrc = ref("");
const videoDuration = ref(0);
const segments = ref([]);
const isSaving = ref(false);
const isExporting = ref(false);
const isProcessing = ref(true);
const processingProgress = ref(0);

// Video işleme durumunu kontrol et
const checkProcessingStatus = async () => {
	try {
		const status = await window.electron.recording.checkProcessingStatus();
		isProcessing.value = status.isProcessing;
		processingProgress.value = status.progress;

		if (status.error) {
			emit("error", status.error);
			return;
		}

		if (status.isProcessing) {
			// Her 500ms'de bir durumu kontrol et
			setTimeout(checkProcessingStatus, 500);
		}
	} catch (error) {
		console.error(
			"[editor.vue] Video işleme durumu kontrol edilirken hata:",
			error
		);
		emit("error", error.message);
	}
};

// Proje verilerini yükle
const loadProjectData = (data) => {
	if (data.segments) {
		segments.value = data.segments;
	}
	if (data.videoPath) {
		videoSrc.value = `file://${data.videoPath}`;
	}
};

// Video yüklendiğinde
const handleVideoLoaded = () => {
	if (videoPlayer.value) {
		videoDuration.value = videoPlayer.value.duration;
	}
};

// Segment güncellendiğinde
const handleSegmentUpdate = (updatedSegments) => {
	segments.value = updatedSegments;
};

const saveProject = async () => {
	try {
		isSaving.value = true;
		const projectData = {
			videoPath: props.videoPath,
			audioPath: props.audioPath,
			systemAudioPath: props.systemAudioPath,
			segments: segments.value,
		};

		await window.electron.project.save(projectData);
		emit("saved");
	} catch (error) {
		console.error("Proje kaydedilirken hata:", error);
		emit("error", error.message);
	} finally {
		isSaving.value = false;
	}
};

const exportVideo = async () => {
	try {
		isExporting.value = true;
		const exportData = {
			videoPath: props.videoPath,
			audioPath: props.audioPath,
			systemAudioPath: props.systemAudioPath,
			segments: segments.value,
		};

		const outputPath = await window.electron.project.export(exportData);
		if (outputPath) {
			emit("exported", outputPath);
		}
	} catch (error) {
		console.error("Video dışa aktarılırken hata:", error);
		emit("error", error.message);
	} finally {
		isExporting.value = false;
	}
};

// Props değiştiğinde video kaynağını güncelle
watch(
	() => props.videoPath,
	(newPath) => {
		if (newPath) {
			videoSrc.value = `file://${newPath}`;
		}
	}
);

onMounted(async () => {
	// Video işleme durumunu kontrol etmeye başla
	checkProcessingStatus();

	// Video yüklendiğinde süreyi al
	if (videoPlayer.value) {
		videoPlayer.value.addEventListener("loadedmetadata", handleVideoLoaded);
	}

	try {
		// Media yollarını al
		const paths = await window.electron.recording.getMediaPaths();
		if (paths.videoPath) {
			videoSrc.value = `file://${paths.videoPath}`;
		}
	} catch (error) {
		console.error("Media yolları alınırken hata:", error);
		emit("error", error.message);
	}

	// Proje verilerini dinle
	window.electron.ipcRenderer.on("PROJECT_DATA", (data) => {
		loadProjectData(data);
	});
});
</script>

<style scoped>
.editor-container {
	display: flex;
	flex-direction: column;
	height: 100vh;
	padding: 20px;
	background-color: #1e1e1e;
	color: white;
	position: relative;
}

.loading-overlay {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-color: rgba(0, 0, 0, 0.8);
	display: flex;
	justify-content: center;
	align-items: center;
	z-index: 1000;
}

.loading-content {
	text-align: center;
}

.spinner {
	width: 50px;
	height: 50px;
	border: 5px solid #f3f3f3;
	border-top: 5px solid #4caf50;
	border-radius: 50%;
	animation: spin 1s linear infinite;
	margin: 0 auto 20px;
}

@keyframes spin {
	0% {
		transform: rotate(0deg);
	}
	100% {
		transform: rotate(360deg);
	}
}

.loading-text {
	color: white;
	font-size: 18px;
}

.toolbar {
	display: flex;
	gap: 10px;
	padding: 10px;
	background-color: #2d2d2d;
	border-radius: 4px;
}

.media-player {
	flex: 1;
	margin: 20px 0;
	display: flex;
	justify-content: center;
	align-items: center;
}

video {
	max-width: 100%;
	max-height: 70vh;
	background-color: black;
	border-radius: 4px;
}

.timeline {
	height: 100px;
	background-color: #2d2d2d;
	border-radius: 4px;
	padding: 10px;
}

button {
	padding: 8px 16px;
	border-radius: 4px;
	border: none;
	background-color: #4caf50;
	color: white;
	cursor: pointer;
	transition: background-color 0.3s;
}

button:disabled {
	background-color: #ccc;
	cursor: not-allowed;
}

button:hover:not(:disabled) {
	background-color: #45a049;
}
</style>
