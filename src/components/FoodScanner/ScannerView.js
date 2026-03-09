import React, { useState, useMemo } from 'react';
import { useZxing } from 'react-zxing';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';

export default function ScannerView({ onDetected }) {
  const [error, setError] = useState('');

  const hints = useMemo(() => {
    const hintsMap = new Map();
    hintsMap.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.QR_CODE
    ]);
    return hintsMap;
  }, []);

  const { ref } = useZxing({
    constraints: { video: { facingMode: 'environment' } },
    hints,
    onResult(result) {
      if (result) {
        onDetected(result.getText());
      }
    },
    onError(err) {
      // Don't log normal "NotFoundException" scanning loop errors to user.
      if (err.name !== 'NotFoundException') {
        if (err.name === 'NotAllowedError') {
          setError('Camera Permission Denied. Please allow access.');
        } else {
          setError(`Camera error: ${err.message || 'Unable to access camera.'}`);
        }
      }
    },
  });

  return (
    <div style={{ padding: '1rem', textAlign: 'center' }}>
      {error ? (
        <p style={{ color: '#d32f2f', fontWeight: 'bold' }}>{error}</p>
      ) : (
        <div style={{ maxWidth: '400px', margin: '0 auto', overflow: 'hidden', borderRadius: '8px', border: '2px solid #ccc' }}>
          <video ref={ref} style={{ width: '100%', height: 'auto', display: 'block' }} playsInline muted />
          <div style={{ padding: '10px', backgroundColor: '#eee', color: '#333' }}>
            <p style={{ margin: 0 }}>Point your camera at a product barcode</p>
          </div>
        </div>
      )}
    </div>
  );
}
