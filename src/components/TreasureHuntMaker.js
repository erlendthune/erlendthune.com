import React, { useState, useEffect } from 'react';

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
      setMessage("Start adding QR codes and images!");
      updateDatabaseContent(newDb);
    } catch (error) {
      console.error('Error initializing sql.js:', error);
      setMessage("Could not load the database.");
    }
  };

  // Handle image file input and convert it to Base64 string
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        // ✅ Resize the image
        const maxSize = 460; // Max width or height in px
        let { width, height } = img;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // You can adjust image quality here (0.7 is often a good balance)
        const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setImage(resizedDataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  // Handle the saving of the QR code and image to the database
  const handleSave = () => {
    if (!qrCode || !image || !db) {
      setMessage("Fyll ut alle feltene!");
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
  };

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 24, background: 'var(--ifm-background-color)', color: 'var(--ifm-font-color-base)', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
      <h1 style={{ textAlign: 'center' }}>Add QR number and image</h1>
      <p>{message}</p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>
          QR-code number:
          <input
            type="text"
            value={qrCode}
            onChange={(e) => setQrCode(e.target.value)}
            placeholder="1, 2, 3..."
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              fontSize: '1rem',
              marginTop: 4,
              marginBottom: 8,
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'border 0.2s',
            }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>
          Upload image:
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{
              display: 'none',
            }}
            id="file-upload-input"
          />
          <label
            htmlFor="file-upload-input"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              borderRadius: 6,
              border: 'none',
              background: '#1976d2',
              color: '#fff',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: 'pointer',
              marginTop: 4,
              boxShadow: '0 1px 4px rgba(25, 118, 210, 0.08)',
              transition: 'background 0.2s',
            }}
          >
            Choose file
          </label>
        </label>
      </div>

      {image && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8 }}>Preview of image:</h3>
          <img src={image} alt="Preview" width="100" style={{ borderRadius: 8, boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }} />
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <button
          onClick={handleSave}
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
          Save QR-code and image
        </button>
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
