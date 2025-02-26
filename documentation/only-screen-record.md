import fs from "node:fs";
import { join } from "path";

let aperture; // Declare variable to hold the dynamically imported module
let recording;

async function initializeAperture() {
if (!aperture) {
aperture = await import("aperture"); // Import aperture globally
}
}

async function start(path) {
try {
await initializeAperture(); // Ensure aperture is loaded

    console.log("Screens:", await aperture.screens());
    console.log("Audio devices:", await aperture.audioDevices());
    console.log("Video codecs:", aperture.videoCodecs);

    console.log("Preparing to start recording");
    recording = await aperture.startRecording({
      showCursor: false,
    });
    console.log("Recording started");

    // Wait for file to be ready
    await recording.isFileReady;
    console.log("Recording in progress...");

    return recording;

} catch (error) {
console.error("Error while starting recording:", error);
}
}

async function stop(path) {
try {
if (!recording) {
throw new Error("No recording in progress.");
}

    await initializeAperture();  // Ensure aperture is loaded
    console.log("Stopping recording...");

    const fp = await aperture.stopRecording(recording);
    const destinationPath = join(path, "recording.mp4");

    fs.renameSync(fp, destinationPath);
    console.log(`Video saved at: ${destinationPath}`);

} catch (error) {
console.error("Error while stopping recording:", error);
}
}

export { start, stop };
