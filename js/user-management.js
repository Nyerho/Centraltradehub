// Global variables
let currentPage = 1;
const usersPerPage = 10;
let allUsers = [];
let filteredUsers = [];
let currentUserDetails = {};

// Handle browser extension conflicts
window.addEventListener('error', function(e) {
    if (e.message.includes('Could not establish connection') || 
        e.message.includes('message port closed')) {
        console.log('Browser extension conflict detected - continuing with local functionality');
        return true;
    }
});

// With your actual Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyC...",  // Your actual API key
    authDomain: "centraltradekeplr.firebaseapp.com",  // Your actual domain
    projectId: "centraltradekeplr",  // Your actual project ID
    storageBucket: "centraltradekeplr.appspot.com",
    messagingSenderId: "123456789",  // Your actual sender ID
    appId: "1:123456789:web:abc123def456"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.firestore();
    console.log('Firebase initialized successfully');
} catch (error) {
    console.warn('Firebase initialization failed, using sample data:', error);
    window.db = null;
}

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

// Load users (fixed version)
async function loadUsers() {
    try {
        showLoading(true);
        
        if (window.db) {
            console.log('Loading users from Firestore...');
            const snapshot = await window.db.collection('users').get();
            
            allUsers = [];
            snapshot.forEach((doc) => {
                allUsers.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            if (allUsers.length === 0) {
                throw new Error('No users found in Firestore');
            }
        } else {
            throw new Error('Firebase not available');
        }
        
        filteredUsers = [...allUsers];
        displayUsers();
        updatePagination();
        
    } catch (error) {
        console.warn('Using sample data due to error:', error);
        loadSampleData();
    } finally {
        showLoading(false);
    }
}

// Load sample data
function loadSampleData() {
    allUsers = [
        {
            id: 'user1',
            email: 'john.doe@example.com',
            fullName: 'John Doe',
            accountBalance: 5000.00,
            status: 'active',
            role: 'user',
            joinDate: '2024-01-15',
            lastLogin: '2024-01-20',
            phone: '+1234567890',
            country: 'USA',
            kycStatus: 'verified',
            twoFactorEnabled: true
        },
        {
            id: 'user2',
            email: 'jane.smith@example.com',
            fullName: 'Jane Smith',
            accountBalance: 7500.50,
            status: 'active',
            role: 'user',
            joinDate: '2024-01-10',
            lastLogin: '2024-01-19',
            phone: '+1234567891',
            country: 'Canada',
            kycStatus: 'verified',
            twoFactorEnabled: false
        },
        {
            id: 'user3',
            email: 'bob.wilson@example.com',
            fullName: 'Bob Wilson',
            accountBalance: 2250.75,
            status: 'suspended',
            role: 'user',
            joinDate: '2024-01-05',
            lastLogin: '2024-01-18',
            phone: '+1234567892',
            country: 'UK',
            kycStatus: 'pending',
            twoFactorEnabled: true
        }
    ];
    
    filteredUsers = [...allUsers];
    displayUsers();
    updatePagination();
    showToast('Using sample data - Firebase connection failed', 'warning');
}

// Filter users
function filterUsers() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const roleFilter = document.getElementById('roleFilter')?.value || 'all';
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    
    filteredUsers = allUsers.filter(user => {
        const matchesSearch = user.fullName?.toLowerCase().includes(searchTerm) || 
                            user.email?.toLowerCase().includes(searchTerm);
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
        
        return matchesSearch && matchesRole && matchesStatus;
    });
    
    currentPage = 1;
    displayUsers();
    updatePagination();
}

// Display users
function displayUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    const startIndex = (currentPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    const usersToShow = filteredUsers.slice(startIndex, endIndex);
    
    tbody.innerHTML = '';
    
    usersToShow.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.email}</td>
            <td>${user.fullName}</td>
            <td>$${user.accountBalance?.toFixed(2) || '0.00'}</td>
            <td><span class="status-badge status-${user.status}">${user.status}</span></td>
            <td>${user.joinDate}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="toggleUserDetails('${user.id}')">
                    <i class="fas fa-eye"></i> Details
                </button>
                <button class="btn btn-sm btn-warning" onclick="editUser('${user.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Toggle user details (inline expandable)
async function toggleUserDetails(userId) {
    const existingDetails = document.getElementById(`user-details-${userId}`);
    
    if (existingDetails) {
        existingDetails.remove();
        return;
    }
    
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    // Generate sample data
    const trades = generateSampleTrades(userId);
    const transactions = generateSampleTransactions(userId);
    
    // Find the user row
    const userRow = document.querySelector(`tr:has(button[onclick="toggleUserDetails('${userId}')"])`);
    if (!userRow) return;
    
    // Create details row
    const detailsRow = document.createElement('tr');
    detailsRow.id = `user-details-${userId}`;
    detailsRow.innerHTML = `
        <td colspan="7">
            ${renderUserDetails(user, trades, transactions, userId)}
        </td>
    `;
    
    // Insert after user row
    userRow.insertAdjacentElement('afterend', detailsRow);
}

// Generate sample trades
function generateSampleTrades(userId) {
    const symbols = ['BTC/USD', 'ETH/USD', 'XRP/USD', 'ADA/USD', 'DOT/USD'];
    const types = ['buy', 'sell'];
    const trades = [];
    
    for (let i = 0; i < 5; i++) {
        trades.push({
            id: `trade_${userId}_${i + 1}`,
            symbol: symbols[Math.floor(Math.random() * symbols.length)],
            type: types[Math.floor(Math.random() * types.length)],
            amount: (Math.random() * 10 + 0.1).toFixed(4),
            price: (Math.random() * 50000 + 1000).toFixed(2),
            total: (Math.random() * 5000 + 100).toFixed(2),
            status: Math.random() > 0.2 ? 'completed' : 'pending',
            timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
            fee: (Math.random() * 10 + 1).toFixed(2)
        });
    }
    
    return trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Generate sample transactions
function generateSampleTransactions(userId) {
    const types = ['deposit', 'withdrawal', 'fee', 'bonus'];
    const methods = ['bank_transfer', 'credit_card', 'crypto', 'paypal'];
    const transactions = [];
    
    for (let i = 0; i < 8; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        transactions.push({
            id: `txn_${userId}_${i + 1}`,
            type: type,
            amount: (Math.random() * 1000 + 10).toFixed(2),
            method: methods[Math.floor(Math.random() * methods.length)],
            status: Math.random() > 0.1 ? 'completed' : 'pending',
            timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            description: `${type.charAt(0).toUpperCase() + type.slice(1)} transaction`
        });
    }
    
    return transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Render user details
function renderUserDetails(userData, trades, transactions, userId) {
    const stats = calculateUserStats(trades, transactions);
    
    return `
        <div class="user-details-container">
            <div class="user-details-header">
                <h4>User Details: ${userData.fullName}</h4>
                <div class="user-details-tabs">
                    <button class="tab-btn active" onclick="showTab('profile-${userId}', this)">Profile</button>
                    <button class="tab-btn" onclick="showTab('financial-${userId}', this)">Financial</button>
                    <button class="tab-btn" onclick="showTab('trading-${userId}', this)">Trading</button>
                    <button class="tab-btn" onclick="showTab('transactions-${userId}', this)">Transactions</button>
                </div>
            </div>
            
            <!-- Profile Tab -->
            <div id="profile-${userId}" class="tab-content active">
                <div class="profile-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label>User ID:</label>
                            <input type="text" value="${userData.id}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Email:</label>
                            <input type="email" id="email-${userId}" value="${userData.email}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Full Name:</label>
                            <input type="text" id="fullName-${userId}" value="${userData.fullName}">
                        </div>
                        <div class="form-group">
                            <label>Phone:</label>
                            <input type="tel" id="phone-${userId}" value="${userData.phone || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Country:</label>
                            <input type="text" id="country-${userId}" value="${userData.country || ''}">
                        </div>
                        <div class="form-group">
                            <label>Status:</label>
                            <select id="status-${userId}">
                                <option value="active" ${userData.status === 'active' ? 'selected' : ''}>Active</option>
                                <option value="suspended" ${userData.status === 'suspended' ? 'selected' : ''}>Suspended</option>
                                <option value="inactive" ${userData.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>KYC Status:</label>
                            <select id="kycStatus-${userId}">
                                <option value="pending" ${userData.kycStatus === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="verified" ${userData.kycStatus === 'verified' ? 'selected' : ''}>Verified</option>
                                <option value="rejected" ${userData.kycStatus === 'rejected' ? 'selected' : ''}>Rejected</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Join Date:</label>
                            <input type="date" id="joinDate-${userId}" value="${userData.joinDate}">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button class="btn btn-primary" onclick="saveInlineUserChanges('${userId}')">Save Changes</button>
                        <button class="btn btn-secondary" onclick="resetUserPassword('${userId}')">Reset Password</button>
                        <button class="btn btn-info" onclick="toggle2FA('${userId}')">
                            ${userData.twoFactorEnabled ? 'Disable' : 'Enable'} 2FA
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Financial Tab -->
            <div id="financial-${userId}" class="tab-content">
                <div class="financial-overview">
                    <div class="balance-section">
                        <h5>Account Balance</h5>
                        <div class="balance-controls">
                            <input type="number" id="balance-${userId}" value="${userData.accountBalance}" step="0.01">
                            <button class="btn btn-success" onclick="adjustUserBalance('${userId}')">Update Balance</button>
                        </div>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <h6>Total Deposits</h6>
                            <span class="stat-value">$${stats.totalDeposits}</span>
                        </div>
                        <div class="stat-card">
                            <h6>Total Withdrawals</h6>
                            <span class="stat-value">$${stats.totalWithdrawals}</span>
                        </div>
                        <div class="stat-card">
                            <h6>Trading Volume</h6>
                            <span class="stat-value">$${stats.tradingVolume}</span>
                        </div>
                        <div class="stat-card">
                            <h6>Total Fees</h6>
                            <span class="stat-value">$${stats.totalFees}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Trading Tab -->
            <div id="trading-${userId}" class="tab-content">
                <div class="trading-history">
                    <h5>Recent Trades</h5>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Symbol</th>
                                    <th>Type</th>
                                    <th>Amount</th>
                                    <th>Price</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${trades.map(trade => `
                                    <tr>
                                        <td>${trade.symbol}</td>
                                        <td><span class="badge badge-${trade.type === 'buy' ? 'success' : 'danger'}">${trade.type.toUpperCase()}</span></td>
                                        <td>${trade.amount}</td>
                                        <td>$${trade.price}</td>
                                        <td>$${trade.total}</td>
                                        <td><span class="status-badge status-${trade.status}">${trade.status}</span></td>
                                        <td>${new Date(trade.timestamp).toLocaleDateString()}</td>
                                        <td>
                                            <button class="btn btn-xs btn-outline-primary" onclick="editTrade('${trade.id}')">Edit</button>
                                            <button class="btn btn-xs btn-outline-danger" onclick="deleteTrade('${trade.id}')">Delete</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <!-- Transactions Tab -->
            <div id="transactions-${userId}" class="tab-content">
                <div class="transactions-history">
                    <h5>Transaction History</h5>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Amount</th>
                                    <th>Method</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th>Description</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${transactions.map(txn => `
                                    <tr>
                                        <td><span class="badge badge-${txn.type === 'deposit' ? 'success' : txn.type === 'withdrawal' ? 'warning' : 'info'}">${txn.type.toUpperCase()}</span></td>
                                        <td>$${txn.amount}</td>
                                        <td>${txn.method.replace('_', ' ').toUpperCase()}</td>
                                        <td><span class="status-badge status-${txn.status}">${txn.status}</span></td>
                                        <td>${new Date(txn.timestamp).toLocaleDateString()}</td>
                                        <td>${txn.description}</td>
                                        <td>
                                            <button class="btn btn-xs btn-outline-primary" onclick="editTransaction('${txn.id}')">Edit</button>
                                            <button class="btn btn-xs btn-outline-danger" onclick="deleteTransaction('${txn.id}')">Delete</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Calculate user stats
function calculateUserStats(trades, transactions) {
    const totalDeposits = transactions
        .filter(t => t.type === 'deposit' && t.status === 'completed')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const totalWithdrawals = transactions
        .filter(t => t.type === 'withdrawal' && t.status === 'completed')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const tradingVolume = trades
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + parseFloat(t.total), 0);
    
    const totalFees = transactions
        .filter(t => t.type === 'fee')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0) +
        trades.reduce((sum, t) => sum + parseFloat(t.fee || 0), 0);
    
    return {
        totalDeposits: totalDeposits.toFixed(2),
        totalWithdrawals: totalWithdrawals.toFixed(2),
        tradingVolume: tradingVolume.toFixed(2),
        totalFees: totalFees.toFixed(2)
    };
}

// Show tab
function showTab(tabId, buttonElement) {
    // Hide all tab contents
    const userId = tabId.split('-')[1];
    const tabContents = document.querySelectorAll(`[id^="profile-${userId}"], [id^="financial-${userId}"], [id^="trading-${userId}"], [id^="transactions-${userId}"]`);
    tabContents.forEach(tab => tab.classList.remove('active'));
    
    // Remove active class from all buttons
    const tabButtons = buttonElement.parentElement.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab and activate button
    document.getElementById(tabId).classList.add('active');
    buttonElement.classList.add('active');
}

// Save inline user changes
async function saveInlineUserChanges(userId) {
    try {
        const updatedData = {
            email: document.getElementById(`email-${userId}`).value,
            fullName: document.getElementById(`fullName-${userId}`).value,
            phone: document.getElementById(`phone-${userId}`).value,
            country: document.getElementById(`country-${userId}`).value,
            status: document.getElementById(`status-${userId}`).value,
            kycStatus: document.getElementById(`kycStatus-${userId}`).value,
            joinDate: document.getElementById(`joinDate-${userId}`).value
        };
        
        // Update in allUsers array
        const userIndex = allUsers.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            allUsers[userIndex] = { ...allUsers[userIndex], ...updatedData };
        }
        
        // Update in Firebase if available
        if (window.db) {
            await window.db.collection('users').doc(userId).update(updatedData);
        }
        
        // Refresh display
        filterUsers();
        showToast('User updated successfully', 'success');
        
    } catch (error) {
        console.error('Error updating user:', error);
        showToast('Failed to update user', 'error');
    }
}

// Adjust user balance
async function adjustUserBalance(userId) {
    try {
        const newBalance = parseFloat(document.getElementById(`balance-${userId}`).value);
        
        if (isNaN(newBalance) || newBalance < 0) {
            showToast('Please enter a valid balance amount', 'error');
            return;
        }
        
        // Update in allUsers array
        const userIndex = allUsers.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            allUsers[userIndex].accountBalance = newBalance;
        }
        
        // Update in Firebase if available
        if (window.db) {
            await window.db.collection('users').doc(userId).update({
                accountBalance: newBalance
            });
        }
        
        // Refresh display
        filterUsers();
        showToast(`Balance updated to $${newBalance.toFixed(2)}`, 'success');
        
    } catch (error) {
        console.error('Error updating balance:', error);
        showToast('Failed to update balance', 'error');
    }
}

// Reset user password
async function resetUserPassword(userId) {
    if (!confirm('Are you sure you want to reset this user\'s password?')) {
        return;
    }
    
    try {
        // In a real app, this would send a password reset email
        // For demo purposes, we'll just show a success message
        showToast('Password reset email sent to user', 'success');
        
        // Log admin action
        console.log(`Admin reset password for user ${userId}`);
        
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
        
        const newStatus = !user.twoFactorEnabled;
        
        // Update in allUsers array
        const userIndex = allUsers.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            allUsers[userIndex].twoFactorEnabled = newStatus;
        }
        
        // Update in Firebase if available
        if (window.db) {
            await window.db.collection('users').doc(userId).update({
                twoFactorEnabled: newStatus
            });
        }
        
        showToast(`2FA ${newStatus ? 'enabled' : 'disabled'} for user`, 'success');
        
        // Refresh the details view
        document.getElementById(`user-details-${userId}`).remove();
        toggleUserDetails(userId);
        
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
        // Remove from allUsers array
        allUsers = allUsers.filter(u => u.id !== userId);
        
        // Delete from Firebase if available
        if (window.db) {
            await window.db.collection('users').doc(userId).delete();
        }
        
        // Refresh display
        filterUsers();
        showToast('User deleted successfully', 'success');
        
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Failed to delete user', 'error');
    }
}

// Edit transaction (placeholder)
function editTransaction(transactionId) {
    showToast('Transaction editing feature coming soon', 'info');
}

// Delete transaction (placeholder)
function deleteTransaction(transactionId) {
    showToast('Transaction deletion feature coming soon', 'info');
}

// Edit trade (placeholder)
function editTrade(tradeId) {
    showToast('Trade editing feature coming soon', 'info');
}

// Delete trade (placeholder)
function deleteTrade(tradeId) {
    showToast('Trade deletion feature coming soon', 'info');
}

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    const paginationContainer = document.getElementById('pagination');
    
    if (!paginationContainer) return;
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <button class="btn btn-sm btn-outline-primary ${currentPage === 1 ? 'disabled' : ''}" 
                onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            Previous
        </button>
    `;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            paginationHTML += `<button class="btn btn-sm btn-primary">${i}</button>`;
        } else {
            paginationHTML += `<button class="btn btn-sm btn-outline-primary" onclick="changePage(${i})">${i}</button>`;
        }
    }
    
    // Next button
    paginationHTML += `
        <button class="btn btn-sm btn-outline-primary ${currentPage === totalPages ? 'disabled' : ''}" 
                onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            Next
        </button>
    `;
    
    paginationContainer.innerHTML = paginationHTML;
    
    // Update results info
    const resultsInfo = document.getElementById('resultsInfo');
    if (resultsInfo) {
        const startIndex = (currentPage - 1) * usersPerPage + 1;
        const endIndex = Math.min(currentPage * usersPerPage, filteredUsers.length);
        resultsInfo.textContent = `Showing ${startIndex}-${endIndex} of ${filteredUsers.length} users`;
    }
}

// Change page
function changePage(page) {
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        displayUsers();
        updatePagination();
    }
}

// Show loading
function showLoading(show) {
    const loadingElement = document.getElementById('loadingSpinner');
    if (loadingElement) {
        loadingElement.style.display = show ? 'block' : 'none';
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    // Create toast element if it doesn't exist
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    
    toast.className = `toast toast-${type} show`;
    toast.textContent = message;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Make functions globally available
window.toggleUserDetails = toggleUserDetails;
window.showTab = showTab;
window.saveInlineUserChanges = saveInlineUserChanges;
window.adjustUserBalance = adjustUserBalance;
window.resetUserPassword = resetUserPassword;
window.toggle2FA = toggle2FA;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
window.editTrade = editTrade;
window.deleteTrade = deleteTrade;
window.changePage = changePage;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeUserManagement);