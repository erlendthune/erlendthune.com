import React, { useRef, useEffect } from 'react';
import jsQR from 'jsqr';

const QRScanner = ({ onQRCodeScanned, width = 320, height = 240, style = {} }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    let timeoutId;
    let streamRef = null;
    let isComponentMounted = true;

    const startCamera = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          
          if (!isComponentMounted) {
            // Component was unmounted while getting camera access
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          
          streamRef = stream;
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.setAttribute('playsinline', true);
            videoRef.current.setAttribute('muted', true);
            
            // Wait for video to be ready and then play
            const playVideo = async () => {
              try {
                await videoRef.current.play();
                
                // Only start scanning if component is still mounted and video is playing
                if (isComponentMounted && videoRef.current && !videoRef.current.paused) {
                  const scan = () => {
                    if (!isComponentMounted || !videoRef.current || videoRef.current.paused) {
                      return;
                    }
                    
                    if (videoRef.current && canvasRef.current) {
                      const ctx = canvasRef.current.getContext('2d');
                      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
                      const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
                      const code = jsQR(imageData.data, imageData.width, imageData.height);
                      
                      if (code && code.data) {
                        onQRCodeScanned(code.data);
                      }
                    }
                    
                    if (isComponentMounted) {
                      // Use setTimeout instead of requestAnimationFrame to reduce scanning frequency
                      timeoutId = setTimeout(() => {
                        if (isComponentMounted && videoRef.current && !videoRef.current.paused) {
                          scan();
                        }
                      }, 200);
                    }
                  };
                  scan();
                }
              } catch (playError) {
                // Ignore AbortError and other play errors
                if (playError.name !== 'AbortError') {
                  console.warn('Video play error:', playError);
                }
              }
            };
            
            // Wait for loadedmetadata before playing
            if (videoRef.current.readyState >= 1) {
              playVideo();
            } else {
              videoRef.current.addEventListener('loadedmetadata', playVideo, { once: true });
            }
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
        }
      }
    };

    startCamera();

    return () => {
      isComponentMounted = false;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      if (videoRef.current) {
        videoRef.current.pause();
        if (videoRef.current.srcObject) {
          const tracks = videoRef.current.srcObject.getTracks();
          tracks.forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }
      }
      
      if (streamRef) {
        streamRef.getTracks().forEach(track => track.stop());
      }
    };
  }, [onQRCodeScanned]);

  return (
    <div style={style}>
      <video 
        ref={videoRef} 
        style={{ width, height, ...style.video }} 
      />
      <canvas 
        ref={canvasRef} 
        width={width} 
        height={height} 
        style={{ display: 'none' }} 
      />
    </div>
  );
};

export default QRScanner;
