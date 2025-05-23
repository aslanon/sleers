// Easing fonksiyonları
export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) =>
	t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeInCubic = (t) => t * t * t;
export const linear = (t) => t;

// Kullanılabilir cursor transition tipleri
export const CURSOR_TRANSITION_TYPES = {
	LINEAR: "linear",
	EASE: "ease",
	EASE_IN: "ease-in",
	EASE_OUT: "ease-out",
};

// Varsayılan transition tipi
let currentTransitionType = CURSOR_TRANSITION_TYPES.EASE;

// Transition tipini ayarlamak için fonksiyon
export const setCursorTransitionType = (transitionType) => {
	if (Object.values(CURSOR_TRANSITION_TYPES).includes(transitionType)) {
		currentTransitionType = transitionType;
		return true;
	}
	return false;
};

// Geçerli transition tipini almak için fonksiyon
export const getCurrentTransitionType = () => currentTransitionType;

/**
 * Cubic-bezier eğrisi hesaplayan fonksiyon
 * @param {number} x1 - Kontrol noktası 1 x koordinatı (0-1 arası)
 * @param {number} y1 - Kontrol noktası 1 y koordinatı (0-1 arası)
 * @param {number} x2 - Kontrol noktası 2 x koordinatı (0-1 arası)
 * @param {number} y2 - Kontrol noktası 2 y koordinatı (0-1 arası)
 * @returns {Function} - t parametresi alıp eğrideki y değerini döndüren fonksiyon
 */
export const cubicBezier = (x1, y1, x2, y2) => {
	// Kübik Bezier eğrisini hesaplayan yardımcı fonksiyon
	const calcBezier = (t, p1, p2) => {
		const u = 1 - t;
		const tt = t * t;
		const uu = u * u;
		const uuu = uu * u;
		const ttt = tt * t;

		// Bezier formülü: (1-t)^3 * P0 + 3 * (1-t)^2 * t * P1 + 3 * (1-t) * t^2 * P2 + t^3 * P3
		// P0 = (0,0) ve P3 = (1,1) olduğundan sadece P1 ve P2'yi hesapla
		return 3 * uu * t * p1 + 3 * u * tt * p2 + ttt;
	};

	// X koordinatı için Newton-Raphson yöntemiyle t parametresini hesaplayan fonksiyon
	const getTFromX = (x) => {
		if (x <= 0) return 0;
		if (x >= 1) return 1;

		// Newton-Raphson iterasyonu için başlangıç değeri
		let t = x;

		// Epsilon değeri - yeterli hassasiyet için
		const epsilon = 1e-6;

		// Maksimum iterasyon sayısı
		const maxIterations = 8;

		// Newton-Raphson iterasyonu
		for (let i = 0; i < maxIterations; i++) {
			// Şu anki t değeri için x koordinatını hesapla
			const currentX = calcBezier(t, x1, x2);

			// Eğer yeterince yakınsak, döngüden çık
			if (Math.abs(currentX - x) < epsilon) {
				break;
			}

			// Türevi hesapla
			const dx = (calcBezier(t + epsilon, x1, x2) - currentX) / epsilon;

			// t değerini güncelle
			if (Math.abs(dx) < epsilon) break; // Türev çok küçükse çık
			t -= (currentX - x) / dx;

			// t'yi [0,1] aralığında sınırla
			if (t < 0) t = 0;
			if (t > 1) t = 1;
		}

		return t;
	};

	// Ana fonksiyon: x için y koordinatını hesapla
	return (x) => {
		// Önce x için t parametresini bul
		const t = getTFromX(x);
		// Sonra bu t değeri için y koordinatını hesapla
		return calcBezier(t, y1, y2);
	};
};

// Transition tipine göre cubic-bezier parametrelerini döndüren yardımcı fonksiyon
export const getTransitionParams = (transitionType) => {
	switch (transitionType) {
		case CURSOR_TRANSITION_TYPES.LINEAR:
			return { x1: 0, y1: 0, x2: 1, y2: 1 };
		case CURSOR_TRANSITION_TYPES.EASE:
			return { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1.0 };
		case CURSOR_TRANSITION_TYPES.EASE_IN:
			return { x1: 0.42, y1: 0, x2: 1, y2: 1 };
		case CURSOR_TRANSITION_TYPES.EASE_OUT:
			return { x1: 0, y1: 0, x2: 0.58, y2: 1 };
		default:
			return { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1.0 }; // varsayılan olarak ease
	}
};

// Hız eşikleri ve katsayıları
const MIN = 1.2; // Efekt başlangıç hızı (piksel/saniye) - lowered for earlier feedback
const MAX = 150; // Maksimum efekt hızı (piksel/saniye)
const DEFORM = 180; // Deformasyon başlangıç hızı - lowered for earlier effects

