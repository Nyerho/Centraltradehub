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
        // Remove duplicate event listener setup
        this.setupMobileMenu();
        this.initializeAuth();
        this.initializeChart();
        this.startRealTimeUpdates();
        // Don't call setupEventListeners() to avoid conflicts
    }

    // Initialize authentication and load user data
    initializeAuth() {
        // Add timeout and better error handling
        const authTimeout = setTimeout(() => {
            console.error('Authentication timeout - no user detected');
            this.handleAuthError();
        }, 10000); // 10 second timeout

        onAuthStateChanged(auth, async (user) => {
            clearTimeout(authTimeout);
            
            if (user) {
                console.log('User authenticated:', user.email);
                try {
                    await this.loadUserData(user);
                    await this.loadAccountData(user);
                } catch (error) {
                    console.error('Error loading user data:', error);
                    this.handleAuthError();
                }
            } else {
                console.log('No user authenticated, redirecting to login');
                // Add delay to prevent immediate redirect on page load
                setTimeout(() => {
                    window.location.href = 'auth.html';
                }, 1000);
            }
        }, (error) => {
            console.error('Auth state change error:', error);
            clearTimeout(authTimeout);
            this.handleAuthError();
        });
    }

    handleAuthError() {
        // Update UI to show error instead of loading
        const dashboardUserName = document.getElementById('dashboard-user-name');
        const userEmailElement = document.getElementById('userEmail');
        
        if (dashboardUserName) {
            dashboardUserName.textContent = 'Authentication Error';
            dashboardUserName.style.color = '#dc3545';
        }
        if (userEmailElement) {
            userEmailElement.textContent = 'Please refresh page';
            userEmailElement.style.color = '#dc3545';
        }
        
        // Show notification to user
        this.showNotification('Authentication failed. Please refresh the page or log in again.', 'error');
    }

    showNotification(message, type = 'info') {
        // Create notification if it doesn't exist
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'error' ? '#dc3545' : '#28a745'};
            color: white;
            border-radius: 5px;
            z-index: 9999;
            max-width: 300px;
        `;
        notification.innerHTML = `
            <div>${message}</div>
            <button onclick="this.parentElement.remove()" style="
                background: none;
                border: none;
                color: white;
                float: right;
                font-size: 18px;
                cursor: pointer;
                margin-left: 10px;
            ">&times;</button>
        `;
        
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
            console.log('Loading user data for:', user.email);
            
            const displayName = user.displayName || user.email.split('@')[0] || 'User';
            const userEmail = user.email || 'No email';
            
            // Update user profile section
            const profileName = document.querySelector('.user-name');
            const avatarInitial = document.querySelector('.avatar-initial');
            
            // Fix: Update dashboard-specific elements
            const dashboardUserName = document.getElementById('dashboard-user-name');
            const userEmailElement = document.getElementById('userEmail');
            
            console.log('Updating UI elements with user data');
            
            if (profileName) {
                profileName.textContent = displayName;
            }
            if (avatarInitial) {
                avatarInitial.textContent = displayName.charAt(0).toUpperCase();
            }
            
            // Update dashboard header elements with better error checking
            if (dashboardUserName) {
                dashboardUserName.textContent = displayName;
                dashboardUserName.style.color = ''; // Reset error color
            } else {
                console.warn('dashboard-user-name element not found');
            }
            
            if (userEmailElement) {
                userEmailElement.textContent = userEmail;
                userEmailElement.style.color = ''; // Reset error color
            } else {
                console.warn('userEmail element not found');
            }
            
            // Update sidebar user name as well
            const sidebarUserName = document.querySelector('.sidebar .user-name');
            if (sidebarUserName) {
                sidebarUserName.textContent = displayName;
            }
            
            // Load KYC status
            await this.loadUserKYCStatus(user);
            
            console.log('User data loaded successfully');
            
        } catch (error) {
            console.error('Error loading user data:', error);
            
            // Show specific error state
            const dashboardUserName = document.getElementById('dashboard-user-name');
            const userEmailElement = document.getElementById('userEmail');
            
            if (dashboardUserName) {
                dashboardUserName.textContent = 'Error loading user';
                dashboardUserName.style.color = '#dc3545';
            }
            if (userEmailElement) {
                userEmailElement.textContent = 'Error loading email';
                userEmailElement.style.color = '#dc3545';
            }
            
            this.showNotification('Failed to load user data: ' + error.message, 'error');
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
        // Update wallet balance (this exists in dashboard.html)
        const walletBalanceElement = document.getElementById('walletBalance');
        if (walletBalanceElement) {
            walletBalanceElement.textContent = this.accountData.balance?.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }) || '0.00';
        }
        
        // Update account balance (this exists in dashboard.html)
        const accountBalanceElement = document.getElementById('accountBalance');
        if (accountBalanceElement) {
            accountBalanceElement.textContent = this.accountData.balance?.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }) || '0.00';
        }
        
        // Remove references to elements that don't exist in dashboard.html
        // (account-balance, account-equity, account-margin, free-margin, margin-level)
        
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
        // Update to target correct dashboard elements
        const elements = ['accountBalance', 'walletBalance'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = 'Error loading data';
                element.style.color = '#dc3545';
            }
        });
        
        // Also update user elements if they failed to load
        const dashboardUserName = document.getElementById('dashboard-user-name');
        const userEmailElement = document.getElementById('userEmail');
        
        if (dashboardUserName && dashboardUserName.textContent === 'Loading...') {
            dashboardUserName.textContent = 'Error loading name';
        }
        if (userEmailElement && userEmailElement.textContent === 'Loading...') {
            userEmailElement.textContent = 'Error loading email';
        }
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
        // Only setup navigation listeners, not button listeners
        this.setupNavigationListeners();
        // Remove setupButtonListeners() call
    }

    setupButtonListeners() {
        // Remove all button event listeners since HTML onclick handlers work fine
        // This prevents conflicts and lag
    }

    setupNavigationListeners() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const href = item.getAttribute('href');
                const section = item.getAttribute('data-section');
                
                // If it's an external link, let it navigate normally
                if (href && href !== '#') {
                    return; // Allow normal navigation
                }
                
                // Handle internal sections
                e.preventDefault();
                
                // Remove active class from all items
                navItems.forEach(nav => nav.classList.remove('active'));
                
                // Add active class to clicked item
                item.classList.add('active');
                
                // Show the appropriate section
                this.showSection(section);
            });
        });
    }

    showSection(sectionName) {
        console.log(`Navigating to ${sectionName} section`);
        
        // Hide all sections first
        const sections = document.querySelectorAll('.dashboard-section');
        sections.forEach(section => section.style.display = 'none');
        
        // Show the requested section
        switch(sectionName) {
            case 'wallet':
                this.showWalletSection();
                break;
            case 'history':
                this.showHistorySection();
                break;
            case 'support':
                this.showSupportSection();
                break;
            default:
                this.showWalletSection(); // Default to wallet
        }
        
        this.currentSection = sectionName;
    }

    showWalletSection() {
        // Show the main trading interface (current default view)
        const tradingInterface = document.querySelector('.trading-interface');
        const cryptoPortfolio = document.querySelector('.crypto-portfolio-section');
        
        if (tradingInterface) tradingInterface.style.display = 'block';
        if (cryptoPortfolio) cryptoPortfolio.style.display = 'block';
    }

    showHistorySection() {
        // Create and show history section
        const mainContent = document.querySelector('.dashboard-main');
        let historySection = document.getElementById('historySection');
        
        if (!historySection) {
            historySection = document.createElement('div');
            historySection.id = 'historySection';
            historySection.className = 'dashboard-section history-section';
            historySection.innerHTML = `
                <div class="section-header">
                    <h2><i class="fas fa-history"></i> Transaction History</h2>
                    <div class="section-controls">
                        <select class="filter-select">
                            <option value="all">All Transactions</option>
                            <option value="deposits">Deposits</option>
                            <option value="withdrawals">Withdrawals</option>
                            <option value="trades">Trades</option>
                        </select>
                        <button class="refresh-btn"><i class="fas fa-sync-alt"></i> Refresh</button>
                    </div>
                </div>
                
                <div class="history-content">
                    <div class="history-table">
                        <div class="table-header">
                            <div class="col-date">Date</div>
                            <div class="col-type">Type</div>
                            <div class="col-amount">Amount</div>
                            <div class="col-status">Status</div>
                            <div class="col-details">Details</div>
                        </div>
                        <div class="table-body" id="historyTableBody">
                            <div class="history-row">
                                <div class="col-date">2024-01-15 14:30</div>
                                <div class="col-type"><span class="type-badge deposit">Deposit</span></div>
                                <div class="col-amount">+$1,000.00</div>
                                <div class="col-status"><span class="status-badge completed">Completed</span></div>
                                <div class="col-details">Bank Transfer</div>
                            </div>
                            <div class="history-row">
                                <div class="col-date">2024-01-14 09:15</div>
                                <div class="col-type"><span class="type-badge trade">Trade</span></div>
                                <div class="col-amount">+$250.50</div>
                                <div class="col-status"><span class="status-badge completed">Completed</span></div>
                                <div class="col-details">EUR/USD Buy</div>
                            </div>
                            <div class="history-row">
                                <div class="col-date">2024-01-13 16:45</div>
                                <div class="col-type"><span class="type-badge withdrawal">Withdrawal</span></div>
                                <div class="col-amount">-$500.00</div>
                                <div class="col-status"><span class="status-badge pending">Pending</span></div>
                                <div class="col-details">Bank Transfer</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            mainContent.appendChild(historySection);
        }
        
        // Hide other sections and show history
        document.querySelector('.trading-interface').style.display = 'none';
        document.querySelector('.crypto-portfolio-section').style.display = 'none';
        historySection.style.display = 'block';
    }

    showSupportSection() {
        // Create and show support section
        const mainContent = document.querySelector('.dashboard-main');
        let supportSection = document.getElementById('supportSection');
        
        if (!supportSection) {
            supportSection = document.createElement('div');
            supportSection.id = 'supportSection';
            supportSection.className = 'dashboard-section support-section';
            supportSection.innerHTML = `
                <div class="section-header">
                    <h2><i class="fas fa-question-circle"></i> Contact Support</h2>
                </div>
                
                <div class="support-content">
                    <div class="support-grid">
                        <div class="support-card">
                            <div class="support-icon">
                                <i class="fas fa-envelope"></i>
                            </div>
                            <h3>Email Support</h3>
                            <p>Get help via email within 24 hours</p>
                            <a href="mailto:support@centraltradehub.com" class="support-btn">
                                <i class="fas fa-paper-plane"></i> Send Email
                            </a>
                        </div>
                        
                        <div class="support-card">
                            <div class="support-icon">
                                <i class="fas fa-comments"></i>
                            </div>
                            <h3>Live Chat</h3>
                            <p>Chat with our support team in real-time</p>
                            <button class="support-btn" onclick="openLiveChat()">
                                <i class="fas fa-comment-dots"></i> Start Chat
                            </button>
                        </div>
                        
                        <div class="support-card">
                            <div class="support-icon">
                                <i class="fas fa-phone"></i>
                            </div>
                            <h3>Phone Support</h3>
                            <p>Call us during business hours</p>
                            <a href="tel:+1-800-TRADE-HUB" class="support-btn">
                                <i class="fas fa-phone-alt"></i> Call Now
                            </a>
                        </div>
                        
                        <div class="support-card">
                            <div class="support-icon">
                                <i class="fas fa-book"></i>
                            </div>
                            <h3>Knowledge Base</h3>
                            <p>Find answers in our help center</p>
                            <button class="support-btn" onclick="openKnowledgeBase()">
                                <i class="fas fa-search"></i> Browse Articles
                            </button>
                        </div>
                    </div>
                    
                    <div class="contact-form">
                        <h3>Send us a Message</h3>
                        <form id="supportForm">
                            <div class="form-group">
                                <label for="supportSubject">Subject</label>
                                <select id="supportSubject" required>
                                    <option value="">Select a topic</option>
                                    <option value="account">Account Issues</option>
                                    <option value="trading">Trading Questions</option>
                                    <option value="deposits">Deposits & Withdrawals</option>
                                    <option value="technical">Technical Support</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="supportMessage">Message</label>
                                <textarea id="supportMessage" rows="5" placeholder="Describe your issue or question..." required></textarea>
                            </div>
                            <button type="submit" class="submit-btn">
                                <i class="fas fa-paper-plane"></i> Send Message
                            </button>
                        </form>
                    </div>
                </div>
            `;
            mainContent.appendChild(supportSection);
            
            // Add form submission handler
            document.getElementById('supportForm').addEventListener('submit', this.handleSupportForm.bind(this));
        }
        
        // Hide other sections and show support
        document.querySelector('.trading-interface').style.display = 'none';
        document.querySelector('.crypto-portfolio-section').style.display = 'none';
        supportSection.style.display = 'block';
    }

    handleSupportForm(e) {
        e.preventDefault();
        const subject = document.getElementById('supportSubject').value;
        const message = document.getElementById('supportMessage').value;
        
        // Here you would typically send the form data to your backend
        console.log('Support form submitted:', { subject, message });
        alert('Thank you for contacting us! We\'ll get back to you within 24 hours.');
        
        // Reset form
        document.getElementById('supportForm').reset();
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
        // Market price updates will be implemented here
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
    
    // Add KYC verification method
    async handleKYCVerification() {
        try {
            // Check if user is already verified
            const user = auth.currentUser;
            if (!user) {
                alert('Please log in to access KYC verification.');
                return;
            }
            
            // Get user's KYC status from Firebase
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.kycStatus === 'verified') {
                    alert('Your account is already KYC verified!');
                    return;
                } else if (userData.kycStatus === 'pending') {
                    alert('Your KYC verification is currently under review. Please wait for approval.');
                    return;
                }
            }
            
            // Redirect to KYC verification page or show modal
            this.showKYCModal();
            
        } catch (error) {
            console.error('Error checking KYC status:', error);
            alert('Unable to access KYC verification. Please try again later.');
        }
    }
    
    showKYCModal() {
        // Create KYC modal if it doesn't exist
        let kycModal = document.getElementById('kycModal');
        if (!kycModal) {
            kycModal = document.createElement('div');
            kycModal.id = 'kycModal';
            kycModal.className = 'modal';
            kycModal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>KYC Verification</h3>
                        <span class="close" onclick="document.getElementById('kycModal').style.display='none'">&times;</span>
                    </div>
                    <div class="modal-body">
                        <p>Complete your identity verification to unlock all trading features and higher limits.</p>
                        <div class="kyc-benefits">
                            <h4>Benefits of KYC Verification:</h4>
                            <ul>
                                <li>✅ Higher deposit and withdrawal limits</li>
                                <li>✅ Faster withdrawal processing</li>
                                <li>✅ Access to premium trading features</li>
                                <li>✅ Enhanced account security</li>
                            </ul>
                        </div>
                        <div class="kyc-requirements">
                            <h4>Required Documents:</h4>
                            <ul>
                                <li>Government-issued ID (Passport, Driver's License, or National ID)</li>
                                <li>Proof of Address (Utility bill or Bank statement, not older than 3 months)</li>
                                <li>Selfie with your ID document</li>
                            </ul>
                        </div>
                        <div class="kyc-actions">
                            <button class="action-btn primary" onclick="startSumsubVerification()">
                                <i class="fas fa-shield-alt"></i>
                                Start Verification (Free)
                            </button>
                            <button class="action-btn secondary" onclick="document.getElementById('kycModal').style.display='none'">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(kycModal);
        }
        
        kycModal.style.display = 'block';
    }
}

