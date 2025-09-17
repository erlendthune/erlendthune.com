import React from 'react';
import QRScanner from './QRScanner';

const QRScannerSection = ({ 
  gameComplete, 
  lastScannedCode, 
  handleQRCodeScanned, 
  scannedCodes, 
  currentStep, 
  showScannedCode 
}) => {
  if (gameComplete) return null;

  return (
    <>
      {/* Last scanned feedback */}
      {lastScannedCode && (
        <div style={{ marginBottom: 20, padding: 10, background: '#e8f5e8', borderRadius: 8, textAlign: 'center' }}>
          ✅ Found location {lastScannedCode}!
        </div>
      )}

      {/* QR Scanner section */}
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ marginBottom: 10 }}>QR Code Scanner</h4>
        <QRScanner onQRCodeScanned={handleQRCodeScanned} width={320} height={240} />
        <div style={{ marginTop: 10, fontSize: '0.8em', color: 'var(--ifm-color-emphasis-600)' }}>
          {scannedCodes.length === 0 
            ? `Looking for QR code "1" to start the hunt`
            : `Looking for QR code "${currentStep}"`
          }
        </div>
        {showScannedCode && lastScannedCode && (
          <div style={{ marginTop: 5, fontSize: '0.8em', color: 'var(--ifm-color-emphasis-600)' }}>
            Last scanned: {lastScannedCode}
          </div>
        )}
      </div>
    </>
  );
};

export default QRScannerSection;
