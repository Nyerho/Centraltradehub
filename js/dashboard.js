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
        // Setup navigation menu listeners
        this.setupNavigationListeners();
        
        // Setup other event listeners
        this.setupActionButtons();
        this.setupUserDropdown();
    }

    setupNavigationListeners() {
        const menuItems = document.querySelectorAll('.menu-item');
        const sections = document.querySelectorAll('.dashboard-section');
        
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remove active class from all menu items
                menuItems.forEach(menuItem => menuItem.classList.remove('active'));
                
                // Add active class to clicked item
                item.classList.add('active');
                
                // Get the target section
                const targetSection = item.getAttribute('data-section');
                this.currentSection = targetSection;
                
                // Hide all sections
                sections.forEach(section => section.classList.remove('active'));
                
                // Show target section
                const targetSectionElement = document.getElementById(targetSection + '-section');
                if (targetSectionElement) {
                    targetSectionElement.classList.add('active');
                } else {
                    // Create section if it doesn't exist
                    this.createSection(targetSection);
                }
                
                // Update page title
                const sectionName = item.querySelector('span').textContent;
                document.title = `${sectionName} - CentralTradeHub`;
                
                // Close mobile menu if open
                const sidebar = document.querySelector('.dashboard-sidebar');
                if (sidebar) {
                    sidebar.classList.remove('mobile-open');
                }
            });
        });
    }

    createSection(sectionName) {
        const main = document.querySelector('.dashboard-main');
        const section = document.createElement('section');
        section.id = sectionName + '-section';
        section.className = 'dashboard-section active';
        
        const sectionContent = this.getSectionContent(sectionName);
        section.innerHTML = sectionContent;
        
        main.appendChild(section);
    }

    getSectionContent(sectionName) {
        const contentMap = {
            portfolio: `
                <div class="section-header">
                    <h2>Portfolio</h2>
                    <p>Manage your trading portfolio and positions</p>
                </div>
                <div class="portfolio-content">
                    <div class="portfolio-summary">
                        <div class="summary-card">
                            <h3>Open Positions</h3>
                            <div class="stat-value">0</div>
                        </div>
                        <div class="summary-card">
                            <h3>Total P&L</h3>
                            <div class="stat-value positive">$0.00</div>
                        </div>
                    </div>
                    <div class="positions-table">
                        <p>No open positions</p>
                    </div>
                </div>
            `,
            markets: `
                <div class="section-header">
                    <h2>Markets</h2>
                    <p>Live market data and trading opportunities</p>
                </div>
                <div class="markets-content">
                    <div class="market-grid">
                        <div class="market-card">
                            <h3>EUR/USD</h3>
                            <div class="price">1.0845</div>
                            <div class="change positive">+0.0012</div>
                        </div>
                        <div class="market-card">
                            <h3>GBP/USD</h3>
                            <div class="price">1.2634</div>
                            <div class="change negative">-0.0023</div>
                        </div>
                    </div>
                </div>
            `,
            history: `
                <div class="section-header">
                    <h2>Trading History</h2>
                    <p>View your past trades and transactions</p>
                </div>
                <div class="history-content">
                    <div class="history-filters">
                        <select class="filter-select">
                            <option>All Trades</option>
                            <option>Profitable</option>
                            <option>Losses</option>
                        </select>
                    </div>
                    <div class="history-table">
                        <p>No trading history available</p>
                    </div>
                </div>
            `,
            analytics: `
                <div class="section-header">
                    <h2>Analytics</h2>
                    <p>Performance analytics and insights</p>
                </div>
                <div class="analytics-content">
                    <div class="analytics-grid">
                        <div class="analytics-card">
                            <h3>Win Rate</h3>
                            <div class="stat-value">0%</div>
                        </div>
                        <div class="analytics-card">
                            <h3>Profit Factor</h3>
                            <div class="stat-value">0.00</div>
                        </div>
                    </div>
                </div>
            `,
            education: `
                <div class="section-header">
                    <h2>Education</h2>
                    <p>Trading resources and learning materials</p>
                </div>
                <div class="education-content">
                    <div class="education-grid">
                        <div class="education-card">
                            <h3>Forex Basics</h3>
                            <p>Learn the fundamentals of forex trading</p>
                            <button class="btn-primary">Start Learning</button>
                        </div>
                        <div class="education-card">
                            <h3>Technical Analysis</h3>
                            <p>Master chart patterns and indicators</p>
                            <button class="btn-primary">Start Learning</button>
                        </div>
                    </div>
                </div>
            `
        };
        
        return contentMap[sectionName] || `
            <div class="section-header">
                <h2>${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}</h2>
                <p>Content for ${sectionName} section</p>
            </div>
            <div class="section-content">
                <p>This section is under development.</p>
            </div>
        `;
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

// Dashboard Navigation Functionality
function initializeDashboardNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    const sections = document.querySelectorAll('.dashboard-section');
    
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all menu items
            menuItems.forEach(menuItem => menuItem.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
            
            // Get the target section
            const targetSection = this.getAttribute('data-section');
            
            // Hide all sections
            sections.forEach(section => section.classList.remove('active'));
            
            // Show target section
            const targetSectionElement = document.getElementById(targetSection + '-section');
            if (targetSectionElement) {
                targetSectionElement.classList.add('active');
            }
            
            // Update page title
            const sectionName = this.querySelector('span').textContent;
            document.title = `${sectionName} - CentralTradeHub`;
        });
    });
}

// Remove the entire initializeDashboardNavigation function

// Update this part at the end of the file:
document.addEventListener('DOMContentLoaded', function() {
    // Remove this line: initializeDashboardNavigation();
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