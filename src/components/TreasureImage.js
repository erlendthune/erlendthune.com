import React from 'react';

const TreasureImage = ({ 
  currentImage, 
  currentStep, 
  gameComplete, 
  scannedCodes, 
  onStartNewHunt 
}) => {
  if (currentImage === 'NO_DATA') {
    return (
      <div style={{ marginBottom: 20, padding: 15, background: '#fff3cd', borderRadius: 8, textAlign: 'center' }}>
        <h3>No Treasure Hunt Data Found</h3>
        <p>Please use the Treasure Hunt Maker to create some QR codes and images first.</p>
        <p style={{ fontSize: '0.9em', color: 'var(--ifm-color-emphasis-600)' }}>
          Go to the maker page, scan QR codes, take snapshots, and save them to the database.
        </p>
      </div>
    );
  }

  if (currentImage === 'ERROR') {
    return (
      <div style={{ marginBottom: 20, padding: 15, background: '#f8d7da', borderRadius: 8, textAlign: 'center' }}>
        <h3>Error Loading Treasure Hunt</h3>
        <p>There was an error loading the treasure hunt data.</p>
        <button 
          onClick={() => window.location.reload()} 
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            background: '#dc3545',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: 10
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!currentImage || currentImage.length === 0) {
    return (
      <div style={{ marginBottom: 20, padding: 15, background: '#e3f2fd', borderRadius: 8, textAlign: 'center' }}>
        <strong>Loading treasure hunt...</strong>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 20, textAlign: 'center' }}>
      <h3 style={{ marginBottom: 10 }}>
        {gameComplete ? '🎉 Treasure Found! 🎉' : 
         scannedCodes.length === 0 ? 'Find this location to start!' : 
         `Find location ${currentStep}`}
      </h3>
      <img 
        src={currentImage} 
        alt={`Location ${currentStep}`} 
        style={{ 
          maxWidth: '100%', 
          borderRadius: 8, 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
        }} 
      />
      <div style={{ marginTop: 10, fontSize: '0.9em', color: 'var(--ifm-color-emphasis-600)' }}>
        {gameComplete ? 
          '🏆 This is where the treasure is hidden! No QR code to scan here.' :
          `When you find this location, scan the QR code there to proceed.`
        }
      </div>
      {gameComplete && (
        <button 
          onClick={onStartNewHunt}
          style={{
            padding: '10px 20px',
            borderRadius: 6,
            border: 'none',
            background: '#4caf50',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: 15,
            boxShadow: '0 1px 4px rgba(76, 175, 80, 0.3)'
          }}
        >
          Start New Hunt
        </button>
      )}
    </div>
  );
};

export default TreasureImage;
