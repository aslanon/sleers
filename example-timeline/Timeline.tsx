import React, { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

interface TimelineProps {
	duration: number;
	onTimeChange: (time: number) => void;
	currentTime: number;
}

const Timeline: React.FC<TimelineProps> = ({
	duration,
	onTimeChange,
	currentTime,
}) => {
	const [zoom, setZoom] = useState(1);
	const timelineRef = useRef < HTMLDivElement > null;
	const containerRef = useRef < HTMLDivElement > null;

	const TIMELINE_WIDTH = 1000;
	const zoomedWidth = TIMELINE_WIDTH * zoom;
	const secondsPerPixel = duration / zoomedWidth;

	const formatTime = (seconds: number): string => {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = Math.floor(seconds % 60);
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	// Update scroll position when currentTime changes
	useEffect(() => {
		if (!containerRef.current) return;

		const markerPosition = (currentTime / duration) * zoomedWidth;
		const container = containerRef.current;
		const viewportWidth = container.clientWidth;

		if (
			markerPosition > container.scrollLeft + viewportWidth * 0.7 ||
			markerPosition < container.scrollLeft + viewportWidth * 0.3
		) {
			container.scrollLeft = markerPosition - viewportWidth / 2;
		}
	}, [currentTime, duration, zoomedWidth]);

	const handleZoomIn = () => {
		setZoom((prev) => {
			const newZoom = Math.min(prev * 1.5, 10);
			return newZoom;
		});
	};

	const handleZoomOut = () => {
		setZoom((prev) => {
			const newZoom = Math.max(prev / 1.5, 1);
			return newZoom;
		});
	};

	const handleTimelineClick = (e: React.MouseEvent) => {
		if (!containerRef.current) return;

		const rect = containerRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left + containerRef.current.scrollLeft;
		const newTime = x * secondsPerPixel;

		if (newTime >= 0 && newTime <= duration) {
			onTimeChange(newTime);
		}
	};

	const renderTimeMarkers = () => {
		const markers = [];
		const step = Math.max(30 / zoom, 5); // Daha sık marker göster

		for (let time = 0; time <= duration; time += step) {
			const position = (time / duration) * zoomedWidth;
			markers.push(
				<div
					key={time}
					className="absolute flex flex-col items-center"
					style={{ left: `${position}px` }}
				>
					<div className="h-3 w-0.5 bg-gray-400" />
					<span className="text-xs text-gray-600">{formatTime(time)}</span>
				</div>
			);
		}
		return markers;
	};

	return (
		<div className="w-full max-w-[1000px] mx-auto p-4 bg-white rounded-lg shadow-lg">
			<div className="flex justify-between items-center mb-4">
				<div className="text-lg font-semibold">Timeline</div>
				<div className="flex gap-2">
					<button
						onClick={handleZoomOut}
						className="p-2 rounded hover:bg-gray-100"
						title="Zoom Out"
					>
						<ZoomOut className="w-5 h-5" />
					</button>
					<button
						onClick={handleZoomIn}
						className="p-2 rounded hover:bg-gray-100"
						title="Zoom In"
					>
						<ZoomIn className="w-5 h-5" />
					</button>
				</div>
			</div>

			<div
				ref={containerRef}
				className="overflow-x-auto relative border rounded-lg"
			>
				<div
					ref={timelineRef}
					className="relative h-20 bg-gray-50"
					style={{ width: `${zoomedWidth}px` }}
					onClick={handleTimelineClick}
				>
					{renderTimeMarkers()}

					{/* Current time indicator */}
					<div
						className="absolute top-0 w-0.5 h-full bg-blue-500"
						style={{
							left: `${(currentTime / duration) * zoomedWidth}px`,
							transform: "translateX(-50%)",
						}}
					/>

					{/* Playhead */}
					<div
						className="absolute -top-2 w-4 h-4 cursor-pointer"
						style={{
							left: `${(currentTime / duration) * zoomedWidth}px`,
							transform: "translateX(-50%)",
						}}
					>
						<div className="w-4 h-4 bg-blue-500 rounded-full" />
					</div>
				</div>
			</div>

			<div className="mt-2 flex justify-between text-sm text-gray-600">
				<span>Current Time: {formatTime(currentTime)}</span>
				<span>Total Duration: {formatTime(duration)}</span>
			</div>
		</div>
	);
};

export default Timeline;
