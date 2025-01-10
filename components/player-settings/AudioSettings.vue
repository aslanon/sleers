<style scoped>
.setting-group {
	@apply flex flex-col gap-2;
}

.setting-label {
	@apply text-sm font-medium text-gray-300;
}

.setting-control {
	@apply flex items-center gap-3;
}

.setting-slider {
	@apply w-full h-1 bg-gray-700/50 rounded-full appearance-none cursor-pointer relative;
	background-image: linear-gradient(
		to right,
		rgb(59 130 246) 0%,
		rgb(59 130 246) 50%,
		rgba(55, 65, 81, 0.5) 50%
	);
}

.setting-slider::-webkit-slider-thumb {
	@apply appearance-none w-5 h-5 bg-white rounded-full cursor-pointer shadow-lg transition-all duration-150 border-4 border-blue-500;
	margin-top: -8px;
}

.setting-slider::-webkit-slider-thumb:hover {
	@apply border-blue-400;
	transform: scale(1.1);
}

.setting-slider::-webkit-slider-thumb:active {
	@apply border-blue-600;
	transform: scale(0.95);
}

.setting-slider:focus {
	@apply outline-none;
}

.setting-value {
	@apply text-sm text-gray-300 min-w-[3rem] text-right font-medium;
}
</style>
