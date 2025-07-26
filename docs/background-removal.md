# Arkaplan Kaldırma Özelliği

Creavit Studio uygulamasında kamera görüntüsünden arkaplanı kaldırma özelliği, TensorFlow.js ve BodyPix modeli kullanılarak gerçekleştirilmiştir. Bu özellik, kamera görüntüsündeki kişiyi tespit ederek arkaplanı şeffaf hale getirir.

## Özellikler

- Gerçek zamanlı arkaplan kaldırma
- Ayarlanabilir segmentasyon eşiği
- Farklı çözünürlük seçenekleri
- FPS limitleme
- Yatay çevirme seçeneği

## Kullanım

1. Editör ekranında, sağ taraftaki ayarlar panelinde "Kamera" sekmesine tıklayın.
2. "Arkaplan Kaldırma" bölümünü bulun ve açma/kapama düğmesini etkinleştirin.
3. Model yüklenirken kısa bir süre bekleyin (ilk kullanımda biraz zaman alabilir).
4. Arkaplan kaldırma işlemi başladığında, kamera görüntüsündeki kişi korunurken arkaplan şeffaf hale gelecektir.

## Ayarlar

### Segmentasyon Eşiği (0.1 - 0.9)

Bu değer, bir pikselin kişi olarak kabul edilmesi için gereken güven seviyesini belirler:

- Düşük değerler (0.1 - 0.3): Daha fazla piksel kişi olarak kabul edilir, ancak hatalı tespitler artabilir.
- Orta değerler (0.4 - 0.7): Çoğu durum için dengeli sonuçlar verir.
- Yüksek değerler (0.8 - 0.9): Sadece yüksek güvenle kişi olduğu tespit edilen pikseller korunur, ancak kişinin bazı kısımları kaybolabilir.

### Çözünürlük

İşlem sırasında kullanılacak çözünürlüğü belirler:

- Düşük: Daha hızlı işlem, daha düşük kalite
- Orta: Dengeli performans ve kalite (önerilen)
- Yüksek: Daha yüksek kalite, daha yavaş işlem

### Hedef FPS (15 - 60)

Arkaplan kaldırma işleminin saniyedeki kare sayısını sınırlar. Düşük değerler CPU kullanımını azaltır, yüksek değerler daha akıcı görüntü sağlar.

### Yatay Çevir

Kamera görüntüsünü yatay olarak çevirir. Selfie kamerası kullanıyorsanız ayna etkisi için faydalı olabilir.

## Teknik Detaylar

Bu özellik, TensorFlow.js ve BodyPix modelini kullanarak çalışır:

1. TensorFlow.js: JavaScript ortamında makine öğrenimi modellerini çalıştırmak için kullanılır.
2. BodyPix: Görüntüdeki kişileri piksel seviyesinde segmente etmek için kullanılan bir modeldir.

Arkaplan kaldırma işlemi şu adımları içerir:

1. Kamera görüntüsü bir canvas'a çizilir
2. BodyPix modeli görüntüyü analiz eder ve her pikselin kişi olup olmadığını belirler
3. Kişi olmayan piksellerin alfa değeri 0 (şeffaf) olarak ayarlanır
4. İşlenmiş görüntü ekrana çizilir

## Performans İpuçları

- Daha iyi performans için "Orta" çözünürlük ve 30 FPS kullanın
- Düşük performanslı cihazlarda "Düşük" çözünürlük ve 15-20 FPS tercih edin
- Segmentasyon eşiğini 0.6 civarında tutun
- Arkaplan kaldırma özelliğini kullanmadığınızda kapatın

## Bilinen Sınırlamalar

- Karanlık ortamlarda veya düşük kontrastlı görüntülerde segmentasyon kalitesi düşebilir
- Hızlı hareketlerde gecikme olabilir
- Yüksek çözünürlüklü kameralarda performans düşebilir
- İlk yükleme sırasında model indirildiği için internet bağlantısı gerektirebilir
