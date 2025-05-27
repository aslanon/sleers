# Timeline Segment Trimming Feature

## Overview

The timeline segment trimming feature allows users to adjust the start and end points of video segments by dragging the handles at the edges of timeline segments. This provides precise control over which parts of the video are included in the final output.

## How to Use

### 1. Accessing Trim Handles

- When you hover over a timeline segment, you'll see small white handles appear at the left and right edges
- The left handle controls the segment's start time (trim from beginning)
- The right handle controls the segment's end time (trim from end)

### 2. Trimming a Segment

1. **Start Trimming**: Click and hold on either the left or right handle
2. **Drag to Trim**: Move the mouse left or right to adjust the segment boundary
3. **Release**: Let go of the mouse button to complete the trim operation

### 3. Visual Feedback

- During trimming, the segment will update in real-time to show the new boundaries
- The video player will automatically sync with the trimmed segment
- Console logs will show the trimming progress (in development mode)

### 4. Playback Behavior

- When a segment is trimmed, video playback will respect the new boundaries
- If the current playback time is outside the trimmed segment, it will automatically jump to the nearest valid position
- Segments will play sequentially, jumping from the end of one segment to the start of the next

## Technical Implementation

### Event Flow

1. **TimelineSegment.vue**: Handles mouse events and calculates new segment times
2. **TimelineComponent.vue**: Manages segment updates and emits events to parent
3. **editor.vue**: Receives segment updates and syncs with MediaPlayer
4. **MediaPlayer.vue**: Enforces segment boundaries during playback

### Key Features

- **Real-time Updates**: Segments update visually as you drag
- **Boundary Enforcement**: Minimum segment duration (0.1 seconds) is enforced
- **Automatic Sync**: Video playback automatically adjusts to trimmed segments
- **Smooth Transitions**: Segments transition smoothly between each other

### Debugging

Console logs are available to track the trimming process:

- `[TimelineSegment] Resize start/update/end`: Shows segment-level events
- `[TimelineComponent] Resize start/update/end`: Shows timeline-level events
- `[editor.vue] Segment events`: Shows editor-level synchronization

## Limitations

- Minimum segment duration is 0.1 seconds
- Segments cannot be trimmed beyond the video duration
- Segments cannot overlap (future enhancement)

## Future Enhancements

- Multi-segment selection and trimming
- Snap-to-grid functionality
- Undo/redo for trim operations
- Keyboard shortcuts for precise trimming
