import React from 'react';
import styles from './TibberDashboard.module.css';

export default function TibberAdminView({
    tokenInput,
    setTokenInput,
    homeIdInput,
    setHomeIdInput,
    saveToken,
    saveHomeId,
    fetchHomeId,
    availableHomes,
    statusMessage,
    startLiveData,
    stopLiveData,
    switchToMonitorView,
    liveStatus,
    getLiveStatusText,
    renderLiveData,
    renderAlertBanner,
    rawData
}) {
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>⚡ Tibber Data Dashboard</h1>
                <p>Hent ut data fra Tibber API</p>
            </header>
            
            {/* Alert Banner */}
            {renderAlertBanner()}

            <div className={styles.apiConfig}>
                <h2>API-konfigurasjon</h2>
                <div className={styles.inputGroup}>
                    <label htmlFor="apiToken">Tibber API Token:</label>
                    <input
                        type="password"
                        id="apiToken"
                        placeholder="Legg inn din Tibber API token her"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                    />
                    <button onClick={saveToken}>Lagre Token</button>
                </div>
                <div className={styles.inputGroup}>
                    <label htmlFor="homeId">Tibber Home ID:</label>
                    <input
                        type="password"
                        id="homeId"
                        placeholder="Legg inn din Tibber Home ID her"
                        value={homeIdInput}
                        onChange={(e) => setHomeIdInput(e.target.value)}
                    />
                    <button onClick={saveHomeId}>Lagre Home ID</button>
                </div>

                <div className={styles.homesList}>
                    <h3>Dine tilgjengelige hjem fra API</h3>
                    <button onClick={fetchHomeId} className={styles.btn} style={{ alignSelf: 'flex-start', marginBottom: '10px' }}>Finn hjem i API</button>
                    {availableHomes && availableHomes.length > 0 && (
                        availableHomes.map((home, index) => {
                            const name = home.appNickname || home.address?.address1 || `Hjem ${index + 1}`;
                            return (
                                <div key={home.id} className={styles.homeItem}>
                                    <div className={styles.homeInfo}>
                                        <div className={styles.homeName}>{name}</div>
                                        <div className={styles.homeIdText}>{home.id}</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(home.id).then(() => {
                                                const btn = document.getElementById(`copy-btn-${home.id}`);
                                                if (btn) {
                                                    const originalText = btn.innerText;
                                                    btn.innerText = '✅ Kopiert!';
                                                    setTimeout(() => { btn.innerText = originalText; }, 2000);
                                                }
                                            });
                                        }}
                                        id={`copy-btn-${home.id}`}
                                        className={styles.copyBtn}
                                        title="Kopier Home ID"
                                    >
                                        📋 Kopier ID
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
                
                <p className={styles.helpText}>
                    Du kan få en demo-token fra <a href="https://developer.tibber.com/" target="_blank" rel="noopener noreferrer">Tibber Developer Portal</a>
                    <br />
                    Demo token: 5K4MVS-OjfWhK_4yrjOlFe1F6kJXPVf7eQYggo8ebAE
                    <br />
                    <strong>Merk:</strong> Uten kundeforhold kan du kun hente live sanntidsdata via websocket.
                    <br />
                    Du finner din Home ID i Tibber API eller via GraphQL-spørring.
                </p>
            </div>

            {statusMessage.text && (
                <div className={`${styles.statusMessage} ${styles[statusMessage.type]}`}>
                    {statusMessage.text}
                </div>
            )}

            <div className={styles.actionButtons}>
                <button
                    className={styles.btn}
                    onClick={startLiveData}
                    disabled={liveStatus !== 'disconnected'}
                >
                    Start Live Strømdata
                </button>
                <button
                    className={`${styles.btn} ${styles.btnStop}`}
                    onClick={stopLiveData}
                    disabled={liveStatus === 'disconnected'}
                >
                    Stopp Live Data
                </button>
                <button 
                    className={`${styles.btn} ${styles.btnMonitor}`}
                    onClick={switchToMonitorView}
                >
                    📊 Monitor View
                </button>
            </div>

            <div className={styles.dataSection}>
                <h2>Live Strømdata</h2>
                <div className={`${styles.liveStatus} ${styles[liveStatus]}`}>
                    <span className={styles.statusDot}></span>
                    <span className={styles.statusText}>{getLiveStatusText()}</span>
                </div>
                <div className={styles.results}>
                    {renderLiveData()}
                </div>
            </div>

            <div className={styles.rawDataSection}>
                <h3>Rå API-respons</h3>
                <pre className={styles.rawData}>{rawData}</pre>
            </div>
        </div>
    );
}
