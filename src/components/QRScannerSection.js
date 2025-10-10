import React from 'react';
import QRScanner from './QRScanner';

const QRScannerSection = ({ 
  gameComplete, 
  lastScannedCode, 
  handleQRCodeScanned, 
  scannedCodes, 
  currentStep, 
  showScannedCode,
  onDismissMessage 
}) => {
  if (gameComplete) return null;

  // Determine if the message is an error/warning vs success
  const isErrorMessage = lastScannedCode && (
    lastScannedCode.includes('Wrong sequence') ||
    lastScannedCode.includes('Already used') ||
    lastScannedCode.includes('Already found') ||
    lastScannedCode.includes('Already scanned') ||
    lastScannedCode.includes('Not part of this hunt') ||
    lastScannedCode.includes('This QR code is part of the treasure hunt but not a location to find')
  );

  return (
    <>
      {/* Last scanned feedback */}
      {lastScannedCode && (
        <div style={{ 
          marginBottom: 20, 
          padding: 15, 
          background: isErrorMessage ? '#ffebee' : '#e8f5e8', 
          borderRadius: 8, 
          border: isErrorMessage ? '1px solid #f44336' : '1px solid #4caf50',
          position: 'relative'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            gap: '10px'
          }}>
            <span style={{ 
              color: isErrorMessage ? '#d32f2f' : '#2e7d32',
              fontWeight: 500,
              flex: 1
            }}>
              {isErrorMessage ? '⚠️' : '✅'} {lastScannedCode.replace(/^Wrong sequence: |^Already used: |^Already scanned: |^Not part of this hunt: /, '')}
            </span>
            {isErrorMessage && onDismissMessage && (
              <button
                onClick={onDismissMessage}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#d32f2f',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '30px',
                  height: '30px'
                }}
                title="Dismiss message"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* QR Scanner section */}
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ marginBottom: 10 }}>QR Code Scanner</h4>
        <QRScanner onQRCodeScanned={handleQRCodeScanned} width={320} height={240} />
        {showScannedCode && lastScannedCode && !isErrorMessage && (
          <div style={{ marginTop: 5, fontSize: '0.8em', color: 'var(--ifm-color-emphasis-600)' }}>
            Last scanned: {lastScannedCode}
          </div>
        )}
      </div>
    </>
  );
};

export default QRScannerSection;
