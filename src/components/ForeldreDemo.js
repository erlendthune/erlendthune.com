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

const ForeldreDemo = () => {
  const [db, setDb] = useState(null);
  const [message, setMessage] = useState("Vent, laster inn...");
  const [qrCode, setQrCode] = useState(""); // Store QR code
  const [image, setImage] = useState(null); // Store the uploaded image
  const [databaseContent, setDatabaseContent] = useState([]); // Store database content

  // Initialize the SQLite database with WebAssembly
  const initDb = async () => {
    const config = {
      locateFile: () => "/garmin/sql-wasm.wasm", // Correct path to the .wasm file
    };

    try {
      // Dynamically load sql-wasm.js if not already loaded
      await loadSqlJsScript("/garmin/sql-wasm.js");
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
      setMessage("Klar til å legge til QR-koder!");
      updateDatabaseContent(newDb);
    } catch (error) {
      console.error('Error initializing sql.js:', error);
      setMessage("Feil ved innlasting av databasen.");
    }
  };

  // Handle image file input and convert it to Base64 string
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result); // Store the Base64 result
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle the saving of the QR code and image to the database
  const handleSave = () => {
    if (!qrCode || !image || !db) {
      setMessage("Fyll ut alle feltene!");
      return;
    }

    // Insert the QR code and image into the database
    db.run(
      `INSERT INTO steg (qrkode, bilde_base64) VALUES (?, ?)`,
      [qrCode, image]
    );

    // Save the database to localStorage
    saveDatabaseToLocalStorage(db);

    // Fetch all rows from the 'steg' table to show the content
    updateDatabaseContent(db);

    // Display a message to the user
    setMessage(`QR-kode ${qrCode} og bilde lagret!`);
    setQrCode(""); // Reset QR code field
    setImage(null); // Reset image field
  };

  // Save the database to localStorage
  const saveDatabaseToLocalStorage = (db) => {
    const binaryArray = db.export(); // Export the database as a binary array
    const base64 = btoa(String.fromCharCode(...new Uint8Array(binaryArray))); // Convert binary to base64
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

  return (
    <div>
      <h1>Foreldre - Legg til QR-kode og bilde</h1>
      <p>{message}</p>

      <div>
        <label>
          QR-kode (steg nummer):
          <input
            type="text"
            value={qrCode}
            onChange={(e) => setQrCode(e.target.value)}
            placeholder="F.eks. 1, 2, 3..."
          />
        </label>
      </div>

      <div>
        <label>
          Last opp bilde:
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
          />
        </label>
      </div>

      {image && (
        <div>
          <h3>Forhåndsvisning av bilde:</h3>
          <img src={image} alt="Forhåndsvisning" width="100" />
        </div>
      )}

      <div>
        <button onClick={handleSave}>Lagre QR-kode og bilde</button>
      </div>

      {/* Display the contents of the database */}
      <h2>Innhold i databasen:</h2>
      <table>
        <thead>
          <tr>
            <th>QR-kode</th>
            <th>Bilde (Base64)</th>
          </tr>
        </thead>
        <tbody>
          {databaseContent.length === 0 ? (
            <tr>
              <td colSpan="2">Ingen data tilgjengelig</td>
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
    </div>
  );
};

export default ForeldreDemo;
