// Dashboard functionality with real user data
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class DashboardManager {
    constructor() {
        this.currentSection = 'overview';
        this.portfolioChart = null;
        this.userProfileService = null;
        this.accountData = {};
        this.currentChart = null;
        this.leaderboardTransactions = [];
        this.leaderboardInterval = null;
        this.chartSymbols = {
            indices: {
                'S&P 500': 'TVC:SPX',
                'NASDAQ': 'NASDAQ:NDX',
                'Dow Jones': 'TVC:DJI',
                'FTSE 100': 'TVC:UKX',
                'DAX': 'TVC:DAX',
                'Nikkei 225': 'TVC:NI225',
                'Hang Seng': 'TVC:HSI',
                'ASX 200': 'TVC:XJO'
            },
            forex: {
                'EUR/USD': 'FX:EURUSD',
                'GBP/USD': 'FX:GBPUSD',
                'USD/JPY': 'FX:USDJPY',
                'USD/CHF': 'FX:USDCHF',
                'AUD/USD': 'FX:AUDUSD',
                'USD/CAD': 'FX:USDCAD',
                'NZD/USD': 'FX:NZDUSD',
                'EUR/GBP': 'FX:EURGBP',
                'EUR/JPY': 'FX:EURJPY',
                'GBP/JPY': 'FX:GBPJPY'
            },
            crypto: {
                'BTC/USD': 'BINANCE:BTCUSDT',
                'ETH/USD': 'BINANCE:ETHUSDT',
                'BNB/USD': 'BINANCE:BNBUSDT',
                'ADA/USD': 'BINANCE:ADAUSDT',
                'SOL/USD': 'BINANCE:SOLUSDT',
                'DOT/USD': 'BINANCE:DOTUSDT',
                'AVAX/USD': 'BINANCE:AVAXUSDT',
                'MATIC/USD': 'BINANCE:MATICUSDT'
            },
            commodities: {
                'Gold': 'TVC:GOLD',
                'Silver': 'TVC:SILVER',
                'Oil (WTI)': 'NYMEX:CL1!',
                'Oil (Brent)': 'NYMEX:BZ1!',
                'Natural Gas': 'NYMEX:NG1!',
                'Copper': 'COMEX:HG1!',
                'Platinum': 'NYMEX:PL1!',
                'Palladium': 'NYMEX:PA1!'
            },
            bonds: {
                'US 10Y': 'TVC:TNX',
                'US 30Y': 'TVC:TYX',
                'US 2Y': 'TVC:US02Y',
                'German 10Y': 'TVC:DE10Y',
                'UK 10Y': 'TVC:GB10Y',
                'Japan 10Y': 'TVC:JP10Y'
            }
        };
        this.init();
    }

    init() {
        this.initializeAuth();
        this.setupMobileMenu();
        this.initializeTradingTabs();
        this.setupAssetSelectors();
        this.startRealTimeUpdates();
        this.initializeLeaderboard();
    }

    // FIXED: Use AuthManager instead of direct Firebase listener
    async initializeAuth() {
        // Wait for AuthManager to be available
        while (!window.authManager) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Use AuthManager's unified auth system
        const user = window.authManager.currentUser;
        if (user) {
            console.log('User authenticated via AuthManager:', user.email);
            await this.loadUserData(user);
            await this.loadAccountData(user);
        } else {
            console.log('No user authenticated - redirecting to login');
            window.location.href = 'auth.html';
        }
        
        // Listen for auth state changes through AuthManager
        window.authManager.onAuthStateChanged(async (user) => {
            if (user) {
                await this.loadUserData(user);
                await this.loadAccountData(user);
            } else {
                window.location.href = 'auth.html';
            }
        });
    }

    handleAuthError() {
        const userEmailElement = document.getElementById('userEmail');
        const userNameElement = document.getElementById('dashboard-user-name');
        
        if (userEmailElement) {
            userEmailElement.textContent = 'Authentication Error';
        }
        if (userNameElement) {
            userNameElement.textContent = 'Please refresh and try again';
        }
        
        this.showNotification('Authentication failed. Please refresh the page.', 'error');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
        `;
        
        // Add styles if not already present
        if (!document.getElementById('notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 20px;
                    border-radius: 5px;
                    color: white;
                    z-index: 10000;
                    max-width: 400px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }
                .notification.info { background-color: #3498db; }
                .notification.success { background-color: #2ecc71; }
                .notification.warning { background-color: #f39c12; }
                .notification.error { background-color: #e74c3c; }
                .notification-content { display: flex; justify-content: space-between; align-items: center; }
                .notification-close { background: none; border: none; color: white; font-size: 18px; cursor: pointer; }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    async loadUserData(user) {
        try {
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                // Update user email
                const userEmailElement = document.getElementById('userEmail');
                if (userEmailElement) {
                    userEmailElement.textContent = user.email || 'No email';
                } else {
                    console.warn('userEmail element not found');
                }
                
                // Update user name in header
                const userNameElement = document.getElementById('dashboard-user-name');
                // Update user name in trading interface
                const tradingUserNameElement = document.getElementById('trading-user-name');
                
                const displayName = userData.firstName && userData.lastName 
                    ? `${userData.firstName} ${userData.lastName}`
                    : userData.displayName || user.displayName || 'User';
                
                if (userNameElement) {
                    userNameElement.textContent = displayName;
                } else {
                    console.warn('dashboard-user-name element not found');
                }
                
                // Fix: Update trading interface user name
                if (tradingUserNameElement) {
                    tradingUserNameElement.textContent = displayName;
                } else {
                    console.warn('trading interface user-name element not found');
                }
                
                // Load KYC status
                await this.loadUserKYCStatus(user);
                
            } else {
                console.log('No user document found, creating default');
                // Create default user document
                const defaultUserData = {
                    email: user.email,
                    displayName: user.displayName || 'User',
                    createdAt: new Date().toISOString(),
                    kycStatus: 'unverified'
                };
                
                await setDoc(userRef, defaultUserData);
                
                // Update UI with default data
                const userEmailElement = document.getElementById('userEmail');
                const userNameElement = document.getElementById('dashboard-user-name');
                
                if (userEmailElement) userEmailElement.textContent = user.email;
                if (userNameElement) userNameElement.textContent = defaultUserData.displayName;
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            this.showErrorState();
        }
    }

    async loadAccountData(user) {
        try {
            const accountRef = doc(db, 'accounts', user.uid);
            const accountDoc = await getDoc(accountRef);
            
            if (accountDoc.exists()) {
                this.accountData = accountDoc.data();
            } else {
                // Create default account
                this.accountData = {
                    balance: 0,
                    currency: 'USD',
                    createdAt: new Date().toISOString()
                };
                await setDoc(accountRef, this.accountData);
            }
            
            this.updateAccountSummary();
            
        } catch (error) {
            console.error('Error loading account data:', error);
            this.showErrorState();
        }
    }

    updateAccountSummary() {
        const balanceElement = document.getElementById('walletBalance');
        const accountBalanceElement = document.getElementById('accountBalance');
        
        if (balanceElement) {
            // Remove $ prefix since USD is already shown in HTML
            balanceElement.textContent = `${(this.accountData.balance || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;
        }
        
        if (accountBalanceElement) {
            accountBalanceElement.textContent = `$${(this.accountData.balance || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;
        }
        
        this.updateChangeIndicators();
    }

    updateChangeIndicators() {
        // Get previous balance from localStorage for change calculation
        const previousBalance = parseFloat(localStorage.getItem('previousBalance') || '0');
        const currentBalance = this.accountData.balance || 0;
        const change = currentBalance - previousBalance;
        const changePercent = previousBalance > 0 ? (change / previousBalance) * 100 : 0;
        
        // Store current balance for next comparison
        localStorage.setItem('previousBalance', currentBalance.toString());
        
        // Update change indicators if elements exist
        const changeElements = document.querySelectorAll('.change-indicator');
        changeElements.forEach(element => {
            element.textContent = `${change >= 0 ? '+' : ''}$${change.toFixed(2)} (${changePercent.toFixed(2)}%)`;
            element.className = `change-indicator ${change >= 0 ? 'positive' : 'negative'}`;
        });
    }

    showErrorState() {
        const userEmailElement = document.getElementById('userEmail');
        const userNameElement = document.getElementById('dashboard-user-name');
        const balanceElement = document.getElementById('walletBalance');
        
        if (userEmailElement) {
            userEmailElement.textContent = 'Error loading email';
        }
        if (userNameElement) {
            userNameElement.textContent = 'Error loading name';
        }
        if (balanceElement) {
            balanceElement.textContent = 'Error loading data';
        }
        
        this.showNotification('Failed to load user data. Please refresh the page.', 'error');
    }

    setupMobileMenu() {
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.querySelector('.sidebar');
        
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
            });
            
            // Close sidebar when clicking outside
            document.addEventListener('click', (e) => {
                if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                    sidebar.classList.remove('active');
                }
            });
        }
    }

    initializeTradingTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                // Remove active class from all buttons
                tabButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');
                
                // Load corresponding chart
                const category = e.target.getAttribute('data-category');
                const symbol = e.target.getAttribute('data-symbol') || Object.keys(this.chartSymbols[category])[0];
                this.loadTradingViewChart(category, symbol);
            });
        });
        
        // Add asset selector for each category
        this.setupAssetSelectors();
    }
    
    setupAssetSelectors() {
        const categories = Object.keys(this.chartSymbols);
        categories.forEach(category => {
            const container = document.querySelector(`[data-category="${category}"]`)?.parentElement;
            if (container && !container.querySelector('.asset-selector')) {
                const selector = document.createElement('select');
                selector.className = 'asset-selector';
                selector.style.marginLeft = '10px';
                
                Object.keys(this.chartSymbols[category]).forEach(assetName => {
                    const option = document.createElement('option');
                    option.value = assetName;
                    option.textContent = assetName;
                    selector.appendChild(option);
                });
                
                selector.addEventListener('change', (e) => {
                    this.loadTradingViewChart(category, e.target.value);
                });
                
                container.appendChild(selector);
            }
        });
    }
    
    loadTradingViewChart(category, assetName) {
        const symbol = this.chartSymbols[category]?.[assetName] || this.chartSymbols.indices['S&P 500'];
        const container = document.getElementById('tradingview-chart-widget');
        
        if (!container) {
            console.error('TradingView chart container not found');
            return;
        }
        
        // Clear existing chart
        container.innerHTML = '';
        
        // Create new TradingView widget with proper configuration
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
        script.async = true;
        
        const config = {
            "autosize": true,
            "symbol": symbol,
            "interval": "D",
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1",
            "locale": "en",
            "toolbar_bg": "#1a1a2e",
            "enable_publishing": false,
            "allow_symbol_change": true,
            "container_id": "tradingview-chart-widget",
            "hide_top_toolbar": false,
            "hide_legend": false,
            "hide_side_toolbar": false,
            "studies": [
                "Volume@tv-basicstudies",
                "MACD@tv-basicstudies"
            ],
            "show_popup_button": false,
            "popup_width": "1000",
            "popup_height": "650",
            "withdateranges": true,
            "hide_volume": false,
            "support_host": "https://www.tradingview.com"
        };
        
        script.innerHTML = JSON.stringify(config);
        container.appendChild(script);
        
        console.log(`Loading TradingView chart for ${assetName} (${symbol})`);
    }

    startRealTimeUpdates() {
        // Start real-time data updates
        setInterval(() => {
            this.updateMarketPrices();
        }, 30000); // Update every 30 seconds
    }

    updateMarketPrices() {
        // Market price updates will be implemented here
        console.log('Updating market prices...');
    }
    
    async loadUserKYCStatus(user) {
        try {
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);
            
            const kycStatus = userDoc.exists() ? userDoc.data().kycStatus || 'unverified' : 'unverified';
            this.updateKYCStatus(kycStatus);
        } catch (error) {
            console.error('Error loading KYC status:', error);
            this.updateKYCStatus('unverified');
        }
    }
    
    updateKYCStatus(status) {
        const kycBadge = document.getElementById('kycBadge');
        if (!kycBadge) return;
        
        kycBadge.classList.remove('verified', 'pending', 'unverified');
        
        switch (status) {
            case 'verified':
                kycBadge.classList.add('verified');
                kycBadge.innerHTML = '<i class="fas fa-check-circle"></i><span class="kyc-text">VERIFIED</span>';
                break;
            case 'pending':
                kycBadge.classList.add('pending');
                kycBadge.innerHTML = '<i class="fas fa-clock"></i><span class="kyc-text">PENDING</span>';
                break;
            default:
                kycBadge.classList.add('unverified');
                kycBadge.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span class="kyc-text">KYC</span>';
                break;
        }
        
        // Add click handler
        kycBadge.onclick = () => window.location.href = 'kyc-portal.html';
    }
    
    goToTrading() {
        window.location.href = 'platform.html';
    }

    goToWithdrawal() {
        window.location.href = 'funding.html#withdrawal';
    }

    goToDeposit() {
        window.location.href = 'funding.html';
    }

    goToSupport() {
        window.location.href = 'index.html#contact';
    }

    goToAnalytics() {
        window.location.href = 'platform.html#analytics';
    }

    // Move leaderboard methods inside the class
    initializeLeaderboard() {
        const container = document.getElementById('leaderboardScroll');
        if (!container) {
            console.error('Leaderboard container not found');
            return;
        }
        
        // Generate initial transactions
        this.generateInitialTransactions();
        
        // Start live updates
        this.startLeaderboardUpdates();
    }

    generateInitialTransactions() {
        const usernames = [
            'TradeMaster', 'CryptoKing', 'ForexPro', 'BullRunner', 'MarketWolf',
            'TradingAce', 'PipHunter', 'ChartWiz', 'GoldTrader', 'SwingKing',
            'DayTrader99', 'FXExpert', 'CoinFlip', 'TrendFollower', 'ScalpMaster',
            'OptionsPro', 'FuturesKing', 'RiskTaker', 'ProfitSeeker', 'MarketMover'
        ];

        const transactionTypes = ['deposit', 'withdrawal', 'swap'];
        this.leaderboardTransactions = [];

        for (let i = 0; i < 20; i++) {
            this.leaderboardTransactions.push(this.generateRandomTransaction(usernames, transactionTypes));
        }

        this.updateLeaderboardDisplay();
    }

    generateRandomTransaction(usernames, transactionTypes) {
        const username = usernames[Math.floor(Math.random() * usernames.length)];
        const type = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
        const amount = this.generateRandomAmount(type);

        return {
            username,
            type,
            amount,
            timestamp: Date.now()
        };
    }

    generateRandomAmount(type) {
        let min, max;

        switch (type) {
            case 'deposit':
                min = 100;
                max = 10000;
                break;
            case 'withdrawal':
                min = 50;
                max = 5000;
                break;
            case 'swap':
                min = 25;
                max = 2500;
                break;
            default:
                min = 10;
                max = 1000;
        }

        return (Math.random() * (max - min) + min).toFixed(2);
    }

    updateLeaderboardDisplay() {
        const container = document.getElementById('leaderboardScroll');
        if (!container) {
            console.warn('Leaderboard container not found');
            return;
        }

        const transactionElements = this.leaderboardTransactions.map(transaction => {
            const typeClass = transaction.type === 'deposit' ? 'positive' : 
                            transaction.type === 'withdrawal' ? 'negative' : 'neutral';
            
            return `
                <div class="transaction-item ${typeClass}">
                    <span class="username">${transaction.username}</span>
                    <span class="transaction-type">${transaction.type}</span>
                    <span class="amount">$${transaction.amount}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = transactionElements;
        
        // Duplicate content for seamless scrolling
        container.innerHTML += transactionElements;
    }

    startLeaderboardUpdates() {
        if (this.leaderboardInterval) {
            clearInterval(this.leaderboardInterval);
        }

        this.leaderboardInterval = setInterval(() => {
            // Add new transaction
            const usernames = [
                'TradeMaster', 'CryptoKing', 'ForexPro', 'BullRunner', 'MarketWolf',
                'TradingAce', 'PipHunter', 'ChartWiz', 'GoldTrader', 'SwingKing',
                'DayTrader99', 'FXExpert', 'CoinFlip', 'TrendFollower', 'ScalpMaster',
                'OptionsPro', 'FuturesKing', 'RiskTaker', 'ProfitSeeker', 'MarketMover'
            ];
            const transactionTypes = ['deposit', 'withdrawal', 'swap'];
            
            const newTransaction = this.generateRandomTransaction(usernames, transactionTypes);
            this.leaderboardTransactions.unshift(newTransaction);
            
            // Keep only the latest 20 transactions
            if (this.leaderboardTransactions.length > 20) {
                this.leaderboardTransactions = this.leaderboardTransactions.slice(0, 20);
            }
            
            this.updateLeaderboardDisplay();
        }, Math.random() * 2000 + 3000); // Random interval between 3-5 seconds
    }
}

// Global functions
window.handleKYCVerification = () => {
    window.location.href = 'kyc-portal.html';
};

window.openTradingModal = () => {
    const modal = document.getElementById('tradingModal');
    if (modal) modal.style.display = 'block';
};

window.showDeposit = () => {
    window.location.href = 'funding.html';
};

window.showWithdraw = () => {
    window.location.href = 'funding.html#withdrawal';
};

window.goToAnalytics = () => {
    window.location.href = 'platform.html#analytics';
};

window.closePosition = (symbol) => {
    console.log(`Closing position for ${symbol}`);
};

// FIXED: Use AuthManager for logout
window.logout = async () => {
    try {
        if (window.authManager) {
            await window.authManager.logout();
            // Let AuthManager handle the redirect
        } else {
            await auth.signOut();
            window.location.href = 'auth.html';
        }
    } catch (error) {
        console.error('Error logging out:', error);
    }
};

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.dashboardManager = new DashboardManager();
});

// Export for use in other modules
export default DashboardManager;