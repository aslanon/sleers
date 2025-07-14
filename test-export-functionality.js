/**
 * Test Export Functionality
 * 
 * This script tests the export functionality to ensure it works correctly.
 * Run this in the browser console on the editor page.
 */

// Test function to create a mock export scenario
async function testExportFunctionality() {
    console.log("🔍 Testing Export Functionality...");
    
    // 1. Check if we're on the editor page
    if (!window.location.pathname.includes('/editor')) {
        console.error("❌ Please run this test on the editor page (/editor)");
        return;
    }
    
    // 2. Check if MediaPlayer is available
    const mediaPlayerContainer = document.querySelector('.media-player');
    if (!mediaPlayerContainer) {
        console.error("❌ MediaPlayer container not found");
        return;
    }
    
    // 3. Check if ExportService is available
    if (typeof ExportService === 'undefined') {
        console.error("❌ ExportService not available. Make sure you're in the context where it's imported.");
        return;
    }
    
    console.log("✅ Basic checks passed");
    
    // 4. Test MediaRecorder support
    console.log("\n📹 Testing MediaRecorder Support:");
    
    const testMediaRecorder = () => {
        if (typeof MediaRecorder === 'undefined') {
            console.error("❌ MediaRecorder not supported in this browser");
            return false;
        }
        
        console.log("✅ MediaRecorder is available");
        
        // Test supported formats
        const formats = [
            'video/webm',
            'video/webm;codecs=vp8',
            'video/webm;codecs=vp9',
            'video/mp4'
        ];
        
        formats.forEach(format => {
            const supported = MediaRecorder.isTypeSupported(format);
            console.log(`${supported ? '✅' : '❌'} ${format}: ${supported ? 'Supported' : 'Not supported'}`);
        });
        
        return true;
    };
    
    if (!testMediaRecorder()) {
        return;
    }
    
    // 5. Test Canvas and Stream Capture
    console.log("\n🎨 Testing Canvas and Stream Capture:");
    
    const testCanvasCapture = () => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d');
            
            // Draw test pattern
            ctx.fillStyle = '#333';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Test Export', canvas.width / 2, canvas.height / 2);
            
            // Test stream capture
            const stream = canvas.captureStream(30);
            console.log("✅ Canvas stream capture successful");
            console.log(`   Video tracks: ${stream.getVideoTracks().length}`);
            
            return { canvas, stream };
        } catch (error) {
            console.error("❌ Canvas capture failed:", error);
            return null;
        }
    };
    
    const canvasTest = testCanvasCapture();
    if (!canvasTest) {
        return;
    }
    
    // 6. Test MediaRecorder with real stream
    console.log("\n🎬 Testing MediaRecorder with Stream:");
    
    const testMediaRecorderWithStream = () => {
        return new Promise((resolve, reject) => {
            try {
                const mediaRecorder = new MediaRecorder(canvasTest.stream, {
                    mimeType: 'video/webm',
                    videoBitsPerSecond: 2500000
                });
                
                console.log("✅ MediaRecorder created successfully");
                console.log(`   State: ${mediaRecorder.state}`);
                console.log(`   MIME Type: ${mediaRecorder.mimeType}`);
                
                const chunks = [];
                
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        chunks.push(event.data);
                        console.log(`   📊 Data chunk: ${event.data.size} bytes`);
                    }
                };
                
                mediaRecorder.onstop = () => {
                    console.log("✅ MediaRecorder stopped successfully");
                    console.log(`   Total chunks: ${chunks.length}`);
                    
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    console.log(`   Final blob size: ${blob.size} bytes`);
                    
                    if (blob.size > 0) {
                        console.log("✅ MediaRecorder test passed!");
                        resolve(true);
                    } else {
                        console.error("❌ MediaRecorder test failed - empty blob");
                        resolve(false);
                    }
                };
                
                mediaRecorder.onerror = (error) => {
                    console.error("❌ MediaRecorder error:", error);
                    reject(error);
                };
                
                // Record for 2 seconds
                mediaRecorder.start(1000);
                console.log("   🔴 Recording started...");
                
                setTimeout(() => {
                    if (mediaRecorder.state === 'recording') {
                        mediaRecorder.stop();
                        console.log("   ⏹️ Recording stopped");
                    }
                }, 2000);
                
            } catch (error) {
                console.error("❌ MediaRecorder test failed:", error);
                reject(error);
            }
        });
    };
    
    try {
        const mediaRecorderTest = await testMediaRecorderWithStream();
        if (!mediaRecorderTest) {
            return;
        }
    } catch (error) {
        console.error("❌ MediaRecorder test failed:", error);
        return;
    }
    
    // 7. Test Export Service with Mock Data
    console.log("\n🚀 Testing Export Service:");
    
    const testExportService = () => {
        return new Promise((resolve, reject) => {
            // Create a mock MediaPlayer
            const mockMediaPlayer = {
                getVideoElement: () => ({
                    duration: 5,
                    currentTime: 0,
                    paused: false
                }),
                
                getCanvas: () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1280;
                    canvas.height = 720;
                    return canvas;
                },
                
                getSegments: () => [
                    { start: 0, end: 2.5 },
                    { start: 2.5, end: 5 }
                ],
                
                getClippedDuration: () => 5,
                
                seek: async (time) => {
                    console.log(`   🎯 Seeking to: ${time.toFixed(2)}s`);
                    return Promise.resolve();
                },
                
                play: async () => {
                    console.log("   ▶️ Playing...");
                    return Promise.resolve();
                },
                
                pause: async () => {
                    console.log("   ⏸️ Pausing...");
                    return Promise.resolve();
                },
                
                convertClippedToRealTime: (clippedTime) => {
                    return clippedTime; // Simple 1:1 mapping for test
                },
                
                handleMousePositionForExport: (realTime) => {
                    console.log(`   🖱️ Mouse position updated for time: ${realTime.toFixed(2)}s`);
                },
                
                captureFrameWithSize: (width, height) => {
                    // Create a test frame
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    
                    // Draw test pattern
                    ctx.fillStyle = '#1a1a1a';
                    ctx.fillRect(0, 0, width, height);
                    ctx.fillStyle = '#432af4';
                    ctx.fillRect(50, 50, width - 100, height - 100);
                    ctx.fillStyle = 'white';
                    ctx.font = '48px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('Test Frame', width / 2, height / 2);
                    
                    return canvas.toDataURL();
                }
            };
            
            const settings = {
                format: 'mp4',
                resolution: '720p',
                quality: 'medium',
                filename: 'test-export',
                directory: '/tmp'
            };
            
            let progressCount = 0;
            let lastProgress = 0;
            
            const onProgress = (progress) => {
                progressCount++;
                lastProgress = progress;
                console.log(`   📊 Progress: ${progress}%`);
            };
            
            const onComplete = (data) => {
                console.log("✅ Export completed successfully!");
                console.log(`   Format: ${data.format}`);
                console.log(`   Size: ${data.width}x${data.height}`);
                console.log(`   Progress updates: ${progressCount}`);
                console.log(`   Final progress: ${lastProgress}%`);
                
                // Check if we got reasonable progress updates
                if (progressCount > 0 && lastProgress >= 95) {
                    console.log("✅ Export Service test passed!");
                    resolve(true);
                } else {
                    console.error("❌ Export Service test failed - insufficient progress updates");
                    resolve(false);
                }
            };
            
            const onError = (error) => {
                console.error("❌ Export Service error:", error);
                reject(error);
            };
            
            try {
                console.log("   🎬 Starting export...");
                ExportService.exportVideo(mockMediaPlayer, settings, onProgress, onComplete, onError);
            } catch (error) {
                console.error("❌ Export Service failed to start:", error);
                reject(error);
            }
        });
    };
    
    try {
        const exportTest = await testExportService();
        if (exportTest) {
            console.log("\n🎉 All tests passed! Export functionality is working.");
        } else {
            console.log("\n❌ Export Service test failed.");
        }
    } catch (error) {
        console.error("\n❌ Export Service test failed:", error);
    }
}

