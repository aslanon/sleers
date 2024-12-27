<template>
	<div>
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
