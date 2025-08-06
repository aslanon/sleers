<template>
	<div class="min-h-screen bg-[#1e1e1e]">
		<!-- macOS Style Title Bar -->
		<div class="h-12 bg-[#2d2d2d] flex items-center justify-center border-b border-[#404040] drag-region">
			<h1 class="text-sm font-medium text-white">Recording Settings</h1>
			<button @click="closeWindow" class="absolute right-4 top-3 p-1 hover:bg-white/10 rounded-full no-drag">
				<svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="flex">
			<!-- macOS Style Sidebar -->
			<div class="w-52 bg-[#252525] border-r border-[#404040] min-h-[calc(100vh-48px)]">
				<div class="py-4">
					<button
						v-for="tab in tabs"
						:key="tab.id"
						@click="activeTab = tab.id"
						class="w-full px-6 py-2.5 text-left text-sm font-medium flex items-center gap-3 transition-colors hover:bg-white/5"
						:class="activeTab === tab.id ? 'bg-[#007aff] text-white' : 'text-gray-300'"
					>
						<span v-html="tab.icon" class="w-4 h-4 opacity-80"></span>
						{{ tab.label }}
					</button>
				</div>
			</div>

			<!-- Main Content -->
			<div class="flex-1 overflow-y-auto">
				<div class="p-8">
					<!-- Video Settings Tab -->
					<div v-if="activeTab === 'video'">
						<h2 class="text-2xl font-semibold text-white mb-8">Video</h2>
						
						<div class="space-y-8">
							<div class="grid grid-cols-2 gap-8">
								<div>
									<label class="block text-sm font-medium text-white mb-3">Quality</label>
									<select v-model="videoSettings.quality" class="w-full bg-[#2d2d2d] border border-[#404040] rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-[#007aff]">
										<option value="high">High (Recommended)</option>
										<option value="medium">Medium</option>
										<option value="low">Low</option>
									</select>
								</div>
								
								<div>
									<label class="block text-sm font-medium text-white mb-3">Frame Rate</label>
									<select v-model="videoSettings.frameRate" class="w-full bg-[#2d2d2d] border border-[#404040] rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-[#007aff]">
										<option value="30">30 FPS</option>
										<option value="60">60 FPS</option>
									</select>
								</div>
							</div>
							
							<div class="space-y-4">
								<div class="flex items-center">
									<input
										id="capture-cursor"
										v-model="videoSettings.captureCursor"
										type="checkbox"
										class="w-4 h-4 text-[#007aff] bg-[#2d2d2d] border-[#404040] rounded focus:ring-[#007aff]"
									/>
									<label for="capture-cursor" class="ml-3 text-sm text-white">Show cursor in recording</label>
								</div>
							</div>
						</div>
					</div>

					<!-- Audio Settings Tab -->
					<div v-if="activeTab === 'audio'">
						<h2 class="text-2xl font-semibold text-white mb-8">Audio</h2>
						
						<div class="space-y-6">
							<div class="flex items-center">
								<input
									id="system-audio"
									v-model="audioSettings.systemAudio"
									type="checkbox"
									class="w-4 h-4 text-[#007aff] bg-[#2d2d2d] border-[#404040] rounded focus:ring-[#007aff]"
								/>
								<label for="system-audio" class="ml-3 text-sm text-white">Include system audio</label>
							</div>

							<div class="flex items-center">
								<input
									id="microphone"
									v-model="audioSettings.microphone"
									type="checkbox"
									class="w-4 h-4 text-[#007aff] bg-[#2d2d2d] border-[#404040] rounded focus:ring-[#007aff]"
								/>
								<label for="microphone" class="ml-3 text-sm text-white">Include microphone</label>
							</div>
						</div>
					</div>

					<!-- General Settings Tab -->
					<div v-if="activeTab === 'general'">
						<h2 class="text-2xl font-semibold text-white mb-8">General</h2>
						
						<div class="space-y-8">
							<div class="grid grid-cols-2 gap-8">
								<div>
									<label class="block text-sm font-medium text-white mb-3">Recording Delay</label>
									<select v-model="generalSettings.delay" class="w-full bg-[#2d2d2d] border border-[#404040] rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-[#007aff]">
										<option value="0">None</option>
										<option value="3">3 seconds</option>
										<option value="5">5 seconds</option>
									</select>
									<p class="text-xs text-gray-500 mt-2">Time to prepare before recording starts</p>
								</div>

								<div>
									<label class="block text-sm font-medium text-white mb-3">Save Format</label>
									<select v-model="generalSettings.exportFormat" class="w-full bg-[#2d2d2d] border border-[#404040] rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-[#007aff]">
										<option value="mp4">MP4</option>
										<option value="mov">MOV</option>
									</select>
								</div>
							</div>

							<div>
								<label class="block text-sm font-medium text-white mb-3">Save Location</label>
								<div class="flex gap-2">
									<input 
										v-model="generalSettings.savePath" 
										type="text" 
										class="flex-1 bg-[#2d2d2d] border border-[#404040] rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-[#007aff]"
										placeholder="Choose folder..."
										readonly
									/>
									<button @click="chooseSaveFolder" class="px-4 py-2 bg-[#007aff] hover:bg-[#0056b3] rounded-md text-white text-sm">
										Browse
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

