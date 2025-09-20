// Global variables
let currentPage = 1;
const usersPerPage = 10;
let allUsers = [];
let filteredUsers = [];
let currentUserDetails = {};

// Initialize user management
async function initializeUserManagement() {
    try {
        console.log('Initializing user management...');
        await loadUsers();
        setupEventListeners();
        showToast('User management initialized successfully', 'success');
    } catch (error) {
        console.error('Error initializing user management:', error);
        showToast('Failed to initialize user management', 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const roleFilter = document.getElementById('roleFilter');
    const statusFilter = document.getElementById('statusFilter');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterUsers);
    }
    if (roleFilter) {
        roleFilter.addEventListener('change', filterUsers);
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', filterUsers);
    }
}

// Load users from Firestore
async function loadUsers() {
    try {
        showLoading(true);
        console.log('Loading users from Firestore...');
        
        const snapshot = await db.collection('users').get();
        
        allUsers = [];
        snapshot.forEach((doc) => {
            allUsers.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log('Loaded users:', allUsers.length);
        filteredUsers = [...allUsers];
        displayUsers();
        showLoading(false);
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Failed to load users', 'error');
        showLoading(false);
        
        // Show sample data if Firebase fails
        loadSampleData();
    }
}

// Load sample data for testing
function loadSampleData() {
    console.log('Loading sample data...');
    allUsers = [
        {
            id: 'user1',
            email: 'john.doe@example.com',
            fullName: 'John Doe',
            role: 'user',
            status: 'active',
            balance: 1250.50,
            lastLogin: new Date(),
            phone: '+1234567890'
        },
        {
            id: 'user2',
            email: 'jane.smith@example.com',
            fullName: 'Jane Smith',
            role: 'trader',
            status: 'active',
            balance: 5000.00,
            lastLogin: new Date(Date.now() - 86400000),
            phone: '+1987654321'
        },
        {
            id: 'user3',
            email: 'admin@example.com',
            fullName: 'Admin User',
            role: 'admin',
            status: 'active',
            balance: 0.00,
            lastLogin: new Date(Date.now() - 3600000),
            phone: '+1122334455'
        }
    ];
    
    filteredUsers = [...allUsers];
    displayUsers();
    showToast('Sample data loaded', 'info');
}

// Filter users based on search and filters
function filterUsers() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const roleFilter = document.getElementById('roleFilter')?.value || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    
    filteredUsers = allUsers.filter(user => {
        const matchesSearch = !searchTerm || 
            user.email?.toLowerCase().includes(searchTerm) ||
            user.fullName?.toLowerCase().includes(searchTerm) ||
            user.id.toLowerCase().includes(searchTerm);
            
        const matchesRole = !roleFilter || user.role === roleFilter;
        const matchesStatus = !statusFilter || user.status === statusFilter;
        
        return matchesSearch && matchesRole && matchesStatus;
    });
    
    currentPage = 1;
    displayUsers();
}

// Display users in table
function displayUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    const startIndex = (currentPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    const usersToShow = filteredUsers.slice(startIndex, endIndex);
    
    tbody.innerHTML = '';
    
    if (usersToShow.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No users found</td></tr>';
        return;
    }
    
    usersToShow.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.email || 'N/A'}</td>
            <td>${user.fullName || 'N/A'}</td>
            <td><span class="badge badge-${user.role || 'user'}">${user.role || 'user'}</span></td>
            <td><span class="badge badge-${user.status || 'active'}">${user.status || 'active'}</span></td>
            <td>$${(user.balance || 0).toFixed(2)}</td>
            <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</td>
            <td>
                <div class="action-buttons">
                    <button onclick="toggleUserDetails('${user.id}')" class="btn btn-info">Details</button>
                    <button onclick="editUser('${user.id}')" class="btn btn-primary">Edit</button>
                    <button onclick="deleteUser('${user.id}')" class="btn btn-danger">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
        
        // Add details row
        const detailsRow = document.createElement('tr');
        detailsRow.className = 'user-details-row';
        detailsRow.id = `details-${user.id}`;
        detailsRow.innerHTML = `
            <td colspan="8">
                <div class="user-details-content" id="details-content-${user.id}">
                    <div class="loading">Loading user details...</div>
                </div>
            </td>
        `;
        tbody.appendChild(detailsRow);
    });
    
    updatePagination();
}

