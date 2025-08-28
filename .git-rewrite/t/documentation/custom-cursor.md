Özellik Tanımı: Mouse Hareket Takibi ve Özelleştirilmiş İmleç Görselleştirme
Özellik Açıklaması:
Ekran kaydı deneyimini geliştirmek için mouse hareketlerini kaydedip oynatma sırasında videoya özel bir imleç görselleştirmesi ekleyin. Bu özellik, ekran kaydı sırasında mouse hareketlerini gerçek zamanlı olarak takip eder ve oynatma sırasında videonun üzerine özelleştirilebilir bir imleç yerleştirir. İmleç boyutu ayarlanabilir, stil eklenebilir ve hareket bulanıklığı (motion blur) veya parlama gibi efektlerle daha net ve etkileyici hale getirilebilir.

Ana İşlevler:
Mouse Hareket Takibi:

Kaydı başlatırken mouse pozisyonlarını (x, y) ve zaman damgalarını kaydedin.
Kaydedilen hareketleri video zaman çizelgesiyle senkronize olacak şekilde saklayın.
Özelleştirilmiş İmleç Görselleştirme:

Varsayılan sistem imlecini aşağıdaki özelliklere sahip özel bir imleçle değiştirin:
Ayarlanabilir boyut ve renk.
Hareket bulanıklığı ve parlama gibi gelişmiş efektler.
Oynatma sırasında mouse hareketleriyle senkronize şekilde imleci dinamik olarak pozisyonlayın.
Video ve İmleç Senkronizasyonu:

Kaydedilen video üzerine imleci canvas kullanarak yerleştirin.
Mouse hareketleri ve video arasında sorunsuz bir senkronizasyon sağlayın.
Oynatma Geliştirmeleri:

Özel bir canvas üzerinde video karelerini ve özelleştirilmiş imleci birlikte işleyin.
Kullanıcıların imleç efektlerini (örneğin, hareket bulanıklığı, boyut) açıp kapatmasına izin verin.
Hedef Kullanım Alanları:
Eğitim İçerik Üretimi: Eğitim videolarında veya uygulama tanıtımlarında mouse hareketlerini net bir şekilde vurgulamak.
UI/UX Gösterimleri: Kullanıcı arayüzü veya kullanıcı deneyimi testlerinde mouse hareketlerini öne çıkarmak.
Hata Bildirimi: Sorunların daha iyi anlaşılmasını sağlamak için mouse hareketlerini görselleştirmek.
Teknik Gereksinimler:
Mouse Hareket Takibi: Kaydı sırasında mousemove olaylarını kullanarak mouse pozisyonlarını ve zaman damgalarını kaydetme.
Ekran Kaydı: navigator.mediaDevices.getDisplayMedia API'si ile ekran kaydı alırken imleç görünümünü kontrol etme (cursor: 'never').
Canvas İşleme: Kaydedilen video ve imleci işlemek için bir canvas katmanı kullanma.
Özel Efektler: CanvasRenderingContext2D özellikleriyle hareket bulanıklığı (shadowBlur) ve parlama efektleri (shadowColor) ekleme.
