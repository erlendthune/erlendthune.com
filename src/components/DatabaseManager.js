// Helper to dynamically load sql-wasm.js from static files
export function loadSqlJsScript(src) {
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

// Load image for a specific step from database
export const loadImageForStep = (step, database, setCurrentImage) => {
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
        if (setCurrentImage) {
          setCurrentImage(row.bilde_base64);
        }
        return row.bilde_base64;
      } else {
        console.log(`No image found for step ${step}`);
        if (setCurrentImage) {
          setCurrentImage(null);
        }
        return null;
      }
      stmt.free();
    } catch (e) {
      console.error('Error loading image:', e);
      if (setCurrentImage) {
        setCurrentImage('ERROR');
      }
      return 'ERROR';
    }
  } else {
    console.log('Database not available for loading image');
    // Retry after a short delay if database is not ready
    setTimeout(() => {
      if (database) {
        console.log('Retrying image load with available database');
        loadImageForStep(step, database, setCurrentImage);
      }
    }, 100);
    return null;
  }
};

// Initialize treasure sequence from database
export const initializeTreasureSequence = (database, setTreasureSequence, setCurrentImage, loadImageCallback) => {
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
      loadImageCallback(1, database);
    } else {
      console.log('No treasures found in database');
      setCurrentImage('NO_DATA'); // Special flag to indicate no data
    }
  } catch (e) {
    console.error('Error initializing sequence:', e);
    setCurrentImage('ERROR'); // Special flag to indicate error
  }
};

// Initialize database
export const initializeDatabase = async (setDb, setCurrentImage, setTreasureSequence, loadImageCallback) => {
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
    initializeTreasureSequence(newDb, setTreasureSequence, setCurrentImage, loadImageCallback);
  } catch (error) {
    console.error('Error loading database:', error);
    setCurrentImage('ERROR');
  }
};

// Shuffle array function for random hunt mode
export const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Get current sequence based on mode
export const getCurrentSequence = (huntMode, shuffledSequence, treasureSequence) => {
  return huntMode === 'random' ? shuffledSequence : treasureSequence;
};

// Get expected QR code for current step
export const getExpectedQRCode = (huntMode, shuffledSequence, treasureSequence, currentStep) => {
  const sequence = getCurrentSequence(huntMode, shuffledSequence, treasureSequence);
  if (sequence.length === 0 || currentStep > sequence.length) return null;
  return sequence[currentStep - 1];
};

// Handle QR code scanning logic
export const handleQRCodeScanned = (
  code, 
  currentStep, 
  huntMode, 
  shuffledSequence, 
  treasureSequence, 
  scannedCodes, 
  db,
  setters // object containing all setters: { setLastScannedCode, setScannedCodes, setCurrentStep, setGameComplete, setCurrentImage }
) => {
  const { setLastScannedCode, setScannedCodes, setCurrentStep, setGameComplete, setCurrentImage } = setters;
  const sequence = getCurrentSequence(huntMode, shuffledSequence, treasureSequence);
  const expectedCode = getExpectedQRCode(huntMode, shuffledSequence, treasureSequence, currentStep);
  
  if (code === expectedCode && !scannedCodes.includes(code)) {
    setLastScannedCode(code);
    setScannedCodes(prev => [...prev, code]);
    
    // Check if this was the last QR code to scan
    if (currentStep >= sequence.length - 1) {
      // This was the last QR code, show final treasure location
      // The final treasure location is always the last item in the original sequence
      const finalTreasureLocation = treasureSequence[treasureSequence.length - 1];
      loadImageForStep(finalTreasureLocation, db, setCurrentImage);
      setCurrentStep(sequence.length); // Set to final step number
      setGameComplete(true);
    } else {
      // Move to next step and show next location to find
      const nextStep = currentStep + 1;
      const nextLocation = sequence[nextStep - 1];
      loadImageForStep(nextLocation, db, setCurrentImage);
      setCurrentStep(nextStep);
    }
  }
};

// Start the game with selected mode
export const startGame = (
  huntMode,
  treasureSequence,
  db,
  setters // object containing: { setGameStarted, setCurrentStep, setScannedCodes, setLastScannedCode, setGameComplete, setShuffledSequence, setCurrentImage }
) => {
  const { setGameStarted, setCurrentStep, setScannedCodes, setLastScannedCode, setGameComplete, setShuffledSequence, setCurrentImage } = setters;
  
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
    loadImageForStep(shuffled[0], db, setCurrentImage);
  } else {
    // Sequential mode - use original sequence
    setShuffledSequence(treasureSequence);
    loadImageForStep(treasureSequence[0], db, setCurrentImage);
  }
};
