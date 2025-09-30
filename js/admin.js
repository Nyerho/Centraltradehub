// Enhanced Admin Dashboard with Firebase Integration
// Comprehensive CRUD operations and real-time data management

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut,
    createUserWithEmailAndPassword,
    updatePassword,
    deleteUser,
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    doc, 
    getDocs, 
    getDoc,
    addDoc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot,
    query,
    orderBy,
    where,
    limit,
    serverTimestamp,
    setDoc,
    enableNetwork,
    disableNetwork,
    increment
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration (import from existing config)
import { firebaseConfig } from './firebase-config.js';

class EnhancedAdminDashboard {
    constructor() {
        this.app = initializeApp(firebaseConfig);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);
        this.currentUser = null;
        this.users = [];
        this.transactions = [];
        this.trades = [];
        this.withdrawals = [];
        this.currentPage = 'dashboard';
        this.usersPerPage = 10;
        this.currentUserPage = 1;
        
        // Add filtered collections
        this.filteredUsers = [];
        this.filteredTrades = [];
        this.filteredTransactions = [];
          
        // Add loading flags to prevent duplicates
        this.isLoadingFinancial = false;
        this.isLoadingFunding = false;
        this.retryAttempts = 0;
        this.maxRetries = 3;
        this.isOnline = navigator.onLine;
        