// Hız eşikleri - daha basit ve anlaşılır değerler
const SPEED_THRESHOLDS = {
	MIN: 1.5, // Efekt başlangıç hızı (piksel/saniye) - lowered from 1.8
	MAX: 150, // Maksimum efekt hızı (piksel/saniye)
	DEFORM: 180, // Deformasyon başlangıç hızı - lowered from 200
};

// Pozisyon ve açı geçmişi ayarları
const positionHistory = [];
const maxPositionHistory = 8; // Increased from 7 for smoother tracking
const stabilizationWeights = [0.35, 0.25, 0.15, 0.1, 0.06, 0.04, 0.03, 0.02]; // Weights sum should be 1

const angleHistory = [];
const maxAngleHistory = 8;
const angleStabilizationWeights = [
	0.35, 0.25, 0.15, 0.1, 0.05, 0.05, 0.03, 0.02,
]; // Ağırlıkların toplamı 1 olmalı

// Son pozisyon ve hareket bilgileri
let lastStablePosition = { x: 0, y: 0, timestamp: 0 };
let lastMovementDirection = { x: 0, y: 0 };
let lastEffectTime = 0;
let lastSpeed = 0; // Son hız değerini takip etmek için
let lastAcceleration = 0; // Son ivmelenme değerini takip etmek için
let speedHistory = []; // Hız geçmişi - ivmelenme hesaplamak için

// Küçük hareketleri filtrelemek için eşik değerleri
const MOVEMENT_THRESHOLD = 0.6; // Lowered from 0.8 - daha hassas hareket algılaması
const SPEED_DEAD_ZONE = 0.3; // Lowered from 0.4 - Bu hızın altındaki hareketleri yok say

