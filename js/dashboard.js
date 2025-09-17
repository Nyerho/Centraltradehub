// Dashboard functionality with real user data
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class DashboardManager {
    constructor() {
        this.currentSection = 'overview';
        this.portfolioChart = null;
        this.userProfileService = null;
        this.accountData = {};
        this.lightweightChart = null;
        this.chartSeries = null;
        this.currentTimeframe = '1D';
        this.currentCategory = 'indices';
        this.currentAsset = 'S&P 500';
        this.leaderboardTransactions = [];
        this.leaderboardInterval = null;
        // Add real-time listener references
        this.userDataListener = null;
        this.accountDataListener = null;
        this.currentUser = null;
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
        
        // Ensure DOM is fully loaded before initializing chart components
        setTimeout(() => {
            this.initializeTradingTabs();
            this.setupAssetSelectors();
            this.setupChartControls();
            this.initializeLeaderboard();
            this.startRealTimeUpdates();
            
            // Initialize chart last with additional delay
            setTimeout(() => {
                this.initializeLightweightChart();
            }, 300);
        }, 200);

        // Handle window resize for Chart.js
        window.addEventListener('resize', () => {
            if (this.marketChart) {
                this.marketChart.resize();
            }
        });
    }

    async initializeAuth() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log('User authenticated:', user.email);
                this.currentUser = user;
                await this.loadUserData(user);
                await this.loadAccountData(user);
                // Setup real-time listeners after initial load
                this.setupRealTimeListeners(user);
            } else {
                console.log('User not authenticated');
                this.handleAuthError();
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
                this.updateUserInterface(userData, user);
                
                // Load KYC status
                await this.loadUserKYCStatus(user);
                
            } else {
                console.log('No user document found, creating default');
                // Create default user document
                const defaultUserData = {
                    email: user.email,
                    displayName: user.displayName || 'User',
                    createdAt: new Date().toISOString(),
                    kycStatus: 'unverified',
                    accountBalance: 0,
                    status: 'active'
                };
                
                await setDoc(userRef, defaultUserData);
                this.updateUserInterface(defaultUserData, user);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            this.showErrorState();
        }
    }

    // New method to update UI elements
    updateUserInterface(userData, user) {
        // Update user email
        const userEmailElement = document.getElementById('userEmail');
        if (userEmailElement) {
            userEmailElement.textContent = user.email || 'No email';
        }
        
        // Update user name in header and trading interface
        const userNameElement = document.getElementById('dashboard-user-name');
        const tradingUserNameElement = document.getElementById('trading-user-name');
        
        const displayName = userData.firstName && userData.lastName 
            ? `${userData.firstName} ${userData.lastName}`
            : userData.displayName || user.displayName || 'User';
        
        if (userNameElement) {
            userNameElement.textContent = displayName;
        }
        
        if (tradingUserNameElement) {
            tradingUserNameElement.textContent = displayName;
        }
        
        // Update avatar initial
        const avatarInitialElement = document.querySelector('.avatar-initial');
        if (avatarInitialElement) {
            const nameForInitial = displayName || user.email || 'User';
            avatarInitialElement.textContent = nameForInitial.charAt(0).toUpperCase();
        }
        
        // Update account balance if present in user data
        if (userData.accountBalance !== undefined) {
            this.accountData.balance = userData.accountBalance;
            this.updateAccountSummary();
        }
    }

    // New method to setup real-time listeners
    setupRealTimeListeners(user) {
        // Clean up existing listeners
        if (this.userDataListener) {
            this.userDataListener();
        }
        if (this.accountDataListener) {
            this.accountDataListener();
        }
        
        // Add debounce mechanism
        let updateTimeout;
        const debounceUpdate = () => {
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
                this.updateAccountSummary();
            }, 100); // 100ms debounce
        };
        
        // Setup user data listener (primary - admin updates)
        const userRef = doc(db, 'users', user.uid);
        this.userDataListener = onSnapshot(userRef, async (doc) => {
            if (doc.exists()) {
                const userData = doc.data();
                console.log('Real-time user data update:', userData);
                this.updateUserInterface(userData, user);
                
                // Sync admin balance changes to accounts collection
                if (userData.accountBalance !== undefined && userData.balanceUpdatedAt) {
                    const accountRef = doc(db, 'accounts', user.uid);
                    const accountDoc = await getDoc(accountRef);
                    
                    if (accountDoc.exists()) {
                        const currentAccountData = accountDoc.data();
                        // Only update if admin balance is different
                        if (currentAccountData.balance !== userData.accountBalance) {
                            await updateDoc(accountRef, {
                                balance: userData.accountBalance,
                                lastSyncedAt: new Date().toISOString(),
                                adminUpdated: true // Flag to indicate admin update
                            });
                            
                            // Update local data immediately to prevent twitching
                            this.accountData = {
                                ...this.accountData,
                                balance: userData.accountBalance,
                                lastSyncedAt: new Date().toISOString(),
                                adminUpdated: true
                            };
                            
                            console.log('Synced admin balance to accounts collection');
                            debounceUpdate();
                        }
                    }
                }
                
                // Show notification for admin changes (optional)
                if (userData.balanceUpdatedAt) {
                    const updateTime = new Date(userData.balanceUpdatedAt);
                    const now = new Date();
                    // If updated within last 5 seconds, show notification
                    if (now - updateTime < 5000) {
                        this.showNotification('Account updated by administrator', 'info');
                    }
                }
            }
        }, (error) => {
            console.error('Error in user data listener:', error);
        });
        
        // Setup account data listener (secondary - only for non-admin updates)
        const accountRef = doc(db, 'accounts', user.uid);
        this.accountDataListener = onSnapshot(accountRef, async (doc) => {
            if (doc.exists()) {
                const accountData = doc.data();
                console.log('Real-time account data update:', accountData);
                
                // Check if this is an admin update by looking at timestamp
                const userRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userRef);
                
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const adminUpdateTime = userData.balanceUpdatedAt ? new Date(userData.balanceUpdatedAt) : null;
                    const accountUpdateTime = accountData.lastSyncedAt ? new Date(accountData.lastSyncedAt) : null;
                    
                    // Only update if this isn't a recent admin update
                    const isRecentAdminUpdate = adminUpdateTime && accountUpdateTime && 
                        Math.abs(adminUpdateTime - accountUpdateTime) < 2000; // 2 second tolerance
                    
                    if (!isRecentAdminUpdate && !accountData.adminUpdated) {
                        this.accountData = accountData;
                        debounceUpdate();
                    } else if (accountData.adminUpdated) {
                        // Clear the admin flag after processing
                        await updateDoc(accountRef, {
                            adminUpdated: false
                        });
                        this.accountData = accountData;
                        debounceUpdate();
                    }
                } else {
                    // No user data, safe to update
                    this.accountData = accountData;
                    debounceUpdate();
                }
            }
        }, (error) => {
            console.error('Error in account data listener:', error);
        });
    }

    async loadAccountData(user) {
        try {
            const accountRef = doc(db, 'accounts', user.uid);
            const accountDoc = await getDoc(accountRef);
            
            if (accountDoc.exists()) {
                this.accountData = accountDoc.data();
            } else {
                // Check if user has balance from admin updates first
                const userRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userRef);
                const adminBalance = userDoc.exists() ? (userDoc.data().accountBalance || 0) : 0;
                
                // Create account with admin balance if available, otherwise default to 0
                this.accountData = {
                    balance: adminBalance,
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
                
                // Update current category and load assets
                this.currentCategory = e.target.getAttribute('data-category');
                this.updateAssetSelector();
                
                // Load first asset of the category
                const firstAsset = Object.keys(this.chartSymbols[this.currentCategory])[0];
                this.currentAsset = firstAsset;
                this.loadChartData(this.chartSymbols[this.currentCategory][firstAsset], this.currentTimeframe);
            });
        });
    }
    
    setupAssetSelectors() {
        // This method is now handled by updateAssetSelector
        this.updateAssetSelector();
    }

    updateAssetSelector() {
        const assetSelector = document.getElementById('assetSelector');
        if (!assetSelector) return;

        // Clear existing options
        assetSelector.innerHTML = '';

        // Add options for current category
        const assets = this.chartSymbols[this.currentCategory] || this.chartSymbols.indices;
        Object.keys(assets).forEach(assetName => {
            const option = document.createElement('option');
            option.value = assetName;
            option.textContent = assetName;
            if (assetName === this.currentAsset) {
                option.selected = true;
            }
            assetSelector.appendChild(option);
        });

        // Add change event listener
        assetSelector.removeEventListener('change', this.handleAssetChange);
        this.handleAssetChange = (e) => {
            this.currentAsset = e.target.value;
            const symbol = this.chartSymbols[this.currentCategory][this.currentAsset];
            this.loadChartData(symbol, this.currentTimeframe);
        };
        assetSelector.addEventListener('change', this.handleAssetChange);
    }

    initializeLightweightChart() {
        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.error('Chart.js library not loaded');
            setTimeout(() => this.initializeLightweightChart(), 1000);
            return;
        }
    
        const container = document.getElementById('lightweight-chart-container');
        if (!container) {
            console.error('Chart container not found');
            setTimeout(() => this.initializeLightweightChart(), 500);
            return;
        }
    
        // Clear existing content and create canvas
        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.id = 'market-chart';
        canvas.style.width = '100%';
        canvas.style.height = '400px';
        container.appendChild(canvas);
    
        // Destroy existing chart if it exists
        if (this.marketChart) {
            this.marketChart.destroy();
        }
    
        try {
            const ctx = canvas.getContext('2d');
            
            // Generate initial sample data
            const sampleData = this.generateSampleData(this.currentTimeframe);
            const labels = sampleData.map(item => {
                const date = new Date(item.time * 1000);
                return date.toLocaleDateString();
            });
            const prices = sampleData.map(item => item.value);
    
            this.marketChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Price',
                        data: prices,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.1,
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            borderColor: '#3b82f6',
                            borderWidth: 1
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: {
                                color: 'rgba(42, 46, 57, 0.3)',
                                drawBorder: false
                            },
                            ticks: {
                                color: '#ffffff',
                                maxTicksLimit: 8
                            }
                        },
                        y: {
                            display: true,
                            grid: {
                                color: 'rgba(42, 46, 57, 0.3)',
                                drawBorder: false
                            },
                            ticks: {
                                color: '#ffffff',
                                callback: function(value) {
                                    return '$' + value.toFixed(2);
                                }
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                elements: {
                    point: {
                        hoverRadius: 8
                    }
                }
            });
    
            console.log('Chart initialized successfully with Chart.js');
    
            // Remove automatic chart export - user can manually export if needed
            // setTimeout(() => {
            //     this.exportChartScreenshot();
            // }, 1000);
    
        } catch (error) {
            console.error('Error creating chart:', error);
            setTimeout(() => this.initializeLightweightChart(), 1000);
        }
    }

    setupChartControls() {
        // Timeframe selector
        const timeframeBtns = document.querySelectorAll('.timeframe-btn');
        timeframeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                timeframeBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentTimeframe = e.target.dataset.timeframe;
                const symbol = this.chartSymbols[this.currentCategory][this.currentAsset];
                this.loadChartData(symbol, this.currentTimeframe);
            });
        });

        // Export button
        const exportBtn = document.getElementById('exportChartBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportChartScreenshot();
            });
        }
    }

    async loadChartData(symbol, timeframe) {
        try {
            // Generate sample data for demonstration
            const sampleData = this.generateSampleData(timeframe);
            
            if (this.marketChart) {
                const labels = sampleData.map(item => {
                    const date = new Date(item.time * 1000);
                    return date.toLocaleDateString();
                });
                const prices = sampleData.map(item => item.value);
                
                this.marketChart.data.labels = labels;
                this.marketChart.data.datasets[0].data = prices;
                this.marketChart.data.datasets[0].label = symbol;
                this.marketChart.update('active');
                
                console.log('Chart data updated for:', symbol, timeframe);
            }
        } catch (error) {
            console.error('Error loading chart data:', error);
        }
    }

    generateSampleData(timeframe) {
        const data = [];
        const now = new Date();
        let days = 30;
        
        switch (timeframe) {
            case '1D': days = 1; break;
            case '1W': days = 7; break;
            case '1M': days = 30; break;
            case '3M': days = 90; break;
            case '1Y': days = 365; break;
        }

        let basePrice = 4500;
        for (let i = days; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const time = Math.floor(date.getTime() / 1000);
            const change = (Math.random() - 0.5) * 100;
            basePrice += change;
            
            data.push({
                time: time,
                value: Math.max(basePrice, 1000)
            });
        }
        
        return data;
    }

    exportChartScreenshot() {
        if (!this.marketChart) {
            console.error('Chart not initialized');
            return;
        }
    
        try {
            // Get chart canvas and convert to image
            const canvas = this.marketChart.canvas;
            const url = canvas.toDataURL('image/png');
            
            // Create download link
            const link = document.createElement('a');
            link.download = `market-chart-${new Date().toISOString().split('T')[0]}.png`;
            link.href = url;
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('Chart exported successfully');
        } catch (error) {
            console.error('Error exporting chart:', error);
        }
    }

    loadTradingViewChart(category, assetName) {
        // Update to use lightweight chart instead
        const symbol = this.chartSymbols[category]?.[assetName] || this.chartSymbols.indices['S&P 500'];
        this.currentCategory = category;
        this.currentAsset = assetName;
        this.loadChartData(symbol, this.currentTimeframe);
        console.log(`Loading chart for ${assetName} (${symbol})`);
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
        window.location.href = 'withdrawal.html';
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
            // Retry after a short delay
            setTimeout(() => this.initializeLeaderboard(), 500);
            return;
        }
        
        // Generate initial transactions
        this.generateInitialTransactions();
        
        // Start live updates
        this.startLeaderboardUpdates();
        
        console.log('Leaderboard initialized successfully');
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
        
        console.log('Leaderboard display updated');
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
    window.location.href = 'withdrawal.html';
};

