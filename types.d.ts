interface WindowControls {
	close: () => void;
	startDrag: (mousePosition: { x: number; y: number }) => void;
	dragging: (mousePosition: { x: number; y: number }) => void;
	endDrag: () => void;
}

interface FileSystem {
	saveTempVideo: (blob: Blob) => Promise<string>;
	getTempVideoPath: () => Promise<string>;
	cleanupTempVideo: () => void;
}

interface ElectronAPI {
	desktopCapturer: {
		getSources: (opts: any) => Promise<any>;
	};
	windowControls: WindowControls;
	fileSystem: FileSystem;
	ipcRenderer: {
		send: (channel: string, ...args: any[]) => void;
		on: (channel: string, func: Function) => void;
		once: (channel: string, func: Function) => void;
		removeAllListeners: (channel: string) => void;
	};
}

declare global {
	interface Window {
		electron?: ElectronAPI;
	}
}
