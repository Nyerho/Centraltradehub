// Profile Management JavaScript
import userProfileService from './user-profile-service.js';
import { auth } from './firebase-config.js';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

class ProfileManager {
    constructor() {
        this.isEditMode = false;
        this.currentTab = 'profile-info';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUserProfile();
        this.loadTransactionHistory();
        this.loadTradingHistory();
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.profile-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = item.getAttribute('data-tab');
                this.switchTab(tabId);
            });
        });

        // Profile form submission
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.handleProfileUpdate(e));
        }

        // Password form submission
        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => this.handlePasswordUpdate(e));
        }

        // Filter controls
        const transactionFilter = document.getElementById('transactionFilter');
        if (transactionFilter) {
            transactionFilter.addEventListener('change', () => this.filterTransactions());
        }

        const tradeFilter = document.getElementById('tradeFilter');
        if (tradeFilter) {
            tradeFilter.addEventListener('change', () => this.filterTrades());
        }
    }

    async loadUserProfile() {
        const profile = userProfileService.getCurrentUserProfile();
        if (profile) {
            this.populateProfileForm(profile);
        } else {
            // Wait for profile to load
            setTimeout(() => this.loadUserProfile(), 1000);
        }
    }

    populateProfileForm(profile) {
        const fields = ['firstName', 'lastName', 'email', 'phone', 'country', 'accountType'];
        
        fields.forEach(field => {
            const element = document.getElementById(field);
            if (element && profile[field]) {
                element.value = profile[field];
            }
        });

        // Special handling for email (from auth)
        const emailField = document.getElementById('email');
        if (emailField && auth.currentUser) {
            emailField.value = auth.currentUser.email;
        }
    }

    switchTab(tabId) {
        // Remove active class from all tabs and nav items
        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.profile-nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to selected tab and nav item
        const selectedTab = document.getElementById(tabId);
        const selectedNavItem = document.querySelector(`[data-tab="${tabId}"]`);
        
        if (selectedTab) selectedTab.classList.add('active');
        if (selectedNavItem) selectedNavItem.classList.add('active');

        this.currentTab = tabId;

        // Load data for specific tabs
        if (tabId === 'transaction-history') {
            this.loadTransactionHistory();
        } else if (tabId === 'trading-history') {
            this.loadTradingHistory();
        }
    }

    setupRealtimeTransactionListener() {
        const transactionList = document.getElementById('transactionList');
        if (!transactionList) return;

        // Clean up existing listener
        if (this.transactionListener) {
            this.transactionListener();
        }

        transactionList.innerHTML = '<div class="loading">Loading transactions...</div>';

        try {
            // Setup real-time listener for transactions
            const transactionsRef = collection(db, 'transactions');
            const q = query(
                transactionsRef,
                where('uid', '==', auth.currentUser.uid),
                orderBy('timestamp', 'desc'),
                limit(50)
            );
            
            this.transactionListener = onSnapshot(q, (querySnapshot) => {
                const transactions = [];
                
                querySnapshot.forEach((doc) => {
                    transactions.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                this.displayTransactions(transactions);
                
            }, (error) => {
                console.error('Error in transactions listener:', error);
                transactionList.innerHTML = '<div class="error">Error loading transactions</div>';
            });
            
        } catch (error) {
            console.error('Error setting up transactions listener:', error);
            transactionList.innerHTML = '<div class="error">Error loading transactions</div>';
        }
    }

    async loadTransactionHistory() {
        // Replace the old method with real-time listener
        this.setupRealtimeTransactionListener();
    }

    cleanup() {
        if (this.transactionListener) {
            this.transactionListener();
            this.transactionListener = null;
        }
    }
    displayTransactions(transactions) {
        const transactionList = document.getElementById('transactionList');
        
        if (transactions.length === 0) {
            transactionList.innerHTML = '<div class="empty-state">No transactions found</div>';
            return;
        }

        const transactionHTML = transactions.map(transaction => `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-type ${transaction.type}">
                        <i class="fas fa-${this.getTransactionIcon(transaction.type)}"></i>
                        ${transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-amount ${transaction.type === 'withdrawal' ? 'negative' : 'positive'}">
                            ${transaction.type === 'withdrawal' ? '-' : '+'}$${transaction.amount.toFixed(2)}
                        </div>
                        <div class="transaction-date">
                            ${new Date(transaction.createdAt.toDate()).toLocaleDateString()}
                        </div>
                    </div>
                </div>
                <div class="transaction-status ${transaction.status}">
                    ${transaction.status}
                </div>
            </div>
        `).join('');

        transactionList.innerHTML = transactionHTML;
    }

    async loadTradingHistory() {
        const tradeList = document.getElementById('tradeList');
        if (!tradeList) return;

        tradeList.innerHTML = '<div class="loading">Loading trades...</div>';

        try {
            const trades = await userProfileService.getTradingHistory(auth.currentUser.uid);
            this.displayTrades(trades);
        } catch (error) {
            console.error('Error loading trades:', error);
            tradeList.innerHTML = '<div class="error">Error loading trades</div>';
        }
    }

    displayTrades(trades) {
        const tradeList = document.getElementById('tradeList');
        
        if (trades.length === 0) {
            tradeList.innerHTML = '<div class="empty-state">No trades found</div>';
            return;
        }

        const tradeHTML = trades.map(trade => `
            <div class="trade-item">
                <div class="trade-info">
                    <div class="trade-symbol">${trade.symbol}</div>
                    <div class="trade-type ${trade.type}">${trade.type.toUpperCase()}</div>
                    <div class="trade-size">${trade.size} lots</div>
                </div>
                <div class="trade-prices">
                    <div class="entry-price">Entry: ${trade.entryPrice}</div>
                    ${trade.exitPrice ? `<div class="exit-price">Exit: ${trade.exitPrice}</div>` : ''}
                </div>
                <div class="trade-pnl ${trade.pnl >= 0 ? 'positive' : 'negative'}">
                    ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}
                </div>
                <div class="trade-status ${trade.status}">
                    ${trade.status}
                </div>
            </div>
        `).join('');

        tradeList.innerHTML = tradeHTML;
    }

    getTransactionIcon(type) {
        const icons = {
            deposit: 'plus-circle',
            withdrawal: 'minus-circle',
            transfer: 'exchange-alt'
        };
        return icons[type] || 'circle';
    }

    async handleProfileUpdate(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const profileData = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            phone: formData.get('phone'),
            country: formData.get('country'),
            displayName: `${formData.get('firstName')} ${formData.get('lastName')}`.trim()
        };

        try {
            const result = await userProfileService.updateUserProfile(auth.currentUser.uid, profileData);
            
            if (result.success) {
                this.showNotification('Profile updated successfully!', 'success');
                this.toggleEditMode();
            } else {
                this.showNotification('Error updating profile: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showNotification('Error updating profile', 'error');
        }
    }

    async handlePasswordUpdate(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const currentPassword = formData.get('currentPassword');
        const newPassword = formData.get('newPassword');
        const confirmPassword = formData.get('confirmPassword');

        if (newPassword !== confirmPassword) {
            this.showNotification('New passwords do not match', 'error');
            return;
        }

        try {
            // Reauthenticate user
            const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
            await reauthenticateWithCredential(auth.currentUser, credential);
            
            // Update password
            await updatePassword(auth.currentUser, newPassword);
            
            this.showNotification('Password updated successfully!', 'success');
            e.target.reset();
        } catch (error) {
            console.error('Error updating password:', error);
            this.showNotification('Error updating password: ' + error.message, 'error');
        }
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Global functions for profile management
window.toggleEditMode = function() {
    const profileManager = window.profileManager;
    const form = document.getElementById('profileForm');
    const inputs = form.querySelectorAll('input, select');
    const actions = form.querySelector('.form-actions');
    const editBtn = document.querySelector('.btn-edit');
    
    profileManager.isEditMode = !profileManager.isEditMode;
    
    inputs.forEach(input => {
        if (input.name !== 'email') { // Keep email readonly
            input.readOnly = !profileManager.isEditMode;
            input.disabled = !profileManager.isEditMode;
        }
    });
    
    actions.style.display = profileManager.isEditMode ? 'block' : 'none';
    editBtn.textContent = profileManager.isEditMode ? 'Cancel Edit' : 'Edit Profile';
};

window.cancelEdit = function() {
    window.toggleEditMode();
    window.profileManager.loadUserProfile(); // Reload original data
};

// Initialize profile manager
window.profileManager = new ProfileManager();