window.goToAnalytics = () => {
    window.location.href = 'platform.html#analytics';
};

window.closePosition = (symbol) => {
    console.log(`Closing position for ${symbol}`);
};

window.logout = async () => {
    try {
        // Clean up listeners before logout
        if (window.dashboardManager) {
            if (window.dashboardManager.userDataListener) {
                window.dashboardManager.userDataListener();
            }
            if (window.dashboardManager.accountDataListener) {
                window.dashboardManager.accountDataListener();
            }
        }
        
        await auth.signOut();
        window.location.href = 'auth.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out. Please try again.');
    }
};

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard DOM loaded, initializing...');
    
    // Create global dashboard manager instance
    window.dashboardManager = new DashboardManager();
    
    console.log('Dashboard manager created');
});

// Export for use in other modules
export default DashboardManager;

// Initialize enhanced market data service
const marketDataService = new MarketDataService();
const connectionStatus = new ConnectionStatus();

// Initialize services
marketDataService.init().then(() => {
    connectionStatus.setMarketDataService(marketDataService);
    
    // Subscribe to real-time data for dashboard symbols
    const dashboardSymbols = ['EUR/USD', 'GBP/USD', 'BTC/USD', 'AAPL', 'GOOGL'];
    
    dashboardSymbols.forEach(symbol => {
        marketDataService.subscribeToSymbol(symbol, (data) => {
            updateDashboardPrice(symbol, data);
        });
    });
});

function updateDashboardPrice(symbol, data) {
    const priceElement = document.querySelector(`[data-symbol="${symbol}"] .price`);
    const changeElement = document.querySelector(`[data-symbol="${symbol}"] .change`);
    
    if (priceElement) {
        priceElement.textContent = formatPrice(data.price, symbol);
        priceElement.classList.add('price-update');
        setTimeout(() => priceElement.classList.remove('price-update'), 500);
    }
    
    if (changeElement && data.change) {
        changeElement.textContent = formatChange(data.change);
        changeElement.className = `change ${data.change >= 0 ? 'positive' : 'negative'}`;
    }
}