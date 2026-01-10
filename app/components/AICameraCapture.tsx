import React, { useRef, useState, useEffect } from 'react';
import { RiCloseLine, RiFlashlightLine, RiFlashlightFill, RiGalleryLine, RiCameraLensFill, RiCheckLine, RiRefreshLine } from 'react-icons/ri';
import { HiSparkles } from 'react-icons/hi2';
import Image from 'next/image';

interface AICameraCaptureProps {
  onClose: () => void;
  onComplete: (images: File[]) => void;
}

interface ImageAnalysis {
  success: boolean;
  description: string;
  maintenance_issue: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  confidence_score: number;
  error?: string;
}

const AICameraCapture: React.FC<AICameraCaptureProps> = ({ onClose, onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<File[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [angle, setAngle] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<ImageAnalysis | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<ImageAnalysis[]>([]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Mock gyroscope/accelerometer for "Angle" indicator
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta !== null) {
        setAngle(Math.round(event.beta)); // Tilt front-to-back
      }
    };
    
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    return () => {
      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 } 
        } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraError(null);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setCameraError("Unable to access camera. Please allow camera permissions or try a different device.");
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setPreviewImage(dataUrl);
      }
    }
  };

  const confirmPhoto = async () => {
    if (previewImage) {
      setIsAnalyzing(true);
      try {
        // Convert DataURL to File
        const res = await fetch(previewImage);
        const blob = await res.blob();
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        // Analyze image using OpenRouter API
        const formData = new FormData();
        formData.append('files', file);

        const analysisResponse = await fetch('/api/analyze-image-openrouter', {
          method: 'POST',
          body: formData,
        });

        let analysis: ImageAnalysis | null = null;
        
        if (analysisResponse.ok) {
          const data = await analysisResponse.json();
          if (data.success && data.results && data.results.length > 0) {
            analysis = data.results[0];
            setCurrentAnalysis(analysis);
            setAnalysisHistory(prev => [...prev, analysis!]);
          }
        } else {
          console.error('Analysis failed:', await analysisResponse.text());
        }
        
        setCapturedImages(prev => [...prev, file]);
        setPreviewImage(null);
        setCurrentAnalysis(null);
      } catch (error) {
        console.error('Error analyzing image:', error);
        // Still add the image even if analysis fails
        const res = await fetch(previewImage);
        const blob = await res.blob();
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCapturedImages(prev => [...prev, file]);
        setPreviewImage(null);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const retakePhoto = () => {
    setPreviewImage(null);
  };

  const handleFinish = () => {
    onComplete(capturedImages);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col lg:flex-row items-stretch justify-between overflow-hidden">
      {/* Hidden Canvas for capturing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Viewport */}
      <div className="relative w-full h-full lg:flex-1 flex items-center justify-center bg-gray-900">
        
        {/* Top Bar - Moved Inside Viewport */}
        <div className="w-full p-6 flex justify-between items-center z-10 bg-linear-to-b from-black/50 to-transparent absolute top-0 left-0">
          <button 
            onClick={onClose} 
            className="text-white p-2 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all"
          >
            <RiCloseLine className="text-2xl" />
          </button>
          
          <div className="flex flex-col items-center">
              <span className="text-white font-semibold tracking-wide">Scan item</span>
              <span className='text-xs text-white/70'>AI Assessment</span>
          </div>

          <button 
            onClick={() => setFlash(!flash)} 
            className={`p-2 rounded-full backdrop-blur-md transition-all ${flash ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {flash ? <RiFlashlightFill className="text-xl" /> : <RiFlashlightLine className="text-xl" />}
          </button>
        </div>

        {!previewImage && (
            <>
                {stream ? (
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="text-white p-8 text-center">
                        {cameraError ? cameraError : "Initializing camera..."}
                    </div>
                )}
                
                {/* Bounding Box Overlay */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-8">
                     {/* Guidance Text */}
                    <p className="absolute top-24 text-white/90 text-sm font-medium drop-shadow-md bg-black/30 px-4 py-2 rounded-full backdrop-blur-sm mb-8 animate-pulse">
                        Place item inside the frame
                    </p>

                    <div className="relative w-full max-w-sm aspect-[3/4] border-2 border-white/80 rounded-[1.5rem] shadow-[0_0_0_999px_rgba(0,0,0,0.5)]">
                        {/* Corners */}
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white -mt-1 -ml-1 rounded-tl-xl"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white -mt-1 -mr-1 rounded-tr-xl"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white -mb-1 -ml-1 rounded-bl-xl"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white -mb-1 -mr-1 rounded-br-xl"></div>
                    </div>
                    
                    {/* Indicators */}
                    <div className="absolute bottom-32 flex gap-4 text-xs font-mono text-white/80">
                         <span className="px-3 py-1 bg-black/40 rounded-full backdrop-blur-sm border border-white/10">
                            ZOOM: {zoomLevel.toFixed(1)}x
                         </span>
                         <span className={`px-3 py-1 bg-black/40 rounded-full backdrop-blur-sm border border-white/10 ${Math.abs(angle) < 10 ? 'text-green-400 border-green-400/30' : 'text-white/80'}`}>
                            ANGLE: {angle}°
                         </span>
                    </div>
                    {/* Level line helper */}
                     <div className={`absolute top-1/2 left-1/2 -translate-y-1/2 w-32 h-px bg-white/30 transition-transform duration-200`} style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}></div>
                </div>
            </>
        )}

        {/* Photo Review Preview */}
        {previewImage && (
            <div className="absolute inset-0 z-20 bg-black flex flex-col">
                <div className="relative flex-1">
                    <img src={previewImage} alt="Capture" className="w-full h-full object-contain" />
                </div>
                <div className="p-6 bg-black/80 backdrop-blur-md flex flex-col gap-4 pb-12 items-center justify-center">
                   <div className="w-full max-w-lg flex flex-col gap-4">
                     {isAnalyzing ? (
                       <div className="flex flex-col items-center gap-3 py-4">
                         <div className="animate-spin rounded-full h-8 w-8 border-4 border-white/30 border-t-white"></div>
                         <p className="text-white text-center font-medium">Analyzing image with AI...</p>
                       </div>
                     ) : (
                       <>
                     <p className="text-white text-center font-medium">Are you satisfied with this image?</p>
                     <div className="flex gap-4 w-full">
                        <button 
                            onClick={retakePhoto}
                            className="flex-1 py-3 rounded-xl bg-gray-800 text-white font-medium hover:bg-gray-700 transition-colors"
                        >
                            Retake
                        </button>
                        <button 
                            onClick={confirmPhoto}
                            className="flex-1 py-3 rounded-xl bg-customViolet text-white font-medium hover:bg-customViolet/90 transition-colors flex items-center justify-center gap-2"
                        >
                            <RiCheckLine className="text-xl" />
                            Yes, Keep it
                        </button>
                     </div>
                     </>
                     )}
                   </div>
                </div>
            </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="w-full lg:w-80 lg:h-full p-8 lg:px-6 lg:py-8 pb-12 lg:pb-8 flex lg:flex-col justify-between items-center bg-black z-[15] lg:border-l lg:border-white/10 lg:gap-6">
        
        {/* Analysis Results - Desktop Only */}
        {analysisHistory.length > 0 && (
          <div className="hidden lg:flex flex-col w-full gap-3 max-h-[50vh] overflow-y-auto">
            <h3 className="text-white text-sm font-bold uppercase tracking-wider">AI Analysis</h3>
            {analysisHistory.map((analysis, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                    analysis.urgency === 'critical' ? 'bg-red-500 text-white' :
                    analysis.urgency === 'high' ? 'bg-orange-500 text-white' :
                    analysis.urgency === 'medium' ? 'bg-yellow-500 text-black' :
                    'bg-green-500 text-white'
                  }`}>
                    {analysis.urgency}
                  </span>
                  <span className="text-white/70">{Math.round(analysis.confidence_score * 100)}%</span>
                </div>
                <p className="text-white/90 text-xs leading-relaxed line-clamp-3">
                  {analysis.maintenance_issue}
                </p>
                <p className="text-white/60 text-[10px] mt-1 capitalize">{analysis.category}</p>
              </div>
            ))}
          </div>
        )}

        <div className="w-full lg:w-auto flex lg:flex-col justify-between items-center gap-4 lg:gap-6">
        {/* Gallery Preview */}
        <div className="w-12 h-12 relative flex items-center justify-center">
            {capturedImages.length > 0 ? (
                 <div onClick={handleFinish} className="relative w-full h-full cursor-pointer">
                    <img 
                      src={URL.createObjectURL(capturedImages[capturedImages.length - 1])} 
                      className="w-full h-full object-cover rounded-lg border-2 border-white"
                      alt="Last capture"
                    />
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-customViolet text-white text-[10px] flex items-center justify-center rounded-full border border-black font-bold">
                        {capturedImages.length}
                    </span>
                 </div>
            ) : (
                <button className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center text-white/50 hover:text-white hover:bg-gray-700 transition-colors">
                    <RiGalleryLine className="text-2xl" />
                </button>
            )}
        </div>

        {/* Shutter Button */}
        <button 
            onClick={takePhoto}
            className="w-20 h-20 rounded-full border-4 border-white p-1 flex items-center justify-center hover:scale-95 active:scale-90 transition-transform"
        >
            <div className="w-full h-full bg-white rounded-full"></div>
        </button>

        {/* Done / Finish Button */}
        <div className="w-12 flex justify-center">
             {capturedImages.length > 0 && !previewImage && (
                 <button 
                    onClick={handleFinish}
                    className="text-white font-medium text-sm flex flex-col items-center gap-1 hover:text-customViolet transition-colors"
                 >
                    <HiSparkles className="text-xl" />
                    <span>Done</span>
                 </button>
             )}
        </div>
        </div>
      </div>
      
      {/* Styles for scan animation */}
      <style jsx>{`
        @keyframes scan {
          0%, 100% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          50% { top: 100%; opacity: 1; }
          90% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AICameraCapture;
