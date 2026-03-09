import React, { useState, useEffect } from 'react';
import Layout from '@theme/Layout';
import ScannerView from '../components/FoodScanner/ScannerView';
import ResultDisplay from '../components/FoodScanner/ResultDisplay';

export default function FoodScanner() {
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');

  // Disclaimer states
  const [isClient, setIsClient] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const agreed = localStorage.getItem('foodScannerDisclaimerAgreed');
    if (agreed === 'true') {
      setDisclaimerAccepted(true);
    }
  }, []);

  const handleAcceptDisclaimer = () => {
    localStorage.setItem('foodScannerDisclaimerAgreed', 'true');
    setDisclaimerAccepted(true);
  };

  const handleDetected = async (barcode) => {
    // Prevent multiple fetches for the same trigger
    if (!scanning || loading) return;

    setScanning(false);
    setLoading(true);
    setError('');

    // Some QR codes/Barcodes contain a URL with the EAN at the end (GS1 Digital Link)
    let finalBarcode = barcode;
    if (barcode.includes('http')) {
      const parts = barcode.split('/');
      finalBarcode = parts[parts.length - 1]; // Extract the last part which is typically the EAN/GTIN
      // If the extracted part is longer than a standard barcode (e.g. 14 digits padding), strip leading zero
      if (finalBarcode.length > 13 && finalBarcode.startsWith('0')) {
        finalBarcode = finalBarcode.substring(1);
      }
    }

    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${finalBarcode}.json`);
      const data = await response.json();

      if (data.status === 1 && data.product) {
        setProduct(data.product);
      } else {
        setError(`Product Not Found: Barcode was ${finalBarcode} (Parsed from: ${barcode})`);
      }
    } catch (err) {
      setError('Failed to fetch product data from Open Food Facts.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setProduct(null);
    setError('');
    setScanning(true);
  };

  if (!isClient) {
    return (
      <Layout title="Food Scanner">
        <main style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Loading...</p>
        </main>
      </Layout>
    );
  }

  if (!disclaimerAccepted) {
    return (
      <Layout title="Food Scanner Disclaimer">
        <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', minHeight: '80vh' }}>
          <div style={{ backgroundColor: 'var(--ifm-background-surface-color)', padding: '2rem', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', border: '1px solid var(--ifm-color-emphasis-200)' }}>
            <h1 style={{ textAlign: 'center', color: '#d32f2f' }}>⚠️ Important Disclaimer</h1>
            <p>
              The information provided by this scanner is sourced from the <strong>Open Food Facts</strong> database, which is a collaborative, free, and open dataset built by contributors.
            </p>
            <p>
              Because this data is crowdsourced, <strong>it may contain errors, omissions, or outdated information.</strong>
            </p>
            <p style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
              Always check the physical product packaging for the most accurate ingredient and allergen information. Do not rely solely on this application for severe dietary allergies or medical conditions.
            </p>
            
            <div style={{ marginTop: '2rem', marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--ifm-color-emphasis-100)', borderRadius: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '1.1rem' }}>
                <input 
                  type="checkbox" 
                  style={{ width: '20px', height: '20px', marginRight: '10px' }}
                  checked={disclaimerChecked} 
                  onChange={(e) => setDisclaimerChecked(e.target.checked)} 
                />
                I have read and understand this disclaimer.
              </label>
            </div>

            <button 
              className={`button button--block ${disclaimerChecked ? 'button--primary' : 'button--secondary'}`} 
              disabled={!disclaimerChecked} 
              onClick={handleAcceptDisclaimer}
              style={{ padding: '12px', fontSize: '1.1rem' }}
            >
              Continue to Scanner
            </button>
          </div>
        </main>
      </Layout>
    );
  }

  return (
    <Layout 
      title="Food Scanner" 
      description="Scan food barcodes to automatically verify Gluten, Lactose, and NOVA processing levels."
    >
      <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%', minHeight: '80vh' }}>
        <h1 style={{ textAlign: 'center' }}>Food Status Scanner</h1>
        <p style={{ textAlign: 'center', marginBottom: '2rem' }}>
          Instantly check if a product is Gluten-Free, Lactose-Free, and verify its Nova processing level.
        </p>

        {scanning && <ScannerView onDetected={handleDetected} />}

        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="button button--secondary button--outline button--disabled">
              Loading product data...
            </div>
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', margin: '2rem 0', padding: '1rem', backgroundColor: '#ffebee', borderRadius: '8px' }}>
            <p style={{ color: '#d32f2f', fontWeight: 'bold' }}>{error}</p>
            <button 
              className="button button--primary" 
              onClick={handleReset} 
              style={{ padding: '10px 20px', cursor: 'pointer', marginTop: '1rem' }}
            >
              Scan Again
            </button>
          </div>
        )}

        {product && <ResultDisplay product={product} onReset={handleReset} />}
      </main>
    </Layout>
  );
}
