// Ease fonksiyonları
const easeOutQuad = (t) => t * (2 - t);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) =>
	t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Hız eşikleri - daha basit ve anlaşılır değerler
const SPEED_THRESHOLDS = {
	MIN: 1.8, // Minimum hız eşiği - efektlerin başlayacağı hız
	MAX: 5.0, // Maksimum hız eşiği - efektlerin maksimuma ulaşacağı hız
	DEFORM: 6.0, // Deformasyon eşiği - warp efektlerinin artacağı hız
};

// Pozisyon geçmişi için değişkenler
let positionHistory = [];
const MAX_HISTORY = 12; // Daha fazla geçmiş = daha stabil
const STABILIZATION_WEIGHT = 0.85; // Daha yüksek stabilizasyon = daha stabil

// Açı stabilizasyonu için değişkenler
let angleHistory = [];
const ANGLE_MAX_HISTORY = 10; // Daha fazla geçmiş = daha stabil
const ANGLE_STABILIZATION_WEIGHT = 0.85; // Daha yüksek stabilizasyon = daha stabil

// Son pozisyon ve hareket bilgileri
let lastStablePosition = { x: 0, y: 0, timestamp: 0 };
let lastMovementDirection = { x: 0, y: 0 };
let lastEffectTime = 0;
let lastSpeed = 0; // Son hız değerini takip etmek için
let lastAcceleration = 0; // Son ivmelenme değerini takip etmek için
let speedHistory = []; // Hız geçmişi - ivmelenme hesaplamak için

// Küçük hareketleri filtrelemek için eşik değerleri
const MOVEMENT_THRESHOLD = 1.5; // 1.5 pikselden küçük hareketleri filtrele
const SPEED_DEAD_ZONE = 0.8; // Bu hızın altındaki hareketleri yok say

// İvmelenme için eşik değerleri
const ACCELERATION_THRESHOLD = 20; // Bu değerin üzerindeki ivmelenmelerde ekstra blur
const MAX_ACCELERATION_BOOST = 2.5; // İvmelenme kaynaklı maksimum blur artışı

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
export function calculateStabilizedAngle(currentAngle, currentSpeed) {
	const now = Date.now();

	// Çok düşük hızlarda açı değişimini uygulama
	if (currentSpeed < SPEED_DEAD_ZONE * 1.2) {
		// Açı geçmişi varsa son stabilize edilmiş açıyı kullan
		if (angleHistory.length > 0) {
			return angleHistory[angleHistory.length - 1].angle;
		}
		return currentAngle;
	}

	// Açı geçmişini güncelle
	angleHistory.push({
		angle: currentAngle,
		timestamp: now,
		speed: currentSpeed,
	});

	// Geçmişi sınırla
	if (angleHistory.length > ANGLE_MAX_HISTORY) {
		angleHistory.shift();
	}

	// Yeterli geçmiş yoksa şimdiki açıyı kullan
	if (angleHistory.length < 3) {
		return currentAngle;
	}

	// Hız bazlı stabilizasyon - hızlı hareketlerde daha az stabilizasyon
	const speedFactor = Math.min(Math.max(currentSpeed / 10, 0.2), 0.8);
	const dynamicWeight = ANGLE_STABILIZATION_WEIGHT * (1 - speedFactor * 0.2);

	// Sin ve Cos toplamları için değişkenler
	let totalWeight = 0;
	let weightedSumSin = 0;
	let weightedSumCos = 0;

	// Son timestamp'i referans al
	const lastTimestamp = angleHistory[angleHistory.length - 1].timestamp;

	// Her açı için ağırlık hesapla
	angleHistory.forEach((entry, index) => {
		// Zaman bazlı ağırlık
		const timeDiff = lastTimestamp - entry.timestamp;
		const timeWeight = Math.max(0, 1 - timeDiff / 300);

		// İndeks bazlı ağırlık
		const indexWeight = (index + 1) / angleHistory.length;

		// Toplam ağırlık
		const weight = timeWeight * indexWeight;

		// Sin ve Cos toplamları (açı ortalaması için doğru yöntem)
		weightedSumSin += Math.sin(entry.angle) * weight;
		weightedSumCos += Math.cos(entry.angle) * weight;
		totalWeight += weight;
	});

	// Stabilize edilmiş açı
	const stabilizedAngle = Math.atan2(
		weightedSumSin / totalWeight,
		weightedSumCos / totalWeight
	);

	// Mevcut açı ile stabilize edilmiş açı arasında yumuşak geçiş
	// Sin ve Cos kullanarak açı interpolasyonu
	const currentSin = Math.sin(currentAngle);
	const currentCos = Math.cos(currentAngle);
	const stabilizedSin = Math.sin(stabilizedAngle);
	const stabilizedCos = Math.cos(stabilizedAngle);

	const resultSin =
		currentSin * (1 - dynamicWeight) + stabilizedSin * dynamicWeight;
	const resultCos =
		currentCos * (1 - dynamicWeight) + stabilizedCos * dynamicWeight;

	return Math.atan2(resultSin, resultCos);
}