// Toggle user details display
async function toggleUserDetails(userId) {
    const detailsRow = document.getElementById(`details-${userId}`);
    const detailsContent = document.getElementById(`details-content-${userId}`);
    
    if (!detailsRow || !detailsContent) return;
    
    if (detailsRow.classList.contains('active')) {
        detailsRow.classList.remove('active');
        return;
    }
    
    // Close other open details
    document.querySelectorAll('.user-details-row.active').forEach(row => {
        row.classList.remove('active');
    });
    
    detailsRow.classList.add('active');
    
    try {
        // Find user data
        const userData = allUsers.find(user => user.id === userId);
        if (!userData) {
            detailsContent.innerHTML = '<div class="error-message">User not found</div>';
            return;
        }
        
        // Load trading history and transactions (sample data)
        const trades = generateSampleTrades(userId);
        const transactions = generateSampleTransactions(userId);
        
        // Render details
        detailsContent.innerHTML = renderUserDetails(userData, trades, transactions, userId);
        
    } catch (error) {
        console.error('Error loading user details:', error);
        detailsContent.innerHTML = '<div class="error-message">Failed to load user details</div>';
    }
}

// Generate sample trading data
function generateSampleTrades(userId) {
    return [
        {
            id: 'trade1',
            symbol: 'EURUSD',
            type: 'buy',
            size: 1.0,
            entryPrice: 1.0850,
            exitPrice: 1.0920,
            pnl: 70.00,
            timestamp: new Date(Date.now() - 86400000)
        },
        {
            id: 'trade2',
            symbol: 'GBPUSD',
            type: 'sell',
            size: 0.5,
            entryPrice: 1.2650,
            exitPrice: 1.2580,
            pnl: 35.00,
            timestamp: new Date(Date.now() - 172800000)
        },
        {
            id: 'trade3',
            symbol: 'USDJPY',
            type: 'buy',
            size: 2.0,
            entryPrice: 149.50,
            exitPrice: 148.80,
            pnl: -140.00,
            timestamp: new Date(Date.now() - 259200000)
        }
    ];
}

// Generate sample transaction data
function generateSampleTransactions(userId) {
    return [
        {
            id: 'txn1',
            type: 'deposit',
            amount: 1000.00,
            status: 'completed',
            timestamp: new Date(Date.now() - 86400000)
        },
        {
            id: 'txn2',
            type: 'withdrawal',
            amount: 250.00,
            status: 'completed',
            timestamp: new Date(Date.now() - 172800000)
        },
        {
            id: 'txn3',
            type: 'deposit',
            amount: 500.00,
            status: 'pending',
            timestamp: new Date(Date.now() - 259200000)
        }
    ];
}

