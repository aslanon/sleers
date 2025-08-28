export const useVideoEvents = (videoElement, handlers) => {
	const events = {
		loadedmetadata: handlers.onVideoMetadataLoaded,
		loadeddata: handlers.onVideoDataLoaded,
		durationchange: handlers.onDurationChange,
		timeupdate: handlers.onTimeUpdate,
		ended: handlers.onVideoEnded,
		error: handlers.onVideoError,
		play: handlers.onVideoPlay,
		pause: handlers.onVideoPause,
		seeking: handlers.onVideoSeeking,
		seeked: handlers.onVideoSeeked,
		ratechange: handlers.onVideoRateChange,
		volumechange: handlers.onVideoVolumeChange,
	};

	// Add event listeners
	const addEvents = () => {
		if (!videoElement) return;

		Object.entries(events).forEach(([event, handler]) => {
			if (handler) {
				videoElement.addEventListener(event, handler);
			}
		});
	};

	// Remove event listeners
	const removeEvents = () => {
		if (!videoElement) return;

		Object.entries(events).forEach(([event, handler]) => {
			if (handler) {
				videoElement.removeEventListener(event, handler);
			}
		});
	};

	return {
		addEvents,
		removeEvents,
	};
};
