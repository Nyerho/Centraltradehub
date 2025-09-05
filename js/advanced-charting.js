class AdvancedChartingEngine {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.options = {
            theme: 'dark',
            interval: '1D',
            timezone: 'Etc/UTC',
            autosize: true,
            studies_overrides: {},
            overrides: {
                "paneProperties.background": "#1a1a1a",
                "paneProperties.vertGridProperties.color": "#2a2a2a",
                "paneProperties.horzGridProperties.color": "#2a2a2a",
                "symbolWatermarkProperties.transparency": 90,
                "scalesProperties.textColor": "#AAA",
                "mainSeriesProperties.candleStyle.upColor": "#26a69a",
                "mainSeriesProperties.candleStyle.downColor": "#ef5350",
                "mainSeriesProperties.candleStyle.borderUpColor": "#26a69a",
                "mainSeriesProperties.candleStyle.borderDownColor": "#ef5350",
                "mainSeriesProperties.candleStyle.wickUpColor": "#26a69a",
                "mainSeriesProperties.candleStyle.wickDownColor": "#ef5350"
            },
            ...options
        };
        this.widget = null;
        this.indicators = new Map();
        this.drawings = new Map();
        this.alerts = new Map();
    }

    async initialize(symbol = 'EURUSD') {
        try {
            // Load TradingView library
            await this.loadTradingViewLibrary();
            
            this.widget = new TradingView.widget({
                container_id: this.containerId,
                width: '100%',
                height: '600',
                symbol: symbol,
                interval: this.options.interval,
                timezone: this.options.timezone,
                theme: this.options.theme,
                style: '1',
                locale: 'en',
                toolbar_bg: '#1a1a1a',
                enable_publishing: false,
                hide_top_toolbar: false,
                hide_legend: false,
                save_image: true,
                studies: [
                    'MASimple@tv-basicstudies',
                    'RSI@tv-basicstudies',
                    'MACD@tv-basicstudies'
                ],
                overrides: this.options.overrides,
                studies_overrides: this.options.studies_overrides,
                datafeed: new CustomDatafeed(),
                library_path: '/charting_library/',
                custom_css_url: '/css/chart-custom.css'
            });

            this.widget.onChartReady(() => {
                this.setupEventHandlers();
                this.loadCustomIndicators();
                this.setupDrawingTools();
                console.log('Advanced charting system initialized');
            });

        } catch (error) {
            console.error('Failed to initialize charting system:', error);
            throw error;
        }
    }

    async loadTradingViewLibrary() {
        return new Promise((resolve, reject) => {
            if (window.TradingView) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = '/charting_library/charting_library.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    setupEventHandlers() {
        const chart = this.widget.chart();
        
        // Symbol change handler
        chart.onSymbolChanged().subscribe(null, (symbolInfo) => {
            console.log('Symbol changed to:', symbolInfo.name);
            this.updateMarketData(symbolInfo.name);
        });

        // Interval change handler
        chart.onIntervalChanged().subscribe(null, (interval) => {
            console.log('Interval changed to:', interval);
            this.updateTimeframe(interval);
        });

        // Drawing event handlers
        chart.onDataLoaded().subscribe(null, () => {
            this.loadSavedDrawings();
        });
    }

    loadCustomIndicators() {
        const indicators = [
            {
                name: 'Volume Profile',
                id: 'volume_profile',
                script: this.createVolumeProfileIndicator()
            },
            {
                name: 'Support/Resistance',
                id: 'support_resistance',
                script: this.createSupportResistanceIndicator()
            },
            {
                name: 'Fibonacci Retracements',
                id: 'fibonacci',
                script: this.createFibonacciIndicator()
            }
        ];

        indicators.forEach(indicator => {
            this.indicators.set(indicator.id, indicator);
        });
    }

    setupDrawingTools() {
        const drawingTools = [
            'LineToolTrendLine',
            'LineToolHorzLine',
            'LineToolVertLine',
            'LineToolRectangle',
            'LineToolCircle',
            'LineToolFibRetracement',
            'LineToolFibExtension',
            'LineToolPitchfork',
            'LineToolGannFan',
            'LineToolText'
        ];

        drawingTools.forEach(tool => {
            this.enableDrawingTool(tool);
        });
    }

    enableDrawingTool(toolName) {
        const chart = this.widget.chart();
        chart.createShape(
            { time: Date.now() / 1000, price: 0 },
            {
                shape: toolName,
                lock: false,
                disableSelection: false,
                disableUndo: false,
                zOrder: 'top'
            }
        );
    }

    addTechnicalIndicator(indicatorName, parameters = {}) {
        const chart = this.widget.chart();
        const study = chart.createStudy(indicatorName, false, false, parameters);
        return study;
    }

    createAlert(conditions) {
        const alertId = `alert_${Date.now()}`;
        const alert = {
            id: alertId,
            symbol: conditions.symbol,
            condition: conditions.condition,
            price: conditions.price,
            message: conditions.message,
            active: true,
            created: new Date()
        };

        this.alerts.set(alertId, alert);
        this.monitorAlert(alert);
        return alertId;
    }

    monitorAlert(alert) {
        const checkAlert = () => {
            if (!alert.active) return;

            // Get current price from market data
            const currentPrice = this.getCurrentPrice(alert.symbol);
            
            if (this.evaluateAlertCondition(alert, currentPrice)) {
                this.triggerAlert(alert);
                alert.active = false;
            } else {
                setTimeout(checkAlert, 1000); // Check every second
            }
        };

        checkAlert();
    }

    evaluateAlertCondition(alert, currentPrice) {
        switch (alert.condition) {
            case 'above':
                return currentPrice > alert.price;
            case 'below':
                return currentPrice < alert.price;
            case 'crosses_above':
                return this.checkCrossAbove(alert.symbol, alert.price);
            case 'crosses_below':
                return this.checkCrossBelow(alert.symbol, alert.price);
            default:
                return false;
        }
    }

    triggerAlert(alert) {
        // Show notification
        this.showNotification({
            title: 'Price Alert Triggered',
            message: alert.message,
            type: 'alert',
            symbol: alert.symbol
        });

        // Play sound
        this.playAlertSound();

        // Send to alert history
        this.saveAlertToHistory(alert);
    }

    exportChart(format = 'png') {
        return new Promise((resolve, reject) => {
            this.widget.takeScreenshot().then((canvas) => {
                if (format === 'png') {
                    canvas.toBlob(resolve, 'image/png');
                } else if (format === 'jpg') {
                    canvas.toBlob(resolve, 'image/jpeg', 0.9);
                } else {
                    reject(new Error('Unsupported format'));
                }
            }).catch(reject);
        });
    }

    saveChartLayout(name) {
        const layout = this.widget.save();
        localStorage.setItem(`chart_layout_${name}`, JSON.stringify(layout));
        return layout;
    }

    loadChartLayout(name) {
        const layout = localStorage.getItem(`chart_layout_${name}`);
        if (layout) {
            this.widget.load(JSON.parse(layout));
            return true;
        }
        return false;
    }

    // Custom indicator creators
    createVolumeProfileIndicator() {
        return {
            name: 'Volume Profile',
            metainfo: {
                _metainfoVersion: 51,
                id: 'VolumeProfile@tv-volumebyprice',
                name: 'Volume Profile',
                description: 'Volume Profile',
                shortDescription: 'VP',
                is_hidden_study: false,
                is_price_study: true,
                volume_input_id: 'volume'
            }
        };
    }

    createSupportResistanceIndicator() {
        return {
            name: 'Support/Resistance',
            calc: function(data) {
                const highs = data.high;
                const lows = data.low;
                const period = 20;
                
                const support = [];
                const resistance = [];
                
                for (let i = period; i < highs.length; i++) {
                    const highSlice = highs.slice(i - period, i);
                    const lowSlice = lows.slice(i - period, i);
                    
                    resistance[i] = Math.max(...highSlice);
                    support[i] = Math.min(...lowSlice);
                }
                
                return [{ name: 'resistance', data: resistance }, { name: 'support', data: support }];
            }
        };
    }

    createFibonacciIndicator() {
        return {
            name: 'Auto Fibonacci',
            calc: function(data) {
                const highs = data.high;
                const lows = data.low;
                const period = 50;
                
                const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
                const results = {};
                
                for (let i = period; i < highs.length; i++) {
                    const slice = { high: highs.slice(i - period, i), low: lows.slice(i - period, i) };
                    const high = Math.max(...slice.high);
                    const low = Math.min(...slice.low);
                    const range = high - low;
                    
                    fibLevels.forEach((level, index) => {
                        const levelName = `fib_${level.toString().replace('.', '_')}`;
                        if (!results[levelName]) results[levelName] = [];
                        results[levelName][i] = high - (range * level);
                    });
                }
                
                return Object.keys(results).map(name => ({ name, data: results[name] }));
            }
        };
    }

    destroy() {
        if (this.widget) {
            this.widget.remove();
            this.widget = null;
        }
        this.indicators.clear();
        this.drawings.clear();
        this.alerts.clear();
    }
}

// Custom datafeed for TradingView
class CustomDatafeed {
    constructor() {
        this.configuration = {
            supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
            exchanges: [{
                value: 'Central Trade Hub',
                name: 'Central Trade Hub',
                desc: 'Central Trade Hub Exchange'
            }],
            symbols_types: [{
                name: 'forex',
                value: 'forex'
            }, {
                name: 'crypto',
                value: 'crypto'
            }, {
                name: 'stock',
                value: 'stock'
            }]
        };
    }

    onReady(callback) {
        setTimeout(() => callback(this.configuration), 0);
    }

    searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
        // Implement symbol search
        const symbols = this.getAvailableSymbols().filter(symbol => 
            symbol.symbol.toLowerCase().includes(userInput.toLowerCase())
        );
        onResultReadyCallback(symbols);
    }

    resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
        const symbolInfo = {
            name: symbolName,
            ticker: symbolName,
            description: symbolName,
            type: 'forex',
            session: '24x7',
            timezone: 'Etc/UTC',
            exchange: 'Central Trade Hub',
            minmov: 1,
            pricescale: 100000,
            has_intraday: true,
            has_weekly_and_monthly: true,
            supported_resolutions: this.configuration.supported_resolutions,
            volume_precision: 2,
            data_status: 'streaming'
        };
        
        setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0);
    }

    getBars(symbolInfo, resolution, from, to, onHistoryCallback, onErrorCallback, firstDataRequest) {
        // Implement historical data fetching
        this.fetchHistoricalData(symbolInfo.name, resolution, from, to)
            .then(bars => onHistoryCallback(bars, { noData: bars.length === 0 }))
            .catch(onErrorCallback);
    }

    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {
        // Implement real-time data subscription
        this.subscribeToRealtimeData(symbolInfo.name, resolution, onRealtimeCallback, subscriberUID);
    }

    unsubscribeBars(subscriberUID) {
        // Implement unsubscription
        this.unsubscribeFromRealtimeData(subscriberUID);
    }

    async fetchHistoricalData(symbol, resolution, from, to) {
        try {
            const response = await fetch(`/api/historical-data?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}`);
            const data = await response.json();
            
            return data.map(bar => ({
                time: bar.timestamp * 1000,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                volume: bar.volume
            }));
        } catch (error) {
            console.error('Failed to fetch historical data:', error);
            return [];
        }
    }

    subscribeToRealtimeData(symbol, resolution, callback, subscriberUID) {
        // WebSocket connection for real-time data
        const ws = new WebSocket(`wss://api.centraltradehub.com/ws/realtime`);
        
        ws.onopen = () => {
            ws.send(JSON.stringify({
                action: 'subscribe',
                symbol: symbol,
                resolution: resolution,
                subscriberUID: subscriberUID
            }));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'bar_update') {
                callback({
                    time: data.timestamp * 1000,
                    open: data.open,
                    high: data.high,
                    low: data.low,
                    close: data.close,
                    volume: data.volume
                });
            }
        };

        // Store WebSocket reference for cleanup
        this.subscriptions = this.subscriptions || new Map();
        this.subscriptions.set(subscriberUID, ws);
    }

    unsubscribeFromRealtimeData(subscriberUID) {
        if (this.subscriptions && this.subscriptions.has(subscriberUID)) {
            const ws = this.subscriptions.get(subscriberUID);
            ws.close();
            this.subscriptions.delete(subscriberUID);
        }
    }

    getAvailableSymbols() {
        return [
            { symbol: 'EURUSD', full_name: 'EUR/USD', description: 'Euro vs US Dollar', exchange: 'Central Trade Hub', type: 'forex' },
            { symbol: 'GBPUSD', full_name: 'GBP/USD', description: 'British Pound vs US Dollar', exchange: 'Central Trade Hub', type: 'forex' },
            { symbol: 'USDJPY', full_name: 'USD/JPY', description: 'US Dollar vs Japanese Yen', exchange: 'Central Trade Hub', type: 'forex' },
            { symbol: 'BTCUSD', full_name: 'BTC/USD', description: 'Bitcoin vs US Dollar', exchange: 'Central Trade Hub', type: 'crypto' },
            { symbol: 'ETHUSD', full_name: 'ETH/USD', description: 'Ethereum vs US Dollar', exchange: 'Central Trade Hub', type: 'crypto' }
        ];
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AdvancedChartingEngine, CustomDatafeed };
}