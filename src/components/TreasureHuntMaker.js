import React, { useState, useEffect } from 'react';
import QRScannerWithSnapshot from './QRScannerWithSnapshot';
import DatabaseDisplay from './DatabaseDisplay';
import QRCodeScannerSection from './QRCodeScannerSection';
import { saveDatabaseToLocalStorage, updateDatabaseContent } from './DatabaseManager';

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



const TreasureHuntMaker = () => {
  const [db, setDb] = useState(null);
  const [message, setMessage] = useState("Vent, laster inn...");
  const [qrCode, setQrCode] = useState(""); // Store QR code
  const [image, setImage] = useState(null); // Store the uploaded image
  const [databaseContent, setDatabaseContent] = useState([]); // Store database content
  const [showScanner, setShowScanner] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [nextQRNumber, setNextQRNumber] = useState(1); // Track next QR number
  


  // Handle QR code scanning


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
      updateDatabaseContent(db, setDatabaseContent, setNextQRNumber);

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
      updateDatabaseContent(newDb, setDatabaseContent, setNextQRNumber);
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
    updateDatabaseContent(db, setDatabaseContent, setNextQRNumber);

    // Reset fields
    setQrCode("");
    setImage(null);
    setSnapshot(null);
    setShowScanner(false);
  };

  // Run initialization when the component mounts
  useEffect(() => {
    initDb();
  }, []);

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 24, background: 'var(--ifm-background-color)', color: 'var(--ifm-font-color-base)', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
      <h1 style={{ textAlign: 'center' }}>Scan QR Code and Take Snapshot</h1>
      <p>{message}</p>

      <QRCodeScannerSection 
        showScanner={showScanner}
        setShowScanner={setShowScanner}
        qrCode={qrCode}
        setQrCode={setQrCode}
        setSnapshot={setSnapshot}
        setImage={setImage}
        setMessage={setMessage}
      />

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

      <DatabaseDisplay 
        databaseContent={databaseContent}
        setDb={setDb}
        setMessage={setMessage}
        setDatabaseContent={setDatabaseContent}
        setQrCode={setQrCode}
        setImage={setImage}
        setSnapshot={setSnapshot}
        setShowScanner={setShowScanner}
        setNextQRNumber={setNextQRNumber}
      />
    </div>
  );
};

export default TreasureHuntMaker;
