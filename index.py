import whisper
import glob
import os

# 1. En son oluşturulan temp_audio*.webm dosyasını bul
webm_files = glob.glob("temp_screen*.mov")
if not webm_files:
    print("Herhangi bir temp_audio*.webm dosyası bulunamadı.")
    exit()

latest_file = max(webm_files, key=os.path.getmtime)
print(f"İşlenen dosya: {latest_file}")

# 2. Whisper modelini yükle
model = whisper.load_model("base")

# 3. Transkripsiyon (Türkçe ve SRT için)
result = model.transcribe(
    latest_file,
    verbose=True,
    language="tr",
    condition_on_previous_text=False,
    task="transcribe"  # (varsayılan zaten bu)
)

# 4. Metni yazdır
print("\nTranskripsiyon:")
print(result["text"])

# 5. SRT çıktısı oluştur
srt_path = latest_file.replace(".webm", ".srt")
with open(srt_path, "w", encoding="utf-8") as srt_file:
    for i, segment in enumerate(result["segments"], start=1):
        start = segment["start"]
        end = segment["end"]
        text = segment["text"].strip()

        def format_time(seconds):
            hrs, rem = divmod(seconds, 3600)
            mins, secs = divmod(rem, 60)
            millis = int((secs % 1) * 1000)
            return f"{int(hrs):02}:{int(mins):02}:{int(secs):02},{millis:03}"

        srt_file.write(f"{i}\n")
        srt_file.write(f"{format_time(start)} --> {format_time(end)}\n")
        srt_file.write(f"{text}\n\n")

print(f"SRT dosyası oluşturuldu: {srt_path}")

