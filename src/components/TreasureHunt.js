import { useState, useEffect } from 'react';
import HuntModeSelector from './HuntModeSelector';
import ProgressIndicator from './ProgressIndicator';
import TreasureImage from './TreasureImage';
import QRScannerSection from './QRScannerSection';
import { 
  initializeDatabase, 
  loadImageForStep, 
  shuffleArray, 
  getCurrentSequence, 
  getExpectedQRCode, 
  handleQRCodeScanned as handleQRScan, 
  startGame as startGameLogic 
} from './DatabaseManager';

const TreasureHunt = ({ showScannedCode = false }) => {
  const [db, setDb] = useState(null);
  const [currentStep, setCurrentStep] = useState(1); // Current treasure hunt step
  const [currentImage, setCurrentImage] = useState(null); // Current location image to show
  const [scannedCodes, setScannedCodes] = useState([]); // Track scanned codes
  const [treasureSequence, setTreasureSequence] = useState([]); // All available treasures
  const [gameComplete, setGameComplete] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [huntMode, setHuntMode] = useState('sequential'); // 'sequential' or 'random'
  const [gameStarted, setGameStarted] = useState(false);
  const [shuffledSequence, setShuffledSequence] = useState([]); // For random mode


  const handleQRCodeScanned = (code) => {
    const setters = {
      setLastScannedCode,
      setScannedCodes,
      setCurrentStep,
      setGameComplete,
      setCurrentImage
    };
    
    handleQRScan(
      code,
      currentStep,
      huntMode,
      shuffledSequence,
      treasureSequence,
      scannedCodes,
      db,
      setters
    );
  };





  // Start the game with selected mode
  const startGame = () => {
    const setters = {
      setGameStarted,
      setCurrentStep,
      setScannedCodes,
      setLastScannedCode,
      setGameComplete,
      setShuffledSequence,
      setCurrentImage
    };
    
    startGameLogic(huntMode, treasureSequence, db, setters);
  };



  // Load sql.js and open the database
  useEffect(() => {
    const loadImageCallback = (step, database) => {
      loadImageForStep(step, database, setCurrentImage);
    };
    
    initializeDatabase(setDb, setCurrentImage, setTreasureSequence, loadImageCallback);
  }, []);

  const handleStartNewHunt = () => {
    window.location.reload();
  };

  // Helper functions for child components
  const getCurrentSequenceHelper = () => {
    return getCurrentSequence(huntMode, shuffledSequence, treasureSequence);
  };

  return (
    <div style={{ maxWidth: 500, margin: '0px auto', padding: 20, background: 'var(--ifm-background-color)', color: 'var(--ifm-font-color-base)', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 20 }}>Treasure Hunt</h2>
      
      {/* Hunt mode selection - show before game starts */}
      {!gameStarted && treasureSequence.length > 0 && currentImage !== 'NO_DATA' && currentImage !== 'ERROR' && (
        <HuntModeSelector 
          huntMode={huntMode}
          setHuntMode={setHuntMode}
          onStartGame={startGame}
          treasureCount={treasureSequence.length}
        />
      )}
      
      {/* Progress indicator */}
      <ProgressIndicator 
        gameStarted={gameStarted}
        gameComplete={gameComplete}
        scannedCodes={scannedCodes}
        treasureSequence={treasureSequence}
        huntMode={huntMode}
        getCurrentSequence={getCurrentSequenceHelper}
      />

      {/* Treasure image display - only show when game has started */}
      {gameStarted && (
        <TreasureImage 
          currentImage={currentImage}
          currentStep={currentStep}
          gameComplete={gameComplete}
          scannedCodes={scannedCodes}
          onStartNewHunt={handleStartNewHunt}
        />
      )}

      {/* QR Scanner and feedback section - only show when game has started */}
      {gameStarted && (
        <QRScannerSection 
          gameComplete={gameComplete}
          lastScannedCode={lastScannedCode}
          handleQRCodeScanned={handleQRCodeScanned}
          scannedCodes={scannedCodes}
          currentStep={currentStep}
          showScannedCode={showScannedCode}
        />
      )}
    </div>
  );
};

export default TreasureHunt;
