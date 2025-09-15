import React, { useState, useEffect, useRef } from 'react';
import QRScannerWithSnapshot from './QRScannerWithSnapshot';

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

// Utility function to safely convert Uint8Array to base64
function uint8ToBase64(uint8) {
  let CHUNK_SIZE = 0x8000; // 32k
  let index = 0;
  let length = uint8.length;
  let result = '';
  let slice;
  while (index < length) {
    slice = uint8.subarray(index, Math.min(index + CHUNK_SIZE, length));
    result += String.fromCharCode.apply(null, slice);
    index += CHUNK_SIZE;
  }
  return btoa(result);
}

const TreasureHuntMaker = () => {
  const [db, setDb] = useState(null);
  const [message, setMessage] = useState("Vent, laster inn...");
  const [qrCode, setQrCode] = useState(""); // Store QR code
  const [image, setImage] = useState(null); // Store the uploaded image
  const [databaseContent, setDatabaseContent] = useState([]); // Store database content
  const [showScanner, setShowScanner] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [nextQRNumber, setNextQRNumber] = useState(1); // Track next QR number
  
  const scannerRef = useRef(null);

  // Handle QR code scanning
  const handleQRCodeScanned = (code) => {
    setQrCode(code);
    setMessage(`QR code scanned: ${code}`);
  };

  // Handle taking a snapshot
  const handleTakeSnapshot = () => {
    if (scannerRef.current) {
      const snapshotData = scannerRef.current.takeSnapshot();
      if (snapshotData) {
        setSnapshot(snapshotData);
        setImage(snapshotData); // Set as the image to save
        setMessage("Snapshot taken! You can now save the QR code and image.");
      }
    }
  };

  // Calculate the next QR number based on existing data
  const calculateNextQRNumber = () => {
    if (databaseContent.length === 0) return 1;
    const numbers = databaseContent.map(([qrkode]) => parseInt(qrkode)).filter(n => !isNaN(n));
    return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  };

  // Handle saving final treasure image (without QR code)
  const handleSaveFinalTreasure = () => {
    if (!image || !db) {
      setMessage("Please take a snapshot of the treasure location first!");
      return;
    }

    const finalQRNumber = calculateNextQRNumber();
    
    try {
      // Save the final treasure image with the next QR number
      db.run(
        `INSERT INTO steg (qrkode, bilde_base64) VALUES (?, ?)`,
        [finalQRNumber.toString(), image]
      );
      setMessage(`Final treasure location saved as entry ${finalQRNumber}! This is where the treasure is hidden (no QR code needed).`);

      // Save the database to localStorage
      saveDatabaseToLocalStorage(db);

      // Update database content display
      updateDatabaseContent(db);

      // Reset fields
      setSnapshot(null);
      setImage(null);
      setShowScanner(false);
    } catch (error) {
      console.error('Error saving final treasure:', error);
      setMessage("Error saving final treasure location.");
    }
  };

  // Initialize the SQLite database with WebAssembly
  const initDb = async () => {
    const config = {
      locateFile: () => "/sql/sql-wasm.wasm", // Correct path to the .wasm file
    };

    try {
      // Dynamically load sql-wasm.js if not already loaded
      await loadSqlJsScript("/sql/sql-wasm.js");
      const SQL = await window.initSqlJs(config); // Use window.initSqlJs to load sql.js
      console.log("sql.js initialized 🎉");

      let newDb;

      // Check if the database exists in localStorage
      const savedDb = localStorage.getItem('sqlite-db');
      if (savedDb) {
        // If it exists, load the database from localStorage
        const binaryArray = new Uint8Array(atob(savedDb).split('').map(char => char.charCodeAt(0)));
        newDb = new SQL.Database(binaryArray);
        console.log('Database loaded from localStorage');
      } else {
        // Otherwise, create a new in-memory database
        newDb = new SQL.Database();
        newDb.run(`
          CREATE TABLE IF NOT EXISTS steg (
            qrkode TEXT PRIMARY KEY,
            bilde_base64 TEXT
          );
        `);
      }

      setDb(newDb);
      setMessage("Start scanning QR codes and taking snapshots!");
      updateDatabaseContent(newDb);
    } catch (error) {
      console.error('Error initializing sql.js:', error);
      setMessage("Could not load the database.");
    }
  };

  // Handle the saving of the QR code and image to the database
  const handleSave = () => {
    if (!qrCode || !image || !db) {
      setMessage("Please scan a QR code and take a snapshot first!");
      return;
    }

    // Check if the QR code already exists
    const checkStmt = db.prepare('SELECT COUNT(*) as count FROM steg WHERE qrkode = ?');
    checkStmt.bind([qrCode]);
    let exists = false;
    if (checkStmt.step()) {
      const row = checkStmt.getAsObject();
      exists = row.count > 0;
    }
    checkStmt.free();

    if (exists) {
      // Update the image for the existing QR code
      db.run(
        `UPDATE steg SET bilde_base64 = ? WHERE qrkode = ?`,
        [image, qrCode]
      );
      setMessage(`QR-kode ${qrCode} oppdatert med nytt bilde!`);
    } else {
      // Insert the QR code and image into the database
      db.run(
        `INSERT INTO steg (qrkode, bilde_base64) VALUES (?, ?)`,
        [qrCode, image]
      );
      setMessage(`QR-kode ${qrCode} og bilde lagret!`);
    }

    // Save the database to localStorage
    saveDatabaseToLocalStorage(db);

    // Fetch all rows from the 'steg' table to show the content
    updateDatabaseContent(db);

    // Reset fields
    setQrCode("");
    setImage(null);
    setSnapshot(null);
    setShowScanner(false);
  };

  // Save the database to localStorage
  const saveDatabaseToLocalStorage = (db) => {
    const binaryArray = db.export(); // Export the database as a binary array
    const base64 = uint8ToBase64(new Uint8Array(binaryArray)); // Use chunked conversion
    localStorage.setItem('sqlite-db', base64); // Store the base64 string in localStorage
    console.log('Database saved to localStorage');
  };

  // Fetch and display the database content
  const updateDatabaseContent = (db) => {
    const rows = db.exec("SELECT * FROM steg");
    const content = rows[0] ? rows[0].values : []; // Ensure there's a result before accessing values
    setDatabaseContent(content);
    
    // Update next QR number
    if (content.length === 0) {
      setNextQRNumber(1);
    } else {
      const numbers = content.map(([qrkode]) => parseInt(qrkode)).filter(n => !isNaN(n));
      setNextQRNumber(numbers.length > 0 ? Math.max(...numbers) + 1 : 1);
    }
  };

  // Run initialization when the component mounts
  useEffect(() => {
    initDb();
  }, []);

  // Clear the database
  const handleClearDatabase = async () => {
    localStorage.removeItem('sqlite-db');
    setMessage('Databasen er tømt.');
    // Recreate empty database
    const config = { locateFile: () => "/sql/sql-wasm.wasm" };
    await loadSqlJsScript("/sql/sql-wasm.js");
    const SQL = await window.initSqlJs(config);
    const newDb = new SQL.Database();
    newDb.run(`CREATE TABLE IF NOT EXISTS steg (qrkode TEXT PRIMARY KEY, bilde_base64 TEXT);`);
    setDb(newDb);
    setDatabaseContent([]);
    setQrCode("");
    setImage(null);
    setSnapshot(null);
    setShowScanner(false);
    setNextQRNumber(1);
  };

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 24, background: 'var(--ifm-background-color)', color: 'var(--ifm-font-color-base)', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
      <h1 style={{ textAlign: 'center' }}>Scan QR Code and Take Snapshot</h1>
      <p>{message}</p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>
          QR-code scanner:
        </label>
        
        {!showScanner ? (
          <button
            onClick={() => setShowScanner(true)}
            style={{
              padding: '10px 20px',
              borderRadius: 6,
              border: 'none',
              background: '#1976d2',
              color: '#fff',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: 'pointer',
              marginRight: 12,
              boxShadow: '0 1px 4px rgba(25, 118, 210, 0.08)',
              transition: 'background 0.2s',
            }}
          >
            Start QR Scanner
          </button>
        ) : (
          <div>
            <QRScannerWithSnapshot 
              ref={scannerRef}
              onQRCodeScanned={handleQRCodeScanned}
              width={320}
              height={240}
            />
            <div style={{ marginTop: 10 }}>
              <button
                onClick={handleTakeSnapshot}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#4caf50',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  marginRight: 8,
                  boxShadow: '0 1px 4px rgba(76, 175, 80, 0.08)',
                  transition: 'background 0.2s',
                }}
              >
                Take Snapshot
              </button>
              <button
                onClick={() => setShowScanner(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#757575',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(117, 117, 117, 0.08)',
                  transition: 'background 0.2s',
                }}
              >
                Stop Scanner
              </button>
            </div>
          </div>
        )}
        
        {qrCode && (
          <div style={{ marginTop: 10, padding: 10, background: '#f5f5f5', borderRadius: 6 }}>
            <strong>Scanned QR Code:</strong> {qrCode}
          </div>
        )}
      </div>

      {snapshot && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ padding: 10, background: '#e8f5e8', borderRadius: 6, marginBottom: 10 }}>
            <strong>✓ Snapshot taken from camera</strong>
          </div>
          <button
            onClick={() => {
              setSnapshot(null);
              setImage(null);
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#ff9800',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(255, 152, 0, 0.08)',
              transition: 'background 0.2s',
            }}
          >
            Clear Snapshot
          </button>
        </div>
      )}

      {image && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8 }}>Preview of snapshot:</h3>
          <img src={image} alt="Preview" width="200" style={{ borderRadius: 8, boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }} />
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 10 }}>Save Options:</h4>
          <p style={{ fontSize: '0.9em', color: 'var(--ifm-color-emphasis-600)', marginBottom: 15 }}>
            Choose how to save this location:
          </p>
        </div>
        
        {/* Regular QR location save */}
        <button
          onClick={handleSave}
          disabled={!qrCode || !image}
          style={{
            padding: '10px 20px',
            borderRadius: 6,
            border: 'none',
            background: qrCode && image ? '#1976d2' : '#ccc',
            color: '#fff',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: qrCode && image ? 'pointer' : 'not-allowed',
            marginRight: 12,
            marginBottom: 8,
            boxShadow: '0 1px 4px rgba(25, 118, 210, 0.08)',
            transition: 'background 0.2s',
          }}
          title={!qrCode ? 'Scan a QR code first' : !image ? 'Take a snapshot first' : 'Save as regular hunt location'}
        >
          Save as Hunt Location {qrCode ? `(QR: ${qrCode})` : ''}
        </button>
        
        <br />
        
        {/* Final treasure save */}
        <button
          onClick={handleSaveFinalTreasure}
          disabled={!image}
          style={{
            padding: '10px 20px',
            borderRadius: 6,
            border: 'none',
            background: image ? '#ff9800' : '#ccc',
            color: '#fff',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: image ? 'pointer' : 'not-allowed',
            boxShadow: '0 1px 4px rgba(255, 152, 0, 0.08)',
            transition: 'background 0.2s',
          }}
          title={!image ? 'Take a snapshot first' : 'Save as final treasure location (no QR code needed)'}
        >
          Save as Final Treasure (#{nextQRNumber})
        </button>
        
        <div style={{ marginTop: 10, fontSize: '0.8em', color: 'var(--ifm-color-emphasis-600)' }}>
          💡 <strong>Tip:</strong> Save hunt locations first (with QR codes), then save the final treasure location last (no QR code).
        </div>
      </div>

      {/* Display the contents of the database */}
      <h2>Image database:</h2>
      <table>
        <thead>
          <tr>
            <th>QR-code</th>
            <th>Image (Base64)</th>
          </tr>
        </thead>
        <tbody>
          {databaseContent.length === 0 ? (
            <tr>
              <td colSpan="2">The database is empty</td>
            </tr>
          ) : (
            databaseContent.map(([qrkode, bilde_base64], index) => (
              <tr key={index}>
                <td>{qrkode}</td>
                <td>
                  <img src={bilde_base64} alt={`Bilde ${qrkode}`} width="50" />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div style={{ margin: '24px 0' }}>
        <button
          onClick={handleClearDatabase}
          style={{
            padding: '10px 20px',
            borderRadius: 6,
            border: 'none',
            background: '#e74c3c',
            color: '#fff',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(231, 76, 60, 0.08)',
            transition: 'background 0.2s',
          }}
        >
          Clear database
        </button>
      </div>
    </div>
  );
};

export default TreasureHuntMaker;
