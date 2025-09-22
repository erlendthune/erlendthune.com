import React from 'react';
import { saveDatabaseToLocalStorage, updateDatabaseContent, deleteFromDatabase, reorderDatabaseItems } from './DatabaseManager';

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

  const handleMoveUp = (index) => {
    if (index > 0) {
      reorderDatabaseItems(db, index, index - 1, databaseContent, setMessage, setDatabaseContent, setNextQRNumber);
    }
  };

  const handleMoveDown = (index) => {
    if (index < databaseContent.length - 1) {
      reorderDatabaseItems(db, index, index + 1, databaseContent, setMessage, setDatabaseContent, setNextQRNumber);
    }
  };

  return (
    <>
      {/* Display the contents of the database */}
      <h2>Image database:</h2>
      <table>
        <thead>
          <tr>
            <th>Actions</th>
            <th>QR-code</th>
            <th>Image (Base64)</th>
            <th>Order</th>
          </tr>
        </thead>
        <tbody>
          {databaseContent.length === 0 ? (
            <tr>
              <td colSpan="4">The database is empty</td>
            </tr>
          ) : (
            databaseContent.map(([qrkode, bilde_base64], index) => (
              <tr key={index}>
                <td style={{ textAlign: 'center' }}>
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
                <td>{qrkode}</td>
                <td>
                  <img src={bilde_base64} alt={`Bilde ${qrkode}`} width="50" />
                </td>
                <td style={{ textAlign: 'center', padding: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        border: 'none',
                        background: index === 0 ? '#bdc3c7' : '#3498db',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        minWidth: '28px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 4px rgba(52, 152, 219, 0.08)',
                        transition: 'background 0.2s',
                      }}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === databaseContent.length - 1}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        border: 'none',
                        background: index === databaseContent.length - 1 ? '#bdc3c7' : '#2ecc71',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        cursor: index === databaseContent.length - 1 ? 'not-allowed' : 'pointer',
                        minWidth: '28px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 4px rgba(46, 204, 113, 0.08)',
                        transition: 'background 0.2s',
                      }}
                    >
                      ↓
                    </button>
                  </div>
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
