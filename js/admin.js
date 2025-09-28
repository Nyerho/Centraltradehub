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
    serverTimestamp
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
        
        this.init();
    }

    async init() {
        try {
            // Check authentication state
            onAuthStateChanged(this.auth, (user) => {
                if (user) {
                    this.currentUser = user;
                    this.checkAdminAccess();
                } else {
                    this.redirectToLogin();
                }
            });

            // Initialize event listeners
            this.setupEventListeners();
            
            // Initialize dashboard
            await this.loadDashboardData();
            
            // Setup real-time listeners
            this.setupRealtimeListeners();
            
        } catch (error) {
            console.error('Admin initialization error:', error);
            this.showNotification('Failed to initialize admin panel', 'error');
        }
    }

    async checkAdminAccess() {
        try {
            const userDoc = await getDoc(doc(this.db, 'users', this.currentUser.uid));
            if (!userDoc.exists() || userDoc.data().role !== 'admin') {
                this.showNotification('Access denied. Admin privileges required.', 'error');
                await signOut(this.auth);
                return;
            }
            
            // Update UI with admin info
            this.updateAdminInfo(userDoc.data());
            
        } catch (error) {
            console.error('Admin access check error:', error);
            this.redirectToLogin();
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

        // Mobile menu toggle
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', this.toggleMobileMenu.bind(this));
        }

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }

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

    async loadDashboardData() {
        try {
            this.showLoading(true);
            
            // Load all data concurrently
            await Promise.all([
                this.loadUsers(),
                this.loadTransactions(),
                this.loadTrades(),
                this.loadWithdrawals(),
                this.loadSiteSettings()
            ]);
            
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
            const usersQuery = query(
                collection(this.db, 'users'),
                orderBy('createdAt', 'desc')
            );
            
            const snapshot = await getDocs(usersQuery);
            this.users = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.renderUsersTable();
            this.updateUserStats();
            
        } catch (error) {
            console.error('Users loading error:', error);
            this.showNotification('Failed to load users', 'error');
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
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        
        const usersToShow = this.filteredUsers || this.users;
        const startIndex = (this.currentUserPage - 1) * this.usersPerPage;
        const endIndex = startIndex + this.usersPerPage;
        const paginatedUsers = usersToShow.slice(startIndex, endIndex);
        
        tbody.innerHTML = paginatedUsers.map(user => `
            <tr>
                <td><input type="checkbox" class="user-checkbox" value="${user.id}"></td>
                <td>
                    <div class="d-flex align-items-center">
                        <img src="assets/images/user-avatar.png" alt="Avatar" class="rounded-circle me-2" width="32" height="32">
                        <div>
                            <div class="fw-semibold">${user.firstName} ${user.lastName}</div>
                            <small class="text-muted">${user.email}</small>
                        </div>
                    </div>
                </td>
                <td><span class="badge bg-${user.role === 'admin' ? 'danger' : 'primary'}">${user.role}</span></td>
                <td><span class="badge bg-${user.status === 'active' ? 'success' : 'secondary'}">${user.status}</span></td>
                <td>$${user.balance?.toFixed(2) || '0.00'}</td>
                <td>${user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="adminDashboard.viewUser('${user.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-warning" onclick="adminDashboard.editUser('${user.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-info" onclick="adminDashboard.handlePasswordReset('${user.id}', '${user.email}')">
                            <i class="fas fa-key"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="adminDashboard.handleDeleteUser('${user.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        this.renderUsersPagination(usersToShow.length);
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
        
        tbody.innerHTML = this.transactions.map(transaction => `
            <tr>
                <td>${transaction.id}</td>
                <td>${transaction.userEmail || 'N/A'}</td>
                <td><span class="badge bg-${this.getTransactionTypeColor(transaction.type)}">${transaction.type}</span></td>
                <td>$${transaction.amount?.toFixed(2) || '0.00'}</td>
                <td><span class="badge bg-${this.getTransactionStatusColor(transaction.status)}">${transaction.status}</span></td>
                <td>${transaction.timestamp ? new Date(transaction.timestamp.toDate()).toLocaleString() : 'N/A'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="adminDashboard.viewTransaction('${transaction.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderTradesTable() {
        const tbody = document.getElementById('tradesTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = this.trades.map(trade => `
            <tr>
                <td>${trade.id}</td>
                <td>${trade.userEmail || 'N/A'}</td>
                <td>${trade.symbol || 'N/A'}</td>
                <td><span class="badge bg-${trade.type === 'buy' ? 'success' : 'danger'}">${trade.type}</span></td>
                <td>$${trade.amount?.toFixed(2) || '0.00'}</td>
                <td><span class="badge bg-${this.getTradeStatusColor(trade.status)}">${trade.status}</span></td>
                <td>${trade.timestamp ? new Date(trade.timestamp.toDate()).toLocaleString() : 'N/A'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="adminDashboard.viewTrade('${trade.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
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
            adminName.textContent = `${adminData.firstName} ${adminData.lastName}`;
        }
        
        if (adminEmail) {
            adminEmail.textContent = adminData.email;
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
        // Initialize Chart.js charts
        this.initializeTradingVolumeChart();
        this.initializeUserGrowthChart();
        this.initializeRevenueChart();
        this.initializeUserActivityChart();
    }

    initializeTradingVolumeChart() {
        const ctx = document.getElementById('tradingVolumeChart');
        if (!ctx) return;
        
        // Sample data - replace with real data
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Trading Volume',
                    data: [12000, 19000, 15000, 25000, 22000, 30000],
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Monthly Trading Volume'
                    }
                }
            }
        });
    }

    initializeUserGrowthChart() {
        const ctx = document.getElementById('userGrowthChart');
        if (!ctx) return;
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'New Users',
                    data: [65, 59, 80, 81, 56, 55],
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Monthly User Growth'
                    }
                }
            }
        });
    }

    initializeRevenueChart() {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Trading Fees', 'Withdrawal Fees', 'Premium Plans'],
                datasets: [{
                    data: [300, 50, 100],
                    backgroundColor: [
                        'rgb(255, 99, 132)',
                        'rgb(54, 162, 235)',
                        'rgb(255, 205, 86)'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Revenue Sources'
                    }
                }
            }
        });
    }

    initializeUserActivityChart() {
        const ctx = document.getElementById('userActivityChart');
        if (!ctx) return;
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
                datasets: [{
                    label: 'Active Users',
                    data: [20, 10, 45, 80, 65, 35],
                    borderColor: 'rgb(153, 102, 255)',
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Daily User Activity'
                    }
                }
            }
        });
    }

    // Navigation Methods
    navigateToPage(page) {
        // Hide all sections
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show selected section
        const targetSection = document.getElementById(page); // Remove 'Section' suffix
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNavItem = document.querySelector(`[data-section="${page}"]`); // Changed from data-page
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }
        
        this.currentPage = page;
        
        // Load page-specific data
        this.loadPageData(page);
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
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobileOverlay');
        
        if (sidebar && overlay) {
            sidebar.classList.toggle('show');
            overlay.classList.toggle('show');
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
        document.getElementById('userDetailName').textContent = `${userData.firstName} ${userData.lastName}`;
        document.getElementById('userDetailEmail').textContent = userData.email;
        document.getElementById('userDetailRole').textContent = userData.role;
        document.getElementById('userDetailStatus').textContent = userData.status;
        document.getElementById('userDetailBalance').textContent = `$${userData.balance?.toFixed(2) || '0.00'}`;
        document.getElementById('userDetailCreated').textContent = userData.createdAt ? 
            new Date(userData.createdAt.toDate()).toLocaleString() : 'N/A';
    }

    populateEditUserModal(userData, userId) {
        document.getElementById('editUserId').value = userId;
        document.getElementById('editFirstName').value = userData.firstName || '';
        document.getElementById('editLastName').value = userData.lastName || '';
        document.getElementById('editEmail').value = userData.email || '';
        document.getElementById('editRole').value = userData.role || 'user';
        document.getElementById('editStatus').value = userData.status || 'active';
        document.getElementById('editBalance').value = userData.balance || 0;
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
                // Implement trade details modal
                console.log('Trade details:', tradeData);
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

// Initialize admin dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new EnhancedAdminDashboard();
});

// Export for module usage
export default EnhancedAdminDashboard;