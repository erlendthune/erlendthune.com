import React, { useState, useMemo, useEffect } from 'react';
import { useZxing } from 'react-zxing';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';

export default function ScannerView({ onDetected }) {
  const [error, setError] = useState('');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const hints = useMemo(() => {
    const hintsMap = new Map();
    hintsMap.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.QR_CODE
    ]);
    // Tell the decoder to spend more CPU time trying to decode (helps with blurry/far barcodes)
    hintsMap.set(DecodeHintType.TRY_HARDER, true);
    return hintsMap;
  }, []);

  const { ref } = useZxing({
    constraints: { 
      video: { 
        facingMode: 'environment',
        // Request a higher resolution from the camera to make barcodes clearer
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        // Try to force mobile cameras to continuously auto-focus
        advanced: [{ focusMode: "continuous" }]
      } 
    },
    hints,
    onResult(result) {
      if (result) {
        console.log("Barcode detected:", result.getText(), result.getBarcodeFormat());
        onDetected(result.getText());
      }
    },
    onError(err) {
      // Ignore normal scanning loop errors (ZXing unable to find/read barcode in current frame)
      const isScanError = 
        err.name === 'NotFoundException' || 
        err.name === 'ChecksumException' || 
        err.name === 'FormatException' || 
        (err.message && err.message.includes('No MultiFormat Readers were able to detect'));

      if (!isScanError) {
        console.log("Scanner error:", err.name, err.message);
        if (err.name === 'NotAllowedError') {
          setError('Camera Permission Denied. Please allow access.');
        } else {
          setError(`Camera error: ${err.message || 'Unable to access camera.'}`);
        }
      }
    },
  });

  useEffect(() => {
    const checkCapabilities = () => {
      const track = ref.current?.srcObject?.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities = track.getCapabilities();
          if (capabilities && capabilities.torch) {
            setTorchSupported(true);
          }
        } catch (e) {
          console.warn("Could not read track capabilities", e);
        }
      }
    };
    
    // Poll over the first few seconds until the camera track initializes
    const intervalId = setInterval(() => {
      if (ref.current?.srcObject) {
        checkCapabilities();
        clearInterval(intervalId);
      }
    }, 500);

    return () => clearInterval(intervalId);
  }, [ref]);

  const toggleTorch = async () => {
    try {
      const track = ref.current?.srcObject?.getVideoTracks()[0];
      if (track) {
        await track.applyConstraints({
          advanced: [{ torch: !torchOn }]
        });
        setTorchOn(!torchOn);
      }
    } catch (e) {
      console.error("Failed to toggle flashlight", e);
    }
  };

  return (
    <div style={{ padding: '1rem', textAlign: 'center' }}>
      {error ? (
        <p style={{ color: '#d32f2f', fontWeight: 'bold' }}>{error}</p>
      ) : (
        <div style={{ maxWidth: '400px', margin: '0 auto', overflow: 'hidden', borderRadius: '8px', border: '2px solid #ccc' }}>
          <video ref={ref} style={{ width: '100%', height: 'auto', display: 'block' }} playsInline muted />
          <div style={{ padding: '10px', backgroundColor: '#eee', color: '#333' }}>
            <p style={{ margin: 0 }}>Point your camera at a product barcode</p>
            {torchSupported && (
              <button 
                onClick={toggleTorch}
                style={{
                  marginTop: '10px',
                  padding: '8px 16px',
                  backgroundColor: torchOn ? '#f44336' : '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {torchOn ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
