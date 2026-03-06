import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './TibberDashboard.module.css';
import * as PowerMonitorDB from './PowerMonitorDB';

const TIBBER_API_URL = 'https://api.tibber.com/v1-beta/gql';
const TIBBER_WEBSOCKET_URL = 'wss://websocket-api.tibber.com/v1-beta/gql/subscriptions';
const MAX_RETRY_ATTEMPTS = 3;

export default function TibberDashboard() {
    const [apiToken, setApiToken] = useState('');
    const [tokenInput, setTokenInput] = useState('');
    const [homeId, setHomeId] = useState('');
    const [homeIdInput, setHomeIdInput] = useState('');
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
    const [liveStatus, setLiveStatus] = useState('disconnected');
    const [liveData, setLiveData] = useState(null);
    const [rawData, setRawData] = useState('');
    const [websocketRetryCount, setWebsocketRetryCount] = useState(0);
    
    // Power monitoring state
    const [db, setDb] = useState(null);
    const [currentHourStart, setCurrentHourStart] = useState(null);
    const [accumulatedAtHourStart, setAccumulatedAtHourStart] = useState(0);
    const [projectedAverage, setProjectedAverage] = useState(0);
    const [alertLevel, setAlertLevel] = useState('none'); // 'none', 'info', 'warning', 'critical'
    const [monthlyViolationCount, setMonthlyViolationCount] = useState(0);
    const [measurementCount, setMeasurementCount] = useState(0);
    const [viewMode, setViewMode] = useState('admin'); // 'admin' or 'monitor'
    
    const websocketRef = useRef(null);
    const retryTimeoutRef = useRef(null);
    const saveCounterRef = useRef(0); // Batch save every 10 measurements
    const currentHourStartRef = useRef(null); // Track current hour synchronously
    const accumulatedAtHourStartRef = useRef(0); // Track accumulated at hour start synchronously

    // Load token, homeId and viewMode from localStorage on mount
    useEffect(() => {
        const savedToken = localStorage.getItem('tibberApiToken') || '';
        const savedHomeId = localStorage.getItem('tibberHomeId') || '';
        const savedViewMode = localStorage.getItem('tibberViewMode') || 'admin';
        
        if (savedToken) {
            setApiToken(savedToken);
            setTokenInput(savedToken);
        }
        if (savedHomeId) {
            setHomeId(savedHomeId);
            setHomeIdInput(savedHomeId);
        }
        setViewMode(savedViewMode);
        if (savedToken || savedHomeId) {
            showStatus('Konfigurasjon lastet fra localStorage', 'success');
        }
        
        // Auto-connect in monitor mode if credentials are available
        if (savedViewMode === 'monitor' && savedToken && savedHomeId) {
            setTimeout(() => {
                if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
                    connectWebSocket();
                }
            }, 1000);
        }
    }, []);

    // Initialize database on mount
    useEffect(() => {
        const initDb = async () => {
            try {
                console.log('Starting database initialization...');
                const database = await PowerMonitorDB.initializeDatabase();
                setDb(database);
                console.log('✅ Database initialized successfully');
                
                // Clean old data (older than 60 days)
                PowerMonitorDB.cleanOldData(database, 60);
                
                // Get current month violation count
                const now = new Date();
                const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const count = PowerMonitorDB.getCurrentMonthViolations(database, month);
                setMonthlyViolationCount(count);
                
                console.log('Power monitor database ready, violations:', count);
            } catch (error) {
                console.error('❌ Failed to initialize database:', error);
                // Continue without database - monitoring will still work, just no persistence
            }
        };
        
        if (typeof window !== 'undefined') {
            initDb();
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

    const saveHomeId = () => {
        const id = homeIdInput.trim();
        if (!id) {
            showStatus('Vennligst legg inn en Home ID', 'error');
            return;
        }
        localStorage.setItem('tibberHomeId', id);
        setHomeId(id);
        showStatus('Home ID lagret!', 'success');
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
        if (!homeId) {
            showStatus('Vennligst legg inn og lagre din Home ID først', 'error');
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
    }, [apiToken, homeId, websocketRetryCount, showStatus]);

    const subscribeToLiveMeasurement = (ws) => {
        const subscription = {
            id: '1',
            type: 'subscribe',
            payload: {
                query: `subscription {
                    liveMeasurement(homeId: "${homeId}") {
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
        
        // Debug logging
        console.log('Power monitoring check:', {
            db: !!db,
            timestamp: measurement.timestamp,
            accumulatedConsumption: measurement.accumulatedConsumption,
            power: measurement.power,
            currentHourStart: currentHourStart
        });
        
        // Power monitoring: works without database, but won't persist
        if (measurement.timestamp && measurement.accumulatedConsumption != null && measurement.power != null) {
            checkAndResetHour(measurement.timestamp, measurement.accumulatedConsumption);
            calculateProjection(measurement);
        } else {
            console.log('⚠️ Skipping power monitoring - missing timestamp, accumulatedConsumption, or power');
        }
    };

    const startLiveData = () => {
        if (!apiToken) {
            showStatus('Vennligst legg inn og lagre din API token først', 'error');
            return;
        }
        if (!homeId) {
            showStatus('Vennligst legg inn og lagre din Home ID først', 'error');
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

    // === POWER MONITORING FUNCTIONS ===
    
    // Get hour start timestamp (zeroed minutes, seconds, ms)
    const getHourStartTimestamp = (date) => {
        const d = new Date(date);
        d.setMinutes(0, 0, 0);
        return d.getTime();
    };
    
    // Check if we've crossed into a new hour and reset tracking
    const checkAndResetHour = (timestampStr, currentAccumulated) => {
        const now = new Date(timestampStr);
        const hourStart = getHourStartTimestamp(now);
        
        // First measurement ever, or new hour detected (use ref for synchronous check)
        if (currentHourStartRef.current === null || currentHourStartRef.current !== hourStart) {
            // Save previous hour if it exceeded threshold (only if db available)
            if (currentHourStartRef.current !== null && projectedAverage > 10 && db) {
                const prevDate = new Date(currentHourStartRef.current);
                const dateStr = prevDate.toISOString().split('T')[0];
                const month = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
                
                PowerMonitorDB.recordViolation(db, currentHourStartRef.current, dateStr, month, projectedAverage);
                
                // Update violation count
                const count = PowerMonitorDB.getCurrentMonthViolations(db, month);
                setMonthlyViolationCount(count);
                
                console.log(`Hour ended with average ${projectedAverage.toFixed(2)} kW (violation recorded)`);
            }
            
            // Start tracking new hour
            console.log(`✅ New hour started at ${now.toISOString()}, hourStart=${hourStart}, accumulated=${currentAccumulated}`);
            
            // Update both ref (synchronous) and state (for UI)
            currentHourStartRef.current = hourStart;
            accumulatedAtHourStartRef.current = currentAccumulated;
            setCurrentHourStart(hourStart);
            setAccumulatedAtHourStart(currentAccumulated);
            setMeasurementCount(0);
            setProjectedAverage(0);
            
            // Save to database (only if db available)
            if (db) {
                const dateStr = now.toISOString().split('T')[0];
                PowerMonitorDB.saveHourlyData(db, hourStart, dateStr, currentAccumulated, 0, 0);
            }
        }
    };
    
    // Calculate projected hourly average
    const calculateProjection = (measurement) => {
        // Use ref for synchronous check
        if (currentHourStartRef.current === null) return;
        
        const now = new Date(measurement.timestamp);
        const minutesElapsed = now.getMinutes() + now.getSeconds() / 60;
        const minutesRemaining = 60 - minutesElapsed;
        
        // Energy consumed this hour (kWh) - use ref for accurate value
        const E_consumed_kWh = measurement.accumulatedConsumption - accumulatedAtHourStartRef.current;
        const E_consumed_Wh = E_consumed_kWh * 1000; // Convert to Wh
        
        // Current power (convert W to kW)
        const P_current_kW = measurement.power / 1000;
        
        // Projected energy if current power continues
        const projectedWh = E_consumed_Wh + (P_current_kW * 1000 * (minutesRemaining / 60));
        
        // Average over full hour (convert back to kWh, but represents average kW)
        const P_avg = projectedWh / 1000;
        
        setProjectedAverage(P_avg);
        
        // Update measurement count
        const newCount = measurementCount + 1;
        setMeasurementCount(newCount);
        
        // Determine alert level
        let level = 'none';
        if (P_avg > 9.9) {
            level = 'critical';
        } else if (P_avg > 9.5) {
            level = 'warning';
        } else if (P_avg > 8.0) {
            level = 'info';
        }
        setAlertLevel(level);
        
        // Batch save to database (every 10 measurements, only if db available)
        if (db) {
            saveCounterRef.current++;
            if (saveCounterRef.current >= 10) {
                PowerMonitorDB.updateHourlyStats(db, currentHourStartRef.current, newCount, Math.max(projectedAverage, P_avg));
                PowerMonitorDB.saveDatabaseToLocalStorage(db);
                saveCounterRef.current = 0;
            }
        }
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
                
                {/* Power Projection Section - Always visible */}
                <div className={styles.projectionSection}>
                    <h4>⚡ Kraftovervåking</h4>
                    {currentHourStart !== null ? (
                        <>
                            <div className={`${styles.projectionMetric} ${styles[alertLevel]}`}>
                                <div className={styles.projectionLabel}>Beregnet timesnitt:</div>
                                <div className={styles.projectionValue}>
                                    {projectedAverage.toFixed(2)} <span className={styles.projectionUnit}>kW</span>
                                </div>
                            </div>
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Nåværende effekt:</span>
                                <span className={styles.infoValue}>
                                    {(liveData.power / 1000).toFixed(2)} kW
                                </span>
                            </div>
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Tid igjen denne timen:</span>
                                <span className={styles.infoValue}>
                                    {(() => {
                                        const now = new Date(liveData.timestamp);
                                        const minutesRemaining = 59 - now.getMinutes();
                                        return `${minutesRemaining} min`;
                                    })()}
                                </span>
                            </div>
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Forbruk denne timen:</span>
                                <span className={styles.infoValue}>
                                    {((liveData.accumulatedConsumption - accumulatedAtHourStart) * 1000).toFixed(0)} Wh
                                </span>
                            </div>
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Maks effekt rest av timen (for å holde under 10 kW snitt):</span>
                                <span className={styles.infoValue}>
                                    {(() => {
                                        const now = new Date(liveData.timestamp);
                                        const minutesElapsed = now.getMinutes() + now.getSeconds() / 60;
                                        const minutesRemaining = 60 - minutesElapsed;
                                        
                                        // How much energy can we use in total this hour? 10 kWh
                                        const maxEnergyThisHour_kWh = 10;
                                        
                                        // How much have we already used?
                                        const E_consumed_kWh = liveData.accumulatedConsumption - accumulatedAtHourStart;
                                        
                                        // How much is left?
                                        const E_remaining_kWh = maxEnergyThisHour_kWh - E_consumed_kWh;
                                        
                                        // What's the max power we can use for the remaining time?
                                        const maxPower_kW = (E_remaining_kWh / (minutesRemaining / 60));
                                        
                                        const color = maxPower_kW < 0 ? '#cc0000' : maxPower_kW < 5 ? '#ff8800' : '#00aa00';
                                        return (
                                            <span style={{ color, fontWeight: 'bold' }}>
                                                {maxPower_kW.toFixed(2)} kW
                                            </span>
                                        );
                                    })()}
                                </span>
                            </div>
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Timer over 10 kW denne måneden:</span>
                                <span className={styles.infoValue}>
                                    <strong>{monthlyViolationCount}/3</strong> {monthlyViolationCount >= 3 && '⚠️ Ekstra gebyr!'}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div style={{ padding: '10px', background: '#fff3cd', borderRadius: '8px' }}>
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Database:</span>
                                <span className={styles.infoValue}>
                                    {db ? '✅ OK' : '❌ Mangler'}
                                </span>
                            </div>
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Timestamp:</span>
                                <span className={styles.infoValue}>
                                    {liveData.timestamp ? '✅ ' + liveData.timestamp : '❌ Mangler'}
                                </span>
                            </div>
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>AccumulatedConsumption:</span>
                                <span className={styles.infoValue}>
                                    {liveData.accumulatedConsumption != null ? '✅ ' + liveData.accumulatedConsumption + ' kWh' : '❌ Mangler'}
                                </span>
                            </div>
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Power:</span>
                                <span className={styles.infoValue}>
                                    {liveData.power != null ? '✅ ' + liveData.power + ' W' : '❌ Mangler'}
                                </span>
                            </div>
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Status:</span>
                                <span className={styles.infoValue} style={{ color: '#cc6600', fontWeight: 'bold' }}>
                                    Venter på at alle data skal være tilgjengelige...
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className={styles.timestamp}>
                    Oppdatert: {new Date(liveData.timestamp).toLocaleString('no-NO')}
                </div>
            </div>
        );
    };
    
    // Render alert banner based on projection
    const renderAlertBanner = () => {
        if (alertLevel === 'none' || !liveData) return null;
        
        const alertMessages = {
            info: {
                icon: '💛',
                title: 'Info: Nærmer seg høy belastning',
                message: `Beregnet timesnitt er ${projectedAverage.toFixed(2)} kW. Du nærmer deg terskelen på 10 kW.`,
                suggestion: 'Vurder å utsette høyenergiforbruk til neste time.',
            },
            warning: {
                icon: '⚠️',
                title: 'Advarsel: Høy belastning',
                message: `Beregnet timesnitt er ${projectedAverage.toFixed(2)} kW. Fare for å overstige 10 kW!`,
                suggestion: 'Reduser forbruket nå: Stopp oppvaskmaskin, tørketrommel eller lignende.',
            },
            critical: {
                icon: '🔴',
                title: 'KRITISK: Overskridelse!',
                message: `Beregnet timesnitt er ${projectedAverage.toFixed(2)} kW. Vil overstige 10 kW grensen!`,
                suggestion: 'STANS HØYENERGIFORBRUK NÅ! Stopp billadere, varmtvannsberedere og andre store forbrukere umiddelbart.',
            },
        };
        
        const alert = alertMessages[alertLevel];
        
        return (
            <div className={`${styles.alertBanner} ${styles[`alert${alertLevel.charAt(0).toUpperCase()}${alertLevel.slice(1)}`]}`}>
                <div className={styles.alertIcon}>{alert.icon}</div>
                <div className={styles.alertContent}>
                    <div className={styles.alertTitle}>{alert.title}</div>
                    <div className={styles.alertMessage}>{alert.message}</div>
                    <div className={styles.alertSuggestion}>{alert.suggestion}</div>
                </div>
            </div>
        );
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
    
    // Get background class based on alert level
    const getBackgroundClass = () => {
        if (alertLevel === 'critical') return styles.bgCritical;
        if (alertLevel === 'warning') return styles.bgWarning;
        if (alertLevel === 'info') return styles.bgInfo;
        return styles.bgNormal;
    };
    
    const switchToMonitorView = () => {
        if (!apiToken || !homeId) {
            showStatus('Vennligst legg inn og lagre API token og Home ID først', 'error');
            return;
        }
        setViewMode('monitor');
        localStorage.setItem('tibberViewMode', 'monitor');
        
        // Auto-connect when entering monitor mode
        if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
            setTimeout(() => connectWebSocket(), 500);
        }
    };
    
    const switchToAdminView = () => {
        setViewMode('admin');
        localStorage.setItem('tibberViewMode', 'admin');
    };
    
    const renderMonitorView = () => {
        const now = liveData ? new Date(liveData.timestamp) : new Date();
        const minutesRemaining = liveData ? 59 - now.getMinutes() : 0;
        
        // Calculate max allowed power
        let maxPower_kW = 0;
        if (liveData && currentHourStart !== null) {
            const minutesElapsed = now.getMinutes() + now.getSeconds() / 60;
            const timeRemaining = 60 - minutesElapsed;
            const maxEnergyThisHour_kWh = 10;
            const E_consumed_kWh = liveData.accumulatedConsumption - accumulatedAtHourStart;
            const E_remaining_kWh = maxEnergyThisHour_kWh - E_consumed_kWh;
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
    };

    // Render monitor view if in monitor mode
    if (viewMode === 'monitor') {
        return (
            <div className={`${styles.wrapper} ${getBackgroundClass()}`}>
                {renderMonitorView()}
            </div>
        );
    }
    
    // Render admin view
    return (
        <div className={`${styles.wrapper} ${getBackgroundClass()}`}>
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
        </div>
    );
}
