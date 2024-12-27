<template>
	<div
		class="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12"
	>
		<div class="relative py-3 sm:max-w-xl sm:mx-auto">
			<div
				class="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20"
			>
				<div class="max-w-md mx-auto">
					<div class="divide-y divide-gray-200">
						<div
							class="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7"
						>
							<h1 class="text-2xl font-bold mb-8">Ekran Kayıt Uygulaması</h1>

							<!-- Cihaz Seçimi -->
							<div class="mb-6">
								<label class="block text-sm font-medium text-gray-700 mb-2">
									Kamera Seçimi
								</label>
								<select
									v-model="selectedVideoDevice"
									class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
								>
									<option
										v-for="device in videoDevices"
										:key="device.deviceId"
										:value="device.deviceId"
									>
										{{ device.label || `Kamera ${device.deviceId}` }}
									</option>
								</select>
							</div>

							<div class="mb-6">
								<label class="block text-sm font-medium text-gray-700 mb-2">
									Mikrofon Seçimi
								</label>
								<select
									v-model="selectedAudioDevice"
									class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
								>
									<option
										v-for="device in audioDevices"
										:key="device.deviceId"
										:value="device.deviceId"
									>
										{{ device.label || `Mikrofon ${device.deviceId}` }}
									</option>
								</select>
							</div>

							<!-- Önizleme -->
							<div class="mb-6 grid grid-cols-2 gap-4">
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-2">
										Ekran Önizleme
									</label>
									<video
										ref="preview"
										autoplay
										muted
										class="w-full rounded-lg bg-black"
									></video>
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-2">
										Kamera Önizleme
									</label>
									<video
										ref="cameraPreview"
										autoplay
										muted
										class="w-full rounded-lg bg-black"
									></video>
								</div>
							</div>

							<!-- Kontroller -->
							<div class="flex justify-center space-x-4">
								<button
									@click="startRecording"
									:disabled="isRecording"
									class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
								>
									Kaydı Başlat
								</button>
								<button
									@click="stopRecording"
									:disabled="!isRecording"
									class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
								>
									Kaydı Durdur
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useMediaDevices } from "~/composables/useMediaDevices";

const preview = ref<HTMLVideoElement | null>(null);
const cameraPreview = ref<HTMLVideoElement | null>(null);
let mediaRecorder: MediaRecorder | null = null;

const {
	videoDevices,
	audioDevices,
	selectedVideoDevice,
	selectedAudioDevice,
	isRecording,
	recordedChunks,
	getDevices,
	startRecording: startMediaStream,
	stopRecording: stopMediaStream,
	saveRecording,
} = useMediaDevices();

onMounted(async () => {
	await getDevices();
	// İlk yüklemede kamera önizlemesini başlat
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: {
				deviceId: selectedVideoDevice.value
					? { exact: selectedVideoDevice.value }
					: undefined,
			},
			audio: false,
		});
		if (cameraPreview.value) {
			cameraPreview.value.srcObject = stream;
		}
	} catch (error) {
		console.error("Kamera önizlemesi başlatılamadı:", error);
	}
});

const startRecording = async () => {
	try {
		const { screenStream, cameraStream } = await startMediaStream();
		if (preview.value && screenStream) {
			preview.value.srcObject = screenStream;
		}
		if (cameraPreview.value && cameraStream) {
			cameraPreview.value.srcObject = cameraStream;
		}
		if (screenStream && cameraStream) {
			const combinedStream = new MediaStream([
				...screenStream.getTracks(),
				...cameraStream.getTracks(),
			]);
			const options = {
				mimeType: "video/webm;codecs=h264,opus",
				videoBitsPerSecond: 2500000, // 2.5 Mbps
				audioBitsPerSecond: 128000, // 128 kbps
			};
			mediaRecorder = new MediaRecorder(combinedStream, options);
			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) {
					recordedChunks.value.push(e.data);
				}
			};
			mediaRecorder.onstop = () => {
				saveRecording(recordedChunks.value);
				recordedChunks.value = [];
			};
			mediaRecorder.start(1000); // Her 1 saniyede bir veri al
		}
	} catch (error) {
		console.error("Kayıt başlatılırken hata oluştu:", error);
	}
};

const stopRecording = () => {
	if (mediaRecorder && mediaRecorder.state !== "inactive") {
		mediaRecorder.stop();
		stopMediaStream();
		if (preview.value) {
			preview.value.srcObject = null;
		}
		if (cameraPreview.value) {
			cameraPreview.value.srcObject = null;
		}
	}
};
</script>
