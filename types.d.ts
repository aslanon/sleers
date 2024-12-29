interface Window {
	electron?: {
		ipcRenderer: {
			send: (channel: string, ...args: any[]) => void;
			on: (channel: string, func: (...args: any[]) => void) => void;
			invoke: (channel: string, ...args: any[]) => Promise<any>;
			removeAllListeners: (channel: string) => void;
		};
		desktopCapturer: {
			getSources: (opts: any) => Promise<any[]>;
		};
		fileSystem: {
			saveTempVideo: (data: string, type: string) => Promise<string>;
			getTempVideoPath: () => Promise<string>;
		};
		windowControls: {
			close: () => void;
			startDrag: (position: { x: number; y: number }) => void;
			dragging: (position: { x: number; y: number }) => void;
			endDrag: () => void;
		};
	};
}

declare module "#app" {
	interface PageMeta {
		title?: string;
	}
	interface NavigateToOptions {
		query?: Record<string, string | undefined>;
	}
}

export interface CursorSettings {
	smoothing: boolean;
	size: number;
	autoHide: boolean;
	loopPosition: boolean;
	highQuality: boolean;
	hideDelay: number;
	smoothingFactor: number;
}

export interface CursorPosition {
	x: number;
	y: number;
	timestamp: number;
}

export interface CursorState {
	isVisible: boolean;
	lastPosition: CursorPosition;
	currentPosition: CursorPosition;
	isMoving: boolean;
	lastMoveTime: number;
}
