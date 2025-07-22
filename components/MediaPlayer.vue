<template>
	<div
		class="media-player w-full h-full m-auto rounded-lg overflow-hidden"
		@togglePlayback="togglePlay"
	>
		<div
			ref="containerRef"
			class="relative w-full h-full overflow-hidden flex items-center justify-center"
			:class="{
				'cursor-grab': !isVideoDragging && !isCameraDragging,
				'cursor-grabbing': isVideoDragging || isCameraDragging,
			}"
			@mousedown="handleMouseDown"
			@mousemove="handleMouseMove"
			@mouseup="handleMouseUp"
			@mouseleave="handleMouseUp"
			@wheel="handleWheel"
		>
			<div
				class="relative crop-area flex items-center justify-center"
				:style="{
					width: '100%',
					height: '100%',
					position: 'relative',
					overflow: 'hidden',
				}"
			>
				<canvas
					id="canvasID"
					ref="canvasRef"
					class="rounded-md"
					style="display: block; position: absolute; margin: auto"
				></canvas>
			</div>

			<!-- Ses -->
			<audio
				v-if="audioUrl"
				ref="audioRef"
				preload="metadata"
				:src="audioUrl"
				:type="audioType"
				@error="onAudioError"
			></audio>
		</div>

		<!-- Video Crop Modal -->
		<VideoCropModal
			v-if="showCropModal"
			:is-open="showCropModal"
			:video-src="props.videoUrl"
			@close="
				() => {
					showCropModal = false;
					emit('update:isCropMode', false);
					// Crop'u sıfırla
					cropArea.value = {
						x: 0,
						y: 0,
						width: videoElement.videoWidth,
						height: videoElement.videoHeight,
						isApplied: false,
					};
					// Canvas'ı güncelle
					requestAnimationFrame(() => updateCanvas(performance.now()));
				}
			"
			@crop-applied="handleCropApplied"
		/>
	</div>
</template>

<script setup>
import { nextTick, onUnmounted } from "vue";
import { useVideoZoom } from "~/composables/useVideoZoom";
import { useMouseCursor } from "~/composables/useMouseCursor";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import { useCameraRenderer } from "~/composables/useCameraRenderer";
import { useCameraDrag } from "~/composables/useCameraDrag";
import { useVideoDrag } from "~/composables/useVideoDrag";
import useDockSettings from "~/composables/useDockSettings";
import { calculateVideoDisplaySize } from "~/composables/utils/mousePosition";
import VideoCropModal from "~/components/player-settings/VideoCropModal.vue";
import { useLayoutRenderer } from "~/composables/useLayoutRenderer";

const emit = defineEmits([
	"videoLoaded",
	"videoEnded",
	"videoPaused",
	"timeUpdate",
	"cropChange",
	"play",
	"pause",
	"seeking",
	"seeked",
	"rateChange",
	"volumeChange",
	"fullscreenChange",
	"muteChange",
	"durationChanged",
	"openCameraSettings",
]);

const scaleValue = 3;

const props = defineProps({
	videoUrl: {
		type: String,
		default: "",
	},
	cameraUrl: {
		type: String,
		default: "",
	},
	audioUrl: {
		type: String,
		default: "",
	},
	videoType: {
		type: String,
		default: "video/mp4",
	},
	cameraType: {
		type: String,
		default: "video/webm",
	},
	audioType: {
		type: String,
		default: "audio/webm",
	},
	isPlaying: {
		type: Boolean,
		default: false,
	},
	currentTime: {
		type: Number,
		default: 0,
	},
	previewTime: {
		type: Number,
		default: null,
	},
	selectedAspectRatio: {
		type: String,
		default: "",
	},
	systemAudioEnabled: {
		type: Boolean,
		default: true,
	},
	isMuted: {
		type: Boolean,
		default: false,
	},
	segments: {
		type: Array,
		default: () => [],
	},
	mousePositions: {
		type: Array,
		default: () => [],
		validator: (value) => {
			return value.every(
				(pos) => typeof pos.x === "number" && typeof pos.y === "number"
			);
		},
	},
	cropInfo: {
		type: Object,
		default: () => ({
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			scale: 1,
		}),
	},
	isCropMode: {
		type: Boolean,
		default: false,
	},
});

// Player settings'i al
const {
	backgroundColor,
	backgroundImage,
	backgroundBlur,
	padding,
	radius,
	shadowSize,
	cropRatio,
	mouseSize,
	lastMouseX,
	lastMouseY,
	mouseMotionEnabled,
	motionBlurValue,
	zoomRanges,
	currentZoomRange,
	MOTION_BLUR_CONSTANTS,
	setCurrentZoomRange,
	cameraSettings,
	videoBorderSettings,
	mouseVisible,
	showDock, // Dock görünürlük ayarı
	dockSize,
} = usePlayerSettings();

// Dock ayarlarını al
const { isSupported: isDockSupported, visibleDockItems } = useDockSettings();

// Kamera renderer'ı al
const { drawCamera, isMouseOverCamera, lastCameraPosition } =
	useCameraRenderer();

// Video hover state
const isMouseOverVideo = ref(false);
const {
	isDragging: isCameraDragging,
	cameraPosition,
	startDrag: startCameraDrag,
	stopDrag: stopCameraDrag,
} = useCameraDrag();

// Video sürükleme yönetimi
const {
	isDragging: isVideoDragging,
	videoPosition,
	startDrag: startVideoDrag,
	stopDrag: stopVideoDrag,
} = useVideoDrag();

// Referanslar
const containerRef = ref(null);
const canvasRef = ref(null);
const audioRef = ref(null);
const videoRef = ref(null);
const cameraRef = ref(null);

// Context
let ctx = null;

// Video objesi
let videoElement = null;
let cameraElement = null;

// layout segment için
const { renderLayout } = useLayoutRenderer();

// Zoom yönetimi
const {
	scale,
	videoScale,
	targetScale,
	targetPosition,
	isZoomAnimating,
	lastZoomPosition,
	calculateZoomOrigin,
	applyZoomSegment,
	checkZoomSegments,
	cleanup: cleanupZoom,
} = useVideoZoom(videoElement, containerRef, canvasRef);

// Transform ve kırpma state'leri
const position = ref({ x: 0, y: 0 });
const dragStart = ref({ x: 0, y: 0 });
const cropArea = ref({ x: 0, y: 0, width: 0, height: 0 });
const videoSize = ref({ width: 0, height: 0 });
const selectedAspectRatio = ref("");
const lastSourceRatio = ref(null); // Add this line to track aspect ratio changes

// Render ve animasyon state'leri
let animationFrame = null;
let lastFrameTime = 0;
const FPS = 60;
const frameInterval = 1000 / FPS;

// Video state yönetimi
const videoState = ref({
	isPlaying: false,
	isPaused: true,
	isSeeking: false,
	isFullscreen: false,
	currentTime: 0,
	duration: 0,
	volume: 1,
	playbackRate: 1,
});

// Track if we've already emitted videoLoaded for this video
const hasEmittedVideoLoaded = ref(false);

// Video hover frame çizim fonksiyonları
const drawVideoHoverFrame = (ctx, x, y, width, height, dpr) => {
	const BORDER_WIDTH = 8;
	const BORDER_COLOR = "#3b82f6"; // Blue color
	const BORDER_OPACITY = 0.8;

	ctx.save();
	ctx.strokeStyle = BORDER_COLOR;
	ctx.lineWidth = BORDER_WIDTH * dpr;
	ctx.globalAlpha = BORDER_OPACITY;
	ctx.setLineDash([8 * dpr, 4 * dpr]);
	ctx.beginPath();
	ctx.rect(
		x - (BORDER_WIDTH * dpr) / 2,
		y - (BORDER_WIDTH * dpr) / 2,
		width + BORDER_WIDTH * dpr,
		height + BORDER_WIDTH * dpr
	);
	ctx.stroke();

	// Köşe işaretleri
	ctx.setLineDash([]);
	const handleSize = 12 * dpr;
	const handleOffset = 6 * dpr;

	ctx.lineWidth = 2 * dpr;
	ctx.globalAlpha = 1.0;

	// Köşe işaretlerini çiz
	drawVideoCornerHandle(
		ctx,
		x - handleOffset,
		y - handleOffset,
		handleSize,
		"tl"
	);
	drawVideoCornerHandle(
		ctx,
		x + width + handleOffset,
		y - handleOffset,
		handleSize,
		"tr"
	);
	drawVideoCornerHandle(
		ctx,
		x - handleOffset,
		y + height + handleOffset,
		handleSize,
		"bl"
	);
	drawVideoCornerHandle(
		ctx,
		x + width + handleOffset,
		y + height + handleOffset,
		handleSize,
		"br"
	);

	ctx.restore();
};

const drawVideoCornerHandle = (ctx, x, y, size, position) => {
	ctx.beginPath();

	const half = size / 2;

	switch (position) {
		case "tl": // Sol üst
			ctx.moveTo(x, y + half);
			ctx.lineTo(x, y);
			ctx.lineTo(x + half, y);
			break;
		case "tr": // Sağ üst
			ctx.moveTo(x - half, y);
			ctx.lineTo(x, y);
			ctx.lineTo(x, y + half);
			break;
		case "bl": // Sol alt
			ctx.moveTo(x, y - half);
			ctx.lineTo(x, y);
			ctx.lineTo(x + half, y);
			break;
		case "br": // Sağ alt
			ctx.moveTo(x - half, y);
			ctx.lineTo(x, y);
			ctx.lineTo(x, y - half);
			break;
	}

	ctx.stroke();
};

// Video hover state güncelleme fonksiyonu
const updateVideoHoverState = (mouseX, mouseY) => {
	if (!canvasRef.value || !videoRef.value) {
		isMouseOverVideo.value = false;
		return;
	}
	const { x, y, width, height } = getVideoDisplayRect();
	isMouseOverVideo.value =
		mouseX >= x &&
		mouseX <= x + width &&
		mouseY >= y &&
		mouseY <= y + height &&
		!isMouseOverCamera.value;
};

// Helper function to check if current time is in a valid segment
// Helper functions for segment clipping
const getSortedSegments = () => {
	if (!props.segments || props.segments.length === 0) return [];
	const sorted = [...props.segments].sort((a, b) => {
		const startA = a.start || a.startTime || 0;
		const startB = b.start || b.startTime || 0;
		return startA - startB;
	});

	// Debug log
	console.log(
		`[MediaPlayer] getSortedSegments:`,
		sorted.map((s, i) => `${i}: ${s.start}-${s.end}`)
	);
	return sorted;
};

const findSegmentAtTime = (time, segments) => {
	for (const segment of segments) {
		const start = segment.start || segment.startTime || 0;
		const end = segment.end || segment.endTime || 0;
		if (time >= start && time <= end) {
			return segment;
		}
	}
	return null;
};

const calculateClippedTime = (realTime, segments) => {
	let clippedTime = 0;

	console.log(
		`[MediaPlayer] calculateClippedTime: realTime=${realTime}, segments:`,
		segments.map((s) => `${s.start}-${s.end}`)
	);

	for (const segment of segments) {
		const start = segment.start || segment.startTime || 0;
		const end = segment.end || segment.endTime || 0;

		if (realTime >= start && realTime <= end) {
			// We're in this segment
			clippedTime += realTime - start;
			console.log(
				`[MediaPlayer] calculateClippedTime: Found in segment ${start}-${end}, clipped=${clippedTime}`
			);
			break;
		} else if (realTime > end) {
			// We've passed this segment completely
			clippedTime += end - start;
			console.log(
				`[MediaPlayer] calculateClippedTime: Passed segment ${start}-${end}, clipped+=${
					end - start
				} -> ${clippedTime}`
			);
		} else {
			// We haven't reached this segment yet
			console.log(
				`[MediaPlayer] calculateClippedTime: Haven't reached segment ${start}-${end} yet`
			);
			break;
		}
	}

	console.log(
		`[MediaPlayer] calculateClippedTime: Final clipped time=${clippedTime}`
	);
	return clippedTime;
};

// Tüm segmentlerin toplam süresini hesapla
const getTotalClippedDuration = (segments) => {
	if (!segments || segments.length === 0) return 0;

	return segments.reduce((total, segment) => {
		const start = segment.start || segment.startTime || 0;
		const end = segment.end || segment.endTime || 0;
		return total + (end - start);
	}, 0);
};

const checkIfTimeInValidSegment = (time) => {
	if (!props.segments || props.segments.length === 0) return true;

	return props.segments.some((segment) => {
		const start = segment.start || segment.startTime || 0;
		const end = segment.end || segment.endTime || 0;
		return time >= start && time <= end;
	});
};

// Video state yönetimi
const currentSegmentIndex = ref(0);
const isPlayingSegments = ref(false);

// Mouse pozisyonları için state
const mousePosition = ref({ x: 0, y: 0 });

// Zoom state'leri
const isZoomTransitioning = ref(false);
const previousScale = ref(1);

// Crop modal state
const showCropModal = ref(false);

// Video oynatma kontrolü
const togglePlay = async (e) => {
	e.preventDefault();
	e.stopPropagation();

	if (videoState.value.isPlaying) {
		await pause();
	} else {
		await play();
	}
};

const play = async () => {
	if (!videoElement) return;
	try {
		// Segment sistemi varsa özel logic
		if (props.segments && props.segments.length > 0) {
			const sortedSegments = getSortedSegments();
			const totalClippedDuration = getTotalClippedDuration(sortedSegments);
			const currentRealTime = videoElement.currentTime;
			const currentClippedTime = videoState.value.currentTime;

			console.log(
				`[MediaPlayer] Play başlatılıyor - currentClippedTime: ${currentClippedTime}, totalClippedDuration: ${totalClippedDuration}, currentRealTime: ${currentRealTime}`
			);
			console.log(
				`[MediaPlayer] Segments:`,
				sortedSegments.map((s) => `${s.start}-${s.end}`)
			);

			// Eğer clipped time sonda ise başa sar (ancak sadece tamamen sonda ise)
			if (currentClippedTime >= totalClippedDuration - 0.01) {
				const firstSegment = sortedSegments[0];
				const firstSegmentStart =
					firstSegment.start || firstSegment.startTime || 0;
				console.log(
					`[MediaPlayer] Clipped time tamamen sonda, başa sarılıyor: ${firstSegmentStart}`
				);
				await synchronizeAllElements(firstSegmentStart, 0);
			} else {
				// Mevcut clipped time'a karşılık gelen segment ve pozisyonu bul
				let targetRealTime = 0;
				let accumulatedClippedTime = 0;
				let targetSegment = null;

				console.log(
					`[MediaPlayer] Clipped time'dan real time hesaplama: ${currentClippedTime}`
				);

				// Clipped time'dan real time'ı hesapla
				for (let i = 0; i < sortedSegments.length; i++) {
					const segment = sortedSegments[i];
					const segmentStart = segment.start || segment.startTime || 0;
					const segmentEnd = segment.end || segment.endTime || 0;
					const segmentDuration = segmentEnd - segmentStart;

					console.log(
						`[MediaPlayer] Segment ${i}: ${segmentStart}-${segmentEnd}, duration: ${segmentDuration}, accumulated: ${accumulatedClippedTime}`
					);

					if (
						currentClippedTime >= accumulatedClippedTime &&
						currentClippedTime < accumulatedClippedTime + segmentDuration
					) {
						// Bu segment içinde
						const offsetInSegment = currentClippedTime - accumulatedClippedTime;
						targetRealTime = segmentStart + offsetInSegment;
						targetSegment = segment;
						console.log(
							`[MediaPlayer] Target segment bulundu: ${i}, offset: ${offsetInSegment}, targetRealTime: ${targetRealTime}`
						);
						break;
					}
					accumulatedClippedTime += segmentDuration;
				}

				// Eğer target segment bulunamadıysa (son segment'in sonunda)
				if (!targetSegment && sortedSegments.length > 0) {
					targetSegment = sortedSegments[sortedSegments.length - 1];
					targetRealTime = targetSegment.end || targetSegment.endTime || 0;
					console.log(
						`[MediaPlayer] Target segment bulunamadı, son segment'in sonuna gidiliyor: ${targetRealTime}`
					);
				}

				console.log(
					`[MediaPlayer] Target segment: ${
						targetSegment
							? `${targetSegment.start}-${targetSegment.end}`
							: "none"
					}, targetRealTime: ${targetRealTime}`
				);

				// Eğer mevcut real time ile target real time arasında fark varsa senkronize et
				if (Math.abs(currentRealTime - targetRealTime) > 0.1) {
					console.log(
						`[MediaPlayer] Real time senkronize ediliyor: ${currentRealTime} -> ${targetRealTime}`
					);
					await synchronizeAllElements(targetRealTime, currentClippedTime);
				} else {
					console.log(`[MediaPlayer] Real time zaten senkronize`);
				}
			}
		}

		// Oynatmayı başlat
		videoState.value.isPlaying = true;
		videoState.value.isPaused = false;

		try {
			await videoElement.play();
			if (cameraElement) {
				await cameraElement.play();
			}
			if (audioRef.value && audioRef.value.paused) {
				await audioRef.value.play();
			}
		} catch (error) {
			console.error("[MediaPlayer] Play error:", error);
			videoState.value.isPlaying = false;
			videoState.value.isPaused = true;
			throw error;
		}

		// Segment sistemi varsa sync kontrolü başlat
		if (props.segments && props.segments.length > 0) {
			startSyncCheck();
		}

		// Canvas animasyonunu başlat
		if (!animationFrame) {
			animationFrame = requestAnimationFrame(updateCanvas);
		}

		emit("play");
	} catch (error) {
		console.error("[MediaPlayer] Play error:", error);
		videoState.value.isPlaying = false;
		videoState.value.isPaused = true;
	}
};

