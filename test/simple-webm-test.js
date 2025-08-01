// Simple WebM export test
console.log("🧪 Testing WebM export logic...");

// Test WebM format handling
const settings = { format: "webm", duration: 10 };
const shouldUseMediaRecorder =
	settings.format === "webm" && settings.duration > 0;
console.log("WebM should use MediaRecorder:", shouldUseMediaRecorder);

// Test frame-based export prevention
const shouldPreventFrameExport = settings.format === "webm";
console.log("WebM should prevent frame export:", shouldPreventFrameExport);

// Test MP4 long video logic
const mp4Settings = { format: "mp4", duration: 400 };
const shouldUseFrameExport =
	mp4Settings.format === "mp4" && mp4Settings.duration > 300;
console.log("MP4 long video should use frame export:", shouldUseFrameExport);

console.log("✅ All tests completed!");
