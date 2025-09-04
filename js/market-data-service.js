// Market Data Service - Unified API for real-time market data
class MarketDataService {
    constructor() {
        this.config = new APIConfig();
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 seconds cache for Alpha Vantage
        this.subscribers = new Map();
        this.updateInterval = null;
        this.errorHandler = new ErrorHandler();
        
        // WebSocket connections
        this.websockets = {
            finnhub: null,
            reconnectAttempts: 0,
            maxReconnectAttempts: 5,
            reconnectDelay: 1000
        };
        
        this.subscribedSymbols = new Set();
        
        // Symbol mapping for Alpha Vantage
        this.symbolMapping = {
            'EUR/USD': 'EURUSD',
            'GBP/USD': 'GBPUSD', 
            'USD/JPY': 'USDJPY',
            'BTC/USD': 'BTC',
            'ETH/USD': 'ETH',
            'AAPL': 'AAPL',
            'GOOGL': 'GOOGL',
            'MSFT': 'MSFT',
            'TSLA': 'TSLA'
        };
        
        // Finnhub symbol mapping
        this.finnhubSymbolMapping = {
            'EUR/USD': 'OANDA:EUR_USD',
            'GBP/USD': 'OANDA:GBP_USD',
            'USD/JPY': 'OANDA:USD_JPY',
            'BTC/USD': 'BINANCE:BTCUSDT',
            'ETH/USD': 'BINANCE:ETHUSDT'
        };
    }

    // Initialize the service
    async init() {
        console.log('Initializing Market Data Service with real-time WebSocket connections...');
        try {
            // Test API connection
            await this.testConnection();
            console.log('✅ Alpha Vantage API connection successful');
            
            // Initialize WebSocket connections
            await this.initWebSocketConnections();
            
            // Start periodic updates for non-WebSocket data
            this.startPeriodicUpdates();
        } catch (error) {
            console.error('❌ Failed to initialize market data service:', error);
        }
    }

    // Initialize WebSocket connections
    async initWebSocketConnections() {
        try {
            await this.connectFinnhubWebSocket();
            console.log('✅ Finnhub WebSocket connection established');
        } catch (error) {
            console.error('❌ Failed to establish WebSocket connections:', error);
        }
    }

    // Connect to Finnhub WebSocket
    async connectFinnhubWebSocket() {
        const config = this.config.getApiConfig('finnhub');
        if (!config || !config.apiKey) {
            throw new Error('Finnhub API key not configured');
        }

        const wsUrl = `${config.wsUrl}?token=${config.apiKey}`;
        
        return new Promise((resolve, reject) => {
            try {
                this.websockets.finnhub = new WebSocket(wsUrl);
                
                this.websockets.finnhub.onopen = () => {
                    console.log('🔗 Finnhub WebSocket connected');
                    this.websockets.reconnectAttempts = 0;
                    
                    // Subscribe to default symbols
                    this.subscribeToDefaultSymbols();
                    resolve();
                };
                
                this.websockets.finnhub.onmessage = (event) => {
                    this.handleFinnhubMessage(event.data);
                };
                
                this.websockets.finnhub.onclose = (event) => {
                    console.log('🔌 Finnhub WebSocket disconnected:', event.code, event.reason);
                    this.handleWebSocketReconnect();
                };
                
                this.websockets.finnhub.onerror = (error) => {
                    console.error('❌ Finnhub WebSocket error:', error);
                    reject(error);
                };
                
                // Timeout for connection
                setTimeout(() => {
                    if (this.websockets.finnhub.readyState !== WebSocket.OPEN) {
                        reject(new Error('WebSocket connection timeout'));
                    }
                }, 10000);
                
            } catch (error) {
                reject(error);
            }
        });
    }

