import { ref, onMounted, onUnmounted, watch } from "vue";

export const useCursor = () => {
	// Varsayılan ayarlar
	const defaultSettings = {
		smoothing: true,
		size: 1,
		autoHide: true,
		loopPosition: false,
		highQuality: true,
		hideDelay: 2000,
		smoothingFactor: 0.15,
	};

	const settings = { ...defaultSettings };
	const cursorState = {
		isVisible: true,
		lastPosition: { x: 0, y: 0, timestamp: Date.now() },
		currentPosition: { x: 0, y: 0, timestamp: Date.now() },
		isMoving: false,
		lastMoveTime: Date.now(),
	};

	let hideTimeout = null;
	let animationFrame = null;
	const positionHistory = [];

	// İmleç pozisyonunu yumuşat
	const smoothCursorPosition = (targetX, targetY) => {
		if (!settings.value.smoothing) {
			cursorState.value.currentPosition = {
				x: targetX,
				y: targetY,
				timestamp: Date.now(),
			};
			return;
		}

		const animate = () => {
			const { x: currentX, y: currentY } = cursorState.value.currentPosition;
			const dx = targetX - currentX;
			const dy = targetY - currentY;

			// Eğer hareket çok küçükse animasyonu durdur
			if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
				if (animationFrame) {
					cancelAnimationFrame(animationFrame);
					animationFrame = null;
				}
				return;
			}

			cursorState.value.currentPosition = {
				x: currentX + dx * settings.value.smoothingFactor,
				y: currentY + dy * settings.value.smoothingFactor,
				timestamp: Date.now(),
			};

			animationFrame = requestAnimationFrame(animate);
		};

		if (!animationFrame) {
			animationFrame = requestAnimationFrame(animate);
		}
	};

	// İmleci otomatik gizle/göster
	const updateCursorVisibility = () => {
		if (!settings.value.autoHide) {
			cursorState.value.isVisible = true;
			return;
		}

		if (hideTimeout) {
			clearTimeout(hideTimeout);
		}

		cursorState.value.isVisible = true;
		hideTimeout = setTimeout(() => {
			if (!cursorState.value.isMoving) {
				cursorState.value.isVisible = false;
			}
		}, settings.value.hideDelay);
	};

	// Mouse hareketlerini takip et
	const handleMouseMove = (e) => {
		cursorState.value.lastPosition = { ...cursorState.value.currentPosition };
		cursorState.value.isMoving = true;
		cursorState.value.lastMoveTime = Date.now();

		// Pozisyon geçmişini güncelle
		positionHistory.push({
			x: e.clientX,
			y: e.clientY,
			timestamp: Date.now(),
		});

		// Son 100ms'lik pozisyonları tut
		while (
			positionHistory.length > 0 &&
			Date.now() - positionHistory[0].timestamp > 100
		) {
			positionHistory.shift();
		}

		// İmleç pozisyonunu yumuşat
		smoothCursorPosition(e.clientX, e.clientY);
		updateCursorVisibility();
	};

	// Hareket durumunu kontrol et
	const checkMovementStatus = () => {
		const now = Date.now();
		if (now - cursorState.value.lastMoveTime > 100) {
			cursorState.value.isMoving = false;
		}
	};

	// Döngüsel pozisyon için son konumu kaydet
	const saveInitialPosition = () => {
		if (settings.value.loopPosition) {
			cursorState.value.lastPosition = { ...cursorState.value.currentPosition };
		}
	};

	// Kayıt durumunu yönet
	const startRecording = () => {
		document.body.classList.add("recording");
		cursorState.value.isVisible = true;
		updateCursorVisibility();
	};

	const stopRecording = () => {
		document.body.classList.remove("recording");
		cursorState.value.isVisible = false;
	};

	// Event listener'ları ekle/kaldır
	onMounted(() => {
		document.addEventListener("mousemove", handleMouseMove);
		setInterval(checkMovementStatus, 100);
	});

	onUnmounted(() => {
		document.removeEventListener("mousemove", handleMouseMove);
		if (hideTimeout) clearTimeout(hideTimeout);
		if (animationFrame) cancelAnimationFrame(animationFrame);
	});

	// Ayarlar değiştiğinde gerekli güncellemeleri yap
	watch(
		() => settings.value,
		(newSettings) => {
			if (!newSettings.autoHide) {
				cursorState.value.isVisible = true;
				if (hideTimeout) {
					clearTimeout(hideTimeout);
					hideTimeout = null;
				}
			}
		},
		{ deep: true }
	);

	return {
		settings,
		cursorState,
		saveInitialPosition,
		updateCursorVisibility,
		startRecording,
		stopRecording,
	};
};
