class APITestingFramework {
    constructor() {
        this.testResults = [];
        this.mockData = {
            quotes: {
                'EURUSD': { symbol: 'EURUSD', price: 1.0850, bid: 1.0849, ask: 1.0851, change: 0.0012 },
                'GBPUSD': { symbol: 'GBPUSD', price: 1.2650, bid: 1.2649, ask: 1.2651, change: -0.0008 },
                'AAPL': { symbol: 'AAPL', price: 175.50, bid: 175.49, ask: 175.51, change: 2.30 },
                'BTCUSD': { symbol: 'BTCUSD', price: 45000, bid: 44995, ask: 45005, change: 1200 }
            },
            orders: {
                success: { orderId: 'TEST_001', status: 'filled', executedPrice: 1.0850 },
                failure: { error: 'Insufficient margin', code: 'MARGIN_ERROR' }
            },
            positions: [
                { id: 'POS_001', symbol: 'EURUSD', side: 'buy', size: 10000, openPrice: 1.0840, currentPrice: 1.0850, pnl: 10 },
                { id: 'POS_002', symbol: 'AAPL', side: 'sell', size: 100, openPrice: 173.20, currentPrice: 175.50, pnl: -230 }
            ]
        };
        this.testMode = false;
        this.originalServices = {};
    }

    /**
     * Enable test mode and replace services with mock implementations
     */
    enableTestMode() {
        this.testMode = true;
        console.log('🧪 API Testing Framework: Test mode enabled');
        
        // Store original services
        if (window.marketDataService) {
            this.originalServices.marketDataService = window.marketDataService;
        }
        if (window.tradingService) {
            this.originalServices.tradingService = window.tradingService;
        }

        // Replace with mock services
        this.setupMockServices();
    }

    /**
     * Disable test mode and restore original services
     */
    disableTestMode() {
        this.testMode = false;
        console.log('🧪 API Testing Framework: Test mode disabled');
        
        // Restore original services
        Object.keys(this.originalServices).forEach(serviceName => {
            window[serviceName] = this.originalServices[serviceName];
        });
        this.originalServices = {};
    }

    /**
     * Setup mock services for testing
     */
    setupMockServices() {
        // Mock Market Data Service
        window.marketDataService = {
            getQuote: async (symbol) => {
                await this.simulateDelay(100, 500);
                const quote = this.mockData.quotes[symbol];
                if (!quote) {
                    throw new Error(`Symbol ${symbol} not found`);
                }
                return quote;
            },
            subscribe: (symbol, callback) => {
                console.log(`📊 Mock: Subscribed to ${symbol}`);
                // Simulate real-time updates
                const interval = setInterval(() => {
                    const quote = this.mockData.quotes[symbol];
                    if (quote) {
                        // Add small random price movements
                        const variation = (Math.random() - 0.5) * 0.001;
                        quote.price += variation;
                        quote.bid = quote.price - 0.0001;
                        quote.ask = quote.price + 0.0001;
                        callback(quote);
                    }
                }, 1000);
                return () => clearInterval(interval);
            },
            testConnection: async () => {
                await this.simulateDelay(200, 800);
                return { status: 'connected', latency: Math.floor(Math.random() * 100) + 50 };
            }
        };

        // Mock Trading Service
        window.tradingService = {
            placeOrder: async (orderData) => {
                await this.simulateDelay(300, 1000);
                
                // Simulate order validation
                if (!orderData.symbol || !orderData.side || !orderData.size) {
                    throw new Error('Invalid order data');
                }
                
                // Simulate random order outcomes
                const success = Math.random() > 0.1; // 90% success rate
                if (success) {
                    const orderId = 'TEST_' + Date.now();
                    return {
                        orderId,
                        status: 'filled',
                        executedPrice: this.mockData.quotes[orderData.symbol]?.price || orderData.price,
                        executedSize: orderData.size,
                        timestamp: new Date().toISOString()
                    };
                } else {
                    throw new Error('Order rejected: Insufficient margin');
                }
            },
            closePosition: async (positionId) => {
                await this.simulateDelay(200, 600);
                const position = this.mockData.positions.find(p => p.id === positionId);
                if (!position) {
                    throw new Error('Position not found');
                }
                return {
                    positionId,
                    status: 'closed',
                    closedPrice: position.currentPrice,
                    pnl: position.pnl,
                    timestamp: new Date().toISOString()
                };
            },
            getPositions: async () => {
                await this.simulateDelay(100, 300);
                return [...this.mockData.positions];
            },
            getAccountInfo: async () => {
                await this.simulateDelay(150, 400);
                return {
                    balance: 10000,
                    equity: 9770,
                    margin: 500,
                    freeMargin: 9270,
                    marginLevel: 1954
                };
            }
        };
    }

