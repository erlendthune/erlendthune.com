import React, { useRef } from 'react';
import QRScannerWithSnapshot from './QRScannerWithSnapshot';

const QRCodeScannerSection = ({ 
  showScanner, 
  setShowScanner, 
  qrCode, 
  setQrCode, 
  setSnapshot, 
  setImage, 
  setMessage 
}) => {
  const scannerRef = useRef(null);

  const handleQRCodeScanned = (code) => {
    setQrCode(code);
    setMessage(`QR code scanned: ${code}`);
  };

  // Handle taking a snapshot
  const handleTakeSnapshot = () => {
    if (scannerRef.current) {
      const snapshotData = scannerRef.current.takeSnapshot();
      if (snapshotData) {
        setSnapshot(snapshotData);
        setImage(snapshotData); // Set as the image to save
        setMessage("Snapshot taken! You can now save the QR code and image.");
      }
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>
        QR-code scanner:
      </label>
      
      {!showScanner ? (
        <button
          onClick={() => setShowScanner(true)}
          style={{
            padding: '10px 20px',
            borderRadius: 6,
            border: 'none',
            background: '#1976d2',
            color: '#fff',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            marginRight: 12,
            boxShadow: '0 1px 4px rgba(25, 118, 210, 0.08)',
            transition: 'background 0.2s',
          }}
        >
          Start QR Scanner
        </button>
      ) : (
        <div>
          <QRScannerWithSnapshot 
            ref={scannerRef}
            onQRCodeScanned={handleQRCodeScanned}
            width={320}
            height={240}
          />
          <div style={{ marginTop: 10 }}>
            <button
              onClick={handleTakeSnapshot}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                background: '#4caf50',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                marginRight: 8,
                boxShadow: '0 1px 4px rgba(76, 175, 80, 0.08)',
                transition: 'background 0.2s',
              }}
            >
              Take Snapshot
            </button>
            <button
              onClick={() => setShowScanner(false)}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                background: '#757575',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(117, 117, 117, 0.08)',
                transition: 'background 0.2s',
              }}
            >
              Stop Scanner
            </button>
          </div>
        </div>
      )}
      
      {qrCode && (
        <div style={{ marginTop: 10, padding: 10, background: '#f5f5f5', borderRadius: 6 }}>
          <strong>Scanned QR Code:</strong> {qrCode}
        </div>
      )}
    </div>
  );
};

export default QRCodeScannerSection;
