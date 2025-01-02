// Kayıt işlemini başlat const startRecording = async (data) => { try { // Video
kaydı const videoStream = await
navigator.mediaDevices.getUserMedia(data.videoConstraints); videoRecorder.value
= new MediaRecorder(videoStream); // Mikrofon kaydı const audioStream = await
navigator.mediaDevices.getUserMedia(data.audioConstraints); audioRecorder.value
= new MediaRecorder(audioStream); // Sistem sesi kaydı const systemAudioStream =
await navigator.mediaDevices.getUserMedia(data.systemAudioConstraints);
systemAudioRecorder.value = new MediaRecorder(systemAudioStream); // Video kayıt
const videoChunks = []; videoRecorder.value.ondataavailable = (e) => { if
(e.data.size > 0) { videoChunks.push(e.data); } }; videoRecorder.value.onstop =
async () => { const blob = new Blob(videoChunks, { type: 'video/webm' }); await
saveRecording(blob, data.videoPath); }; // Mikrofon kayıt const audioChunks =
[]; audioRecorder.value.ondataavailable = (e) => { if (e.data.size > 0) {
audioChunks.push(e.data); } }; audioRecorder.value.onstop = async () => { const
blob = new Blob(audioChunks, { type: 'audio/webm' }); await saveRecording(blob,
data.audioPath); }; // Sistem sesi kayıt const systemAudioChunks = [];
systemAudioRecorder.value.ondataavailable = (e) => { if (e.data.size > 0) {
systemAudioChunks.push(e.data); } }; systemAudioRecorder.value.onstop = async ()
=> { const blob = new Blob(systemAudioChunks, { type: 'audio/webm' }); await
saveRecording(blob, data.systemAudioPath); }; // Kayıtları başlat
videoRecorder.value.start(); audioRecorder.value.start();
systemAudioRecorder.value.start(); isRecording.value = true; startTime.value =
Date.now(); // Timer'ı başlat timer.value = setInterval(() => {
elapsedTime.value = Math.floor((Date.now() - startTime.value) / 1000); }, 1000);
} catch (error) { console.error('Kayıt başlatma hatası:', error); emit('error',
error.message); } }; // Kayıt durdurma const stopRecording = async () => { try {
if (videoRecorder.value && videoRecorder.value.state === 'recording') {
videoRecorder.value.stop(); videoRecorder.value.stream.getTracks().forEach(track
=> track.stop()); } if (audioRecorder.value && audioRecorder.value.state ===
'recording') { audioRecorder.value.stop();
audioRecorder.value.stream.getTracks().forEach(track => track.stop()); } if
(systemAudioRecorder.value && systemAudioRecorder.value.state === 'recording') {
systemAudioRecorder.value.stop();
systemAudioRecorder.value.stream.getTracks().forEach(track => track.stop()); }
clearInterval(timer.value); isRecording.value = false; elapsedTime.value = 0;
emit('recordingComplete'); } catch (error) { console.error('Kayıt durdurma
hatası:', error); emit('error', error.message); } };
