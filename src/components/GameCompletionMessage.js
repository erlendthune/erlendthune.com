import React from 'react';

const GameCompletionMessage = ({ gameComplete, scannedCodes, onStartNewHunt }) => {
  if (!gameComplete) return null;

  return (
    <div style={{ marginBottom: 20, padding: 20, background: '#e8f5e8', borderRadius: 8, textAlign: 'center' }}>
      <h3 style={{ color: '#4caf50', marginBottom: 10 }}>🎉 Treasure Hunt Complete! 🎉</h3>
      <p>You found all {scannedCodes.length} treasures!</p>
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
          marginTop: 10
        }}
      >
        Start New Hunt
      </button>
    </div>
  );
};

export default GameCompletionMessage;
