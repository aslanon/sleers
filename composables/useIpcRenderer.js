/**
 * Composable for accessing electron's ipcRenderer functionality
 * Provides a wrapper around electron.ipcRenderer with safety checks
 */

export function useIpcRenderer() {
	const getIpcRenderer = () => {
		if (
			typeof window !== "undefined" &&
			window.electron &&
			window.electron.ipcRenderer
		) {
			return window.electron.ipcRenderer;
		}
		return null;
	};

	const ipcRenderer = getIpcRenderer();

	const send = (channel, ...args) => {
		const renderer = getIpcRenderer();
		if (renderer) {
			renderer.send(channel, ...args);
		} else {
			console.warn(
				`[useIpcRenderer] Failed to send message on channel "${channel}" - ipcRenderer not available`
			);
		}
	};

	const on = (channel, listener) => {
		const renderer = getIpcRenderer();
		if (renderer) {
			renderer.on(channel, listener);
			return () => renderer.removeAllListeners(channel);
		} else {
			console.warn(
				`[useIpcRenderer] Failed to register listener on channel "${channel}" - ipcRenderer not available`
			);
			return () => {};
		}
	};

	const once = (channel, listener) => {
		const renderer = getIpcRenderer();
		if (renderer) {
			renderer.once(channel, listener);
		} else {
			console.warn(
				`[useIpcRenderer] Failed to register one-time listener on channel "${channel}" - ipcRenderer not available`
			);
		}
	};

	const invoke = async (channel, ...args) => {
		const renderer = getIpcRenderer();
		if (renderer) {
			try {
				return await renderer.invoke(channel, ...args);
			} catch (error) {
				console.error(`[useIpcRenderer] Error invoking "${channel}":`, error);
				throw error;
			}
		} else {
			console.warn(
				`[useIpcRenderer] Failed to invoke method on channel "${channel}" - ipcRenderer not available`
			);
			return null;
		}
	};

	const removeAllListeners = (channel) => {
		const renderer = getIpcRenderer();
		if (renderer) {
			renderer.removeAllListeners(channel);
		} else {
			console.warn(
				`[useIpcRenderer] Failed to remove listeners from channel "${channel}" - ipcRenderer not available`
			);
		}
	};

	return {
		ipcRenderer,
		send,
		on,
		once,
		invoke,
		removeAllListeners,
		IPC_EVENTS: ipcRenderer?.IPC_EVENTS || {},
	};
}
