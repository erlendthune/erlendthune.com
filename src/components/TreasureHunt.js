import React, { useRef, useState, useEffect } from 'react';
import jsQR from 'jsqr';

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
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [scannedCode, setScannedCode] = useState('');
  const [imageData, setImageData] = useState(null);
  const [db, setDb] = useState(null);

  // Load sql.js and open the database (same logic as ForeldreDemo)
  useEffect(() => {
    const loadDb = async () => {
      const config = { locateFile: () => "/sql/sql-wasm.wasm" };
      await loadSqlJsScript("/sql/sql-wasm.js");
      const SQL = await window.initSqlJs(config);
      const savedDb = localStorage.getItem('sqlite-db');
      let newDb;
      if (savedDb) {
        const binaryArray = new Uint8Array(atob(savedDb).split('').map(char => char.charCodeAt(0)));
        newDb = new SQL.Database(binaryArray);
      } else {
        newDb = new SQL.Database();
        newDb.run(`CREATE TABLE IF NOT EXISTS steg (qrkode TEXT PRIMARY KEY, bilde_base64 TEXT);`);
      }
      setDb(newDb);
    };
    loadDb();
  }, []);

  // Start camera and scan QR code
  useEffect(() => {
    let animationId;
    let streamRef = null;
    const startCamera = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', true);
          videoRef.current.play();
        }
        const scan = () => {
          if (videoRef.current && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
            const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code && code.data) {
              setScannedCode(code.data);
            }
          }
          animationId = requestAnimationFrame(scan);
        };
        scan();
      }
    };
    startCamera();
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      if (streamRef) {
        streamRef.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // When scannedCode changes, fetch image from DB
  useEffect(() => {
    if (db && scannedCode) {
      try {
        const stmt = db.prepare('SELECT bilde_base64 FROM steg WHERE qrkode = ?');
        stmt.bind([scannedCode]);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          setImageData(row.bilde_base64); // This is a full data URL
        } else {
          setImageData(null);
        }
        stmt.free();
      } catch (e) {
        setImageData(null);
      }
    }
  }, [db, scannedCode]);

  return (
    <div style={{ maxWidth: 500, margin: '0px auto', padding: 0, background: 'var(--ifm-background-color)', color: 'var(--ifm-font-color-base)', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
      <h2 style={{ textAlign: 'center' }}>Treasure Hunt</h2>
      <video ref={videoRef} style={{ width: 320, height: 240 }} />
      <canvas ref={canvasRef} width={320} height={240} style={{ display: 'none' }} />
      {showScannedCode && <div>Scanned code: {scannedCode}</div>}
      {imageData ? (
        <div>
          <h3>Location</h3>
          <img src={imageData} alt={`Bilde for kode ${scannedCode}`} style={{ maxWidth: '100%' }} />
        </div>
      ) : scannedCode ? (
        <div>Could not find image for code {scannedCode}.</div>
      ) : null}
    </div>
  );
};

export default TreasureHunt;
