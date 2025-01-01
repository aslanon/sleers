<script setup>
import { ref, watch, onMounted } from 'vue';
import { ZoomIn, ZoomOut } from 'lucide-react';

const props = defineProps({
  duration: { type: Number, required: true },
  onTimeChange: { type: Function, required: true },
  currentTime: { type: Number, required: true }
});

const zoom = ref(1);
const timelineRef = ref(null);
const containerRef = ref(null);

const TIMELINE_WIDTH = 1000;
const zoomedWidth = ref(TIMELINE_WIDTH * zoom.value);
const secondsPerPixel = ref(props.duration / zoomedWidth.value);

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

watch(() => props.currentTime, (newTime) => {
  if (!containerRef.value) return;

  const markerPosition = (newTime / props.duration) * zoomedWidth.value;
  const container = containerRef.value;
  const viewportWidth = container.clientWidth;

  if (markerPosition > container.scrollLeft + viewportWidth * 0.7 || 
      markerPosition < container.scrollLeft + viewportWidth * 0.3) {
    container.scrollLeft = markerPosition - viewportWidth / 2;
  }
});

watch(zoom, () => {
  zoomedWidth.value = TIMELINE_WIDTH * zoom.value;
  secondsPerPixel.value = props.duration / zoomedWidth.value;
});

const handleZoomIn = () => {
  zoom.value = Math.min(zoom.value * 1.5, 10);
};

const handleZoomOut = () => {
  zoom.value = Math.max(zoom.value / 1.5, 1);
};

const handleTimelineClick = (e) => {
  if (!containerRef.value) return;

  const rect = containerRef.value.getBoundingClientRect();
  const x = e.clientX - rect.left + containerRef.value.scrollLeft;
  const newTime = x * secondsPerPixel.value;

  if (newTime >= 0 && newTime <= props.duration) {
    props.onTimeChange(newTime);
  }
};

const renderTimeMarkers = () => {
  const markers = [];
  const step = Math.max(30 / zoom.value, 5);

  for (let time = 0; time <= props.duration; time += step) {
    const position = (time / props.duration) * zoomedWidth.value;
    markers.push(
      <div
        key={time}
        class="absolute flex flex-col items-center"
        style={{ left: `${position}px` }}
      >
        <div class="h-3 w-0.5 bg-gray-400" />
        <span class="text-xs text-gray-600">{formatTime(time)}</span>
      </div>
    );
  }
  return markers;
};
</script>

<template>
  <div class="w-full max-w-[1000px] mx-auto p-4 bg-white rounded-lg shadow-lg">
    <div class="flex justify-between items-center mb-4">
      <div class="text-lg font-semibold">Timeline</div>
      <div class="flex gap-2">
        <button
          @click="handleZoomOut"
          class="p-2 rounded hover:bg-gray-100"
          title="Zoom Out"
        >
          <ZoomOut class="w-5 h-5" />
        </button>
        <button
          @click="handleZoomIn"
          class="p-2 rounded hover:bg-gray-100"
          title="Zoom In"
        >
          <ZoomIn class="w-5 h-5" />
        </button>
      </div>
    </div>

    <div
      ref="containerRef"
      class="overflow-x-auto relative border rounded-lg"
    >
      <div
        ref="timelineRef"
        class="relative h-20 bg-gray-50"
        :style="{ width: `${zoomedWidth}px` }"
        @click="handleTimelineClick"
      >
        <!-- Render time markers -->
        <template v-for="marker in renderTimeMarkers()" :key="marker.key">
          {{ marker }}
        </template>

        <!-- Current time indicator -->
        <div
          class="absolute top-0 w-0.5 h-full bg-blue-500"
          :style="{ left: `${(props.currentTime / props.duration) * zoomedWidth}px`, transform: 'translateX(-50%)' }"
        />

        <!-- Playhead -->
        <div
          class="absolute -top-2 w-4 h-4 cursor-pointer"
          :style="{ left: `${(props.currentTime / props.duration) * zoomedWidth}px`, transform: 'translateX(-50%)' }"
        >
          <div class="w-4 h-4 bg-blue-500 rounded-full" />
        </div>
      </div>
    </div>

    <div class="mt-2 flex justify-between text-sm text-gray-600">
      <span>Current Time: {{ formatTime(props.currentTime) }}</span>
      <span>Total Duration: {{ formatTime(props.duration) }}</span>
    </div>
  </div>
</template>