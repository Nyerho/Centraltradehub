// Real-time market data simulation
class MarketData {
    constructor() {
        this.symbols = {
            'EUR/USD': { price: 1.0856, change: 0.0023 },
            'GBP/USD': { price: 1.2734, change: -0.0045 },
            'USD/JPY': { price: 149.82, change: 0.34 },
            'BTC/USD': { price: 43250, change: 1250 },
            'GOLD': { price: 2045.30, change: -12.50 }
        };
        this.updateInterval = 3000; // 3 seconds
        this.startUpdates();
    }

    generateRandomChange(basePrice, maxChangePercent = 0.1) {
        const maxChange = basePrice * (maxChangePercent / 100);
        return (Math.random() - 0.5) * 2 * maxChange;
    }

    updatePrices() {
        Object.keys(this.symbols).forEach(symbol => {
            const data = this.symbols[symbol];
            const change = this.generateRandomChange(data.price);
            data.price += change;
            data.change = change;
            
            // Update DOM elements
            const tickerItem = document.querySelector(`[data-symbol="${symbol}"]`);
            if (tickerItem) {
                const priceElement = tickerItem.querySelector('.price');
                const changeElement = tickerItem.querySelector('.change');
                
                if (priceElement) {
                    if (symbol === 'BTC/USD') {
                        priceElement.textContent = Math.round(data.price).toLocaleString();
                    } else {
                        priceElement.textContent = data.price.toFixed(symbol.includes('/') ? 4 : 2);
                    }
                }
                
                if (changeElement) {
                    const changeText = data.change > 0 ? `+${data.change.toFixed(2)}` : data.change.toFixed(2);
                    changeElement.textContent = changeText;
                    changeElement.className = `change ${data.change >= 0 ? 'positive' : 'negative'}`;
                }
            }
        });
    }

    startUpdates() {
        // Update ticker items with data attributes
        document.querySelectorAll('.ticker-item').forEach((item, index) => {
            const symbols = Object.keys(this.symbols);
            if (symbols[index]) {
                item.setAttribute('data-symbol', symbols[index]);
            }
        });

        // Start periodic updates
        setInterval(() => {
            this.updatePrices();
        }, this.updateInterval);
    }
}

// Initialize market data when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MarketData();
});

// Trading chart simulation (placeholder for real charting library)
class TradingChart {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.initChart();
    }

    initChart() {
        if (!this.container) return;
        
        // This would integrate with a real charting library like TradingView, Chart.js, or D3.js
        this.container.innerHTML = `
            <div class="chart-placeholder">
                <h3>Live Trading Chart</h3>
                <p>Real-time market data visualization would appear here</p>
                <div class="chart-controls">
                    <button class="chart-btn active">1M</button>
                    <button class="chart-btn">5M</button>
                    <button class="chart-btn">15M</button>
                    <button class="chart-btn">1H</button>
                    <button class="chart-btn">4H</button>
                    <button class="chart-btn">1D</button>
                </div>
            </div>
        `;
    }
}