import { ref, computed, onMounted, onUnmounted } from "vue";

export const usePerformanceMonitor = () => {
	// Performance metrics
	const fps = ref(60);
	const frameTime = ref(16.67);
	const averageFrameTime = ref(16.67);
	const memoryUsage = ref(0);
	const cpuUsage = ref(0);
	
	// Canvas performance
	const canvasRenderTime = ref(0);
	const offscreenRenderTime = ref(0);
	const compositeTime = ref(0);
	
	// Worker performance
	const workerStats = ref({
		cursor: { active: false, frameTime: 0, fps: 0 },
		blur: { active: false, frameTime: 0, fps: 0 },
		gif: { active: false, frameTime: 0, fps: 0 },
		backgroundRemoval: { active: false, frameTime: 0, fps: 0 }
	});
	
	// Performance history for charts
	const fpsHistory = ref([]);
	const memoryHistory = ref([]);
	const frameTimeHistory = ref([]);
	
	// Monitoring state
	const isMonitoring = ref(false);
	const monitoringInterval = ref(null);
	
	// Performance thresholds
	const thresholds = ref({
		fps: { warning: 50, critical: 30 },
		frameTime: { warning: 20, critical: 33.33 },
		memory: { warning: 100, critical: 200 } // MB
	});
	
	// Performance status
	const performanceStatus = computed(() => {
		if (fps.value < thresholds.value.fps.critical ||
			frameTime.value > thresholds.value.frameTime.critical ||
			memoryUsage.value > thresholds.value.memory.critical) {
			return 'critical';
		}
		
		if (fps.value < thresholds.value.fps.warning ||
			frameTime.value > thresholds.value.frameTime.warning ||
			memoryUsage.value > thresholds.value.memory.warning) {
			return 'warning';
		}
		
		return 'good';
	});

	// Offscreen canvas support
	const offscreenSupported = computed(() => {
		return typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined';
	});

	// Start performance monitoring
	const startMonitoring = () => {
		if (isMonitoring.value) return;
		
		isMonitoring.value = true;
		
		// Start FPS monitoring
		startFPSMonitoring();
		
		// Start memory monitoring
		startMemoryMonitoring();
		
		// Start periodic stats collection
		monitoringInterval.value = setInterval(() => {
			updatePerformanceStats();
		}, 1000); // Update every second
		
		console.log('[PerformanceMonitor] Started monitoring');
	};

	// Stop performance monitoring
	const stopMonitoring = () => {
		if (!isMonitoring.value) return;
		
		isMonitoring.value = false;
		
		if (monitoringInterval.value) {
			clearInterval(monitoringInterval.value);
			monitoringInterval.value = null;
		}
		
		console.log('[PerformanceMonitor] Stopped monitoring');
	};

	// FPS monitoring using requestAnimationFrame
	let fpsCounter = 0;
	let fpsStartTime = performance.now();
	let lastFrameTime = performance.now();
	
	const startFPSMonitoring = () => {
		const measureFPS = (currentTime) => {
			fpsCounter++;
			
			// Calculate frame time
			const currentFrameTime = currentTime - lastFrameTime;
			frameTime.value = currentFrameTime;
			
			// Update average frame time (smooth over 30 frames)
			averageFrameTime.value = (averageFrameTime.value * 29 + currentFrameTime) / 30;
			
			// Calculate FPS every second
			if (currentTime - fpsStartTime >= 1000) {
				fps.value = Math.round((fpsCounter * 1000) / (currentTime - fpsStartTime));
				fpsCounter = 0;
				fpsStartTime = currentTime;
			}
			
			lastFrameTime = currentTime;
			
			if (isMonitoring.value) {
				requestAnimationFrame(measureFPS);
			}
		};
		
		requestAnimationFrame(measureFPS);
	};

	// Memory monitoring
	const startMemoryMonitoring = () => {
		// Use Performance API if available
		if ('memory' in performance) {
			const updateMemory = () => {
				memoryUsage.value = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
			};
			
			setInterval(updateMemory, 2000); // Update every 2 seconds
			updateMemory();
		}
	};

	// Update performance stats and history
	const updatePerformanceStats = () => {
		// Update history arrays (keep last 60 seconds)
		fpsHistory.value.push(fps.value);
		if (fpsHistory.value.length > 60) fpsHistory.value.shift();
		
		memoryHistory.value.push(memoryUsage.value);
		if (memoryHistory.value.length > 60) memoryHistory.value.shift();
		
		frameTimeHistory.value.push(averageFrameTime.value);
		if (frameTimeHistory.value.length > 60) frameTimeHistory.value.shift();
	};

	// Record canvas render time
	const recordCanvasRenderTime = (time) => {
		canvasRenderTime.value = time;
	};

	// Record offscreen render time
	const recordOffscreenRenderTime = (time) => {
		offscreenRenderTime.value = time;
	};

	// Record composite time
	const recordCompositeTime = (time) => {
		compositeTime.value = time;
	};

	// Update worker stats
	const updateWorkerStats = (workerType, stats) => {
		if (workerStats.value[workerType]) {
			workerStats.value[workerType] = {
				...workerStats.value[workerType],
				...stats
			};
		}
	};

	// Get comprehensive performance report
	const getPerformanceReport = () => {
		return {
			// Core metrics
			fps: fps.value,
			frameTime: averageFrameTime.value,
			memoryUsage: memoryUsage.value,
			
			// Canvas performance
			canvasRenderTime: canvasRenderTime.value,
			offscreenRenderTime: offscreenRenderTime.value,
			compositeTime: compositeTime.value,
			
			// Worker performance
			workers: { ...workerStats.value },
			
			// System info
			offscreenSupported: offscreenSupported.value,
			performanceStatus: performanceStatus.value,
			
			// History data
			fpsHistory: [...fpsHistory.value],
			memoryHistory: [...memoryHistory.value],
			frameTimeHistory: [...frameTimeHistory.value],
			
			// Timestamp
			timestamp: Date.now()
		};
	};

	// Get optimization suggestions
	const getOptimizationSuggestions = () => {
		const suggestions = [];
		
		if (fps.value < 50) {
			suggestions.push({
				type: 'fps',
				severity: fps.value < 30 ? 'critical' : 'warning',
				message: 'Low FPS detected. Consider reducing canvas size or disabling heavy effects.',
				actions: ['Reduce video resolution', 'Disable motion blur', 'Lower GIF quality']
			});
		}
		
		if (frameTime.value > 20) {
			suggestions.push({
				type: 'frameTime',
				severity: frameTime.value > 33 ? 'critical' : 'warning',
				message: 'High frame time detected. Canvas rendering may be bottlenecking.',
				actions: ['Enable offscreen rendering', 'Reduce concurrent animations', 'Optimize cursor effects']
			});
		}
		
		if (memoryUsage.value > 100) {
			suggestions.push({
				type: 'memory',
				severity: memoryUsage.value > 200 ? 'critical' : 'warning',
				message: 'High memory usage detected. Check for memory leaks.',
				actions: ['Clear canvas caches', 'Reduce GIF cache size', 'Restart application']
			});
		}
		
		if (!offscreenSupported.value) {
			suggestions.push({
				type: 'compatibility',
				severity: 'info',
				message: 'OffscreenCanvas not supported. Performance may be limited.',
				actions: ['Update browser', 'Use Chrome/Firefox', 'Enable experimental features']
			});
		}
		
		return suggestions;
	};

	// Performance grade calculation
	const performanceGrade = computed(() => {
		let score = 100;
		
		// FPS score (40% weight)
		if (fps.value < 30) score -= 40;
		else if (fps.value < 50) score -= 20;
		else if (fps.value < 55) score -= 10;
		
		// Frame time score (30% weight)
		if (frameTime.value > 33) score -= 30;
		else if (frameTime.value > 20) score -= 15;
		else if (frameTime.value > 18) score -= 5;
		
		// Memory score (20% weight)
		if (memoryUsage.value > 200) score -= 20;
		else if (memoryUsage.value > 100) score -= 10;
		else if (memoryUsage.value > 75) score -= 5;
		
		// Worker utilization bonus (10% weight)
		const activeWorkers = Object.values(workerStats.value).filter(w => w.active).length;
		if (activeWorkers > 0 && offscreenSupported.value) {
			score += Math.min(10, activeWorkers * 3);
		}
		
		return Math.max(0, Math.min(100, Math.round(score)));
	});

	// Get grade letter
	const performanceGradeLetter = computed(() => {
		const grade = performanceGrade.value;
		if (grade >= 90) return 'A';
		if (grade >= 80) return 'B';
		if (grade >= 70) return 'C';
		if (grade >= 60) return 'D';
		return 'F';
	});

	// Clear performance history
	const clearHistory = () => {
		fpsHistory.value = [];
		memoryHistory.value = [];
		frameTimeHistory.value = [];
	};

	// Start monitoring on mount
	onMounted(() => {
		if (typeof window !== 'undefined') {
			startMonitoring();
		}
	});

	// Stop monitoring on unmount
	onUnmounted(() => {
		stopMonitoring();
	});

	return {
		// Core metrics
		fps,
		frameTime,
		averageFrameTime,
		memoryUsage,
		cpuUsage,
		
		// Canvas metrics
		canvasRenderTime,
		offscreenRenderTime,
		compositeTime,
		
		// Worker metrics
		workerStats,
		
		// History
		fpsHistory,
		memoryHistory,
		frameTimeHistory,
		
		// Status
		isMonitoring,
		performanceStatus,
		offscreenSupported,
		performanceGrade,
		performanceGradeLetter,
		
		// Control
		startMonitoring,
		stopMonitoring,
		
		// Recording
		recordCanvasRenderTime,
		recordOffscreenRenderTime,
		recordCompositeTime,
		updateWorkerStats,
		
		// Analysis
		getPerformanceReport,
		getOptimizationSuggestions,
		clearHistory,
		
		// Configuration
		thresholds
	};
};