/**
 * Motion blur efekti için değerleri hesaplar
 * Daha basit ve etkili bir algoritma
 */
export function calculateMotionBlurEffects(
	speed,
	distance,
	intensityMultiplier = 75
) {
	const now = Date.now();

	// Efekt değerini normalize et (0-1 arası)
	const normalizedIntensity = intensityMultiplier / 100;

	// Minimum ve maksimum eşikler
	const minThreshold = SPEED_THRESHOLDS.MIN;
	const maxThreshold = SPEED_THRESHOLDS.MAX;

	// Ani değişimleri önlemek için zaman kontrolü
	const minTimeBetweenEffects = 16; // 60 FPS ≈ 16ms
	const timeSinceLastEffect = now - lastEffectTime;

	if (timeSinceLastEffect < minTimeBetweenEffects) {
		return {
			easedIntensity: 0,
			deformAmount: 0,
			blurAmount: 0,
			shouldApplyEffect: false,
			speedFactor: 0,
			accelerationFactor: 0,
			accelerationBoost: 0,
		};
	}

	// Efekt uygulandığını not et
	lastEffectTime = now;

	// Çok düşük hızlarda efekt uygulanmaz
	if (speed < minThreshold || speed < SPEED_DEAD_ZONE * 1.5) {
		return {
			easedIntensity: 0,
			deformAmount: 0,
			blurAmount: 0,
			shouldApplyEffect: false,
			speedFactor: 0,
			accelerationFactor: 0,
			accelerationBoost: 0,
		};
	}

	// Efekt uygulanacak mı?
	const shouldApplyEffect = speed >= minThreshold;

	// Hız faktörünü hesapla (0-1 arası)
	const normalizedSpeed = Math.min(speed, maxThreshold * 1.2);
	const speedFactor = Math.max(
		0,
		(normalizedSpeed - minThreshold) / (maxThreshold - minThreshold)
	);

	// İvmelenmeyi hesapla
	const acceleration = calculateAcceleration(speed);

	// İvmelenme faktörünü hesapla (0-1 arası)
	const accelerationFactor = Math.min(acceleration / ACCELERATION_THRESHOLD, 1);

	// İvmelenme bazlı blur artışı
	const accelerationBoost = accelerationFactor * MAX_ACCELERATION_BOOST;

	// Yumuşak geçiş için ease fonksiyonu
	const easedIntensity = easeInOutCubic(Math.min(speedFactor, 1));

	// Mesafe faktörü
	const distanceFactor = Math.min(distance / 100, 1);

	// Deformasyon miktarı - daha düşük değer daha stabil
	const deformAmount =
		speedFactor * normalizedIntensity * Math.min(1, distanceFactor) * 0.85;

	// Blur miktarı - Hem hız hem de ivmelenme bazlı
	// Hız bazlı blur için temel değerler
	const minBlur = 0.3;
	const maxBlur = 1.8;
	const speedBlur =
		minBlur + (maxBlur - minBlur) * speedFactor * normalizedIntensity;

	// İvmelenme varsa ek blur ekle
	const accelerationBlur =
		accelerationFactor > 0.15 ? accelerationBoost * normalizedIntensity : 0;

	// Toplam blur miktarı (hız + ivmelenme bazlı)
	const blurAmount = speedBlur + accelerationBlur;

	return {
		easedIntensity,
		deformAmount,
		blurAmount,
		shouldApplyEffect,
		speedFactor,
		normalizedIntensity,
		accelerationFactor,
		accelerationBoost,
	};
}
