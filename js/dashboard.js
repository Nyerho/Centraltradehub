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
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupMobileMenu();
        this.initializeAuth();
        this.initializeChart();
        this.startRealTimeUpdates();
    }

    // Initialize authentication and load user data
    initializeAuth() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                await this.loadUserData(user);
                await this.loadAccountData(user);
            } else {
                // Redirect to login if not authenticated
                window.location.href = 'auth.html';
            }
        });
    }

    async loadUserData(user) {
        try {
            // Set user name and email
            const displayName = user.displayName || user.email.split('@')[0] || 'User';
            const userNameElement = document.getElementById('dashboard-user-name');
            const userEmailElement = document.getElementById('userEmail');
            
            if (userNameElement) {
                userNameElement.textContent = displayName;
            }
            if (userEmailElement) {
                userEmailElement.textContent = user.email;
            }
            
            // Update user profile section
            const profileName = document.querySelector('.user-name');
            const avatarInitial = document.querySelector('.avatar-initial');
            
            if (profileName) {
                profileName.textContent = displayName;
            }
            if (avatarInitial) {
                avatarInitial.textContent = displayName.charAt(0).toUpperCase();
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async loadAccountData(user) {
        try {
            // Load real account data from Firebase
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);
            
            let accountData;
            if (userDoc.exists()) {
                accountData = userDoc.data();
            } else {
                // Create new user account with default balance
                accountData = {
                    balance: 10000.00,
                    equity: 10000.00,
                    margin: 0.00,
                    freeMargin: 10000.00,
                    marginLevel: 0.00,
                    todayPnL: 0.00,
                    totalDeposits: 0.00,
                    totalWithdrawals: 0.00,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                
                // Save to Firebase
                await setDoc(userRef, accountData);
            }
            
            this.accountData = accountData;
            this.updateAccountSummary();
            
        } catch (error) {
            console.error('Error loading account data:', error);
            this.showErrorState();
        }
    }

    updateAccountSummary() {
        // Update wallet balance
        const walletBalanceElement = document.getElementById('walletBalance');
        if (walletBalanceElement) {
            walletBalanceElement.textContent = this.accountData.balance?.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }) || '0.00';
        }
        
        // Update account balance
        const balanceElement = document.getElementById('account-balance');
        if (balanceElement) {
            balanceElement.textContent = `$${this.accountData.balance?.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }) || '0.00'}`;
        }
        
        // Update equity
        const equityElement = document.getElementById('account-equity');
        if (equityElement) {
            equityElement.textContent = `$${this.accountData.equity?.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }) || '0.00'}`;
        }
        
        // Update free margin
        const marginElement = document.getElementById('free-margin');
        if (marginElement) {
            marginElement.textContent = `$${this.accountData.freeMargin?.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }) || '0.00'}`;
        }
        
        // Update margin level
        const marginLevelElement = document.getElementById('margin-level');
        if (marginLevelElement) {
            marginLevelElement.textContent = `Margin Level: ${this.accountData.marginLevel?.toFixed(2) || '0.00'}%`;
        }
        
        this.updateChangeIndicators();
    }

    updateChangeIndicators() {
        // Calculate balance change
        const previousBalance = parseFloat(localStorage.getItem('previousBalance')) || this.accountData.balance;
        const balanceChange = this.accountData.balance - previousBalance;
        const balanceChangePercent = previousBalance > 0 ? (balanceChange / previousBalance) * 100 : 0;
        
        const balanceChangeElement = document.getElementById('balance-change');
        if (balanceChangeElement) {
            const changeText = `${balanceChange >= 0 ? '+' : ''}$${Math.abs(balanceChange).toFixed(2)} (${balanceChangePercent.toFixed(1)}%)`;
            balanceChangeElement.textContent = changeText;
            balanceChangeElement.className = `balance-change ${balanceChange >= 0 ? 'positive' : 'negative'}`;
        }
        
        // Store current values for next comparison
        localStorage.setItem('previousBalance', this.accountData.balance?.toString() || '0');
        localStorage.setItem('previousEquity', this.accountData.equity?.toString() || '0');
    }

    showErrorState() {
        const elements = ['account-balance', 'account-equity', 'free-margin', 'margin-level', 'walletBalance'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = 'Error loading data';
                element.style.color = '#dc3545';
            }
        });
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

    setupEventListeners() {
        // Setup navigation listeners
        this.setupNavigationListeners();
        
        // Setup button event listeners
        this.setupButtonListeners();
    }

    setupButtonListeners() {
        // Connect wallet button
        const connectWalletBtn = document.querySelector('.connect-wallet-btn');
        if (connectWalletBtn) {
            connectWalletBtn.addEventListener('click', this.handleConnectWallet.bind(this));
        }
        
        // Buy crypto button
        const buyCryptoBtn = document.querySelector('.buy-crypto-btn');
        if (buyCryptoBtn) {
            buyCryptoBtn.addEventListener('click', this.handleBuyCrypto.bind(this));
        }
        
        // Download button
        const downloadBtn = document.querySelector('.download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', this.handleDownload.bind(this));
        }
        
        // Logout button
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }
    }

    setupNavigationListeners() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remove active class from all items
                navItems.forEach(nav => nav.classList.remove('active'));
                
                // Add active class to clicked item
                item.classList.add('active');
                
                // Get section name from the span text
                const sectionName = item.querySelector('span').textContent.toLowerCase();
                this.showSection(sectionName);
            });
        });
    }

    showSection(sectionName) {
        console.log(`Navigating to ${sectionName} section`);
        // Add your section switching logic here
        this.currentSection = sectionName;
    }

    // Event handlers
    async handleConnectWallet() {
        try {
            console.log('Connecting wallet...');
            // Add wallet connection logic here
            alert('Wallet connection feature coming soon!');
        } catch (error) {
            console.error('Error connecting wallet:', error);
        }
    }

    async handleBuyCrypto() {
        try {
            console.log('Opening buy crypto modal...');
            // Add buy crypto logic here
            alert('Buy crypto feature coming soon!');
        } catch (error) {
            console.error('Error opening buy crypto:', error);
        }
    }

    handleDownload() {
        console.log('Download requested');
        // Add download logic here
        alert('Download feature coming soon!');
    }

    async handleLogout() {
        try {
            await auth.signOut();
            window.location.href = 'auth.html';
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }

    initializeChart() {
        // Chart initialization logic
        console.log('Initializing charts...');
    }

    startRealTimeUpdates() {
        // Start real-time data updates
        setInterval(() => {
            this.updateMarketPrices();
        }, 30000); // Update every 30 seconds
    }

    updateMarketPrices() {
        // Update market prices logic
        console.log('Updating market prices...');
    }
}

// Global functions for backward compatibility
window.openTradingModal = () => {
    console.log('Opening trading modal...');
};

window.showDeposit = () => {
    console.log('Opening deposit modal...');
};

window.showWithdraw = () => {
    console.log('Opening withdraw modal...');
};

window.goToAnalytics = () => {
    console.log('Navigating to analytics...');
};

window.closePosition = (symbol) => {
    console.log(`Closing position for ${symbol}`);
};

window.logout = async () => {
    try {
        await auth.signOut();
        window.location.href = 'auth.html';
    } catch (error) {
        console.error('Error logging out:', error);
    }
};

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initializing...');
    new DashboardManager();
});

// Export for use in other modules
export default DashboardManager;