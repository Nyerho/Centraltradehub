class PortfolioManager {
    constructor() {
        this.positions = new Map();
        this.transactions = [];
        this.portfolioValue = 0;
        this.initialCapital = 10000;
        this.riskMetrics = new RiskCalculator();
        this.performanceAnalyzer = new PerformanceAnalyzer();
        this.eventListeners = new Map();
        this.init();
    }

    init() {
        this.loadPortfolioData();
        this.setupEventListeners();
        this.startRealTimeUpdates();
    }

    // Position Management
    addPosition(symbol, quantity, price, type = 'long') {
        const positionId = this.generatePositionId();
        const position = {
            id: positionId,
            symbol,
            quantity,
            entryPrice: price,
            currentPrice: price,
            type,
            openTime: new Date(),
            unrealizedPnL: 0,
            realizedPnL: 0,
            status: 'open'
        };

        this.positions.set(positionId, position);
        this.recordTransaction('open', position);
        this.updatePortfolioMetrics();
        this.emit('positionAdded', position);
        return positionId;
    }

    closePosition(positionId, price) {
        const position = this.positions.get(positionId);
        if (!position || position.status !== 'open') {
            throw new Error('Position not found or already closed');
        }

        position.closePrice = price;
        position.closeTime = new Date();
        position.status = 'closed';
        position.realizedPnL = this.calculateRealizedPnL(position);

        this.recordTransaction('close', position);
        this.updatePortfolioMetrics();
        this.emit('positionClosed', position);
        return position;
    }

    updatePositionPrice(positionId, newPrice) {
        const position = this.positions.get(positionId);
        if (position && position.status === 'open') {
            position.currentPrice = newPrice;
            position.unrealizedPnL = this.calculateUnrealizedPnL(position);
            this.updatePortfolioMetrics();
            this.emit('positionUpdated', position);
        }
    }

    // P&L Calculations
    calculateUnrealizedPnL(position) {
        const priceDiff = position.currentPrice - position.entryPrice;
        const multiplier = position.type === 'long' ? 1 : -1;
        return priceDiff * position.quantity * multiplier;
    }

    calculateRealizedPnL(position) {
        const priceDiff = position.closePrice - position.entryPrice;
        const multiplier = position.type === 'long' ? 1 : -1;
        return priceDiff * position.quantity * multiplier;
    }

    getTotalUnrealizedPnL() {
        let total = 0;
        for (const position of this.positions.values()) {
            if (position.status === 'open') {
                total += position.unrealizedPnL || 0;
            }
        }
        return total;
    }

    getTotalRealizedPnL() {
        let total = 0;
        for (const position of this.positions.values()) {
            if (position.status === 'closed') {
                total += position.realizedPnL || 0;
            }
        }
        return total;
    }

    // Portfolio Analytics
    getPortfolioSummary() {
        const openPositions = Array.from(this.positions.values())
            .filter(p => p.status === 'open');
        const closedPositions = Array.from(this.positions.values())
            .filter(p => p.status === 'closed');

        return {
            totalValue: this.portfolioValue,
            totalUnrealizedPnL: this.getTotalUnrealizedPnL(),
            totalRealizedPnL: this.getTotalRealizedPnL(),
            openPositions: openPositions.length,
            closedPositions: closedPositions.length,
            totalReturn: this.calculateTotalReturn(),
            totalReturnPercent: this.calculateTotalReturnPercent(),
            dayChange: this.calculateDayChange(),
            dayChangePercent: this.calculateDayChangePercent()
        };
    }

    getAssetAllocation() {
        const allocation = new Map();
        let totalValue = 0;

        for (const position of this.positions.values()) {
            if (position.status === 'open') {
                const value = position.quantity * position.currentPrice;
                allocation.set(position.symbol, (allocation.get(position.symbol) || 0) + value);
                totalValue += value;
            }
        }

        const allocationPercent = new Map();
        for (const [symbol, value] of allocation) {
            allocationPercent.set(symbol, (value / totalValue) * 100);
        }

        return allocationPercent;
    }

    // Performance Metrics
    calculateTotalReturn() {
        return this.getTotalRealizedPnL() + this.getTotalUnrealizedPnL();
    }

    calculateTotalReturnPercent() {
        return (this.calculateTotalReturn() / this.initialCapital) * 100;
    }

    calculateDayChange() {
        const today = new Date().toDateString();
        let dayChange = 0;

        for (const transaction of this.transactions) {
            if (transaction.timestamp.toDateString() === today) {
                dayChange += transaction.pnl || 0;
            }
        }

        return dayChange;
    }

    calculateDayChangePercent() {
        const dayChange = this.calculateDayChange();
        const previousValue = this.portfolioValue - dayChange;
        return previousValue !== 0 ? (dayChange / previousValue) * 100 : 0;
    }

    // Risk Management
    calculatePortfolioRisk() {
        return this.riskMetrics.calculatePortfolioRisk(this.positions);
    }

    getPositionSizing(symbol, riskPercent = 2) {
        const accountValue = this.portfolioValue;
        const riskAmount = accountValue * (riskPercent / 100);
        const currentPrice = this.getCurrentPrice(symbol);
        
        return Math.floor(riskAmount / currentPrice);
    }

    // Utility Methods
    generatePositionId() {
        return 'pos_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    recordTransaction(type, position) {
        const transaction = {
            id: 'txn_' + Date.now(),
            type,
            positionId: position.id,
            symbol: position.symbol,
            quantity: position.quantity,
            price: type === 'open' ? position.entryPrice : position.closePrice,
            pnl: type === 'close' ? position.realizedPnL : 0,
            timestamp: new Date()
        };

        this.transactions.push(transaction);
        this.saveTransactionData(transaction);
    }

    updatePortfolioMetrics() {
        let totalValue = this.initialCapital;
        totalValue += this.getTotalRealizedPnL();
        totalValue += this.getTotalUnrealizedPnL();
        
        this.portfolioValue = totalValue;
        this.emit('portfolioUpdated', this.getPortfolioSummary());
    }

    // Event System
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => callback(data));
        }
    }

    // Data Persistence
    savePortfolioData() {
        const data = {
            positions: Array.from(this.positions.entries()),
            transactions: this.transactions,
            portfolioValue: this.portfolioValue,
            initialCapital: this.initialCapital
        };
        localStorage.setItem('portfolioData', JSON.stringify(data));
    }

    loadPortfolioData() {
        const data = localStorage.getItem('portfolioData');
        if (data) {
            const parsed = JSON.parse(data);
            this.positions = new Map(parsed.positions);
            this.transactions = parsed.transactions || [];
            this.portfolioValue = parsed.portfolioValue || this.initialCapital;
            this.initialCapital = parsed.initialCapital || 10000;
        }
    }

    saveTransactionData(transaction) {
        // Save to backend API
        fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transaction)
        }).catch(console.error);
    }

    startRealTimeUpdates() {
        setInterval(() => {
            this.updateAllPositionPrices();
        }, 1000);
    }

    async updateAllPositionPrices() {
        for (const position of this.positions.values()) {
            if (position.status === 'open') {
                try {
                    const newPrice = await this.getCurrentPrice(position.symbol);
                    this.updatePositionPrice(position.id, newPrice);
                } catch (error) {
                    console.error(`Failed to update price for ${position.symbol}:`, error);
                }
            }
        }
    }

    async getCurrentPrice(symbol) {
        // Integration with market data service
        const response = await fetch(`/api/market-data/${symbol}`);
        const data = await response.json();
        return data.price;
    }

    setupEventListeners() {
        // Auto-save on changes
        this.on('positionAdded', () => this.savePortfolioData());
        this.on('positionClosed', () => this.savePortfolioData());
        this.on('positionUpdated', () => this.savePortfolioData());
    }
}

