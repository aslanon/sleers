interface ElectronAPI {
	desktopCapturer: {
		getSources: (opts: any) => Promise<any>;
	};
	windowControls: {
		close: () => void;
		startDrag: (mousePosition: { x: number; y: number }) => void;
		dragging: (mousePosition: { x: number; y: number }) => void;
		endDrag: () => void;
	};
	fileSystem: {
		saveTempVideo: (blob: string) => Promise<string>;
		getTempVideoPath: () => Promise<string>;
		cleanupTempVideo: () => void;
	};
	ipcRenderer: {
		on: (channel: string, func: (...args: any[]) => void) => void;
		once: (channel: string, func: (...args: any[]) => void) => void;
		send: (channel: string, ...args: any[]) => void;
		invoke: (channel: string, ...args: any[]) => Promise<any>;
		removeAllListeners: (channel: string) => void;
	};
}

declare global {
	interface Window {
		electron?: ElectronAPI;
	}
}
