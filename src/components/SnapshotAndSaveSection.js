import React from 'react';

const SnapshotAndSaveSection = ({
  snapshot,
  setSnapshot,
  image,
  setImage,
  qrCode,
  nextQRNumber,
  handleSave,
  handleSaveFinalTreasure
}) => {
  return (
    <>
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
    </>
  );
};

export default SnapshotAndSaveSection;
