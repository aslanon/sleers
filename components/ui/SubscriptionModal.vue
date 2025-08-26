<template>
	<BaseModal
		v-model="isModalOpen"
		title="Subscription Required"
		subtitle="You need an active subscription to export videos"
		size="md"
		@close="handleClose"
	>
		<div class="text-center space-y-6 max-w-md mx-auto">
			<!-- Icon -->
			<div
				class="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
				:class="iconBgClass"
			>
				<svg
					class="w-8 h-8 text-white"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						:d="iconPath"
					/>
				</svg>
			</div>

			<!-- Message -->
			<div class="space-y-4 h-full">
				<h3 class="text-xl font-semibold text-white">
					{{ subscriptionTitle }}
				</h3>
				<p class="text-gray-300 leading-relaxed">
					{{ subscriptionMessage }}
				</p>

				<!-- User Info -->
				<div v-if="user" class="p-4 bg-zinc-800/60 rounded-xl">
					<div class="flex items-center gap-3">
						<div
							class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center"
						>
							<span class="text-white font-medium text-sm">
								{{ user.email?.charAt(0).toUpperCase() }}
							</span>
						</div>
						<div class="text-left">
							<p class="text-white font-medium">{{ user.email }}</p>
							<p class="text-gray-400 text-sm">
								Current Status:
								{{ user.subscription_status || "No subscription" }}
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>

		<template #footer>
			<div class="flex items-center justify-between w-full">
				<div class="flex items-center gap-3">
					<button
						@click="handleLogout"
						class="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 transition-all duration-200 flex items-center gap-2"
					>
						<svg
							class="w-4 h-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
							/>
						</svg>
						Log Out
					</button>
				</div>
				<div class="flex items-center gap-3">
					<button
						@click="handleClose"
						class="px-4 py-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/80 text-gray-300 hover:text-white transition-all duration-200"
					>
						Maybe Later
					</button>
					<button
						@click="openPricing"
						class="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all duration-200 shadow-lg shadow-blue-600/25 flex items-center gap-2"
					>
						<svg
							class="w-4 h-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
							/>
						</svg>
						View Pricing Plans
					</button>
				</div>
			</div>
		</template>
	</BaseModal>
</template>

<script setup>
import { ref, watch, computed } from "vue";
import BaseModal from "./BaseModal.vue";
import AuthService from "../../services/AuthService.js";

const props = defineProps({
	isOpen: {
		type: Boolean,
		default: false,
	},
	user: {
		type: Object,
		default: null,
	},
});

const emit = defineEmits(["close", "logout"]);

// Refs
const isModalOpen = ref(false);

// Watch props
watch(
	() => props.isOpen,
	(newVal) => {
		isModalOpen.value = newVal;
	}
);

// Computed properties for subscription status messages
const subscriptionTitle = computed(() => {
	const status = props.user?.subscription_status;

	switch (status) {
		case null:
		case undefined:
			return "Start Your Subscription";
		case "active":
			return "Subscription Active";
		case "cancelled":
			return "Subscription Cancelled";
		case "paused":
			return "Subscription Paused";
		case "payment_failed":
			return "Payment Failed";
		case "expired":
			return "Subscription Expired";
		case "past_due":
			return "Payment Past Due";
		case "trial":
		case "trialing":
			return "Trial Period";
		case "imported":
			return "Subscription Imported";
		default:
			return "Subscription Required";
	}
});

const subscriptionMessage = computed(() => {
	const status = props.user?.subscription_status;

	switch (status) {
		case null:
		case undefined:
			return "To export videos from Creavit Studio, you need either a trial or active subscription. Choose a plan that works best for you and start creating amazing content!";
		case "active":
			return "Your subscription is active, but video export requires trial or active status. There might be an issue with your account permissions. Please contact support if this persists.";
		case "cancelled":
			return "Your subscription has been cancelled. You can reactivate it anytime to continue exporting videos and accessing premium features.";
		case "paused":
			return "Your subscription is currently paused. Resume your subscription to continue exporting videos and accessing all premium features.";
		case "payment_failed":
			return "Your last payment failed. Please update your payment method to restore access to video exports and premium features.";
		case "expired":
			return "Your subscription has expired. Renew your subscription to continue exporting videos and accessing premium features.";
		case "past_due":
			return "Your account has an overdue payment. Please settle your balance to restore access to video exports and premium features.";
		case "trial":
		case "trialing":
			return "You're currently in a trial period with full access to video exports. Enjoy exploring all features!";
		case "imported":
			return "Your subscription was imported from another system. There might be a sync issue. Please contact support to enable video exports.";
		default:
			return "Your current subscription status doesn't allow video exports. Please upgrade or contact support for assistance.";
	}
});

// Computed properties for icon styling
const iconBgClass = computed(() => {
	const status = props.user?.subscription_status;

	switch (status) {
		case "active":
		case "trial":
		case "trialing":
			return "bg-green-600";
		case "cancelled":
		case "expired":
		case "paused":
			return "bg-yellow-600";
		case "payment_failed":
		case "past_due":
			return "bg-red-600";
		case "imported":
			return "bg-purple-600";
		default:
			return "bg-blue-600";
	}
});

const iconPath = computed(() => {
	const status = props.user?.subscription_status;

	switch (status) {
		case "active":
		case "trial":
		case "trialing":
			return "M5 13l4 4L19 7"; // Check mark
		case "cancelled":
		case "expired":
			return "M6 18L18 6M6 6l12 12"; // X mark
		case "paused":
			return "M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"; // Pause
		case "payment_failed":
		case "past_due":
			return "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"; // Warning
		case "imported":
			return "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"; // Download/Import
		default:
			return "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"; // Lock
	}
});

// Methods
const openPricing = async () => {
	try {
		if (window.electron && window.electron.ipcRenderer) {
			await window.electron.ipcRenderer.invoke(
				"OPEN_EXTERNAL_URL",
				"https://creavit.studio/pricing"
			);
		}
		console.log("[SubscriptionModal] Opened pricing page");
	} catch (error) {
		console.error("[SubscriptionModal] Failed to open pricing page:", error);
	}
};

const handleLogout = async () => {
	try {
		await AuthService.logout();
		isModalOpen.value = false;
		emit("logout");
		console.log("[SubscriptionModal] User logged out");
	} catch (error) {
		console.error("[SubscriptionModal] Logout error:", error);
	}
};

const handleClose = () => {
	isModalOpen.value = false;
	emit("close");
};
</script>
