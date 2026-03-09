import React from 'react';
import styles from './styles.module.css';

export default function ResultDisplay({ product, onReset }) {
  const allergens = product.allergens_tags || [];
  const ingredientsAnalysis = product.ingredients_analysis_tags || [];

  // Logic Mapping: Gluten
  const isGlutenFree = allergens.includes('en:gluten-free') || ingredientsAnalysis.includes('en:gluten-free') || ingredientsAnalysis.includes('en:gluten-free-ingredients');
  const hasGluten = allergens.includes('en:gluten') || ingredientsAnalysis.includes('en:gluten');
  const glutenStatus = isGlutenFree ? 'Gluten-Free' : (hasGluten ? 'Contains Gluten' : 'Unknown / Non-certified');
  
  const glutenClass = isGlutenFree ? styles.safe : (hasGluten ? styles.warning : styles.unknown);

  // Logic Mapping: Lactose
  const hasLactose = allergens.includes('en:milk') || allergens.includes('en:lactose');
  const lactoseStatus = hasLactose ? 'Contains Dairy / Lactose' : 'Likely Lactose-Free';
  
  const lactoseClass = hasLactose ? styles.warning : styles.safe;

  // Logic Mapping: Ultra-Processed (NOVA)
  const novaGroup = product.nova_group;
  const novaStatus = novaGroup ? `NOVA ${novaGroup}` : 'Unknown';
  let novaClass = styles.unknown;
  if (novaGroup === 1 || novaGroup === 2) {
    novaClass = styles.safe;
  } else if (novaGroup === 4 || novaGroup === 3) {
    novaClass = styles.warning;
  }

  return (
    <div className={styles.resultContainer}>
      <h2>{product.product_name || 'Unknown Product Name'}</h2>
      {product.brands && <p><strong>Brand:</strong> {product.brands}</p>}
      
      <div className={styles.cardContainer}>
        {/* Gluten Status */}
        <div className={`${styles.card} ${glutenClass}`}>
          <h3>Gluten</h3>
          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.2rem' }}>{glutenStatus}</p>
        </div>

        {/* Lactose Status */}
        <div className={`${styles.card} ${lactoseClass}`}>
          <h3>Lactose</h3>
          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.2rem' }}>{lactoseStatus}</p>
        </div>

        {/* Processing Level */}
        <div className={`${styles.card} ${novaClass}`}>
          <h3>Processing</h3>
          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.2rem' }}>{novaStatus}</p>
          {novaGroup === 4 && <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>(Ultra-processed)</p>}
        </div>
      </div>

      <button className={styles.button} onClick={onReset}>
        Scan Another Barcode
      </button>
    </div>
  );
}