// İvmelenme için eşik değerleri
const ACCELERATION_THRESHOLD = 15; // Lowered from 18 - Bu değerin üzerindeki ivmelenmelerde ekstra blur
const MAX_ACCELERATION_BOOST = 2.5; // Increased from 2.0 - İvmelenme kaynaklı maksimum blur artışı

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
	if (positionHistory.length > maxPositionHistory) {
		positionHistory.shift();
	}

	// Yeterli geçmiş yoksa şimdiki pozisyonu kullan
	if (positionHistory.length < 3) {
		lastStablePosition = { x: currentX, y: currentY, timestamp: now };
		return { x: currentX, y: currentY };
	}

	// Hız bazlı stabilizasyon - hızılı hareketlerde daha az stabilizasyon
	const speedFactor = Math.min(Math.max(currentSpeed / 10, 0.2), 0.8);
	const dynamicWeight = stabilizationWeights[0] * (1 - speedFactor * 0.2);

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
	const adaptiveWeight = angleStabilizationWeights[0] * (1 - speedFactor * 0.3);

	// Son açı değerini kaydet
	angleHistory.push(rawAngle);

	// Geçmiş sınırını aşmayacak şekilde koru
	if (angleHistory.length > maxAngleHistory) {
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
	const smoothedAcceleration = Math.max(0, acceleration) * 0.85; // Increased from 0.8 - Pozitif ivme daha etkili

	// İvmelenme faktörü - geçmişe bakarak hesapla
	const accelerationFactor = calculateAccelerationFactor(smoothedAcceleration);

	// Normal hareket ve ani ivmelenmeleri ayrı değerlendir
	const accelerationBoost =
		smoothedAcceleration > ACCELERATION_THRESHOLD
			? Math.min(smoothedAcceleration / ACCELERATION_THRESHOLD, 1.0) *
			  MAX_ACCELERATION_BOOST *
			  easedIntensity
			: 0;

	// Deformasyon ve blur miktarlarını hesapla - daha güçlü ve görünür efektler
	const deformAmount = easeInFactor * (intensity / 100) * 0.9; // Increased from 0.8
	const blurAmount = easeInFactor * intensity * 0.05; // Increased from 0.04 - Blur miktarını artır

	// Etki uygulama kararı - hız ve geçen zamana göre
	const shouldApplyEffect =
		(speed > SPEED_THRESHOLDS.MIN || hasRecentEffect) && intensity > 8; // Lowered from 10

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

// Büyük mesafe geçişleri için cubic-bezier fonksiyonunu kullan
export const calculateLargeDistanceTransition = (
	distance,
	threshold = 70, // Decreased from 80 for more responsive transitions
	isClick = false
) => {
	// Cubic bezier parametreleri
	let x1 = 0.25,
		y1 = 0.1,
		x2 = 0.25,
		y2 = 1.0;

	// Bu bir tıklama ise, farklı bir geçiş tipi kullan
	if (isClick) {
		return {
			shouldApplyCubicBezier: true,
			cubicBezierParams: { x1: 0.2, y1: 0, x2: 0.5, y2: 1.0 },
			transitionType: CURSOR_TRANSITION_TYPES.EASE_OUT,
			effectStrength: 0.7, // Increased from 0.6 for more visible click effect
			speedFactor: 1.3, // Increased from 1.2 for faster click response
		};
	}

	// Hız faktörünü mesafeye göre ayarla
	// Uzak mesafelerde daha hızlı hareket et
	let speedFactor = 1.0;
	if (distance > threshold * 3) {
		speedFactor = 1.5; // Increased from 1.4
	} else if (distance > threshold * 2) {
		speedFactor = 1.3; // Increased from 1.25
	} else if (distance > threshold) {
		speedFactor = 1.2; // Increased from 1.15
	}

	// Normalize edilmiş mesafe (daha kolay hesaplama için)
	const normalizedDistance = distance / threshold;

	// Mevcut transition tipine göre parametreleri ayarla
	if (currentTransitionType === CURSOR_TRANSITION_TYPES.LINEAR) {
		x1 = 0.1;
		y1 = 0.1;
		x2 = 0.9;
		y2 = 0.9;
	} else if (currentTransitionType === CURSOR_TRANSITION_TYPES.EASE) {
		x1 = 0.25;
		y1 = 0.1;
		x2 = 0.25;
		y2 = 1.0;
	} else if (currentTransitionType === CURSOR_TRANSITION_TYPES.EASE_IN) {
		x1 = 0.42;
		y1 = 0;
		x2 = 1;
		y2 = 1;
	} else if (currentTransitionType === CURSOR_TRANSITION_TYPES.EASE_OUT) {
		x1 = 0;
		y1 = 0;
		x2 = 0.58;
		y2 = 1;
	}

	// Mesafeye göre kontrol noktalarını ince ayarla
	if (normalizedDistance > 2.5) {
		// Çok uzun mesafelerde daha hızlı geçiş
		if (currentTransitionType === CURSOR_TRANSITION_TYPES.EASE) {
			// Ease için daha agresif hızlanma
			x1 = 0.18; // Changed for faster initial movement
			y1 = 0.08;
			x2 = 0.35;
			y2 = 1.0;
		} else if (currentTransitionType === CURSOR_TRANSITION_TYPES.EASE_OUT) {
			// Ease-out için daha hızlı başlangıçlı yavaşlama
			x1 = 0.03; // Changed for faster initial movement
			y1 = 0.05;
			x2 = 0.3; // Changed for smoother deceleration
			y2 = 1.0;
		} else if (currentTransitionType === CURSOR_TRANSITION_TYPES.EASE_IN) {
			// Ease-in için daha hızlı başlangıç
			x1 = 0.38; // Changed for more pronounced effect
			x1 = 0.4; // Changed from 0.35
			y1 = 0.05; // Changed from 0
			x2 = 0.8; // Changed from 0.85
			y2 = 1.0;
		} else if (currentTransitionType === CURSOR_TRANSITION_TYPES.LINEAR) {
			// Linear için hafif bir hızlanma ekle
			x1 = 0.15; // Changed from 0.1
			y1 = 0.15; // Changed from 0.1
			x2 = 0.85; // Changed from 0.9
			y2 = 0.85; // Changed from 0.9
		}
	} else if (normalizedDistance > 1.5) {
		// Orta uzun mesafelerde daha belirgin geçiş
		if (currentTransitionType === CURSOR_TRANSITION_TYPES.EASE) {
			x1 = 0.22; // Changed from 0.2
			y1 = 0.12; // Changed from 0.1
			x2 = 0.35; // Changed from 0.4
			y2 = 1.0;
		} else if (currentTransitionType === CURSOR_TRANSITION_TYPES.EASE_OUT) {
			x1 = 0.05; // Changed from 0
			y1 = 0.05; // Changed from 0
			x2 = 0.5; // Changed from 0.55
			y2 = 1.0;
		} else if (currentTransitionType === CURSOR_TRANSITION_TYPES.EASE_IN) {
			x1 = 0.4; // Changed from 0.45
			y1 = 0.05; // Changed from 0
			x2 = 0.85; // Changed from 0.9
			y2 = 1.0;
		}
	} else if (normalizedDistance > 1) {
		// Kısa mesafelerde daha yumuşak geçiş
		if (currentTransitionType === CURSOR_TRANSITION_TYPES.EASE) {
			x1 = 0.28; // Changed from 0.25
			y1 = 0.15; // Changed from 0.1
			x2 = 0.32; // Changed from 0.35
			y2 = 1.0;
		}
	}

	// Daha yüksek mesafelerde daha belirgin efekt
	const effectStrength = Math.min(
		Math.max(0.25, (normalizedDistance - 0.5) * 0.3), // Changed from 0.3, 0.25
		0.9 // Changed from 1
	);

	return {
		shouldApplyCubicBezier: true,
		cubicBezierParams: { x1, y1, x2, y2 },
		transitionType: currentTransitionType,
		effectStrength: effectStrength,
		speedFactor: speedFactor,
	};
};