// Test function for real export (use this when you have a loaded video)
async function testRealExport() {
    console.log("🔍 Testing Real Export...");
    
    // Find the media player reference
    const app = document.querySelector('#__nuxt')?.__vue_app__;
    if (!app) {
        console.error("❌ Vue app not found");
        return;
    }
    
    // Try to find the media player component
    const mediaPlayerElement = document.querySelector('.media-player');
    if (!mediaPlayerElement) {
        console.error("❌ MediaPlayer element not found");
        return;
    }
    
    // Simulate export button click
    console.log("🎯 Simulating export button click...");
    
    const exportButton = document.querySelector('.btn-export');
    if (!exportButton) {
        console.error("❌ Export button not found");
        return;
    }
    
    // Click the export button
    exportButton.click();
    
    console.log("✅ Export modal should now be open. Try exporting a video to test the functionality.");
}

// Make functions available globally
window.testExportFunctionality = testExportFunctionality;
window.testRealExport = testRealExport;

// Auto-run basic test
if (typeof window !== 'undefined' && window.document) {
    console.log("📋 Export test functions loaded:");
    console.log("  - testExportFunctionality() - Test all export components");
    console.log("  - testRealExport() - Test with real video (requires loaded video)");
    console.log("\nRun testExportFunctionality() to start testing!");
}