# Sleer - Uygulama Yapısı

## 1. Modüler Yapı

### Ana Modüller

- **main.cjs**: Electron ana süreci, pencere yönetimi ve IPC iletişimi
- **cameraManager.cjs**: Kamera penceresi yönetimi ve kamera işlemleri
- **trayManager.cjs**: Sistem tepsisi simgesi ve menü yönetimi
- **preload.cjs**: Electron ve renderer süreçleri arasındaki köprü

### Vue Bileşenleri

- **index.vue**: Ana kontrol arayüzü
- **camera.vue**: Kamera görüntüleme penceresi
- **selection.vue**: Alan seçim penceresi
- **editor.vue**: Video düzenleme arayüzü

### Composables

- **useMediaDevices.js**: Medya cihazları ve kayıt yönetimi

## 2. İletişim Zinciri

### Kamera İşlemleri

0. **Pencere görünürlük akışı**;

- var olan flowları bozma:
- pencerlerin açılış kapanış / gizle göster özelliklerine dokunmadan sadece kayıdı sonlandır işleminden sonrasında, oluşan video ve audio urllerini main.cjs de sakla. sonrasında editor.vue nu penceresinin açılma eventine buradaki pathleri eklemelisin. daha sonra editor.vue da bu pathleri yakalayarak video taginde işlemelisin

1. **Kamera Seçimi**:

   ```
   index.vue -> main.cjs -> cameraManager.cjs -> camera.vue
   ```

   - `index.vue`: Kamera seçimi yapılır ve `CAMERA_DEVICE_CHANGED` eventi gönderilir
   - `main.cjs`: Eventi alır ve `cameraManager.updateCameraDevice()` metodunu çağırır
   - `cameraManager.cjs`: Kamera penceresine `UPDATE_CAMERA_DEVICE` eventi gönderir
   - `camera.vue`: Eventi alır ve kamera stream'ini günceller

2. **Kamera Durumu**:
   ```
   camera.vue -> main.cjs -> cameraManager.cjs -> index.vue
   ```
   - `camera.vue`: Kamera durumunu `CAMERA_STATUS_UPDATE` eventi ile bildirir
   - `main.cjs`: Eventi alır ve `cameraManager.handleCameraStatusUpdate()` metodunu çağırır
   - `cameraManager.cjs`: Ana pencereye `CAMERA_STATUS_CHANGED` eventi gönderir
   - `index.vue`: Kamera durumunu günceller

### Kayıt İşlemleri

1. **Kayıt Başlatma**:

   ```
   index.vue -> main.cjs -> cameraManager.cjs
   ```

   - `index.vue`: `RECORDING_STATUS_CHANGED` eventi gönderilir
   - `main.cjs`: Eventi alır ve ilgili yöneticileri bilgilendirir
   - `cameraManager.cjs`: Kamera penceresini açar/kapatır

2. **Alan Seçimi**:
   ```
   index.vue -> main.cjs -> selection.vue -> main.cjs -> index.vue
   ```
   - `index.vue`: `START_AREA_SELECTION` eventi gönderilir
   - `main.cjs`: Seçim penceresini açar
   - `selection.vue`: Alan seçilir ve `AREA_SELECTED` eventi gönderilir
   - `main.cjs`: Seçilen alanı ana pencereye iletir

## 3. Event Listesi

### Renderer -> Main Process

gereksiz event kullanımından kaçın, eğer var olan eventler yetiyorsa onları
genişlet.

- `CAMERA_DEVICE_CHANGED`: Kamera cihazı değiştiğinde
- `CAMERA_STATUS_UPDATE`: Kamera durumu güncellendiğinde
- `RECORDING_STATUS_CHANGED`: Kayıt durumu değiştiğinde
- `START_AREA_SELECTION`: Alan seçimi başlatıldığında
- `AREA_SELECTED`: Alan seçimi tamamlandığında
- `WINDOW_CLOSE`: Pencere kapatma isteği

### Main Process -> Renderer

- `UPDATE_CAMERA_DEVICE`: Kamera değişikliği bilgisi
- `CAMERA_STATUS_CHANGED`: Kamera durumu değişikliği
- `AREA_SELECTED`: Seçilen alan bilgisi
- `MERGE_STATUS`: Video birleştirme durumu

## 4. Dosya Yapısı

```
sleer/
├── electron/
│   ├── main.cjs
│   ├── cameraManager.cjs
│   ├── trayManager.cjs
│   └── preload.cjs
├── pages/
│   ├── index.vue
│   ├── camera.vue
│   ├── selection.vue
│   └── editor.vue
├── composables/
│   └── useMediaDevices.js
└── public/
    └── assets/
```

## 5. Kullanım Örnekleri

### Event Gönderme (Renderer Process)

```javascript
// Event gönderme
electron?.ipcRenderer.send("EVENT_ADI", veri);

// Event dinleme
electron?.ipcRenderer.on("EVENT_ADI", (veri) => {
	// İşlemler
});
```

### Event Dinleme (Main Process)

```javascript
// Event dinleme
ipcMain.on("EVENT_ADI", (event, veri) => {
	// İşlemler
});

// Event gönderme
window.webContents.send("EVENT_ADI", veri);
```

### Pencere Yönetimi

```javascript
// Yeni pencere oluşturma
const window = new BrowserWindow(options);

// Pencere yükleme
if (isDev) {
	window.loadURL("http://localhost:3002/sayfa");
} else {
	window.loadFile(path.join(__dirname, "../.output/public/sayfa/index.html"));
}
```