// Tüm elementleri senkronize etme fonksiyonu
const synchronizeAllElements = async (realTime, clippedTime) => {
	try {
		console.log(
			`[MediaPlayer] synchronizeAllElements: realTime=${realTime}, clippedTime=${clippedTime}`
		);

		// Video'yu pozisyona getir
		videoElement.currentTime = realTime;

		// Kamerayı senkronize et
		if (cameraElement) {
			cameraElement.currentTime = realTime;
		}

		// Sesi senkronize et
		if (audioRef.value) {
			audioRef.value.currentTime = realTime;
		}

		// Clipped time'ı güncelle
		videoState.value.currentTime = clippedTime;

		// Canvas'ı güncelle
		requestAnimationFrame(() => {
			updateCanvas(performance.now());
		});

		// Time update event'ini emit et
		emit("timeUpdate", clippedTime);
	} catch (error) {
		console.error("[MediaPlayer] synchronizeAllElements error:", error);
	}
};

// Sync interval için değişken
let syncInterval = null;

// Sync kontrolü başlat - daha agresif segment kontrolü
const startSyncCheck = () => {
	if (syncInterval) {
		clearInterval(syncInterval);
	}

	// Her 25ms'de bir senkronizasyon kontrolü yap (daha sık)
	syncInterval = setInterval(() => {
		if (!videoState.value.isPlaying) {
			clearInterval(syncInterval);
			syncInterval = null;
			return;
		}

		// Segment sistemi varsa senkronizasyon kontrolü
		if (props.segments && props.segments.length > 0) {
			const currentRealTime = videoElement.currentTime;
			const sortedSegments = getSortedSegments();
			const currentSegment = findSegmentAtTime(currentRealTime, sortedSegments);
			const totalClippedDuration = getTotalClippedDuration(sortedSegments);

			if (currentSegment) {
				// Normal segment içinde
				const segmentEnd = currentSegment.end || currentSegment.endTime || 0;

				// Segment sonuna yaklaştıysak bir sonraki segment'e hazırlan
				if (currentRealTime >= segmentEnd - 0.05) {
					// Segment ID'si ile index bul (daha güvenli)
					let currentIndex = -1;
					for (let i = 0; i < sortedSegments.length; i++) {
						if (sortedSegments[i].id === currentSegment.id) {
							currentIndex = i;
							break;
						}
					}

					console.log(
						`[MediaPlayer] Current segment index: ${currentIndex} (ID: ${currentSegment.id})`
					);

					if (currentIndex >= 0) {
						const nextSegment = sortedSegments[currentIndex + 1];

						if (nextSegment) {
							// Jump to next segment
							const nextStart = nextSegment.start || nextSegment.startTime || 0;
							console.log(
								`[MediaPlayer] Segment geçişi: ${segmentEnd} -> ${nextStart} (Next ID: ${nextSegment.id})`
							);
							jumpToTime(nextStart);
							return;
						} else {
							// No more segments - end playback
							console.log(
								`[MediaPlayer] Son segment tamamlandı, oynatma bitiyor`
							);
							clearInterval(syncInterval);
							syncInterval = null;
							jumpToSegmentEnd();
							return;
						}
					} else {
						console.error(
							`[MediaPlayer] Current segment index not found! Segment ID: ${currentSegment.id}`
						);
					}
				}

				// Clipped time güncellemesi
				const calculatedClippedTime = calculateClippedTime(
					currentRealTime,
					sortedSegments
				);
				const constrainedClippedTime = Math.min(
					calculatedClippedTime,
					totalClippedDuration
				);

				if (
					Math.abs(videoState.value.currentTime - constrainedClippedTime) > 0.05
				) {
					videoState.value.currentTime = constrainedClippedTime;
					emit("timeUpdate", constrainedClippedTime);
				}
			} else {
				// Video segment dışında - acil müdahale
				console.log(
					`[MediaPlayer] Video segment dışında (${currentRealTime}), sıradaki segment'e geçiliyor`
				);
				const nextSegment = sortedSegments.find((segment) => {
					const start = segment.start || segment.startTime || 0;
					return start > currentRealTime;
				});

				if (nextSegment) {
					// Force jump to next segment
					const nextStart = nextSegment.start || nextSegment.startTime || 0;
					console.log(
						`[MediaPlayer] Sıradaki segment'e geçiliyor: ${nextStart}`
					);
					jumpToTime(nextStart);
					return;
				} else {
					// No more segments - force end
					console.log(`[MediaPlayer] Sıradaki segment yok, oynatma bitiyor`);
					clearInterval(syncInterval);
					syncInterval = null;
					jumpToSegmentEnd();
					return;
				}
			}
		}
	}, 25); // Çok daha sık kontrol (25ms) - segment geçişi için
};

const pause = async () => {
	if (!videoElement) return;
	try {
		if (!videoState.value.isPlaying) return;

		videoState.value.isPlaying = false;
		videoState.value.isPaused = true;

		// Sync interval'ı durdur
		if (syncInterval) {
			clearInterval(syncInterval);
			syncInterval = null;
		}

		try {
			await videoElement.pause();
			if (cameraElement) {
				await cameraElement.pause();
			}
			if (audioRef.value && !audioRef.value.paused) {
				await audioRef.value.pause();
			}
		} catch (error) {
			console.error("[MediaPlayer] Pause error:", error);
			videoState.value.isPlaying = true;
			videoState.value.isPaused = false;
			throw error;
		}

		// Canvas animasyonunu durdur
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
			animationFrame = null;
		}

		// Son frame'i çiz
		updateCanvas(performance.now());
		emit("pause");
	} catch (error) {
		console.error("[MediaPlayer] Pause error:", error);
	}
};

// Video scale animasyonu
const animateVideoScale = (timestamp) => {
	if (!ctx || !canvasRef.value || videoState.value.isPaused) return;

	// Store'dan gelen scale değerini kullan
	const targetScale = currentZoomRange.value ? currentZoomRange.value.scale : 1;
	const scaleDiff = targetScale - videoScale.value;

	// Smooth transition için lerp
	const lerpFactor = 0.1;
	if (Math.abs(scaleDiff) > 0.001) {
		videoScale.value += scaleDiff * lerpFactor;
		// Canvas'ı güncelle
		updateCanvas(timestamp);
		// Animasyonu devam ettir
		requestAnimationFrame(animateVideoScale);
	}
};

// Zoom range değişikliğini izle
watch(
	() => currentZoomRange.value,
	(newRange) => {
		if (!videoState.value.isPaused) {
			requestAnimationFrame(animateVideoScale);
		}
	}
);

// Segment değişikliklerini izle ve video clipping sistemini kur
watch(
	() => props.segments,
	(newSegments, oldSegments) => {
		if (!newSegments || !videoElement || newSegments.length === 0) return;

		// Segment'leri sırala
		const sortedSegments = [...newSegments].sort((a, b) => {
			const startA = a.start || a.startTime || 0;
			const startB = b.start || b.startTime || 0;
			return startA - startB;
		});

		// Video'nun görünen duration'ını segment'lerin toplam süresi yap
		const totalClippedDuration = sortedSegments.reduce((total, segment) => {
			const start = segment.start || segment.startTime || 0;
			const end = segment.end || segment.endTime || 0;
			const segmentDuration = end - start;
			return total + segmentDuration;
		}, 0);

		// Video state'ini güncelle - bu clipped duration
		videoState.value.duration = totalClippedDuration;

		// Duration değişikliğini bildir
		emit("durationChanged", totalClippedDuration);
	},
	{ deep: true, immediate: false, flush: "post" }
);

// Video zamanı güncellendiğinde
const onTimeUpdate = () => {
	if (!videoElement) return;

	const realVideoTime = videoElement.currentTime;

	// YENİ KUSURSUZ SEGMENT SİSTEMİ
	if (props.segments && props.segments.length > 0) {
		const sortedSegments = getSortedSegments();
		const totalClippedDuration = getTotalClippedDuration(sortedSegments);

		// Her zaman clipped time hesapla ve emit et
		const clippedTime = calculateClippedTime(realVideoTime, sortedSegments);
		const constrainedClippedTime = Math.min(clippedTime, totalClippedDuration);
		videoState.value.currentTime = constrainedClippedTime;
		emit("timeUpdate", constrainedClippedTime);

		// SADECE OYNATMA SIRASINDA segment geçiş kontrolü
		if (videoState.value.isPlaying) {
			// Hangi segment'te olduğumuzu clipped time ile bulalım
			let currentSegmentIndex = -1;
			let accumulatedClippedTime = 0;

			console.log(
				`[MediaPlayer] Finding segment for clipped time: ${constrainedClippedTime.toFixed(
					3
				)}`
			);

			for (let i = 0; i < sortedSegments.length; i++) {
				const segment = sortedSegments[i];
				const segmentDuration =
					(segment.end || segment.endTime || 0) -
					(segment.start || segment.startTime || 0);

				console.log(
					`[MediaPlayer] Segment ${i}: ${segment.start}-${
						segment.end
					}, duration: ${segmentDuration.toFixed(
						3
					)}, accumulated: ${accumulatedClippedTime.toFixed(3)}-${(
						accumulatedClippedTime + segmentDuration
					).toFixed(3)}`
				);

				// Normal range check VEYA son segment'in sonunda
				const isInRange =
					constrainedClippedTime >= accumulatedClippedTime &&
					constrainedClippedTime < accumulatedClippedTime + segmentDuration;
				const isAtEnd =
					i === sortedSegments.length - 1 &&
					constrainedClippedTime >= accumulatedClippedTime &&
					constrainedClippedTime <=
						accumulatedClippedTime + segmentDuration + 0.001; // 1ms tolerance

				if (isInRange || isAtEnd) {
					currentSegmentIndex = i;
					console.log(
						`[MediaPlayer] FOUND! Segment index: ${i} (${
							isAtEnd ? "at end" : "in range"
						})`
					);
					break;
				}
				accumulatedClippedTime += segmentDuration;
			}

			console.log(
				`[MediaPlayer] Final result - Real: ${realVideoTime.toFixed(
					3
				)}, Clipped: ${constrainedClippedTime.toFixed(
					3
				)}, Segment index: ${currentSegmentIndex}`
			);

			if (currentSegmentIndex >= 0) {
				// Mevcut segment'te segment sonuna yaklaştık mı kontrol et
				let segmentAccumulatedTime = 0;
				for (let i = 0; i < currentSegmentIndex; i++) {
					const seg = sortedSegments[i];
					segmentAccumulatedTime +=
						(seg.end || seg.endTime || 0) - (seg.start || seg.startTime || 0);
				}

				const currentSegment = sortedSegments[currentSegmentIndex];
				const segmentDuration =
					(currentSegment.end || currentSegment.endTime || 0) -
					(currentSegment.start || currentSegment.startTime || 0);
				const positionInSegment =
					constrainedClippedTime - segmentAccumulatedTime;

				console.log(
					`[MediaPlayer] Segment ${currentSegmentIndex}: ${
						currentSegment.start
					}-${currentSegment.end}, duration=${segmentDuration.toFixed(
						3
					)}, position=${positionInSegment.toFixed(3)}`
				);

				// BASIT VE GÜÇLÜ SEGMENT GEÇİŞİ
				if (positionInSegment >= segmentDuration - 0.1) {
					// Son 0.1 saniyede sonraki segment'e geç
					if (currentSegmentIndex + 1 < sortedSegments.length) {
						// Sonraki segment var - geç
						const nextSegment = sortedSegments[currentSegmentIndex + 1];
						const nextStart = nextSegment.start || nextSegment.startTime || 0;

						// Video element'i sonraki segment'e taşı
						videoElement.currentTime = nextStart;
						if (cameraElement) cameraElement.currentTime = nextStart;
						if (audioRef.value) audioRef.value.currentTime = nextStart;

						console.log(
							`[MediaPlayer] SEGMENT JUMP: ${currentSegmentIndex} → ${
								currentSegmentIndex + 1
							} (${nextStart})`
						);
						return;
					} else {
						// Son segment - bitir
						jumpToSegmentEnd();
						return;
					}
				}
			} else {
				// Hiçbir segment'te değiliz - bu durumda end
				console.log(
					`[MediaPlayer] Clipped time ${constrainedClippedTime.toFixed(
						3
					)} hiçbir segment'te değil - toplam segment: ${sortedSegments.length}`
				);
				console.log(
					`[MediaPlayer] Segment'ler:`,
					sortedSegments.map((s) => `${s.start}-${s.end}`)
				);
				jumpToSegmentEnd();
				return;
			}
		}
	} else {
		// No segments - normal playback
		videoState.value.currentTime = realVideoTime;
		emit("timeUpdate", realVideoTime);
	}

	// Canvas update
	if (videoState.value.isPlaying && !animationFrame) {
		animationFrame = requestAnimationFrame(updateCanvas);
	}
};

// Helper function to jump to a specific time and sync all elements
const jumpToTime = async (targetTime) => {
	if (!videoElement) return;

	console.log(
		`[MediaPlayer] jumpToTime called: ${targetTime}, current playing state: ${videoState.value.isPlaying}`
	);

	try {
		// Segment sistemi için clipped time hesapla
		if (props.segments && props.segments.length > 0) {
			const sortedSegments = getSortedSegments();
			const clippedTime = calculateClippedTime(targetTime, sortedSegments);
			const totalClippedDuration = getTotalClippedDuration(sortedSegments);
			const constrainedClippedTime = Math.min(
				clippedTime,
				totalClippedDuration
			);
			await synchronizeAllElements(targetTime, constrainedClippedTime);
		} else {
			// Segment yoksa normal sync
			await synchronizeAllElements(targetTime, targetTime);
		}
	} catch (error) {
		console.error("[MediaPlayer] jumpToTime error:", error);
	}
};

// Helper function to end segment playback
const jumpToSegmentEnd = async () => {
	try {
		console.log(
			`[MediaPlayer] jumpToSegmentEnd called - stopping playback, current sync interval:`,
			!!syncInterval
		);
		console.trace("[MediaPlayer] jumpToSegmentEnd stack trace:");
		// Stop playback immediately
		videoState.value.isPlaying = false;
		videoState.value.isPaused = true;

		// Stop sync interval completely
		if (syncInterval) {
			clearInterval(syncInterval);
			syncInterval = null;
			console.log(`[MediaPlayer] Sync interval durduruldu`);
		}

		// Pause all media elements
		if (videoElement && !videoElement.paused) {
			videoElement.pause();
		}
		if (cameraElement && !cameraElement.paused) {
			cameraElement.pause();
		}
		if (audioRef.value && !audioRef.value.paused) {
			audioRef.value.pause();
		}

		// Stop animation
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
			animationFrame = null;
		}

		// Video bitince başa dön (kullanıcı isteği)
		if (props.segments && props.segments.length > 0) {
			// Başa dön
			videoState.value.currentTime = 0;
			emit("timeUpdate", 0);
			console.log(`[MediaPlayer] Video bitince başa dönülüyor: 0`);
		}

		// Final canvas update
		updateCanvas(performance.now());

		// Emit video ended
		emit("videoEnded");
	} catch (error) {
		console.error("[MediaPlayer] Jump to segment end error:", error);
	}
};

