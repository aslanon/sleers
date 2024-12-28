import { ref } from "vue";

// Global state
const ipcState = ref<{ [key: string]: any }>({});

// Event bus için tip tanımları
type IpcEventHandler = (data: any) => void;
const eventHandlers: { [key: string]: Set<IpcEventHandler> } = {};

// Event listener'ları yönetmek için
const addIpcListener = (channel: string, handler: IpcEventHandler) => {
	if (!eventHandlers[channel]) {
		eventHandlers[channel] = new Set();
	}
	eventHandlers[channel].add(handler);
};

const removeIpcListener = (channel: string, handler: IpcEventHandler) => {
	eventHandlers[channel]?.delete(handler);
};

// window.postMessage ile iletişim
const sendIpcMessage = async (channel: string, data: any): Promise<any> => {
	return new Promise((resolve, reject) => {
		try {
			// Benzersiz bir mesaj ID'si oluştur
			const messageId = Math.random().toString(36).substr(2, 9);

			// Response handler'ı ekle
			const responseHandler = (event: MessageEvent) => {
				if (
					event.data?.type === "IPC_RESPONSE" &&
					event.data?.messageId === messageId
				) {
					window.removeEventListener("message", responseHandler);
					if (event.data.error) {
						reject(event.data.error);
					} else {
						resolve(event.data.result);
					}
				}
			};

			// Response listener'ı ekle
			window.addEventListener("message", responseHandler);

			// Mesajı gönder
			window.postMessage(
				{
					type: "IPC_MESSAGE",
					messageId,
					channel,
					data,
				},
				"*"
			);

			// 10 saniye timeout
			setTimeout(() => {
				window.removeEventListener("message", responseHandler);
				reject(new Error(`IPC message timeout: ${channel}`));
			}, 10000);
		} catch (error) {
			reject(error);
		}
	});
};

// Global message listener
if (process.client) {
	window.addEventListener("message", (event) => {
		if (event.data?.type === "IPC_MESSAGE") {
			const { channel, data, messageId } = event.data;

			// State'i güncelle
			ipcState.value[channel] = data;

			// Event handler'ları çağır
			eventHandlers[channel]?.forEach((handler) => handler(data));

			// Eğer bir messageId varsa, response gönder
			if (messageId) {
				window.postMessage(
					{
						type: "IPC_RESPONSE",
						messageId,
						result: data,
					},
					"*"
				);
			}
		}
	});
}

export const useIpcState = () => {
	return {
		ipcState,
		addIpcListener,
		removeIpcListener,
		sendIpcMessage,
	};
};
