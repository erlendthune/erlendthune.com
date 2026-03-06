import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './TibberDashboard.module.css';

const TIBBER_API_URL = 'https://api.tibber.com/v1-beta/gql';
const TIBBER_WEBSOCKET_URL = 'wss://websocket-api.tibber.com/v1-beta/gql/subscriptions';
const MAX_RETRY_ATTEMPTS = 3;
const HOME_ID = '079e344a-ceb4-4a72-9b60-3def23d6af8f';

export default function TibberDashboard() {
    const [apiToken, setApiToken] = useState('');
    const [tokenInput, setTokenInput] = useState('');
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
    const [liveStatus, setLiveStatus] = useState('disconnected');
    const [liveData, setLiveData] = useState(null);
    const [rawData, setRawData] = useState('');
    const [results, setResults] = useState(null);
    const [websocketRetryCount, setWebsocketRetryCount] = useState(0);
    
    const websocketRef = useRef(null);
    const retryTimeoutRef = useRef(null);

    // Load token from localStorage on mount
    useEffect(() => {
        const savedToken = localStorage.getItem('tibberApiToken') || '';
        if (savedToken) {
            setApiToken(savedToken);
            setTokenInput(savedToken);
            showStatus('API token lastet fra localStorage', 'success');
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (websocketRef.current) {
                websocketRef.current.close();
            }
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, []);

    const showStatus = useCallback((text, type) => {
        setStatusMessage({ text, type });
        setTimeout(() => {
            setStatusMessage({ text: '', type: '' });
        }, 5000);
    }, []);

    const saveToken = () => {
        const token = tokenInput.trim();
        if (!token) {
            showStatus('Vennligst legg inn en API token', 'error');
            return;
        }
        localStorage.setItem('tibberApiToken', token);
        setApiToken(token);
        showStatus('API token lagret!', 'success');
    };

    const callTibberAPI = async (query) => {
        if (!apiToken) {
            showStatus('Vennligst legg inn og lagre din API token først', 'error');
            throw new Error('No API token');
        }

        try {
            const response = await fetch(TIBBER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.errors) {
                throw new Error(data.errors[0].message);
            }

            return data;
        } catch (error) {
            showStatus(`API-feil: ${error.message}`, 'error');
            throw error;
        }
    };

    const connectWebSocket = useCallback(() => {
        if (!apiToken) {
            showStatus('Vennligst legg inn og lagre din API token først', 'error');
            return;
        }

        setLiveStatus('connecting');

        try {
            const ws = new WebSocket(TIBBER_WEBSOCKET_URL, ['graphql-transport-ws']);
            websocketRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket connected');
                ws.send(JSON.stringify({
                    type: 'connection_init',
                    payload: { token: apiToken }
                }));
            };

            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                console.log('WebSocket message:', message);

                switch (message.type) {
                    case 'connection_ack':
                        console.log('Connection acknowledged');
                        subscribeToLiveMeasurement(ws);
                        break;
                    case 'next':
                        if (message.payload && message.payload.data) {
                            handleLiveMeasurement(message.payload.data);
                        }
                        break;
                    case 'error':
                        console.error('WebSocket error:', message.payload);
                        showStatus(`WebSocket feil: ${message.payload.message || 'Ukjent feil'}`, 'error');
                        break;
                    case 'complete':
                        console.log('Subscription completed');
                        break;
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                showStatus('WebSocket feil - sjekk at du har riktig API token', 'error');
                setLiveStatus('disconnected');
            };

            ws.onclose = () => {
                console.log('WebSocket closed');
                setLiveStatus('disconnected');
                
                if (websocketRetryCount < MAX_RETRY_ATTEMPTS) {
                    setWebsocketRetryCount(prev => prev + 1);
                    showStatus(`Tilkobling mistet. Prøver igjen (forsøk ${websocketRetryCount + 1}/${MAX_RETRY_ATTEMPTS})...`, 'error');
                    retryTimeoutRef.current = setTimeout(() => connectWebSocket(), 3000);
                } else {
                    showStatus('Kunne ikke koble til WebSocket. Vennligst prøv igjen senere.', 'error');
                    setWebsocketRetryCount(0);
                }
            };

        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            showStatus(`Kunne ikke opprette WebSocket-tilkobling: ${error.message}`, 'error');
            setLiveStatus('disconnected');
        }
    }, [apiToken, websocketRetryCount, showStatus]);

    const subscribeToLiveMeasurement = (ws) => {
        const subscription = {
            id: '1',
            type: 'subscribe',
            payload: {
                query: `subscription {
                    liveMeasurement(homeId: "${HOME_ID}") {
                        timestamp
                        power
                        lastMeterConsumption
                        accumulatedConsumption
                        accumulatedProduction
                        accumulatedCost
                        accumulatedReward
                        currency
                        minPower
                        averagePower
                        maxPower
                        powerProduction
                        powerReactive
                        powerProductionReactive
                        minPowerProduction
                        maxPowerProduction
                        lastMeterProduction
                        powerFactor
                        voltagePhase1
                        voltagePhase2
                        voltagePhase3
                        currentL1
                        currentL2
                        currentL3
                        signalStrength
                    }
                }`
            }
        };

        ws.send(JSON.stringify(subscription));
        setLiveStatus('connected');
        showStatus('Koblet til live strømdata!', 'success');
        setWebsocketRetryCount(0);
    };

    const handleLiveMeasurement = (data) => {
        if (!data.liveMeasurement) return;

        const measurement = data.liveMeasurement;
        setLiveData(measurement);
        setRawData(JSON.stringify(measurement, null, 2));
    };

    const startLiveData = () => {
        if (!apiToken) {
            showStatus('Vennligst legg inn og lagre din API token først', 'error');
            return;
        }

        if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
            showStatus('Live data er allerede startet', 'error');
            return;
        }

        connectWebSocket();
    };

    const stopLiveData = () => {
        if (websocketRef.current) {
            websocketRef.current.close();
            websocketRef.current = null;
        }
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
        }
        setLiveStatus('disconnected');
        setLiveData(null);
        showStatus('Live data stoppet', 'success');
    };

    const fetchPrices = async () => {
        const query = `{
            viewer {
                homes {
                    currentSubscription {
                        priceInfo {
                            current {
                                total
                                energy
                                tax
                                startsAt
                                level
                            }
                            today {
                                total
                                energy
                                tax
                                startsAt
                                level
                            }
                            tomorrow {
                                total
                                energy
                                tax
                                startsAt
                                level
                            }
                        }
                    }
                }
            }
        }`;

        setResults({ type: 'loading' });
        
        try {
            const data = await callTibberAPI(query);
            setResults({ 
                type: 'prices', 
                data: data.data.viewer.homes[0].currentSubscription.priceInfo 
            });
            setRawData(JSON.stringify(data, null, 2));
            showStatus('Strømpriser hentet!', 'success');
        } catch (error) {
            setResults({ type: 'error', message: error.message });
        }
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
    };

    const getPriceLevelEmoji = (level) => {
        const emojis = {
            'VERY_CHEAP': '💚',
            'CHEAP': '💚',
            'NORMAL': '💛',
            'EXPENSIVE': '🧡',
            'VERY_EXPENSIVE': '❤️'
        };
        return emojis[level] || '⚡';
    };

    const renderLiveData = () => {
        if (!liveData) {
            return <p className={styles.placeholder}>Trykk på "Start Live Strømdata" for å se sanntidsdata fra Tibber</p>;
        }

        return (
            <div className={styles.liveCard}>
                <h3>⚡ Sanntidsdata</h3>
                
                <div className={styles.liveGrid}>
                    <div className={`${styles.liveMetric} ${styles.power}`}>
                        <div className={styles.liveMetricLabel}>Effekt</div>
                        <div className={styles.liveMetricValue}>
                            {liveData.power ? liveData.power.toFixed(0) : '0'}
                            <span className={styles.liveMetricUnit}>W</span>
                        </div>
                    </div>
                    
                    {liveData.voltagePhase1 && (
                        <div className={`${styles.liveMetric} ${styles.voltage}`}>
                            <div className={styles.liveMetricLabel}>Spenning (L1)</div>
                            <div className={styles.liveMetricValue}>
                                {liveData.voltagePhase1.toFixed(1)}
                                <span className={styles.liveMetricUnit}>V</span>
                            </div>
                        </div>
                    )}
                    
                    {liveData.currentL1 && (
                        <div className={`${styles.liveMetric} ${styles.current}`}>
                            <div className={styles.liveMetricLabel}>Strøm (L1)</div>
                            <div className={styles.liveMetricValue}>
                                {liveData.currentL1.toFixed(2)}
                                <span className={styles.liveMetricUnit}>A</span>
                            </div>
                        </div>
                    )}
                    
                    {liveData.accumulatedCost && (
                        <div className={`${styles.liveMetric} ${styles.cost}`}>
                            <div className={styles.liveMetricLabel}>Akkumulert kostnad</div>
                            <div className={styles.liveMetricValue}>
                                {liveData.accumulatedCost.toFixed(2)}
                                <span className={styles.liveMetricUnit}>{liveData.currency || 'NOK'}</span>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Gjennomsnittlig effekt:</span>
                    <span className={styles.infoValue}>{liveData.averagePower ? liveData.averagePower.toFixed(0) : '0'} W</span>
                </div>
                <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Min effekt:</span>
                    <span className={styles.infoValue}>{liveData.minPower ? liveData.minPower.toFixed(0) : '0'} W</span>
                </div>
                <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Maks effekt:</span>
                    <span className={styles.infoValue}>{liveData.maxPower ? liveData.maxPower.toFixed(0) : '0'} W</span>
                </div>
                
                {liveData.accumulatedConsumption && (
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Akkumulert forbruk:</span>
                        <span className={styles.infoValue}>{liveData.accumulatedConsumption.toFixed(2)} kWh</span>
                    </div>
                )}
                
                {liveData.powerFactor && (
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Effektfaktor:</span>
                        <span className={styles.infoValue}>{liveData.powerFactor.toFixed(2)}</span>
                    </div>
                )}
                
                {liveData.signalStrength && (
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Signalstyrke:</span>
                        <span className={styles.infoValue}>{liveData.signalStrength} dBm</span>
                    </div>
                )}
                
                {liveData.voltagePhase2 && (
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Spenning L2:</span>
                        <span className={styles.infoValue}>{liveData.voltagePhase2.toFixed(1)} V</span>
                    </div>
                )}
                
                {liveData.voltagePhase3 && (
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Spenning L3:</span>
                        <span className={styles.infoValue}>{liveData.voltagePhase3.toFixed(1)} V</span>
                    </div>
                )}
                
                {liveData.currentL2 && (
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Strøm L2:</span>
                        <span className={styles.infoValue}>{liveData.currentL2.toFixed(2)} A</span>
                    </div>
                )}
                
                {liveData.currentL3 && (
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Strøm L3:</span>
                        <span className={styles.infoValue}>{liveData.currentL3.toFixed(2)} A</span>
                    </div>
                )}
                
                <div className={styles.timestamp}>
                    Oppdatert: {new Date(liveData.timestamp).toLocaleString('no-NO')}
                </div>
            </div>
        );
    };

    const renderPrices = (priceInfo) => {
        const now = new Date();
        
        return (
            <>
                <div className={styles.priceCard}>
                    <h3>Nåværende pris</h3>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Total pris:</span>
                        <span className={styles.infoValue}>{priceInfo.current.total.toFixed(2)} kr/kWh</span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Energi:</span>
                        <span className={styles.infoValue}>{priceInfo.current.energy.toFixed(2)} kr/kWh</span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Avgifter:</span>
                        <span className={styles.infoValue}>{priceInfo.current.tax.toFixed(2)} kr/kWh</span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Prisnivå:</span>
                        <span className={styles.infoValue}>
                            {getPriceLevelEmoji(priceInfo.current.level)} {priceInfo.current.level}
                        </span>
                    </div>
                </div>

                <div className={styles.priceCard}>
                    <h3>Dagens priser</h3>
                    {priceInfo.today.map((price, index) => {
                        const startTime = new Date(price.startsAt);
                        const isCurrent = startTime <= now && new Date(startTime.getTime() + 60*60*1000) > now;
                        return (
                            <div key={index} className={`${styles.priceItem} ${isCurrent ? styles.current : ''}`}>
                                <span>{formatTime(startTime)}</span>
                                <span>{getPriceLevelEmoji(price.level)} {price.total.toFixed(2)} kr/kWh</span>
                            </div>
                        );
                    })}
                </div>

                {priceInfo.tomorrow && priceInfo.tomorrow.length > 0 && (
                    <div className={styles.priceCard}>
                        <h3>Morgendagens priser</h3>
                        {priceInfo.tomorrow.map((price, index) => {
                            const startTime = new Date(price.startsAt);
                            return (
                                <div key={index} className={styles.priceItem}>
                                    <span>{formatTime(startTime)}</span>
                                    <span>{getPriceLevelEmoji(price.level)} {price.total.toFixed(2)} kr/kWh</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </>
        );
    };

    const renderResults = () => {
        if (!results) {
            return liveStatus === 'disconnected' ? renderLiveData() : null;
        }

        if (results.type === 'loading') {
            return <div className={styles.loading}>Henter strømpriser</div>;
        }

        if (results.type === 'error') {
            return <p className={styles.error}>Kunne ikke hente strømpriser: {results.message}</p>;
        }

        if (results.type === 'prices') {
            return renderPrices(results.data);
        }

        return null;
    };

    const getLiveStatusText = () => {
        switch (liveStatus) {
            case 'connected':
                return 'Tilkoblet - mottar data';
            case 'connecting':
                return 'Kobler til...';
            case 'disconnected':
            default:
                return 'Ikke tilkoblet';
        }
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.container}>
                <header className={styles.header}>
                    <h1>⚡ Tibber Data Dashboard</h1>
                    <p>Hent ut data fra Tibber API</p>
                </header>

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
                    <p className={styles.helpText}>
                        Du kan få en demo-token fra <a href="https://developer.tibber.com/" target="_blank" rel="noopener noreferrer">Tibber Developer Portal</a>
                        <br />
                        Demo token: 5K4MVS-OjfWhK_4yrjOlFe1F6kJXPVf7eQYggo8ebAE
                        <br />
                        <strong>Merk:</strong> Uten kundeforhold kan du kun hente live sanntidsdata via websocket.
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
                    <button className={styles.btn} onClick={fetchPrices}>
                        Hent Strømpriser (Demo)
                    </button>
                </div>

                <div className={styles.dataSection}>
                    <h2>Live Strømdata</h2>
                    <div className={`${styles.liveStatus} ${styles[liveStatus]}`}>
                        <span className={styles.statusDot}></span>
                        <span className={styles.statusText}>{getLiveStatusText()}</span>
                    </div>
                    <div className={styles.results}>
                        {liveStatus === 'connected' && renderLiveData()}
                        {liveStatus !== 'connected' && renderResults()}
                    </div>
                </div>

                <div className={styles.rawDataSection}>
                    <h3>Rå API-respons</h3>
                    <pre className={styles.rawData}>{rawData}</pre>
                </div>
            </div>
        </div>
    );
}
