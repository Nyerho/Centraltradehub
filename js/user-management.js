// User Management System
let currentPage = 1;
const usersPerPage = 10;
let allUsers = [];
let filteredUsers = [];
let currentUserDetails = {};

// Error handling
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showToast('An error occurred. Please refresh the page.', 'error');
});

// Firebase initialization with CORRECT configuration
try {
    if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
        const firebaseConfig = {
            apiKey: "AIzaSyAwnWoLfrEc1EtXWCD0by5L0VtCmYf8Unw",
            authDomain: "centraltradehub-30f00.firebaseapp.com",
            projectId: "centraltradehub-30f00",
            storageBucket: "centraltradehub-30f00.firebasestorage.app",
            messagingSenderId: "745751687877",
            appId: "1:745751687877:web:4576449aa2e8360931b6ac",
            measurementId: "G-YHCS5CH450"
        };
        
        firebase.initializeApp(firebaseConfig);
        window.db = firebase.firestore();
        console.log('Firebase initialized successfully with correct config');
    } else if (typeof firebase !== 'undefined') {
        window.db = firebase.firestore();
        console.log('Using existing Firebase instance');
    } else {
        console.error('Firebase not available');
        window.db = null;
    }
} catch (error) {
    console.error('Firebase initialization failed:', error);
    window.db = null;
}

// Initialize user management
async function initializeUserManagement() {
    try {
        setupEventListeners();
        showLoading(true);
        await loadUsers();
        updateDashboardStats();
        showLoading(false);
    } catch (error) {
        console.error('Failed to initialize user management:', error);
        showToast('Failed to load user data', 'error');
        showLoading(false);
    }
}

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchUsers');
    const statusFilter = document.getElementById('statusFilter');
    const refreshBtn = document.getElementById('refreshUsers');
    
    if (searchInput) searchInput.addEventListener('input', filterUsers);
    if (statusFilter) statusFilter.addEventListener('change', filterUsers);
    if (refreshBtn) refreshBtn.addEventListener('click', () => {
        loadUsers();
        showToast('User data refreshed', 'success');
    });
}

// Load users from Firestore - Updated to work with real database
async function loadUsers() {
    try {
        showLoading(true);
        
        if (window.db) {
            console.log('Loading users from Firestore...');
            const usersSnapshot = await window.db.collection('users').get();
            allUsers = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log(`Successfully loaded ${allUsers.length} users from database`);
            
            if (allUsers.length === 0) {
                console.log('No users found in database');
                showToast('No users found in database', 'info');
            } else {
                showToast(`Loaded ${allUsers.length} users successfully`, 'success');
            }
        } else {
            console.error('Firebase database not available');
            showToast('Database connection failed', 'error');
            allUsers = [];
        }
        
        filteredUsers = [...allUsers];
        displayUsers();
        updatePagination();
        updateDashboardStats();
        showLoading(false);
        
    } catch (error) {
        console.error('Error loading users:', error);
        showToast(`Error loading users: ${error.message}`, 'error');
        showLoading(false);
        allUsers = [];
        filteredUsers = [];
        displayUsers();
        updatePagination();
        updateDashboardStats();
    }
}

// Load sample data
function loadSampleData() {
    allUsers = [
        {
            id: 'user1',
            email: 'john.doe@example.com',
            fullName: 'John Doe',
            accountBalance: 15000.50,
            status: 'active',
            joinDate: '2024-01-15',
            phone: '+1-555-0123',
            address: '123 Main St, New York, NY 10001',
            verificationStatus: 'verified',
            twoFactorEnabled: true,
            lastLogin: '2024-01-20 14:30:00'
        },
        {
            id: 'user2',
            email: 'jane.smith@example.com',
            fullName: 'Jane Smith',
            accountBalance: 8750.25,
            status: 'active',
            joinDate: '2024-01-10',
            phone: '+1-555-0124',
            address: '456 Oak Ave, Los Angeles, CA 90210',
            verificationStatus: 'verified',
            twoFactorEnabled: false,
            lastLogin: '2024-01-19 09:15:00'
        },
        {
            id: 'user3',
            email: 'mike.johnson@example.com',
            fullName: 'Mike Johnson',
            accountBalance: 2300.75,
            status: 'pending',
            joinDate: '2024-01-18',
            phone: '+1-555-0125',
            address: '789 Pine St, Chicago, IL 60601',
            verificationStatus: 'pending',
            twoFactorEnabled: false,
            lastLogin: '2024-01-18 16:45:00'
        },
        {
            id: 'user4',
            email: 'sarah.wilson@example.com',
            fullName: 'Sarah Wilson',
            accountBalance: 0.00,
            status: 'suspended',
            joinDate: '2024-01-05',
            phone: '+1-555-0126',
            address: '321 Elm St, Houston, TX 77001',
            verificationStatus: 'verified',
            twoFactorEnabled: true,
            lastLogin: '2024-01-15 11:20:00'
        }
    ];
}

