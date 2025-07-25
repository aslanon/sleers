<template>
	<div class="permission-checker text-white">
		<h3 class="text-xl font-semibold mb-4">Application Permissions</h3>

		<div v-if="isLoading" class="flex justify-center items-center py-4">
			<div
				class="w-6 h-6 border-t-2 border-blue-500 rounded-full animate-spin"
			></div>
			<span class="ml-2">Checking permissions...</span>
		</div>

		<div v-else class="space-y-4">
			<!-- Kamera İzni -->
			<div
				class="permission-item flex items-center gap-3 p-3 rounded-lg"
				:class="getStatusClass(permissions.camera)"
			>
				<div class="icon-container">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
						/>
					</svg>
				</div>
				<div class="flex-1">
					<div class="font-medium">Camera</div>
					<div class="text-sm">{{ getStatusText(permissions.camera) }}</div>
				</div>
				<button
					v-if="
						permissions.camera !== 'granted' && permissions.camera !== 'prompt'
					"
					@click="requestPermission('camera')"
					class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
				>
					Request Permission
				</button>
			</div>

			<!-- Mikrofon İzni -->
			<div
				class="permission-item flex items-center gap-3 p-3 rounded-lg"
				:class="getStatusClass(permissions.microphone)"
			>
				<div class="icon-container">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
						/>
					</svg>
				</div>
				<div class="flex-1">
					<div class="font-medium">Microphone</div>
					<div class="text-sm">{{ getStatusText(permissions.microphone) }}</div>
				</div>
				<button
					v-if="
						permissions.microphone !== 'granted' &&
						permissions.microphone !== 'prompt'
					"
					@click="requestPermission('microphone')"
					class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
				>
					Request Permission
				</button>
			</div>

			<!-- Ekran Kaydı İzni -->
			<div
				class="permission-item flex items-center gap-3 p-3 rounded-lg"
				:class="getStatusClass(permissions.screen)"
			>
				<div class="icon-container">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
						/>
					</svg>
				</div>
				<div class="flex-1">
					<div class="font-medium">Screen Recording</div>
					<div class="text-sm">{{ getStatusText(permissions.screen) }}</div>
				</div>
				<button
					v-if="permissions.screen === 'denied'"
					@click="openSettingsForScreen"
					class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
				>
					Settings
				</button>
			</div>

			<!-- Yenile Butonu -->
			<div class="mt-4 flex justify-end">
				<button
					@click="checkPermissions"
					class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 flex items-center gap-2"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
					Refresh Permissions
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const isLoading = ref(true);
const permissions = ref({
	camera: "unknown",
	microphone: "unknown",
	screen: "unknown",
});

// Component yüklendiğinde izinleri kontrol et ve gerekirse otomatik iste
onMounted(async () => {
	await checkPermissions();

	// İzin durumuna göre otomatik isteme
	await autoRequestPermissions();
});

// İzinleri kontrol et
async function checkPermissions() {
	isLoading.value = true;

	try {
		// Electron permissions API üzerinden izinleri kontrol et
		if (window.electron?.permissions) {
			const permissionStatus = await window.electron.permissions.check();
			permissions.value = permissionStatus;
		} else {
			console.error("Electron permissions API not available");
		}
	} catch (error) {
		console.error("Error while checking permissions:", error);
	} finally {
		isLoading.value = false;
	}
}

// İzinleri otomatik olarak iste
async function autoRequestPermissions() {
	// Otomatik izin isteme devre dışı bırakıldı
	return;

	// Aşağıdaki kod artık çalışmayacak
	try {
		// Kamera izni durumuna göre
		if (permissions.value.camera === "prompt") {
			await requestPermission("camera");
		}

		// Mikrofon izni durumuna göre
		if (permissions.value.microphone === "prompt") {
			await requestPermission("microphone");
		}
	} catch (error) {
		console.error("Error while automatically requesting permissions:", error);
	}
}

// İzin durumuna göre CSS sınıfını belirle
function getStatusClass(status) {
	switch (status) {
		case "granted":
			return "bg-green-50 text-green-700 border border-green-200";
		case "denied":
			return "bg-red-50 text-red-700 border border-red-200";
		case "prompt":
			return "bg-yellow-50 text-yellow-700 border border-yellow-200";
		default:
			return "bg-gray-50 text-gray-700 border border-gray-200";
	}
}

// İzin durumuna göre metin belirle
function getStatusText(status) {
	switch (status) {
		case "granted":
			return "Permission granted";
		case "denied":
			return "Permission denied";
		case "prompt":
			return "Permission will be requested";
		case "restricted":
			return "Restricted";
		case "unknown":
			return "Unknown";
		default:
			return "Unknown";
	}
}

// İzin iste
async function requestPermission(type) {
	try {
		if (window.electron?.permissions) {
			// İzin zaten verilmiş mi kontrol et
			if (permissions.value[type] === "granted") {
				return true;
			}

			// İzin isteme ekranını göster
			const result = await window.electron.permissions.request(type);

			// İzinleri yeniden kontrol et
			await checkPermissions();

			return result;
		}
	} catch (error) {
		console.error(`Error requesting ${type} permission:`, error);
		return false;
	}
}

// Sistem Ayarlarını Aç
function openSettingsForScreen() {
	try {
		if (window.electron?.permissions) {
			window.electron.permissions.openSettings();
		}
	} catch (error) {
		console.error("Error opening system settings:", error);
	}
}
</script>

<style scoped>
.permission-checker {
	@apply p-5 rounded-lg shadow-sm;
}

.permission-item {
	transition: all 0.2s ease;
}

.permission-item:hover {
	transform: translateY(-1px);
}

.icon-container {
	@apply p-2 rounded-full;
}
</style>