// Pencere boyutu değiştiğinde
const handleResize = () => {
	if (!containerRef.value || !videoElement || !canvasRef.value || !ctx) return;

	// Container boyutlarını al
	const container = containerRef.value.getBoundingClientRect();
	const containerWidth = container.width;
	const containerHeight = container.height;

	// Video veya crop aspect ratio'sunu hesapla
	let sourceWidth, sourceHeight;
	if (cropArea.value?.isApplied) {
		sourceWidth = cropArea.value.width;
		sourceHeight = cropArea.value.height;
	} else {
		sourceWidth = videoElement.videoWidth;
		sourceHeight = videoElement.videoHeight;
	}
	const sourceRatio = sourceWidth / sourceHeight;
	const containerRatio = containerWidth / containerHeight;

	// Canvas boyutlarını container'a göre ayarla
	let canvasWidth, canvasHeight;
	if (!cropRatio.value || cropRatio.value === "auto") {
		// Auto modunda source aspect ratio'sunu koru
		if (sourceRatio > containerRatio) {
			canvasWidth = containerWidth;
			canvasHeight = containerWidth / sourceRatio;
		} else {
			canvasHeight = containerHeight;
			canvasWidth = containerHeight * sourceRatio;
		}
	} else {
		// Seçilen aspect ratio'yu kullan
		const [targetWidth, targetHeight] = cropRatio.value.split(":").map(Number);
		const targetRatio = targetWidth / targetHeight;

		if (containerRatio > targetRatio) {
			canvasHeight = containerHeight;
			canvasWidth = containerHeight * targetRatio;
		} else {
			canvasWidth = containerWidth;
			canvasHeight = containerWidth / targetRatio;
		}
	}

	// DPR'ı kullanarak canvas çözünürlüğünü artır
	const dpr = window.devicePixelRatio || 1;
	canvasRef.value.width = canvasWidth * dpr * scaleValue;
	canvasRef.value.height = canvasHeight * dpr * scaleValue;

	// Canvas stil boyutlarını ayarla (CSS pixels)
	canvasRef.value.style.width = `${canvasWidth}px`;
	canvasRef.value.style.height = `${canvasHeight}px`;

	// Canvas'ı daima merkezde tutmak için
	position.value = { x: 0, y: 0 };
	videoPosition.value = { x: 0, y: 0 };

	// Canvas transform ayarları
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	// Canvas'ı hemen güncelle
	requestAnimationFrame(() => updateCanvas(performance.now()));

	// Değişiklikleri emit et
	emit("cropChange", getCropData());
};

// Kırpma alanını güncelle
const updateCropArea = () => {
	if (!containerRef.value || !videoElement || !canvasRef.value || !ctx) return;

	// Container boyutlarını al
	const container = containerRef.value.getBoundingClientRect();
	const containerWidth = container.width;
	const containerHeight = container.height;

	// Video veya crop aspect ratio'sunu hesapla
	let sourceWidth, sourceHeight;
	if (cropArea.value?.isApplied) {
		sourceWidth = cropArea.value.width;
		sourceHeight = cropArea.value.height;
	} else {
		sourceWidth = videoElement.videoWidth;
		sourceHeight = videoElement.videoHeight;
	}
	const sourceRatio = sourceWidth / sourceHeight;
	const containerRatio = containerWidth / containerHeight;

	// Canvas boyutlarını container'a göre ayarla
	let canvasWidth, canvasHeight;
	if (!cropRatio.value || cropRatio.value === "auto") {
		// Auto modunda source aspect ratio'sunu kullan
		if (sourceRatio > containerRatio) {
			canvasWidth = containerWidth;
			canvasHeight = containerWidth / sourceRatio;
		} else {
			canvasHeight = containerHeight;
			canvasWidth = containerHeight * sourceRatio;
		}
	} else {
		// Seçilen aspect ratio'yu kullan
		const [targetWidth, targetHeight] = cropRatio.value.split(":").map(Number);
		const targetRatio = targetWidth / targetHeight;

		if (containerRatio > targetRatio) {
			canvasHeight = containerHeight;
			canvasWidth = containerHeight * targetRatio;
		} else {
			canvasWidth = containerWidth;
			canvasHeight = containerWidth / targetRatio;
		}
	}

	// DPR'ı kullanarak canvas çözünürlüğünü artır
	const dpr = window.devicePixelRatio || 1;
	canvasRef.value.width = canvasWidth * dpr * scaleValue;
	canvasRef.value.height = canvasHeight * dpr * scaleValue;

	// Canvas stil boyutlarını ayarla (CSS pixels)
	canvasRef.value.style.width = `${canvasWidth}px`;
	canvasRef.value.style.height = `${canvasHeight}px`;

	// Canvas'ı daima merkezde tutmak için
	position.value = { x: 0, y: 0 };
	videoPosition.value = { x: 0, y: 0 };

	// Canvas transform ayarları
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	// Canvas'ı hemen güncelle
	requestAnimationFrame(() => updateCanvas(performance.now()));

	// Değişiklikleri emit et
	emit("cropChange", getCropData());
};

const updateDragPosition = (e) => {
	position.value = {
		x: e.clientX - dragStart.value.x,
		y: e.clientY - dragStart.value.y,
	};

	// Direkt olarak canvas'ı güncelle
	requestAnimationFrame(() => {
		updateCanvas(performance.now());
	});
};

// Video bittiğinde
const onVideoEnded = () => {
	console.log(
		`[MediaPlayer] onVideoEnded called - isPlaying: ${videoState.value.isPlaying}, real time: ${videoElement?.currentTime}`
	);

	// Segment sistemi varsa özel logic
	if (props.segments && props.segments.length > 0) {
		// Sadece video oynatılırken ended event'i kabul et
		// Elle seek yapılırken ended olmamalı
		if (videoState.value.isPlaying) {
			console.log(
				`[MediaPlayer] Video ended during playback - calling jumpToSegmentEnd`
			);
			jumpToSegmentEnd();
		} else {
			console.log(`[MediaPlayer] Video ended while paused - ignoring`);
		}
		return;
	}

	// Normal video ended logic (segment yoksa)
	videoState.value.isPlaying = false;
	videoState.value.isPaused = true;

	// Sync interval'ı durdur
	if (syncInterval) {
		clearInterval(syncInterval);
		syncInterval = null;
	}

	// Sesi ve kamerayı durdur
	if (audioRef.value) {
		audioRef.value.pause();
	}
	if (cameraElement) {
		cameraElement.pause();
	}

	// Canvas animasyonunu durdur
	if (animationFrame) {
		cancelAnimationFrame(animationFrame);
		animationFrame = null;
	}

	// Event'i emit et
	emit("videoEnded");
};

// Video hatası
const onVideoError = (error) => {
	console.error("[MediaPlayer] Video hatası:", {
		error: error?.message || "Bilinmeyen hata",
		code: videoElement?.error?.code,
		message: videoElement?.error?.message,
		src: videoElement?.src,
		readyState: videoElement?.readyState,
		networkState: videoElement?.networkState,
	});

	// Video error durumunda playback'i durdur
	console.log("[MediaPlayer] Video error - calling jumpToSegmentEnd");
	jumpToSegmentEnd();
};

// Ses hatası
const onAudioError = (error) => {
	console.error("[MediaPlayer] Ses hatası:", error);
};

// Aspect ratio güncelleme
const updateAspectRatio = (ratio) => {
	selectedAspectRatio.value = ratio;
	cropRatio.value = ratio;
	updateCropArea();
};

// Aspect ratio değişikliğini izle
watch(
	cropRatio,
	(newRatio) => {
		updateCropArea();
	},
	{ immediate: true }
);

// Props'ları izle
watch(
	() => props.selectedAspectRatio,
	(newRatio) => {
		if (newRatio) {
			updateAspectRatio(newRatio);
		}
	},
	{ immediate: true }
);

// Kırpma verilerini al
const getCropData = () => {
	if (!containerRef.value || !videoElement) return null;

	const container = containerRef.value.getBoundingClientRect();
	const videoWidth = videoElement.videoWidth;
	const videoHeight = videoElement.videoHeight;

	// Seçilen aspect ratio yoksa null döndür
	if (!cropRatio.value) return null;

	// Canvas koordinatlarını video koordinatlarına dönüştür
	const canvasToVideo = (canvasX, canvasY, canvasWidth, canvasHeight) => {
		// Padding'i hesaba katarak kullanılabilir alanı hesapla
		const availableWidth = cropArea.value.width - padding.value * 2;
		const availableHeight = cropArea.value.height - padding.value * 2;

		// Canvas'taki oranı hesapla
		const scaleX = videoWidth / availableWidth;
		const scaleY = videoHeight / availableHeight;

		// Padding'i hesaba katarak dönüştür
		return {
			x: Math.round((canvasX - padding.value) * scaleX),
			y: Math.round((canvasY - padding.value) * scaleY),
			width: Math.round(canvasWidth * scaleX),
			height: Math.round(canvasHeight * scaleY),
		};
	};

	// Kırpma alanını video koordinatlarına dönüştür
	const videoCoords = canvasToVideo(
		padding.value,
		padding.value,
		cropArea.value.width - padding.value * 2,
		cropArea.value.height - padding.value * 2
	);

	return {
		...videoCoords,
		scale: scale.value,
		aspectRatio: cropRatio.value,
	};
};

// Mouse cursor yönetimi
const {
	drawMousePosition,
	currentCursorType,
	isMouseDown,
	isDragging,
	MOUSE_EVENTS,
} = useMouseCursor(MOTION_BLUR_CONSTANTS);

