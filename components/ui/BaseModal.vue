<template>
	<Teleport to="body">
		<Transition
			enter-active-class="duration-300 ease-out"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="duration-200 ease-in"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div
				v-if="modelValue"
				class="fixed inset-0 z-[9999] flex items-start py-[3rem] px-[1rem] justify-center"
				@click="handleBackdropClick"
			>
				<!-- Backdrop -->
				<div class="absolute inset-0 bg-black"></div>

				<!-- Modal Content -->
				<Transition
					enter-active-class="duration-300 ease-out"
					enter-from-class="opacity-0 scale-95"
					enter-to-class="opacity-100 scale-100"
					leave-active-class="duration-200 ease-in"
					leave-from-class="opacity-100 scale-100"
					leave-to-class="opacity-0 scale-95"
				>
					<div
						v-if="modelValue"
						class="relative modal-grid w-full bg-black rounded-xl shadow-2xl max-h-[100vh] overflow-auto"
						@click.stop
					>
						<!-- Header -->
						<div
							v-if="showHeader"
							class="flex items-center justify-between p-6 border-b border-white/10"
						>
							<div>
								<h3 class="text-2xl font-semibold text-white">
									<slot name="title">{{ title }}</slot>
								</h3>
								<p
									v-if="subtitle"
									class="text-lg font-normal text-white/40 mt-1"
								>
									{{ subtitle }}
								</p>
							</div>
							<button
								v-if="closable"
								@click="close"
								class="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
							>
								<svg
									class="w-5 h-5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>

						<!-- Content -->
						<div
							class="p-6 flex items-center justify-center"
							:class="{ 'pt-0': !showHeader }"
						>
							<slot></slot>
						</div>

						<!-- Footer -->
						<div
							v-if="$slots.footer"
							class="flex items-center justify-end gap-3 p-6 border-t border-white/10"
						>
							<slot name="footer"></slot>
						</div>
					</div>
				</Transition>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
	modelValue: {
		type: Boolean,
		required: true,
	},
	title: {
		type: String,
		default: "",
	},
	subtitle: {
		type: String,
		default: "",
	},
	size: {
		type: String,
		default: "md",
		validator: (value) => ["sm", "md", "lg", "xl", "2xl"].includes(value),
	},
	closable: {
		type: Boolean,
		default: true,
	},
	closeOnBackdrop: {
		type: Boolean,
		default: true,
	},
	showHeader: {
		type: Boolean,
		default: true,
	},
});

const emit = defineEmits(["update:modelValue", "close"]);

const close = () => {
	emit("update:modelValue", false);
	emit("close");
};

const handleBackdropClick = () => {
	if (props.closeOnBackdrop) {
		close();
	}
};
</script>

<style>
.modal-grid {
	display: grid;
	grid-template-rows: auto 1fr auto;
	height: 94vh;
}
</style>