class RiskCalculator {
    calculatePortfolioRisk(positions) {
        const metrics = {
            totalExposure: 0,
            maxDrawdown: 0,
            sharpeRatio: 0,
            volatility: 0,
            var95: 0, // Value at Risk 95%
            beta: 0
        };

        // Calculate total exposure
        for (const position of positions.values()) {
            if (position.status === 'open') {
                metrics.totalExposure += position.quantity * position.currentPrice;
            }
        }

        // Calculate other risk metrics
        metrics.maxDrawdown = this.calculateMaxDrawdown(positions);
        metrics.volatility = this.calculateVolatility(positions);
        metrics.var95 = this.calculateVaR(positions, 0.95);

        return metrics;
    }

    calculateMaxDrawdown(positions) {
        // Simplified max drawdown calculation
        let peak = 0;
        let maxDrawdown = 0;
        let currentValue = 0;

        for (const position of positions.values()) {
            currentValue += position.unrealizedPnL || position.realizedPnL || 0;
            if (currentValue > peak) peak = currentValue;
            const drawdown = (peak - currentValue) / peak;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }

        return maxDrawdown * 100;
    }

    calculateVolatility(positions) {
        // Simplified volatility calculation
        const returns = [];
        for (const position of positions.values()) {
            if (position.entryPrice && position.currentPrice) {
                const return_ = (position.currentPrice - position.entryPrice) / position.entryPrice;
                returns.push(return_);
            }
        }

        if (returns.length < 2) return 0;

        const mean = returns.reduce((a, b) => a + b) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        return Math.sqrt(variance) * 100;
    }

