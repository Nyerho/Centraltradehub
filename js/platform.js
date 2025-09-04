// Advanced Trading Platform JavaScript
class TradingPlatform {
    constructor() {
        this.currentSymbol = 'EUR/USD';
        this.orderType = 'buy';
        this.positions = [];
        this.orders = [];
        this.chartData = [];
        this.init();
    }

    init() {
        this.initOrderForm();
        this.initWatchlist();
        this.initChart();
        this.initPositionsTable();
        this.startRealTimeUpdates();
    }

    initOrderForm() {
        const orderForm = document.getElementById('orderForm');
        const tabBtns = document.querySelectorAll('.tab-btn');
        const orderTypeSelect = document.querySelector('select[name="orderType"]');
        const priceGroup = document.querySelector('.price-group');
        const orderBtn = document.querySelector('.order-btn');

        // Tab switching
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.orderType = btn.dataset.tab;
                this.updateOrderButton();
            });
        });

        // Order type change
        if (orderTypeSelect) {
            orderTypeSelect.addEventListener('change', (e) => {
                if (e.target.value === 'limit' || e.target.value === 'stop') {
                    priceGroup.style.display = 'block';
                } else {
                    priceGroup.style.display = 'none';
                }
            });
        }

        // Form submission
        if (orderForm) {
            orderForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.placeOrder(new FormData(orderForm));
            });
        }
    }

    initWatchlist() {
        const watchlistItems = document.querySelectorAll('.watchlist-item');
        watchlistItems.forEach(item => {
            item.addEventListener('click', () => {
                watchlistItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                const symbol = item.querySelector('.symbol').textContent;
                this.switchSymbol(symbol);
            });
        });
    }

    initChart() {
        const chartBtns = document.querySelectorAll('.chart-btn');
        chartBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                chartBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateChart(btn.textContent);
            });
        });

        this.renderChart();
    }

    renderChart() {
        const chartArea = document.getElementById('tradingChart');
        if (!chartArea) return;

        // Create advanced chart visualization
        chartArea.innerHTML = `
            <div class="advanced-chart">
                <div class="chart-info">
                    <div class="price-display">
                        <span class="current-price">1.0856</span>
                        <span class="price-change positive">+0.0023 (+0.21%)</span>
                    </div>
                    <div class="chart-indicators">
                        <div class="indicator">
                            <span class="label">High:</span>
                            <span class="value">1.0892</span>
                        </div>
                        <div class="indicator">
                            <span class="label">Low:</span>
                            <span class="value">1.0834</span>
                        </div>
                        <div class="indicator">
                            <span class="label">Volume:</span>
                            <span class="value">2.4M</span>
                        </div>
                    </div>
                </div>
                <canvas id="priceChart" width="800" height="300"></canvas>
                <div class="chart-tools">
                    <button class="tool-btn active" data-tool="crosshair"><i class="fas fa-crosshairs"></i></button>
                    <button class="tool-btn" data-tool="trendline"><i class="fas fa-chart-line"></i></button>
                    <button class="tool-btn" data-tool="rectangle"><i class="far fa-square"></i></button>
                    <button class="tool-btn" data-tool="fibonacci"><i class="fas fa-wave-square"></i></button>
                </div>
            </div>
        `;

        this.drawChart();
    }

    drawChart() {
        const canvas = document.getElementById('priceChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Generate sample candlestick data
        const candleData = this.generateCandleData(50);
        const candleWidth = width / candleData.length;

        // Draw grid
        this.drawGrid(ctx, width, height);

        // Draw candlesticks
        candleData.forEach((candle, index) => {
            const x = index * candleWidth + candleWidth / 2;
            this.drawCandle(ctx, x, candle, height, candleWidth * 0.8);
        });

        // Draw moving averages
        this.drawMovingAverage(ctx, candleData, width, height, 20, '#00d4ff');
        this.drawMovingAverage(ctx, candleData, width, height, 50, '#ff6b35');
    }

    generateCandleData(count) {
        const data = [];
        let price = 1.0856;
        
        for (let i = 0; i < count; i++) {
            const change = (Math.random() - 0.5) * 0.01;
            const open = price;
            const close = price + change;
            const high = Math.max(open, close) + Math.random() * 0.005;
            const low = Math.min(open, close) - Math.random() * 0.005;
            
            data.push({ open, high, low, close });
            price = close;
        }
        
        return data;
    }

    drawGrid(ctx, width, height) {
        ctx.strokeStyle = '#2d2d44';
        ctx.lineWidth = 1;
        
        // Horizontal lines
        for (let i = 0; i <= 10; i++) {
            const y = (height / 10) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Vertical lines
        for (let i = 0; i <= 10; i++) {
            const x = (width / 10) * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }

    drawCandle(ctx, x, candle, height, width) {
        const { open, high, low, close } = candle;
        const priceRange = 0.02; // Adjust based on data range
        const minPrice = 1.075;
        
        const openY = height - ((open - minPrice) / priceRange) * height;
        const closeY = height - ((close - minPrice) / priceRange) * height;
        const highY = height - ((high - minPrice) / priceRange) * height;
        const lowY = height - ((low - minPrice) / priceRange) * height;
        
        const isGreen = close > open;
        
        // Draw wick
        ctx.strokeStyle = isGreen ? '#28a745' : '#dc3545';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();
        
        // Draw body
        ctx.fillStyle = isGreen ? '#28a745' : '#dc3545';
        const bodyHeight = Math.abs(closeY - openY);
        const bodyY = Math.min(openY, closeY);
        ctx.fillRect(x - width/2, bodyY, width, bodyHeight || 1);
    }

    drawMovingAverage(ctx, data, width, height, period, color) {
        if (data.length < period) return;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const candleWidth = width / data.length;
        const priceRange = 0.02;
        const minPrice = 1.075;
        
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1).reduce((acc, candle) => acc + candle.close, 0);
            const avg = sum / period;
            const x = i * candleWidth + candleWidth / 2;
            const y = height - ((avg - minPrice) / priceRange) * height;
            
            if (i === period - 1) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
    }

    placeOrder(formData) {
        const order = {
            id: Date.now(),
            symbol: formData.get('symbol'),
            type: this.orderType,
            volume: parseFloat(formData.get('volume')),
            orderType: formData.get('orderType'),
            price: formData.get('price') ? parseFloat(formData.get('price')) : null,
            timestamp: new Date(),
            status: 'pending'
        };

        if (order.orderType === 'market') {
            this.executeOrder(order);
        } else {
            this.orders.push(order);
            this.updateOrdersTable();
        }

        this.showNotification(`${order.type.toUpperCase()} order placed for ${order.symbol}`, 'success');
    }

    executeOrder(order) {
        const position = {
            id: order.id,
            symbol: order.symbol,
            type: order.type,
            volume: order.volume,
            openPrice: this.getCurrentPrice(order.symbol),
            currentPrice: this.getCurrentPrice(order.symbol),
            pnl: 0,
            timestamp: new Date()
        };

        this.positions.push(position);
        this.updatePositionsTable();
        this.updateAccountInfo();
    }

    getCurrentPrice(symbol) {
        const prices = {
            'EURUSD': 1.0856,
            'GBPUSD': 1.2734,
            'USDJPY': 149.82,
            'BTCUSD': 43250
        };
        return prices[symbol] || 1.0000;
    }

    updatePositionsTable() {
        const tbody = document.querySelector('.positions-table tbody');
        if (!tbody) return;

        tbody.innerHTML = this.positions.map(position => `
            <tr>
                <td>${position.symbol}</td>
                <td class="${position.type}">${position.type.toUpperCase()}</td>
                <td>${position.volume}</td>
                <td>${position.openPrice.toFixed(4)}</td>
                <td>${position.currentPrice.toFixed(4)}</td>
                <td class="${position.pnl >= 0 ? 'positive' : 'negative'}">$${position.pnl.toFixed(2)}</td>
                <td><button class="close-btn" onclick="platform.closePosition(${position.id})">Close</button></td>
            </tr>
        `).join('');
    }

    updateOrdersTable() {
        const tbody = document.querySelector('.orders-table tbody');
        if (!tbody) return;

        tbody.innerHTML = this.orders.map(order => `
            <tr>
                <td>${order.symbol}</td>
                <td class="${order.type}">${order.type.toUpperCase()} ${order.orderType.toUpperCase()}</td>
                <td>${order.volume}</td>
                <td>${order.price ? order.price.toFixed(4) : 'Market'}</td>
                <td class="pending">${order.status}</td>
                <td><button class="cancel-btn" onclick="platform.cancelOrder(${order.id})">Cancel</button></td>
            </tr>
        `).join('');
    }

    closePosition(positionId) {
        this.positions = this.positions.filter(p => p.id !== positionId);
        this.updatePositionsTable();
        this.updateAccountInfo();
        this.showNotification('Position closed successfully', 'success');
    }

    cancelOrder(orderId) {
        this.orders = this.orders.filter(o => o.id !== orderId);
        this.updateOrdersTable();
        this.showNotification('Order cancelled', 'info');
    }

    updateAccountInfo() {
        const totalPnL = this.positions.reduce((sum, pos) => sum + pos.pnl, 0);
        const pnlElement = document.querySelector('.pnl');
        if (pnlElement) {
            pnlElement.textContent = `P&L: ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`;
            pnlElement.className = `pnl ${totalPnL >= 0 ? 'positive' : 'negative'}`;
        }
    }

    switchSymbol(symbol) {
        this.currentSymbol = symbol;
        document.querySelector('.chart-header h2').textContent = symbol;
        this.updateOrderButton();
        this.renderChart();
    }

    updateOrderButton() {
        const orderBtn = document.querySelector('.order-btn');
        if (orderBtn) {
            orderBtn.textContent = `${this.orderType.toUpperCase()} ${this.currentSymbol}`;
            orderBtn.className = `order-btn ${this.orderType}-btn`;
        }
    }

    updateChart(timeframe) {
        // Simulate chart update for different timeframes
        this.renderChart();
        this.showNotification(`Chart updated to ${timeframe} timeframe`, 'info');
    }

    startRealTimeUpdates() {
        setInterval(() => {
            this.updatePositionsPnL();
            this.updatePriceDisplay();
        }, 2000);
    }

    updatePositionsPnL() {
        this.positions.forEach(position => {
            const currentPrice = this.getCurrentPrice(position.symbol) + (Math.random() - 0.5) * 0.01;
            position.currentPrice = currentPrice;
            
            const priceDiff = position.type === 'buy' 
                ? currentPrice - position.openPrice
                : position.openPrice - currentPrice;
            
            position.pnl = priceDiff * position.volume * 100000; // Assuming standard lot size
        });
        
        this.updatePositionsTable();
        this.updateAccountInfo();
    }

    updatePriceDisplay() {
        const priceDisplay = document.querySelector('.current-price');
        const changeDisplay = document.querySelector('.price-change');
        
        if (priceDisplay && changeDisplay) {
            const newPrice = this.getCurrentPrice(this.currentSymbol) + (Math.random() - 0.5) * 0.01;
            const change = newPrice - this.getCurrentPrice(this.currentSymbol);
            
            priceDisplay.textContent = newPrice.toFixed(4);
            changeDisplay.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(4)} (${((change / newPrice) * 100).toFixed(2)}%)`;
            changeDisplay.className = `price-change ${change >= 0 ? 'positive' : 'negative'}`;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Initialize platform when DOM is loaded
let platform;
document.addEventListener('DOMContentLoaded', () => {
    platform = new TradingPlatform();
});