// Mouse pozisyonlarını çiz
const drawMousePositions = () => {
	// Debug: Mouse cursor durumunu logla
	if (typeof drawMousePositions.debugCounter === "undefined") {
		drawMousePositions.debugCounter = 0;
	}

	drawMousePositions.debugCounter++;

	// Her 60 frame'de bir debug log
	if (drawMousePositions.debugCounter % 60 === 0) {
	}

	// Mouse görünürlüğü kapalıysa çizme
	if (!mouseVisible.value) {
		if (drawMousePositions.debugCounter % 60 === 0) {
		}
		return;
	}

	if (!props.mousePositions || !canvasRef.value || !videoElement) {
		if (drawMousePositions.debugCounter % 60 === 0) {
		}
		return;
	}

	const ctx = canvasRef.value.getContext("2d");
	if (!ctx) return;

	// Video süresini al
	const videoDuration = videoElement.duration;
	if (!videoDuration) return;

	// Current video time
	const currentVideoTime = videoElement.currentTime;

	// Add static variable for tracking transition state between draws
	// We need to use a closure variable since this function gets called repeatedly
	if (typeof drawMousePositions.lastIsStationary === "undefined") {
		drawMousePositions.lastIsStationary = true;
		drawMousePositions.transitionFactor = 0;
		drawMousePositions.lastUpdateTime = performance.now();
		drawMousePositions.lastVelocity = { x: 0, y: 0 };
		drawMousePositions.lastPosition = { x: 0, y: 0, timestamp: 0 };
	}

	// Mouse pozisyonları için toplam frame sayısı
	const totalFrames = props.mousePositions.length;
	if (totalFrames < 2) return;

	// Find closest positions by timestamp
	// First, convert video time to timestamp in the recorded data
	const frameTime = videoDuration / totalFrames;

	// Find the two closest points in time
	let prevIndex = -1;
	let nextIndex = -1;
	let prevTimeDiff = Infinity;
	let nextTimeDiff = Infinity;

	// Segment sisteminde clipped time kullan
	const effectiveTime =
		props.segments && props.segments.length > 0
			? videoState.value.currentTime // Clipped time
			: currentVideoTime; // Normal time

	// Segment sisteminde toplam süreyi hesapla
	const effectiveDuration =
		props.segments && props.segments.length > 0
			? getTotalClippedDuration(props.segments)
			: videoDuration;

	// Calculate normalized time (0-1 scale) for current video position
	// Ensure effectiveTime doesn't exceed effectiveDuration
	const constrainedEffectiveTime = Math.min(effectiveTime, effectiveDuration);
	const normalizedTime = constrainedEffectiveTime / effectiveDuration;
	const estimatedTimestamp =
		normalizedTime * props.mousePositions[totalFrames - 1].timestamp;

	// Find the two points surrounding the current time
	for (let i = 0; i < totalFrames; i++) {
		const pos = props.mousePositions[i];
		const timeDiff = pos.timestamp - estimatedTimestamp;

		if (timeDiff <= 0 && Math.abs(timeDiff) < prevTimeDiff) {
			prevTimeDiff = Math.abs(timeDiff);
			prevIndex = i;
		}

		if (timeDiff >= 0 && timeDiff < nextTimeDiff) {
			nextTimeDiff = timeDiff;
			nextIndex = i;
		}
	}

	// Fallbacks if we couldn't find proper indices
	if (prevIndex === -1) prevIndex = 0;
	if (nextIndex === -1 || nextIndex === prevIndex)
		nextIndex = Math.min(prevIndex + 1, totalFrames - 1);

	const prevPos = props.mousePositions[prevIndex];
	const nextPos = props.mousePositions[nextIndex];

	// Update cursor type based on current position
	if (prevPos.cursorType) {
		currentCursorType.value = prevPos.cursorType;
	}

	// DPR'ı hesaba kat
	const dpr = window.devicePixelRatio || 1;

	// Calculate movement distance
	const moveDistance = Math.sqrt(
		Math.pow(nextPos.x - prevPos.x, 2) + Math.pow(nextPos.y - prevPos.y, 2)
	);

	// Calculate time difference between frames in milliseconds
	const timeDiff = nextPos.timestamp - prevPos.timestamp;

	// Define thresholds for stationary detection - daha kararlı eşikler
	const MOVEMENT_THRESHOLD = 8; // pixels - düşürüldü, daha duyarlı olması için
	const TIME_THRESHOLD = 150; // milliseconds - artırıldı, daha kararlı olması için

	// Determine if the mouse is truly stationary
	const isStationary =
		moveDistance < MOVEMENT_THRESHOLD || timeDiff > TIME_THRESHOLD;

	// Calculate current mouse velocity
	const velocity = {
		x: timeDiff > 0 ? (nextPos.x - prevPos.x) / timeDiff : 0,
		y: timeDiff > 0 ? (nextPos.y - prevPos.y) / timeDiff : 0,
	};

	// Calculate velocity magnitude (speed)
	const velocityMagnitude = Math.sqrt(
		velocity.x * velocity.x + velocity.y * velocity.y
	);

	// Handle transition between stationary and moving states
	const now = performance.now();
	const deltaTime = Math.min(now - drawMousePositions.lastUpdateTime, 50); // Limit to 50ms to avoid jumps
	drawMousePositions.lastUpdateTime = now;

	// Calculate transition speed based on velocity - faster for quick movements
	const baseTransitionSpeed = 0.008; // Base transition speed - lower for smoother transitions
	const velocityFactor = Math.min(velocityMagnitude * 0.5, 1.0); // Velocitye bağlı faktör
	const TRANSITION_SPEED_IN = baseTransitionSpeed * (1 + velocityFactor); // Hızlanırken daha hızlı
	const TRANSITION_SPEED_OUT = baseTransitionSpeed * 0.7; // Yavaşlarken daha yumuşak

	// Update transition based on velocity and stationary state
	if (isStationary) {
		// Moving to stationary - smooth out
		drawMousePositions.transitionFactor = Math.max(
			0,
			drawMousePositions.transitionFactor - TRANSITION_SPEED_OUT * deltaTime
		);
	} else {
		// Stationary to moving - quicker
		drawMousePositions.transitionFactor = Math.min(
			1,
			drawMousePositions.transitionFactor + TRANSITION_SPEED_IN * deltaTime
		);
	}

	// Calculate interpolation factor (how far between prev and next)
	let fraction = 0;
	if (timeDiff > 0) {
		fraction = (estimatedTimestamp - prevPos.timestamp) / timeDiff;
		// Clamp fraction between 0 and 1 and smooth it out
		fraction = Math.max(0, Math.min(1, fraction));
		fraction = smoothstep(0, 1, fraction);
	}

	// Save state for next frame with improved position tracking
	drawMousePositions.lastIsStationary = isStationary;
	drawMousePositions.lastVelocity = velocity;
	drawMousePositions.lastPosition = {
		x: lerp(prevPos.x, nextPos.x, fraction),
		y: lerp(prevPos.y, nextPos.y, fraction),
		timestamp: estimatedTimestamp,
		cursorType: prevPos.cursorType,
	};

	// Apply transition factor to interpolation with improved smoothing
	let interpolatedX, interpolatedY;
	let dirX = 0,
		dirY = 0;
	let speed = 0;

	if (drawMousePositions.transitionFactor < 0.01) {
		// Almost fully stationary - use smoothed previous position
		interpolatedX = lerp(drawMousePositions.lastPosition.x, prevPos.x, 0.85);
		interpolatedY = lerp(drawMousePositions.lastPosition.y, prevPos.y, 0.85);
	} else if (drawMousePositions.transitionFactor > 0.99) {
		// Almost fully in motion - use smoothed interpolation
		interpolatedX = lerp(prevPos.x, nextPos.x, fraction);
		interpolatedY = lerp(prevPos.y, nextPos.y, fraction);

		// Calculate direction and speed for motion effects with improved smoothing
		if (moveDistance > 0) {
			dirX = lerp(
				0,
				(nextPos.x - prevPos.x) / moveDistance,
				drawMousePositions.transitionFactor
			);
			dirY = lerp(
				0,
				(nextPos.y - prevPos.y) / moveDistance,
				drawMousePositions.transitionFactor
			);
			speed =
				timeDiff > 0
					? lerp(
							0,
							moveDistance / timeDiff,
							drawMousePositions.transitionFactor
					  )
					: 0;
		}
	} else {
		// In transition - blend between stationary and motion
		const stationaryX = lerp(
			drawMousePositions.lastPosition.x,
			prevPos.x,
			0.85
		);
		const stationaryY = lerp(
			drawMousePositions.lastPosition.y,
			prevPos.y,
			0.85
		);
		const motionX = lerp(prevPos.x, nextPos.x, fraction);
		const motionY = lerp(prevPos.y, nextPos.y, fraction);

		interpolatedX = lerp(
			stationaryX,
			motionX,
			drawMousePositions.transitionFactor
		);
		interpolatedY = lerp(
			stationaryY,
			motionY,
			drawMousePositions.transitionFactor
		);

		if (moveDistance > 0) {
			dirX = lerp(
				0,
				(nextPos.x - prevPos.x) / moveDistance,
				drawMousePositions.transitionFactor
			);
			dirY = lerp(
				0,
				(nextPos.y - prevPos.y) / moveDistance,
				drawMousePositions.transitionFactor
			);
			speed =
				timeDiff > 0
					? lerp(
							0,
							moveDistance / timeDiff,
							drawMousePositions.transitionFactor
					  )
					: 0;
		}
	}

	// Helper functions for smooth interpolation
	function lerp(start, end, t) {
		return start * (1 - t) + end * t;
	}

	function smoothstep(min, max, value) {
		const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
		return x * x * (3 - 2 * x);
	}

	// Rest of the existing code for video/crop dimensions and cursor rendering
	// Video veya crop boyutlarını kullan
	let sourceWidth, sourceHeight, sourceX, sourceY;
	if (cropArea.value?.isApplied) {
		sourceWidth = cropArea.value.width;
		sourceHeight = cropArea.value.height;
		sourceX = cropArea.value.x;
		sourceY = cropArea.value.y;
	} else {
		sourceWidth = videoElement.videoWidth;
		sourceHeight = videoElement.videoHeight;
		sourceX = 0;
		sourceY = 0;
	}

	// Padding'i hesaba kat
	const paddingValue = padding.value * dpr;

	// Video'nun canvas içindeki pozisyonunu hesapla
	const {
		displayWidth,
		displayHeight,
		videoX: displayX,
		videoY: displayY,
	} = calculateVideoDisplaySize(
		sourceWidth,
		sourceHeight,
		canvasRef.value.width,
		canvasRef.value.height,
		paddingValue
	);

	// Mouse pozisyonunu video koordinatlarından canvas koordinatlarına çevir
	let canvasX, canvasY;

	// Önce zoom durumunu kontrol et ve zoom origin'i hesapla
	let zoomOriginX = displayX;
	let zoomOriginY = displayY;
	if (videoScale.value > 1.001) {
		const activeZoom = checkZoomSegments(
			videoElement.currentTime,
			zoomRanges.value
		);

		// Raw zoom origin hesapla
		const rawDynamicOrigin = {
			x: ((interpolatedX - sourceX) / sourceWidth) * 100,
			y: ((interpolatedY - sourceY) / sourceHeight) * 100,
		};

		// Zoom tracking için smoothing - static global variable
		if (typeof window.smoothZoomOrigin === "undefined") {
			window.smoothZoomOrigin = {
				x: rawDynamicOrigin.x,
				y: rawDynamicOrigin.y,
			};
		}

		// Zoom movement hızını hesapla
		const zoomDx = rawDynamicOrigin.x - window.smoothZoomOrigin.x;
		const zoomDy = rawDynamicOrigin.y - window.smoothZoomOrigin.y;
		const zoomMoveSpeed = Math.sqrt(zoomDx * zoomDx + zoomDy * zoomDy);

		// Hızlı hareket = daha az smoothing (daha responsive)
		// Yavaş hareket = daha fazla smoothing (daha stable)
		const smoothFactor = Math.max(
			0.08,
			Math.min(0.35, 0.2 / (zoomMoveSpeed + 1))
		);

		// Smooth zoom origin hesapla
		window.smoothZoomOrigin.x +=
			(rawDynamicOrigin.x - window.smoothZoomOrigin.x) * smoothFactor;
		window.smoothZoomOrigin.y +=
			(rawDynamicOrigin.y - window.smoothZoomOrigin.y) * smoothFactor;

		const zoomOrigin = calculateZoomOrigin(
			window.smoothZoomOrigin, // Raw yerine smooth kullan
			displayX,
			displayY,
			displayWidth,
			displayHeight,
			displayX + displayWidth / 2,
			displayY + displayHeight / 2
		);
		zoomOriginX = zoomOrigin.originX;
		zoomOriginY = zoomOrigin.originY;
		lastZoomPosition.value = window.smoothZoomOrigin;
	}

	if (cropArea.value?.isApplied) {
		// Crop uygulanmışsa, mouse pozisyonunu crop alanına göre normalize et
		const normalizedX = (interpolatedX - sourceX) / sourceWidth;
		const normalizedY = (interpolatedY - sourceY) / sourceHeight;

		// Zoom'u hesaba katarak pozisyonu hesapla
		const baseX = displayX + normalizedX * displayWidth;
		const baseY = displayY + normalizedY * displayHeight;

		if (videoScale.value > 1.001) {
			canvasX =
				zoomOriginX +
				(baseX - zoomOriginX) * videoScale.value +
				position.value.x;
			canvasY =
				zoomOriginY +
				(baseY - zoomOriginY) * videoScale.value +
				position.value.y;
		} else {
			canvasX = baseX + position.value.x;
			canvasY = baseY + position.value.y;
		}
	} else {
		// Crop uygulanmamışsa normal hesaplama yap
		const baseX =
			displayX + (interpolatedX / videoElement.videoWidth) * displayWidth;
		const baseY =
			displayY + (interpolatedY / videoElement.videoHeight) * displayHeight;

		if (videoScale.value > 1.001) {
			canvasX =
				zoomOriginX +
				(baseX - zoomOriginX) * videoScale.value +
				position.value.x;
			canvasY =
				zoomOriginY +
				(baseY - zoomOriginY) * videoScale.value +
				position.value.y;
		} else {
			canvasX = baseX + position.value.x;
			canvasY = baseY + position.value.y;
		}
	}

	// Mouse cursor'ı çiz
	drawMousePosition(ctx, {
		x: canvasX,
		y: canvasY,
		event: {
			type: prevPos.type || MOUSE_EVENTS.MOVE,
			button: prevPos.button,
			clickCount: prevPos.clickCount,
			rotation: prevPos.rotation,
			direction: prevPos.direction,
			cursorType: prevPos.cursorType || "default", // Add cursor type from position data
			speed,
			dirX,
			dirY,
		},
		size: mouseSize.value,
		dpr,
		motionEnabled: mouseMotionEnabled.value,
		motionBlurValue: motionBlurValue.value,
		visible: mouseVisible.value,
	});

	// Kamera pozisyonunu güncelle
	if (cameraElement && cameraSettings.value.followMouse) {
		// Kamera için offset değerleri
		const offsetX = 100 * dpr; // Yatay mesafeyi artır
		const offsetY = 100 * dpr; // Dikey mesafeyi artır
		const PADDING = 20 * dpr; // Kenarlardan minimum mesafe

		// Mouse pozisyonunu video pozisyonuna göre normalize et
		const normalizedMouseX = canvasX - position.value.x;
		const normalizedMouseY = canvasY - position.value.y;

		// Hedef pozisyonu hesapla (normalize edilmiş mouse pozisyonuna göre)
		let targetX = normalizedMouseX + offsetX;
		let targetY = normalizedMouseY + offsetY;

		// Kamera boyutlarını al
		const cameraWidth =
			(canvasRef.value.width * cameraSettings.value.size) / 100;
		const cameraHeight = cameraWidth;

		// Canvas sınırları içinde kal
		targetX = Math.max(
			PADDING,
			Math.min(targetX, canvasRef.value.width - cameraWidth - PADDING)
		);
		targetY = Math.max(
			PADDING,
			Math.min(targetY, canvasRef.value.height - cameraHeight - PADDING)
		);

		// Smooth geçiş için lerp faktörü
		const lerpFactor = 0.2;

		// İlk pozisyonu ayarla
		if (!lastCameraX.value) lastCameraX.value = targetX;
		if (!lastCameraY.value) lastCameraY.value = targetY;

		// Lerp ile yumuşak geçiş uygula
		lastCameraX.value += (targetX - lastCameraX.value) * lerpFactor;
		lastCameraY.value += (targetY - lastCameraY.value) * lerpFactor;

		// Kamera pozisyonunu güncelle (video pozisyonunu ekleyerek)
		lastCameraPosition.value = {
			x: lastCameraX.value + position.value.x,
			y: lastCameraY.value + position.value.y,
		};
	}

	// Tooltip çizim fonksiyonu
	function drawCameraFollowTooltip(ctx, cameraRect, dpr) {
		const text =
			"Camera is currently following the mouse cursor, you can disable this in settings";
		ctx.save();
		ctx.font = `${64 * dpr}px Inter, Arial, sans-serif`;
		const textMetrics = ctx.measureText(text);
		const textWidth = textMetrics.width;
		const paddingX = 32 * dpr;
		const paddingY = 16 * dpr;
		const radius = 16 * dpr;
		const boxWidth = textWidth + paddingX * 2;
		const boxHeight = 128 * dpr;
		// Tooltip'i cameraRect'in üstünde ve ortalanmış şekilde, 12px yukarıda göster
		const boxX = cameraRect.x + cameraRect.width / 2 - boxWidth / 2;
		const boxY = cameraRect.y - boxHeight - 12 * dpr;

		// Arka plan (siyah, radiuslu)
		ctx.beginPath();
		ctx.moveTo(boxX + radius, boxY);
		ctx.lineTo(boxX + boxWidth - radius, boxY);
		ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + radius);
		ctx.lineTo(boxX + boxWidth, boxY + boxHeight - radius);
		ctx.quadraticCurveTo(
			boxX + boxWidth,
			boxY + boxHeight,
			boxX + boxWidth - radius,
			boxY + boxHeight
		);
		ctx.lineTo(boxX + radius, boxY + boxHeight);
		ctx.quadraticCurveTo(
			boxX,
			boxY + boxHeight,
			boxX,
			boxY + boxHeight - radius
		);
		ctx.lineTo(boxX, boxY + radius);
		ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
		ctx.closePath();
		ctx.fillStyle = "rgba(0,0,0,0.8)";
		ctx.fill();

		// Yazı (beyaz)
		ctx.fillStyle = "#fff";
		ctx.textBaseline = "middle";
		ctx.fillText(text, boxX + paddingX, boxY + boxHeight / 2);
		ctx.restore();
	}

	// updateCanvas içinde, kamera followMouse aktifse ve mouse kamera üstündeyse tooltip çiz
	if (cameraSettings.value.followMouse && isMouseOverCamera.value) {
		// Kamera alanı koordinatlarını hesapla
		const cameraRect = getCameraDisplayRect(); // getCameraDisplayRect fonksiyonu yoksa, camera'nın canvas üzerindeki x, y, width, height değerlerini hesapla
		drawCameraFollowTooltip(ctx, cameraRect, window.devicePixelRatio || 1);
	}
};

// getCameraDisplayRect fonksiyonu (video için olanın aynısı, cameraElement ve camera pozisyonu ile)
function getCameraDisplayRect() {
	if (!canvasRef.value || !cameraElement)
		return { x: 0, y: 0, width: 0, height: 0 };
	const dpr = window.devicePixelRatio || 1;
	const canvasWidth = canvasRef.value.width;
	const canvasHeight = canvasRef.value.height;
	let sourceWidth = cameraElement.videoWidth;
	let sourceHeight = cameraElement.videoHeight;
	const sourceRatio = sourceWidth / sourceHeight;
	const availableWidth = canvasWidth - padding.value * 2 * dpr;
	const availableHeight = canvasHeight - padding.value * 2 * dpr;
	const availableRatio = availableWidth / availableHeight;
	let drawWidth, drawHeight, x, y;
	if (sourceRatio > availableRatio) {
		drawWidth = availableWidth;
		drawHeight = drawWidth / sourceRatio;
		x = padding.value * dpr;
		y = padding.value * dpr + (availableHeight - drawHeight) / 2;
	} else {
		drawHeight = availableHeight;
		drawWidth = drawHeight * sourceRatio;
		x = padding.value * dpr + (availableWidth - drawWidth) / 2;
		y = padding.value * dpr;
	}
	const offsetX = (cameraPosition.value?.x || 0) * dpr;
	const offsetY = (cameraPosition.value?.y || 0) * dpr;
	return {
		x: x + offsetX,
		y: y + offsetY,
		width: drawWidth,
		height: drawHeight,
		dpr,
	};
}

// Arkaplan resmi için
const bgImageElement = ref(null);
const bgImageLoaded = ref(false);

// Arkaplan rengi değiştiğinde canvas'ı güncelle
watch(backgroundColor, () => {
	if (!ctx || !canvasRef.value) return;
	ctx.fillStyle = backgroundColor.value;
	ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);
	bgImageLoaded.value = false;
	bgImageElement.value = null;
	if (videoElement && !videoState.value.isPlaying) {
		requestAnimationFrame(updateCanvas);
	}
});

watch([dockSize, showDock], () => {
	if (!ctx || !canvasRef.value) return;
	drawMacOSDock(ctx, window.devicePixelRatio || 1);
	if (videoElement && !videoState.value.isPlaying) {
		requestAnimationFrame(updateCanvas);
	}
});

// Arkaplan resmi değiştiğinde yükle
watch(backgroundImage, (newImage) => {
	if (newImage) {
		bgImageElement.value = new Image();
		bgImageElement.value.onload = () => {
			bgImageLoaded.value = true;
			if (ctx) {
				updateCanvas(performance.now(), lastMouseX, lastMouseY);
			}
		};
		bgImageElement.value.onerror = () => {
			console.error("Background image failed to load:", newImage);
			bgImageLoaded.value = false;
			bgImageElement.value = null;
		};
		bgImageElement.value.src = newImage;
	} else {
		bgImageLoaded.value = false;
		bgImageElement.value = null;
		if (ctx) {
			updateCanvas(performance.now(), lastMouseX, lastMouseY);
		}
	}
});