// Sumsub KYC Integration
window.startSumsubVerification = async () => {
    try {
        // Initialize Sumsub SDK (you'll need to add their script to your HTML)
        const sumsub = window.snsWebSdk;
        if (!sumsub) {
            alert('KYC service is currently unavailable. Please try again later.');
            return;
        }
        
        const user = auth.currentUser;
        if (!user) {
            alert('Please log in to start verification.');
            return;
        }
        
        // Configure Sumsub
        const config = {
            lang: 'en',
            email: user.email,
            userId: user.uid,
            // Add your Sumsub configuration here
        };
        
        sumsub.init('#sumsub-websdk-container', config)
            .then(() => {
                document.getElementById('kycModal').style.display = 'none';
            })
            .catch((error) => {
                console.error('Sumsub initialization error:', error);
                alert('Failed to start verification. Please try again.');
            });
            
    } catch (error) {
        console.error('KYC verification error:', error);
        alert('Verification service unavailable. Please contact support.');
    }
};

// Global KYC function
window.handleKYCVerification = () => {
    if (window.dashboardManager) {
        window.dashboardManager.handleKYCVerification();
    } else {
        console.error('Dashboard manager not initialized');
    }
};
window.openTradingModal = () => {
    document.getElementById('tradingModal').style.display = 'block';
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
    window.dashboardManager = new DashboardManager();
});

