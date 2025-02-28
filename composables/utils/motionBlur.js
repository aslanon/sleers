// Ease fonksiyonları
const easeOutQuad = (t) => t * (2 - t);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) =>
	t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Hız eşikleri - daha basit ve anlaşılır değerler
const SPEED_THRESHOLDS = {
	MIN: 1.5, // Minimum hız eşiği - efektlerin başlayacağı hız (düşürüldü)
	MAX: 5.0, // Maksimum hız eşiği - efektlerin maksimuma ulaşacağı hız
	DEFORM: 6.0, // Deformasyon eşiği - warp efektlerinin artacağı hız
};

// Pozisyon geçmişi için değişkenler
let positionHistory = [];
const MAX_HISTORY = 15; // Daha fazla geçmiş = daha stabil (artırıldı)
const STABILIZATION_WEIGHT = 0.9; // Daha yüksek stabilizasyon = daha stabil (artırıldı)

// Açı stabilizasyonu için değişkenler
let angleHistory = [];
const ANGLE_MAX_HISTORY = 12; // Daha fazla geçmiş = daha stabil (artırıldı)
const ANGLE_STABILIZATION_WEIGHT = 0.85; // Daha yüksek stabilizasyon = daha stabil

// Son pozisyon ve hareket bilgileri
let lastStablePosition = { x: 0, y: 0, timestamp: 0 };
let lastMovementDirection = { x: 0, y: 0 };
let lastEffectTime = 0;
let lastSpeed = 0; // Son hız değerini takip etmek için
let lastAcceleration = 0; // Son ivmelenme değerini takip etmek için
let speedHistory = []; // Hız geçmişi - ivmelenme hesaplamak için

// Küçük hareketleri filtrelemek için eşik değerleri
const MOVEMENT_THRESHOLD = 1.2; // Eşik düşürüldü - daha hassas hareket algılaması
const SPEED_DEAD_ZONE = 0.6; // Bu hızın altındaki hareketleri yok say (düşürüldü)

// İvmelenme için eşik değerleri
const ACCELERATION_THRESHOLD = 18; // Bu değerin üzerindeki ivmelenmelerde ekstra blur (düşürüldü)
const MAX_ACCELERATION_BOOST = 2.0; // İvmelenme kaynaklı maksimum blur artışı (azaltıldı)

/**
 * Pozisyon stabilizasyonu için geliştirilmiş fonksiyon
 * Daha smooth hareket ve daha az gecikme sağlar
 */
