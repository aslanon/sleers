<template>
	<div class="permission-checker">
		<!-- Permission Status Card -->
		<div
			v-if="!hasCriticalPermissions && !isLoading"
			class="bg-gradient-to-br from-amber-500/10 to-red-500/10 border border-amber-500/30 rounded-xl p-4 mb-4"
		>
			<div class="flex items-start gap-3">
				<div class="flex-shrink-0 mt-1">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 text-amber-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
						/>
					</svg>
				</div>
				<div class="flex-1">
					<h3 class="text-amber-300 font-semibold text-sm mb-2">
						Screen Recording Permission Required
					</h3>
					<p class="text-gray-300 text-sm mb-3">
						macOS permissions are required for Sleer to record the screen. Please
						grant the necessary permissions from system settings.
					</p>
					<button
						@click="openSystemPreferences"
						class="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium text-sm rounded-lg transition-colors"
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
								d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
						Open System Settings
					</button>
				</div>
			</div>
		</div>

		<!-- Detailed Permissions (Collapsible) -->
		<div class="bg-gray-800/50 rounded-lg border border-gray-700">
			<button
				@click="showDetails = !showDetails"
				class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-700/50 transition-colors rounded-lg"
			>
				<div class="flex items-center gap-3">
					<div
						class="w-3 h-3 rounded-full"
						:class="hasCriticalPermissions ? 'bg-green-500' : 'bg-red-500'"
					></div>
					<span class="text-sm font-medium text-gray-200"> Permission Status </span>
					<span
						class="text-xs px-2 py-1 rounded-full"
						:class="
							hasCriticalPermissions
								? 'bg-green-500/20 text-green-400'
								: 'bg-red-500/20 text-red-400'
						"
					>
						{{ hasCriticalPermissions ? "Ready" : "Permission Required" }}
					</span>
				</div>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4 text-gray-400 transition-transform"
					:class="{ 'rotate-180': showDetails }"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 9l-7 7-7-7"
					/>
				</svg>
			</button>

			<!-- Permission Details -->
			<transition
				enter-active-class="transition-all duration-300"
				enter-from-class="opacity-0 max-h-0"
				enter-to-class="opacity-100 max-h-96"
				leave-active-class="transition-all duration-300"
				leave-from-class="opacity-100 max-h-96"
				leave-to-class="opacity-0 max-h-0"
			>
				<div v-if="showDetails" class="px-4 pb-4">
					<div class="space-y-3">
						<!-- Screen Recording Permission -->
						<div
							class="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg"
						>
							<div class="flex items-center gap-3">
								<div
									class="w-2 h-2 rounded-full"
									:class="
										hasScreenRecordingPermission ? 'bg-green-500' : 'bg-red-500'
									"
								></div>
								<div>
									<div class="text-sm font-medium text-gray-200">
										Screen Recording
									</div>
									<div class="text-xs text-gray-400">
										Required to record screen content
									</div>
								</div>
							</div>
							<div class="flex items-center gap-2">
								<span
									class="text-xs px-2 py-1 rounded-full"
									:class="
										hasScreenRecordingPermission
											? 'bg-green-500/20 text-green-400'
											: 'bg-red-500/20 text-red-400'
									"
								>
									{{ hasScreenRecordingPermission ? "Granted" : "Required" }}
								</span>
								<span class="text-xs text-amber-400 font-medium">CRITICAL</span>
							</div>
						</div>

						<!-- Microphone Permission -->
						<div
							class="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg"
						>
							<div class="flex items-center gap-3">
								<div
									class="w-2 h-2 rounded-full"
									:class="
										hasMicrophonePermission ? 'bg-green-500' : 'bg-yellow-500'
									"
								></div>
								<div>
									<div class="text-sm font-medium text-gray-200">Microphone</div>
									<div class="text-xs text-gray-400">
										Required for audio recording
									</div>
								</div>
							</div>
							<div class="flex items-center gap-2">
								<button
									v-if="!hasMicrophonePermission"
									@click="requestMicrophonePermission"
									class="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
								>
									Request Permission
								</button>
								<span
									class="text-xs px-2 py-1 rounded-full"
									:class="
										hasMicrophonePermission
											? 'bg-green-500/20 text-green-400'
											: 'bg-yellow-500/20 text-yellow-400'
									"
								>
									{{ hasMicrophonePermission ? "Granted" : "Optional" }}
								</span>
							</div>
						</div>

						<!-- Accessibility Permission -->
						<div
							class="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg"
						>
							<div class="flex items-center gap-3">
								<div
									class="w-2 h-2 rounded-full"
									:class="
										hasAccessibilityPermission ? 'bg-green-500' : 'bg-gray-500'
									"
								></div>
								<div>
									<div class="text-sm font-medium text-gray-200">
										Accessibility
									</div>
									<div class="text-xs text-gray-400">
										For advanced features
									</div>
								</div>
							</div>
							<span
								class="text-xs px-2 py-1 rounded-full"
								:class="
									hasAccessibilityPermission
										? 'bg-green-500/20 text-green-400'
										: 'bg-gray-500/20 text-gray-400'
								"
							>
								{{ hasAccessibilityPermission ? "Granted" : "Optional" }}
							</span>
						</div>
					</div>

					<!-- Last Check Info -->
					<div v-if="lastCheck" class="mt-4 pt-3 border-t border-gray-600">
						<div
							class="flex items-center justify-between text-xs text-gray-400"
						>
							<span>Last check: {{ formatDate(lastCheck) }}</span>
							<button
								@click="checkPermissions"
								:disabled="isLoading"
								class="flex items-center gap-1 px-2 py-1 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded transition-colors"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-3 w-3"
									:class="{ 'animate-spin': isLoading }"
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
								Refresh
							</button>
						</div>
					</div>
				</div>
			</transition>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useMacRecorderPermissions } from "~/composables/useMacRecorderPermissions";

const {
	permissions,
	isLoading,
	lastCheck,
	hasScreenRecordingPermission,
	hasMicrophonePermission,
	hasAccessibilityPermission,
	hasCriticalPermissions,
	checkPermissions,
	openSystemPreferences,
	requestPermission,
	startPermissionMonitoring,
} = useMacRecorderPermissions();

const showDetails = ref(false);

// Request microphone permission
const requestMicrophonePermission = async () => {
	try {
		const granted = await requestPermission("microphone");
		if (granted) {
		} else {
			console.warn("[MacRecorderPermissionChecker] Microphone permission not granted");
		}
	} catch (error) {
		console.error(
			"[MacRecorderPermissionChecker] Microphone permission error:",
			error
		);
	}
};

// Format date helper
const formatDate = (date) => {
	if (!date) return "";
	return new Intl.DateTimeFormat("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).format(new Date(date));
};

// Auto-monitoring
let stopMonitoring = null;

onMounted(() => {
	// Start permission monitoring every 30 seconds
	stopMonitoring = startPermissionMonitoring(30000);
});

onUnmounted(() => {
	if (stopMonitoring) {
		stopMonitoring();
	}
});
</script>

<style scoped>
.permission-checker {
	@apply space-y-4;
}

.line-clamp-1 {
	overflow: hidden;
	display: -webkit-box;
	-webkit-line-clamp: 1;
	-webkit-box-orient: vertical;
}
</style>