// Tab management
const activeTab = ref('video')
const tabs = [
	{
		id: 'video',
		label: 'Video',
		icon: '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>'
	},
	{
		id: 'audio',
		label: 'Audio',
		icon: '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V21h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/></svg>'
	},
	{
		id: 'general',
		label: 'General',
		icon: '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>'
	}
]


// Settings - simplified to only essential options
const videoSettings = ref({
	quality: 'high',
	frameRate: 30,
	captureCursor: true
})

const audioSettings = ref({
	systemAudio: true,
	microphone: false
})

const generalSettings = ref({
	delay: 0,
	exportFormat: 'mp4',
	savePath: ''
})

// Methods
const chooseSaveFolder = async () => {
	try {
		if (window.electron?.ipcRenderer) {
			const result = await window.electron.ipcRenderer.invoke('SHOW_DIRECTORY_DIALOG')
			if (result && !result.canceled && result.filePaths.length > 0) {
				generalSettings.value.savePath = result.filePaths[0]
			}
		}
	} catch (error) {
		console.error('Failed to choose save folder:', error)
	}
}

const saveSettings = () => {
	const settings = {
		video: videoSettings.value,
		audio: audioSettings.value,
		general: generalSettings.value
	}
	
	console.log('Saving settings:', settings)
	
	// Save to electron-store or send to main process
	if (window.electron?.ipcRenderer) {
		window.electron.ipcRenderer.invoke('SAVE_RECORDING_SETTINGS', settings)
	}
	
	// Close window
	closeWindow()
}

const closeWindow = () => {
	// Ayarları kaydet ve pencereyi kapat
	saveSettingsWithoutClosing()
	if (window.electron?.windowControls) {
		window.electron.windowControls.close()
	}
}

const saveSettingsWithoutClosing = () => {
	const settings = {
		video: videoSettings.value,
		audio: audioSettings.value,
		general: generalSettings.value
	}
	
	console.log('Saving settings:', settings)
	
	// Save to electron-store or send to main process
	if (window.electron?.ipcRenderer) {
		window.electron.ipcRenderer.invoke('SAVE_RECORDING_SETTINGS', settings)
	}
}

onMounted(async () => {
	// Auto-save on window close
	window.addEventListener('beforeunload', saveSettingsWithoutClosing)
	
	// Set default save path to Desktop
	const os = await window.electron?.ipcRenderer?.invoke('GET_OS_INFO')
	if (os?.homedir) {
		generalSettings.value.savePath = `${os.homedir}/Desktop`
	}

	// Load available sources
	try {
		if (window.electron?.ipcRenderer) {
			// Load existing settings
			const savedSettings = await window.electron.ipcRenderer.invoke('GET_RECORDING_SETTINGS')
			if (savedSettings) {
				if (savedSettings.video) Object.assign(videoSettings.value, savedSettings.video)
				if (savedSettings.audio) Object.assign(audioSettings.value, savedSettings.audio)
				if (savedSettings.general) Object.assign(generalSettings.value, savedSettings.general)
			}
		}
	} catch (error) {
		console.error('Failed to load settings:', error)
	}
})

// Auto-save removed - will save on window close or manual save
</script>

<style scoped>
.drag-region {
	-webkit-app-region: drag;
}

.no-drag {
	-webkit-app-region: no-drag;
}

/* macOS style scrollbar */
::-webkit-scrollbar {
	width: 8px;
}

::-webkit-scrollbar-track {
	background: transparent;
}

::-webkit-scrollbar-thumb {
	background-color: rgba(0,0,0,0.2);
	border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
	background-color: rgba(0,0,0,0.3);
}
</style>