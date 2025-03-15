import React, { useRef, useState, useEffect } from 'react';
import * as bodyPix from '@tensorflow-models/body-pix';
import '@tensorflow/tfjs';
import { Upload, Play, Pause, RefreshCw, Eraser } from 'lucide-react';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProcessed, setShowProcessed] = useState(false);
  const [model, setModel] = useState<bodyPix.BodyPix | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const animationFrameRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(0);
  const targetFpsInterval = 1000 / 30; // Hedef 30 FPS

  useEffect(() => {
    loadModel();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isProcessing && isPlaying) {
      processFrameLoop();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isProcessing, isPlaying]);

  const loadModel = async () => {
    setIsLoading(true);
    try {
      const loadedModel = await bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2
      });
      setModel(loadedModel);
    } catch (error) {
      console.error('Model yüklenirken hata oluştu:', error);
    }
    setIsLoading(false);
  };

  const processFrameLoop = () => {
    const currentTime = performance.now();
    const elapsed = currentTime - lastFrameTimeRef.current;

    if (elapsed >= targetFpsInterval) {
      processFrame();
      lastFrameTimeRef.current = currentTime - (elapsed % targetFpsInterval);
    }

    animationFrameRef.current = requestAnimationFrame(processFrameLoop);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.load();
      }
      setIsProcessing(false);
      setShowProcessed(false);
    }
  };

  const processFrame = async () => {
    if (!model || !videoRef.current || !canvasRef.current || !isProcessing) return;

    try {
      const segmentation = await model.segmentPerson(videoRef.current, {
        flipHorizontal: false,
        internalResolution: 'medium',
        segmentationThreshold: 0.6,
      });

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      ctx.drawImage(videoRef.current, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      
      for (let i = 0; i < segmentation.data.length; i++) {
        const isPersonPixel = segmentation.data[i];
        const pixelIndex = i * 4;
        if (!isPersonPixel) {
          pixels[pixelIndex + 3] = 0;
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
    } catch (error) {
      console.error('Frame işlenirken hata:', error);
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleBackgroundRemoval = () => {
    setIsProcessing(!isProcessing);
    setShowProcessed(!isProcessing);
  };

  const toggleVideoView = () => {
    setShowProcessed(!showProcessed);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Video Arkaplan Kaldırma Uygulaması
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-6">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="animate-spin h-8 w-8 text-blue-500" />
              <span className="ml-2">Model yükleniyor...</span>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <label className="block mb-4">
                  <span className="sr-only">Video Yükle</span>
                  <div className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-gray-400 focus:outline-none">
                    <div className="flex flex-col items-center space-y-2">
                      <Upload className="w-8 h-8 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        Video seçmek için tıklayın
                      </span>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="video/*"
                      onChange={handleFileUpload}
                    />
                  </div>
                </label>
              </div>

              <div className="space-y-4">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    className="w-full h-full absolute top-0 left-0"
                    style={{ display: showProcessed ? 'none' : 'block' }}
                    playsInline
                  />
                  <canvas
                    ref={canvasRef}
                    className="w-full h-full absolute top-0 left-0"
                    style={{ display: showProcessed ? 'block' : 'none' }}
                  />
                </div>

                {videoUrl && (
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={togglePlayPause}
                      className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-5 h-5 mr-2" />
                          Duraklat
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5 mr-2" />
                          Oynat
                        </>
                      )}
                    </button>
                    <button
                      onClick={toggleBackgroundRemoval}
                      className={`flex items-center px-4 py-2 ${
                        isProcessing 
                          ? 'bg-red-500 hover:bg-red-600' 
                          : 'bg-green-500 hover:bg-green-600'
                      } text-white rounded-lg transition-colors`}
                    >
                      <Eraser className="w-5 h-5 mr-2" />
                      {isProcessing ? 'Arkaplan İşlemeyi Durdur' : 'Arkaplanı Kaldır'}
                    </button>
                    {isProcessing && (
                      <button
                        onClick={toggleVideoView}
                        className="flex items-center px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                      >
                        {showProcessed ? 'Orijinal Video' : 'İşlenmiş Video'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;