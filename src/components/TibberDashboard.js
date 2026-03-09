import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './TibberDashboard.module.css';
import * as PowerMonitorDB from './PowerMonitorDB';
import TibberMonitorView from './TibberMonitorView';
import TibberAdminView from './TibberAdminView';
import TibberHistoryView from './TibberHistoryView';

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
    const [availableHomes, setAvailableHomes] = useState([]);
    
    // Power monitoring state
    const [db, setDb] = useState(null);
    const [currentHourStart, setCurrentHourStart] = useState(null);
    const [accumulatedAtHourStart, setAccumulatedAtHourStart] = useState(0);
    const [projectedAverage, setProjectedAverage] = useState(0);
    const [alertLevel, setAlertLevel] = useState('none'); // 'none', 'info', 'warning', 'critical'
    const [monthlyViolationCount, setMonthlyViolationCount] = useState(0);
    const [measurementCount, setMeasurementCount] = useState(0);
    const [viewMode, setViewMode] = useState('admin'); // 'admin' or 'monitor'
    
    // Alarm state
    const [isMuted, setIsMuted] = useState(false);
    const alarmIntervalRef = useRef(null);

    // Emulation state
    const [isEmulating, setIsEmulating] = useState(false);
    const [emulatedPowerInput, setEmulatedPowerInput] = useState('15000');
    const emulationTimerRef = useRef(null);
    const emulatedPowerRef = useRef(15000);
    const emulatedAccumulatedRef = useRef(0);
    const emulatedAccumulatedLastHourRef = useRef(0);
    
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
            if (emulationTimerRef.current) {
                clearInterval(emulationTimerRef.current);
            }
        };
    }, []);

    const playAlarmSound = useCallback((level) => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            
            if (!window._sharedAudioCtx) {
                window._sharedAudioCtx = new AudioContext();
            }
            
            const ctx = window._sharedAudioCtx;
            
            // Browsers often suspend audio contexts created before user interaction.
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
            
            const playBeep = (freq, time, duration, type = 'sine', volume = 0.5) => {
                const osc = ctx.createOscillator();
                const gainNode = ctx.createGain();
                
                osc.type = type;
                osc.frequency.setValueAtTime(freq, ctx.currentTime + time);
                
                gainNode.gain.setValueAtTime(0, ctx.currentTime + time);
                gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + time + 0.05);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
                
                osc.connect(gainNode);
                gainNode.connect(ctx.destination);
                
                osc.start(ctx.currentTime + time);
                osc.stop(ctx.currentTime + time + duration);
            };
            
            if (level === 'critical') {
                // Urgent double-beep (A5 -> C6)
                playBeep(880, 0, 0.2, 'square', 0.6); 
                playBeep(1046.50, 0.25, 0.3, 'square', 0.6);
            } else if (level === 'warning') {
                // Warning dual-tone (E5)
                playBeep(659.25, 0, 0.2, 'sine', 0.4);
                playBeep(659.25, 0.3, 0.3, 'sine', 0.4);
            } else if (level === 'info') {
                // Gentle single tone (C5)
                playBeep(523.25, 0, 0.3, 'sine', 0.2);
            }
        } catch(e) {
            console.warn("Audio not supported");
        }
    }, []);

    useEffect(() => {
        if ((alertLevel === 'critical' || alertLevel === 'warning' || alertLevel === 'info') && !isMuted) {
            // Clear existing interval if we changed level
            if (alarmIntervalRef.current) {
                clearInterval(alarmIntervalRef.current);
            }
            
            playAlarmSound(alertLevel);
            
            // Set different intervals based on urgency
            const intervalMs = alertLevel === 'critical' ? 3000 : alertLevel === 'warning' ? 6000 : 10000;
            alarmIntervalRef.current = setInterval(() => playAlarmSound(alertLevel), intervalMs);
        } else {
            if (alarmIntervalRef.current) {
                clearInterval(alarmIntervalRef.current);
                alarmIntervalRef.current = null;
            }
        }
        
        return () => {
            if (alarmIntervalRef.current) {
                clearInterval(alarmIntervalRef.current);
                alarmIntervalRef.current = null;
            }
        };
    }, [alertLevel, isMuted, playAlarmSound]);

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

    const fetchHomeId = async () => {
        if (!apiToken) {
            showStatus('Vennligst lagre API token først for å hente fra API', 'error');
            return;
        }
        try {
            const query = `{
                viewer {
                    homes {
                        id
                        appNickname
                        address {
                            address1
                        }
                    }
                }
            }`;
            const data = await callTibberAPI(query);
            const homes = data?.data?.viewer?.homes;
            if (homes && homes.length > 0) {
                setAvailableHomes(homes);
                showStatus(`Fant ${homes.length} hjem fra oppgitt token.`, 'success');
            } else {
                setAvailableHomes([]);
                showStatus('Fant ingen hjem knyttet til denne kontoen.', 'error');
            }
        } catch (error) {
            // Feilmelding håndteres allerede i callTibberAPI
        }
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
                        accumulatedConsumptionLastHour
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
        initAudioContextForMobile();
        
        if (isEmulating) {
            showStatus('Stopp emulering først', 'error');
            return;
        }
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

    const updateEmulatedPower = (val) => {
        setEmulatedPowerInput(val);
        emulatedPowerRef.current = Number(val) || 0;
    };

    const startEmulation = () => {
        initAudioContextForMobile();
        
        if (liveStatus !== 'disconnected') {
            showStatus('Stopp live data først for å starte emulering', 'error');
            return;
        }

        setIsEmulating(true);
        setLiveStatus('connected');
        showStatus('Emulering startet!', 'success');
        
        // Reset accumulations if you want a fresh start
        emulatedAccumulatedRef.current = 0;
        emulatedAccumulatedLastHourRef.current = 0;
        
        // Push an immediate measurement to make UI update fast
        pushEmulatedMeasurement();

        emulationTimerRef.current = setInterval(() => {
            pushEmulatedMeasurement();
        }, 2000);
    };

    const pushEmulatedMeasurement = () => {
        const currentNow = new Date();
        const power = emulatedPowerRef.current;
        const energyKwhIn2Seconds = (power / 1000) * (2 / 3600);
        
        emulatedAccumulatedRef.current += energyKwhIn2Seconds;
        
        const currentHourStart = getHourStartTimestamp(currentNow);
        if (currentHourStartRef.current !== null && currentHourStartRef.current !== currentHourStart) {
            emulatedAccumulatedLastHourRef.current = 0;
        }
        emulatedAccumulatedLastHourRef.current += energyKwhIn2Seconds;
        
        const measurement = {
            timestamp: currentNow.toISOString(),
            power: power,
            accumulatedConsumption: emulatedAccumulatedRef.current,
            accumulatedConsumptionLastHour: emulatedAccumulatedLastHourRef.current,
            accumulatedCost: 0,
            currency: 'NOK',
            minPower: power,
            averagePower: power,
            maxPower: power,
            voltagePhase1: 230,
            currentL1: power / 230
        };
        
        handleLiveMeasurement({ liveMeasurement: measurement });
    };

    const stopEmulation = () => {
        if (emulationTimerRef.current) {
            clearInterval(emulationTimerRef.current);
            emulationTimerRef.current = null;
        }
        setIsEmulating(false);
        setLiveStatus('disconnected');
        setLiveData(null);
        showStatus('Emulering stoppet', 'success');
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
        
        // Energy consumed this hour (kWh) - use API value if available
        const computed_kWh = measurement.accumulatedConsumption - accumulatedAtHourStartRef.current;
        const E_consumed_kWh = measurement.accumulatedConsumptionLastHour ?? computed_kWh;
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
        if (level !== 'critical' && alertLevel === 'critical') {
            setIsMuted(false);
        }
        setAlertLevel(level);
        
        // Batch save to database (every 10 measurements, only if db available)
        if (db) {
            saveCounterRef.current++;
            if (saveCounterRef.current >= 10) {
                PowerMonitorDB.updateHourlyStats(db, currentHourStartRef.current, newCount, Math.max(projectedAverage, P_avg));
                if (PowerMonitorDB.recordPowerHistory) {
                    PowerMonitorDB.recordPowerHistory(db, now.getTime(), measurement.power, P_avg);
                }
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
                                    {liveData.accumulatedConsumptionLastHour != null
                                        ? (liveData.accumulatedConsumptionLastHour * 1000).toFixed(0)
                                        : ((liveData.accumulatedConsumption - accumulatedAtHourStart) * 1000).toFixed(0)} Wh
                                    <span style={{ fontSize: '0.8em', marginLeft: '6px', opacity: 0.8 }}>(Vår kalk: {((liveData.accumulatedConsumption - accumulatedAtHourStart) * 1000).toFixed(0)} Wh)</span>
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
                                        const computed_kWh = liveData.accumulatedConsumption - accumulatedAtHourStart;
                                        const E_consumed_kWh = liveData.accumulatedConsumptionLastHour ?? computed_kWh;
                                        
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
                    {alertLevel !== 'none' && (
                        <div className={styles.alertCostInfo}>
                            Neste trinn for nettleie vil gi ca. 400 kr i ekstra månedsavgift!
                        </div>
                    )}
                    <div className={styles.alertSuggestion}>{alert.suggestion}</div>
                </div>
                {alertLevel !== 'none' && (
                    <div className={styles.alertActions}>
                        <button
                            className={`${styles.btn} ${styles.btnSmall}`}
                            onClick={() => setIsMuted(!isMuted)}
                            style={{ marginLeft: '1rem', backgroundColor: isMuted ? '#6c757d' : '#dc3545', color: 'white' }}
                        >
                            {isMuted ? '� Slå på alarmlyd' : '🔇 Slå av alarmlyd'}
                        </button>
                    </div>
                )}
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
    
    const initAudioContextForMobile = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            
            if (!window._sharedAudioCtx) {
                window._sharedAudioCtx = new AudioContext();
            }
            
            if (window._sharedAudioCtx.state === 'suspended') {
                window._sharedAudioCtx.resume();
            }
            
            // Play a silent beep immediately on user interaction to unlock audio
            const tempOsc = window._sharedAudioCtx.createOscillator();
            const tempGain = window._sharedAudioCtx.createGain();
            tempGain.gain.value = 0; // Silent
            tempOsc.connect(tempGain);
            tempGain.connect(window._sharedAudioCtx.destination);
            tempOsc.start();
            tempOsc.stop(window._sharedAudioCtx.currentTime + 0.1);
        } catch (e) {
            console.warn("Could not init audio context", e);
        }
    };

    const switchToMonitorView = () => {
        if (!apiToken || !homeId) {
            showStatus('Vennligst legg inn og lagre API token og Home ID først', 'error');
            return;
        }
        
        // Initialize audio on this user interaction for mobile browsers
        initAudioContextForMobile();
        
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

    const switchToHistoryView = () => {
        setViewMode('history');
        localStorage.setItem('tibberViewMode', 'history');
    };
    
    // Render monitor view if in monitor mode
    if (viewMode === 'monitor') {
        return (
            <div className={`${styles.monitorWrapper} ${getBackgroundClass()}`}>
                <TibberMonitorView
                    liveStatus={liveStatus}
                    liveData={liveData}
                    currentHourStart={currentHourStart}
                    accumulatedAtHourStart={accumulatedAtHourStart}
                    projectedAverage={projectedAverage}
                    monthlyViolationCount={monthlyViolationCount}
                    alertLevel={alertLevel}
                    switchToAdminView={switchToAdminView}
                    renderAlertBanner={renderAlertBanner}
                />
            </div>
        );
    }
    
    // Render history view if in history mode
    if (viewMode === 'history') {
        return (
            <div className={`${styles.wrapper} ${getBackgroundClass()}`}>
                <TibberHistoryView 
                    db={db} 
                    onClose={switchToAdminView} 
                />
            </div>
        );
    }
    
    // Render admin view
    return (
        <div className={`${styles.wrapper} ${getBackgroundClass()}`}>
            <TibberAdminView
                tokenInput={tokenInput}
                setTokenInput={setTokenInput}
                homeIdInput={homeIdInput}
                setHomeIdInput={setHomeIdInput}
                saveToken={saveToken}
                saveHomeId={saveHomeId}
                fetchHomeId={fetchHomeId}
                availableHomes={availableHomes}
                statusMessage={statusMessage}
                startLiveData={startLiveData}
                stopLiveData={stopLiveData}
                switchToMonitorView={switchToMonitorView}
                switchToHistoryView={switchToHistoryView}
                liveStatus={liveStatus}
                getLiveStatusText={getLiveStatusText}
                renderLiveData={renderLiveData}
                renderAlertBanner={renderAlertBanner}
                rawData={rawData}
                isEmulating={isEmulating}
                emulatedPowerInput={emulatedPowerInput}
                updateEmulatedPower={updateEmulatedPower}
                startEmulation={startEmulation}
                stopEmulation={stopEmulation}
            />
        </div>
    );
}