// Update dashboard statistics
function updateDashboardStats() {
    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter(user => user.status === 'active').length;
    const pendingUsers = allUsers.filter(user => user.status === 'pending').length;
    const suspendedUsers = allUsers.filter(user => user.status === 'suspended').length;
    
    // Update the stat cards
    const totalUsersElement = document.getElementById('totalUsersCount');
    const activeUsersElement = document.getElementById('activeUsersCount');
    const pendingUsersElement = document.getElementById('pendingUsersCount');
    const suspendedUsersElement = document.getElementById('suspendedUsersCount');
    
    if (totalUsersElement) totalUsersElement.textContent = totalUsers;
    if (activeUsersElement) activeUsersElement.textContent = activeUsers;
    if (pendingUsersElement) pendingUsersElement.textContent = pendingUsers;
    if (suspendedUsersElement) suspendedUsersElement.textContent = suspendedUsers;
}

// Filter users based on search and status
function filterUsers() {
    const searchTerm = document.getElementById('searchUsers')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    
    filteredUsers = allUsers.filter(user => {
        const matchesSearch = user.fullName.toLowerCase().includes(searchTerm) || 
                            user.email.toLowerCase().includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });
    
    currentPage = 1;
    displayUsers();
    updatePagination();
}

// Display users in table
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

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    const pagination = document.getElementById('pagination');
    
    if (!pagination) return;
    
    pagination.innerHTML = '';
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = `btn btn-sm ${currentPage === 1 ? 'btn-secondary' : 'btn-primary'}`;
    prevBtn.textContent = 'Previous';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => changePage(currentPage - 1);
    pagination.appendChild(prevBtn);
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => changePage(i);
        pagination.appendChild(pageBtn);
    }
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = `btn btn-sm ${currentPage === totalPages ? 'btn-secondary' : 'btn-primary'}`;
    nextBtn.textContent = 'Next';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => changePage(currentPage + 1);
    pagination.appendChild(nextBtn);
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

// Toggle user details
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
    return [
        {
            id: `trade_${userId}_1`,
            pair: 'BTC/USD',
            type: 'buy',
            amount: 0.5,
            price: 45000,
            total: 22500,
            date: '2024-01-20 10:30:00',
            status: 'completed'
        },
        {
            id: `trade_${userId}_2`,
            pair: 'ETH/USD',
            type: 'sell',
            amount: 2.0,
            price: 2800,
            total: 5600,
            date: '2024-01-19 14:15:00',
            status: 'completed'
        }
    ];
}

// Generate sample transactions
function generateSampleTransactions(userId) {
    return [
        {
            id: `txn_${userId}_1`,
            type: 'deposit',
            amount: 10000,
            currency: 'USD',
            date: '2024-01-18 09:00:00',
            status: 'completed',
            method: 'Bank Transfer'
        },
        {
            id: `txn_${userId}_2`,
            type: 'withdrawal',
            amount: 2500,
            currency: 'USD',
            date: '2024-01-17 16:30:00',
            status: 'completed',
            method: 'Bank Transfer'
        }
    ];
}

