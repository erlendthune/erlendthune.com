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
        setCurrentImage(row.bilde_base64);
      } else {
        console.log(`No image found for step ${step}`);
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
      if (database) {
        console.log('Retrying image load with available database');
        loadImageForStep(step, database, setCurrentImage);
      }
    }, 100);
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
