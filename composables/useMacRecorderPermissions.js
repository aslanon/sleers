// MacRecorder Permission Management - README'den optimize edildi
import { ref, onMounted, computed, readonly } from "vue";

export const useMacRecorderPermissions = () => {
	// Permission state - README'den
	const permissions = ref({
		screenRecording: false,
		microphone: false,
		accessibility: false,
	});

	const isLoading = ref(true);
	const lastCheck = ref(null);

	// Check all permissions - README API
	const checkPermissions = async () => {
		try {
			console.log("[useMacRecorderPermissions] İzinler kontrol ediliyor...");
			isLoading.value = true;

			if (!window.electron?.ipcRenderer) {
				console.warn("[useMacRecorderPermissions] Electron IPC bulunamadı");
				return permissions.value;
			}

			// MacRecorder permission check - README method
			const result = await window.electron.ipcRenderer.invoke(
				"CHECK_MAC_PERMISSIONS"
			);

			if (result) {
				permissions.value = {
					screenRecording: result.screenRecording || false,
					microphone: result.microphone || false,
					accessibility: result.accessibility || false,
				};

				lastCheck.value = new Date();
				console.log(
					"[useMacRecorderPermissions] İzinler güncellendi:",
					permissions.value
				);
			}

			return permissions.value;
		} catch (error) {
			console.error("[useMacRecorderPermissions] İzin kontrolü hatası:", error);
			return permissions.value;
		} finally {
			isLoading.value = false;
		}
	};

	// Individual permission checks
	const hasScreenRecordingPermission = computed(
		() => permissions.value.screenRecording
	);
	const hasMicrophonePermission = computed(() => permissions.value.microphone);
	const hasAccessibilityPermission = computed(
		() => permissions.value.accessibility
	);

	// All permissions check
	const hasAllPermissions = computed(() => {
		return (
			permissions.value.screenRecording &&
			permissions.value.microphone &&
			permissions.value.accessibility
		);
	});

	// Critical permissions for basic recording
	const hasCriticalPermissions = computed(() => {
		return permissions.value.screenRecording; // Ekran kaydı en kritik
	});

	// Get permission status with user-friendly messages
	const getPermissionStatus = () => {
		const status = {
			screenRecording: {
				granted: permissions.value.screenRecording,
				message: permissions.value.screenRecording
					? "Ekran kaydı izni verildi"
					: "Ekran kaydı izni gerekli",
				critical: true,
			},
			microphone: {
				granted: permissions.value.microphone,
				message: permissions.value.microphone
					? "Mikrofon izni verildi"
					: "Mikrofon izni gerekli (ses kaydı için)",
				critical: false,
			},
			accessibility: {
				granted: permissions.value.accessibility,
				message: permissions.value.accessibility
					? "Erişilebilirlik izni verildi"
					: "Erişilebilirlik izni gerekli (gelişmiş özellikler için)",
				critical: false,
			},
		};

		return status;
	};

	// Open system preferences - README suggests this approach
	const openSystemPreferences = () => {
		try {
			if (window.electron?.ipcRenderer) {
				window.electron.ipcRenderer.send("OPEN_SYSTEM_PREFERENCES");
				console.log("[useMacRecorderPermissions] Sistem ayarları açılıyor...");
			}
		} catch (error) {
			console.error(
				"[useMacRecorderPermissions] Sistem ayarları açılamadı:",
				error
			);
		}
	};

	// Request specific permission (limited on macOS)
	const requestPermission = async (permissionType) => {
		try {
			console.log(
				`[useMacRecorderPermissions] ${permissionType} izni isteniyor...`
			);

			if (!window.electron?.ipcRenderer) {
				return false;
			}

			// Only camera and microphone can be requested programmatically
			if (permissionType === "microphone") {
				const granted = await window.electron.ipcRenderer.invoke(
					"REQUEST_PERMISSION",
					permissionType
				);

				if (granted) {
					// Re-check permissions to update state
					await checkPermissions();
				}

				return granted;
			} else {
				// For screen recording, user must manually grant in System Preferences
				console.warn(
					"[useMacRecorderPermissions] Ekran kaydı izni manuel olarak verilmeli"
				);
				openSystemPreferences();
				return false;
			}
		} catch (error) {
			console.error(
				`[useMacRecorderPermissions] ${permissionType} izni istenemedi:`,
				error
			);
			return false;
		}
	};

	// Auto-refresh permissions periodically
	const startPermissionMonitoring = (intervalMs = 30000) => {
		const interval = setInterval(async () => {
			if (!isLoading.value) {
				await checkPermissions();
			}
		}, intervalMs);

		// Return cleanup function
		return () => {
			clearInterval(interval);
			console.log("[useMacRecorderPermissions] İzin izleme durduruldu");
		};
	};

	// Initial permission check
	onMounted(async () => {
		await checkPermissions();
	});

	return {
		// State
		permissions: readonly(permissions),
		isLoading: readonly(isLoading),
		lastCheck: readonly(lastCheck),

		// Computed
		hasScreenRecordingPermission,
		hasMicrophonePermission,
		hasAccessibilityPermission,
		hasAllPermissions,
		hasCriticalPermissions,

		// Methods
		checkPermissions,
		getPermissionStatus,
		openSystemPreferences,
		requestPermission,
		startPermissionMonitoring,
	};
};