// Canvas güncelleme fonksiyonu
const updateCanvas = (timestamp, mouseX = 0, mouseY = 0) => {
	if (!videoElement || !ctx || !canvasRef.value) {
		console.warn("[MediaPlayer] Missing required elements for canvas update");
		return;
	}

	// FPS kontrolü
	if (timestamp - lastFrameTime < frameInterval) {
		// Sadece video oynatılıyorsa veya zoom geçişi varsa animasyonu devam ettir
		if (videoState.value.isPlaying || isZoomTransitioning.value) {
			animationFrame = requestAnimationFrame((t) =>
				updateCanvas(t, mouseX, mouseY)
			);
		}
		return;
	}

	lastFrameTime = timestamp;

	try {
		// DPR'ı al
		const dpr = window.devicePixelRatio || 1;

		// Video pozisyonunu güncelle
		if (isVideoDragging.value) {
			position.value = videoPosition.value;
		}

		// Canvas'ı sadece gerektiğinde temizle
		if (
			!videoState.value.isPlaying &&
			!isZoomTransitioning.value &&
			!isCameraDragging.value
		) {
			ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
		}

		// Arkaplan
		if (bgImageLoaded.value && bgImageElement.value) {
			try {
				// Resmi canvas'a sığacak şekilde ölçekle
				const scale = Math.max(
					canvasRef.value.width / bgImageElement.value.width,
					canvasRef.value.height / bgImageElement.value.height
				);

				const scaledWidth = bgImageElement.value.width * scale;
				const scaledHeight = bgImageElement.value.height * scale;

				// Resmi ortala
				const x = (canvasRef.value.width - scaledWidth) / 2;
				const y = (canvasRef.value.height - scaledHeight) / 2;

				// Blur efekti uygula
				if (backgroundBlur.value > 0) {
					ctx.filter = `blur(${backgroundBlur.value}px)`;
				}

				ctx.drawImage(bgImageElement.value, x, y, scaledWidth, scaledHeight);

				// Blur'u sıfırla
				ctx.filter = "none";
			} catch (error) {
				console.error("Error drawing background image:", error);
				// Camera background removal aktifse arkaplan doldurmayı atla
				const isCameraBackgroundRemovalActive =
					cameraSettings.value?.optimizedBackgroundRemoval;

				if (!isCameraBackgroundRemovalActive) {
					ctx.fillStyle = backgroundColor.value;
					ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);
				}
			}
		} else {
			// Camera background removal aktifse arkaplan doldurmayı atla
			// Bu sayede camera transparency korunur
			const isCameraBackgroundRemovalActive =
				cameraSettings.value?.optimizedBackgroundRemoval;

			if (!isCameraBackgroundRemovalActive) {
				ctx.fillStyle = backgroundColor.value;
				ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);
			}
			// Background removal aktifse canvas transparent kalır
		}

		// Ana context state'i kaydet
		ctx.save();

		// Video veya crop boyutlarını kullan
		let sourceWidth, sourceHeight;
		if (cropArea.value?.isApplied) {
			sourceWidth = cropArea.value.width;
			sourceHeight = cropArea.value.height;
		} else {
			sourceWidth = videoElement.videoWidth;
			sourceHeight = videoElement.videoHeight;
		}

		const sourceRatio = sourceWidth / sourceHeight;
		const canvasWidth = canvasRef.value.width;
		const canvasHeight = canvasRef.value.height;

		// Video'yu canvas'a sığdırırken aspect ratio'yu koru
		let drawWidth, drawHeight, x, y;

		// Önce padding'i hesaba kat
		const availableWidth = canvasWidth - padding.value * 2 * dpr;
		const availableHeight = canvasHeight - padding.value * 2 * dpr;
		const availableRatio = availableWidth / availableHeight;

		if (sourceRatio > availableRatio) {
			// Video daha geniş, genişliğe göre ölçekle
			drawWidth = availableWidth;
			drawHeight = drawWidth / sourceRatio;
			x = padding.value * dpr;
			y = padding.value * dpr + (availableHeight - drawHeight) / 2;
		} else {
			// Video daha dar, yüksekliğe göre ölçekle
			drawHeight = availableHeight;
			drawWidth = drawHeight * sourceRatio;
			x = padding.value * dpr + (availableWidth - drawWidth) / 2;
			y = padding.value * dpr;
		}

		// In the updateCanvas function, modify the calculation of drawWidth, drawHeight, x, y
		// First, ensure position is zeroed after aspect ratio changes
		if (videoScale.value <= 1.001) {
			// Only reset position to center when not zoomed in
			// This keeps the position consistent while applying different aspect ratios
			if (sourceRatio !== lastSourceRatio.value) {
				position.value = { x: 0, y: 0 };
				videoPosition.value = { x: 0, y: 0 };
				lastSourceRatio.value = sourceRatio;
			}
		}

		// For a cleaner approach to the drawing code, let's modify the positioning logic
		// for the drawX and drawY calculation to keep the video centered regardless of position

		// Add position as a fixed offset - this ensures consistency across different window sizes
		const offsetX = position.value.x * dpr;
		const offsetY = position.value.y * dpr;

		// Apply the position offset to the calculated coordinates
		const drawX = x + offsetX;
		const drawY = y + offsetY;

		// Aktif zoom segmentini bul - clipped time kullan
		const currentTime = videoState.value.currentTime; // Clipped time
		const activeZoom = checkZoomSegments(currentTime, zoomRanges.value);

		// Store'dan gelen scale değerini kullan
		const targetScale = activeZoom ? activeZoom.scale : 1;
		const lerpFactor = 0.1;
		previousScale.value = videoScale.value;
		videoScale.value =
			videoScale.value + (targetScale - videoScale.value) * lerpFactor;

		// Scale değişim hızını hesapla
		const scaleVelocity = Math.abs(videoScale.value - previousScale.value);
		isZoomTransitioning.value = scaleVelocity > 0.01; // Eşik değeri

		// layout segmenti aktif mi
		// Layout kontrolü - erken return için
		// Layout renderer'ı al
		const isLayoutHandled = renderLayout({
			ctx,
			canvasRef,
			cameraElement,
			videoElement,
			videoState,
			currentTime: videoState.value.currentTime, // Clipped time kullan
			mouseX,
			mouseY,
			updateCanvas,
		});

		if (isLayoutHandled) {
			return;
		}

		// Zoom efektini uygula
		if (videoScale.value > 1.001) {
			const centerX = x + drawWidth / 2;
			const centerY = y + drawHeight / 2;

			// Zoom origin'ini son kaydedilen cursor konumuna göre hesapla
			const { originX: transformOriginX, originY: transformOriginY } =
				calculateZoomOrigin(
					lastZoomPosition.value || "center",
					x,
					y,
					drawWidth,
					drawHeight,
					centerX,
					centerY
				);

			// Orijinal görüntüyü çiz - Transform the entire context for all elements
			ctx.save();

			// Apply the zoom transformation
			ctx.translate(transformOriginX + offsetX, transformOriginY + offsetY);
			ctx.scale(videoScale.value, videoScale.value);
			ctx.translate(
				-(transformOriginX + offsetX),
				-(transformOriginY + offsetY)
			);

			// Draw shadow if enabled
			if (shadowSize.value > 0) {
				ctx.save();
				ctx.beginPath();
				useRoundRect(
					ctx,
					drawX,
					drawY,
					drawWidth,
					drawHeight,
					radius.value * dpr
				);
				ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
				ctx.shadowBlur = shadowSize.value * dpr;
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 0;
				ctx.fillStyle = backgroundColor.value;
				ctx.fill();
				ctx.restore();
			}

			// Video alanını kırp ve radius uygula
			ctx.save();
			ctx.beginPath();
			useRoundRect(
				ctx,
				drawX,
				drawY,
				drawWidth,
				drawHeight,
				radius.value * dpr
			);
			ctx.clip();

			// Video çizimi - segment'lere göre
			if (cropArea.value?.isApplied === true) {
				// Crop uygulanmışsa kırpılmış alanı çiz
				ctx.drawImage(
					videoElement,
					cropArea.value.x,
					cropArea.value.y,
					cropArea.value.width,
					cropArea.value.height,
					drawX,
					drawY,
					drawWidth,
					drawHeight
				);
			} else {
				// Segment'ler varsa sadece aktif segment'i çiz
				if (props.segments && props.segments.length > 0) {
					// Mevcut video zamanında hangi segment aktif olduğunu bul
					const realVideoTime = videoElement.currentTime;
					const sortedSegments = [...props.segments].sort((a, b) => {
						const startA = a.start || a.startTime || 0;
						const startB = b.start || b.startTime || 0;
						return startA - startB;
					});

					const currentSegment = sortedSegments.find((segment) => {
						const segmentStart = segment.start || segment.startTime || 0;
						const segmentEnd = segment.end || segment.endTime || 0;
						return realVideoTime >= segmentStart && realVideoTime <= segmentEnd;
					});

					if (currentSegment) {
						// Aktif segment varsa normal video çizimi yap
						ctx.drawImage(
							videoElement,
							0,
							0,
							videoElement.videoWidth,
							videoElement.videoHeight,
							drawX,
							drawY,
							drawWidth,
							drawHeight
						);
					} else {
						// Aktif segment yoksa siyah ekran göster
						ctx.fillStyle = "#000000";
						ctx.fillRect(drawX, drawY, drawWidth, drawHeight);
					}
				} else {
					// Segment yoksa tüm videoyu çiz
					ctx.drawImage(
						videoElement,
						0,
						0,
						videoElement.videoWidth,
						videoElement.videoHeight,
						drawX,
						drawY,
						drawWidth,
						drawHeight
					);
				}
			}
			ctx.restore();

			// Video border çizimi - draw after the video
			if (videoBorderSettings.value?.width > 0) {
				ctx.save();
				ctx.beginPath();
				useRoundRect(
					ctx,
					drawX,
					drawY,
					drawWidth,
					drawHeight,
					radius.value * dpr
				);
				ctx.strokeStyle = videoBorderSettings.value.color || "rgba(0, 0, 0, 1)";
				ctx.lineWidth = videoBorderSettings.value.width * dpr;
				ctx.stroke();
				ctx.restore();
			}

			// --- Video hover border çizimi ---
			if (isMouseOverVideo.value) {
				const { x, y, width, height, dpr } = getVideoDisplayRect();
				drawVideoHoverFrame(ctx, x, y, width, height, dpr);
			}
			// --- Video hover border çizimi ---

			// Restore the entire context
			ctx.restore();

			// Motion blur for zoom transitions
			if (isZoomTransitioning.value) {
				// ... existing zoom transition code ...
			}
		} else {
			// Normal video çizimi için shadow ve radius
			if (shadowSize.value > 0) {
				ctx.save();
				ctx.beginPath();
				useRoundRect(
					ctx,
					drawX,
					drawY,
					drawWidth,
					drawHeight,
					radius.value * dpr
				);
				ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
				ctx.shadowBlur = shadowSize.value * dpr;
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 0;
				ctx.fillStyle = backgroundColor.value;
				ctx.fill();
				ctx.restore();
			}

			// Video alanını kırp ve radius uygula
			ctx.save();
			ctx.beginPath();
			useRoundRect(
				ctx,
				drawX,
				drawY,
				drawWidth,
				drawHeight,
				radius.value * dpr
			);
			ctx.clip();

			// Video çizimi - segment'lere göre
			if (cropArea.value?.isApplied === true) {
				// Crop uygulanmışsa kırpılmış alanı çiz
				ctx.drawImage(
					videoElement,
					cropArea.value.x,
					cropArea.value.y,
					cropArea.value.width,
					cropArea.value.height,
					drawX,
					drawY,
					drawWidth,
					drawHeight
				);
			} else {
				// Segment'ler varsa sadece aktif segment'i çiz
				if (props.segments && props.segments.length > 0) {
					// Mevcut video zamanında hangi segment aktif olduğunu bul
					const realVideoTime = videoElement.currentTime;
					const sortedSegments = [...props.segments].sort((a, b) => {
						const startA = a.start || a.startTime || 0;
						const startB = b.start || b.startTime || 0;
						return startA - startB;
					});

					const currentSegment = sortedSegments.find((segment) => {
						const segmentStart = segment.start || segment.startTime || 0;
						const segmentEnd = segment.end || segment.endTime || 0;
						return realVideoTime >= segmentStart && realVideoTime <= segmentEnd;
					});

					if (currentSegment) {
						// Aktif segment varsa normal video çizimi yap
						ctx.drawImage(
							videoElement,
							0,
							0,
							videoElement.videoWidth,
							videoElement.videoHeight,
							drawX,
							drawY,
							drawWidth,
							drawHeight
						);
					} else {
						// Aktif segment yoksa siyah ekran göster
						ctx.fillStyle = "#000000";
						ctx.fillRect(drawX, drawY, drawWidth, drawHeight);
					}
				} else {
					// Segment yoksa tüm videoyu çiz
					ctx.drawImage(
						videoElement,
						0,
						0,
						videoElement.videoWidth,
						videoElement.videoHeight,
						drawX,
						drawY,
						drawWidth,
						drawHeight
					);
				}
			}
			ctx.restore();

			// Video border çizimi
			if (videoBorderSettings.value?.width > 0) {
				ctx.save();
				ctx.beginPath();
				useRoundRect(
					ctx,
					drawX,
					drawY,
					drawWidth,
					drawHeight,
					radius.value * dpr
				);
				ctx.strokeStyle = videoBorderSettings.value.color || "rgba(0, 0, 0, 1)";
				ctx.lineWidth = videoBorderSettings.value.width * dpr;
				ctx.stroke();
				ctx.restore();
			}
		}

		// Ana context state'i geri yükle
		ctx.restore();

		// Kamera çizimi (cursor'dan önce çizilmeli)
		if (cameraElement) {
			let cameraPos;
			if (isCameraDragging.value) {
				// Kamera sürükleniyorsa sadece kamera pozisyonunu kullan
				cameraPos = cameraPosition.value;
			} else if (cameraSettings.value.followMouse && lastCameraPosition.value) {
				// Mouse takibi aktifse video pozisyonunu ekle
				cameraPos = {
					x: lastCameraPosition.value.x,
					y: lastCameraPosition.value.y,
				};
			} else if (cameraPosition.value) {
				// Kamera pozisyonu varsa onu kullan (düzen uygulandıktan sonra veya manuel ayarlandıktan sonra)
				cameraPos = { ...cameraPosition.value };
			} else if (cameraSettings.value.position) {
				// Kamera ayarlarında pozisyon varsa onu kullan (son çare olarak)
				cameraPos = { ...cameraSettings.value.position };
			}

			try {
				// Zoom aktifse kamera pozisyonunu ona göre ayarla
				let scaledVideoPosition = { ...position.value };
				if (videoScale.value > 1.001) {
					// Zoom aktifse kamera pozisyonu ve zoom ölçeğini hesaba kat
					if (cameraPos) {
						// Kameranın zoom'lu görüntüde doğru pozisyonda görünmesi için hesaplama
						cameraPos = {
							x: cameraPos.x,
							y: cameraPos.y,
						};
					}
				}

				drawCamera(
					ctx,
					cameraElement,
					canvasRef.value.width,
					canvasRef.value.height,
					1,
					mouseX,
					mouseY,
					cameraPos,
					videoScale.value, // Zoom ölçeğini kameraya aktar
					scaledVideoPosition,
					cameraSettings.value.optimizedBackgroundRemovalSettings
						?.backgroundType || "transparent",
					cameraSettings.value.optimizedBackgroundRemovalSettings
						?.backgroundColor || "#000000"
				);

				// Kamera followMouse aktifse ve mouse kamera üstündeyse tooltip çiz
				if (cameraSettings.value.followMouse && isMouseOverCamera.value) {
					const cameraRect = getCameraDisplayRect();
					drawCameraFollowTooltip(ctx, cameraRect, dpr);
				}
			} catch (error) {
				console.warn("[MediaPlayer] Camera draw error:", error);
				if (!cameraElement || cameraElement.readyState < 2) {
					initializeCamera();
				}
			}
		}

		// Mouse pozisyonlarını çiz (kameradan sonra çizilmeli ki üzerine yazılmasın)
		drawMousePositions();

		// macOS Dock çiz (eğer aktifse ve destekleniyorsa)
		if (
			showDock.value === true &&
			isDockSupported.value === true &&
			visibleDockItems.value &&
			visibleDockItems.value.length > 0
		) {
			drawMacOSDock(ctx, dpr);
		}

		// Animasyon frame'ini sadece gerektiğinde talep et
		if (
			videoState.value.isPlaying ||
			isZoomTransitioning.value ||
			isCameraDragging.value
		) {
			animationFrame = requestAnimationFrame((t) =>
				updateCanvas(t, mouseX, mouseY)
			);
		}
	} catch (error) {
		console.error("[MediaPlayer] Canvas update error:", error);
		animationFrame = null;
	}
};

// Props'ları izle
watch(
	() => ({ ...props }),
	() => {
		// Props değiştiğinde sadece aspect ratio ve resize gibi özel durumları handle et
		if (props.selectedAspectRatio) {
			updateAspectRatio(props.selectedAspectRatio);
		}
		if (props.padding) {
			handleResize();
		}
	},
	{ deep: true, immediate: true }
);

// Preview zamanı değişikliğini izle - SADECE CANVAS RENDER, VIDEO CURRENTTIME ETKİLEME
watch(
	() => props.previewTime,
	(newValue) => {
		if (!videoElement || newValue === null) return;

		// Sadece canvas'ı preview zamanında render et
		// Video'nun currentTime'ını geçici değiştir, canvas çiz, hemen geri al
		if (videoElement.readyState >= 2) {
			const originalTime = videoElement.currentTime;

			// Geçici olarak preview zamanına git
			videoElement.currentTime = newValue;

			// Canvas'ı güncelle
			requestAnimationFrame(() => {
				updateCanvas(performance.now());
				// Hemen eski zaman pozisyonuna geri dön
				if (videoElement) {
					videoElement.currentTime = originalTime;
				}
			});
		}
	}
);

