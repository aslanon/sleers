<template>
	<div class="transparent-root">
		<NuxtPage />
	</div>
</template>

<script setup>
// Client-side only
if (process.client) {
	// Electron API'lerini kontrol et
	const electron = window.electron;
	if (!electron) {
		console.warn("Electron API bulunamadı");
	}
}
</script>

<style>
html,
body {
	background: transparent !important;
	margin: 0;
	padding: 0;
}

.transparent-root {
	background: transparent !important;
}
</style>
