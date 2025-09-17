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

  // Shuffle array function
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const handleQRCodeScanned = (code) => {
    const sequence = getCurrentSequence();
    const expectedCode = getExpectedQRCode();
    
    if (code === expectedCode && !scannedCodes.includes(code)) {
      setLastScannedCode(code);
      setScannedCodes(prev => [...prev, code]);
      // Check if this was the last QR code to scan
      if (currentStep >= sequence.length - 1) {
        // This was the last QR code, show final treasure location
        // The final treasure location is always the last item in the original sequence
//        const finalTreasureLocation = treasureSequence[treasureSequence.length - 1];

        loadImageForStep(3, db);
        setCurrentStep(sequence.length); // Set to final step number
        setGameComplete(true);
      } else {
        // Move to next step and show next location to find
        const nextStep = currentStep + 1;
        const nextLocation = sequence[nextStep - 1];
        loadImageForStep(nextLocation, db);
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

  // Start the game with selected mode
  const startGame = () => {
    if (treasureSequence.length === 0) return;
    
    setGameStarted(true);
    setCurrentStep(1);
    setScannedCodes([]);
    setLastScannedCode('');
    setGameComplete(false);

    if (huntMode === 'random') {
      // Create shuffled sequence (excluding the last treasure location)
      const huntLocations = treasureSequence.slice(0, -1); // All except last
      const shuffled = shuffleArray(huntLocations);
      const finalSequence = [...shuffled, treasureSequence[treasureSequence.length - 1]]; // Add treasure at end
      setShuffledSequence(finalSequence);
      
      // Load first image from shuffled sequence
      loadImageForStep(shuffled[0], db);
    } else {
      // Sequential mode - use original sequence
      setShuffledSequence(treasureSequence);
      loadImageForStep(treasureSequence[0], db);
    }
  };

  // Get current sequence based on mode
  const getCurrentSequence = () => {
    return huntMode === 'random' ? shuffledSequence : treasureSequence;
  };

  // Get expected QR code for current step
  const getExpectedQRCode = () => {
    const sequence = getCurrentSequence();
    if (sequence.length === 0 || currentStep > sequence.length) return null;
    return sequence[currentStep - 1];
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
          scanned: [{scannedCodes.join(', ')}],
          gameStarted: {gameStarted ? 'true' : 'false'},
          huntMode: {huntMode}
        </div>
      )}

      {/* Hunt mode selection - show before game starts */}
      {!gameStarted && treasureSequence.length > 0 && currentImage !== 'NO_DATA' && currentImage !== 'ERROR' && (
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
              onClick={startGame}
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
            Found {treasureSequence.length} locations in database
            {treasureSequence.length > 1 && (
              <span> • {treasureSequence.length - 1} QR codes + 1 treasure location</span>
            )}
          </div>
        </div>
      )}
      
      {/* Progress indicator - only show when game started */}
      {gameStarted && (
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
      )}

      {/* Current location image - show both during game and when complete */}
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

      {/* QR Scanner and feedback - only show if game is not complete */}
      {!gameComplete && (
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
      )}
    </div>
  );
};

export default TreasureHunt;
