// Dashboard functionality with real user data
class DashboardManager {
    constructor() {
        this.currentSection = 'overview';
        this.portfolioChart = null;
        this.userProfileService = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupMobileMenu();
        this.loadUserData();
        this.loadAccountData();
        this.initializeChart();
        this.startRealTimeUpdates();
    }

    setupMobileMenu() {
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const sidebar = document.querySelector('.dashboard-sidebar');
        
        if (mobileMenuToggle && sidebar) {
            mobileMenuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('mobile-open');
            });
            
            // Close sidebar when clicking outside on mobile
            document.addEventListener('click', (e) => {
                if (window.innerWidth <= 768) {
                    if (!sidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                        sidebar.classList.remove('mobile-open');
                    }
                }
            });
            
            // Handle window resize
            window.addEventListener('resize', () => {
                if (window.innerWidth > 768) {
                    sidebar.classList.remove('mobile-open');
                }
            });
        }
    }
    async initializeUserProfileService() {
        // Import and initialize user profile service
        try {
            const { UserProfileService } = await import('./user-profile-service.js');
            this.userProfileService = new UserProfileService();
            
            // Listen for auth state changes
            if (typeof firebase !== 'undefined') {
                firebase.auth().onAuthStateChanged(async (user) => {
                    if (user) {
                        await this.loadRealUserData(user);
                    } else {
                        window.location.href = 'auth.html';
                    }
                });
            }
        } catch (error) {
            console.error('Error initializing user profile service:', error);
        }
    }

    async loadRealUserData(user) {
        try {
            // Set user name immediately
            const displayName = user.displayName || user.email.split('@')[0] || 'User';
            const userNameElement = document.getElementById('dashboard-user-name');
            if (userNameElement) {
                userNameElement.textContent = displayName;
            }
            
            // Load real account data from Firebase
            const userRef = firebase.firestore().collection('users').doc(user.uid);
            const userDoc = await userRef.get();
            
            let accountData;
            if (userDoc.exists) {
                accountData = userDoc.data();
            } else {
                // Create new user account with zero balance
                accountData = {
                    balance: 0.00,
                    equity: 0.00,
                    margin: 0.00,
                    freeMargin: 0.00,
                    todayPnL: 0.00,
                    totalDeposits: 0.00,
                    totalWithdrawals: 0.00,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                // Save to Firebase
                await userRef.set(accountData);
            }
            
            this.updateAccountSummary(accountData);
            await this.loadTransactionHistory(user.uid);
            await this.loadOpenPositions(user.uid);
            
        } catch (error) {
            console.error('Error loading real user data:', error);
            // Show zero balance for new users
            this.updateAccountSummary({
                balance: 0.00,
                equity: 0.00,
                margin: 0.00,
                freeMargin: 0.00,
                todayPnL: 0.00
            });
        }
    }

    setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.menu-item[data-section]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                
                if (section === 'trading') {
                    window.open('platform.html', '_blank');
                    return;
                }
                
                this.switchSection(section);
            });
        });

        // Time filter buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateChart(btn.dataset.period);
            });
        });

        // Fixed notification button
        document.querySelector('button[title="Notifications"]').addEventListener('click', () => {
            this.showNotifications();
        });

        // Fixed mail button
        document.querySelector('button[title="Messages"]').addEventListener('click', () => {
            this.openMessages();
        });

        // Fixed settings button
        document.querySelector('button[title="Settings"]').addEventListener('click', () => {
            window.location.href = 'profile.html#account-settings';
        });

        // User dropdown toggle
        window.toggleUserDropdown = () => {
            const dropdown = document.getElementById('userDropdown');
            dropdown.classList.toggle('show');
        };

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const userMenu = document.querySelector('.user-menu');
            const dropdown = document.getElementById('userDropdown');
            if (!userMenu.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    }

    updateAccountSummary(data) {
        // Update with real user data
        document.querySelector('.balance-amount').textContent = `$${data.balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        document.querySelector('.equity-amount').textContent = `$${data.equity.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        document.querySelector('.margin-amount').textContent = `$${data.freeMargin.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        const pnlElement = document.querySelector('.pnl-amount');
        const pnlValue = data.todayPnL || 0;
        pnlElement.textContent = `${pnlValue >= 0 ? '+' : ''}$${Math.abs(pnlValue).toFixed(2)}`;
        pnlElement.className = `pnl-amount ${pnlValue >= 0 ? 'positive' : 'negative'}`;
        
        // Update percentage changes based on real data
        const balanceChange = document.querySelector('.balance-change');
        const equityChange = document.querySelector('.equity-change');
        
        if (data.totalDeposits > 0) {
            const balanceChangePercent = ((data.balance - data.totalDeposits) / data.totalDeposits * 100).toFixed(2);
            balanceChange.textContent = `${balanceChangePercent >= 0 ? '+' : ''}$${(data.balance - data.totalDeposits).toFixed(2)} (${balanceChangePercent}%)`;
            balanceChange.className = `balance-change ${balanceChangePercent >= 0 ? 'positive' : 'negative'}`;
        } else {
            balanceChange.textContent = '$0.00 (0.0%)';
            balanceChange.className = 'balance-change';
        }
    }

    async loadTransactionHistory(userId) {
        try {
            const transactionsRef = firebase.firestore().collection('transactions')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(10);
            
            const snapshot = await transactionsRef.get();
            const transactions = [];
            
            snapshot.forEach(doc => {
                transactions.push({ id: doc.id, ...doc.data() });
            });
            
            this.displayTransactionHistory(transactions);
        } catch (error) {
            console.error('Error loading transaction history:', error);
        }
    }

    async loadOpenPositions(userId) {
        try {
            const positionsRef = firebase.firestore().collection('positions')
                .where('userId', '==', userId)
                .where('status', '==', 'open');
            
            const snapshot = await positionsRef.get();
            const positions = [];
            
            snapshot.forEach(doc => {
                positions.push({ id: doc.id, ...doc.data() });
            });
            
            this.displayOpenPositions(positions);
        } catch (error) {
            console.error('Error loading open positions:', error);
            // Show empty positions table for new users
            this.displayOpenPositions([]);
        }
    }

    displayOpenPositions(positions) {
        const tbody = document.getElementById('positionsTableBody');
        if (!tbody) return;
        
        if (positions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="no-positions">
                        <div class="empty-state">
                            <i class="fas fa-chart-line"></i>
                            <p>No open positions</p>
                            <button class="btn-primary" onclick="window.open('platform.html', '_blank')">
                                Start Trading
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = positions.map(position => `
            <tr>
                <td>
                    <div class="symbol-info">
                        <span class="symbol">${position.symbol}</span>
                    </div>
                </td>
                <td><span class="position-type ${position.type}">${position.type.toUpperCase()}</span></td>
                <td>${position.volume}</td>
                <td>$${position.openPrice.toFixed(4)}</td>
                <td class="current-price">$${position.currentPrice.toFixed(4)}</td>
                <td class="pnl ${position.pnl >= 0 ? 'positive' : 'negative'}">
                    ${position.pnl >= 0 ? '+' : ''}$${position.pnl.toFixed(2)}
                </td>
                <td>
                    <button class="btn-close" onclick="closePosition('${position.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    showNotifications() {
        // Create notification panel
        const notificationPanel = document.createElement('div');
        notificationPanel.className = 'notification-panel';
        notificationPanel.innerHTML = `
            <div class="notification-header">
                <h3>Notifications</h3>
                <button class="close-btn" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="notification-content">
                <div class="notification-item">
                    <i class="fas fa-info-circle"></i>
                    <div>
                        <p>Welcome to CentralTradeHub!</p>
                        <small>Just now</small>
                    </div>
                </div>
                <div class="notification-item">
                    <i class="fas fa-chart-line"></i>
                    <div>
                        <p>Market analysis tools are now available</p>
                        <small>2 hours ago</small>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(notificationPanel);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notificationPanel.parentElement) {
                notificationPanel.remove();
            }
        }, 10000);
    }

    openMessages() {
        // Redirect to messages or open modal
        window.open('mailto:support@centraltradeHub.com?subject=Support Request', '_blank');
    }

    startRealTimeUpdates() {
        // Update account data every 30 seconds
        setInterval(async () => {
            const user = firebase.auth().currentUser;
            if (user) {
                await this.loadRealUserData(user);
            }
        }, 30000);
        
        // Update market prices every 5 seconds
        setInterval(() => {
            this.updateMarketPrices();
        }, 5000);
    }

    initializeChart() {
        const ctx = document.getElementById('portfolioChart');
        if (!ctx) return;

        this.portfolioChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'],
                datasets: [{
                    label: 'Portfolio Value',
                    data: [10000, 10050, 10025, 10100, 10150, 10200, 10180, 10250],
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#2d2d44'
                        },
                        ticks: {
                            color: '#888'
                        }
                    },
                    y: {
                        grid: {
                            color: '#2d2d44'
                        },
                        ticks: {
                            color: '#888',
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    updateChart(period) {
        // Update chart data based on selected time period
        // This would typically fetch new data from your API
        console.log('Updating chart for period:', period);
    }

    updateMarketPrices() {
        // Simulate real-time price updates
        const priceElements = document.querySelectorAll('.current-price');
        priceElements.forEach(element => {
            const currentPrice = parseFloat(element.textContent);
            const change = (Math.random() - 0.5) * 0.001; // Small random change
            const newPrice = currentPrice + change;
            element.textContent = newPrice.toFixed(4);
        });
    }
}

// Updated global functions
window.openTradingModal = () => {
    window.open('platform.html', '_blank');
};

window.showDeposit = () => {
    window.location.href = 'funding.html';
};

window.showWithdraw = () => {
    // Create withdrawal modal
    const modal = document.createElement('div');
    modal.className = 'withdrawal-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Withdraw Funds</h3>
                <button class="close-btn" onclick="this.closest('.withdrawal-modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form class="withdrawal-form" onsubmit="processWithdrawal(event)">
                <div class="form-group">
                    <label>Withdrawal Method</label>
                    <select name="method" required>
                        <option value="">Select Method</option>
                        <option value="bank">Bank Transfer</option>
                        <option value="paypal">PayPal</option>
                        <option value="crypto">Cryptocurrency</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Amount (USD)</label>
                    <input type="number" name="amount" min="10" step="0.01" required>
                </div>
                <div class="form-group">
                    <label>Account Details</label>
                    <textarea name="details" placeholder="Enter your account details" required></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" onclick="this.closest('.withdrawal-modal').remove()">Cancel</button>
                    <button type="submit" class="btn-primary">Submit Withdrawal</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
};

window.processWithdrawal = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const withdrawalData = {
        method: formData.get('method'),
        amount: parseFloat(formData.get('amount')),
        details: formData.get('details'),
        userId: firebase.auth().currentUser.uid,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await firebase.firestore().collection('withdrawals').add(withdrawalData);
        alert('Withdrawal request submitted successfully! We will process it within 1-2 business days.');
        event.target.closest('.withdrawal-modal').remove();
    } catch (error) {
        console.error('Error submitting withdrawal:', error);
        alert('Error submitting withdrawal request. Please try again.');
    }
};

window.goToAnalytics = () => {
    alert('Navigating to analytics...');
    // Switch to analytics section
};

window.closePosition = (symbol) => {
    if (confirm(`Close position for ${symbol}?`)) {
        alert(`Position ${symbol} closed successfully!`);
        // Implement position closing logic
    }
};

window.handleLogout = async () => {
    try {
        if (window.authManager) {
            await window.authManager.logout();
        } else {
            // Fallback if authManager is not available
            if (typeof firebase !== 'undefined') {
                await firebase.auth().signOut();
            }
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Error logging out:', error);
        // Force redirect even if logout fails
        window.location.href = 'index.html';
    }
};

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DashboardManager();
});


// ...
    async loadAccountData() {
        try {
            const user = auth.currentUser;
            if (!user) {
                console.error('No authenticated user found');
                return;
            }

            // Load real user profile data from Firebase
            const userProfile = await this.userProfileService.loadUserProfile(user.uid);
            
            if (userProfile) {
                // Update account data with real values from Firebase
                this.accountData = {
                    balance: userProfile.balance || 0,
                    equity: userProfile.equity || 0,
                    margin: userProfile.margin || 0,
                    freeMargin: userProfile.freeMargin || 0,
                    marginLevel: userProfile.marginLevel || 0,
                    pnl: userProfile.todaysPnL || 0
                };
            } else {
                // Fallback to default values if no profile exists
                this.accountData = {
                    balance: 10000,
                    equity: 10000,
                    margin: 0,
                    freeMargin: 10000,
                    marginLevel: 0,
                    pnl: 0
                };
                
                // Create initial profile in Firebase
                await this.userProfileService.updateUserProfile(user.uid, this.accountData);
            }
            
            this.updateAccountSummary();
        } catch (error) {
            console.error('Error loading account data:', error);
            // Show error state
            this.showErrorState();
        }
    }

    updateAccountSummary() {
        // Update balance
        const balanceElement = document.getElementById('account-balance');
        if (balanceElement) {
            balanceElement.textContent = `$${this.accountData.balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }
        
        // Update equity
        const equityElement = document.getElementById('account-equity');
        if (equityElement) {
            equityElement.textContent = `$${this.accountData.equity.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }
        
        // Update free margin
        const marginElement = document.getElementById('free-margin');
        if (marginElement) {
            marginElement.textContent = `$${this.accountData.freeMargin.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }
        
        // Update margin level
        const marginLevelElement = document.getElementById('margin-level');
        if (marginLevelElement) {
            marginLevelElement.textContent = `Margin Level: ${this.accountData.marginLevel.toFixed(2)}%`;
        }
        
        // Calculate and display changes
        this.updateChangeIndicators();
    }
    
    updateChangeIndicators() {
        // Calculate balance change (you can store previous values in localStorage or Firebase)
        const previousBalance = parseFloat(localStorage.getItem('previousBalance')) || this.accountData.balance;
        const balanceChange = this.accountData.balance - previousBalance;
        const balanceChangePercent = previousBalance > 0 ? (balanceChange / previousBalance) * 100 : 0;
        
        const balanceChangeElement = document.getElementById('balance-change');
        if (balanceChangeElement) {
            const changeText = `${balanceChange >= 0 ? '+' : ''}$${Math.abs(balanceChange).toFixed(2)} (${balanceChangePercent.toFixed(1)}%)`;
            balanceChangeElement.textContent = changeText;
            balanceChangeElement.className = `balance-change ${balanceChange >= 0 ? 'positive' : 'negative'}`;
        }
        
        // Similar for equity
        const previousEquity = parseFloat(localStorage.getItem('previousEquity')) || this.accountData.equity;
        const equityChange = this.accountData.equity - previousEquity;
        const equityChangePercent = previousEquity > 0 ? (equityChange / previousEquity) * 100 : 0;
        
        const equityChangeElement = document.getElementById('equity-change');
        if (equityChangeElement) {
            const changeText = `${equityChange >= 0 ? '+' : ''}$${Math.abs(equityChange).toFixed(2)} (${equityChangePercent.toFixed(1)}%)`;
            equityChangeElement.textContent = changeText;
            equityChangeElement.className = `equity-change ${equityChange >= 0 ? 'positive' : 'negative'}`;
        }
        
        // Store current values for next comparison
        localStorage.setItem('previousBalance', this.accountData.balance.toString());
        localStorage.setItem('previousEquity', this.accountData.equity.toString());
    }
    
    showErrorState() {
        const elements = ['account-balance', 'account-equity', 'free-margin', 'margin-level'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = 'Error loading data';
                element.style.color = '#dc3545';
            }
        });
    }
}