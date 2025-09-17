import { useState, useEffect } from 'react';
import HuntModeSelector from './HuntModeSelector';
import ProgressIndicator from './ProgressIndicator';
import TreasureImage from './TreasureImage';
import QRScannerSection from './QRScannerSection';

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
        const finalTreasureLocation = treasureSequence[treasureSequence.length - 1];
        loadImageForStep(finalTreasureLocation, db);
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

  const handleStartNewHunt = () => {
    window.location.reload();
  };

  return (
    <div style={{ maxWidth: 500, margin: '0px auto', padding: 20, background: 'var(--ifm-background-color)', color: 'var(--ifm-font-color-base)', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 20 }}>Treasure Hunt</h2>
      
      {/* Hunt mode selection - show before game starts */}
      {!gameStarted && treasureSequence.length > 0 && currentImage !== 'NO_DATA' && currentImage !== 'ERROR' && (
        <HuntModeSelector 
          huntMode={huntMode}
          setHuntMode={setHuntMode}
          onStartGame={startGame}
          treasureCount={treasureSequence.length}
        />
      )}
      
      {/* Progress indicator */}
      <ProgressIndicator 
        gameStarted={gameStarted}
        gameComplete={gameComplete}
        scannedCodes={scannedCodes}
        treasureSequence={treasureSequence}
        huntMode={huntMode}
        getCurrentSequence={getCurrentSequence}
      />

      {/* Treasure image display */}
      <TreasureImage 
        currentImage={currentImage}
        currentStep={currentStep}
        gameComplete={gameComplete}
        scannedCodes={scannedCodes}
        onStartNewHunt={handleStartNewHunt}
      />

      {/* QR Scanner and feedback section */}
      <QRScannerSection 
        gameComplete={gameComplete}
        lastScannedCode={lastScannedCode}
        handleQRCodeScanned={handleQRCodeScanned}
        scannedCodes={scannedCodes}
        currentStep={currentStep}
        showScannedCode={showScannedCode}
      />
    </div>
  );
};

export default TreasureHunt;
