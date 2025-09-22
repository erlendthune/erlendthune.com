import React from 'react';
import QRCodeScannerSection from './QRCodeScannerSection';
import SnapshotAndSaveSection from './SnapshotAndSaveSection';
import DatabaseDisplay from './DatabaseDisplay';

const TreasureHuntMakerLayout = ({
  message,
  showScanner,
  setShowScanner,
  qrCode,
  setQrCode,
  setSnapshot,
  setImage,
  setMessage,
  snapshot,
  image,
  nextQRNumber,
  handleSave,
  handleSaveFinalTreasure,
  databaseContent,
  db,
  setDb,
  setDatabaseContent,
  setShowScanner: setShowScannerProp,
  setNextQRNumber
}) => {
  return (
    <div style={{ 
      maxWidth: 500, 
      margin: '40px auto', 
      padding: 24, 
      background: 'var(--ifm-background-color)', 
      color: 'var(--ifm-font-color-base)', 
      borderRadius: 12, 
      boxShadow: '0 2px 16px rgba(0,0,0,0.08)' 
    }}>
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

      <SnapshotAndSaveSection 
        snapshot={snapshot}
        setSnapshot={setSnapshot}
        image={image}
        setImage={setImage}
        qrCode={qrCode}
        nextQRNumber={nextQRNumber}
        handleSave={handleSave}
        handleSaveFinalTreasure={handleSaveFinalTreasure}
      />

      <DatabaseDisplay 
        databaseContent={databaseContent}
        db={db}
        setDb={setDb}
        setMessage={setMessage}
        setDatabaseContent={setDatabaseContent}
        setQrCode={setQrCode}
        setImage={setImage}
        setSnapshot={setSnapshot}
        setShowScanner={setShowScannerProp}
        setNextQRNumber={setNextQRNumber}
      />
    </div>
  );
};

export default TreasureHuntMakerLayout;
