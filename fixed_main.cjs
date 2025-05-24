// Bu dosyadaki PROTECT_FILE, UNPROTECT_FILE ve GET_PROTECTED_FILES handler'ları tekrarlanıyor
//
// setupIpcHandlers() fonksiyonunun sonunda (yaklaşık 1822-1835 satırları) tekrarlanan handler kodu
// Bunu düzeltmek için şu şekilde değiştirmelisiniz:
//
// Bul:
// ```javascript
// ipcMain.handle("STORE_SET", async (event, key, value) => {
// 	try {
// 		// You can implement your own storage solution here
// 		// For now, we'll use a simple in-memory store
// 		global.store = global.store || {};
// 		global.store[key] = value;
// 		return true;
// 	} catch (error) {
// 		console.error(`[Main] Error setting store value for key ${key}:`, error);
// 		return false;
// 	}
// });

// // Dosya koruma işlemleri için IPC olayları
// ipcMain.handle(IPC_EVENTS.PROTECT_FILE, (event, filePath) => {
// 	if (tempFileManager) {
// 		return tempFileManager.protectFile(filePath);
// 	}
// 	return false;
// });

// ipcMain.handle(IPC_EVENTS.UNPROTECT_FILE, (event, filePath) => {
// 	if (tempFileManager) {
// 		return tempFileManager.unprotectFile(filePath);
// 	}
// 	return false;
// });

// ipcMain.handle(IPC_EVENTS.GET_PROTECTED_FILES, () => {
// 	if (tempFileManager) {
// 		return tempFileManager.getProtectedFiles();
// 	}
// 	return [];
// });

// // OPEN_EDITOR_MODE
// ipcMain.on(IPC_EVENTS.OPEN_EDITOR_MODE, (event) => {
// 	openEditorMode();
// });
// ```
//
// Değiştir:
// ```javascript
// ipcMain.handle("STORE_SET", async (event, key, value) => {
// 	try {
// 		// You can implement your own storage solution here
// 		// For now, we'll use a simple in-memory store
// 		global.store = global.store || {};
// 		global.store[key] = value;
// 		return true;
// 	} catch (error) {
// 		console.error(`[Main] Error setting store value for key ${key}:`, error);
// 		return false;
// 	}
// });

// // NOT: PROTECT_FILE, UNPROTECT_FILE ve GET_PROTECTED_FILES handler'ları daha önce tanımlandı, tekrar etmeyin!

// // OPEN_EDITOR_MODE
// ipcMain.on(IPC_EVENTS.OPEN_EDITOR_MODE, (event) => {
// 	openEditorMode();
// });
// ```
