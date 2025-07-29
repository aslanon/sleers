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
}

module.exports = FFmpegWrapper;