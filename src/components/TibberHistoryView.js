import React, { useState, useEffect } from 'react';
import styles from './TibberDashboard.module.css';
import { getMonthViolations, clearAllData } from './PowerMonitorDB';

export default function TibberHistoryView({ db, onClose }) {
    const [monthOffset, setMonthOffset] = useState(0);
    const [violations, setViolations] = useState([]);

    const getMonthString = (offset) => {
        const d = new Date();
        d.setMonth(d.getMonth() + offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const getMonthName = (offset) => {
        const d = new Date();
        d.setMonth(d.getMonth() + offset);
        return d.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' });
    };

    useEffect(() => {
        if (!db) return;
        const monthStr = getMonthString(monthOffset);
        const data = getMonthViolations(db, monthStr);
        setViolations(data);
    }, [db, monthOffset]);

    const handleClearData = () => {
        if (window.confirm('Er du sikker på at du vil slette all historikk?')) {
            if (db) {
                clearAllData(db);
                setViolations([]);
            }
        }
    };

    return (
        <div className={styles.adminView}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Historikk - Overtredelser</h2>
                <button className={styles.btn} onClick={onClose}>
                    🔙 Lukk
                </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: 'rgba(255, 255, 255, 0.1)', padding: '10px', borderRadius: '8px' }}>
                <button className={styles.btn} onClick={() => setMonthOffset(prev => prev - 1)}>
                    &lt; Forrige
                </button>
                <h3 style={{ margin: 0 }}>{getMonthName(monthOffset)}</h3>
                <button 
                    className={styles.btn} 
                    onClick={() => setMonthOffset(prev => prev + 1)}
                    disabled={monthOffset >= 0}
                    style={{ opacity: monthOffset >= 0 ? 0.5 : 1 }}
                >
                    Neste &gt;
                </button>
            </div>

            <div style={{ background: 'white', borderRadius: '8px', padding: '15px', color: 'black' }}>
                <h4 style={{ marginTop: 0 }}>Overtredelser ({violations.length})</h4>
                
                {violations.length === 0 ? (
                    <p style={{ color: '#666' }}>Ingen overtredelser / feil ble registrert denne måneden.</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                                <th style={{ padding: '8px' }}>Dato</th>
                                <th style={{ padding: '8px' }}>Tid</th>
                                <th style={{ padding: '8px' }}>Snitt (kW)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {violations.map((v, i) => {
                                const d = new Date(v.hour_start);
                                return (
                                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '8px' }}>{v.date}</td>
                                        <td style={{ padding: '8px' }}>{d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td style={{ padding: '8px', color: '#cc0000', fontWeight: 'bold' }}>{v.projected_avg.toFixed(2)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>
            
            <div style={{ marginTop: '30px', textAlign: 'right' }}>
                <button className={`${styles.btn}`} onClick={handleClearData} style={{ background: '#cc0000', color: 'white', borderColor: '#cc0000' }}>
                    🗑️ Slett all historikk
                </button>
            </div>
        </div>
    );
}