export function calculateStabilizedPosition(currentX, currentY, currentSpeed) {
	const now = Date.now();

	// Hareket vektörünü hesapla
	const dx = currentX - lastStablePosition.x;
	const dy = currentY - lastStablePosition.y;
	const distance = Math.sqrt(dx * dx + dy * dy);

	// İvmelenmeyi hesapla
	const acceleration = calculateAcceleration(currentSpeed);

	// Hız değişimini yumuşat
	currentSpeed = lastSpeed * 0.7 + currentSpeed * 0.3;
	lastSpeed = currentSpeed;

	// Çok küçük hareketleri filtrele
	if (distance < MOVEMENT_THRESHOLD || currentSpeed < SPEED_DEAD_ZONE) {
		// Uzun süre hareketsizse yine de güncelle (donuk görünmemesi için)
		if (now - lastStablePosition.timestamp > 300) {
			lastStablePosition = { x: currentX, y: currentY, timestamp: now };
		}
		return lastStablePosition;
	}

	// Hareket yönünü güncelle
	if (distance > 0) {
		// Yön değişimini yumuşat
		const newDirX = dx / distance;
		const newDirY = dy / distance;

		// Yön değişimi varsa daha yumuşak geçiş yap
		if (lastMovementDirection.x !== 0 || lastMovementDirection.y !== 0) {
			// Yön değişimi keskin ise daha fazla yumuşat
			const dotProduct =
				newDirX * lastMovementDirection.x + newDirY * lastMovementDirection.y;
			// Yön değişimi açısı (1 = aynı yön, -1 = tam ters yön)
			const smoothFactor = dotProduct < 0 ? 0.8 : 0.6;

			lastMovementDirection = {
				x:
					lastMovementDirection.x * smoothFactor + newDirX * (1 - smoothFactor),
				y:
					lastMovementDirection.y * smoothFactor + newDirY * (1 - smoothFactor),
			};
		} else {
			lastMovementDirection = { x: newDirX, y: newDirY };
		}
	}

	// Pozisyon geçmişini güncelle
	positionHistory.push({
		x: currentX,
		y: currentY,
		timestamp: now,
		speed: currentSpeed,
	});

	// Geçmişi sınırla
	if (positionHistory.length > MAX_HISTORY) {
		positionHistory.shift();
	}

	// Yeterli geçmiş yoksa şimdiki pozisyonu kullan
	if (positionHistory.length < 3) {
		lastStablePosition = { x: currentX, y: currentY, timestamp: now };
		return { x: currentX, y: currentY };
	}

	// Hız bazlı stabilizasyon - hızlı hareketlerde daha az stabilizasyon
	const speedFactor = Math.min(Math.max(currentSpeed / 10, 0.2), 0.8);
	const dynamicWeight = STABILIZATION_WEIGHT * (1 - speedFactor * 0.2);

	// Ağırlıklı ortalama hesapla
	let totalWeight = 0;
	let weightedSumX = 0;
	let weightedSumY = 0;

	// Son timestamp'i referans al
	const lastTimestamp = positionHistory[positionHistory.length - 1].timestamp;

	// Her pozisyon için ağırlık hesapla
	positionHistory.forEach((pos, index) => {
		// Zaman bazlı ağırlık - yeni pozisyonlar daha önemli
		const timeDiff = lastTimestamp - pos.timestamp;
		const timeWeight = Math.max(0, 1 - timeDiff / 300);

		// İndeks bazlı ağırlık - son pozisyonlar daha önemli
		const indexWeight = (index + 1) / positionHistory.length;

		// Toplam ağırlık
		const weight = timeWeight * indexWeight;

		weightedSumX += pos.x * weight;
		weightedSumY += pos.y * weight;
		totalWeight += weight;
	});

	// Stabilize edilmiş pozisyon
	const stabilizedX = weightedSumX / totalWeight;
	const stabilizedY = weightedSumY / totalWeight;

	// Mevcut pozisyon ile stabilize edilmiş pozisyon arasında yumuşak geçiş
	const result = {
		x: currentX * (1 - dynamicWeight) + stabilizedX * dynamicWeight,
		y: currentY * (1 - dynamicWeight) + stabilizedY * dynamicWeight,
	};

	// Stabilize edilmiş pozisyon ile son stabil pozisyon arasındaki fark çok küçükse hareket ettirme
	const stableDx = result.x - lastStablePosition.x;
	const stableDy = result.y - lastStablePosition.y;
	const stableDistance = Math.sqrt(stableDx * stableDx + stableDy * stableDy);

	if (stableDistance < MOVEMENT_THRESHOLD * 0.5) {
		return lastStablePosition;
	}

	// Son stabil pozisyonu güncelle
	lastStablePosition = { x: result.x, y: result.y, timestamp: now };

	return result;
}

/**
 * İvmelenmeyi hesaplar
 * Hız değişimini takip ederek ivmelenme değerini döndürür
 */
function calculateAcceleration(currentSpeed) {
	const now = Date.now();

	// Hız geçmişini güncelle
	speedHistory.push({
		speed: currentSpeed,
		timestamp: now,
	});

	// Geçmişi sınırla (son 5 hız değerini tut)
	if (speedHistory.length > 5) {
		speedHistory.shift();
	}

	// Yeterli geçmiş yoksa ivmelenme yok
	if (speedHistory.length < 2) {
		lastAcceleration = 0;
		return 0;
	}

	// Son iki hız değerini al
	const currentEntry = speedHistory[speedHistory.length - 1];
	const prevEntry = speedHistory[speedHistory.length - 2];

	// Zaman farkını hesapla (saniye cinsinden)
	const timeDiff = (currentEntry.timestamp - prevEntry.timestamp) / 1000;

	// Zaman farkı çok küçükse veya negatifse hesaplama yapma
	if (timeDiff <= 0 || timeDiff > 0.1) {
		return lastAcceleration;
	}

	// İvmelenmeyi hesapla (piksel/saniye²)
	const acceleration = (currentEntry.speed - prevEntry.speed) / timeDiff;

	// İvmelenmeyi yumuşat
	const smoothedAcceleration = lastAcceleration * 0.6 + acceleration * 0.4;
	lastAcceleration = smoothedAcceleration;

	return Math.abs(smoothedAcceleration);
}

/**
 * Açı stabilizasyonu için geliştirilmiş fonksiyon
 * Daha smooth rotasyon sağlar
 */