const initCameraVideo = () => {
	try {
		// Yeni video elementi oluştur
		cameraElement = document.createElement("video");

		// Ana video ayarları
		cameraElement.crossOrigin = "anonymous";
		cameraElement.muted = true;
		cameraElement.playsInline = true;
		cameraElement.preload = "auto";
		cameraElement.volume = 0;
		cameraElement.playbackRate = 1;

		// Video kalitesi için ek ayarlar
		cameraElement.style.imageRendering = "high-quality";
		cameraElement.style.webkitImageRendering = "high-quality";
		cameraElement.style.objectFit = "contain";

		// Video kalitesi için özel attributeler
		cameraElement.setAttribute("playsinline", "");
		cameraElement.setAttribute("webkit-playsinline", "");
		cameraElement.setAttribute("x-webkit-airplay", "allow");
		cameraElement.setAttribute("preload", "auto");
		cameraElement.setAttribute("poster", "");

		// Event listener'ları ekle
		const { addEvents, removeEvents } = useVideoEvents(cameraElement, {
			onVideoMetadataLoaded,
			onVideoDataLoaded,
			onDurationChange,
			onTimeUpdate,
			onVideoEnded,
			onVideoError,
			onVideoPlay,
			onVideoPause,
			onVideoSeeking,
			onVideoSeeked,
			onVideoRateChange,
			onVideoVolumeChange,
		});

		addEvents();

		// Cleanup için removeEvents'i sakla
		cameraElement._removeEvents = removeEvents;

		// Video URL'ini set et ve yüklemeyi başlat
		cameraElement.src = props.cameraUrl;
		cameraElement.load();
	} catch (error) {
		console.error("[MediaPlayer] Video yükleme hatası:", error);
	}
};

// Video yükleme ve hazırlık
const initVideo = () => {
	try {
		if (!props.videoUrl) {
			console.warn("[MediaPlayer] Video URL'i boş!");
			return;
		}

		// Yeni video elementi oluştur
		videoElement = document.createElement("video");

		// Ana video ayarları
		videoElement.crossOrigin = "anonymous";
		videoElement.muted = !props.systemAudioEnabled;
		videoElement.playsInline = true;
		videoElement.preload = "metadata"; // Sadece metadata'yı yükleyelim
		videoElement.volume = videoState.value.volume;
		videoElement.playbackRate = videoState.value.playbackRate;

		// Video kalitesi için ek ayarlar
		videoElement.style.imageRendering = "high-quality";
		videoElement.style.webkitImageRendering = "high-quality";
		videoElement.style.objectFit = "contain";

		// Video kalitesi için özel attributeler
		videoElement.setAttribute("playsinline", "");
		videoElement.setAttribute("webkit-playsinline", "");
		videoElement.setAttribute("x-webkit-airplay", "allow");
		videoElement.setAttribute("preload", "metadata");
		videoElement.setAttribute("poster", "");

		// Duration için özel event listener'lar ekleyelim
		const checkAndUpdateDuration = (eventType) => {
			if (isValidDuration(videoElement.duration)) {
				const duration = videoElement.duration;
				videoState.value.duration = duration;

				// Video boyutlarını da kontrol edelim
				const width = videoElement.videoWidth || videoSize.value.width;
				const height = videoElement.videoHeight || videoSize.value.height;

				if (!hasEmittedVideoLoaded.value) {
					hasEmittedVideoLoaded.value = true;
					emit("videoLoaded", {
						duration,
						width,
						height,
					});
				} else {
				}

				// // Duration bilgisi alındıktan sonra video'yu başa saralım
				// if (videoElement.fastSeek) {
				// 	videoElement.fastSeek(0);
				// } else {
				// 	videoElement.currentTime = 0;
				// }
			}
		};

		const isValidDuration = (duration) => {
			return (
				duration && duration !== Infinity && !isNaN(duration) && duration > 0
			);
		};

		// Duration event listener'larını ekle
		videoElement.addEventListener("loadedmetadata", () => {
			checkAndUpdateDuration("loadedmetadata");

			// Eğer duration hala geçerli değilse, hızlı bir seek deneyelim
			if (!isValidDuration(videoElement.duration)) {
				try {
					if (videoElement.fastSeek) {
						videoElement.fastSeek(Number.MAX_SAFE_INTEGER);
					} else {
						videoElement.currentTime = Number.MAX_SAFE_INTEGER;
					}
				} catch (e) {
					console.warn("[MediaPlayer] Fast seek failed:", e);
				}
			}
		});

		videoElement.addEventListener("durationchange", () => {
			checkAndUpdateDuration("durationchange");
		});

		videoElement.addEventListener("loadeddata", () => {
			checkAndUpdateDuration("loadeddata");
		});

		// Canplay event'inde de duration'ı kontrol edelim
		videoElement.addEventListener("canplay", () => {
			checkAndUpdateDuration("canplay");
		});

		// Error handling
		videoElement.addEventListener("error", (e) => {
			console.error("[MediaPlayer] Video loading error:", {
				error: videoElement.error,
				errorCode: videoElement.error?.code,
				errorMessage: videoElement.error?.message,
				networkState: videoElement.networkState,
				readyState: videoElement.readyState,
			});

			// Video loading error durumunda playback'i durdur
			console.log(
				"[MediaPlayer] Video loading error - calling jumpToSegmentEnd"
			);
			jumpToSegmentEnd();
		});

		// Progress monitoring
		videoElement.addEventListener("progress", () => {
			const buffered = videoElement.buffered;
			if (buffered.length > 0) {
			}
		});

		// Event listener'ları ekle
		const { addEvents, removeEvents } = useVideoEvents(videoElement, {
			onVideoMetadataLoaded,
			onVideoDataLoaded,
			onDurationChange,
			onTimeUpdate,
			onVideoEnded,
			onVideoError,
			onVideoPlay,
			onVideoPause,
			onVideoSeeking,
			onVideoSeeked,
			onVideoRateChange,
			onVideoVolumeChange,
		});

		addEvents();

		// Cleanup için removeEvents'i sakla
		videoElement._removeEvents = removeEvents;

		// Video URL'ini set et ve yüklemeyi başlat
		videoElement.src = props.videoUrl;

		// Video yüklenmeye başladığında ilk frame'i göster
		videoElement.addEventListener(
			"loadeddata",
			() => {
				if (!animationFrame) {
					animationFrame = requestAnimationFrame(updateCanvas);
				}
			},
			{ once: true }
		);

		videoElement.load();

		// 5 saniye timeout ekleyelim
		setTimeout(() => {
			if (!isValidDuration(videoElement.duration)) {
				console.warn(
					"[MediaPlayer] Could not get valid duration after 5 seconds"
				);
				// Burada alternatif bir yöntem deneyebilir veya hata bildirebilirsiniz
			}
		}, 5000);
	} catch (error) {
		console.error("[MediaPlayer] Video yükleme hatası:", error);
	}
};

// Video metadata ve data yükleme işleyicileri
const onVideoMetadataLoaded = () => {
	if (!videoElement || !canvasRef.value) return;

	try {
		// Context'i oluştur
		ctx = canvasRef.value.getContext("2d", {
			alpha: true, // Camera transparency için gerekli!
			desynchronized: false,
			willReadFrequently: false,
			preserveDrawingBuffer: true,
			antialias: true,
		});

		// Container boyutlarını al
		const container = containerRef.value.getBoundingClientRect();
		const containerWidth = container.width;
		const containerHeight = container.height;

		// Video aspect ratio'sunu hesapla
		const videoRatio = videoElement.videoWidth / videoElement.videoHeight;
		const containerRatio = containerWidth / containerHeight;

		// Canvas boyutlarını container'a göre ayarla
		let canvasWidth, canvasHeight;
		if (videoRatio > containerRatio) {
			canvasWidth = containerWidth;
			canvasHeight = containerWidth / videoRatio;
		} else {
			canvasHeight = containerHeight;
			canvasWidth = containerHeight * videoRatio;
		}

		// DPR'ı kullanarak canvas çözünürlüğünü artır
		const dpr = window.devicePixelRatio || 1;
		canvasRef.value.width = canvasWidth * dpr * scaleValue;
		canvasRef.value.height = canvasHeight * dpr * scaleValue;

		// Canvas stil boyutlarını ayarla (CSS pixels)
		canvasRef.value.style.width = `${canvasWidth}px`;
		canvasRef.value.style.height = `${canvasHeight}px`;

		// Canvas kalite ayarları
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";

		// Canvas transform ayarları
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		// Canvas stil ayarları
		Object.assign(canvasRef.value.style, {
			display: "block",
			backfaceVisibility: "hidden",
			willChange: "transform",
			imageRendering: "high-quality",
			webkitImageRendering: "high-quality",
			position: "absolute",
			transform: "translateZ(0)",
			margin: "auto",
			top: 0,
			right: 0,
			bottom: 0,
			left: 0,
			maxWidth: "100%",
			maxHeight: "100%",
			boxSizing: "border-box",
		});

		// Video boyutlarını kaydet
		videoSize.value = {
			width: videoElement.videoWidth,
			height: videoElement.videoHeight,
		};

		// İlk render
		handleResize();

		// İlk frame'i hemen çiz
		requestAnimationFrame(() => {
			updateCanvas(performance.now());
		});

		// Duration değerini kontrol et ve güncelle
		if (videoElement.duration && videoElement.duration !== Infinity) {
			const duration = videoElement.duration;
			videoState.value.duration = duration;

			// Video hazır event'i
			if (!hasEmittedVideoLoaded.value) {
				hasEmittedVideoLoaded.value = true;
				emit("videoLoaded", {
					duration,
					width: videoElement.videoWidth,
					height: videoElement.videoHeight,
				});
			} else {
			}
		}

		// Video yüklendikten sonra ilk frame'i göstermek için
		// seekToFirstFrame fonksiyonunu çağır
		seekToFirstFrame();
	} catch (error) {
		console.error("[MediaPlayer] Metadata yükleme hatası:", error);
	}
};

// Settings değişikliklerini izle ve canvas'ı güncelle
watch(
	[
		backgroundColor,
		backgroundBlur,
		radius,
		shadowSize,
		padding,
		cameraSettings,
		videoBorderSettings, // Yeni eklenen
		mouseSize,
		mouseMotionEnabled,
		motionBlurValue,
		mouseVisible, // mouseVisible ekledim
		zoomRanges,
		currentZoomRange,
	],
	() => {
		if (!ctx || !canvasRef.value) return;

		// Canvas'ı hemen güncelle
		requestAnimationFrame(() => {
			updateCanvas(performance.now());
		});

		// Kamera ayarları değiştiğinde sadece gerekli durumlarda pozisyonu sıfırla
		// Yalnızca followMouse false'dan true'ya geçtiğinde sıfırla
		// Bu sayede settings panelini açınca pozisyon sıfırlanmaz
	},
	{ immediate: true, deep: true }
);

// İlk frame'e seek etmek için yardımcı fonksiyon
const seekToFirstFrame = async () => {
	if (!videoElement) return;

	try {
		// Video hazır olana kadar bekle
		if (videoElement.readyState < 2) {
			await new Promise((resolve) => {
				const checkReady = () => {
					if (videoElement.readyState >= 2) {
						resolve();
					} else {
						requestAnimationFrame(checkReady);
					}
				};
				checkReady();
			});
		}

		// İlk frame'e git
		videoElement.currentTime = 0;

		// Canvas'ı hemen güncelle
		requestAnimationFrame(() => {
			updateCanvas(performance.now());
		});

		// Eğer video oynatılmıyorsa, animasyon frame'ini iptal et
		if (!videoState.value.isPlaying && animationFrame) {
			cancelAnimationFrame(animationFrame);
			animationFrame = null;
		}
	} catch (error) {
		console.error("[MediaPlayer] First frame seek error:", error);
	}
};

// Video data yüklendiğinde
const onVideoDataLoaded = () => {
	if (!videoElement) return;

	try {
		const width = videoElement.videoWidth || 1920;
		const height = videoElement.videoHeight || 1080;
		const duration = isFinite(videoElement.duration)
			? videoElement.duration
			: 0;

		// Video hazır event'i
		if (!hasEmittedVideoLoaded.value) {
			hasEmittedVideoLoaded.value = true;
			emit("videoLoaded", {
				duration,
				width,
				height,
			});
		} else {
		}
	} catch (error) {
		console.error("[MediaPlayer] Video data yükleme hatası:", error);
	}
};

// Duration değişikliğini izle
const onDurationChange = () => {
	if (!videoElement) return;

	try {
		// Duration değerini kontrol et
		if (videoElement.duration && videoElement.duration !== Infinity) {
			const duration = videoElement.duration;
			videoState.value.duration = duration;

			// Eğer metadata yüklenmiş ama duration henüz emit edilmemişse
			if (videoElement.readyState >= 1 && !hasEmittedVideoLoaded.value) {
				hasEmittedVideoLoaded.value = true;
				emit("videoLoaded", {
					duration,
					width: videoSize.value.width,
					height: videoSize.value.height,
				});
			}
		} else {
		}
	} catch (error) {
		console.error("[MediaPlayer] Süre güncelleme hatası:", error);
	}
};

// Video event handlers
const onVideoPlay = () => {
	if (!videoElement) return;

	videoState.value.isPlaying = true;
	videoState.value.isPaused = false;

	// Canvas animasyonunu başlat
	if (!animationFrame) {
		animationFrame = requestAnimationFrame(updateCanvas);
	}

	emit("play", videoState.value);
};

const onVideoPause = () => {
	videoState.value.isPlaying = false;
	videoState.value.isPaused = true;

	// Canvas animasyonunu durdur
	if (animationFrame) {
		cancelAnimationFrame(animationFrame);
		animationFrame = null;
	}

	// Son frame'i çiz ve bırak
	updateCanvas(performance.now());

	emit("pause", videoState.value);
};

const onVideoSeeking = () => {
	videoState.value.isSeeking = true;
	emit("seeking", videoState.value);
};

const onVideoSeeked = () => {
	videoState.value.isSeeking = false;
	emit("seeked", videoState.value);
};

const onVideoRateChange = () => {
	videoState.value.playbackRate = videoElement.playbackRate;
	emit("rateChange", videoState.value);
};

const onVideoVolumeChange = () => {
	videoState.value.volume = videoElement.volume;
	emit("volumeChange", videoState.value);
};

// Component lifecycle
onMounted(() => {
	initVideo();

	// Initialize camera position from camera settings if available
	if (cameraSettings.value && cameraSettings.value.position) {
		cameraPosition.value = { ...cameraSettings.value.position };
		if (lastCameraPosition.value) {
			lastCameraPosition.value = { ...cameraSettings.value.position };
		}
	}

	let newImage = backgroundImage.value;

	if (newImage) {
		bgImageElement.value = new Image();
		bgImageElement.value.onload = () => {
			bgImageLoaded.value = true;
			if (ctx) {
				updateCanvas(performance.now(), lastMouseX, lastMouseY);
			}
		};
		bgImageElement.value.onerror = () => {
			console.error("Background image failed to load:", newImage);
			bgImageLoaded.value = false;
			bgImageElement.value = null;
		};
		bgImageElement.value.src = newImage;
	}

	window.addEventListener("resize", handleResize);
	if (videoRef.value && canvasRef.value) {
		renderVideo();
	}
	canvasRef.value.addEventListener("mousedown", handleMouseDown);
	canvasRef.value.addEventListener("mousemove", handleMouseMove);
	window.addEventListener("mouseup", handleMouseUp);
});

onUnmounted(() => {
	if (videoElement) {
		if (videoElement._removeEvents) {
			videoElement._removeEvents();
		}
		videoElement.src = "";
		videoElement = null;
	}

	if (cameraElement) {
		if (cameraElement._removeEvents) {
			cameraElement._removeEvents();
		}
		cameraElement.src = "";
		cameraElement = null;
	}

	window.removeEventListener("resize", handleResize);

	if (animationFrame) {
		cancelAnimationFrame(animationFrame);
		animationFrame = null;
	}

	videoRef.value = null;
	cameraRef.value = null;
	canvasRef.value = null;
	cleanupZoom();
	if (canvasRef.value) {
		canvasRef.value.removeEventListener("mousedown", handleMouseDown);
		canvasRef.value.removeEventListener("mousemove", handleMouseMove);
	}
	window.removeEventListener("mouseup", handleMouseUp);
});

// Props değişikliklerini izle
watch(
	() => props.videoUrl,
	(newUrl, oldUrl) => {
		if (newUrl && newUrl !== oldUrl) {
			// Reset videoLoaded emission flag for new video
			hasEmittedVideoLoaded.value = false;
			initVideo();
		}
	},
	{ immediate: true }
);

watch(
	() => props.cameraUrl,
	(newUrl, oldUrl) => {
		initCameraVideo();
	}
);

