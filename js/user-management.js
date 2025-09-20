// Firebase imports
import { initializeApp } from 'firebase/app';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc, 
    deleteDoc, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    startAfter,
    serverTimestamp 
} from 'firebase/firestore';
import { 
    getAuth, 
    updatePassword, 
    deleteUser as deleteAuthUser,
    sendPasswordResetEmail 
} from 'firebase/auth';

// Global variables
let db;
let auth;
let currentPage = 1;
const usersPerPage = 10;
let allUsers = [];
let filteredUsers = [];
let currentUserDetails = {};

// Initialize Firebase and user management
async function initializeUserManagement() {
    try {
        // Initialize Firebase (assuming firebase-config.js sets up the app)
        if (typeof window.firebaseApp !== 'undefined') {
            db = getFirestore(window.firebaseApp);
            auth = getAuth(window.firebaseApp);
        } else {
            throw new Error('Firebase not initialized');
        }
        
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
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        
        allUsers = [];
        snapshot.forEach((doc) => {
            allUsers.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        filteredUsers = [...allUsers];
        displayUsers();
        showLoading(false);
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Failed to load users', 'error');
        showLoading(false);
    }
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
    
    usersToShow.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.email || 'N/A'}</td>
            <td>${user.fullName || 'N/A'}</td>
            <td><span class="badge badge-${user.role || 'user'}">${user.role || 'user'}</span></td>
            <td><span class="badge badge-${user.status || 'active'}">${user.status || 'active'}</span></td>
            <td>$${(user.balance || 0).toFixed(2)}</td>
            <td>${user.lastLogin ? new Date(user.lastLogin.toDate()).toLocaleDateString() : 'Never'}</td>
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
        // Load user details
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.data();
        
        // Load trading history
        const tradesRef = collection(db, 'trades');
        const tradesQuery = query(tradesRef, where('userId', '==', userId), orderBy('timestamp', 'desc'), limit(10));
        const tradesSnapshot = await getDocs(tradesQuery);
        const trades = [];
        tradesSnapshot.forEach(doc => {
            trades.push({ id: doc.id, ...doc.data() });
        });
        
        // Load financial history
        const transactionsRef = collection(db, 'transactions');
        const transactionsQuery = query(transactionsRef, where('userId', '==', userId), orderBy('timestamp', 'desc'), limit(10));
        const transactionsSnapshot = await getDocs(transactionsQuery);
        const transactions = [];
        transactionsSnapshot.forEach(doc => {
            transactions.push({ id: doc.id, ...doc.data() });
        });
        
        // Render details
        detailsContent.innerHTML = renderUserDetails(userData, trades, transactions, userId);
        
    } catch (error) {
        console.error('Error loading user details:', error);
        detailsContent.innerHTML = '<div class="error-message">Failed to load user details</div>';
    }
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
                    <div class="stat-value">${stats.totalDeposits}</div>
                    <div class="stat-label">Total Deposits</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.totalWithdrawals}</div>
                    <div class="stat-label">Total Withdrawals</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.netFlow}</div>
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
                            <td>${new Date(transaction.timestamp?.toDate()).toLocaleDateString()}</td>
                            <td>${transaction.type}</td>
                            <td>$${transaction.amount?.toFixed(2)}</td>
                            <td><span class="badge badge-${transaction.status}">${transaction.status}</span></td>
                            <td>
                                <button onclick="editTransaction('${transaction.id}')" class="btn btn-sm btn-primary">Edit</button>
                                <button onclick="deleteTransaction('${transaction.id}')" class="btn btn-sm btn-danger">Delete</button>
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
                            <td>${new Date(trade.timestamp?.toDate()).toLocaleDateString()}</td>
                            <td>${trade.symbol}</td>
                            <td>${trade.type}</td>
                            <td>${trade.size}</td>
                            <td>$${trade.entryPrice?.toFixed(2)}</td>
                            <td>$${trade.exitPrice?.toFixed(2) || 'Open'}</td>
                            <td class="${trade.pnl >= 0 ? 'text-success' : 'text-danger'}">$${trade.pnl?.toFixed(2)}</td>
                            <td>
                                <button onclick="editTrade('${trade.id}')" class="btn btn-sm btn-primary">Edit</button>
                                <button onclick="deleteTrade('${trade.id}')" class="btn btn-sm btn-danger">Delete</button>
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
                    <input type="text" value="${userData.lastLogin ? new Date(userData.lastLogin.toDate()).toLocaleString() : 'Never'}" readonly>
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
            updatedAt: serverTimestamp()
        };
        
        await updateDoc(doc(db, 'users', userId), updates);
        showToast('User updated successfully', 'success');
        await loadUsers(); // Refresh the table
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
        
        const userDoc = await getDoc(doc(db, 'users', userId));
        const currentBalance = userDoc.data().balance || 0;
        
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
        
        await updateDoc(doc(db, 'users', userId), {
            balance: newBalance,
            updatedAt: serverTimestamp()
        });
        
        // Log the transaction
        await addDoc(collection(db, 'transactions'), {
            userId: userId,
            type: 'admin_adjustment',
            amount: type === 'set' ? newBalance - currentBalance : (type === 'add' ? amount : -amount),
            status: 'completed',
            timestamp: serverTimestamp(),
            adminId: auth.currentUser?.uid,
            description: `Admin balance adjustment: ${type} ${amount}`
        });
        
        showToast('Balance updated successfully', 'success');
        toggleUserDetails(userId); // Refresh details
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
        
        // In a real implementation, you'd use Firebase Admin SDK
        // For now, we'll just update the password hash in Firestore
        const passwordHash = btoa(newPassword); // Simple base64 encoding (not secure for production)
        
        await updateDoc(doc(db, 'users', userId), {
            passwordHash: passwordHash,
            passwordResetRequired: false,
            updatedAt: serverTimestamp()
        });
        
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
        const userDoc = await getDoc(doc(db, 'users', userId));
        const currentStatus = userDoc.data().twoFactorEnabled || false;
        
        await updateDoc(doc(db, 'users', userId), {
            twoFactorEnabled: !currentStatus,
            updatedAt: serverTimestamp()
        });
        
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
        await deleteDoc(doc(db, 'users', userId));
        showToast('User deleted successfully', 'success');
        await loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Failed to delete user', 'error');
    }
}

// Edit transaction (placeholder)
function editTransaction(transactionId) {
    showToast('Transaction editing not implemented yet', 'info');
}

// Delete transaction (placeholder)
function deleteTransaction(transactionId) {
    showToast('Transaction deletion not implemented yet', 'info');
}

// Edit trade (placeholder)
function editTrade(tradeId) {
    showToast('Trade editing not implemented yet', 'info');
}

// Delete trade (placeholder)
function deleteTrade(tradeId) {
    showToast('Trade deletion not implemented yet', 'info');
}

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    const pagination = document.getElementById('pagination');
    
    if (!pagination) return;
    
    pagination.innerHTML = '';
    
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

// Make functions globally available
window.loadUsers = loadUsers;
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeUserManagement);