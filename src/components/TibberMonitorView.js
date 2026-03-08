import React from 'react';
import styles from './TibberDashboard.module.css';

export default function TibberMonitorView({
    liveStatus,
    liveData,
    currentHourStart,
    accumulatedAtHourStart,
    projectedAverage,
    monthlyViolationCount,
    alertLevel,
    switchToAdminView,
    renderAlertBanner
}) {
    const now = liveData ? new Date(liveData.timestamp) : new Date();
    const minutesRemaining = liveData ? 59 - now.getMinutes() : 0;
    
    // Calculate max allowed power
    let maxPower_kW = 0;
    let computedConsumption = 0;
    if (liveData && currentHourStart !== null) {
        const minutesElapsed = now.getMinutes() + now.getSeconds() / 60;
        const timeRemaining = 60 - minutesElapsed;
        const maxEnergyThisHour_kWh = 10;
        computedConsumption = liveData.accumulatedConsumption - accumulatedAtHourStart;
        
        const baseConsumption = liveData.accumulatedConsumptionLastHour ?? computedConsumption;
        const E_remaining_kWh = maxEnergyThisHour_kWh - baseConsumption;
        maxPower_kW = (E_remaining_kWh / (timeRemaining / 60));
    }
    
    return (
        <div className={`${styles.monitorView} ${styles[`monitor${alertLevel.charAt(0).toUpperCase()}${alertLevel.slice(1)}`]}`}>
            <div className={styles.monitorHeader}>
                <h1 className={styles.monitorTitle}>⚡ Kraftovervåking</h1>
                <button 
                    className={styles.adminButton}
                    onClick={switchToAdminView}
                >
                    ⚙️ Admin
                </button>
            </div>
            
            {liveStatus === 'connected' && liveData && currentHourStart !== null ? (
                <>
                    <div className={styles.monitorMainMetric}>
                        <div className={styles.monitorLabel}>Beregnet timesnitt</div>
                        <div className={styles.monitorValue}>
                            {projectedAverage.toFixed(2)}
                            <span className={styles.monitorUnit}>kW</span>
                        </div>
                        <div className={styles.monitorLimit}>Grense: 10 kW</div>
                    </div>
                    
                    <div className={styles.monitorStats}>
                        <div className={styles.monitorStat}>
                            <div className={styles.monitorStatLabel}>Nåværende effekt</div>
                            <div className={styles.monitorStatValue}>
                                {(liveData.power / 1000).toFixed(2)} kW
                            </div>
                        </div>

                        <div className={styles.monitorStat}>
                            <div className={styles.monitorStatLabel}>Vår kalk. (time)</div>
                            <div className={styles.monitorStatValue}>
                                {computedConsumption.toFixed(2)} kWh
                            </div>
                        </div>

                        <div className={styles.monitorStat}>
                            <div className={styles.monitorStatLabel}>API (time)</div>
                            <div className={styles.monitorStatValue}>
                                {liveData.accumulatedConsumptionLastHour != null ? liveData.accumulatedConsumptionLastHour.toFixed(2) : '-'} kWh
                            </div>
                        </div>
                        
                        <div className={styles.monitorStat}>
                            <div className={styles.monitorStatLabel}>Tid igjen</div>
                            <div className={styles.monitorStatValue}>
                                {minutesRemaining} min
                            </div>
                        </div>
                        
                        <div className={styles.monitorStat}>
                            <div className={styles.monitorStatLabel}>Maks effekt tillatt</div>
                            <div className={styles.monitorStatValue} style={{
                                color: maxPower_kW < 0 ? '#ff0000' : maxPower_kW < 5 ? '#ff8800' : '#00ff00'
                            }}>
                                {maxPower_kW.toFixed(1)} kW
                            </div>
                        </div>
                    </div>
                    
                    <div className={styles.monitorFooter}>
                        <div className={styles.monitorViolations}>
                            <span className={styles.monitorViolationsLabel}>Brudd denne måneden:</span>
                            <span className={styles.monitorViolationsCount}>
                                {monthlyViolationCount}/3
                            </span>
                            {monthlyViolationCount >= 3 && (
                                <span className={styles.monitorViolationsWarning}>⚠️ Ekstra gebyr!</span>
                            )}
                        </div>
                        
                        {renderAlertBanner()}
                    </div>
                    
                    <div className={styles.monitorTimestamp}>
                        Oppdatert: {now.toLocaleTimeString('no-NO')}
                    </div>
                </>
            ) : (
                <div className={styles.monitorConnecting}>
                    <div className={styles.monitorConnectingIcon}>⚡</div>
                    <div className={styles.monitorConnectingText}>
                        {liveStatus === 'connecting' ? 'Kobler til...' : 
                         liveStatus === 'disconnected' ? 'Starter tilkobling...' :
                         'Venter på data...'}
                    </div>
                </div>
            )}
        </div>
    );
}