watch(
	() => props.isPlaying,
	(newValue) => {
		if (newValue) {
			play();
		} else {
			pause();
		}
	}
);

watch(
	() => props.currentTime,
	(newValue) => {
		if (!videoElement) return;

		// Sadece video oynatılmıyorsa ve preview yapılmıyorsa zamanı güncelle
		if (!videoState.value.isPlaying && props.previewTime === null) {
			videoElement.currentTime = newValue;
			if (cameraElement) {
				cameraElement.currentTime = newValue;
			}
			if (audioRef.value) {
				audioRef.value.currentTime = newValue;
			}
		}
	}
);

watch(() => props.selectedAspectRatio, updateAspectRatio);

// Props değişikliklerini izle
watch(
	() => props.systemAudioEnabled,
	(newValue) => {
		if (videoElement) {
			videoElement.muted = !newValue;
		}
	}
);

// Ses durumu değişikliğini izle
watch(
	() => props.isMuted,
	(newValue) => {
		if (videoElement) {
			videoElement.muted = newValue;
			if (audioRef.value) {
				audioRef.value.muted = newValue;
			}
			emit("muteChange", newValue);
		}
	}
);

// Preview zamanı değiştiğinde
watch(
	() => props.previewTime,
	(newValue) => {
		if (!videoElement || newValue === null) return;

		// Preview zamanını güncelle
		videoElement.currentTime = newValue;
		if (cameraElement) {
			cameraElement.currentTime = newValue;
		}
		videoState.value.currentTime = newValue;

		// Canvas'ı hemen güncelle
		requestAnimationFrame(() => updateCanvas(performance.now()));
	},
	{ immediate: true }
);

// Video render fonksiyonu
const renderVideo = () => {
	if (!canvasRef.value || !videoRef.value) return;

	const canvas = canvasRef.value;
	const ctx = canvas.getContext("2d");
	const video = videoRef.value;
	const camera = cameraRef.value;

	// Canvas boyutlarını ayarla
	canvas.width = containerRef.value.clientWidth;
	canvas.height = containerRef.value.clientHeight;

	// Videoyu çiz
	ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
	if (camera && cameraSettings.value.visible)
		ctx.drawImage(camera, 0, 0, canvas.width, canvas.height);

	// Bir sonraki frame'i iste
	requestAnimationFrame(renderVideo);
};

// Component metodlarını dışa aktar
defineExpose({
	// Playback controls
	updateCanvas,
	play,
	pause,
	seek: (clippedTime) => {
		if (!videoElement) return;

		// Segment clipping sistemi - clipped time'ı real video time'a çevir
		if (props.segments && props.segments.length > 0) {
			// Segment'leri sırala
			const sortedSegments = [...props.segments].sort((a, b) => {
				const startA = a.start || a.startTime || 0;
				const startB = b.start || b.startTime || 0;
				return startA - startB;
			});

			// Clipped time'ı toplam clipped duration ile sınırlandır
			const totalClippedDuration = getTotalClippedDuration(sortedSegments);
			const constrainedClippedTime = Math.max(
				0,
				Math.min(clippedTime, totalClippedDuration)
			);

			// Clipped time'ı real video time'a çevir
			let realVideoTime = 0;
			let accumulatedClippedTime = 0;

			for (const segment of sortedSegments) {
				const segmentStart = segment.start || segment.startTime || 0;
				const segmentEnd = segment.end || segment.endTime || 0;
				const segmentDuration = segmentEnd - segmentStart;

				if (
					constrainedClippedTime <=
					accumulatedClippedTime + segmentDuration
				) {
					// Bu segment içinde seek yapılacak
					const offsetInSegment =
						constrainedClippedTime - accumulatedClippedTime;
					realVideoTime = segmentStart + offsetInSegment;
					break;
				}
				accumulatedClippedTime += segmentDuration;
			}

			// Real video time'a seek et
			videoElement.currentTime = realVideoTime;
			if (cameraElement) cameraElement.currentTime = realVideoTime;
			if (audioRef.value) audioRef.value.currentTime = realVideoTime;

			// State'i güncelle
			videoState.value.currentTime = constrainedClippedTime;

			// Canvas'ı güncelle
			requestAnimationFrame(() => {
				updateCanvas(performance.now());
			});

			// Clipped time'ı emit et
			emit("timeUpdate", constrainedClippedTime);
			return;
		}

		// Normal video seek işlemi (segment yoksa)
		videoElement.currentTime = clippedTime;
		if (cameraElement) cameraElement.currentTime = clippedTime;
		if (audioRef.value) audioRef.value.currentTime = clippedTime;
		videoState.value.currentTime = clippedTime;

		// Canvas'ı güncelle
		requestAnimationFrame(() => {
			updateCanvas(performance.now());
		});

		// Time update event'ini emit et
		emit("timeUpdate", clippedTime);
	},

	// Video element access
	getVideoElement: () => videoElement,

	// Video frame capture
	captureFrame: () => {
		if (!canvasRef.value) return null;

		// Canvas'ı direkt olarak kopyala - tüm içeriği almak için
		try {
			// Yüksek kaliteli bir görüntü almak için
			return canvasRef.value.toDataURL("image/png", 1.0);
		} catch (error) {
			console.error("[MediaPlayer] Screenshot capture error:", error);
			return null;
		}
	},

	// Export için fare pozisyonu işleme - bu fonksiyon ekleniyor
	handleMousePositionForExport: (currentTime) => {
		if (!props.mousePositions || !props.mousePositions.length) return;

		// Video süresini al
		const videoDuration = videoElement?.duration || 0;
		if (!videoDuration) return;

		// Doğrudan fare pozisyonunu güncelle - daha az yumuşak ama export için daha doğru
		const totalPositions = props.mousePositions.length;
		const normalizedTime = currentTime / videoDuration;

		// Pozisyon indeksini hesapla
		const positionIndex = Math.min(
			Math.floor(normalizedTime * totalPositions),
			totalPositions - 1
		);

		// İlgili pozisyonu al
		if (positionIndex >= 0 && positionIndex < totalPositions) {
			const position = props.mousePositions[positionIndex];
			if (position) {
				// Doğrudan hedef ve mevcut pozisyonları güncelle - animasyon için
				if (typeof window.mouseCursorExportHelper === "undefined") {
					window.mouseCursorExportHelper = {};
				}

				// Global değişkenleri güncelle - daha hızlı erişim için
				window.mouseCursorExportHelper = {
					targetX: position.x,
					targetY: position.y,
					cursorX: position.x,
					cursorY: position.y,
					lastUpdateTime: Date.now(),
				};
			}
		}
	},

	// Video frame capture with specific size
	captureFrameWithSize: (width, height) => {
		if (!canvasRef.value) return null;

		try {
			// Orijinal canvas'ın boyutlarını al
			const originalWidth = canvasRef.value.width;
			const originalHeight = canvasRef.value.height;

			// Canvas'ın gerçek aspect ratio'sunu kullan - siyah çerçeve olmadan
			let finalWidth = originalWidth;
			let finalHeight = originalHeight;

			// Eğer cropRatio ayarlanmışsa o aspect ratio'yu kullan
			if (cropRatio.value) {
				const [ratioW, ratioH] = cropRatio.value.split(":").map(Number);
				const ratioAspect = ratioW / ratioH;

				// Canvas'ın mevcut boyutlarını kullanarak aspect ratio'yu uygula
				if (originalWidth / originalHeight > ratioAspect) {
					// Genişlik fazla, yüksekliği referans al
					finalWidth = originalHeight * ratioAspect;
					finalHeight = originalHeight;
				} else {
					// Yükseklik fazla, genişliği referans al
					finalWidth = originalWidth;
					finalHeight = originalWidth / ratioAspect;
				}
			}

			// Export canvas'ı gerçek boyutlarda oluştur - siyah çerçeve yok
			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = finalWidth;
			tempCanvas.height = finalHeight;
			const tempCtx = tempCanvas.getContext("2d", {
				alpha: false,
				antialias: true,
				desynchronized: true,
				willReadFrequently: true,
			});

			// En iyi kalite için ayarlar
			tempCtx.imageSmoothingEnabled = true;
			tempCtx.imageSmoothingQuality = "high";

			// Orijinal canvas'ı direkt çiz - tam boyut, siyah çerçeve yok
			tempCtx.drawImage(canvasRef.value, 0, 0, finalWidth, finalHeight);

			// WebP kullan - daha hızlı ve küçük boyut
			return tempCanvas.toDataURL("image/webp", 0.95);
		} catch (error) {
			console.error("[MediaPlayer] Sized screenshot capture error:", error);
			return null;
		}
	},

	// Canvas'ı direkt döndür - export için optimize edilmiş
	getCanvas: () => {
		return canvasRef.value;
	},

	// Audio controls
	setVolume: (volume) => {
		if (!videoElement) return;
		const normalizedVolume = Math.max(0, Math.min(1, volume));
		videoElement.volume = normalizedVolume;
		if (audioRef.value) {
			audioRef.value.volume = normalizedVolume;
		}
	},
	toggleMute: () => {
		if (!videoElement) return;
		videoElement.muted = !videoElement.muted;
		if (audioRef.value) {
			audioRef.value.muted = videoElement.muted;
		}
		emit("muteChange", videoElement.muted);
	},

	// Video controls
	setPlaybackRate: (rate) => {
		if (!videoElement) return;
		videoElement.playbackRate = rate;
		if (cameraElement) cameraElement.playbackRate = rate;
	},
	updateAspectRatio,

	// State and data
	getState: () => ({ ...videoState.value }),
	getCropData,
	getCanvas: () => canvasRef.value,

	// Event handlers
	on: (event, handler) => {
		if (event === "videoEnded" && videoElement) {
			videoElement.addEventListener("ended", handler);
			cameraElement.addEventListener("ended", handler);
		}
	},
	off: (event, handler) => {
		if (event === "videoEnded" && videoElement) {
			videoElement.removeEventListener("ended", handler);
			cameraElement.removeEventListener("ended", handler);
		}
	},
	toggleCropModal: () => {
		showCropModal.value = !showCropModal.value;
	},

	// Expose methods to get and set positions
	getVideoPosition: () => {
		return { ...videoPosition.value };
	},

	getCameraPosition: () => {
		// Return the camera position from the useCameraDrag composable
		// Make a deep copy to avoid reference issues
		if (cameraPosition.value) {
			return { ...cameraPosition.value };
		}

		// Fallback to lastCameraPosition if available
		if (lastCameraPosition.value) {
			return { ...lastCameraPosition.value };
		}

		// Default position if nothing else is available
		return { x: 0, y: 0 };
	},

	setVideoPosition: (newPosition) => {
		if (!newPosition || typeof newPosition !== "object") return;

		// Ensure both position references are updated consistently
		videoPosition.value = { ...newPosition };
		position.value = { ...newPosition }; // Update the main position as well

		// Immediately update the canvas to reflect new position
		requestAnimationFrame(() => {
			updateCanvas(performance.now());
		});
	},

	setCameraPosition: (newPosition) => {
		if (
			newPosition &&
			typeof newPosition.x === "number" &&
			typeof newPosition.y === "number"
		) {
			// Kamera pozisyonunu güncelle
			cameraPosition.value = { ...newPosition };

			// Ayrıca lastCameraPosition'ı da güncelle (render için)
			if (lastCameraPosition.value) {
				lastCameraPosition.value = { ...newPosition };
			}

			// Kamera pozisyonunu canvas'ta hemen güncelle
			requestAnimationFrame(() => {
				updateCanvas(performance.now());
			});
		}
	},

	// Add methods to get canvas size, camera settings, and video border settings
	getCanvasSize: () => {
		if (!canvasRef.value) return { width: 800, height: 600 };
		return {
			width: canvasRef.value.width,
			height: canvasRef.value.height,
		};
	},

	getCameraSettings: () => {
		return JSON.parse(JSON.stringify(cameraSettings.value || {}));
	},

	getVideoBorderSettings: () => {
		return JSON.parse(JSON.stringify(videoBorderSettings.value || {}));
	},

	getMouseCursorSettings: () => {
		return {
			size: mouseSize.value,
			visible: mouseVisible.value,
			motionBlur: motionBlurValue.value,
		};
	},

	getZoomSettings: () => {
		return {
			zoomRanges: JSON.parse(JSON.stringify(zoomRanges.value || [])),
			currentZoomRange: currentZoomRange.value
				? JSON.parse(JSON.stringify(currentZoomRange.value))
				: null,
		};
	},

	// Video trim controls - artık otomatik olarak segment'ler uygulanıyor
	trimVideoToSegments: async (segments) => {
		return true; // Segment'ler otomatik olarak uygulanıyor
	},

	restoreOriginalVideo: async () => {
		return true; // Segment'ler otomatik olarak video'yu kontrol ediyor
	},

	// Trimmed video durumunu kontrol et
	isTrimmed: () => props.segments && props.segments.length > 0,
	getTrimOffset: () => 0,

	// Segment bilgilerini export için
	getSegments: () => props.segments || [],
	getClippedDuration: () => {
		if (!props.segments || props.segments.length === 0) {
			return videoElement?.duration || 0;
		}
		return getTotalClippedDuration(props.segments);
	},

	// Clipped time'dan real time'a dönüştürme fonksiyonu
	convertClippedToRealTime: (clippedTime) => {
		if (!props.segments || props.segments.length === 0) {
			return clippedTime;
		}

		const sortedSegments = getSortedSegments();
		let accumulatedClippedTime = 0;

		for (const segment of sortedSegments) {
			const segmentStart = segment.start || segment.startTime || 0;
			const segmentEnd = segment.end || segment.endTime || 0;
			const segmentDuration = segmentEnd - segmentStart;

			if (
				clippedTime >= accumulatedClippedTime &&
				clippedTime < accumulatedClippedTime + segmentDuration
			) {
				// Bu segment içinde
				const offsetInSegment = clippedTime - accumulatedClippedTime;
				return segmentStart + offsetInSegment;
			}
			accumulatedClippedTime += segmentDuration;
		}

		// Son segment'in sonunda
		if (sortedSegments.length > 0) {
			const lastSegment = sortedSegments[sortedSegments.length - 1];
			return lastSegment.end || lastSegment.endTime || 0;
		}

		return clippedTime;
	},

	// Export için fare pozisyonu güncelleme
	handleMousePositionForExport: (realTime) => {
		if (!props.mousePositions || props.mousePositions.length === 0) {
			return;
		}

		// Verilen real time'a en yakın fare pozisyonunu bul
		let closestPosition = null;
		let minDistance = Infinity;

		for (const position of props.mousePositions) {
			const distance = Math.abs(position.timestamp - realTime);
			if (distance < minDistance) {
				minDistance = distance;
				closestPosition = position;
			}
		}

		// Eğer yakın bir pozisyon bulunduysa (100ms tolerans)
		if (closestPosition && minDistance < 0.1) {
			// Fare pozisyonunu güncelle - daha sonra canvas render'da kullanılacak
			currentMousePosition.value = {
				x: closestPosition.x,
				y: closestPosition.y,
				timestamp: realTime,
			};
		}
	},
});

// Cleanup on unmount
onUnmounted(() => {
	// Sync interval'ı temizle
	if (syncInterval) {
		clearInterval(syncInterval);
		syncInterval = null;
	}

	// Animation frame'i temizle
	if (animationFrame) {
		cancelAnimationFrame(animationFrame);
		animationFrame = null;
	}

	// Medya elementlerini durdur
	if (videoElement && !videoElement.paused) {
		videoElement.pause();
	}

	if (cameraElement && !cameraElement.paused) {
		cameraElement.pause();
	}

	if (audioRef.value && !audioRef.value.paused) {
		audioRef.value.pause();
	}
});

// cropRatio değişikliğini izle
watch(cropRatio, (newRatio) => {
	if (!videoElement) return;

	// Eğer crop uygulanmışsa, mevcut crop değerlerini koru
	if (cropArea.value?.isApplied === true) {
		return;
	}

	if (!newRatio || newRatio === "auto") {
		// Auto seçildiğinde orijinal boyutları kullan
		cropArea.value = {
			x: 0,
			y: 0,
			width: videoElement.videoWidth,
			height: videoElement.videoHeight,
			isApplied: false,
		};
	} else {
		// Diğer aspect ratio'lar için mevcut hesaplama
		const [widthRatio, heightRatio] = newRatio.split(":").map(Number);
		const targetRatio = widthRatio / heightRatio;
		const currentRatio = videoElement.videoWidth / videoElement.videoHeight;

		if (currentRatio > targetRatio) {
			// Video daha geniş, yüksekliği kullan
			const newWidth = videoElement.videoHeight * targetRatio;
			cropArea.value = {
				x: (videoElement.videoWidth - newWidth) / 2,
				y: 0,
				width: newWidth,
				height: videoElement.videoHeight,
				isApplied: false,
			};
		} else {
			// Video daha dar, genişliği kullan
			const newHeight = videoElement.videoWidth / targetRatio;
			cropArea.value = {
				x: 0,
				y: (videoElement.videoHeight - newHeight) / 2,
				width: videoElement.videoWidth,
				height: newHeight,
				isApplied: false,
			};
		}
	}

	// Crop değişikliğini bildir
	emit("cropChange", cropArea.value);
});