// Render user details HTML
function renderUserDetails(userData, trades, transactions, userId) {
    const stats = calculateUserStats(trades, transactions);
    
    return `
        <div class="details-tabs">
            <button class="tab-button active" onclick="showTab('profile-${userId}', this)">Profile</button>
            <button class="tab-button" onclick="showTab('financial-${userId}', this)">Financial</button>
            <button class="tab-button" onclick="showTab('trading-${userId}', this)">Trading</button>
            <button class="tab-button" onclick="showTab('security-${userId}', this)">Security</button>
        </div>
        
        <div id="profile-${userId}" class="tab-content active">
            <div class="form-row">
                <div class="form-group">
                    <label>User ID</label>
                    <input type="text" value="${userId}" readonly>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="email-${userId}" value="${userData.email || ''}">
                </div>
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="fullName-${userId}" value="${userData.fullName || ''}">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="text" id="phone-${userId}" value="${userData.phone || ''}">
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <select id="role-${userId}">
                        <option value="user" ${userData.role === 'user' ? 'selected' : ''}>User</option>
                        <option value="admin" ${userData.role === 'admin' ? 'selected' : ''}>Admin</option>
                        <option value="trader" ${userData.role === 'trader' ? 'selected' : ''}>Trader</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="status-${userId}">
                        <option value="active" ${userData.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="suspended" ${userData.status === 'suspended' ? 'selected' : ''}>Suspended</option>
                        <option value="pending" ${userData.status === 'pending' ? 'selected' : ''}>Pending</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <button onclick="saveInlineUserChanges('${userId}')" class="btn btn-success">Save Changes</button>
            </div>
        </div>
        
        <div id="financial-${userId}" class="tab-content">
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">$${(userData.balance || 0).toFixed(2)}</div>
                    <div class="stat-label">Current Balance</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">$${stats.totalDeposits}</div>
                    <div class="stat-label">Total Deposits</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">$${stats.totalWithdrawals}</div>
                    <div class="stat-label">Total Withdrawals</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">$${stats.netFlow}</div>
                    <div class="stat-label">Net Flow</div>
                </div>
            </div>
            
            <div class="form-group">
                <label>Adjust Balance</label>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="number" id="balanceAdjustment-${userId}" placeholder="Amount" step="0.01">
                    <select id="adjustmentType-${userId}">
                        <option value="add">Add</option>
                        <option value="subtract">Subtract</option>
                        <option value="set">Set To</option>
                    </select>
                    <button onclick="adjustUserBalance('${userId}')" class="btn btn-warning">Adjust</button>
                </div>
            </div>
            
            <h4>Recent Transactions</h4>
            <table class="trading-history-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.map(transaction => `
                        <tr>
                            <td>${new Date(transaction.timestamp).toLocaleDateString()}</td>
                            <td>${transaction.type}</td>
                            <td>$${transaction.amount?.toFixed(2)}</td>
                            <td><span class="badge badge-${transaction.status}">${transaction.status}</span></td>
                            <td>
                                <button onclick="editTransaction('${transaction.id}')" class="btn btn-primary">Edit</button>
                                <button onclick="deleteTransaction('${transaction.id}')" class="btn btn-danger">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div id="trading-${userId}" class="tab-content">
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.totalTrades}</div>
                    <div class="stat-label">Total Trades</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.winRate}%</div>
                    <div class="stat-label">Win Rate</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">$${stats.totalProfit}</div>
                    <div class="stat-label">Total P&L</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">$${stats.avgTradeSize}</div>
                    <div class="stat-label">Avg Trade Size</div>
                </div>
            </div>
            
            <h4>Recent Trades</h4>
            <table class="trading-history-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Symbol</th>
                        <th>Type</th>
                        <th>Size</th>
                        <th>Entry</th>
                        <th>Exit</th>
                        <th>P&L</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${trades.map(trade => `
                        <tr>
                            <td>${new Date(trade.timestamp).toLocaleDateString()}</td>
                            <td>${trade.symbol}</td>
                            <td>${trade.type}</td>
                            <td>${trade.size}</td>
                            <td>$${trade.entryPrice?.toFixed(4)}</td>
                            <td>$${trade.exitPrice?.toFixed(4) || 'Open'}</td>
                            <td class="${trade.pnl >= 0 ? 'text-success' : 'text-danger'}">$${trade.pnl?.toFixed(2)}</td>
                            <td>
                                <button onclick="editTrade('${trade.id}')" class="btn btn-primary">Edit</button>
                                <button onclick="deleteTrade('${trade.id}')" class="btn btn-danger">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div id="security-${userId}" class="tab-content">
            <div class="form-row">
                <div class="form-group">
                    <label>Reset Password</label>
                    <div style="display: flex; gap: 10px;">
                        <input type="password" id="newPassword-${userId}" placeholder="New Password">
                        <button onclick="resetUserPassword('${userId}')" class="btn btn-warning">Reset</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>2FA Status</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <span>${userData.twoFactorEnabled ? 'Enabled' : 'Disabled'}</span>
                        <button onclick="toggle2FA('${userId}')" class="btn btn-info">
                            ${userData.twoFactorEnabled ? 'Disable' : 'Enable'} 2FA
                        </button>
                    </div>
                </div>
                <div class="form-group">
                    <label>Login Attempts</label>
                    <input type="number" value="${userData.loginAttempts || 0}" readonly>
                </div>
                <div class="form-group">
                    <label>Last Login</label>
                    <input type="text" value="${userData.lastLogin ? new Date(userData.lastLogin).toLocaleString() : 'Never'}" readonly>
                </div>
            </div>
        </div>
    `;
}

// Calculate user statistics
function calculateUserStats(trades, transactions) {
    const stats = {
        totalTrades: trades.length,
        winRate: 0,
        totalProfit: 0,
        avgTradeSize: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        netFlow: 0
    };
    
    // Calculate trading stats
    if (trades.length > 0) {
        const winningTrades = trades.filter(trade => trade.pnl > 0).length;
        stats.winRate = ((winningTrades / trades.length) * 100).toFixed(1);
        stats.totalProfit = trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0).toFixed(2);
        stats.avgTradeSize = (trades.reduce((sum, trade) => sum + (trade.size || 0), 0) / trades.length).toFixed(2);
    }
    
    // Calculate financial stats
    const deposits = transactions.filter(t => t.type === 'deposit');
    const withdrawals = transactions.filter(t => t.type === 'withdrawal');
    
    stats.totalDeposits = deposits.reduce((sum, t) => sum + (t.amount || 0), 0).toFixed(2);
    stats.totalWithdrawals = withdrawals.reduce((sum, t) => sum + (t.amount || 0), 0).toFixed(2);
    stats.netFlow = (stats.totalDeposits - stats.totalWithdrawals).toFixed(2);
    
    return stats;
}