export function calculateStabilizedAngle(rawAngle, speed) {
	// Düşük hızlarda açı stabilizasyonu daha güçlü
	const speedFactor = Math.min(speed / SPEED_THRESHOLDS.MAX, 1.0);
	const adaptiveWeight = ANGLE_STABILIZATION_WEIGHT * (1 - speedFactor * 0.3);

	// Son açı değerini kaydet
	angleHistory.push(rawAngle);

	// Geçmiş sınırını aşmayacak şekilde koru
	if (angleHistory.length > ANGLE_MAX_HISTORY) {
		angleHistory.shift();
	}

	// Geçmiş boşsa orijinal açıyı döndür
	if (angleHistory.length < 2) {
		return rawAngle;
	}

	// Açıyı stabilize et - Yüksek hızlarda daha az, düşük hızlarda daha fazla smoothing
	let stabilizedAngle = 0;
	let weightSum = 0;
	const historyLength = angleHistory.length;

	// Son değerlere daha çok ağırlık ver
	for (let i = 0; i < historyLength; i++) {
		// Normalize edilmiş pozisyon (0-1)
		const position = i / (historyLength - 1);

		// Pozisyona göre ağırlık hesapla - son değerlere daha fazla ağırlık
		const weight = Math.pow(position, 2) + 0.1;

		// Farklı açı değerlerini doğru şekilde interpole et
		stabilizedAngle += angleHistory[i] * weight;
		weightSum += weight;
	}

	// Ağırlıklı ortalama
	stabilizedAngle = stabilizedAngle / weightSum;

	// Son açı ile orijinal açı arasında lerp - hıza göre adaptif
	return stabilizedAngle * adaptiveWeight + rawAngle * (1 - adaptiveWeight);
}

/**
 * Motion blur efektlerini hesapla - İyileştirilmiş
 */
export function calculateMotionBlurEffects(speed, distance, intensity) {
	// En son güncellenmiş fonksiyon
	const now = Date.now();
	const hasRecentEffect = now - lastEffectTime < 300; // Son efektin üzerinden geçen süre
	lastEffectTime = now;

	// Hız temelli parametreleri hesapla - daha yumuşak geçişler
	const speedFactor = calculateSpeedFactor(speed);
	const easeInFactor = easeOutCubic(speedFactor);

	// Daha yumuşak easing kullan
	const easedIntensity = easeOutCubic(intensity / 100);

	// İvmelenmeyi hesapla ama daha yumuşak bir yaklaşım kullan
	const acceleration = calculateAcceleration(speed);
	const smoothedAcceleration = Math.max(0, acceleration) * 0.8; // Pozitif ivme daha etkili

	// İvmelenme faktörü - geçmişe bakarak hesapla
	const accelerationFactor = calculateAccelerationFactor(smoothedAcceleration);

	// Normal hareket ve ani ivmelenmeleri ayrı değerlendir
	const accelerationBoost =
		smoothedAcceleration > ACCELERATION_THRESHOLD
			? Math.min(smoothedAcceleration / ACCELERATION_THRESHOLD, 1.0) *
			  MAX_ACCELERATION_BOOST *
			  easedIntensity
			: 0;

	// Deformasyon ve blur miktarlarını hesapla - daha az deformasyon, daha doğal sonuçlar
	const deformAmount = easeInFactor * (intensity / 100) * 0.8; // Azaltıldı
	const blurAmount = easeInFactor * intensity * 0.04; // Blur miktarını azalt

	// Etki uygulama kararı - hız ve geçen zamana göre
	const shouldApplyEffect =
		(speed > SPEED_THRESHOLDS.MIN || hasRecentEffect) && intensity > 10;

	return {
		speedFactor,
		easedIntensity,
		deformAmount,
		blurAmount,
		shouldApplyEffect,
		accelerationFactor,
		accelerationBoost,
	};
}

/**
 * Hız faktörünü hesaplar - daha yumuşak geçişler
 */
function calculateSpeedFactor(speed) {
	// Hız normalleştirme - daha yumuşak bir eğri
	let normalizedSpeed =
		(speed - SPEED_THRESHOLDS.MIN) /
		(SPEED_THRESHOLDS.MAX - SPEED_THRESHOLDS.MIN);

	// 0-1 arası sınırla
	normalizedSpeed = Math.max(0, Math.min(normalizedSpeed, 1));

	// Daha yumuşak bir eğri için easing fonksiyonu uygula
	return easeOutCubic(normalizedSpeed);
}

/**
 * İvmelenme faktörünü hesaplar - daha kararlı
 */
function calculateAccelerationFactor(acceleration) {
	// İvmelenme değerini normalize et (0-1 arası)
	const normalizedAcceleration = Math.min(
		Math.max(acceleration / ACCELERATION_THRESHOLD, 0),
		1
	);

	// Geçiş fonksiyonu uygula - daha yumuşak geçiş
	return easeOutCubic(normalizedAcceleration);
}