    calculateVaR(positions, confidence) {
        // Simplified VaR calculation
        const returns = [];
        for (const position of positions.values()) {
            if (position.unrealizedPnL !== undefined) {
                returns.push(position.unrealizedPnL);
            }
        }

        if (returns.length === 0) return 0;

        returns.sort((a, b) => a - b);
        const index = Math.floor((1 - confidence) * returns.length);
        return Math.abs(returns[index] || 0);
    }
}

class PerformanceAnalyzer {
    generatePerformanceReport(portfolioManager) {
        const summary = portfolioManager.getPortfolioSummary();
        const allocation = portfolioManager.getAssetAllocation();
        const riskMetrics = portfolioManager.calculatePortfolioRisk();

        return {
            summary,
            allocation: Object.fromEntries(allocation),
            riskMetrics,
            topPerformers: this.getTopPerformers(portfolioManager),
            worstPerformers: this.getWorstPerformers(portfolioManager),
            monthlyReturns: this.calculateMonthlyReturns(portfolioManager),
            tradingStats: this.calculateTradingStats(portfolioManager)
        };
    }

    getTopPerformers(portfolioManager, limit = 5) {
        return Array.from(portfolioManager.positions.values())
            .filter(p => p.status === 'closed')
            .sort((a, b) => (b.realizedPnL || 0) - (a.realizedPnL || 0))
            .slice(0, limit);
    }

    getWorstPerformers(portfolioManager, limit = 5) {
        return Array.from(portfolioManager.positions.values())
            .filter(p => p.status === 'closed')
            .sort((a, b) => (a.realizedPnL || 0) - (b.realizedPnL || 0))
            .slice(0, limit);
    }

    calculateMonthlyReturns(portfolioManager) {
        const monthlyReturns = new Map();
        
        for (const transaction of portfolioManager.transactions) {
            if (transaction.type === 'close' && transaction.pnl) {
                const monthKey = transaction.timestamp.toISOString().substring(0, 7);
                monthlyReturns.set(monthKey, (monthlyReturns.get(monthKey) || 0) + transaction.pnl);
            }
        }

        return Object.fromEntries(monthlyReturns);
    }

    calculateTradingStats(portfolioManager) {
        const closedPositions = Array.from(portfolioManager.positions.values())
            .filter(p => p.status === 'closed');

        const winningTrades = closedPositions.filter(p => (p.realizedPnL || 0) > 0);
        const losingTrades = closedPositions.filter(p => (p.realizedPnL || 0) < 0);

        return {
            totalTrades: closedPositions.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            winRate: closedPositions.length > 0 ? (winningTrades.length / closedPositions.length) * 100 : 0,
            avgWin: winningTrades.length > 0 ? winningTrades.reduce((sum, p) => sum + p.realizedPnL, 0) / winningTrades.length : 0,
            avgLoss: losingTrades.length > 0 ? losingTrades.reduce((sum, p) => sum + p.realizedPnL, 0) / losingTrades.length : 0,
            profitFactor: this.calculateProfitFactor(winningTrades, losingTrades)
        };
    }

    calculateProfitFactor(winningTrades, losingTrades) {
        const totalWins = winningTrades.reduce((sum, p) => sum + p.realizedPnL, 0);
        const totalLosses = Math.abs(losingTrades.reduce((sum, p) => sum + p.realizedPnL, 0));
        return totalLosses > 0 ? totalWins / totalLosses : 0;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PortfolioManager, RiskCalculator, PerformanceAnalyzer };
}