// Show tab content
function showTab(tabId, buttonElement) {
    // Hide all tab contents in the same container
    const container = buttonElement.closest('.user-details-content');
    container.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    container.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabId).classList.add('active');
    buttonElement.classList.add('active');
}

// Save inline user changes
async function saveInlineUserChanges(userId) {
    try {
        const updates = {
            email: document.getElementById(`email-${userId}`).value,
            fullName: document.getElementById(`fullName-${userId}`).value,
            phone: document.getElementById(`phone-${userId}`).value,
            role: document.getElementById(`role-${userId}`).value,
            status: document.getElementById(`status-${userId}`).value,
            updatedAt: new Date()
        };
        
        // Update in Firebase if available
        if (typeof db !== 'undefined') {
            await db.collection('users').doc(userId).update(updates);
        }
        
        // Update local data
        const userIndex = allUsers.findIndex(user => user.id === userId);
        if (userIndex !== -1) {
            allUsers[userIndex] = { ...allUsers[userIndex], ...updates };
            filteredUsers = [...allUsers];
            displayUsers();
        }
        
        showToast('User updated successfully', 'success');
    } catch (error) {
        console.error('Error updating user:', error);
        showToast('Failed to update user', 'error');
    }
}

// Adjust user balance
async function adjustUserBalance(userId) {
    try {
        const amount = parseFloat(document.getElementById(`balanceAdjustment-${userId}`).value);
        const type = document.getElementById(`adjustmentType-${userId}`).value;
        
        if (isNaN(amount)) {
            showToast('Please enter a valid amount', 'warning');
            return;
        }
        
        const user = allUsers.find(u => u.id === userId);
        if (!user) return;
        
        const currentBalance = user.balance || 0;
        let newBalance;
        
        switch (type) {
            case 'add':
                newBalance = currentBalance + amount;
                break;
            case 'subtract':
                newBalance = currentBalance - amount;
                break;
            case 'set':
                newBalance = amount;
                break;
        }
        
        // Update user balance
        user.balance = newBalance;
        
        // Update in Firebase if available
        if (typeof db !== 'undefined') {
            await db.collection('users').doc(userId).update({
                balance: newBalance,
                updatedAt: new Date()
            });
        }
        
        showToast('Balance updated successfully', 'success');
        toggleUserDetails(userId); // Refresh details
        displayUsers(); // Refresh table
    } catch (error) {
        console.error('Error adjusting balance:', error);
        showToast('Failed to adjust balance', 'error');
    }
}

// Reset user password
async function resetUserPassword(userId) {
    try {
        const newPassword = document.getElementById(`newPassword-${userId}`).value;
        
        if (!newPassword || newPassword.length < 6) {
            showToast('Password must be at least 6 characters', 'warning');
            return;
        }
        
        // Update in Firebase if available
        if (typeof db !== 'undefined') {
            await db.collection('users').doc(userId).update({
                passwordResetRequired: false,
                updatedAt: new Date()
            });
        }
        
        document.getElementById(`newPassword-${userId}`).value = '';
        showToast('Password reset successfully', 'success');
    } catch (error) {
        console.error('Error resetting password:', error);
        showToast('Failed to reset password', 'error');
    }
}