    /**
     * Simulate network delay
     */
    async simulateDelay(min = 100, max = 500) {
        const delay = Math.floor(Math.random() * (max - min)) + min;
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Run a single test
     */
    async runTest(testName, testFunction) {
        console.log(`🧪 Running test: ${testName}`);
        const startTime = Date.now();
        
        try {
            await testFunction();
            const duration = Date.now() - startTime;
            const result = { name: testName, status: 'passed', duration, error: null };
            this.testResults.push(result);
            console.log(`✅ Test passed: ${testName} (${duration}ms)`);
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            const result = { name: testName, status: 'failed', duration, error: error.message };
            this.testResults.push(result);
            console.error(`❌ Test failed: ${testName} (${duration}ms)`, error);
            return result;
        }
    }

    /**
     * Run all API integration tests
     */
    async runAllTests() {
        console.log('🧪 Starting API Integration Tests...');
        this.testResults = [];
        this.enableTestMode();

        try {
            // Market Data Tests
            await this.runTest('Market Data - Get Quote', async () => {
                const quote = await window.marketDataService.getQuote('EURUSD');
                if (!quote || !quote.price) throw new Error('Invalid quote data');
            });

            await this.runTest('Market Data - Invalid Symbol', async () => {
                try {
                    await window.marketDataService.getQuote('INVALID');
                    throw new Error('Should have thrown an error for invalid symbol');
                } catch (error) {
                    if (!error.message.includes('not found')) {
                        throw error;
                    }
                }
            });

            await this.runTest('Market Data - Connection Test', async () => {
                const result = await window.marketDataService.testConnection();
                if (!result || result.status !== 'connected') {
                    throw new Error('Connection test failed');
                }
            });

            // Trading Tests
            await this.runTest('Trading - Place Valid Order', async () => {
                const order = {
                    symbol: 'EURUSD',
                    side: 'buy',
                    size: 10000,
                    type: 'market'
                };
                const result = await window.tradingService.placeOrder(order);
                if (!result || !result.orderId) throw new Error('Invalid order result');
            });

            await this.runTest('Trading - Invalid Order', async () => {
                try {
                    await window.tradingService.placeOrder({});
                    throw new Error('Should have thrown an error for invalid order');
                } catch (error) {
                    if (!error.message.includes('Invalid order data')) {
                        throw error;
                    }
                }
            });

            await this.runTest('Trading - Get Positions', async () => {
                const positions = await window.tradingService.getPositions();
                if (!Array.isArray(positions)) throw new Error('Positions should be an array');
            });

            await this.runTest('Trading - Get Account Info', async () => {
                const account = await window.tradingService.getAccountInfo();
                if (!account || typeof account.balance !== 'number') {
                    throw new Error('Invalid account info');
                }
            });

            await this.runTest('Trading - Close Position', async () => {
                const result = await window.tradingService.closePosition('POS_001');
                if (!result || !result.positionId) throw new Error('Invalid close result');
            });

            // Performance Tests
            await this.runTest('Performance - Multiple Quotes', async () => {
                const symbols = ['EURUSD', 'GBPUSD', 'AAPL'];
                const promises = symbols.map(symbol => window.marketDataService.getQuote(symbol));
                const results = await Promise.all(promises);
                if (results.length !== symbols.length) {
                    throw new Error('Not all quotes retrieved');
                }
            });

        } finally {
            this.disableTestMode();
        }

        this.generateTestReport();
        return this.testResults;
    }

    /**
     * Generate and display test report
     */
    generateTestReport() {
        const passed = this.testResults.filter(r => r.status === 'passed').length;
        const failed = this.testResults.filter(r => r.status === 'failed').length;
        const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

        console.log('\n📊 Test Report:');
        console.log(`Total Tests: ${this.testResults.length}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);
        console.log(`Total Duration: ${totalDuration}ms`);

        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults.filter(r => r.status === 'failed').forEach(test => {
                console.log(`  - ${test.name}: ${test.error}`);
            });
        }

        // Store results in localStorage for later analysis
        localStorage.setItem('api_test_results', JSON.stringify({
            timestamp: new Date().toISOString(),
            results: this.testResults,
            summary: { passed, failed, totalDuration }
        }));
    }

    /**
     * Create a test dashboard UI
     */
    createTestDashboard() {
        const dashboard = document.createElement('div');
        dashboard.id = 'api-test-dashboard';
        dashboard.innerHTML = `
            <div style="position: fixed; top: 10px; right: 10px; background: white; border: 2px solid #007bff; border-radius: 8px; padding: 15px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); z-index: 10000; max-width: 300px;">
                <h4 style="margin: 0 0 10px 0; color: #007bff;">🧪 API Testing</h4>
                <button id="run-tests-btn" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Run Tests</button>
                <button id="toggle-test-mode-btn" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Test Mode</button>
                <div id="test-status" style="margin-top: 10px; font-size: 12px;"></div>
                <div id="test-results" style="margin-top: 10px; max-height: 200px; overflow-y: auto;"></div>
            </div>
        `;

        document.body.appendChild(dashboard);

        // Event listeners
        document.getElementById('run-tests-btn').addEventListener('click', async () => {
            document.getElementById('test-status').innerHTML = '🔄 Running tests...';
            await this.runAllTests();
            this.updateDashboard();
        });

        document.getElementById('toggle-test-mode-btn').addEventListener('click', () => {
            if (this.testMode) {
                this.disableTestMode();
                document.getElementById('toggle-test-mode-btn').textContent = 'Test Mode';
                document.getElementById('toggle-test-mode-btn').style.background = '#28a745';
            } else {
                this.enableTestMode();
                document.getElementById('toggle-test-mode-btn').textContent = 'Live Mode';
                document.getElementById('toggle-test-mode-btn').style.background = '#dc3545';
            }
        });
    }

    /**
     * Update test dashboard with results
     */
    updateDashboard() {
        const statusDiv = document.getElementById('test-status');
        const resultsDiv = document.getElementById('test-results');
        
        if (!statusDiv || !resultsDiv) return;

        const passed = this.testResults.filter(r => r.status === 'passed').length;
        const failed = this.testResults.filter(r => r.status === 'failed').length;
        
        statusDiv.innerHTML = `
            <div style="color: ${failed === 0 ? '#28a745' : '#dc3545'}; font-weight: bold;">
                ${passed}/${this.testResults.length} tests passed
            </div>
        `;

        resultsDiv.innerHTML = this.testResults.map(test => `
            <div style="padding: 4px; border-left: 3px solid ${test.status === 'passed' ? '#28a745' : '#dc3545'}; margin: 2px 0; background: #f8f9fa;">
                <div style="font-weight: bold; font-size: 11px;">${test.status === 'passed' ? '✅' : '❌'} ${test.name}</div>
                ${test.error ? `<div style="color: #dc3545; font-size: 10px;">${test.error}</div>` : ''}
                <div style="color: #6c757d; font-size: 10px;">${test.duration}ms</div>
            </div>
        `).join('');
    }
}

// Initialize testing framework
window.apiTestingFramework = new APITestingFramework();

// Auto-create dashboard in development mode
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    document.addEventListener('DOMContentLoaded', () => {
        window.apiTestingFramework.createTestDashboard();
    });
}