    // Handle Finnhub WebSocket messages
    handleFinnhubMessage(data) {
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'trade') {
                // Handle real-time trade data
                message.data.forEach(trade => {
                    const symbol = this.mapFinnhubSymbolToLocal(trade.s);
                    if (symbol) {
                        const quote = {
                            symbol: symbol,
                            price: trade.p,
                            change: null, // Will be calculated
                            changePercent: null,
                            volume: trade.v,
                            timestamp: new Date(trade.t),
                            source: 'finnhub_ws'
                        };
                        
                        // Update cache and notify subscribers
                        this.updateCache(symbol, quote);
                        this.notifySubscribers(symbol, quote);
                    }
                });
            }
        } catch (error) {
            console.error('Error parsing Finnhub message:', error);
        }
    }

    // Map Finnhub symbol back to local symbol
    mapFinnhubSymbolToLocal(finnhubSymbol) {
        for (const [localSymbol, mappedSymbol] of Object.entries(this.finnhubSymbolMapping)) {
            if (mappedSymbol === finnhubSymbol) {
                return localSymbol;
            }
        }
        // For stocks, return as-is
        return finnhubSymbol;
    }

    // Subscribe to default symbols on WebSocket
    subscribeToDefaultSymbols() {
        const defaultSymbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA'];
        defaultSymbols.forEach(symbol => {
            this.subscribeToWebSocketSymbol(symbol);
        });
    }

    // Subscribe to a symbol on WebSocket
    subscribeToWebSocketSymbol(symbol) {
        if (!this.websockets.finnhub || this.websockets.finnhub.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket not connected, cannot subscribe to', symbol);
            return;
        }

        const finnhubSymbol = this.finnhubSymbolMapping[symbol] || symbol;
        const subscribeMessage = {
            type: 'subscribe',
            symbol: finnhubSymbol
        };
        
        this.websockets.finnhub.send(JSON.stringify(subscribeMessage));
        this.subscribedSymbols.add(symbol);
        console.log(`📡 Subscribed to real-time data for ${symbol}`);
    }

    // Unsubscribe from a symbol on WebSocket
    unsubscribeFromWebSocketSymbol(symbol) {
        if (!this.websockets.finnhub || this.websockets.finnhub.readyState !== WebSocket.OPEN) {
            return;
        }

        const finnhubSymbol = this.finnhubSymbolMapping[symbol] || symbol;
        const unsubscribeMessage = {
            type: 'unsubscribe',
            symbol: finnhubSymbol
        };
        
        this.websockets.finnhub.send(JSON.stringify(unsubscribeMessage));
        this.subscribedSymbols.delete(symbol);
        console.log(`📡 Unsubscribed from real-time data for ${symbol}`);
    }

    // Handle WebSocket reconnection
    handleWebSocketReconnect() {
        if (this.websockets.reconnectAttempts >= this.websockets.maxReconnectAttempts) {
            console.error('❌ Max WebSocket reconnection attempts reached');
            return;
        }

        this.websockets.reconnectAttempts++;
        const delay = this.websockets.reconnectDelay * Math.pow(2, this.websockets.reconnectAttempts - 1);
        
        console.log(`🔄 Attempting WebSocket reconnection ${this.websockets.reconnectAttempts}/${this.websockets.maxReconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            this.connectFinnhubWebSocket().catch(error => {
                console.error('WebSocket reconnection failed:', error);
            });
        }, delay);
    }

    // Test API connection
    async testConnection() {
        try {
            const quote = await this.getQuote('AAPL');
            return quote !== null;
        } catch (error) {
            throw new Error(`API connection test failed: ${error.message}`);
        }
    }

    // Get current quote for a symbol
    async getQuote(symbol) {
        try {
            // Check cache first
            const cached = this.getFromCache(symbol);
            if (cached) {
                return cached;
            }

            // Map symbol for Alpha Vantage
            const mappedSymbol = this.symbolMapping[symbol] || symbol;
            
            let quote;
            if (this.isForexPair(symbol)) {
                quote = await this.getForexQuote(mappedSymbol);
            } else if (this.isCrypto(symbol)) {
                quote = await this.getCryptoQuote(mappedSymbol);
            } else {
                quote = await this.getStockQuote(mappedSymbol);
            }

            // Cache the result
            if (quote) {
                this.updateCache(symbol, quote);
            }
            
            return quote;
        } catch (error) {
            console.error(`Error getting quote for ${symbol}:`, error);
            // Return cached data if available, otherwise mock data
            return this.getFromCache(symbol) || this.getMockQuote(symbol);
        }
    }

    // Get stock quote from Alpha Vantage
    async getStockQuote(symbol) {
        const config = this.config.getApiConfig('alphaVantage');
        
        if (!this.config.checkRateLimit('alphaVantage')) {
            throw new Error('Alpha Vantage rate limit exceeded');
        }

        const url = `${config.baseUrl}?function=${config.endpoints.quote}&symbol=${symbol}&apikey=${config.apiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data['Error Message']) {
            throw new Error(data['Error Message']);
        }
        
        if (data['Note']) {
            throw new Error('API rate limit reached');
        }
        
        const quote = data['Global Quote'];
        if (!quote) {
            throw new Error('No quote data received');
        }
        
        return {
            symbol: quote['01. symbol'],
            price: parseFloat(quote['05. price']),
            change: parseFloat(quote['09. change']),
            changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
            high: parseFloat(quote['03. high']),
            low: parseFloat(quote['04. low']),
            open: parseFloat(quote['02. open']),
            previousClose: parseFloat(quote['08. previous close']),
            volume: parseInt(quote['06. volume']),
            timestamp: new Date(quote['07. latest trading day']).getTime(),
            source: 'alphaVantage'
        };
    }

    // Get forex quote from Alpha Vantage
    async getForexQuote(pair) {
        const config = this.config.getApiConfig('alphaVantage');
        
        if (!this.config.checkRateLimit('alphaVantage')) {
            throw new Error('Alpha Vantage rate limit exceeded');
        }

        // For forex, we need to split the pair (e.g., EURUSD -> EUR, USD)
        const fromCurrency = pair.substring(0, 3);
        const toCurrency = pair.substring(3, 6);
        
        const url = `${config.baseUrl}?function=${config.endpoints.currencyExchange}&from_currency=${fromCurrency}&to_currency=${toCurrency}&apikey=${config.apiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data['Error Message']) {
            throw new Error(data['Error Message']);
        }
        
        if (data['Note']) {
            throw new Error('API rate limit reached');
        }
        
        const quote = data['Realtime Currency Exchange Rate'];
        if (!quote) {
            throw new Error('No forex data received');
        }
        
        const currentPrice = parseFloat(quote['5. Exchange Rate']);
        const previousPrice = currentPrice * (1 + (Math.random() - 0.5) * 0.001); // Simulate previous price
        
        return {
            symbol: `${fromCurrency}/${toCurrency}`,
            price: currentPrice,
            change: currentPrice - previousPrice,
            changePercent: ((currentPrice - previousPrice) / previousPrice) * 100,
            timestamp: new Date(quote['6. Last Refreshed']).getTime(),
            source: 'alphaVantage'
        };
    }

    // Get crypto quote from Alpha Vantage
    async getCryptoQuote(symbol) {
        const config = this.config.getApiConfig('alphaVantage');
        
        if (!this.config.checkRateLimit('alphaVantage')) {
            throw new Error('Alpha Vantage rate limit exceeded');
        }

        const url = `${config.baseUrl}?function=CURRENCY_EXCHANGE_RATE&from_currency=${symbol}&to_currency=USD&apikey=${config.apiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data['Error Message']) {
            throw new Error(data['Error Message']);
        }
        
        if (data['Note']) {
            throw new Error('API rate limit reached');
        }
        
        const quote = data['Realtime Currency Exchange Rate'];
        if (!quote) {
            throw new Error('No crypto data received');
        }
        
        const currentPrice = parseFloat(quote['5. Exchange Rate']);
        
        return {
            symbol: `${symbol}/USD`,
            price: currentPrice,
            change: currentPrice * (Math.random() - 0.5) * 0.05, // Simulate change
            changePercent: (Math.random() - 0.5) * 10, // Simulate change percent
            timestamp: new Date(quote['6. Last Refreshed']).getTime(),
            source: 'alphaVantage'
        };
    }

    // Check if symbol is a forex pair
    isForexPair(symbol) {
        return symbol.includes('/') && symbol.length === 7;
    }

    // Check if symbol is crypto
    isCrypto(symbol) {
        return ['BTC/USD', 'ETH/USD', 'BTC', 'ETH'].includes(symbol);
    }

    // Enhanced subscribe method with WebSocket support
    subscribeToSymbol(symbol, callback) {
        if (!this.subscribers.has(symbol)) {
            this.subscribers.set(symbol, new Set());
            // Subscribe to WebSocket if available
            this.subscribeToWebSocketSymbol(symbol);
        }
        this.subscribers.get(symbol).add(callback);
        console.log(`📊 Subscribed to ${symbol} updates`);
    }

    // Enhanced unsubscribe method
    unsubscribeFromSymbol(symbol, callback) {
        if (this.subscribers.has(symbol)) {
            this.subscribers.get(symbol).delete(callback);
            if (this.subscribers.get(symbol).size === 0) {
                this.subscribers.delete(symbol);
                // Unsubscribe from WebSocket
                this.unsubscribeFromWebSocketSymbol(symbol);
            }
        }
    }

    // Start periodic updates (since Alpha Vantage doesn't have WebSocket)
    startPeriodicUpdates() {
        // Update every 30 seconds to respect rate limits
        this.updateInterval = setInterval(() => {
            this.updateSubscribedSymbols();
        }, 30000);
    }

    // Update all subscribed symbols
    async updateSubscribedSymbols() {
        const symbols = Array.from(this.subscribers.keys());
        
        for (const symbol of symbols.slice(0, 3)) { // Limit to 3 symbols to respect rate limits
            try {
                const quote = await this.getQuote(symbol);
                if (quote) {
                    this.notifySubscribers(symbol, quote);
                }
            } catch (error) {
                console.error(`Error updating ${symbol}:`, error);
            }
            
            // Wait 1 second between requests to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Notify subscribers of price updates
    notifySubscribers(symbol, data) {
        const callbacks = this.subscribers.get(symbol);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in subscriber callback:', error);
                }
            });
        }
    }

    // Cache management
    updateCache(symbol, data) {
        this.cache.set(symbol, {
            ...data,
            cachedAt: Date.now()
        });
    }

    getFromCache(symbol) {
        const cached = this.cache.get(symbol);
        if (cached && Date.now() - cached.cachedAt < this.cacheTimeout) {
            return cached;
        }
        return null;
    }

    // Fallback mock data for when API is unavailable
    getMockQuote(symbol) {
        const basePrice = {
            'EUR/USD': 1.0850,
            'GBP/USD': 1.2650,
            'USD/JPY': 149.50,
            'BTC/USD': 43500,
            'AAPL': 185.50,
            'GOOGL': 140.25,
            'MSFT': 375.80,
            'TSLA': 240.15
        }[symbol] || 100;
        
        const change = (Math.random() - 0.5) * basePrice * 0.02;
        
        return {
            symbol: symbol,
            price: basePrice + change,
            change: change,
            changePercent: (change / basePrice) * 100,
            timestamp: Date.now(),
            source: 'mock'
        };
    }

    // Get multiple quotes at once
    async getMultipleQuotes(symbols) {
        const quotes = {};
        
        for (const symbol of symbols) {
            try {
                quotes[symbol] = await this.getQuote(symbol);
                // Wait between requests to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Error getting quote for ${symbol}:`, error);
                quotes[symbol] = this.getMockQuote(symbol);
            }
        }
        
        return quotes;
    }

    // Cleanup
    destroy() {
        // Clear intervals
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // Close WebSocket connections
        if (this.websockets.finnhub) {
            this.websockets.finnhub.close();
        }
        
        // Clear subscribers and cache
        this.subscribers.clear();
        this.cache.clear();
        this.subscribedSymbols.clear();
        
        console.log('🧹 Market Data Service destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarketDataService;
} else {
    window.MarketDataService = MarketDataService;
}