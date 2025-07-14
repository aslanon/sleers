/**
 * Export Test Script
 * This script helps test the export functionality and identify issues
 */

// Test function to simulate export without actual video
function testExportFunctionality() {
    console.log("=== Export Test Started ===");
    
    // Test 1: Check if MediaRecorder is available
    console.log("\n1. Testing MediaRecorder availability:");
    if (typeof MediaRecorder === 'undefined') {
        console.error("❌ MediaRecorder is not available in this environment");
        return false;
    } else {
        console.log("✅ MediaRecorder is available");
    }
    
    // Test 2: Check supported MIME types
    console.log("\n2. Testing supported MIME types:");
    const mimeTypes = [
        'video/webm',
        'video/webm;codecs=vp8',
        'video/webm;codecs=vp9',
        'video/mp4',
        'video/mp4;codecs=h264'
    ];
    
    mimeTypes.forEach(type => {
        const isSupported = MediaRecorder.isTypeSupported(type);
        console.log(`${isSupported ? '✅' : '❌'} ${type}: ${isSupported ? 'Supported' : 'Not supported'}`);
    });
    
    // Test 3: Create a test canvas
    console.log("\n3. Testing canvas creation:");
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
        console.error("❌ Canvas context not available");
        return false;
    }
    
    // Draw a simple test pattern
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(canvas.width / 2, 0, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(0, canvas.height / 2, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(canvas.width / 2, canvas.height / 2, canvas.width / 2, canvas.height / 2);
    
    console.log("✅ Canvas created and test pattern drawn");
    
    // Test 4: Test stream capture
    console.log("\n4. Testing canvas stream capture:");
    try {
        const stream = canvas.captureStream(30);
        console.log("✅ Canvas stream capture successful");
        console.log(`   Video tracks: ${stream.getVideoTracks().length}`);
        console.log(`   Audio tracks: ${stream.getAudioTracks().length}`);
        
        // Test 5: Test MediaRecorder with stream
        console.log("\n5. Testing MediaRecorder with stream:");
        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm',
            videoBitsPerSecond: 2500000
        });
        
        console.log("✅ MediaRecorder created successfully");
        console.log(`   State: ${mediaRecorder.state}`);
        console.log(`   MIME type: ${mediaRecorder.mimeType}`);
        
        // Test recording for 2 seconds
        const chunks = [];
        let recordingComplete = false;
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
                console.log(`   Data chunk received: ${e.data.size} bytes`);
            }
        };
        
        mediaRecorder.onstop = () => {
            recordingComplete = true;
            console.log("✅ Recording completed successfully");
            console.log(`   Total chunks: ${chunks.length}`);
            const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
            console.log(`   Total size: ${totalSize} bytes`);
            
            // Create blob and test conversion
            const blob = new Blob(chunks, { type: 'video/webm' });
            console.log(`   Final blob size: ${blob.size} bytes`);
            
            // Test base64 conversion
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result;
                console.log(`   Base64 conversion successful: ${base64.length} characters`);
                console.log("\n=== Export Test Completed Successfully ===");
            };
            reader.readAsDataURL(blob);
        };
        
        mediaRecorder.onerror = (e) => {
            console.error("❌ MediaRecorder error:", e.error);
        };
        
        // Start recording
        mediaRecorder.start(1000);
        console.log("   Recording started...");
        
        // Animate the canvas during recording
        let frame = 0;
        const animateCanvas = () => {
            if (mediaRecorder.state === 'recording' && frame < 60) { // 2 seconds at 30fps
                // Clear and redraw with rotation
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.save();
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(frame * 0.1);
                ctx.fillStyle = `hsl(${frame * 6}, 70%, 50%)`;
                ctx.fillRect(-100, -100, 200, 200);
                ctx.restore();
                
                frame++;
                requestAnimationFrame(animateCanvas);
            } else if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
        };
        
        animateCanvas();
        
        return true;
        
    } catch (error) {
        console.error("❌ Canvas stream capture failed:", error);
        return false;
    }
}

// Mock MediaPlayer for testing
class MockMediaPlayer {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 1280;
        this.canvas.height = 720;
        this.ctx = this.canvas.getContext('2d');
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 10; // 10 seconds
        this.segments = [
            { start: 0, end: 5 },
            { start: 5, end: 10 }
        ];
        
        // Draw initial frame
        this.drawTestFrame();
    }
    
    drawTestFrame() {
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Time: ${this.currentTime.toFixed(2)}s`, this.canvas.width / 2, this.canvas.height / 2);
    }
    
    getVideoElement() {
        // Return a mock video element
        return {
            duration: this.duration,
            currentTime: this.currentTime,
            paused: !this.isPlaying,
            play: () => { this.isPlaying = true; },
            pause: () => { this.isPlaying = false; }
        };
    }
    
    getCanvas() {
        return this.canvas;
    }
    
    getSegments() {
        return this.segments;
    }
    
    getClippedDuration() {
        return this.segments.reduce((total, segment) => total + (segment.end - segment.start), 0);
    }
    
    seek(time) {
        this.currentTime = time;
        this.drawTestFrame();
    }
    
    play() {
        this.isPlaying = true;
        return Promise.resolve();
    }
    
    pause() {
        this.isPlaying = false;
        return Promise.resolve();
    }
    
    captureFrameWithSize(width, height) {
        // Create a temporary canvas for the requested size
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw the current frame scaled to the requested size
        tempCtx.drawImage(this.canvas, 0, 0, width, height);
        
        return tempCanvas.toDataURL();
    }
}

// Test the actual export service
async function testExportService() {
    console.log("\n=== Testing Export Service ===");
    
    // Import the ExportService (assuming it's available)
    if (typeof ExportService === 'undefined') {
        console.error("❌ ExportService not available");
        return;
    }
    
    const mockMediaPlayer = new MockMediaPlayer();
    const mockSettings = {
        format: 'mp4',
        resolution: '720p',
        quality: 'medium',
        filename: 'test-export',
        directory: '/tmp'
    };
    
    let progressUpdates = 0;
    
    const onProgress = (progress) => {
        progressUpdates++;
        console.log(`   Progress: ${progress}%`);
    };
    
    const onComplete = (data) => {
        console.log("✅ Export completed successfully");
        console.log(`   Format: ${data.format}`);
        console.log(`   Size: ${data.width}x${data.height}`);
        console.log(`   Progress updates received: ${progressUpdates}`);
    };
    
    const onError = (error) => {
        console.error("❌ Export failed:", error);
    };
    
    try {
        await ExportService.exportVideo(mockMediaPlayer, mockSettings, onProgress, onComplete, onError);
    } catch (error) {
        console.error("❌ Export service error:", error);
    }
}

// Main test function
function runExportTests() {
    console.log("Starting export functionality tests...");
    
    // Run basic tests
    const basicTestsPassed = testExportFunctionality();
    
    if (basicTestsPassed) {
        // Run export service tests if basic tests pass
        setTimeout(() => {
            testExportService();
        }, 3000); // Wait for the first test to complete
    }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
    window.testExportFunctionality = testExportFunctionality;
    window.MockMediaPlayer = MockMediaPlayer;
    window.testExportService = testExportService;
    window.runExportTests = runExportTests;
}

// Auto-run if in browser
if (typeof window !== 'undefined' && window.document) {
    console.log("Export test script loaded. Run 'runExportTests()' in console to start tests.");
}