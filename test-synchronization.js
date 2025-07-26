/**
 * Test script for synchronized recording timestamp accuracy
 */

// Import the SynchronizedRecordingService class directly
class SynchronizedRecordingService {
	constructor() {
		this.masterStartTime = null;
		this.recordingStartTimes = {
			screen: null,
			camera: null,
			mouse: null,
		};
		this.offsets = {
			screen: 0,
			camera: 0,
			mouse: 0,
		};
		this.isRecording = false;
		this.recordingId = null;
		this.syncTolerance = 50;
	}

	startRecordingSession() {
		this.masterStartTime = Date.now();
		this.recordingId = `rec_${this.masterStartTime}`;
		this.isRecording = true;
		
		this.offsets = { screen: 0, camera: 0, mouse: 0 };
		this.recordingStartTimes = { screen: null, camera: null, mouse: null };
		
		return {
			recordingId: this.recordingId,
			masterStartTime: this.masterStartTime,
		};
	}

	recordStartTime(recordingType, customStartTime = null) {
		if (!this.isRecording) {
			throw new Error('Kayıt oturumu başlatılmamış');
		}

		const startTime = customStartTime || Date.now();
		this.recordingStartTimes[recordingType] = startTime;
		this.offsets[recordingType] = startTime - this.masterStartTime;
		
		return {
			startTime,
			offset: this.offsets[recordingType],
			masterStartTime: this.masterStartTime,
		};
	}

	getSynchronizedTimestamp(recordingType, relativeTime) {
		if (!this.isRecording || !this.recordingStartTimes[recordingType]) {
			return relativeTime;
		}
		const synchronizedTime = relativeTime - this.offsets[recordingType];
		return Math.max(0, synchronizedTime);
	}

	analyzeSynchronizationGaps() {
		const analysis = {
			maxGap: 0,
			minGap: Infinity,
			averageGap: 0,
			gaps: {},
		};

		const validTimes = Object.entries(this.recordingStartTimes)
			.filter(([_, time]) => time !== null);

		if (validTimes.length < 2) {
			return analysis;
		}

		const times = validTimes.map(([_, time]) => time);
		const minTime = Math.min(...times);
		const maxTime = Math.max(...times);

		analysis.maxGap = maxTime - minTime;

		validTimes.forEach(([type, time]) => {
			analysis.gaps[type] = time - minTime;
		});

		analysis.averageGap = Object.values(analysis.gaps).reduce((sum, gap) => sum + gap, 0) / Object.keys(analysis.gaps).length;
		
		return analysis;
	}

	stopRecordingSession() {
		const finalSyncData = {
			recordingId: this.recordingId,
			masterStartTime: this.masterStartTime,
			recordingStartTimes: { ...this.recordingStartTimes },
			offsets: { ...this.offsets },
		};
		
		this.isRecording = false;
		this.masterStartTime = null;
		this.recordingId = null;
		
		return finalSyncData;
	}
}

// Test function to simulate recording scenario
function testSynchronizationAccuracy() {
    console.log('🧪 Testing Synchronized Recording Service...\n');
    
    const sync = new SynchronizedRecordingService();
    
    // 1. Start recording session
    console.log('1. Starting recording session...');
    const session = sync.startRecordingSession();
    console.log('Session:', session);
    console.log('');
    
    // 2. Simulate screen recording start (immediate)
    console.log('2. Screen recording starts immediately...');
    const screenTime = sync.recordStartTime('screen');
    console.log('Screen recording time:', screenTime);
    console.log('');
    
    // 3. Simulate camera recording start (50ms delay)
    setTimeout(() => {
        console.log('3. Camera recording starts with 50ms delay...');
        const cameraTime = sync.recordStartTime('camera');
        console.log('Camera recording time:', cameraTime);
        console.log('');
        
        // 4. Simulate mouse recording start (100ms delay)
        setTimeout(() => {
            console.log('4. Mouse recording starts with 100ms delay...');
            const mouseTime = sync.recordStartTime('mouse');
            console.log('Mouse recording time:', mouseTime);
            console.log('');
            
            // 5. Test synchronized timestamps
            console.log('5. Testing synchronized timestamps...');
            
            // Test with sample timestamps
            const sampleTimestamps = [
                { type: 'screen', time: 1000 },
                { type: 'camera', time: 1000 },
                { type: 'mouse', time: 1000 },
                { type: 'screen', time: 2000 },
                { type: 'camera', time: 2000 },
                { type: 'mouse', time: 2000 },
            ];
            
            console.log('Original timestamps:');
            sampleTimestamps.forEach(sample => {
                console.log(`  ${sample.type}: ${sample.time}ms`);
            });
            
            console.log('\nSynchronized timestamps:');
            sampleTimestamps.forEach(sample => {
                const syncTime = sync.getSynchronizedTimestamp(sample.type, sample.time);
                console.log(`  ${sample.type}: ${sample.time}ms -> ${syncTime}ms (offset: ${sync.offsets[sample.type]}ms)`);
            });
            
            // 6. Calculate synchronization analysis
            console.log('\n6. Synchronization analysis...');
            const analysis = sync.analyzeSynchronizationGaps();
            console.log('Analysis:', analysis);
            
            // 7. Stop recording session
            console.log('\n7. Stopping recording session...');
            const finalData = sync.stopRecordingSession();
            console.log('Final synchronization data:', finalData);
            
            console.log('\n✅ Test completed successfully!');
            
        }, 100); // Mouse starts 100ms after master
    }, 50); // Camera starts 50ms after master
}

// Run the test
if (require.main === module) {
    testSynchronizationAccuracy();
}

module.exports = { testSynchronizationAccuracy };