// Toggle 2FA
async function toggle2FA(userId) {
    try {
        const user = allUsers.find(u => u.id === userId);
        if (!user) return;
        
        const currentStatus = user.twoFactorEnabled || false;
        user.twoFactorEnabled = !currentStatus;
        
        // Update in Firebase if available
        if (typeof db !== 'undefined') {
            await db.collection('users').doc(userId).update({
                twoFactorEnabled: !currentStatus,
                updatedAt: new Date()
            });
        }
        
        showToast(`2FA ${!currentStatus ? 'enabled' : 'disabled'} successfully`, 'success');
        toggleUserDetails(userId); // Refresh details
    } catch (error) {
        console.error('Error toggling 2FA:', error);
        showToast('Failed to toggle 2FA', 'error');
    }
}

// Edit user (placeholder)
function editUser(userId) {
    toggleUserDetails(userId);
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }
    
    try {
        // Delete from Firebase if available
        if (typeof db !== 'undefined') {
            await db.collection('users').doc(userId).delete();
        }
        
        // Remove from local data
        allUsers = allUsers.filter(user => user.id !== userId);
        filteredUsers = filteredUsers.filter(user => user.id !== userId);
        
        showToast('User deleted successfully', 'success');
        displayUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Failed to delete user', 'error');
    }
}

// Placeholder functions
function editTransaction(transactionId) {
    showToast('Transaction editing feature coming soon', 'info');
}

function deleteTransaction(transactionId) {
    showToast('Transaction deletion feature coming soon', 'info');
}

function editTrade(tradeId) {
    showToast('Trade editing feature coming soon', 'info');
}

function deleteTrade(tradeId) {
    showToast('Trade deletion feature coming soon', 'info');
}

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    const pagination = document.getElementById('pagination');
    
    if (!pagination) return;
    
    pagination.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            displayUsers();
        }
    };
    pagination.appendChild(prevButton);
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = i === currentPage ? 'active' : '';
        pageButton.onclick = () => {
            currentPage = i;
            displayUsers();
        };
        pagination.appendChild(pageButton);
    }
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayUsers();
        }
    };
    pagination.appendChild(nextButton);
}

// Show loading state
function showLoading(show) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    if (show) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading users...</td></tr>';
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeUserManagement);


// With your actual Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyC...",  // Your actual API key
    authDomain: "centraltradekeplr.firebaseapp.com",  // Your actual domain
    projectId: "centraltradekeplr",  // Your actual project ID
    storageBucket: "centraltradekeplr.appspot.com",
    messagingSenderId: "123456789",  // Your actual sender ID
    appId: "1:123456789:web:abc123def456"
};

// Add this at the top of your file
window.addEventListener('error', function(e) {
    if (e.message.includes('Could not establish connection') || 
        e.message.includes('message port closed')) {
        console.log('Browser extension conflict detected - continuing with local functionality');
        return true; // Prevent error from stopping execution
    }
});

// Wrap your Firebase initialization in try-catch
try {
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.firestore();
    console.log('Firebase initialized successfully');
} catch (error) {
    console.warn('Firebase initialization failed, using sample data:', error);
    // In your loadUsers function, make sure this fallback works
    async function loadUsers() {
        try {
            if (window.db) {
                // Try Firebase first
                const snapshot = await window.db.collection('users').get();
                // ... Firebase logic
            } else {
                throw new Error('Firebase not available');
            }
        } catch (error) {
            console.warn('Using sample data due to Firebase error:', error);
            // Use sample data
            window.usersData = [
                {
                    id: 'user1',
                    email: 'john.doe@example.com',
                    fullName: 'John Doe',
                    accountBalance: 5000.00,
                    status: 'active',
                    joinDate: '2024-01-15',
                    lastLogin: '2024-01-20'
                },
                // ... more sample users
            ];
            displayUsers(window.usersData);
            showToast('Using sample data - Firebase connection failed', 'warning');
        }
    }
    showLoading(false);
    
    // Show sample data if Firebase fails
    loadSampleData();
}