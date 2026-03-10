import React from 'react';
import styles from './styles.module.css';

export default function ResultDisplay({ product, onReset }) {
  const allergens = product.allergens_tags || [];
  const traces = product.traces_tags || [];
  const ingredientsAnalysis = product.ingredients_analysis_tags || [];
  const ingredientsText = (product.ingredients_text || '').toLowerCase();

  // Helper functions for matching
  const containsAny = (arr, items) => items.some(item => arr.includes(item));
  const textContainsAny = (text, items) => items.some(item => text.includes(item));

  // Logic Mapping: Gluten
  const glutenTags = ['en:gluten', 'en:wheat', 'en:rye', 'en:barley', 'en:oats', 'en:spelt', 'en:kamut'];
  const glutenKeywords = ['gluten', 'wheat', 'rye', 'barley', 'spelt', 'kamut'];
  
  const isGlutenFreeTagged = allergens.includes('en:gluten-free') || ingredientsAnalysis.includes('en:gluten-free') || ingredientsAnalysis.includes('en:gluten-free-ingredients');
  const hasGlutenTag = containsAny(allergens, glutenTags) || ingredientsAnalysis.includes('en:gluten') || textContainsAny(ingredientsText, glutenKeywords);
  const mayContainGluten = containsAny(traces, glutenTags);

  let glutenStatus = 'Unknown / No data';
  let glutenClass = styles.unknown;

  if (hasGlutenTag) {
    glutenStatus = 'Contains Gluten';
    glutenClass = styles.warning;
  } else if (mayContainGluten) {
    glutenStatus = 'May Contain Gluten';
    glutenClass = styles.warning;
  } else if (isGlutenFreeTagged) {
    glutenStatus = 'Gluten-Free';
    glutenClass = styles.safe;
  } else if (product.ingredients_text) {
    // If the product has an ingredients list but no gluten found, it is likely safe.
    glutenStatus = 'Likely Gluten-Free';
    glutenClass = styles.safe;
  }

  // Logic Mapping: Nuts
  const nutTags = ['en:nuts', 'en:peanuts', 'en:almonds', 'en:hazelnuts', 'en:walnuts', 'en:cashews', 'en:pecans', 'en:macadamia-nuts', 'en:brazil-nuts', 'en:pistachios'];
  const nutKeywords = ['peanut', 'almond', 'hazelnut', 'walnut', 'cashew', 'pecan', 'macadamia', 'pistachio', 'brazil nut'];

  const hasNutsTag = containsAny(allergens, nutTags) || textContainsAny(ingredientsText, nutKeywords);
  const mayContainNuts = containsAny(traces, nutTags);

  let nutsStatus = 'Unknown / No data';
  let nutsClass = styles.unknown;

  if (hasNutsTag) {
    nutsStatus = 'Contains Nuts';
    nutsClass = styles.warning;
  } else if (mayContainNuts) {
    nutsStatus = 'May Contain Nuts';
    nutsClass = styles.warning;
  } else if (product.ingredients_text) {
    // If the product has an ingredients list but no nuts found, it is likely safe.
    nutsStatus = 'Likely Nut-Free';
    nutsClass = styles.safe;
  }

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

        {/* Nuts Status */}
        <div className={`${styles.card} ${nutsClass}`}>
          <h3>Nuts</h3>
          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.2rem' }}>{nutsStatus}</p>
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
