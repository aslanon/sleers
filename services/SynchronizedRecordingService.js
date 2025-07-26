/**
 * Synchronized Recording Service
 * 
 * Bu servis ekran, kamera ve mouse kayıtları için senkronize timestamp yönetimi sağlar.
 * Her kayıt türü için başlangıç zamanını kaydeder ve offset hesaplamalarını yapar.
 */

class SynchronizedRecordingService {
	constructor() {
		// Master timestamp - tüm kayıtların senkronize edileceği referans zaman
		this.masterStartTime = null;
		
		// Her kayıt türü için başlangıç zamanları
		this.recordingStartTimes = {
			screen: null,
			camera: null,
			mouse: null,
		};
		
		// Her kayıt türü için offset değerleri (milisaniye)
		this.offsets = {
			screen: 0,
			camera: 0,
			mouse: 0,
		};
		
		// Kayıt durumu
		this.isRecording = false;
		this.recordingId = null;
		
		// Senkronizasyon toleransı (milisaniye)
		this.syncTolerance = 50; // 50ms tolerans
	}

	/**
	 * Yeni bir kayıt oturumu başlatır ve master timestamp'i ayarlar
	 */
	startRecordingSession() {
		this.masterStartTime = Date.now();
		this.recordingId = `rec_${this.masterStartTime}`;
		this.isRecording = true;
		
		// Offset'leri sıfırla
		this.offsets = {
			screen: 0,
			camera: 0, 
			mouse: 0,
		};
		
		// Başlangıç zamanlarını sıfırla
		this.recordingStartTimes = {
			screen: null,
			camera: null,
			mouse: null,
		};
		
		console.log(`[SynchronizedRecording] Kayıt oturumu başlatıldı: ${this.recordingId}, master time: ${this.masterStartTime}`);
		
		return {
			recordingId: this.recordingId,
			masterStartTime: this.masterStartTime,
		};
	}

	/**
	 * Belirli bir kayıt türü için başlangıç zamanını kaydeder
	 * @param {string} recordingType - 'screen', 'camera', veya 'mouse'
	 * @param {number|null} customStartTime - Özel başlangıç zamanı (opsiyonel)
	 */
	recordStartTime(recordingType, customStartTime = null) {
		if (!this.isRecording) {
			throw new Error('Kayıt oturumu başlatılmamış');
		}

		const startTime = customStartTime || Date.now();
		this.recordingStartTimes[recordingType] = startTime;
		
		// Master time'a göre offset hesapla
		this.offsets[recordingType] = startTime - this.masterStartTime;
		
		console.log(`[SynchronizedRecording] ${recordingType} başlangıç zamanı kaydedildi:`, {
			startTime: new Date(startTime).toISOString(),
			offset: this.offsets[recordingType],
			masterTime: new Date(this.masterStartTime).toISOString(),
		});

		return {
			startTime,
			offset: this.offsets[recordingType],
			masterStartTime: this.masterStartTime,
		};
	}

	/**
	 * Tüm kayıt türleri için offset'leri hesaplar ve senkronizasyon bilgisi döner
	 */
	calculateSynchronizationOffsets() {
		if (!this.isRecording) {
			return null;
		}

		const synchronizationData = {
			recordingId: this.recordingId,
			masterStartTime: this.masterStartTime,
			recordingStartTimes: { ...this.recordingStartTimes },
			offsets: { ...this.offsets },
			syncTolerance: this.syncTolerance,
		};

		// En erken başlayan kayıt türünü bul (master olarak kullanılacak)
		const validStartTimes = Object.entries(this.recordingStartTimes)
			.filter(([_, time]) => time !== null)
			.map(([type, time]) => ({ type, time }));

		if (validStartTimes.length > 0) {
			const earliestStart = Math.min(...validStartTimes.map(item => item.time));
			
			// Tüm offset'leri en erken başlangıca göre yeniden hesapla
			const normalizedOffsets = {};
			Object.entries(this.recordingStartTimes).forEach(([type, time]) => {
				if (time !== null) {
					normalizedOffsets[type] = time - earliestStart;
				}
			});

			synchronizationData.normalizedOffsets = normalizedOffsets;
			synchronizationData.earliestStartTime = earliestStart;
		}

		console.log('[SynchronizedRecording] Senkronizasyon offset\'leri hesaplandı:', synchronizationData);
		
		return synchronizationData;
	}

	/**
	 * Belirli bir kayıt türü için senkronize edilmiş timestamp döner
	 * @param {string} recordingType - 'screen', 'camera', veya 'mouse'
	 * @param {number} relativeTime - Kayıt başlangıcına göre relatif zaman (ms)
	 */
	getSynchronizedTimestamp(recordingType, relativeTime) {
		if (!this.isRecording || !this.recordingStartTimes[recordingType]) {
			return relativeTime; // Fallback
		}

		// Master time'a göre senkronize edilmiş timestamp
		const synchronizedTime = relativeTime - this.offsets[recordingType];
		
		return Math.max(0, synchronizedTime); // Negatif değerleri engelle
	}

	/**
	 * Mouse position için senkronize timestamp üretir
	 * @param {number} mouseTimestamp - Mouse event timestamp'i
	 */
	getSynchronizedMouseTimestamp(mouseTimestamp) {
		if (!this.isRecording || !this.recordingStartTimes.mouse) {
			return mouseTimestamp;
		}

		// Mouse kayıt başlangıcına göre relatif zamanı hesapla
		const relativeTime = mouseTimestamp - (this.recordingStartTimes.mouse - this.masterStartTime);
		
		return this.getSynchronizedTimestamp('mouse', relativeTime);
	}

	/**
	 * Kayıt oturumunu sonlandırır
	 */
	stopRecordingSession() {
		const finalSyncData = this.calculateSynchronizationOffsets();
		
		this.isRecording = false;
		this.masterStartTime = null;
		this.recordingId = null;
		
		console.log('[SynchronizedRecording] Kayıt oturumu sonlandırıldı');
		
		return finalSyncData;
	}

	/**
	 * Mevcut kayıt durumunu döner
	 */
	getRecordingState() {
		return {
			isRecording: this.isRecording,
			recordingId: this.recordingId,
			masterStartTime: this.masterStartTime,
			recordingStartTimes: { ...this.recordingStartTimes },
			offsets: { ...this.offsets },
		};
	}

	/**
	 * İki timestamp arasındaki farkı hesaplar ve senkronizasyon gerekip gerekmediğini kontrol eder
	 * @param {number} timestamp1 
	 * @param {number} timestamp2 
	 */
	needsSynchronization(timestamp1, timestamp2) {
		const diff = Math.abs(timestamp1 - timestamp2);
		return diff > this.syncTolerance;
	}

	/**
	 * Kayıt türlerinin başlangıç zamanları arasındaki farkları analiz eder
	 */
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

		// Her kayıt türü için gap hesapla
		validTimes.forEach(([type, time]) => {
			analysis.gaps[type] = time - minTime;
		});

		analysis.averageGap = Object.values(analysis.gaps).reduce((sum, gap) => sum + gap, 0) / Object.keys(analysis.gaps).length;

		console.log('[SynchronizedRecording] Senkronizasyon gap analizi:', analysis);
		
		return analysis;
	}
}

// Singleton instance
const synchronizedRecording = new SynchronizedRecordingService();

export default synchronizedRecording;