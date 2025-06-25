import React from 'react';
import TreasureHunt from '../components/TreasureHunt';

export default function TreasureHuntStandalone() {
  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
      <h1 style={{ textAlign: 'center' }}>Treasure Hunt</h1>
      <TreasureHunt />
    </div>
  );
}
