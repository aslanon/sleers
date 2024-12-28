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
