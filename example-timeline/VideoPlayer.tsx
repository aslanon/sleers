import React, { useRef, useEffect } from "react";

interface VideoPlayerProps {
	videoUrl: string;
	currentTime: number;
	onDurationChange: (duration: number) => void;
	onTimeUpdate: (time: number) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
	videoUrl,
	currentTime,
	onDurationChange,
	onTimeUpdate,
}) => {
	const videoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		if (
			videoRef.current &&
			Math.abs(videoRef.current.currentTime - currentTime) > 0.5
		) {
			videoRef.current.currentTime = currentTime;
		}
	}, [currentTime]);

	const handleLoadedMetadata = () => {
		if (videoRef.current) {
			onDurationChange(videoRef.current.duration);
		}
	};

	const handleTimeUpdate = () => {
		if (videoRef.current) {
			onTimeUpdate(videoRef.current.currentTime);
		}
	};

	return (
		<video
			ref={videoRef}
			className="w-full rounded-lg"
			src={videoUrl}
			onLoadedMetadata={handleLoadedMetadata}
			onTimeUpdate={handleTimeUpdate}
			controls
		/>
	);
};

export default VideoPlayer;
