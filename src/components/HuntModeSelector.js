import React from 'react';

const HuntModeSelector = ({ huntMode, setHuntMode, onStartGame, treasureCount }) => {
  return (
    <div style={{ marginBottom: 20, padding: 20, background: '#f8f9fa', borderRadius: 8 }}>
      <h3 style={{ textAlign: 'center', marginBottom: 15 }}>Choose Hunt Mode</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        <div 
          style={{
            padding: 15,
            border: huntMode === 'sequential' ? '2px solid #007bff' : '2px solid #e0e0e0',
            borderRadius: 8,
            cursor: 'pointer',
            backgroundColor: huntMode === 'sequential' ? '#e7f3ff' : '#fff',
            transition: 'all 0.2s'
          }}
          onClick={() => setHuntMode('sequential')}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <div style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: '2px solid #007bff',
              backgroundColor: huntMode === 'sequential' ? '#007bff' : 'transparent',
              marginRight: 10
            }} />
            <strong>Sequential Hunt</strong>
          </div>
          <p style={{ margin: 0, fontSize: '0.9em', color: '#666' }}>
            Follow the hunt in order (1, 2, 3...). Perfect for guided tours or specific paths.
          </p>
        </div>

        <div 
          style={{
            padding: 15,
            border: huntMode === 'random' ? '2px solid #007bff' : '2px solid #e0e0e0',
            borderRadius: 8,
            cursor: 'pointer',
            backgroundColor: huntMode === 'random' ? '#e7f3ff' : '#fff',
            transition: 'all 0.2s'
          }}
          onClick={() => setHuntMode('random')}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <div style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: '2px solid #007bff',
              backgroundColor: huntMode === 'random' ? '#007bff' : 'transparent',
              marginRight: 10
            }} />
            <strong>Random Hunt</strong>
          </div>
          <p style={{ margin: 0, fontSize: '0.9em', color: '#666' }}>
            Find locations in any order. Great for exploration and flexibility.
          </p>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <button 
          onClick={onStartGame}
          style={{
            padding: '12px 24px',
            borderRadius: 8,
            border: 'none',
            background: '#007bff',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '1em',
            boxShadow: '0 2px 8px rgba(0, 123, 255, 0.3)',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = '#0056b3'}
          onMouseOut={(e) => e.target.style.background = '#007bff'}
        >
          Start {huntMode === 'sequential' ? 'Sequential' : 'Random'} Hunt 🗺️
        </button>
      </div>
      
      <div style={{ textAlign: 'center', marginTop: 15, fontSize: '0.8em', color: '#666' }}>
        Found {treasureCount} locations in database
        {treasureCount > 1 && (
          <span> • {treasureCount - 1} QR codes + 1 treasure location</span>
        )}
      </div>
    </div>
  );
};

export default HuntModeSelector;