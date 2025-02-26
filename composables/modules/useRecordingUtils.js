import { ref } from "vue";

export const useRecordingUtils = () => {
	const selectedDelay = ref(0);
	const mediaStream = ref(null);
	const isRecording = ref(false);

	// Kayıt yardımcıları için varsayılan konfigürasyon
	const defaultConfig = {
		countdownStyle:
			"fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xl !text-white bg-red-500/80 backdrop-blur-3xl border border-gray-700 rounded-full w-12 h-12 flex items-center justify-center z-50 countdown-number",
		recordingClass: "recording",
	};

	// Konfigürasyon state'i
	const config = ref({ ...defaultConfig });

	// Konfigürasyonu güncelleme fonksiyonu
	const updateConfig = (newConfig) => {
		config.value = {
			...config.value,
			...newConfig,
		};
		console.log("Kayıt yardımcıları konfigürasyonu güncellendi:", config.value);
	};

	const startCountdown = async () => {
		if (selectedDelay.value <= 0) return;

		const countdownElement = document.createElement("div");
		countdownElement.className = config.value.countdownStyle;

		document.body.appendChild(countdownElement);

		let countdown = selectedDelay.value / 1000;
		countdownElement.textContent = countdown;

		return new Promise((resolve) => {
			const countdownInterval = setInterval(() => {
				countdown--;
				countdownElement.textContent = countdown;

				if (countdown <= 0) {
					clearInterval(countdownInterval);
					document.body.removeChild(countdownElement);
					resolve();
				}
			}, 1000);
		});
	};

	const stopMediaStream = () => {
		try {
			if (mediaStream.value) {
				console.log(
					"MediaStream durduruluyor, track sayısı:",
					mediaStream.value.getTracks().length
				);

				const tracks = mediaStream.value.getTracks();
				console.log(`Toplam ${tracks.length} track durdurulacak`);

				for (const track of tracks) {
					try {
						if (track.readyState === "live") {
							track.stop();
							console.log(`Track durduruldu: ${track.kind}, id: ${track.id}`);
						} else {
							console.log(
								`Track zaten durdurulmuş: ${track.kind}, id: ${track.id}, durum: ${track.readyState}`
							);
						}
					} catch (trackError) {
						console.error(
							`Track durdurulurken hata: ${track.kind}, id: ${track.id}`,
							trackError
						);
					}
				}

				mediaStream.value = null;
				console.log("MediaStream temizlendi");
			} else {
				console.log("Durdurulacak MediaStream bulunamadı");
			}

			// Kayıt durumunu güncelle
			isRecording.value = false;
		} catch (error) {
			console.error("MediaStream durdurulurken hata:", error);
			// Hata durumunda da kayıt durumunu güncelle
			isRecording.value = false;
		}
	};

	return {
		selectedDelay,
		mediaStream,
		isRecording,
		config,
		updateConfig,
		startCountdown,
		stopMediaStream,
	};
};
