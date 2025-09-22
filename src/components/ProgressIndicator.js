import React from 'react';

const ProgressIndicator = ({ 
  gameStarted, 
  gameComplete, 
  scannedCodes, 
  treasureSequence, 
  huntMode, 
  getCurrentSequence 
}) => {
  if (!gameStarted) return null;

  return (
    <div style={{ marginBottom: 20, textAlign: 'center' }}>
      <div style={{ fontSize: '0.9em', color: 'var(--ifm-color-emphasis-600)', marginBottom: 10 }}>
        {gameComplete ? 
          `Treasure Hunt Complete! Found ${scannedCodes.length} locations + treasure` :
          `Progress: ${scannedCodes.length} of ${treasureSequence.length - 1} locations found`
        }
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
        {getCurrentSequence().map((_, index) => (
          <div
            key={index}
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: index < scannedCodes.length ? '#4caf50' : 
                              index === scannedCodes.length && !gameComplete ? '#2196f3' : 
                              index === getCurrentSequence().length - 1 && gameComplete ? '#ffd700' : '#e0e0e0'
            }}
            title={index === getCurrentSequence().length - 1 ? 'Treasure location' : `Location ${index + 1}`}
          />
        ))}
      </div>
      {gameComplete && (
        <div style={{ fontSize: '0.8em', color: 'var(--ifm-color-emphasis-600)', marginTop: 5 }}>
          🏆 = Treasure location (no QR code here)
        </div>
      )}
      <div style={{ fontSize: '0.8em', color: 'var(--ifm-color-emphasis-600)', marginTop: 5 }}>
        Mode: {huntMode === 'sequential' ? 'Sequential' : 'Random'} Hunt
      </div>
    </div>
  );
};

export default ProgressIndicator;
