const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class FFmpegWrapper {
    constructor() {
        this.ffmpegPath = null;
        this.setupFFmpegPath();
    }

    setupFFmpegPath() {
        const isDev = process.env.NODE_ENV === 'development';
        
        console.log('🔍 FFmpegWrapper: Setting up FFmpeg path...');
        console.log('isDev:', isDev);
        console.log('process.resourcesPath:', process.resourcesPath);
        console.log('app.getAppPath():', app.getAppPath());
        console.log('__dirname:', __dirname);
        console.log('process.cwd():', process.cwd());
        
        if (isDev) {
            try {
                const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
                this.ffmpegPath = ffmpegInstaller.path;
                console.log('✅ Development FFmpeg path:', this.ffmpegPath);
                
                // Test file existence and permissions
                if (fs.existsSync(this.ffmpegPath)) {
                    const stats = fs.statSync(this.ffmpegPath);
                    console.log('📋 Dev FFmpeg stats:', {
                        isFile: stats.isFile(),
                        size: stats.size,
                        mode: stats.mode.toString(8),
                        executable: (stats.mode & parseInt('111', 8)) !== 0
                    });
                }
                return;
            } catch (error) {
                console.error('❌ Development FFmpeg setup failed:', error);
            }
        }

        // Production paths - daha kapsamlı
        const possiblePaths = [
            // extraResources'dan kopyalanan FFmpeg binary
            path.join(process.resourcesPath, 'ffmpeg'),
            // System FFmpeg as fallback
            '/usr/local/bin/ffmpeg',
            '/opt/homebrew/bin/ffmpeg',
            '/usr/bin/ffmpeg',
            // node_modules konumları
            path.join(process.resourcesPath, 'app', 'node_modules', '@ffmpeg-installer', 'darwin-arm64', 'ffmpeg'),
            path.join(app.getAppPath(), 'node_modules', '@ffmpeg-installer', 'darwin-arm64', 'ffmpeg'),
            path.join(process.resourcesPath, 'node_modules', '@ffmpeg-installer', 'darwin-arm64', 'ffmpeg'),
            // Diğer olası konumlar
            path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@ffmpeg-installer', 'darwin-arm64', 'ffmpeg'),
        ];

        console.log('🔍 Searching in', possiblePaths.length, 'possible locations...');

        for (const testPath of possiblePaths) {
            console.log('🔍 Testing FFmpeg path:', testPath);
            try {
                if (fs.existsSync(testPath)) {
                    const stats = fs.statSync(testPath);
                    console.log('📋 Found file stats:', {
                        path: testPath,
                        isFile: stats.isFile(),
                        size: stats.size,
                        mode: stats.mode.toString(8),
                        executable: (stats.mode & parseInt('111', 8)) !== 0
                    });
                    
                    if (stats.isFile()) {
                        // Make sure it's executable
                        try {
                            fs.chmodSync(testPath, '755');
                            console.log('✅ Made FFmpeg executable:', testPath);
                        } catch (chmodError) {
                            console.log('⚠️ Could not make executable:', chmodError.message);
                        }
                        
                        this.ffmpegPath = testPath;
                        console.log('✅ FFmpeg path found and set:', testPath);
                        return;
                    }
                } else {
                    console.log('❌ Path does not exist:', testPath);
                }
            } catch (error) {
                console.log('❌ Error checking path:', testPath, error.message);
            }
        }

        console.error('❌ FFmpeg binary not found in any location');
        
        // List all files in resourcesPath for debugging
        try {
            console.log('📂 Contents of process.resourcesPath:');
            const files = fs.readdirSync(process.resourcesPath);
            files.forEach(file => {
                const filePath = path.join(process.resourcesPath, file);
                try {
                    const stats = fs.statSync(filePath);
                    console.log(`  ${file} (${stats.isFile() ? 'file' : 'dir'}, ${stats.size} bytes)`);
                } catch (err) {
                    console.log(`  ${file} (error reading stats)`);
                }
            });
        } catch (error) {
            console.error('❌ Could not list resourcesPath contents:', error);
        }
    }

    convertWebmToMp4(inputPath, outputPath, options = {}) {
        return new Promise((resolve, reject) => {
            console.log('🎬 Starting WebM to MP4 conversion...');
            console.log('  Input:', inputPath);
            console.log('  Output:', outputPath);
            console.log('  FFmpeg path:', this.ffmpegPath);

            if (!this.ffmpegPath) {
                console.error('❌ FFmpeg binary path not set');
                reject(new Error('FFmpeg binary not found - path not set'));
                return;
            }

            // Verify FFmpeg exists and is executable
            try {
                if (!fs.existsSync(this.ffmpegPath)) {
                    console.error('❌ FFmpeg binary does not exist at:', this.ffmpegPath);
                    reject(new Error(`FFmpeg binary does not exist at: ${this.ffmpegPath}`));
                    return;
                }

                const stats = fs.statSync(this.ffmpegPath);
                console.log('📋 FFmpeg binary stats:', {
                    isFile: stats.isFile(),
                    size: stats.size,
                    mode: stats.mode.toString(8),
                    executable: (stats.mode & parseInt('111', 8)) !== 0
                });

                if (!stats.isFile()) {
                    console.error('❌ FFmpeg path is not a file:', this.ffmpegPath);
                    reject(new Error(`FFmpeg path is not a file: ${this.ffmpegPath}`));
                    return;
                }
            } catch (statError) {
                console.error('❌ Error checking FFmpeg binary:', statError);
                reject(new Error(`Error checking FFmpeg binary: ${statError.message}`));
                return;
            }

            const args = [
                '-i', inputPath,
                '-c:v', 'libx264',
                '-crf', '28',
                '-preset', 'fast',
                '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart',
                '-y', // overwrite output file
                outputPath
            ];

            console.log('🎬 Full FFmpeg command:', this.ffmpegPath, args.join(' '));

            try {
                const ffmpegProcess = spawn(this.ffmpegPath, args, {
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                let stderrData = '';

                ffmpegProcess.stdout.on('data', (data) => {
                    console.log('FFmpeg stdout:', data.toString());
                });

                ffmpegProcess.stderr.on('data', (data) => {
                    const output = data.toString();
                    stderrData += output;
                    console.log('FFmpeg stderr:', output);
                });

                ffmpegProcess.on('close', (code) => {
                    console.log('🏁 FFmpeg process closed with code:', code);
                    if (code === 0) {
                        console.log('✅ FFmpeg conversion completed successfully');
                        resolve();
                    } else {
                        console.error('❌ FFmpeg conversion failed with code:', code);
                        console.error('Full stderr output:', stderrData);
                        reject(new Error(`FFmpeg process exited with code ${code}. stderr: ${stderrData}`));
                    }
                });

                ffmpegProcess.on('error', (error) => {
                    console.error('❌ FFmpeg process spawn error:', error);
                    console.error('Error details:', {
                        code: error.code,
                        errno: error.errno,
                        syscall: error.syscall,
                        path: error.path,
                        spawnargs: error.spawnargs
                    });
                    reject(new Error(`FFmpeg spawn error: ${error.message} (${error.code})`));
                });

            } catch (spawnError) {
                console.error('❌ Error spawning FFmpeg process:', spawnError);
                reject(new Error(`Error spawning FFmpeg: ${spawnError.message}`));
            }
        });
    }

    convertWebmToGif(inputPath, outputPath, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.ffmpegPath) {
                reject(new Error('FFmpeg binary not found'));
                return;
            }

            const args = [
                '-i', inputPath,
                '-vf', 'fps=15,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
                '-y', // overwrite output file
                outputPath
            ];

            console.log('🎬 FFmpeg GIF command:', this.ffmpegPath, args.join(' '));

            const ffmpegProcess = spawn(this.ffmpegPath, args);

            ffmpegProcess.stdout.on('data', (data) => {
                console.log('FFmpeg stdout:', data.toString());
            });

            ffmpegProcess.stderr.on('data', (data) => {
                console.log('FFmpeg stderr:', data.toString());
            });

            ffmpegProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ FFmpeg GIF conversion completed successfully');
                    resolve();
                } else {
                    console.error('❌ FFmpeg GIF conversion failed with code:', code);
                    reject(new Error(`FFmpeg process exited with code ${code}`));
                }
            });

            ffmpegProcess.on('error', (error) => {
                console.error('❌ FFmpeg process error:', error);
                reject(error);
            });
        });
    }

    convertWithAudioAndCrop(videoPath, audioPath, outputPath, cropInfo) {
        return new Promise((resolve, reject) => {
            if (!this.ffmpegPath) {
                reject(new Error('FFmpeg binary not found'));
                return;
            }

            const args = ['-i', videoPath];
            
            // Audio input varsa ekle
            if (audioPath) {
                args.push('-i', audioPath);
            }

            // Crop filter varsa ekle
            if (cropInfo) {
                args.push('-vf', `crop=${cropInfo.width}:${cropInfo.height}:${cropInfo.x}:${cropInfo.y}`);
            }

            // Output options
            args.push(
                '-c:v', 'libx264',
                '-crf', '23',
                '-preset', 'medium',
                '-movflags', '+faststart',
                '-y', // overwrite output file
                outputPath
            );

            console.log('🎬 FFmpeg complex command:', this.ffmpegPath, args.join(' '));

            const ffmpegProcess = spawn(this.ffmpegPath, args);

            ffmpegProcess.stdout.on('data', (data) => {
                console.log('FFmpeg stdout:', data.toString());
            });

            ffmpegProcess.stderr.on('data', (data) => {
                console.log('FFmpeg stderr:', data.toString());
            });

            ffmpegProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ FFmpeg complex conversion completed successfully');
                    resolve();
                } else {
                    console.error('❌ FFmpeg complex conversion failed with code:', code);
                    reject(new Error(`FFmpeg process exited with code ${code}`));
                }
            });

            ffmpegProcess.on('error', (error) => {
                console.error('❌ FFmpeg process error:', error);
                reject(error);
            });
        });
    }

    createVideoFromFrames(frames, outputPath, options = {}) {
        return new Promise(async (resolve, reject) => {
            console.log('🎬 Creating video from frames...', {
                frameCount: frames.length,
                outputPath,
                options
            });

            if (!this.ffmpegPath) {
                reject(new Error('FFmpeg binary not found'));
                return;
            }

            if (!frames || frames.length === 0) {
                reject(new Error('No frames provided'));
                return;
            }

            try {
                // Geçici dizin oluştur
                const os = require('os');
                const tempDir = path.join(os.tmpdir(), 'sleer-export-' + Date.now());
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                console.log('📁 Temporary directory:', tempDir);

                // Frame'leri geçici dosyalara kaydet - optimize edilmiş
                console.log(`📁 Writing ${frames.length} frames to disk...`);
                const writeStartTime = Date.now();
                
                for (let i = 0; i < frames.length; i++) {
                    const frameData = frames[i];
                    // JPEG veya PNG prefix'ini temizle
                    const base64Data = frameData.replace(/^data:image\/(png|jpeg);base64,/, '');
                    const frameBuffer = Buffer.from(base64Data, 'base64');
                    // JPEG kullanıyorsak .jpg extension
                    const extension = frameData.includes('jpeg') ? '.jpg' : '.png';
                    const framePath = path.join(tempDir, `frame_${String(i).padStart(6, '0')}${extension}`);
                    fs.writeFileSync(framePath, frameBuffer);
                }
                
                const writeTime = Date.now() - writeStartTime;
                console.log(`✅ Frames written to disk in ${writeTime}ms`);
                
                // Frame file pattern'ini güncelle
                const framePattern = frames[0].includes('jpeg') ? 
                    path.join(tempDir, 'frame_%06d.jpg') : 
                    path.join(tempDir, 'frame_%06d.png');

                // FFmpeg argumentları
                const fps = options.fps || 30;
                const width = options.width || 1280;
                const height = options.height || 720;
                const bitrate = options.bitrate || 5000000; // 5 Mbps default
                const audioPath = options.audioPath; // Audio source path
                
                // Advanced options
                const encodingSpeed = options.encodingSpeed || 'balanced';
                const useHardwareAccel = options.useHardwareAccel !== false;
                const audioQualityBitrate = options.audioQuality || 128;
                
                console.log('🎯 Advanced settings:', { encodingSpeed, useHardwareAccel, audioQualityBitrate });

                const args = [
                    '-framerate', fps.toString(),
                    '-i', framePattern // Dynamic pattern based on frame format
                ];

                // Audio input ekle (varsa)
                if (audioPath && fs.existsSync(audioPath)) {
                    console.log('🎵 Adding audio input:', audioPath);
                    
                    // Audio file size check
                    const audioStats = fs.statSync(audioPath);
                    console.log('🎵 Audio file size:', audioStats.size, 'bytes');
                    
                    // Audio trimming varsa ekle
                    if (options.audioTrimInfo) {
                        const { startTime, duration } = options.audioTrimInfo;
                        console.log(`🎵 Audio trimming: start=${startTime}s, duration=${duration}s`);
                        
                        if (duration > 0) {
                            args.push(
                                '-ss', startTime.toString(), // Start time
                                '-t', duration.toString(),   // Duration
                                '-i', audioPath
                            );
                        } else {
                            console.log('🎵 Invalid duration, using full audio');
                            args.push('-i', audioPath);
                        }
                    } else {
                        console.log('🎵 No trimming info, using full audio');
                        args.push('-i', audioPath);
                    }
                } else if (audioPath) {
                    console.log('❌ Audio file does not exist:', audioPath);
                } else {
                    console.log('🔇 No audio path provided');
                }
                    
                // Encoding speed'e göre parametreleri belirle
                const getEncodingParams = () => {
                    const baseParams = {
                        videoCodec: useHardwareAccel ? 'h264_videotoolbox' : 'libx264',
                        pixFmt: 'yuv420p',
                        movflags: '+faststart',
                        threads: '0',
                        maxMuxingQueue: '1024'
                    };
                    
                    switch (encodingSpeed) {
                        case 'ultrafast':
                            return {
                                ...baseParams,
                                qualityParam: useHardwareAccel ? '85' : '28',
                                preset: useHardwareAccel ? null : 'ultrafast',
                                scaling: 'fast_bilinear',
                                realtime: '1'
                            };
                        case 'fast':
                            return {
                                ...baseParams,
                                qualityParam: useHardwareAccel ? '80' : '26',
                                preset: useHardwareAccel ? null : 'fast',
                                scaling: 'fast_bilinear',
                                realtime: '1'
                            };
                        case 'balanced':
                            return {
                                ...baseParams,
                                qualityParam: useHardwareAccel ? '75' : '24',
                                preset: useHardwareAccel ? null : 'medium',
                                scaling: 'bilinear',
                                realtime: null
                            };
                        case 'quality':
                            return {
                                ...baseParams,
                                qualityParam: useHardwareAccel ? '65' : '22',
                                preset: useHardwareAccel ? null : 'slow',
                                scaling: 'lanczos',
                                realtime: null
                            };
                    }
                };
                
                const encodingParams = getEncodingParams();
                
                // Audio var mı yok mu kontrol edip ona göre encoding parametrelerini belirle
                const hasAudio = audioPath && fs.existsSync(audioPath);
                
                if (hasAudio) {
                    console.log(`🎵 Audio + Video encoding (${encodingSpeed} mode, ${useHardwareAccel ? 'GPU' : 'CPU'})`);
                    
                    // Base arguments
                    args.push('-c:v', encodingParams.videoCodec);
                    
                    // Hardware/Software specific params
                    if (useHardwareAccel) {
                        args.push('-allow_sw', '1', '-q:v', encodingParams.qualityParam);
                    } else {
                        args.push('-preset', encodingParams.preset, '-crf', encodingParams.qualityParam);
                    }
                    
                    // Common params
                    args.push(
                        '-c:a', 'aac',
                        '-b:a', `${audioQualityBitrate}k`,
                        '-pix_fmt', encodingParams.pixFmt,
                        '-movflags', encodingParams.movflags,
                        '-vf', `scale=${width}:${height}:flags=${encodingParams.scaling}`,
                        '-shortest',
                        '-threads', encodingParams.threads,
                        '-max_muxing_queue_size', encodingParams.maxMuxingQueue
                    );
                    
                    if (encodingParams.realtime) {
                        args.push('-realtime', encodingParams.realtime);
                    }
                    
                    args.push('-y', outputPath);
                    
                } else {
                    console.log(`🔇 Video-only encoding (${encodingSpeed} mode, ${useHardwareAccel ? 'GPU' : 'CPU'})`);
                    
                    // Base arguments
                    args.push('-c:v', encodingParams.videoCodec);
                    
                    // Hardware/Software specific params
                    if (useHardwareAccel) {
                        args.push('-allow_sw', '1', '-q:v', encodingParams.qualityParam);
                    } else {
                        args.push('-preset', encodingParams.preset, '-crf', encodingParams.qualityParam);
                    }
                    
                    // Common params
                    args.push(
                        '-pix_fmt', encodingParams.pixFmt,
                        '-movflags', encodingParams.movflags,
                        '-vf', `scale=${width}:${height}:flags=${encodingParams.scaling}`,
                        '-threads', encodingParams.threads,
                        '-max_muxing_queue_size', encodingParams.maxMuxingQueue
                    );
                    
                    if (encodingParams.realtime) {
                        args.push('-realtime', encodingParams.realtime);
                    }
                    
                    args.push('-y', outputPath);
                }

                console.log('🎬 FFmpeg frames to video command:', this.ffmpegPath, args.join(' '));

                const ffmpegProcess = spawn(this.ffmpegPath, args);

                let stderrData = '';

                ffmpegProcess.stdout.on('data', (data) => {
                    console.log('FFmpeg stdout:', data.toString());
                });

                ffmpegProcess.stderr.on('data', (data) => {
                    const output = data.toString();
                    stderrData += output;
                    console.log('FFmpeg stderr:', output);
                });

                ffmpegProcess.on('close', (code) => {
                    // Geçici dosyaları temizle
                    try {
                        fs.rmSync(tempDir, { recursive: true, force: true });
                        console.log('🧹 Cleaned up temporary directory');
                    } catch (cleanupError) {
                        console.warn('⚠️ Could not clean up temporary directory:', cleanupError);
                    }

                    if (code === 0) {
                        console.log('✅ Video from frames created successfully');
                        resolve();
                    } else {
                        console.error('❌ Video from frames failed with code:', code);
                        console.error('Full stderr output:', stderrData);
                        reject(new Error(`FFmpeg process exited with code ${code}. stderr: ${stderrData}`));
                    }
                });

                ffmpegProcess.on('error', (error) => {
                    // Geçici dosyaları temizle
                    try {
                        fs.rmSync(tempDir, { recursive: true, force: true });
                    } catch (cleanupError) {
                        console.warn('⚠️ Could not clean up temporary directory:', cleanupError);
                    }

                    console.error('❌ FFmpeg process error:', error);
                    reject(new Error(`FFmpeg spawn error: ${error.message} (${error.code})`));
                });

            } catch (error) {
                console.error('❌ Error in createVideoFromFrames:', error);
                reject(error);
            }
        });
    }

    createGifFromFrames(frames, outputPath, options = {}) {
        return new Promise(async (resolve, reject) => {
            console.log('🎬 Creating GIF from frames...', {
                frameCount: frames.length,
                outputPath,
                options
            });

            if (!this.ffmpegPath) {
                reject(new Error('FFmpeg binary not found'));
                return;
            }

            if (!frames || frames.length === 0) {
                reject(new Error('No frames provided'));
                return;
            }

            try {
                // Geçici dizin oluştur
                const os = require('os');
                const tempDir = path.join(os.tmpdir(), 'sleer-gif-export-' + Date.now());
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                console.log('📁 Temporary directory for GIF:', tempDir);

                // Frame'leri geçici dosyalara kaydet
                for (let i = 0; i < frames.length; i++) {
                    const frameData = frames[i];
                    // Base64 data:image/png;base64, prefix'ini temizle
                    const base64Data = frameData.replace(/^data:image\/png;base64,/, '');
                    const frameBuffer = Buffer.from(base64Data, 'base64');
                    const framePath = path.join(tempDir, `frame_${String(i).padStart(6, '0')}.png`);
                    fs.writeFileSync(framePath, frameBuffer);
                }

                console.log(`✅ Saved ${frames.length} frames for GIF creation`);

                // FFmpeg argumentları - GIF için optimize edilmiş
                const fps = options.fps || 15; // GIF için daha düşük FPS
                const width = options.width || 640;
                const height = options.height || -1; // Aspect ratio korunur

                const args = [
                    '-framerate', fps.toString(),
                    '-i', path.join(tempDir, 'frame_%06d.png'),
                    '-vf', `fps=${fps},scale=${width}:${height}:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
                    '-y', // overwrite output file
                    outputPath
                ];

                console.log('🎬 FFmpeg frames to GIF command:', this.ffmpegPath, args.join(' '));

                const ffmpegProcess = spawn(this.ffmpegPath, args);

                let stderrData = '';

                ffmpegProcess.stdout.on('data', (data) => {
                    console.log('FFmpeg stdout:', data.toString());
                });

                ffmpegProcess.stderr.on('data', (data) => {
                    const output = data.toString();
                    stderrData += output;
                    console.log('FFmpeg stderr:', output);
                });

                ffmpegProcess.on('close', (code) => {
                    // Geçici dosyaları temizle
                    try {
                        fs.rmSync(tempDir, { recursive: true, force: true });
                        console.log('🧹 Cleaned up GIF temporary directory');
                    } catch (cleanupError) {
                        console.warn('⚠️ Could not clean up GIF temporary directory:', cleanupError);
                    }

                    if (code === 0) {
                        console.log('✅ GIF from frames created successfully');
                        resolve();
                    } else {
                        console.error('❌ GIF from frames failed with code:', code);
                        console.error('Full stderr output:', stderrData);
                        reject(new Error(`FFmpeg process exited with code ${code}. stderr: ${stderrData}`));
                    }
                });

                ffmpegProcess.on('error', (error) => {
                    // Geçici dosyaları temizle
                    try {
                        fs.rmSync(tempDir, { recursive: true, force: true });
                    } catch (cleanupError) {
                        console.warn('⚠️ Could not clean up GIF temporary directory:', cleanupError);
                    }

                    console.error('❌ FFmpeg GIF process error:', error);
                    reject(new Error(`FFmpeg spawn error: ${error.message} (${error.code})`));
                });

            } catch (error) {
                console.error('❌ Error in createGifFromFrames:', error);
                reject(error);
            }
        });
    }
}

module.exports = FFmpegWrapper;