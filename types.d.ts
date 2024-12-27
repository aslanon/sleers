interface WindowControls {
	close: () => void;
	startDrag: (mousePosition: { x: number; y: number }) => void;
	dragging: (mousePosition: { x: number; y: number }) => void;
	endDrag: () => void;
}

interface ElectronAPI {
	ipcRenderer: {
		send: (channel: string, ...args: any[]) => void;
		on: (channel: string, func: Function) => void;
		once: (channel: string, func: Function) => void;
		removeAllListeners: (channel: string) => void;
	};
	windowControls: WindowControls;
	getTempVideoPath: () => Promise<string>;
	saveTempVideo: (blob: Blob) => Promise<string>;
}

declare global {
	interface Window {
		electron?: ElectronAPI;
	}
}
