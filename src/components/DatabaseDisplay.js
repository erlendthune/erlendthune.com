import React from 'react';
import { saveDatabaseToLocalStorage, updateDatabaseContent, deleteFromDatabase } from './DatabaseManager';

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

const DatabaseDisplay = ({ 
  databaseContent, 
  db,
  setDb, 
  setMessage, 
  setDatabaseContent, 
  setQrCode, 
  setImage, 
  setSnapshot, 
  setShowScanner, 
  setNextQRNumber 
}) => {
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

  const handleDeleteItem = (qrkode) => {
    if (!db) {
      setMessage('Database not available');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete the item with QR code ${qrkode}?`)) {
      deleteFromDatabase(db, qrkode, setMessage, setDatabaseContent, setNextQRNumber);
    }
  };

  return (
    <>
      {/* Display the contents of the database */}
      <h2>Image database:</h2>
      <table>
        <thead>
          <tr>
            <th>QR-code</th>
            <th>Image (Base64)</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {databaseContent.length === 0 ? (
            <tr>
              <td colSpan="3">The database is empty</td>
            </tr>
          ) : (
            databaseContent.map(([qrkode, bilde_base64], index) => (
              <tr key={index}>
                <td>{qrkode}</td>
                <td>
                  <img src={bilde_base64} alt={`Bilde ${qrkode}`} width="50" />
                </td>
                <td>
                  <button
                    onClick={() => handleDeleteItem(qrkode)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 4,
                      border: 'none',
                      background: '#e74c3c',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      boxShadow: '0 1px 4px rgba(231, 76, 60, 0.08)',
                      transition: 'background 0.2s',
                    }}
                  >
                    Delete
                  </button>
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
    </>
  );
};

export default DatabaseDisplay;