// Export for use in other modules
export default DashboardManager;

// Sumsub KYC Integration
window.startSumsubVerification = async () => {
    try {
        // Initialize Sumsub SDK (you'll need to add their script to your HTML)
        const sumsub = window.snsWebSdk;
        if (!sumsub) {
            alert('KYC service is currently unavailable. Please try again later.');
            return;
        }
        
        const user = auth.currentUser;
        if (!user) {
            alert('Please log in to start verification.');
            return;
        }
        
        // Configure Sumsub
        const config = {
            lang: 'en',
            email: user.email,
            userId: user.uid,
            // Add your Sumsub configuration here
        };
        
        sumsub.init('#sumsub-websdk-container', config)
            .then(() => {
                document.getElementById('kycModal').style.display = 'none';
            })
            .catch((error) => {
                console.error('Sumsub initialization error:', error);
                alert('Failed to start verification. Please try again.');
            });
            
    } catch (error) {
        console.error('KYC verification error:', error);
        alert('Verification service unavailable. Please contact support.');
    }
};

// Global KYC function
window.handleKYCVerification = () => {
    if (window.dashboardManager) {
        window.dashboardManager.handleKYCVerification();
    } else {
        console.error('Dashboard manager not initialized');
    }
};
window.openTradingModal = () => {
    document.getElementById('tradingModal').style.display = 'block';
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
    window.dashboardManager = new DashboardManager();
});

// Export for use in other modules
export default DashboardManager;