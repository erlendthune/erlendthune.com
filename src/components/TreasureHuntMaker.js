import React, { useState, useEffect } from 'react';
import TreasureHuntMakerLayout from './TreasureHuntMakerLayout';
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
    <TreasureHuntMakerLayout 
      message={message}
      showScanner={showScanner}
      setShowScanner={setShowScanner}
      qrCode={qrCode}
      setQrCode={setQrCode}
      setSnapshot={setSnapshot}
      setImage={setImage}
      setMessage={setMessage}
      snapshot={snapshot}
      image={image}
      nextQRNumber={nextQRNumber}
      handleSave={handleSave}
      handleSaveFinalTreasure={handleSaveFinalTreasure}
      databaseContent={databaseContent}
      setDb={setDb}
      setDatabaseContent={setDatabaseContent}
      setNextQRNumber={setNextQRNumber}
    />
  );
};

export default TreasureHuntMaker;