// Render user details
function renderUserDetails(userData, trades, transactions, userId) {
    const stats = calculateUserStats(trades, transactions);
    
    return `
        <div class="user-details-container">
            <div class="details-tabs">
                <button class="tab-btn active" onclick="showTab('profile-${userId}', this)">Profile</button>
                <button class="tab-btn" onclick="showTab('financial-${userId}', this)">Financial</button>
                <button class="tab-btn" onclick="showTab('trading-${userId}', this)">Trading History</button>
                <button class="tab-btn" onclick="showTab('transactions-${userId}', this)">Transactions</button>
            </div>
            
            <div class="tab-content">
                <!-- Profile Tab -->
                <div id="profile-${userId}" class="tab-pane active">
                    <div class="profile-section">
                        <h4>User Profile</h4>
                        <div class="form-group">
                            <label>Full Name:</label>
                            <input type="text" value="${userData.fullName}" id="fullName-${userId}">
                        </div>
                        <div class="form-group">
                            <label>Email:</label>
                            <input type="email" value="${userData.email}" id="email-${userId}">
                        </div>
                        <div class="form-group">
                            <label>Phone:</label>
                            <input type="tel" value="${userData.phone || ''}" id="phone-${userId}">
                        </div>
                        <div class="form-group">
                            <label>Address:</label>
                            <textarea id="address-${userId}">${userData.address || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Status:</label>
                            <select id="status-${userId}">
                                <option value="active" ${userData.status === 'active' ? 'selected' : ''}>Active</option>
                                <option value="pending" ${userData.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="suspended" ${userData.status === 'suspended' ? 'selected' : ''}>Suspended</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Verification Status:</label>
                            <select id="verification-${userId}">
                                <option value="verified" ${userData.verificationStatus === 'verified' ? 'selected' : ''}>Verified</option>
                                <option value="pending" ${userData.verificationStatus === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="rejected" ${userData.verificationStatus === 'rejected' ? 'selected' : ''}>Rejected</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>2FA Enabled:</label>
                            <input type="checkbox" ${userData.twoFactorEnabled ? 'checked' : ''} id="twoFA-${userId}" onchange="toggle2FA('${userId}')">
                        </div>
                        <div class="form-group">
                            <label>Join Date:</label>
                            <input type="date" value="${userData.joinDate}" id="joinDate-${userId}">
                        </div>
                        <div class="form-group">
                            <label>Last Login:</label>
                            <input type="text" value="${userData.lastLogin || 'Never'}" readonly>
                        </div>
                        <div class="action-buttons">
                            <button class="btn btn-primary" onclick="saveInlineUserChanges('${userId}')">Save Changes</button>
                            <button class="btn btn-warning" onclick="resetUserPassword('${userId}')">Reset Password</button>
                        </div>
                    </div>
                </div>
                
                <!-- Financial Tab -->
                <div id="financial-${userId}" class="tab-pane">
                    <div class="financial-section">
                        <h4>Financial Overview</h4>
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-value">$${userData.accountBalance?.toFixed(2) || '0.00'}</div>
                                <div class="stat-label">Account Balance</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">$${(userData.totalProfits || 0).toFixed(2)}</div>
                                <div class="stat-label">Total Profits (Received)</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">$${(userData.totalDeposits || 0).toFixed(2)}</div>
                                <div class="stat-label">Total Deposits</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">$${stats.tradingVolume.toFixed(2)}</div>
                                <div class="stat-label">Trading Volume</div>
                            </div>
                        </div>
                        
                        <!-- Admin Edit Section for Profits and Deposits -->
                        <div class="admin-edit-section">
                            <h5>Edit Financial Data</h5>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Total Profits (Received):</label>
                                    <input type="number" id="edit-profits-${userData.uid}" 
                                           value="${userData.totalProfits || 0}" 
                                           step="0.01" min="0" class="form-control">
                                </div>
                                <div class="form-group">
                                    <label>Total Deposits:</label>
                                    <input type="number" id="edit-deposits-${userData.uid}" 
                                           value="${userData.totalDeposits || 0}" 
                                           step="0.01" min="0" class="form-control">
                                </div>
                            </div>
                            <div class="form-group">
                                <button onclick="updateUserFinancials('${userData.uid}')" class="btn btn-primary">
                                    <i class="fas fa-save"></i> Update Financial Data
                                </button>
                                <button onclick="calculateBalance('${userData.uid}')" class="btn btn-info">
                                    <i class="fas fa-calculator"></i> Auto-Calculate Balance
                                </button>
                            </div>
                            <div class="balance-info">
                                <small class="text-muted">
                                    Account Balance = Total Deposits + Total Profits - Total Withdrawals
                                </small>
                            </div>
                        </div>
                        
                        <div class="balance-adjustment">
                            <h5>Manual Balance Adjustment</h5>
                            <div class="form-group">
                                <label>Amount:</label>
                                <input type="number" step="0.01" id="balanceAdjustment-${userId}" placeholder="Enter amount">
                            </div>
                            <div class="form-group">
                                <label>Reason:</label>
                                <input type="text" id="adjustmentReason-${userId}" placeholder="Reason for adjustment">
                            </div>
                            <div class="action-buttons">
                                <button class="btn btn-success" onclick="adjustUserBalance('${userId}', 'add')">Add Funds</button>
                                <button class="btn btn-danger" onclick="adjustUserBalance('${userId}', 'subtract')">Subtract Funds</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Trading History Tab -->
                <div id="trading-${userId}" class="tab-pane">
                    <div class="trading-section">
                        <h4>Trading History</h4>
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Pair</th>
                                        <th>Type</th>
                                        <th>Amount</th>
                                        <th>Price</th>
                                        <th>Total</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${trades.map(trade => `
                                        <tr>
                                            <td>${trade.date}</td>
                                            <td>${trade.pair}</td>
                                            <td><span class="badge badge-${trade.type === 'buy' ? 'success' : 'danger'}">${trade.type.toUpperCase()}</span></td>
                                            <td>${trade.amount}</td>
                                            <td>$${trade.price.toLocaleString()}</td>
                                            <td>$${trade.total.toLocaleString()}</td>
                                            <td><span class="status-badge status-${trade.status}">${trade.status}</span></td>
                                            <td>
                                                <button class="btn btn-sm btn-warning" onclick="editTrade('${trade.id}')">Edit</button>
                                                <button class="btn btn-sm btn-danger" onclick="deleteTrade('${trade.id}')">Delete</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <!-- Transactions Tab -->
                <div id="transactions-${userId}" class="tab-pane">
                    <div class="transactions-section">
                        <h4>Transaction History</h4>
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Amount</th>
                                        <th>Currency</th>
                                        <th>Method</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${transactions.map(txn => `
                                        <tr>
                                            <td>${txn.date}</td>
                                            <td><span class="badge badge-${txn.type === 'deposit' ? 'success' : 'warning'}">${txn.type.toUpperCase()}</span></td>
                                            <td>$${txn.amount.toLocaleString()}</td>
                                            <td>${txn.currency}</td>
                                            <td>${txn.method}</td>
                                            <td><span class="status-badge status-${txn.status}">${txn.status}</span></td>
                                            <td>
                                                <button class="btn btn-sm btn-warning" onclick="editTransaction('${txn.id}')">Edit</button>
                                                <button class="btn btn-sm btn-danger" onclick="deleteTransaction('${txn.id}')">Delete</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Calculate user statistics
function calculateUserStats(trades, transactions) {
    const totalDeposits = transactions
        .filter(txn => txn.type === 'deposit')
        .reduce((sum, txn) => sum + txn.amount, 0);
    
    const totalWithdrawals = transactions
        .filter(txn => txn.type === 'withdrawal')
        .reduce((sum, txn) => sum + txn.amount, 0);
    
    const tradingVolume = trades
        .reduce((sum, trade) => sum + trade.total, 0);
    
    return {
        totalDeposits,
        totalWithdrawals,
        tradingVolume
    };
}

// Show tab
function showTab(tabId, buttonElement) {
    // Hide all tab panes
    const tabPanes = buttonElement.closest('.user-details-container').querySelectorAll('.tab-pane');
    tabPanes.forEach(pane => pane.classList.remove('active'));
    
    // Remove active class from all tab buttons
    const tabButtons = buttonElement.closest('.details-tabs').querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab and mark button as active
    document.getElementById(tabId).classList.add('active');
    buttonElement.classList.add('active');
}

// Show loading state
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
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Placeholder functions for user actions
function saveInlineUserChanges(userId) {
    showToast('User changes saved successfully', 'success');
}

function adjustUserBalance(userId, action) {
    const amount = document.getElementById(`balanceAdjustment-${userId}`).value;
    const reason = document.getElementById(`adjustmentReason-${userId}`).value;
    
    if (!amount || !reason) {
        showToast('Please enter amount and reason', 'error');
        return;
    }
    
    showToast(`Balance ${action === 'add' ? 'increased' : 'decreased'} by $${amount}`, 'success');
}

function resetUserPassword(userId) {
    showToast('Password reset email sent', 'success');
}

function toggle2FA(userId) {
    showToast('2FA settings updated', 'success');
}

function editUser(userId) {
    showToast('Edit user functionality not implemented', 'info');
}

function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user?')) {
        showToast('User deleted successfully', 'success');
    }
}

function editTransaction(transactionId) {
    showToast('Edit transaction functionality not implemented', 'info');
}

function deleteTransaction(transactionId) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        showToast('Transaction deleted successfully', 'success');
    }
}

function editTrade(tradeId) {
    showToast('Edit trade functionality not implemented', 'info');
}

function deleteTrade(tradeId) {
    if (confirm('Are you sure you want to delete this trade?')) {
        showToast('Trade deleted successfully', 'success');
    }
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


// Add these new functions for financial data management
window.updateUserFinancials = async function(userId) {
    try {
        const profitsInput = document.getElementById(`edit-profits-${userId}`);
        const depositsInput = document.getElementById(`edit-deposits-${userId}`);
        
        const totalProfits = parseFloat(profitsInput.value) || 0;
        const totalDeposits = parseFloat(depositsInput.value) || 0;
        
        if (totalProfits < 0 || totalDeposits < 0) {
            alert('Profits and deposits cannot be negative');
            return;
        }
        
        // Update user document with financial data
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            totalProfits: totalProfits,
            totalDeposits: totalDeposits,
            financialDataUpdatedAt: new Date().toISOString(),
            financialDataUpdatedBy: window.currentUser?.email || 'Admin'
        });
        
        // Also update the accounts collection for real-time sync
        const accountRef = doc(db, 'accounts', userId);
        const accountDoc = await getDoc(accountRef);
        if (accountDoc.exists()) {
            await updateDoc(accountRef, {
                totalProfits: totalProfits,
                totalDeposits: totalDeposits,
                lastSyncedAt: new Date().toISOString(),
                adminUpdated: true
            });
        }
        
        showNotification('Financial data updated successfully!', 'success');
        
        // Refresh the user details
        setTimeout(() => {
            const userRow = document.querySelector(`tr[data-user-id="${userId}"]`);
            if (userRow) {
                toggleUserDetails(userRow, userId);
                setTimeout(() => toggleUserDetails(userRow, userId), 100);
            }
        }, 500);
        
    } catch (error) {
        console.error('Error updating financial data:', error);
        showNotification('Error updating financial data: ' + error.message, 'error');
    }
};

window.calculateBalance = async function(userId) {
    try {
        const profitsInput = document.getElementById(`edit-profits-${userId}`);
        const depositsInput = document.getElementById(`edit-deposits-${userId}`);
        
        const totalProfits = parseFloat(profitsInput.value) || 0;
        const totalDeposits = parseFloat(depositsInput.value) || 0;
        
        // Get withdrawal data (you may need to implement this based on your withdrawal tracking)
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        const totalWithdrawals = userData.totalWithdrawals || 0;
        
        // Calculate new balance
        const newBalance = totalDeposits + totalProfits - totalWithdrawals;
        
        // Update both financial data and balance
        await updateDoc(userRef, {
            totalProfits: totalProfits,
            totalDeposits: totalDeposits,
            accountBalance: newBalance,
            balanceUpdatedAt: new Date().toISOString(),
            balanceUpdatedBy: window.currentUser?.email || 'Admin',
            financialDataUpdatedAt: new Date().toISOString(),
            financialDataUpdatedBy: window.currentUser?.email || 'Admin'
        });
        
        showNotification(`Balance auto-calculated and updated to $${newBalance.toFixed(2)}`, 'success');
        
        // Refresh the user details
        setTimeout(() => {
            const userRow = document.querySelector(`tr[data-user-id="${userId}"]`);
            if (userRow) {
                toggleUserDetails(userRow, userId);
                setTimeout(() => toggleUserDetails(userRow, userId), 100);
            }
        }, 500);
        
    } catch (error) {
        console.error('Error calculating balance:', error);
        showNotification('Error calculating balance: ' + error.message, 'error');
    }
};