        // Setup network listeners
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('Network connection restored');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('Network connection lost');
        });
        
        // Add chart instances to track and destroy them
        this.chartInstances = {
            tradingVolume: null,
            userGrowth: null,
            revenue: null,
            userActivity: null
        };
        
        // Remove this.init() call to prevent double initialization
        // this.init();
    }

    async init() {
        try {
            this.app = initializeApp(firebaseConfig);
            this.auth = getAuth(this.app);
            this.db = getFirestore(this.app);
            
            // Wait for authentication state before checking admin access
            await this.waitForAuthState();
            await this.checkAdminAccess();
            this.setupEventListeners();
            this.setupNetworkListeners();
            
            // Initialize dashboard by default
            this.navigateToPage('dashboard');
            
            console.log('Enhanced Admin Dashboard initialized successfully');
        } catch (error) {
            console.error('Failed to initialize admin dashboard:', error);
            if (error.code === 'auth/network-request-failed') {
                this.showNotification('Network error. Please check your connection.', 'error');
            } else {
                this.redirectToLogin();
            }
        }
    }

    // Add this new method to wait for authentication state
    waitForAuthState() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Authentication timeout'));
            }, 10000);
            
            const unsubscribe = onAuthStateChanged(this.auth, (user) => {
                clearTimeout(timeout);
                this.currentUser = user;
                console.log('Auth state changed, user:', user ? user.email : 'No user');
                
                if (!user) {
                    console.log('No authenticated user found, redirecting to login');
                    this.redirectToLogin();
                    reject(new Error('No authenticated user'));
                    return;
                }
                
                unsubscribe();
                resolve(user);
            });
        });
    }

    async checkAdminAccess() {
        try {
            if (!this.currentUser) {
                console.log('No current user available for admin check');
                this.redirectToLogin();
                return false;
            }
            
            console.log('Checking admin access for user:', this.currentUser.uid);
            const userDoc = await getDoc(doc(this.db, 'users', this.currentUser.uid));
            
            console.log('User document exists:', userDoc.exists());
            if (userDoc.exists()) {
                const userData = userDoc.data();
                console.log('User data:', userData);
                console.log('User role:', userData.role);
                console.log('Role check result:', userData.role === 'admin');
            }
            
            if (!userDoc.exists() || userDoc.data().role !== 'admin') {
                console.log('Access denied - redirecting to login');
                this.showNotification('Access denied. Admin privileges required.', 'error');
                await signOut(this.auth);
                this.redirectToLogin();
                return false;
            }
            
            console.log('Admin access granted');
            // Update UI with admin info
            this.updateAdminInfo(userDoc.data());
            return true;
            
        } catch (error) {
            console.error('Admin access check error:', error);
            this.redirectToLogin();
            return false;
        }
    }

    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('Network connection restored');
            this.handleNetworkReconnection();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('Network connection lost');
            this.showNotification('Network connection lost. Working in offline mode.', 'warning');
        });
    }

    async handleNetworkReconnection() {
        try {
            await enableNetwork(this.db);
            this.showNotification('Connection restored. Syncing data...', 'success');
            await this.loadDashboardData();
        } catch (error) {
            console.error('Error reconnecting to Firebase:', error);
        }
    }

    async executeWithRetry(operation, context = 'operation') {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                console.error(`${context} attempt ${attempt} failed:`, error);
                
                if (attempt === this.maxRetries) {
                    throw new Error(`${context} failed after ${this.maxRetries} attempts: ${error.message}`);
                }
                
                // Exponential backoff
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.section; // Changed from dataset.page
                this.navigateToPage(page);
            });
        });

        // Mobile menu toggle - Improved with multiple fallbacks
        const mobileMenuBtn = document.getElementById('sidebarToggle') || 
                             document.querySelector('.sidebar-toggle') ||
                             document.querySelector('.mobile-menu-toggle');
        
        if (mobileMenuBtn) {
            console.log('Mobile menu button found:', mobileMenuBtn);
            mobileMenuBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleMobileMenu();
            });
        } else {
            console.error('Mobile menu button not found! Available elements:', {
                sidebarToggle: document.getElementById('sidebarToggle'),
                sidebarToggleClass: document.querySelector('.sidebar-toggle'),
                mobileToggleClass: document.querySelector('.mobile-menu-toggle')
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('adminSidebar');
            const toggleBtn = document.getElementById('sidebarToggle');
            
            if (sidebar && sidebar.classList.contains('mobile-open')) {
                if (!sidebar.contains(e.target) && !toggleBtn?.contains(e.target)) {
                    this.toggleMobileMenu();
                }
            }
        });

        // User management events
        this.setupUserManagementEvents();
        
        // Trading management events
        this.setupTradingManagementEvents();
        
        // Transaction events
        this.setupTransactionEvents();
        
        // Settings events
        this.setupSettingsEvents();
        
        // Withdrawal management events
        this.setupWithdrawalEvents();
        
        // COT management events
        this.setupCotEventListeners();
    }

    setupUserManagementEvents() {
        // Add user form
        const addUserForm = document.getElementById('addUserForm');
        if (addUserForm) {
            addUserForm.addEventListener('submit', this.handleAddUser.bind(this));
        }

        // Edit user form
        const editUserForm = document.getElementById('editUserForm');
        if (editUserForm) {
            editUserForm.addEventListener('submit', this.handleEditUser.bind(this));
        }

        // User search
        const userSearch = document.getElementById('userSearch');
        if (userSearch) {
            userSearch.addEventListener('input', this.handleUserSearch.bind(this));
        }

        // User filters
        const userStatusFilter = document.getElementById('userStatusFilter');
        const userRoleFilter = document.getElementById('userRoleFilter');
        
        if (userStatusFilter) {
            userStatusFilter.addEventListener('change', this.filterUsers.bind(this));
        }
        
        if (userRoleFilter) {
            userRoleFilter.addEventListener('change', this.filterUsers.bind(this));
        }

        // Bulk actions
        const bulkActionBtn = document.getElementById('bulkActionBtn');
        if (bulkActionBtn) {
            bulkActionBtn.addEventListener('click', this.handleBulkAction.bind(this));
        }

        // Pagination
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('page-link')) {
                e.preventDefault();
                const page = parseInt(e.target.dataset.page);
                this.currentUserPage = page;
                this.renderUsersTable();
            }
        });
    }

    setupTradingManagementEvents() {
        // Trading config form
        const tradingConfigForm = document.getElementById('tradingConfigForm');
        if (tradingConfigForm) {
            tradingConfigForm.addEventListener('submit', this.handleTradingConfig.bind(this));
        }
        
        // Trade management buttons
        const addTradeBtn = document.getElementById('addTradeBtn');
        if (addTradeBtn) {
            addTradeBtn.addEventListener('click', this.openAddTradeModal.bind(this));
        }
        
        // Trade search and filters
        const tradeSearchInput = document.getElementById('tradeSearchInput');
        const tradeStatusFilter = document.getElementById('tradeStatusFilter');
        const tradeTypeFilter = document.getElementById('tradeTypeFilter');
        const tradeDateFilter = document.getElementById('tradeDateFilter');
        
        if (tradeSearchInput) {
            tradeSearchInput.addEventListener('input', this.filterTrades.bind(this));
        }
        
        if (tradeStatusFilter) {
            tradeStatusFilter.addEventListener('change', this.filterTrades.bind(this));
        }
        
        if (tradeTypeFilter) {
            tradeTypeFilter.addEventListener('change', this.filterTrades.bind(this));
        }
        
        if (tradeDateFilter) {
            tradeDateFilter.addEventListener('change', this.filterTrades.bind(this));
        }
        
        // Save trade form
        const saveTradeBtn = document.getElementById('saveTradeBtn');
        if (saveTradeBtn) {
            saveTradeBtn.addEventListener('click', this.saveTradeRecord.bind(this));
        }
    }

    setupTransactionEvents() {
        // Transaction filters
        const transactionTypeFilter = document.getElementById('transactionTypeFilter');
        const transactionStatusFilter = document.getElementById('transactionStatusFilter');
        const transactionDateFilter = document.getElementById('transactionDateFilter');
        
        if (transactionTypeFilter) {
            transactionTypeFilter.addEventListener('change', this.filterTransactions.bind(this));
        }
        
        if (transactionStatusFilter) {
            transactionStatusFilter.addEventListener('change', this.filterTransactions.bind(this));
        }
        
        if (transactionDateFilter) {
            transactionDateFilter.addEventListener('change', this.filterTransactions.bind(this));
        }
        
        // Transaction management buttons
        const addTransactionBtn = document.getElementById('addTransactionBtn');
        if (addTransactionBtn) {
            addTransactionBtn.addEventListener('click', this.openAddTransactionModal.bind(this));
        }
        
        // Save transaction form
        const saveTransactionBtn = document.getElementById('saveTransactionBtn');
        if (saveTransactionBtn) {
            saveTransactionBtn.addEventListener('click', this.saveTransactionRecord.bind(this));
        }
    }

    setupSettingsEvents() {
        // Site settings forms
        const generalSettingsForm = document.getElementById('generalSettingsForm');
        const securitySettingsForm = document.getElementById('securitySettingsForm');
        const notificationSettingsForm = document.getElementById('notificationSettingsForm');
        const maintenanceSettingsForm = document.getElementById('maintenanceSettingsForm');
        
        if (generalSettingsForm) {
            generalSettingsForm.addEventListener('submit', this.handleGeneralSettings.bind(this));
        }
        
        if (securitySettingsForm) {
            securitySettingsForm.addEventListener('submit', this.handleSecuritySettings.bind(this));
        }
        
        if (notificationSettingsForm) {
            notificationSettingsForm.addEventListener('submit', this.handleNotificationSettings.bind(this));
        }
        
        if (maintenanceSettingsForm) {
            maintenanceSettingsForm.addEventListener('submit', this.handleMaintenanceSettings.bind(this));
        }
    }

    setupWithdrawalEvents() {
        // Withdrawal approval/rejection
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('approve-withdrawal')) {
                const withdrawalId = e.target.dataset.withdrawalId;
                this.handleWithdrawalApproval(withdrawalId, 'approved');
            }
            
            if (e.target.classList.contains('reject-withdrawal')) {
                const withdrawalId = e.target.dataset.withdrawalId;
                this.handleWithdrawalApproval(withdrawalId, 'rejected');
            }
        });
    }
    
    setupCotEventListeners() {
        const updateBtn = document.getElementById('updateGlobalCot');
        const generateBtn = document.getElementById('generateRandomGlobalCot');
        const copyBtn = document.getElementById('copyGlobalCot');
        
        if (updateBtn) {
            updateBtn.addEventListener('click', () => this.updateGlobalCotCode());
        }
        
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                const newCodeInput = document.getElementById('newGlobalCot');
                if (newCodeInput) {
                    newCodeInput.value = this.generateRandomCotCode();
                }
            });
        }
        
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyGlobalCotCode());
        }
    }

    async loadDashboardData() {
        try {
            this.showLoading(true);
            
            // Load data with individual error handling
            const results = await Promise.allSettled([
                this.loadUsers(),
                this.loadTransactions(),
                this.loadTrades(),
                this.loadWithdrawals(),
                this.loadSiteSettings(),
                this.loadGlobalCotCode()
            ]);
            
            // Log any failures for debugging
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    const methods = ['loadUsers', 'loadTransactions', 'loadTrades', 'loadWithdrawals', 'loadSiteSettings', 'loadGlobalCotCode'];
                    console.warn(`${methods[index]} failed (likely empty collection):`, result.reason.message);
                }
            });
            
            // Update dashboard stats
            this.updateDashboardStats();
            
            // Initialize charts
            this.initializeCharts();
            
            this.showLoading(false);
            
        } catch (error) {
            console.error('Dashboard data loading error:', error);
            this.showNotification('Failed to load dashboard data', 'error');
            this.showLoading(false);
        }
    }

    async loadUsers() {
        try {
            console.log('Loading users from Firestore...');
            const usersQuery = query(
                collection(this.db, 'users'),
                orderBy('createdAt', 'desc')
            );
            
            const snapshot = await getDocs(usersQuery);
            console.log(`Found ${snapshot.docs.length} users`);
            
            this.users = snapshot.docs.map(doc => {
                const userData = { id: doc.id, ...doc.data() };
                console.log('User data:', userData); // Debug log
                return userData;
            });
            
            console.log('Users loaded:', this.users);
            this.renderUsersTable();
            this.updateUserStats();
            
        } catch (error) {
            console.error('Users loading error:', error);
            
            // Show more specific error messages
            if (error.code === 'permission-denied') {
                this.showNotification('Access denied. Please check your admin permissions.', 'error');
            } else if (error.code === 'unavailable') {
                this.showNotification('Database temporarily unavailable. Please try again.', 'error');
            } else {
                this.showNotification('Failed to load users: ' + error.message, 'error');
            }
            
            // Show empty state in table
            const tableBody = document.getElementById('usersTableBody');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-4">
                            <div class="text-muted">
                                <i class="fas fa-exclamation-triangle fa-2x mb-2 text-warning"></i>
                                <p>Failed to load users</p>
                                <button class="btn btn-sm btn-primary" onclick="adminDashboard.loadUsers()">Retry</button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }
    }

    async loadTransactions() {
        try {
            const transactionsQuery = query(
                collection(this.db, 'transactions'),
                orderBy('timestamp', 'desc'),
                limit(100)
            );
            
            const snapshot = await getDocs(transactionsQuery);
            this.transactions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.renderTransactionsTable();
            
        } catch (error) {
            console.error('Transactions loading error:', error);
            this.showNotification('Failed to load transactions', 'error');
        }
    }

    async loadTrades() {
        try {
            const tradesQuery = query(
                collection(this.db, 'trades'),
                orderBy('timestamp', 'desc'),
                limit(50)
            );
            
            const snapshot = await getDocs(tradesQuery);
            this.trades = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.renderTradesTable();
            this.updateTradingStats();
            
        } catch (error) {
            console.error('Trades loading error:', error);
            this.showNotification('Failed to load trades', 'error');
        }
    }

    async loadWithdrawals() {
        try {
            const withdrawalsQuery = query(
                collection(this.db, 'withdrawals'),
                orderBy('timestamp', 'desc')
            );
            
            const snapshot = await getDocs(withdrawalsQuery);
            this.withdrawals = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.renderWithdrawalsTable();
            
        } catch (error) {
            console.error('Withdrawals loading error:', error);
            this.showNotification('Failed to load withdrawals', 'error');
        }
    }
    
    // Add missing refreshWithdrawals method
    refreshWithdrawals() {
        return this.loadWithdrawals();
    }
    
    async loadGlobalCotCode() {
        try {
            const docRef = doc(this.db, 'admin', 'withdrawal-settings');
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                const currentCotInput = document.getElementById('currentGlobalCot');
                const lastUpdatedSpan = document.getElementById('cotLastUpdated');
                const updatedBySpan = document.getElementById('cotUpdatedBy');
                
                if (currentCotInput) currentCotInput.value = data.cotCode || '';
                if (lastUpdatedSpan) lastUpdatedSpan.textContent = data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'Never';
                if (updatedBySpan) updatedBySpan.textContent = data.updatedBy || 'Admin';
            } else {
                // Initialize with default COT code
                await this.initializeGlobalCot();
            }
        } catch (error) {
            console.error('Error loading global COT code:', error);
            this.showNotification('Failed to load COT code', 'error');
        }
    }
    
    async initializeGlobalCot() {
        try {
            const defaultCode = this.generateRandomCotCode();
            const cotData = {
                cotCode: defaultCode,
                lastUpdated: new Date().toISOString(),
                updatedBy: 'System',
                createdAt: new Date().toISOString()
            };
            
            const docRef = doc(this.db, 'admin', 'withdrawal-settings');
            await setDoc(docRef, cotData);
            
            await this.loadGlobalCotCode();
            this.showNotification('Global COT code initialized', 'success');
        } catch (error) {
            console.error('Error initializing global COT:', error);
        }
    }
    
    async updateGlobalCotCode() {
        try {
            const newCodeInput = document.getElementById('newGlobalCot');
            let newCode = newCodeInput.value.trim();
            
            if (!newCode) {
                this.showNotification('Please enter a new COT code', 'error');
                return;
            }
            
            if (newCode.length < 4) {
                this.showNotification('COT code must be at least 4 characters long', 'error');
                return;
            }
            
            const cotData = {
                cotCode: newCode,
                lastUpdated: new Date().toISOString(),
                updatedBy: this.currentUser?.email || 'Admin'
            };
            
            const docRef = doc(this.db, 'admin', 'withdrawal-settings');
            await setDoc(docRef, cotData, { merge: true });
            
            await this.loadGlobalCotCode();
            newCodeInput.value = '';
            
            this.showNotification('Global COT code updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating global COT code:', error);
            this.showNotification('Error updating COT code', 'error');
        }
    }
    
    generateRandomCotCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    copyGlobalCotCode() {
        const currentCotInput = document.getElementById('currentGlobalCot');
        const cotCode = currentCotInput?.value || '';
        
        if (!cotCode) {
            this.showNotification('No COT code to copy', 'error');
            return;
        }
        
        navigator.clipboard.writeText(cotCode).then(() => {
            this.showNotification('COT code copied to clipboard', 'success');
        }).catch(() => {
            this.showNotification('Failed to copy COT code', 'error');
        });
    }
    
    async loadUsersSection() {
        try {
            console.log('Starting to load users section...'); // Debug log
            const usersSnapshot = await getDocs(collection(this.db, 'users'));
            const tbody = document.getElementById('usersTableBody');
            
            console.log('Users table body element:', tbody); // Debug log
            console.log('Users snapshot size:', usersSnapshot.size); // Debug log
            
            if (!tbody) {
                console.error('usersTableBody element not found!');
                return;
            }
            
            if (usersSnapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No users found</td></tr>';
                console.log('No users found in database');
                return;
            }
            
            let html = '';
            usersSnapshot.forEach(doc => {
                const user = doc.data();
                html += `
                    <tr>
                        <td>${user.email || 'N/A'}</td>
                        <td>${user.displayName || user.firstName + ' ' + user.lastName || 'N/A'}</td>
                        <td>$${(user.balance || 0).toFixed(2)}</td>
                        <td><span class="badge bg-${user.isActive ? 'success' : 'danger'}">${user.isActive ? 'Active' : 'Inactive'}</span></td>
                        <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
                        <td>
                            <button class="btn btn-sm btn-primary me-1" onclick="adminDashboard.viewUser('${doc.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-warning me-1" onclick="adminDashboard.editUser('${doc.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            tbody.innerHTML = html;
            console.log('Users table populated successfully'); // Debug log
        } catch (error) {
            console.error('Error loading users:', error);
            const tbody = document.getElementById('usersTableBody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">Error loading users</td></tr>';
            }
        }
    }
    
       loadFinancialData() {
        // Prevent duplicate loading
        if (this.isLoadingFinancial) {
            return;
        }
        this.isLoadingFinancial = true;
        console.log('Loading financial data...');
        
        this.executeWithRetry(async () => {
            if (!this.isOnline) {
                throw new Error('No network connection');
            }

            // Load financial transactions
            const transactionsQuery = query(
                collection(this.db, 'transactions'),
                orderBy('timestamp', 'desc'),
                limit(50)
            );
            
            const transactionsSnapshot = await getDocs(transactionsQuery);
            const transactions = [];
            
            transactionsSnapshot.forEach(doc => {
                transactions.push({ id: doc.id, ...doc.data() });
            });
            
            // Update financial dashboard
            this.updateFinancialStats(transactions);
            this.renderFinancialTable(transactions);
            
            console.log('Financial data loaded successfully');
        }, 'Financial data loading')
        .catch(error => {
            console.error('Failed to load financial data:', error);
            this.showNotification('Failed to load financial data. Please check your connection.', 'error');
            
            // Show offline message or cached data
            this.showOfflineFinancialData();
        })
        .finally(() => {
            this.isLoadingFinancial = false;
        });
    }
    
    loadFundingData() {
        // Prevent duplicate loading
        if (this.isLoadingFunding) {
            return;
        }
        this.isLoadingFunding = true;
        console.log('Loading funding data...');
        
        this.executeWithRetry(async () => {
            if (!this.isOnline) {
                throw new Error('No network connection');
            }

            // Load funding transactions
            const fundingQuery = query(
                collection(this.db, 'funding'),
                orderBy('timestamp', 'desc'),
                limit(50)
            );
            
            const fundingSnapshot = await getDocs(fundingQuery);
            const fundingData = [];
            
            fundingSnapshot.forEach(doc => {
                fundingData.push({ id: doc.id, ...doc.data() });
            });
            
            // Update funding dashboard
            this.updateFundingStats(fundingData);
            this.renderFundingTable(fundingData);
            
            console.log('Funding data loaded successfully');
        }, 'Funding data loading')
        .catch(error => {
            console.error('Failed to load funding data:', error);
            this.showNotification('Failed to load funding data. Please check your connection.', 'error');
            
            // Show offline message or cached data
            this.showOfflineFundingData();
        })
        .finally(() => {
            this.isLoadingFunding = false;
        });
    }
    
    loadUserFinancialSection() {
        // Prevent duplicate loading
        if (this.isLoadingUserFinancial) {
            return;
        }
        this.isLoadingUserFinancial = true;
        console.log('Loading user financial data...');
        
        this.executeWithRetry(async () => {
            if (!this.isOnline) {
                throw new Error('No network connection');
            }

            // Load all users with their financial data
            const usersQuery = query(
                collection(this.db, 'users'),
                orderBy('createdAt', 'desc')
            );
            
            const usersSnapshot = await getDocs(usersQuery);
            const usersFinancialData = [];
            
            for (const userDoc of usersSnapshot.docs) {
                const userData = userDoc.data();
                const userId = userDoc.id;
                
                // Get user's transaction summary
                const transactionsQuery = query(
                    collection(this.db, 'transactions'),
                    where('uid', '==', userId)
                );
                
                const transactionsSnapshot = await getDocs(transactionsQuery);
                let totalDeposits = 0;
                let totalWithdrawals = 0;
                let transactionCount = 0;
                
                transactionsSnapshot.forEach(doc => {
                    const transaction = doc.data();
                    transactionCount++;
                    if (transaction.type === 'deposit' && transaction.status === 'completed') {
                        totalDeposits += transaction.amount || 0;
                    } else if (transaction.type === 'withdrawal' && transaction.status === 'completed') {
                        totalWithdrawals += transaction.amount || 0;
                    }
                });
                
                usersFinancialData.push({
                    id: userId,
                    email: userData.email,
                    displayName: userData.displayName || 'N/A',
                    balance: userData.balance || 0,
                    totalDeposits,
                    totalWithdrawals,
                    transactionCount,
                    lastActivity: userData.lastActivity || userData.createdAt
                });
            }
            
            // Render the user financial table
            this.renderUserFinancialTable(usersFinancialData);
            
            console.log('User financial data loaded successfully');
        }, 'User financial data loading')
        .catch(error => {
            console.error('Failed to load user financial data:', error);
            this.showNotification('Failed to load user financial data. Please check your connection.', 'error');
        })
        .finally(() => {
            this.isLoadingUserFinancial = false;
        });
    }
    
    loadUserControlSection() {
        console.log('Loading user control section...');
        // Initialize the user control section
        this.setupUserControlTabs();
        // Load initial data for withdrawal control tab
        this.refreshWithdrawals();
    }

    setupUserControlTabs() {
        // Setup tab switching functionality
        const tabButtons = document.querySelectorAll('.user-control-tab');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = button.getAttribute('data-tab');
                
                // Remove active class from all tabs and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                button.classList.add('active');
                const targetContent = document.getElementById(targetTab);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
                
                // Load tab-specific data
                if (targetTab === 'withdrawal-control-content') {
                    this.refreshWithdrawals();
                }
            });
        });
        
        // Setup search functionality for each tab
        this.setupUserControlSearches();
    }

    setupUserControlSearches() {
        // Password Management search
        const passwordSearchBtn = document.getElementById('search-user-password');
        if (passwordSearchBtn) {
            passwordSearchBtn.addEventListener('click', () => this.searchUserForPassword());
        }
        
        // Account Control search
        const accountSearchBtn = document.getElementById('search-user-account');
        if (accountSearchBtn) {
            accountSearchBtn.addEventListener('click', () => this.searchUserForAccount());
        }
        
        // Setup other button event listeners
        const resetPasswordBtn = document.getElementById('reset-user-password');
        if (resetPasswordBtn) {
            resetPasswordBtn.addEventListener('click', () => this.resetUserPassword());
        }
        
        const generateTempBtn = document.getElementById('generate-temp-password');
        if (generateTempBtn) {
            generateTempBtn.addEventListener('click', () => this.generateTempPassword());
        }
        
        const setPasswordBtn = document.getElementById('set-user-password');
        if (setPasswordBtn) {
            setPasswordBtn.addEventListener('click', () => this.setUserPassword());
        }
        
        // Account control buttons
        const activateBtn = document.getElementById('activate-user');
        if (activateBtn) {
            activateBtn.addEventListener('click', () => this.activateUser());
        }
        
        const suspendBtn = document.getElementById('suspend-user');
        if (suspendBtn) {
            suspendBtn.addEventListener('click', () => this.suspendUser());
        }
        
        const blockBtn = document.getElementById('block-user');
        if (blockBtn) {
            blockBtn.addEventListener('click', () => this.blockUser());
        }
        
        const restrictBtn = document.getElementById('restrict-user');
        if (restrictBtn) {
            restrictBtn.addEventListener('click', () => this.restrictUser());
        }
    }
    
    renderUserFinancialTable(usersData) {
        const tableBody = document.getElementById('userFinancialTableBody');
        if (!tableBody) {
            console.error('User financial table body not found');
            return;
        }
        
        // Hide loading spinner
        const loadingSpinner = document.querySelector('#user-financial .loading-spinner');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
        
        if (usersData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No users found</td></tr>';
            return;
        }
        
        tableBody.innerHTML = usersData.map(user => {
            const lastActivity = user.lastActivity ? 
                (user.lastActivity.toDate ? user.lastActivity.toDate().toLocaleDateString() : 
                 new Date(user.lastActivity).toLocaleDateString()) : 'Never';
            
            return `
                <tr>
                    <td>${user.email}</td>
                    <td>${user.displayName}</td>
                    <td>$${user.balance.toFixed(2)}</td>
                    <td>$${user.totalDeposits.toFixed(2)}</td>
                    <td>$${user.totalWithdrawals.toFixed(2)}</td>
                    <td>${user.transactionCount}</td>
                    <td>${lastActivity}</td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="adminDashboard.selectUserForFinancialManagement('${user.id}', '${user.email}', '${user.displayName}', ${user.balance}, ${user.totalDeposits}, ${user.totalWithdrawals})">
                            <i class="fas fa-edit me-1"></i>Manage
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    updateFinancialStats(transactions) {
        // Calculate financial statistics
        const totalRevenue = transactions
            .filter(t => t.type === 'deposit' && t.status === 'completed')
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        
        const totalWithdrawals = transactions
            .filter(t => t.type === 'withdrawal' && t.status === 'completed')
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        
        // Update UI elements
        const revenueElement = document.getElementById('total-revenue');
        const withdrawalsElement = document.getElementById('total-withdrawals');
        
        if (revenueElement) revenueElement.textContent = `$${totalRevenue.toLocaleString()}`;
        if (withdrawalsElement) withdrawalsElement.textContent = `$${totalWithdrawals.toLocaleString()}`;
    }

    updateFundingStats(fundingData) {
        // Calculate funding statistics
        const totalFunding = fundingData
            .filter(f => f.status === 'completed')
            .reduce((sum, f) => sum + (f.amount || 0), 0);
        
        const pendingFunding = fundingData
            .filter(f => f.status === 'pending')
            .reduce((sum, f) => sum + (f.amount || 0), 0);
        
        // Update UI elements
        const totalFundingElement = document.getElementById('total-funding');
        const pendingFundingElement = document.getElementById('pending-funding');
        
        if (totalFundingElement) totalFundingElement.textContent = `$${totalFunding.toLocaleString()}`;
        if (pendingFundingElement) pendingFundingElement.textContent = `$${pendingFunding.toLocaleString()}`;
    }

    renderFinancialTable(transactions) {
        const tableBody = document.getElementById('financial-transactions-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = transactions.map(transaction => `
            <tr>
                <td>${transaction.id}</td>
                <td>${transaction.type}</td>
                <td>$${transaction.amount?.toLocaleString() || '0'}</td>
                <td><span class="status-${transaction.status}">${transaction.status}</span></td>
                <td>${new Date(transaction.timestamp).toLocaleDateString()}</td>
            </tr>
        `).join('');
    }

    renderFundingTable(fundingData) {
        const tableBody = document.getElementById('depositsTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = fundingData.map(funding => `
            <tr>
                <td>${funding.id}</td>
                <td>${funding.method}</td>
                <td>$${funding.amount?.toLocaleString() || '0'}</td>
                <td><span class="status-${funding.status}">${funding.status}</span></td>
                <td>${new Date(funding.timestamp).toLocaleDateString()}</td>
            </tr>
        `).join('');
    }

    showOfflineFinancialData() {
        const tableBody = document.getElementById('financial-transactions-body');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Offline - Unable to load financial data</td></tr>';
        }
    }

    showOfflineFundingData() {
        const tableBody = document.getElementById('depositsTableBody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Offline - Unable to load funding data</td></tr>';
        }
    }
    
    showFundingError(errorMessage) {
        const fundingSection = document.getElementById('funding-section');
        if (fundingSection) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Error loading funding data:</strong> ${errorMessage}
                    <button onclick="adminDashboard.loadFundingData()" class="btn btn-sm btn-primary ml-2">
                        <i class="fas fa-refresh"></i> Retry
                    </button>
                </div>
            `;
            fundingSection.appendChild(errorDiv);
        }
    }

    async loadSiteSettings() {
        try {
            const settingsDoc = await getDoc(doc(this.db, 'settings', 'site'));
            if (settingsDoc.exists()) {
                this.siteSettings = settingsDoc.data();
                this.populateSettingsForms();
            }
        } catch (error) {
            console.error('Site settings loading error:', error);
        }
    }

    setupRealtimeListeners() {
        // Real-time users listener
        const usersQuery = query(collection(this.db, 'users'));
        onSnapshot(usersQuery, (snapshot) => {
            this.users = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.renderUsersTable();
            this.updateUserStats();
        });

        // Real-time transactions listener
        const transactionsQuery = query(
            collection(this.db, 'transactions'),
            orderBy('timestamp', 'desc'),
            limit(100)
        );
        onSnapshot(transactionsQuery, (snapshot) => {
            this.transactions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.renderTransactionsTable();
        });

        // Real-time trades listener
        const tradesQuery = query(
            collection(this.db, 'trades'),
            orderBy('timestamp', 'desc'),
            limit(100)
        );
        onSnapshot(tradesQuery, (snapshot) => {
            this.trades = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.renderTradesTable();
            this.updateTradingStats();
        });

        // Real-time withdrawals listener
        const withdrawalsQuery = query(
            collection(this.db, 'withdrawals'),
            where('status', '==', 'pending')
        );
        onSnapshot(withdrawalsQuery, (snapshot) => {
            const pendingWithdrawals = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.updateWithdrawalNotifications(pendingWithdrawals.length);
        });
    }

    // User Management Methods
    async handleAddUser(e) {
        e.preventDefault();
        
        try {
            const formData = new FormData(e.target);
            const userData = {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                email: formData.get('email'),
                role: formData.get('role'),
                status: formData.get('status'),
                balance: parseFloat(formData.get('balance')) || 0,
                createdAt: serverTimestamp(),
                createdBy: this.currentUser.uid
            };

            // Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(
                this.auth,
                userData.email,
                formData.get('password')
            );

            // Add user data to Firestore
            await addDoc(collection(this.db, 'users'), {
                ...userData,
                uid: userCredential.user.uid
            });

            this.showNotification('User created successfully', 'success');
            this.closeModal('addUserModal');
            e.target.reset();
            
        } catch (error) {
            console.error('Add user error:', error);
            this.showNotification(error.message, 'error');
        }
    }

    async handleEditUser(e) {
        e.preventDefault();
        
        try {
            const formData = new FormData(e.target);
            const userId = formData.get('userId');
            
            const updateData = {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                email: formData.get('email'),
                role: formData.get('role'),
                status: formData.get('status'),
                balance: parseFloat(formData.get('balance')),
                updatedAt: serverTimestamp(),
                updatedBy: this.currentUser.uid
            };

            await updateDoc(doc(this.db, 'users', userId), updateData);
            
            this.showNotification('User updated successfully', 'success');
            this.closeModal('editUserModal');
            
        } catch (error) {
            console.error('Edit user error:', error);
            this.showNotification(error.message, 'error');
        }
    }

    async handleDeleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }
        
        try {
            await deleteDoc(doc(this.db, 'users', userId));
            this.showNotification('User deleted successfully', 'success');
            
        } catch (error) {
            console.error('Delete user error:', error);
            this.showNotification(error.message, 'error');
        }
    }

    async handlePasswordReset(userId, email) {
        try {
            await sendPasswordResetEmail(this.auth, email);
            this.showNotification('Password reset email sent', 'success');
            
        } catch (error) {
            console.error('Password reset error:', error);
            this.showNotification(error.message, 'error');
        }
    }

    handleUserSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        this.filteredUsers = this.users.filter(user => 
            user.firstName?.toLowerCase().includes(searchTerm) ||
            user.lastName?.toLowerCase().includes(searchTerm) ||
            user.email?.toLowerCase().includes(searchTerm)
        );
        this.renderUsersTable();
    }

    filterUsers() {
        const statusFilter = document.getElementById('userStatusFilter').value;
        const roleFilter = document.getElementById('userRoleFilter').value;
        
        this.filteredUsers = this.users.filter(user => {
            const statusMatch = !statusFilter || user.status === statusFilter;
            const roleMatch = !roleFilter || user.role === roleFilter;
            return statusMatch && roleMatch;
        });
        
        this.renderUsersTable();
    }

    async handleBulkAction() {
        const selectedUsers = document.querySelectorAll('.user-checkbox:checked');
        const action = document.getElementById('bulkActionSelect').value;
        
        if (selectedUsers.length === 0) {
            this.showNotification('Please select users first', 'warning');
            return;
        }
        
        if (!confirm(`Are you sure you want to ${action} ${selectedUsers.length} users?`)) {
            return;
        }
        
        try {
            const promises = Array.from(selectedUsers).map(checkbox => {
                const userId = checkbox.value;
                
                switch (action) {
                    case 'activate':
                        return updateDoc(doc(this.db, 'users', userId), { status: 'active' });
                    case 'deactivate':
                        return updateDoc(doc(this.db, 'users', userId), { status: 'inactive' });
                    case 'delete':
                        return deleteDoc(doc(this.db, 'users', userId));
                    default:
                        return Promise.resolve();
                }
            });
            
            await Promise.all(promises);
            this.showNotification(`Bulk ${action} completed successfully`, 'success');
            
        } catch (error) {
            console.error('Bulk action error:', error);
            this.showNotification(error.message, 'error');
        }
    }

    // Trading Management Methods
    async handleTradingConfig(e) {
        e.preventDefault();
        
        try {
            const formData = new FormData(e.target);
            const configData = {
                minTradeAmount: parseFloat(formData.get('minTradeAmount')),
                maxTradeAmount: parseFloat(formData.get('maxTradeAmount')),
                commissionRate: parseFloat(formData.get('commissionRate')),
                tradingHoursStart: formData.get('tradingHoursStart'),
                tradingHoursEnd: formData.get('tradingHoursEnd'),
                updatedAt: serverTimestamp(),
                updatedBy: this.currentUser.uid
            };

            await updateDoc(doc(this.db, 'settings', 'trading'), configData);
            this.showNotification('Trading configuration updated successfully', 'success');
            
        } catch (error) {
            console.error('Trading config error:', error);
            this.showNotification(error.message, 'error');
        }
    }

    // Withdrawal Management Methods
    async handleWithdrawalApproval(withdrawalId, status) {
        try {
            await updateDoc(doc(this.db, 'withdrawals', withdrawalId), {
                status: status,
                processedAt: serverTimestamp(),
                processedBy: this.currentUser.uid
            });
            
            this.showNotification(`Withdrawal ${status} successfully`, 'success');
            
        } catch (error) {
            console.error('Withdrawal approval error:', error);
            this.showNotification(error.message, 'error');
        }
    }

    // Settings Management Methods
    async handleGeneralSettings(e) {
        e.preventDefault();
        
        try {
            const formData = new FormData(e.target);
            const settingsData = {
                siteName: formData.get('siteName'),
                siteDescription: formData.get('siteDescription'),
                contactEmail: formData.get('contactEmail'),
                supportPhone: formData.get('supportPhone'),
                updatedAt: serverTimestamp(),
                updatedBy: this.currentUser.uid
            };

            await updateDoc(doc(this.db, 'settings', 'general'), settingsData);
            this.showNotification('General settings updated successfully', 'success');
            
        } catch (error) {
            console.error('General settings error:', error);
            this.showNotification(error.message, 'error');
        }
    }

    async handleSecuritySettings(e) {
        e.preventDefault();
        
        try {
            const formData = new FormData(e.target);
            const securityData = {
                twoFactorRequired: formData.get('twoFactorRequired') === 'on',
                sessionTimeout: parseInt(formData.get('sessionTimeout')),
                maxLoginAttempts: parseInt(formData.get('maxLoginAttempts')),
                passwordMinLength: parseInt(formData.get('passwordMinLength')),
                updatedAt: serverTimestamp(),
                updatedBy: this.currentUser.uid
            };

            await updateDoc(doc(this.db, 'settings', 'security'), securityData);
            this.showNotification('Security settings updated successfully', 'success');
            
        } catch (error) {
            console.error('Security settings error:', error);
            this.showNotification(error.message, 'error');
        }
    }

    async handleNotificationSettings(e) {
        e.preventDefault();
        
        try {
            const formData = new FormData(e.target);
            const notificationData = {
                emailNotifications: formData.get('emailNotifications') === 'on',
                smsNotifications: formData.get('smsNotifications') === 'on',
                pushNotifications: formData.get('pushNotifications') === 'on',
                updatedAt: serverTimestamp(),
                updatedBy: this.currentUser.uid
            };

            await updateDoc(doc(this.db, 'settings', 'notifications'), notificationData);
            this.showNotification('Notification settings updated successfully', 'success');
            
        } catch (error) {
            console.error('Notification settings error:', error);
            this.showNotification(error.message, 'error');
        }
    }

    async handleMaintenanceSettings(e) {
        e.preventDefault();
        
        try {
            const formData = new FormData(e.target);
            const maintenanceData = {
                maintenanceMode: formData.get('maintenanceMode') === 'on',
                maintenanceMessage: formData.get('maintenanceMessage'),
                updatedAt: serverTimestamp(),
                updatedBy: this.currentUser.uid
            };

            await updateDoc(doc(this.db, 'settings', 'maintenance'), maintenanceData);
            this.showNotification('Maintenance settings updated successfully', 'success');
            
        } catch (error) {
            console.error('Maintenance settings error:', error);
            this.showNotification(error.message, 'error');
        }
    }

    // UI Rendering Methods
    renderUsersTable() {
        const tableBody = document.getElementById('usersTableBody');
        if (!tableBody) {
            console.error('Users table body not found');
            return;
        }
        
        // Use filteredUsers if available, otherwise use all users
        const usersToRender = this.filteredUsers.length > 0 ? this.filteredUsers : this.users;
        
        if (usersToRender.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="text-muted">
                            <i class="fas fa-users fa-2x mb-2"></i>
                            <p>No users found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Render all users without pagination
        tableBody.innerHTML = usersToRender.map(user => {
            // Handle different possible field names and provide fallbacks
            const firstName = user.firstName || user.first_name || user.displayName?.split(' ')[0] || 'Unknown';
            const lastName = user.lastName || user.last_name || user.displayName?.split(' ')[1] || 'User';
            const email = user.email || 'No email';
            const role = user.role || 'user';
            const status = user.status || 'active';
            const balance = user.balance || user.accountBalance || 0;
            
            return `
                <tr>
                    <td><input type="checkbox" class="user-checkbox" value="${user.id}"></td>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="assets/images/user-avatar.png" alt="Avatar" class="rounded-circle me-2" width="32" height="32">
                            <div>
                                <div class="fw-semibold">${firstName} ${lastName}</div>
                                <small class="text-muted">${email}</small>
                            </div>
                        </div>
                    </td>
                    <td><span class="badge bg-${role === 'admin' ? 'danger' : 'primary'}">${role}</span></td>
                    <td><span class="badge bg-${status === 'active' ? 'success' : 'secondary'}">${status}</span></td>
                    <td>$${balance.toFixed ? balance.toFixed(2) : parseFloat(balance || 0).toFixed(2)}</td>
                    <td>${user.createdAt ? (user.createdAt.toDate ? new Date(user.createdAt.toDate()).toLocaleDateString() : new Date(user.createdAt).toLocaleDateString()) : 'N/A'}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="adminDashboard.viewUser('${user.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-outline-warning" onclick="adminDashboard.editUser('${user.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-info" onclick="adminDashboard.handlePasswordReset('${user.id}', '${email}')">
                                <i class="fas fa-key"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="adminDashboard.handleDeleteUser('${user.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Hide pagination since we're showing all users
        const pagination = document.getElementById('usersPagination');
        if (pagination) {
            pagination.style.display = 'none';
        }
    }

    renderUsersPagination(totalUsers) {
        const pagination = document.getElementById('usersPagination');
        if (!pagination) return;
        
        const totalPages = Math.ceil(totalUsers / this.usersPerPage);
        
        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `
            <li class="page-item ${this.currentUserPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${this.currentUserPage - 1}">Previous</a>
            </li>
        `;
        
        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `
                <li class="page-item ${i === this.currentUserPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }
        
        // Next button
        paginationHTML += `
            <li class="page-item ${this.currentUserPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${this.currentUserPage + 1}">Next</a>
            </li>
        `;
        
        pagination.innerHTML = paginationHTML;
    }

    renderTransactionsTable() {
        const tbody = document.getElementById('transactionsTableBody');
        if (!tbody) return;
        
        const transactionsToRender = this.filteredTransactions || this.transactions;
        
        if (transactionsToRender.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <i class="fas fa-exchange-alt me-2"></i>No transactions found
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = transactionsToRender.map(transaction => `
            <tr>
                <td>${transaction.id}</td>
                <td>${transaction.userEmail || 'N/A'}</td>
                <td><span class="badge bg-${this.getTransactionTypeColor(transaction.type)}">${transaction.type}</span></td>
                <td>$${transaction.amount?.toFixed(2) || '0.00'}</td>
                <td><span class="badge bg-${this.getTransactionStatusColor(transaction.status)}">${transaction.status}</span></td>
                <td>${transaction.timestamp ? new Date(transaction.timestamp.toDate()).toLocaleString() : 'N/A'}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="adminDashboard.viewTransaction('${transaction.id}')" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-warning" onclick="adminDashboard.openEditTransactionModal('${transaction.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="adminDashboard.deleteTransactionRecord('${transaction.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderTradesTable() {
        const tbody = document.getElementById('tradesTableBody');
        if (!tbody) return;
        
        // Use filtered trades if available, otherwise use all trades
        const tradesToRender = this.filteredTrades || this.trades;
        
        if (tradesToRender.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center py-4">
                        <i class="fas fa-chart-line me-2"></i>${this.filteredTrades ? 'No trades match the current filters' : 'No trades found'}
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = tradesToRender.map(trade => {
            const pnl = trade.pnl ? parseFloat(trade.pnl) : 0;
            const pnlClass = pnl >= 0 ? 'text-success' : 'text-danger';
            const pnlSign = pnl >= 0 ? '+' : '';
            
            return `
                <tr>
                    <td>${trade.id}</td>
                    <td>${trade.userEmail || 'N/A'}</td>
                    <td>${trade.symbol || 'N/A'}</td>
                    <td><span class="badge bg-${trade.type === 'buy' ? 'success' : 'danger'}">${trade.type?.toUpperCase()}</span></td>
                    <td>$${trade.amount?.toFixed(2) || '0.00'}</td>
                    <td>$${trade.entryPrice?.toFixed(5) || '0.00000'}</td>
                    <td>$${trade.currentPrice?.toFixed(5) || trade.entryPrice?.toFixed(5) || '0.00000'}</td>
                    <td class="${pnlClass}">${pnlSign}$${Math.abs(pnl).toFixed(2)}</td>
                    <td><span class="badge bg-${this.getTradeStatusColor(trade.status)}">${trade.status}</span></td>
                    <td>${trade.timestamp ? new Date(trade.timestamp.toDate()).toLocaleString() : 'N/A'}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="adminDashboard.viewTrade('${trade.id}')" title="View">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-outline-warning" onclick="adminDashboard.openEditTradeModal('${trade.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="adminDashboard.deleteTradeRecord('${trade.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderWithdrawalsTable() {
        const tbody = document.getElementById('withdrawalsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = this.withdrawals.map(withdrawal => `
            <tr>
                <td>${withdrawal.id}</td>
                <td>${withdrawal.userEmail || 'N/A'}</td>
                <td>$${withdrawal.amount?.toFixed(2) || '0.00'}</td>
                <td>${withdrawal.walletAddress || 'N/A'}</td>
                <td><span class="badge bg-${this.getWithdrawalStatusColor(withdrawal.status)}">${withdrawal.status}</span></td>
                <td>${withdrawal.timestamp ? new Date(withdrawal.timestamp.toDate()).toLocaleString() : 'N/A'}</td>
                <td>
                    ${withdrawal.status === 'pending' ? `
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-success approve-withdrawal" data-withdrawal-id="${withdrawal.id}">
                                <i class="fas fa-check"></i> Approve
                            </button>
                            <button class="btn btn-danger reject-withdrawal" data-withdrawal-id="${withdrawal.id}">
                                <i class="fas fa-times"></i> Reject
                            </button>
                        </div>
                    ` : `
                        <button class="btn btn-sm btn-outline-primary" onclick="adminDashboard.viewWithdrawal('${withdrawal.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    `}
                </td>
            </tr>
        `).join('');
    }

    // Utility Methods
    getTransactionTypeColor(type) {
        const colors = {
            deposit: 'success',
            withdrawal: 'warning',
            trade: 'info',
            commission: 'secondary'
        };
        return colors[type] || 'primary';
    }

    getTransactionStatusColor(status) {
        const colors = {
            completed: 'success',
            pending: 'warning',
            failed: 'danger',
            cancelled: 'secondary'
        };
        return colors[status] || 'primary';
    }

    getTradeStatusColor(status) {
        const colors = {
            active: 'primary',
            completed: 'success',
            cancelled: 'secondary',
            failed: 'danger'
        };
        return colors[status] || 'primary';
    }

    getWithdrawalStatusColor(status) {
        const colors = {
            pending: 'warning',
            approved: 'success',
            rejected: 'danger',
            completed: 'info'
        };
        return colors[status] || 'primary';
    }

    updateDashboardStats() {
        // Update user stats
        const totalUsers = this.users.length;
        const activeUsers = this.users.filter(user => user.status === 'active').length;
        const newUsersToday = this.users.filter(user => {
            if (!user.createdAt) return false;
            const today = new Date();
            const userDate = user.createdAt.toDate();
            return userDate.toDateString() === today.toDateString();
        }).length;

        document.getElementById('totalUsers').textContent = totalUsers;
        document.getElementById('activeUsers').textContent = activeUsers;
        document.getElementById('newUsersToday').textContent = newUsersToday;

        // Update trading stats
        const activeTrades = this.trades.filter(trade => trade.status === 'active').length;
        const totalVolume = this.trades.reduce((sum, trade) => sum + (trade.amount || 0), 0);
        const successRate = this.trades.length > 0 ? 
            (this.trades.filter(trade => trade.status === 'completed').length / this.trades.length * 100).toFixed(1) : 0;

        document.getElementById('activeTrades').textContent = activeTrades;
        document.getElementById('totalVolume').textContent = `$${totalVolume.toFixed(2)}`;
        document.getElementById('successRate').textContent = `${successRate}%`;

        // Update withdrawal stats
        const pendingWithdrawals = this.withdrawals.filter(w => w.status === 'pending').length;
        document.getElementById('pendingWithdrawals').textContent = pendingWithdrawals;
    }

    updateUserStats() {
        const userStats = document.getElementById('userStats');
        if (!userStats) return;
        
        const totalUsers = this.users.length;
        const activeUsers = this.users.filter(user => user.status === 'active').length;
        const adminUsers = this.users.filter(user => user.role === 'admin').length;
        
        userStats.innerHTML = `
            <div class="col-md-4">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title">${totalUsers}</h5>
                        <p class="card-text">Total Users</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title">${activeUsers}</h5>
                        <p class="card-text">Active Users</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title">${adminUsers}</h5>
                        <p class="card-text">Admin Users</p>
                    </div>
                </div>
            </div>
        `;
    }

    updateTradingStats() {
        const activeTrades = this.trades.filter(trade => trade.status === 'active').length;
        const dailyVolume = this.trades
            .filter(trade => {
                if (!trade.timestamp) return false;
                const today = new Date();
                const tradeDate = trade.timestamp.toDate();
                return tradeDate.toDateString() === today.toDateString();
            })
            .reduce((sum, trade) => sum + (trade.amount || 0), 0);
        
        const successfulTrades = this.trades.filter(trade => trade.status === 'completed').length;
        const successRate = this.trades.length > 0 ? (successfulTrades / this.trades.length * 100).toFixed(1) : 0;
        const totalCommission = this.trades.reduce((sum, trade) => sum + (trade.commission || 0), 0);

        document.getElementById('activeTradesCount').textContent = activeTrades;
        document.getElementById('dailyVolumeAmount').textContent = `$${dailyVolume.toFixed(2)}`;
        document.getElementById('successRatePercent').textContent = `${successRate}%`;
        document.getElementById('totalCommissionAmount').textContent = `$${totalCommission.toFixed(2)}`;
    }

    updateWithdrawalNotifications(count) {
        const badge = document.getElementById('withdrawalNotificationBadge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline' : 'none';
        }
    }

    updateAdminInfo(adminData) {
        const adminName = document.getElementById('adminName');
        const adminEmail = document.getElementById('adminEmail');
        
        if (adminName) {
            // Handle cases where firstName/lastName might be undefined
            const firstName = adminData.firstName || '';
            const lastName = adminData.lastName || '';
            const displayName = firstName && lastName ? `${firstName} ${lastName}` : 
                               firstName || lastName || adminData.email?.split('@')[0] || 'Admin';
            adminName.textContent = displayName;
        }
        
        if (adminEmail) {
            adminEmail.textContent = adminData.email || 'No email';
        }
    }

    populateSettingsForms() {
        // Populate forms with current settings
        if (this.siteSettings) {
            Object.keys(this.siteSettings).forEach(key => {
                const input = document.querySelector(`[name="${key}"]`);
                if (input) {
                    if (input.type === 'checkbox') {
                        input.checked = this.siteSettings[key];
                    } else {
                        input.value = this.siteSettings[key];
                    }
                }
            });
        }
    }

    initializeCharts() {
        // Destroy all existing charts first with better error handling
        Object.keys(this.chartInstances).forEach(key => {
            if (this.chartInstances[key]) {
                try {
                    this.chartInstances[key].destroy();
                } catch (error) {
                    console.warn(`Error destroying chart instance ${key}:`, error);
                }
                this.chartInstances[key] = null;
            }
        });
        
        // Also destroy any charts that might exist by canvas ID with better error handling
        const chartCanvasIds = ['tradingVolumeChart', 'userGrowthChart', 'revenueChart', 'userActivityChart'];
        chartCanvasIds.forEach(canvasId => {
            try {
                const existingChart = Chart.getChart(canvasId);
                if (existingChart) {
                    existingChart.destroy();
                }
            } catch (error) {
                console.warn(`Error destroying chart with canvas ID ${canvasId}:`, error);
            }
        });
        
        // Add small delay to ensure cleanup is complete
        setTimeout(() => {
            // Initialize all charts
            this.initializeTradingVolumeChart();
            this.initializeUserGrowthChart();
            this.initializeRevenueChart();
            this.initializeUserActivityChart();
        }, 100);
    }

    async initializeTradingVolumeChart() {
        // Destroy existing chart instance if it exists (enhanced cleanup)
        try {
            const existingChart = Chart.getChart('tradingVolumeChart');
            if (existingChart) {
                existingChart.destroy();
            }
        } catch (error) {
            console.warn('Error destroying existing trading volume chart:', error);
        }
        
        // Also destroy from local chartInstances if it exists
        if (this.chartInstances.tradingVolume) {
            this.chartInstances.tradingVolume.destroy();
            this.chartInstances.tradingVolume = null;
        }
        
        const canvas = document.getElementById('tradingVolumeChart');
        if (!canvas) {
            console.error('Canvas element with ID "tradingVolumeChart" not found.');
            return;
        }
        
        try {
            const data = await this.getTradingVolumeData();
            this.chartInstances.tradingVolume = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: 'Trading Volume',
                        data: data.values,
                        borderColor: 'rgba(59, 130, 246, 1)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
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
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#8b9dc3'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#8b9dc3'
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error initializing trading volume chart:', error);
            this.showEmptyChart(canvas, 'Error loading trading volume data.');
        }
    }

    async initializeUserGrowthChart() {
        // Destroy existing chart instance if it exists (enhanced cleanup)
        const existingChart = Chart.getChart('userGrowthChart');
        if (existingChart) {
            existingChart.destroy();
        }
        
        // Also destroy from local chartInstances if it exists
        if (this.chartInstances.userGrowth) {
            this.chartInstances.userGrowth.destroy();
            this.chartInstances.userGrowth = null;
        }
        
        const ctx = document.getElementById('userGrowthChart');
        if (!ctx) {
            console.error('Canvas element with ID "userGrowthChart" not found.');
            return;
        }
        try {
            const data = await this.getUserGrowthData();
            this.chartInstances.userGrowth = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: 'User Growth',
                        data: data.values,
                        borderColor: 'rgba(153, 102, 255, 1)',
                        backgroundColor: 'rgba(153, 102, 255, 0.2)',
                        fill: true,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            beginAtZero: true,
                        },
                        y: {
                            beginAtZero: true,
                        },
                    },
                },
            });
        } catch (error) {
            console.error('Error initializing user growth chart:', error);
            this.showEmptyChart(ctx, 'Error loading user growth data.');
        }
    }

    async initializeRevenueChart() {
        // Destroy existing chart instance if it exists (enhanced cleanup)
        const existingChart = Chart.getChart('revenueChart');
        if (existingChart) {
            existingChart.destroy();
        }
        
        // Also destroy from local chartInstances if it exists
        if (this.chartInstances.revenue) {
            this.chartInstances.revenue.destroy();
            this.chartInstances.revenue = null;
        }
        
        const ctx = document.getElementById('revenueChart');
        if (!ctx) {
            console.error('Canvas element with ID "revenueChart" not found.');
            return;
        }
        
        try {
            const data = await this.getRevenueData();
            this.chartInstances.revenue = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: 'Revenue',
                        data: data.values,
                        backgroundColor: 'rgba(255, 159, 64, 0.7)',
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            beginAtZero: true,
                        },
                        y: {
                            beginAtZero: true,
                        },
                    },
                },
            });
        } catch (error) {
            console.error('Error initializing revenue chart:', error);
            this.showEmptyChart(ctx, 'Error loading revenue data.');
        }
    }

    async initializeUserActivityChart() {
        // Destroy existing chart instance if it exists (enhanced cleanup)
        try {
            const existingChart = Chart.getChart('userActivityChart');
            if (existingChart) {
                existingChart.destroy();
            }
        } catch (error) {
            console.warn('Error destroying existing user activity chart:', error);
        }
        
        // Also destroy from local chartInstances if it exists
        if (this.chartInstances.userActivity) {
            this.chartInstances.userActivity.destroy();
            this.chartInstances.userActivity = null;
        }
        
        const ctx = document.getElementById('userActivityChart');
        if (!ctx) {
            console.error('Canvas element with ID "userActivityChart" not found.');
            return;
        }
        try {
            const data = await this.getUserActivityData();
            this.chartInstances.userActivity = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: 'User Activity',
                        data: data.values,
                        backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            beginAtZero: true,
                        },
                        y: {
                            beginAtZero: true,
                        },
                    },
                },
            });
        } catch (error) {
            console.error('Error initializing user activity chart:', error);
            this.showEmptyChart(ctx, 'Error loading user activity data.');
        }
    }

    // Data fetching methods for charts
    async getTradingVolumeData() {
        try {
            // Get trades from last 6 months
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            
            const tradesQuery = query(
                collection(this.db, 'trades'),
                where('timestamp', '>=', sixMonthsAgo),
                orderBy('timestamp', 'desc')
            );
            
            const snapshot = await getDocs(tradesQuery);
            const trades = snapshot.docs.map(doc => doc.data());
            
            // Group trades by month and calculate volume
            const monthlyVolume = {};
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            trades.forEach(trade => {
                const date = new Date(trade.timestamp.toDate ? trade.timestamp.toDate() : trade.timestamp);
                const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                
                if (!monthlyVolume[monthKey]) {
                    monthlyVolume[monthKey] = 0;
                }
                
                // Add trade volume (amount * price or just amount)
                const volume = trade.amount * (trade.price || 1);
                monthlyVolume[monthKey] += volume;
            });
            
            // Convert to chart format
            const labels = Object.keys(monthlyVolume).slice(-6); // Last 6 months
            const values = labels.map(label => monthlyVolume[label] || 0);
            
            return { labels, values };
            
        } catch (error) {
            console.error('Error fetching trading volume data:', error);
            // Return empty data if no trades found
            return {
                labels: ['No Data'],
                values: [0]
            };
        }
    }

    async getUserGrowthData() {
        try {
            // Get user registrations from last 6 months
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            
            const usersQuery = query(
                collection(this.db, 'users'),
                where('createdAt', '>=', sixMonthsAgo),
                orderBy('createdAt', 'desc')
            );
            
            const snapshot = await getDocs(usersQuery);
            const users = snapshot.docs.map(doc => doc.data());
            
            // Group users by month
            const monthlyGrowth = {};
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            users.forEach(user => {
                const date = new Date(user.createdAt.toDate ? user.createdAt.toDate() : user.createdAt);
                const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                
                if (!monthlyGrowth[monthKey]) {
                    monthlyGrowth[monthKey] = 0;
                }
                monthlyGrowth[monthKey]++;
            });
            
            // Convert to chart format
            const labels = Object.keys(monthlyGrowth).slice(-6); // Last 6 months
            const values = labels.map(label => monthlyGrowth[label] || 0);
            
            return { labels, values };
            
        } catch (error) {
            console.error('Error fetching user growth data:', error);
            return {
                labels: ['No Data'],
                values: [0]
            };
        }
    }

    async getRevenueData() {
        try {
            // Get transactions for revenue calculation
            const transactionsQuery = query(
                collection(this.db, 'transactions'),
                where('type', 'in', ['trading_fee', 'withdrawal_fee', 'premium_plan']),
                orderBy('timestamp', 'desc'),
                limit(1000)
            );
            
            const snapshot = await getDocs(transactionsQuery);
            const transactions = snapshot.docs.map(doc => doc.data());
            
            // Calculate revenue by type
            const revenueByType = {
                'Trading Fees': 0,
                'Withdrawal Fees': 0,
                'Premium Plans': 0
            };
            
            transactions.forEach(transaction => {
                const amount = Math.abs(transaction.amount || 0);
                
                switch (transaction.type) {
                    case 'trading_fee':
                        revenueByType['Trading Fees'] += amount;
                        break;
                    case 'withdrawal_fee':
                        revenueByType['Withdrawal Fees'] += amount;
                        break;
                    case 'premium_plan':
                        revenueByType['Premium Plans'] += amount;
                        break;
                }
            });
            
            return {
                labels: Object.keys(revenueByType),
                values: Object.values(revenueByType)
            };
            
        } catch (error) {
            console.error('Error fetching revenue data:', error);
            return {
                labels: ['No Data'],
                values: [0]
            };
        }
    }

    async getUserActivityData() {
        try {
            // Get user login/activity data for today
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
            
            // Query user sessions or login events
            const activityQuery = query(
                collection(this.db, 'user_sessions'),
                where('timestamp', '>=', startOfDay),
                where('timestamp', '<', endOfDay),
                orderBy('timestamp', 'desc')
            );
            
            const snapshot = await getDocs(activityQuery);
            const sessions = snapshot.docs.map(doc => doc.data());
            
            // Group by hour
            const hourlyActivity = {};
            for (let i = 0; i < 24; i += 4) {
                const hourLabel = `${i.toString().padStart(2, '0')}:00`;
                hourlyActivity[hourLabel] = 0;
            }
            
            sessions.forEach(session => {
                const date = new Date(session.timestamp.toDate ? session.timestamp.toDate() : session.timestamp);
                const hour = Math.floor(date.getHours() / 4) * 4;
                const hourLabel = `${hour.toString().padStart(2, '0')}:00`;
                
                if (hourlyActivity[hourLabel] !== undefined) {
                    hourlyActivity[hourLabel]++;
                }
            });
            
            return {
                labels: Object.keys(hourlyActivity),
                values: Object.values(hourlyActivity)
            };
            
        } catch (error) {
            console.error('Error fetching user activity data:', error);
            // Return default time labels with zero values
            return {
                labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
                values: [0, 0, 0, 0, 0, 0]
            };
        }
    }

    showEmptyChart(ctx, message) {
        // Destroy existing chart instance if it exists
        const canvasId = ctx.id;
        const existingChart = Chart.getChart(canvasId);
        if (existingChart) {
            existingChart.destroy();
        }
        
        // Create a simple chart showing no data message
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['No Data'],
                datasets: [{
                    label: message,
                    data: [0],
                    backgroundColor: 'rgba(128, 128, 128, 0.2)',
                    borderColor: 'rgba(128, 128, 128, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: message
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1
                    }
                }
            }
        });
    }

    // Navigation Methods
    navigateToPage(page) {
        console.log('Navigating to page:', page); // Debug log
        
        // Hide all sections
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show selected section
        const targetSection = document.getElementById(page);
        console.log('Target section found:', targetSection); // Debug log
        
        if (targetSection) {
            targetSection.classList.add('active');
            console.log('Added active class to section:', page); // Debug log
        } else {
            console.error('Section not found:', page); // Error log
        }
        
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNavItem = document.querySelector(`[data-section="${page}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }
        
        this.currentPage = page;
        
        // Load page-specific data
        this.loadPageData(page);
        
        // Load section-specific content
        switch(page) {
            case 'dashboard':
                this.loadDashboardData();
                this.updateDashboardStats();
                break;
            case 'users':
                console.log('Loading users section...'); // Debug log
                this.loadUsersSection();
                this.updateUserStats();
                break;
            case 'withdrawals':
                this.loadGlobalCotCode();
                break;
            case 'financial':
                this.loadFinancialData();
                break;
            case 'funding':
                this.loadFundingData();
                break;
            case 'user-financial':
                this.loadUserFinancialSection();
                break;
            case 'user-control':
                this.loadUserControlSection();
                break;
            default:
                console.warn('Unknown page:', page); // Warning log
        }
    }
    
    // Add showSection method for backward compatibility
    showSection(sectionId) {
        this.navigateToPage(sectionId);
    }

    async loadPageData(page) {
        switch (page) {
            case 'users':
                await this.loadUsers();
                break;
            case 'trading':
                await this.loadTrades();
                break;
            case 'transactions':
                await this.loadTransactions();
                break;
            case 'withdrawals':
                await this.loadWithdrawals();
                break;
            case 'settings':
                await this.loadSiteSettings();
                break;
        }
    }

    toggleMobileMenu() {
        console.log('Toggle mobile menu called'); // Debug log
        
        const sidebar = document.getElementById('adminSidebar');
        const overlay = document.getElementById('mobileOverlay');
        const toggleBtn = document.getElementById('sidebarToggle');
        
        console.log('Sidebar found:', !!sidebar);
        console.log('Overlay found:', !!overlay);
        
        if (sidebar) {
            const isOpen = sidebar.classList.contains('mobile-open');
            sidebar.classList.toggle('mobile-open');
            
            // Update toggle button icon
            if (toggleBtn) {
                const icon = toggleBtn.querySelector('i');
                if (icon) {
                    icon.className = isOpen ? 'fas fa-bars' : 'fas fa-times';
                }
            }
        } else {
            console.error('Admin sidebar not found!');
        }
        
        if (overlay) {
            overlay.classList.toggle('active');
            
            // Add click handler to close menu when clicking overlay
            if (overlay.classList.contains('active')) {
                overlay.onclick = () => {
                    this.toggleMobileMenu();
                };
            }
        } else {
            console.error('Mobile overlay not found!');
        }
    }

    // Modal Methods
    openModal(modalId) {
        const modal = new bootstrap.Modal(document.getElementById(modalId));
        modal.show();
    }

    closeModal(modalId) {
        const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
        if (modal) {
            modal.hide();
        }
    }

    // User Detail Methods
    async viewUser(userId) {
        try {
            const userDoc = await getDoc(doc(this.db, 'users', userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                this.populateUserDetailsModal(userData);
                this.openModal('userDetailsModal');
            }
        } catch (error) {
            console.error('View user error:', error);
            this.showNotification('Failed to load user details', 'error');
        }
    }

    async editUser(userId) {
        try {
            const userDoc = await getDoc(doc(this.db, 'users', userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                this.populateEditUserModal(userData, userId);
                this.openModal('editUserModal');
            }
        } catch (error) {
            console.error('Edit user error:', error);
            this.showNotification('Failed to load user for editing', 'error');
        }
    }

    populateUserDetailsModal(userData) {
        const elements = {
            'userDetailName': `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'N/A',
            'userDetailEmail': userData.email || 'N/A',
            'userDetailRole': userData.role || 'N/A',
            'userDetailStatus': userData.status || 'N/A',
            'userDetailBalance': `$${userData.balance?.toFixed(2) || '0.00'}`,
            'userDetailCreated': userData.createdAt ? 
                new Date(userData.createdAt.toDate()).toLocaleString() : 'N/A',
            'currentBalance': `$${userData.balance?.toFixed(2) || '0.00'}`,
            'totalDeposits': `$${userData.totalDeposits?.toFixed(2) || '0.00'}`,
            'totalWithdrawals': `$${userData.totalWithdrawals?.toFixed(2) || '0.00'}`
        };
        
        Object.keys(elements).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = elements[id];
            }
        });
        
        // Store current user ID for balance adjustment
        this.currentViewingUserId = userData.uid || userData.id;
        
        // Setup balance adjustment event listeners
        this.setupBalanceAdjustmentEvents();
    }

    setupBalanceAdjustmentEvents() {
        const addFundsBtn = document.getElementById('addFundsBtn');
        const subtractFundsBtn = document.getElementById('subtractFundsBtn');
        
        if (addFundsBtn) {
            addFundsBtn.onclick = () => this.adjustUserBalance('add');
        }
        
        if (subtractFundsBtn) {
            subtractFundsBtn.onclick = () => this.adjustUserBalance('subtract');
        }
    }

    async adjustUserBalance(action) {
        const amountInput = document.getElementById('balanceAdjustAmount');
        const reasonInput = document.getElementById('balanceAdjustReason');
        
        if (!amountInput || !reasonInput) {
            this.showNotification('Error: Input fields not found', 'error');
            return;
        }
        
        const amount = parseFloat(amountInput.value);
        const reason = reasonInput.value.trim();
        
        if (!amount || amount <= 0) {
            this.showNotification('Please enter a valid amount', 'error');
            return;
        }
        
        if (!reason) {
            this.showNotification('Please enter a reason for the adjustment', 'error');
            return;
        }
        
        if (!this.selectedUserId) {
            this.showNotification('Please select a user first', 'error');
            return;
        }
        
        try {
            // Calculate the adjustment amount (negative for subtract)
            const adjustmentAmount = action === 'add' ? amount : -amount;
            
            // Update user balance using correct v9 syntax - UPDATE BOTH FIELDS
            const userRef = doc(this.db, 'users', this.selectedUserId);
            await updateDoc(userRef, {
                balance: increment(adjustmentAmount),
                accountBalance: increment(adjustmentAmount), // ADD THIS LINE
                updatedAt: serverTimestamp(),
                balanceUpdatedAt: serverTimestamp()
            });
            
            // Also update the accounts collection for dashboard sync
            const accountRef = doc(this.db, 'accounts', this.selectedUserId);
            const accountDoc = await getDoc(accountRef);
            
            if (accountDoc.exists()) {
                await updateDoc(accountRef, {
                    balance: increment(adjustmentAmount),
                    updatedAt: serverTimestamp()
                });
            } else {
                // Create account document if it doesn't exist
                const userDoc = await getDoc(userRef);
                const userData = userDoc.data();
                await setDoc(accountRef, {
                    balance: (userData.balance || 0),
                    totalProfits: userData.totalProfits || 0,
                    totalDeposits: userData.totalDeposits || 0,
                    currency: 'USD',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }
            
            // Create transaction record with 'uid' field for user history
            await addDoc(collection(this.db, 'transactions'), {
                uid: this.selectedUserId,
                userEmail: this.selectedUserEmail,
                type: action === 'add' ? 'deposit' : 'withdrawal',
                amount: amount,
                status: 'completed',
                description: `Manual balance adjustment: ${reason}`,
                reason: reason,
                timestamp: serverTimestamp(),
                createdAt: serverTimestamp(),
                adminId: this.currentUser?.uid || 'admin',
                method: 'admin_adjustment'
            });
            
            this.showNotification(`Balance ${action === 'add' ? 'increased' : 'decreased'} by $${amount.toFixed(2)}`, 'success');
            
            // Clear the input fields
            amountInput.value = '';
            reasonInput.value = '';
            
            // Refresh the user financial data
            await this.loadUserFinancialSection();
            
        } catch (error) {
            console.error('Error adjusting balance:', error);
            this.showNotification('Failed to adjust balance', 'error');
        }
    }

    async refreshUserDetails(userId) {
        try {
            const userDoc = await getDoc(doc(this.db, 'users', userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                // Update the balance display in the modal
                const currentBalanceElement = document.getElementById('currentBalance');
                const userDetailBalanceElement = document.getElementById('userDetailBalance');
                
                if (currentBalanceElement) {
                    currentBalanceElement.textContent = `$${userData.balance?.toFixed(2) || '0.00'}`;
                }
                if (userDetailBalanceElement) {
                    userDetailBalanceElement.textContent = `$${userData.balance?.toFixed(2) || '0.00'}`;
                }
            }
        } catch (error) {
            console.error('Error refreshing user details:', error);
        }
    }

    populateEditUserModal(userData, userId) {
        const elements = {
            'editUserId': userId,
            'editUserFirstName': userData.firstName || '',
            'editUserLastName': userData.lastName || '',
            'editUserEmail': userData.email || '',
            'editUserRole': userData.role || 'user',
            'editUserStatus': userData.status || 'active',
            'editUserBalance': userData.balance || 0
        };
        
        Object.keys(elements).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.value = elements[id];
            }
        });
    }

    // Transaction and Trade Detail Methods
    async viewTransaction(transactionId) {
        try {
            const transactionDoc = await getDoc(doc(this.db, 'transactions', transactionId));
            if (transactionDoc.exists()) {
                const transactionData = transactionDoc.data();
                // Implement transaction details modal
                console.log('Transaction details:', transactionData);
            }
        } catch (error) {
            console.error('View transaction error:', error);
            this.showNotification('Failed to load transaction details', 'error');
        }
    }

    async viewTrade(tradeId) {
        try {
            const tradeDoc = await getDoc(doc(this.db, 'trades', tradeId));
            if (tradeDoc.exists()) {
                const tradeData = tradeDoc.data();
                // Populate trade details modal
                const modalBody = document.getElementById('tradeDetailsModalBody');
                if (modalBody) {
                    const pnl = tradeData.pnl ? parseFloat(tradeData.pnl) : 0;
                    const pnlClass = pnl >= 0 ? 'text-success' : 'text-danger';
                    const pnlSign = pnl >= 0 ? '+' : '';
                    
                    modalBody.innerHTML = `
                        <div class="row">
                            <div class="col-md-6">
                                <p><strong>User:</strong> ${tradeData.userEmail || 'N/A'}</p>
                                <p><strong>Symbol:</strong> ${tradeData.symbol || 'N/A'}</p>
                                <p><strong>Type:</strong> <span class="badge bg-${tradeData.type === 'buy' ? 'success' : 'danger'}">${tradeData.type?.toUpperCase() || 'N/A'}</span></p>
                                <p><strong>Amount:</strong> $${tradeData.amount?.toFixed(2) || '0.00'}</p>
                                <p><strong>Leverage:</strong> ${tradeData.leverage || '1'}x</p>
                            </div>
                            <div class="col-md-6">
                                <p><strong>Entry Price:</strong> $${tradeData.entryPrice?.toFixed(5) || '0.00000'}</p>
                                <p><strong>Current Price:</strong> $${tradeData.currentPrice?.toFixed(5) || '0.00000'}</p>
                                <p><strong>P&L:</strong> <span class="${pnlClass}">${pnlSign}$${Math.abs(pnl).toFixed(2)}</span></p>
                                <p><strong>Status:</strong> <span class="badge bg-${this.getTradeStatusColor(tradeData.status)}">${tradeData.status || 'N/A'}</span></p>
                                <p><strong>Date:</strong> ${tradeData.timestamp ? new Date(tradeData.timestamp.toDate()).toLocaleString() : 'N/A'}</p>
                            </div>
                        </div>
                        <div class="row mt-3">
                            <div class="col-12">
                                <p><strong>Stop Loss:</strong> ${tradeData.stopLoss ? '$' + tradeData.stopLoss.toFixed(5) : 'Not set'}</p>
                                <p><strong>Take Profit:</strong> ${tradeData.takeProfit ? '$' + tradeData.takeProfit.toFixed(5) : 'Not set'}</p>
                                <p><strong>Notes:</strong> ${tradeData.notes || 'No notes'}</p>
                            </div>
                        </div>
                    `;
                }
                this.openModal('tradeDetailsModal');
            }
        } catch (error) {
            console.error('View trade error:', error);
            this.showNotification('Failed to load trade details', 'error');
        }
    }

    async viewWithdrawal(withdrawalId) {
        try {
            const withdrawalDoc = await getDoc(doc(this.db, 'withdrawals', withdrawalId));
            if (withdrawalDoc.exists()) {
                const withdrawalData = withdrawalDoc.data();
                // Implement withdrawal details modal
                console.log('Withdrawal details:', withdrawalData);
            }
        } catch (error) {
            console.error('View withdrawal error:', error);
            this.showNotification('Failed to load withdrawal details', 'error');
        }
    }

    // Utility Methods
    showLoading(show) {
        const loader = document.getElementById('loadingSpinner');
        if (loader) {
            loader.style.display = show ? 'block' : 'none';
        }
    }

    showNotification(message, type = 'info') {
        const toast = document.getElementById('notificationToast');
        const toastBody = document.getElementById('toastBody');
        
        if (toast && toastBody) {
            toastBody.textContent = message;
            toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0`;
            
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
        } else {
            // Fallback to alert if toast is not available
            alert(message);
        }
    }

    async handleLogout() {
        try {
            await signOut(this.auth);
            this.redirectToLogin();
        } catch (error) {
            console.error('Logout error:', error);
            this.showNotification('Failed to logout', 'error');
        }
    }

    redirectToLogin() {
        window.location.href = 'auth.html';
    }

    filterTransactions() {
        const typeFilter = document.getElementById('transactionTypeFilter').value;
        const statusFilter = document.getElementById('transactionStatusFilter').value;
        const dateFilter = document.getElementById('transactionDateFilter').value;
        
        this.filteredTransactions = this.transactions.filter(transaction => {
            const typeMatch = !typeFilter || transaction.type === typeFilter;
            const statusMatch = !statusFilter || transaction.status === statusFilter;
            
            let dateMatch = true;
            if (dateFilter && transaction.timestamp) {
                const transactionDate = transaction.timestamp.toDate();
                const filterDate = new Date(dateFilter);
                dateMatch = transactionDate.toDateString() === filterDate.toDateString();
            }
            
            return typeMatch && statusMatch && dateMatch;
        });
        
        this.renderTransactionsTable();
    }
}

// Declare adminDashboard variable in global scope
let adminDashboard;

// Initialize admin dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing admin dashboard...');
    adminDashboard = new EnhancedAdminDashboard();
    window.adminDashboard = adminDashboard;
    
    // Initialize the dashboard after creating the instance
    adminDashboard.init();
    
    // Set up global exports after initialization
    setupGlobalExports();
});

// Function to set up global exports
function setupGlobalExports() {
    // Global exports for external access
    window.showSection = (sectionId) => adminDashboard.showSection(sectionId);
    window.viewUser = (userId) => adminDashboard.viewUser(userId);
    window.editUser = (userId) => adminDashboard.editUser(userId);
    window.deleteUser = (userId) => adminDashboard.handleDeleteUser(userId);
    window.filterUsers = () => adminDashboard.filterUsers();
    window.clearUserFilters = () => {
        document.getElementById('userSearchInput').value = '';
        document.getElementById('userStatusFilter').value = 'all';
        document.getElementById('userRoleFilter').value = 'all';
        adminDashboard.filteredUsers = adminDashboard.users;
        adminDashboard.renderUsersTable();
    };
    window.viewTrade = (tradeId) => adminDashboard.viewTrade(tradeId);
    window.openEditTradeModal = (tradeId) => adminDashboard.openEditTradeModal(tradeId);
    window.deleteTradeRecord = (tradeId) => adminDashboard.deleteTradeRecord(tradeId);
    window.clearTradeFilters = () => adminDashboard.clearTradeFilters();
    window.openEditTransactionModal = (transactionId) => adminDashboard.openEditTransactionModal(transactionId);
    window.deleteTransactionRecord = (transactionId) => adminDashboard.deleteTransactionRecord(transactionId);
}

// Export for module usage
// Add the missing openAdminProfile function
window.openAdminProfile = function() {
    // You can implement admin profile functionality here
    console.log('Opening admin profile...');
    // For now, just show a notification
    if (window.adminDashboard) {
        window.adminDashboard.showNotification('Admin profile feature coming soon!', 'info');
    }
};

// Add method to select user for financial management
EnhancedAdminDashboard.prototype.selectUserForFinancialManagement = function(userId, userEmail, displayName, balance, totalDeposits, totalWithdrawals) {
    // Store the selected user information
    this.selectedUserId = userId;
    this.selectedUserEmail = userEmail;
    
    // Update the financial management panel
    document.getElementById('selectedUserName').textContent = `${displayName} (${userEmail})`;
    document.getElementById('currentUserBalance').textContent = `$${balance.toFixed(2)}`;
    document.getElementById('currentUserDeposits').textContent = `$${totalDeposits.toFixed(2)}`;
    document.getElementById('currentUserWithdrawals').textContent = `$${totalWithdrawals.toFixed(2)}`;
    
    // Show the financial management panel
    document.getElementById('financialManagementPanel').style.display = 'block';
    
    // Scroll to the panel
    document.getElementById('financialManagementPanel').scrollIntoView({ behavior: 'smooth' });
};

EnhancedAdminDashboard.prototype.addUserProfit = async function() {
    const amountInput = document.getElementById('profitAmount');
    const descriptionInput = document.getElementById('profitDescription');
    
    if (!amountInput || !descriptionInput) {
        this.showNotification('Error: Input fields not found', 'error');
        return;
    }
    
    const amount = parseFloat(amountInput.value);
    const description = descriptionInput.value.trim() || 'Received profit';
    
    if (!amount || amount <= 0) {
        this.showNotification('Please enter a valid profit amount', 'error');
        return;
    }
    
    if (!this.selectedUserId) {
        this.showNotification('Please select a user first', 'error');
        return;
    }
    
    try {
        // Update user balance and profit tracking
        const userRef = doc(this.db, 'users', this.selectedUserId);
        await updateDoc(userRef, {
            balance: increment(amount),
            totalProfits: increment(amount),
            updatedAt: serverTimestamp(),
            balanceUpdatedAt: serverTimestamp()
        });
        
        // Create transaction record
        await addDoc(collection(this.db, 'transactions'), {
            uid: this.selectedUserId,
            userEmail: this.selectedUserEmail,
            type: 'profit',
            amount: amount,
            status: 'completed',
            description: description,
            timestamp: serverTimestamp(),
            createdAt: serverTimestamp(),
            adminId: this.currentUser?.uid || 'admin',
            method: 'admin_profit_addition'
        });
        
        this.showNotification(`Profit of $${amount.toFixed(2)} added successfully`, 'success');
        
        // Clear the input fields
        amountInput.value = '';
        descriptionInput.value = '';
        
        // Refresh the user financial data
        await this.loadUserFinancialSection();
        
    } catch (error) {
        console.error('Error adding profit:', error);
        this.showNotification('Failed to add profit', 'error');
    }
};

EnhancedAdminDashboard.prototype.setExactBalance = async function() {
    const amountInput = document.getElementById('exactBalanceAmount');
    const reasonInput = document.getElementById('exactBalanceReason');
    
    if (!amountInput || !reasonInput) {
        this.showNotification('Error: Input fields not found', 'error');
        return;
    }
    
    const newBalance = parseFloat(amountInput.value);
    const reason = reasonInput.value.trim();
    
    if (newBalance < 0) {
        this.showNotification('Balance cannot be negative', 'error');
        return;
    }
    
    if (!reason) {
        this.showNotification('Please enter a reason for setting exact balance', 'error');
        return;
    }
    
    if (!this.selectedUserId) {
        this.showNotification('Please select a user first', 'error');
        return;
    }
    
    try {
        // Update user balance to exact amount
        const userRef = doc(this.db, 'users', this.selectedUserId);
        await updateDoc(userRef, {
            balance: newBalance,
            updatedAt: serverTimestamp(),
            balanceUpdatedAt: serverTimestamp()
        });
        
        // Create transaction record
        await addDoc(collection(this.db, 'transactions'), {
            uid: this.selectedUserId,
            userEmail: this.selectedUserEmail,
            type: 'balance_adjustment',
            amount: newBalance,
            status: 'completed',
            description: `Balance set to exact amount: ${reason}`,
            reason: reason,
            timestamp: serverTimestamp(),
            createdAt: serverTimestamp(),
            adminId: this.currentUser?.uid || 'admin',
            method: 'admin_exact_balance'
        });
        
        this.showNotification(`Balance set to $${newBalance.toFixed(2)}`, 'success');
        
        // Clear the input fields
        amountInput.value = '';
        reasonInput.value = '';
        
        // Refresh the user financial data
        await this.loadUserFinancialSection();
        
    } catch (error) {
        console.error('Error setting exact balance:', error);
        this.showNotification('Failed to set exact balance', 'error');
    }
};

// Add method to clear trade filters
EnhancedAdminDashboard.prototype.clearTradeFilters = function() {
    // Clear all filter inputs
    const searchInput = document.getElementById('tradeSearchInput');
    const statusFilter = document.getElementById('tradeStatusFilter');
    const typeFilter = document.getElementById('tradeTypeFilter');
    const dateFilter = document.getElementById('tradeDateFilter');
    
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = '';
    if (typeFilter) typeFilter.value = '';
    if (dateFilter) dateFilter.value = '';
    
    // Clear filtered trades to show all trades
    this.filteredTrades = null;
    
    // Re-render the table with all trades
    this.renderTradesTable();
};

// Add method to clear trade filters
EnhancedAdminDashboard.prototype.clearTradeFilters = function() {
    // Clear all filter inputs
    const searchInput = document.getElementById('tradeSearchInput');
    const statusFilter = document.getElementById('tradeStatusFilter');
    const typeFilter = document.getElementById('tradeTypeFilter');
    const dateFilter = document.getElementById('tradeDateFilter');
    
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = '';
    if (typeFilter) typeFilter.value = '';
    if (dateFilter) dateFilter.value = '';
    
    // Clear filtered trades to show all trades
    this.filteredTrades = null;
    
    // Re-render the table with all trades
    this.renderTradesTable();
};

// Trading History CRUD Methods
EnhancedAdminDashboard.prototype.openAddTradeModal = function() {
    // Clear form
    document.getElementById('addEditTradeForm').reset();
    document.getElementById('tradeId').value = '';
    document.getElementById('addEditTradeModalLabel').textContent = 'Add New Trade';
    
    // Set current date/time for new trades
    const now = new Date();
    const currentDateTime = now.toISOString().slice(0, 16);
    const tradeDateInput = document.getElementById('tradeDate');
    if (tradeDateInput) {
        tradeDateInput.value = currentDateTime;
    }
    
    this.openModal('addEditTradeModal');
};

EnhancedAdminDashboard.prototype.openEditTradeModal = async function(tradeId) {
    try {
        const tradeDoc = await getDoc(doc(this.db, 'trades', tradeId));
        if (tradeDoc.exists()) {
            const tradeData = tradeDoc.data();
            
            // Populate form with existing data
            document.getElementById('tradeId').value = tradeId;
            document.getElementById('tradeUserEmail').value = tradeData.userEmail || '';
            document.getElementById('tradeSymbol').value = tradeData.symbol || '';
            document.getElementById('tradeType').value = tradeData.type || '';
            document.getElementById('tradeAmount').value = tradeData.amount || '';
            document.getElementById('tradeEntryPrice').value = tradeData.entryPrice || '';
            document.getElementById('tradeCurrentPrice').value = tradeData.currentPrice || '';
            document.getElementById('tradeStopLoss').value = tradeData.stopLoss || '';
            document.getElementById('tradeTakeProfit').value = tradeData.takeProfit || '';
            document.getElementById('tradeStatus').value = tradeData.status || '';
            document.getElementById('tradeLeverage').value = tradeData.leverage || 1;
            document.getElementById('tradeNotes').value = tradeData.notes || '';
            
            document.getElementById('addEditTradeModalLabel').textContent = 'Edit Trade';
            this.openModal('addEditTradeModal');
        }
    } catch (error) {
        console.error('Error loading trade for edit:', error);
        this.showNotification('Failed to load trade details', 'error');
    }
};

EnhancedAdminDashboard.prototype.saveTradeRecord = async function(tradeId = null) {
    try {
        this.showLoading(true);
        console.log('Saving trade record...', { tradeId });
        
        // Get form data
        const userEmail = document.getElementById('tradeUserEmail').value.trim();
        const symbol = document.getElementById('tradeSymbol').value.trim();
        const type = document.getElementById('tradeType').value;
        const amount = parseFloat(document.getElementById('tradeAmount').value);
        const entryPrice = parseFloat(document.getElementById('tradeEntryPrice').value);
        const exitPrice = parseFloat(document.getElementById('tradeExitPrice').value) || null;
        const status = document.getElementById('tradeStatus').value;
        const leverage = parseFloat(document.getElementById('tradeLeverage').value) || 1;
        const customDate = document.getElementById('tradeDate').value;
        
        // Validation
        if (!userEmail || !symbol || !type || !amount || !entryPrice || !status) {
            this.showNotification('Please fill in all required fields', 'error');
            this.showLoading(false);
            return;
        }
        
        // Get user UID from email
        const userUid = await this.getUserUidByEmail(userEmail);
        if (!userUid) {
            this.showNotification('User not found with the provided email', 'error');
            this.showLoading(false);
            return;
        }
        
        // Calculate PnL if exit price is provided
        let pnl = 0;
        if (exitPrice && status === 'closed') {
            if (type === 'buy') {
                pnl = (exitPrice - entryPrice) * amount * leverage;
            } else {
                pnl = (entryPrice - exitPrice) * amount * leverage;
            }
        }
        
        // Prepare trade data with both userEmail and uid
        const tradeData = {
            userEmail: userEmail,
            uid: userUid, // Add UID for user history queries
            symbol: symbol.toUpperCase(),
            type: type,
            amount: amount,
            entryPrice: entryPrice,
            exitPrice: exitPrice,
            status: status,
            leverage: leverage,
            pnl: pnl,
            stopLoss: parseFloat(document.getElementById('tradeStopLoss').value) || null,
            takeProfit: parseFloat(document.getElementById('tradeTakeProfit').value) || null,
            notes: document.getElementById('tradeNotes').value.trim() || '',
            updatedAt: serverTimestamp()
        };
        
        // Set custom date if provided
        if (customDate) {
            tradeData.timestamp = new Date(customDate);
        }
        
        let success = false;
        
        if (tradeId) {
            // Update existing trade
            console.log('Updating existing trade:', tradeId, tradeData);
            await updateDoc(doc(this.db, 'trades', tradeId), tradeData);
            success = true;
            console.log('Trade updated successfully');
        } else {
            // Add new trade
            if (!tradeData.timestamp) {
                tradeData.timestamp = serverTimestamp();
            }
            tradeData.createdAt = serverTimestamp();
            tradeData.createdBy = this.currentUser.uid;
            
            console.log('Adding new trade:', tradeData);
            const docRef = await addDoc(collection(this.db, 'trades'), tradeData);
            success = true;
            console.log('Trade added successfully with ID:', docRef.id);
        }
        
        this.showLoading(false);
        
        if (success) {
            this.showNotification('Trade saved successfully!', 'success');
            this.closeModal('addEditTradeModal');
            this.clearTradeFilters(); // Clear filters after saving
            this.loadTrades(); // Ensure the table is reloaded with the new trade
        } else {
            this.showNotification('Failed to save trade.', 'error');
        }
        
    } catch (error) {
        console.error('Error saving trade:', error);
        this.showLoading(false);
        this.showNotification('Error saving trade: ' + error.message, 'error');
    }
};

EnhancedAdminDashboard.prototype.deleteTradeRecord = async function(tradeId) {
    // Set up the confirmation modal
    document.getElementById('deleteConfirmText').textContent = 
        'Are you sure you want to delete this trade record? This action cannot be undone.';
    
    // Set up the delete button click handler
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    confirmBtn.onclick = async () => {
        try {
            await deleteDoc(doc(this.db, 'trades', tradeId));
            this.showNotification('Trade deleted successfully', 'success');
            this.closeModal('confirmDeleteModal');
            await this.loadTrades(); // Refresh the trades table
        } catch (error) {
            console.error('Error deleting trade:', error);
            this.showNotification('Failed to delete trade', 'error');
        }
    };
    
    this.openModal('confirmDeleteModal');
};

// User Account Control Functions - Real working prototype methods
EnhancedAdminDashboard.prototype.searchUserForPassword = async function() {
    const email = document.getElementById('passwordUserSearch').value.trim();
    if (!email) {
        this.showNotification('Please enter a user email', 'warning');
        return;
    }

    try {
        const userQuery = query(collection(this.db, 'users'), where('email', '==', email));
        const userSnapshot = await getDocs(userQuery);
        
        if (userSnapshot.empty) {
            this.showNotification('User not found', 'error');
            return;
        }

        const userData = userSnapshot.docs[0].data();
        const userId = userSnapshot.docs[0].id;
        
        this.selectedPasswordUser = { id: userId, ...userData };
        
        // Update UI
        document.getElementById('passwordUserName').textContent = userData.fullName || 'N/A';
        document.getElementById('passwordUserEmail').textContent = userData.email;
        document.getElementById('passwordUserStatus').textContent = userData.status || 'active';
        document.getElementById('passwordUserStatus').className = `badge bg-${this.getStatusColor(userData.status)}`;
        
        document.getElementById('passwordUserInfo').classList.remove('d-none');
        document.getElementById('passwordActions').classList.remove('d-none');
        document.getElementById('noPasswordUser').classList.add('d-none');
        
    } catch (error) {
        console.error('Error searching user:', error);
        this.showNotification('Error searching for user', 'error');
    }
};

EnhancedAdminDashboard.prototype.filterTrades = function() {
    const searchTerm = document.getElementById('tradeSearchInput').value.toLowerCase();
    const statusFilter = document.getElementById('tradeStatusFilter').value;
    const typeFilter = document.getElementById('tradeTypeFilter').value;
    const dateFilter = document.getElementById('tradeDateFilter').value;
    
    // If no filters are active, clear filteredTrades
    if (!searchTerm && !statusFilter && !typeFilter && !dateFilter) {
        this.filteredTrades = null;
    } else {
        this.filteredTrades = this.trades.filter(trade => {
            const searchMatch = !searchTerm || 
                trade.userEmail?.toLowerCase().includes(searchTerm) ||
                trade.symbol?.toLowerCase().includes(searchTerm) ||
                trade.id?.toLowerCase().includes(searchTerm);
            
            const statusMatch = !statusFilter || trade.status === statusFilter;
            const typeMatch = !typeFilter || trade.type === typeFilter;
            
            let dateMatch = true;
            if (dateFilter && trade.timestamp) {
                const tradeDate = trade.timestamp.toDate();
                const filterDate = new Date(dateFilter);
                dateMatch = tradeDate.toDateString() === filterDate.toDateString();
            }
            
            return searchMatch && statusMatch && typeMatch && dateMatch;
        });
    }
    
    // Use the unified renderTradesTable method
    this.renderTradesTable();
};



// Add this helper function to get user UID from email
EnhancedAdminDashboard.prototype.getUserUidByEmail = async function(email) {
    try {
        const usersQuery = query(
            collection(this.db, 'users'),
            where('email', '==', email),
            limit(1)
        );
        
        const snapshot = await getDocs(usersQuery);
        if (!snapshot.empty) {
            return snapshot.docs[0].id; // Document ID is the UID
        }
        return null;
    } catch (error) {
        console.error('Error getting user UID by email:', error);
        return null;
    }
};

// Transaction History CRUD Methods
EnhancedAdminDashboard.prototype.openAddTransactionModal = function() {
    // Clear form
    document.getElementById('addEditTransactionForm').reset();
    document.getElementById('transactionId').value = '';
    document.getElementById('addEditTransactionModalLabel').textContent = 'Add New Transaction';
    
    // Set current date/time for new transactions
    const now = new Date();
    const currentDateTime = now.toISOString().slice(0, 16);
    const transactionDateInput = document.getElementById('transactionDate');
    if (transactionDateInput) {
        transactionDateInput.value = currentDateTime;
    }
    
    this.openModal('addEditTransactionModal');
};

EnhancedAdminDashboard.prototype.openEditTransactionModal = async function(transactionId) {
    try {
        const transactionDoc = await getDoc(doc(this.db, 'transactions', transactionId));
        if (transactionDoc.exists()) {
            const transactionData = transactionDoc.data();
            
            // Populate form with existing data
            document.getElementById('transactionId').value = transactionId;
            document.getElementById('transactionUserEmail').value = transactionData.userEmail || '';
            document.getElementById('transactionType').value = transactionData.type || '';
            document.getElementById('transactionAmount').value = transactionData.amount || '';
            document.getElementById('transactionFee').value = transactionData.fee || 0;
            document.getElementById('transactionStatus').value = transactionData.status || '';
            document.getElementById('transactionMethod').value = transactionData.method || '';
            document.getElementById('transactionReference').value = transactionData.reference || '';
            document.getElementById('transactionDescription').value = transactionData.description || '';
            
            // Set date if available
            if (transactionData.timestamp) {
                const date = transactionData.timestamp.toDate();
                document.getElementById('transactionDate').value = date.toISOString().slice(0, 16);
            }
            
            document.getElementById('addEditTransactionModalLabel').textContent = 'Edit Transaction';
            this.openModal('addEditTransactionModal');
        }
    } catch (error) {
        console.error('Error loading transaction for edit:', error);
        this.showNotification('Failed to load transaction details', 'error');
    }
};

EnhancedAdminDashboard.prototype.saveTransactionRecord = async function() {
    try {
        const form = document.getElementById('addEditTransactionForm');
        const transactionId = document.getElementById('transactionId').value;
        
        // Validate required fields
        const userEmail = document.getElementById('transactionUserEmail').value.trim();
        const type = document.getElementById('transactionType').value;
        const amount = parseFloat(document.getElementById('transactionAmount').value);
        const status = document.getElementById('transactionStatus').value;
        
        if (!userEmail || !type || !amount || !status) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        // Get user UID from email
        const userUid = await this.getUserUidByEmail(userEmail);
        if (!userUid) {
            this.showNotification('User not found with the provided email', 'error');
            return;
        }
        
        // Prepare transaction data with both userEmail and uid
        const transactionData = {
            userEmail: userEmail,
            uid: userUid, // Add UID for user history queries
            type: type,
            amount: amount,
            fee: parseFloat(document.getElementById('transactionFee').value) || 0,
            status: status,
            method: document.getElementById('transactionMethod').value || '',
            reference: document.getElementById('transactionReference').value.trim() || '',
            description: document.getElementById('transactionDescription').value.trim() || '',
            updatedAt: serverTimestamp()
        };
        
        // Set custom date if provided, otherwise use current timestamp
        const customDate = document.getElementById('transactionDate').value;
        if (customDate) {
            transactionData.timestamp = new Date(customDate);
        }
        
        if (transactionId) {
            // Update existing transaction
            await updateDoc(doc(this.db, 'transactions', transactionId), transactionData);
            this.showNotification('Transaction updated successfully', 'success');
        } else {
            // Add new transaction
            if (!transactionData.timestamp) {
                transactionData.timestamp = serverTimestamp();
            }
            transactionData.createdAt = serverTimestamp();
            transactionData.createdBy = this.currentUser.uid;
            await addDoc(collection(this.db, 'transactions'), transactionData);
            this.showNotification('Transaction added successfully', 'success');
        }
        
        this.closeModal('addEditTransactionModal');
        await this.loadTransactions(); // Refresh the transactions table
        
    } catch (error) {
        console.error('Error saving transaction:', error);
        this.showNotification('Failed to save transaction', 'error');
    }
};

EnhancedAdminDashboard.prototype.deleteTransactionRecord = async function(transactionId) {
    if (!confirm('Are you sure you want to delete this transaction?')) {
        return;
    }
    
    try {
        await deleteDoc(doc(this.db, 'transactions', transactionId));
        this.showNotification('Transaction deleted successfully', 'success');
        this.loadTransactions();
        this.closeModal('transactionDetailsModal');
    } catch (error) {
        console.error('Error deleting transaction:', error);
        this.showNotification('Error deleting transaction', 'error');
    }
};

export default EnhancedAdminDashboard;