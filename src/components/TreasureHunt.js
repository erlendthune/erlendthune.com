import React, { useState, useEffect } from 'react';
import QRScanner from './QRScanner';

// Helper to dynamically load sql-wasm.js from static files
function loadSqlJsScript(src) {
  return new Promise((resolve, reject) => {
    if (window.initSqlJs) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

const TreasureHunt = ({ showScannedCode = false }) => {
  const [db, setDb] = useState(null);
  const [currentStep, setCurrentStep] = useState(1); // Current treasure hunt step
  const [currentImage, setCurrentImage] = useState(null); // Current location image to show
  const [scannedCodes, setScannedCodes] = useState([]); // Track scanned codes
  const [treasureSequence, setTreasureSequence] = useState([]); // All available treasures
  const [gameComplete, setGameComplete] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [huntMode, setHuntMode] = useState('sequential'); // 'sequential' or 'random'
  const [gameStarted, setGameStarted] = useState(false);
  const [shuffledSequence, setShuffledSequence] = useState([]); // For random mode

  const handleQRCodeScanned = (code) => {
    // Check if this code matches the expected next step
    const expectedCode = currentStep.toString();
    
    if (code === expectedCode && !scannedCodes.includes(code)) {
      setLastScannedCode(code);
      setScannedCodes(prev => [...prev, code]);
      
      // Check if this was the last QR code to scan
      if (currentStep >= treasureSequence.length - 1) {
        // This was the last QR code, show final treasure location
        const finalStep = currentStep + 1;
        loadImageForStep(finalStep, db);
        setCurrentStep(finalStep);
        setGameComplete(true);
      } else {
        // Move to next step and show next location to find
        const nextStep = currentStep + 1;
        loadImageForStep(nextStep, db);
        setCurrentStep(nextStep);
      }
    }
  };

  // Load image for a specific step
  const loadImageForStep = (step, database = db) => {
    console.log(`Loading image for step ${step}`);
    if (database) {
      try {
        const stmt = database.prepare('SELECT bilde_base64 FROM steg WHERE qrkode = ?');
        stmt.bind([step.toString()]);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          console.log(`Found image for step ${step}:`, row.bilde_base64 ? 'Image data exists' : 'No image data');
          console.log('Image data length:', row.bilde_base64 ? row.bilde_base64.length : 0);
          console.log('Image data starts with:', row.bilde_base64 ? row.bilde_base64.substring(0, 50) : 'N/A');
          setCurrentImage(row.bilde_base64);
        } else {
          console.log(`No image found for step ${step}`);
          // Don't automatically mark game as complete here
          // This will be handled in handleQRCodeScanned
          setCurrentImage(null);
        }
        stmt.free();
      } catch (e) {
        console.error('Error loading image:', e);
        setCurrentImage('ERROR');
      }
    } else {
      console.log('Database not available for loading image');
      // Retry after a short delay if database is not ready
      setTimeout(() => {
        if (db) {
          console.log('Retrying image load with available database');
          loadImageForStep(step, db);
        }
      }, 100);
    }
  };

  // Initialize treasure sequence from database
  const initializeTreasureSequence = (database) => {
    try {
      console.log('Initializing treasure sequence...');
      const stmt = database.prepare('SELECT qrkode FROM steg ORDER BY CAST(qrkode AS INTEGER)');
      const sequence = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        sequence.push(row.qrkode);
      }
      stmt.free();
      
      console.log('Found treasure sequence:', sequence);
      setTreasureSequence(sequence);
      
      // Load the first image (step 1) using the passed database
      if (sequence.length > 0) {
        console.log('Loading first image for step 1');
        loadImageForStep(1, database);
      } else {
        console.log('No treasures found in database');
        setCurrentImage('NO_DATA'); // Special flag to indicate no data
      }
    } catch (e) {
      console.error('Error initializing sequence:', e);
      setCurrentImage('ERROR'); // Special flag to indicate error
    }
  };

  // Load sql.js and open the database
  useEffect(() => {
    const loadDb = async () => {
      try {
        console.log('Loading database...');
        const config = { locateFile: () => "/sql/sql-wasm.wasm" };
        await loadSqlJsScript("/sql/sql-wasm.js");
        const SQL = await window.initSqlJs(config);
        const savedDb = localStorage.getItem('sqlite-db');
        let newDb;
        if (savedDb) {
          console.log('Found saved database in localStorage');
          const binaryArray = new Uint8Array(atob(savedDb).split('').map(char => char.charCodeAt(0)));
          newDb = new SQL.Database(binaryArray);
        } else {
          console.log('No saved database found, creating new one');
          newDb = new SQL.Database();
          newDb.run(`CREATE TABLE IF NOT EXISTS steg (qrkode TEXT PRIMARY KEY, bilde_base64 TEXT);`);
        }
        setDb(newDb);
        
        // Initialize the treasure hunt sequence
        initializeTreasureSequence(newDb);
      } catch (error) {
        console.error('Error loading database:', error);
        setCurrentImage('ERROR');
      }
    };
    loadDb();
  }, []);

  return (
    <div style={{ maxWidth: 500, margin: '0px auto', padding: 20, background: 'var(--ifm-background-color)', color: 'var(--ifm-font-color-base)', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 20 }}>Treasure Hunt</h2>
      
      {/* Debug info - remove this later */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ marginBottom: 10, padding: 10, background: '#f0f0f0', borderRadius: 4, fontSize: '0.8em' }}>
          <strong>Debug:</strong> currentImage: {currentImage ? (currentImage.length > 50 ? 'Image data present' : currentImage) : 'null'}, 
          step: {currentStep}, 
          sequence: [{treasureSequence.join(', ')}], 
          scanned: [{scannedCodes.join(', ')}]
        </div>
      )}
      
      {/* Progress indicator */}
      <div style={{ marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: '0.9em', color: 'var(--ifm-color-emphasis-600)', marginBottom: 10 }}>
          {gameComplete ? 
            `Treasure Hunt Complete! Found ${scannedCodes.length} locations + treasure` :
            `Progress: ${scannedCodes.length} of ${treasureSequence.length - 1} locations found`
          }
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
          {treasureSequence.map((_, index) => (
            <div
              key={index}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: index < scannedCodes.length ? '#4caf50' : 
                                index === scannedCodes.length && !gameComplete ? '#2196f3' : 
                                index === treasureSequence.length - 1 && gameComplete ? '#ffd700' : '#e0e0e0'
              }}
              title={index === treasureSequence.length - 1 ? 'Treasure location' : `Location ${index + 1}`}
            />
          ))}
        </div>
        {gameComplete && (
          <div style={{ fontSize: '0.8em', color: 'var(--ifm-color-emphasis-600)', marginTop: 5 }}>
            🏆 = Treasure location (no QR code here)
          </div>
        )}
      </div>

      {/* Game completion */}
      {gameComplete ? (
        <div style={{ marginBottom: 20, padding: 20, background: '#e8f5e8', borderRadius: 8, textAlign: 'center' }}>
          <h3 style={{ color: '#4caf50', marginBottom: 10 }}>🎉 Treasure Hunt Complete! 🎉</h3>
          <p>You found all {scannedCodes.length} treasures!</p>
          <button 
            onClick={() => window.location.reload()} 
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
      ) : (
        <>
          {/* Current location to find */}
          {currentImage === 'NO_DATA' ? (
            <div style={{ marginBottom: 20, padding: 15, background: '#fff3cd', borderRadius: 8, textAlign: 'center' }}>
              <h3>No Treasure Hunt Data Found</h3>
              <p>Please use the Treasure Hunt Maker to create some QR codes and images first.</p>
              <p style={{ fontSize: '0.9em', color: 'var(--ifm-color-emphasis-600)' }}>
                Go to the maker page, scan QR codes, take snapshots, and save them to the database.
              </p>
            </div>
          ) : currentImage === 'ERROR' ? (
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
          ) : currentImage && currentImage !== 'NO_DATA' && currentImage !== 'ERROR' && currentImage.length > 0 ? (
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
                  `Scan QR code "${currentStep}" when you find this location`
                }
              </div>
              {gameComplete && (
                <button 
                  onClick={() => window.location.reload()} 
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
          ) : (
            <div style={{ marginBottom: 20, padding: 15, background: '#e3f2fd', borderRadius: 8, textAlign: 'center' }}>
              <strong>Loading treasure hunt...</strong>
            </div>
          )}

          {/* Last scanned feedback */}
          {lastScannedCode && !gameComplete && (
            <div style={{ marginBottom: 20, padding: 10, background: '#e8f5e8', borderRadius: 8, textAlign: 'center' }}>
              ✅ Found location {lastScannedCode}!
            </div>
          )}

          {/* QR Scanner section - only show if game is not complete */}
          {!gameComplete && (
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
          )}
        </>
      )}
    </div>
  );
};

export default TreasureHunt;
