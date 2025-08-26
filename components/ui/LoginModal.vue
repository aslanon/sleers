<template>
	<BaseModal
		v-model="isModalOpen"
		title="Login to Creavit Studio"
		subtitle="Sign in to your account to export videos"
		size="md"
		@close="handleClose"
	>
		<form @submit.prevent="handleLogin" class="space-y-6 max-w-md mx-auto">
			<!-- Email Input -->
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-2">
					Email Address
				</label>
				<input
					@keyup.enter="handleLogin"
					v-model="email"
					type="email"
					required
					class="w-full bg-zinc-800/60 rounded-lg px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-blue-500 transition-all duration-200"
					placeholder="Enter your email"
					:class="{
						'border-red-500 focus:border-red-500 focus:ring-red-500/20': error,
					}"
				/>
			</div>

			<!-- Password Input -->
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-2">
					Password
				</label>
				<div class="relative">
					<input
						@keyup.enter="handleLogin"
						v-model="password"
						:type="showPassword ? 'text' : 'password'"
						required
						class="w-full bg-zinc-800/60 rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-400 outline-none focus:border-blue-500 transition-all duration-200"
						placeholder="Enter your password"
						:class="{
							'border-red-500 focus:border-red-500 focus:ring-red-500/20':
								error,
						}"
					/>
					<button
						type="button"
						@click="showPassword = !showPassword"
						class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
					>
						<svg
							v-if="showPassword"
							class="w-5 h-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
							/>
						</svg>
						<svg
							v-else
							class="w-5 h-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
							/>
						</svg>
					</button>
				</div>
			</div>

			<div class="flex items-center flex-col justify-between">
				<button
					@click="handleLogin"
					:disabled="!isFormValid || isLoading"
					class="w-full px-6 py-3 text-lg rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-gray-500 text-white font-medium transition-all duration-200 shadow-lg flex justify-center items-center gap-2"
				>
					<div
						v-if="isLoading"
						class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
					></div>
					<svg
						v-else
						class="w-4 h-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
						/>
					</svg>
					{{ isLoading ? "Signing in..." : "Sign In" }}
				</button>
			</div>

			<!-- Error Message -->
			<div
				v-if="error"
				class="p-3 bg-red-900/20 border border-red-500/30 rounded-lg"
			>
				<div class="flex items-center gap-2">
					<svg
						class="w-4 h-4 text-red-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<p class="text-red-400 text-sm">{{ error }}</p>
				</div>
			</div>

			<!-- Success Message -->
			<div
				v-if="success"
				class="p-3 bg-green-900/20 border border-green-500/30 rounded-lg"
			>
				<div class="flex items-center gap-2">
					<svg
						class="w-4 h-4 text-green-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						/>
					</svg>
					<p class="text-green-400 text-sm">{{ success }}</p>
				</div>
			</div>

			<!-- Register Link -->
			<div
				class="text-center flex gap-2 items-center justify-center font-normal pt-4 border-t border-zinc-600/30"
			>
				<p class="text-gray-400 text-lg">Don't have an account?</p>
				<button
					type="button"
					@click="handleRegister"
					class="text-blue-600 hover:text-blue-500 text-lg transition-colors"
				>
					Create an account
				</button>
			</div>
		</form>
	</BaseModal>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import BaseModal from "./BaseModal.vue";
import AuthService from "../../services/AuthService.js";

const props = defineProps({
	isOpen: {
		type: Boolean,
		default: false,
	},
});

const emit = defineEmits(["close", "login-success"]);

// Refs
const isModalOpen = ref(false);
const email = ref("");
const password = ref("");
const showPassword = ref(false);
const isLoading = ref(false);
const error = ref("");
const success = ref("");

// Watch props
watch(
	() => props.isOpen,
	(newVal) => {
		isModalOpen.value = newVal;
		if (newVal) {
			resetForm();
		}
	}
);

// Computed
const isFormValid = computed(() => {
	return email.value.trim() && password.value.trim() && !isLoading.value;
});

// Methods
const resetForm = () => {
	email.value = "";
	password.value = "";
	showPassword.value = false;
	error.value = "";
	success.value = "";
	isLoading.value = false;
};

const handleLogin = async () => {
	if (!isFormValid.value) return;

	try {
		isLoading.value = true;
		error.value = "";
		success.value = "";

		const result = await AuthService.login(email.value.trim(), password.value);

		if (result.success) {
			success.value = "Login successful!";

			// Wait a moment to show success message
			setTimeout(() => {
				emit("login-success", {
					user: result.user,
					canExport: result.canExport,
				});
				handleClose();
			}, 500);
		} else {
			// Handle different error types with user-friendly messages
			const errorMessage = result.error || "Login failed. Please try again.";

			if (errorMessage.includes("Invalid identifier or password")) {
				error.value =
					"Invalid email or password. Please check your credentials and try again.";
			} else if (errorMessage.includes("ValidationError")) {
				error.value = "Please enter a valid email address and password.";
			} else if (errorMessage.includes("Failed to fetch")) {
				error.value =
					"Unable to connect to the server. Please check your internet connection.";
			} else {
				error.value = errorMessage;
			}
		}
	} catch (err) {
		error.value = "An unexpected error occurred. Please try again.";
		console.error("Login error:", err);
	} finally {
		isLoading.value = false;
	}
};

const handleRegister = async () => {
	try {
		await AuthService.openRegister();
	} catch (err) {
		console.error("Failed to open register page:", err);
		error.value = "Failed to open registration page.";
	}
};

const handleClose = () => {
	if (!isLoading.value) {
		isModalOpen.value = false;
		emit("close");
	}
};
</script>