// Aspect ratio değişikliğini izle ve canvas'ı güncelle
watch(
	cropRatio,
	(newRatio) => {
		// Reset position to center when aspect ratio changes
		position.value = { x: 0, y: 0 };
		videoPosition.value = { x: 0, y: 0 };

		// Canvas'ı yeniden boyutlandır
		if (containerRef.value && canvasRef.value) {
			const container = containerRef.value;
			const canvas = canvasRef.value;

			// Container boyutlarını güncelle
			requestAnimationFrame(() => {
				// Canvas boyutlarını güncelle
				canvas.width = container.clientWidth;
				canvas.height = container.clientHeight;

				// Kırpma alanını ve video pozisyonunu güncelle
				updateCropArea();

				// Canvas'ı hemen güncelle
				updateCanvas(performance.now());
			});
		}
	},
	{ immediate: true }
);

// Kamera pozisyonu için state
const lastCameraX = ref(0);
const lastCameraY = ref(0);

// Mouse event handlers
const handleMouseDown = (e) => {
	if (!canvasRef.value) return;

	const rect = canvasRef.value.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	const mouseX = (e.clientX - rect.left) * dpr * scaleValue;
	const mouseY = (e.clientY - rect.top) * dpr * scaleValue;

	// Kamera üzerinde tıklandıysa
	if (isMouseOverCamera.value) {
		// Eğer followMouse aktifse camera ayarları sekmesini aç
		if (cameraSettings.value.followMouse) {
			emit("openCameraSettings");
			return;
		}
		// Takip modu kapalıysa kamerayı sürükle
		const currentCameraPos = lastCameraPosition.value ||
			cameraPosition.value || { x: 0, y: 0 };
		startCameraDrag(e, currentCameraPos, mouseX, mouseY);
	} else {
		// Değilse videoyu sürükle
		startVideoDrag(
			e,
			{ x: position.value.x, y: position.value.y },
			mouseX,
			mouseY
		);
	}
};

const handleMouseMove = (e) => {
	if (!canvasRef.value) return;

	// Mouse görünürlüğü kapalıysa sadece pozisyonu güncelle, canvas'ı güncelleme
	const rect = canvasRef.value.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	const mouseX = (e.clientX - rect.left) * dpr * scaleValue;
	const mouseY = (e.clientY - rect.top) * dpr * scaleValue;

	// Mouse pozisyonlarını güncelle
	mousePosition.value = { x: mouseX, y: mouseY };

	// Video hover detection
	updateVideoHoverState(mouseX, mouseY);

	// Canvas'ı sürekli güncelle (hover efekti için)
	requestAnimationFrame(() => {
		updateCanvas(performance.now(), mouseX, mouseY);
	});
};

const handleMouseUp = () => {
	if (isCameraDragging.value) {
		stopCameraDrag();
	}
	if (isVideoDragging.value) {
		stopVideoDrag();
	}
};

// Crop işlemi uygulandığında
const handleCropApplied = (cropData) => {
	// Crop verilerini doğrula
	if (!cropData || !videoElement) {
		console.warn("[MediaPlayer] Invalid crop data or video element");
		return;
	}

	// Video boyutlarına göre crop koordinatlarını hesapla
	const videoWidth = videoElement.videoWidth;
	const videoHeight = videoElement.videoHeight;

	// Crop verilerini video sınırları içinde tut ve gerçek piksel değerlerine dönüştür
	const validatedCropData = {
		x: Math.round(Math.max(0, Math.min(cropData.x * videoWidth, videoWidth))),
		y: Math.round(Math.max(0, Math.min(cropData.y * videoHeight, videoHeight))),
		width: Math.round(Math.min(cropData.width * videoWidth, videoWidth)),
		height: Math.round(Math.min(cropData.height * videoHeight, videoHeight)),
		isApplied: true, // Crop'un uygulandığını belirt
	};

	// Kırpma verilerini kaydet
	cropArea.value = validatedCropData;

	// Canvas'ı güncelle
	requestAnimationFrame(() => {
		updateCanvas(performance.now());
	});

	// Modal'ı kapat ve state'i güncelle
	showCropModal.value = false;
	emit("update:isCropMode", false);
	emit("cropChange", validatedCropData);
};

// isCropMode prop'unu izleyelim
watch(
	() => props.isCropMode,
	(newValue) => {
		showCropModal.value = newValue;
		if (!newValue) {
			emit("update:isCropMode", false);
		}
	}
);

// Add watch for audioUrl after other watches
// ... existing code ...
// Ses durumu güncelleme
watch(
	() => props.isMuted,
	(newMuted) => {
		if (videoElement) videoElement.muted = newMuted;
		if (cameraElement) cameraElement.muted = newMuted;
		if (audioRef.value) {
			audioRef.value.muted = newMuted;
		}
	},
	{ immediate: true }
);

// Audio URL değiştiğinde debug için log
watch(
	() => props.audioUrl,
	(newUrl, oldUrl) => {},
	{ immediate: true }
);
// ... existing code ...

// mouseVisible değişikliğini izle ve canvas'ı güncelle
watch(
	mouseVisible,
	() => {
		if (!ctx || !canvasRef.value) return;

		// Canvas'ı hemen güncelle
		requestAnimationFrame(() => {
			updateCanvas(performance.now());
		});
	},
	{ immediate: true }
);

// İlk frame'e seek etmek için yardımcı fonksiyon

// macOS Dock çizme fonksiyonu
const drawMacOSDock = (ctx, dpr) => {
	if (!canvasRef.value || !ctx) return;

	// Dock ikonları için önbellek oluştur - component scope'unda tutulur
	if (!window.dockIconCache) {
		window.dockIconCache = {};
	}

	try {
		// Canvas boyutlarını al
		const canvasWidth = canvasRef.value.width;
		const canvasHeight = canvasRef.value.height;

		// Dock öğelerini çiz
		if (visibleDockItems.value && visibleDockItems.value.length > 0) {
			// Dock ayarları
			const scale = dockSize.value;
			const dockHeight = 52 * dpr * scale;
			const dockRadius = 18 * dpr * scale;
			const iconSize = 48 * dpr * scale;
			const iconSpacing = 4 * dpr * scale; // İkonlar arası boşluğu artır
			const dividerSpacing = 8 * dpr * scale; // Ayırıcı için boşluk miktarını azalt

			// Dock içinde ayırıcı olup olmadığını kontrol et ve varsa ayırıcı sayısını bul
			let dividerCount = 0;
			visibleDockItems.value.forEach((item) => {
				if (item.isDivider) dividerCount++;
			});

			// Dock toplam genişliğini hesapla
			const dockWidth =
				iconSize * visibleDockItems.value.length + // İkonların toplam genişliği
				iconSpacing * (visibleDockItems.value.length - 1) + // İkonlar arası boşluk (son ikon için boşluk yok)
				dividerSpacing * dividerCount * 2; // Ayırıcılar için ekstra boşluk (her iki tarafta)

			// Dock'u yatayda ortala
			const dockX = Math.floor((canvasWidth - dockWidth) / 2);
			const dockY = canvasHeight - dockHeight - 5 * dpr * scale;

			// 1. ADIM: Mevcut canvas içeriğini bir kopyasını al (arkaplanı blurlayacağız)
			const contentCanvas = document.createElement("canvas");
			contentCanvas.width = canvasWidth;
			contentCanvas.height = canvasHeight;
			const contentCtx = contentCanvas.getContext("2d");

			// Mevcut canvas içeriğini kopyala
			contentCtx.drawImage(canvasRef.value, 0, 0);

			// 2. ADIM: Dock alanı için maskeleme yaparak blur uygula
			const backdropCanvas = document.createElement("canvas");
			backdropCanvas.width = canvasWidth;
			backdropCanvas.height = canvasHeight;
			const backdropCtx = backdropCanvas.getContext("2d");

			// Önce mevcut içeriği kopyala
			backdropCtx.drawImage(contentCanvas, 0, 0);

			// Dock alanına blur uygula
			backdropCtx.save();
			backdropCtx.beginPath();
			roundedRect(backdropCtx, dockX, dockY, dockWidth, dockHeight, dockRadius);
			backdropCtx.clip();

			// Blur filtresi uygula - Daha güçlü blur efekti
			backdropCtx.filter = `blur(${30 * dpr}px)`;
			backdropCtx.drawImage(contentCanvas, 0, 0);
			backdropCtx.filter = "none";
			backdropCtx.restore();

			// 3. ADIM: Shadow çizimi için geçici canvas oluştur
			const shadowCanvas = document.createElement("canvas");
			shadowCanvas.width = canvasWidth;
			shadowCanvas.height = canvasHeight;
			const shadowCtx = shadowCanvas.getContext("2d");

			// Shadow çiz - daha belirgin gölge
			shadowCtx.save();
			shadowCtx.shadowColor = "rgba(0, 0, 0, 0.8)";
			shadowCtx.shadowBlur = 25 * dpr;
			shadowCtx.shadowOffsetX = 0;
			shadowCtx.shadowOffsetY = 2 * dpr;

			// Shadow için şekil çiz
			shadowCtx.beginPath();
			roundedRect(shadowCtx, dockX, dockY, dockWidth, dockHeight, dockRadius);
			shadowCtx.fillStyle = "rgba(255, 255, 255, 0.005)";
			shadowCtx.fill();
			shadowCtx.restore();

			// 4. ADIM: Ana canvas'a tüm efektleri çiz
			ctx.save();

			// Önce blurlu arkaplanı çiz
			ctx.drawImage(backdropCanvas, 0, 0);

			// Sonra üzerine buzlu cam efekti ekle
			ctx.globalCompositeOperation = "source-over";
			ctx.beginPath();
			roundedRect(ctx, dockX, dockY, dockWidth, dockHeight, dockRadius);
			ctx.fillStyle = "rgba(255, 255, 255, 0.15)"; // Daha belirgin arka plan
			ctx.fill();

			// Shadow'u çiz
			ctx.drawImage(shadowCanvas, 0, 0);

			// Border çiz - daha belirgin kenarlar
			ctx.beginPath();
			roundedRect(ctx, dockX, dockY, dockWidth + 2, dockHeight + 2, dockRadius);
			ctx.strokeStyle = "rgba(255, 255, 255, 0.23)";
			ctx.lineWidth = 4 * dpr;
			ctx.stroke();

			// İkonları çizmeye hazırlan
			ctx.restore();

			// 5. ADIM: İkonları çiz (blursuz ve net olarak)
			const totalIcons = visibleDockItems.value.length;

			// İlk ikon konumu (dock'un sol kenarından iconSpacing kadar içeride)
			let currentX = dockX + iconSpacing;

			// Her dock öğesi için icon çiz
			visibleDockItems.value.forEach((item, index) => {
				// Eğer bu öğe divider özelliğine sahipse, ayırıcı çiz
				if (item.isDivider) {
					// Divider'dan önce boşluk bırak
					currentX += dividerSpacing;

					// Ayırıcı çizgisi için koordinatları hesapla
					const dividerX = currentX;
					const dividerY = dockY + dockHeight * 0.2; // Dock'un üst kısmından başla
					const dividerHeight = dockHeight * 0.6; // Dock'un %60'ı kadar uzunlukta

					// Ayırıcı çizgisini çiz
					ctx.save();
					ctx.beginPath();
					ctx.moveTo(dividerX, dividerY);
					ctx.lineTo(dividerX, dividerY + dividerHeight);
					ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"; // Biraz daha belirgin beyaz
					ctx.lineWidth = 2 * dpr * scale; // Çizgi kalınlığını artır
					ctx.stroke();
					ctx.restore();

					// Divider'dan sonra boşluk bırak
					currentX += dividerSpacing;
				}

				// İkon için X ve Y pozisyonlarını hesapla
				const iconX = currentX;
				const iconY = dockY + (dockHeight - iconSize) / 2;
				const cacheKey = item.name || `icon-${index}`;

				// Icon varsa çiz
				if (item.iconDataUrl) {
					// Cache'de var mı kontrol et
					if (window.dockIconCache[cacheKey]) {
						// Cache'den çiz
						ctx.save();
						ctx.beginPath();
						ctx.arc(
							iconX + iconSize / 2,
							iconY + iconSize / 2,
							iconSize / 2,
							0,
							2 * Math.PI
						);
						ctx.clip();
						ctx.drawImage(
							window.dockIconCache[cacheKey],
							iconX,
							iconY,
							iconSize,
							iconSize
						);
						ctx.restore();
					} else {
						// Yeni image yükle
						const img = new Image();
						img.onload = () => {
							// Cache'e ekle
							window.dockIconCache[cacheKey] = img;

							// Yuvarlak kırpma maskesi oluştur
							ctx.save();
							ctx.beginPath();
							ctx.arc(
								iconX + iconSize / 2,
								iconY + iconSize / 2,
								iconSize / 2,
								0,
								2 * Math.PI
							);
							ctx.clip();

							// İkonu çiz
							ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
							ctx.restore();

							// Canvas'ı güncelle
							requestAnimationFrame(updateCanvas);
						};
						img.src = item.iconDataUrl;
					}
				}

				// Sonraki ikon için X pozisyonunu güncelle (ikon genişliği + boşluk)
				currentX += iconSize + iconSpacing;
			});
		}

		ctx.restore();
	} catch (error) {
		console.error("[MediaPlayer] Error drawing macOS dock:", error);
	}
};

// Yuvarlak köşeli dikdörtgen çizme yardımcı fonksiyonu
const roundedRect = (ctx, x, y, width, height, radius) => {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
};

// Video alanının canvas üzerindeki koordinatlarını ve boyutunu hesaplayan yardımcı fonksiyon
function getVideoDisplayRect() {
	if (!canvasRef.value || !videoElement)
		return { x: 0, y: 0, width: 0, height: 0 };
	const dpr = window.devicePixelRatio || 1;
	const canvasWidth = canvasRef.value.width;
	const canvasHeight = canvasRef.value.height;
	let sourceWidth, sourceHeight;
	if (cropArea.value?.isApplied) {
		sourceWidth = cropArea.value.width;
		sourceHeight = cropArea.value.height;
	} else {
		sourceWidth = videoElement.videoWidth;
		sourceHeight = videoElement.videoHeight;
	}
	const sourceRatio = sourceWidth / sourceHeight;
	const availableWidth = canvasWidth - padding.value * 2 * dpr;
	const availableHeight = canvasHeight - padding.value * 2 * dpr;
	const availableRatio = availableWidth / availableHeight;
	let drawWidth, drawHeight, x, y;
	if (sourceRatio > availableRatio) {
		drawWidth = availableWidth;
		drawHeight = drawWidth / sourceRatio;
		x = padding.value * dpr;
		y = padding.value * dpr + (availableHeight - drawHeight) / 2;
	} else {
		drawHeight = availableHeight;
		drawWidth = drawHeight * sourceRatio;
		x = padding.value * dpr + (availableWidth - drawWidth) / 2;
		y = padding.value * dpr;
	}
	const offsetX = position.value.x * dpr;
	const offsetY = position.value.y * dpr;
	return {
		x: x + offsetX,
		y: y + offsetY,
		width: drawWidth,
		height: drawHeight,
		dpr,
	};
}
</script>

<style scoped>
canvas {
	image-rendering: -webkit-optimize-contrast;
	image-rendering: crisp-edges;
	image-rendering: pixelated;
	image-rendering: optimizeQuality;
	-webkit-backface-visibility: hidden;
	backface-visibility: hidden;
	transform: translateZ(0);
	perspective: 1000;
	-webkit-transform-style: preserve-3d;
	transform-style: preserve-3d;
	-webkit-perspective: 1000;
}

video {
	image-rendering: -webkit-optimize-contrast;
	image-rendering: crisp-edges;
	image-rendering: optimizeQuality;
	-webkit-backface-visibility: hidden;
	backface-visibility: hidden;
	transform: translateZ(0);
	perspective: 1000;
	-webkit-transform-style: preserve-3d;
	transform-style: preserve-3d;
	-webkit-perspective: 1000;
}
</style>
