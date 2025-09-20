// User Management Functions
import { db } from './firebase-config.js';
import { 
    collection, 
    doc, 
    getDocs, 
    getDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    startAfter 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, 
    updatePassword, 
    deleteUser as deleteAuthUser 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Global variables
let currentUsers = [];
let currentPage = 1;
let usersPerPage = 10;
let totalUsers = 0;
let selectedUserId = null;

// Initialize user management
async function initializeUserManagement() {
    try {
        console.log('Initializing user management...');
        await loadUsers();
        setupEventListeners();
        console.log('User management initialized successfully');
    } catch (error) {
        console.error('Error initializing user management:', error);
        showToast('Error initializing user management: ' + error.message, 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    document.getElementById('userSearch').addEventListener('input', debounce(searchUsers, 300));
    
    // Filter functionality
    document.getElementById('statusFilter').addEventListener('change', filterUsers);
    document.getElementById('roleFilter').addEventListener('change', filterUsers);
}

// Load users from database
async function loadUsers(searchTerm = '', statusFilter = 'all', roleFilter = 'all') {
    try {
        const database = window.db || db;
        if (!database) {
            throw new Error('Database not available');
        }

        // Build query
        let usersQuery = collection(database, 'users');
        
        // Apply filters
        if (statusFilter !== 'all') {
            usersQuery = query(usersQuery, where('status', '==', statusFilter));
        }
        
        if (roleFilter !== 'all') {
            usersQuery = query(usersQuery, where('role', '==', roleFilter));
        }
        
        // Order by registration date
        usersQuery = query(usersQuery, orderBy('registrationDate', 'desc'));
        
        const querySnapshot = await getDocs(usersQuery);
        currentUsers = [];
        
        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            currentUsers.push({
                id: doc.id,
                ...userData
            });
        });
        
        // Apply search filter if provided
        if (searchTerm) {
            currentUsers = currentUsers.filter(user => 
                user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.id.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        totalUsers = currentUsers.length;
        displayUsers();
        updatePagination();
        
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Error loading users: ' + error.message, 'error');
    }
}

// Display users in table
function displayUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    const startIndex = (currentPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    const usersToShow = currentUsers.slice(startIndex, endIndex);
    
    usersToShow.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.email || 'N/A'}</td>
            <td>${user.fullName || 'N/A'}</td>
            <td><span class="status-badge status-${user.status || 'pending'}">${(user.status || 'pending').toUpperCase()}</span></td>
            <td><span class="role-badge role-${user.role || 'user'}">${(user.role || 'user').toUpperCase()}</span></td>
            <td>${user.registrationDate ? new Date(user.registrationDate).toLocaleDateString() : 'N/A'}</td>
            <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</td>
            <td>
                <div class="action-buttons">
                    <button onclick="viewUserDetails('${user.id}')" class="btn-primary btn-sm"><i class="fas fa-eye"></i></button>
                    <button onclick="editUser('${user.id}')" class="btn-secondary btn-sm"><i class="fas fa-edit"></i></button>
                    <button onclick="toggleUserStatus('${user.id}')" class="btn-warning btn-sm"><i class="fas fa-ban"></i></button>
                    <button onclick="confirmDeleteUser('${user.id}')" class="btn-danger btn-sm"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Search users
function searchUsers() {
    const searchTerm = document.getElementById('userSearch').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const roleFilter = document.getElementById('roleFilter').value;
    
    currentPage = 1;
    loadUsers(searchTerm, statusFilter, roleFilter);
}

// Filter users
function filterUsers() {
    searchUsers();
}

// Refresh user list
function refreshUserList() {
    document.getElementById('userSearch').value = '';
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('roleFilter').value = 'all';
    currentPage = 1;
    loadUsers();
}

// View user details
async function viewUserDetails(userId) {
    try {
        selectedUserId = userId;
        const user = currentUsers.find(u => u.id === userId);
        
        if (!user) {
            throw new Error('User not found');
        }
        
        // Populate modal with user data
        document.getElementById('modalUserId').value = user.id;
        document.getElementById('modalUserEmail').value = user.email || '';
        document.getElementById('modalUserName').value = user.fullName || '';
        document.getElementById('modalUserPhone').value = user.phone || '';
        document.getElementById('modalUserCountry').value = user.country || '';
        document.getElementById('modalRegDate').value = user.registrationDate ? new Date(user.registrationDate).toLocaleString() : 'N/A';
        document.getElementById('modalBalance').value = user.balance || 0;
        document.getElementById('modalKycStatus').value = user.kycStatus || 'pending';
        document.getElementById('modalPasswordHash').value = user.passwordHash || 'N/A';
        document.getElementById('modal2FA').value = user.twoFactorEnabled ? 'enabled' : 'disabled';
        document.getElementById('modalLoginAttempts').value = user.loginAttempts || 0;
        document.getElementById('modalUserStatus').value = user.status || 'pending';
        document.getElementById('modalUserRole').value = user.role || 'user';
        
        // Load trading history
        await loadUserTradingHistory(userId);
        
        // Show modal
        document.getElementById('userDetailsModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error viewing user details:', error);
        showToast('Error loading user details: ' + error.message, 'error');
    }
}

// Load user trading history
async function loadUserTradingHistory(userId) {
    try {
        const database = window.db || db;
        const tradesQuery = query(
            collection(database, 'trades'),
            where('userId', '==', userId),
            orderBy('timestamp', 'desc')
        );
        
        const querySnapshot = await getDocs(tradesQuery);
        const trades = [];
        let totalVolume = 0;
        let totalPnL = 0;
        
        querySnapshot.forEach((doc) => {
            const trade = doc.data();
            trades.push({
                id: doc.id,
                ...trade
            });
            totalVolume += trade.amount || 0;
            totalPnL += trade.pnl || 0;
        });
        
        // Update stats
        document.getElementById('totalTrades').textContent = trades.length;
        document.getElementById('totalVolume').textContent = `$${totalVolume.toFixed(2)}`;
        document.getElementById('totalPnL').textContent = `$${totalPnL.toFixed(2)}`;
        document.getElementById('totalPnL').style.color = totalPnL >= 0 ? '#28a745' : '#dc3545';
        
        // Populate trading history table
        const tbody = document.getElementById('tradingHistoryBody');
        tbody.innerHTML = '';
        
        trades.forEach(trade => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${trade.timestamp ? new Date(trade.timestamp).toLocaleDateString() : 'N/A'}</td>
                <td>${trade.symbol || 'N/A'}</td>
                <td>${trade.type || 'N/A'}</td>
                <td>$${(trade.amount || 0).toFixed(2)}</td>
                <td>$${(trade.price || 0).toFixed(5)}</td>
                <td style="color: ${(trade.pnl || 0) >= 0 ? '#28a745' : '#dc3545'}">$${(trade.pnl || 0).toFixed(2)}</td>
                <td><span class="status-badge status-${trade.status || 'pending'}">${(trade.status || 'pending').toUpperCase()}</span></td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading trading history:', error);
        showToast('Error loading trading history: ' + error.message, 'error');
    }
}

// Edit user
function editUser(userId) {
    viewUserDetails(userId);
}

// Save user changes
async function saveUserChanges() {
    try {
        if (!selectedUserId) {
            throw new Error('No user selected');
        }
        
        const database = window.db || db;
        const userRef = doc(database, 'users', selectedUserId);
        
        const updatedData = {
            email: document.getElementById('modalUserEmail').value,
            fullName: document.getElementById('modalUserName').value,
            phone: document.getElementById('modalUserPhone').value,
            country: document.getElementById('modalUserCountry').value,
            balance: parseFloat(document.getElementById('modalBalance').value) || 0,
            kycStatus: document.getElementById('modalKycStatus').value,
            twoFactorEnabled: document.getElementById('modal2FA').value === 'enabled',
            status: document.getElementById('modalUserStatus').value,
            role: document.getElementById('modalUserRole').value,
            lastModified: new Date().toISOString(),
            modifiedBy: window.currentUser?.email || 'admin'
        };
        
        await updateDoc(userRef, updatedData);
        
        showToast('User updated successfully!', 'success');
        closeUserModal();
        refreshUserList();
        
    } catch (error) {
        console.error('Error saving user changes:', error);
        showToast('Error saving changes: ' + error.message, 'error');
    }
}

// Reset user password
async function resetUserPassword() {
    try {
        const newPassword = document.getElementById('modalNewPassword').value;
        
        if (!newPassword || newPassword.length < 6) {
            throw new Error('Password must be at least 6 characters long');
        }
        
        if (!selectedUserId) {
            throw new Error('No user selected');
        }
        
        // Update password hash in database
        const database = window.db || db;
        const userRef = doc(database, 'users', selectedUserId);
        
        // In a real implementation, you would hash the password properly
        const passwordHash = btoa(newPassword); // Simple base64 encoding for demo
        
        await updateDoc(userRef, {
            passwordHash: passwordHash,
            passwordResetRequired: true,
            lastPasswordReset: new Date().toISOString(),
            resetBy: window.currentUser?.email || 'admin'
        });
        
        document.getElementById('modalNewPassword').value = '';
        document.getElementById('modalPasswordHash').value = passwordHash;
        
        showToast('Password reset successfully!', 'success');
        
    } catch (error) {
        console.error('Error resetting password:', error);
        showToast('Error resetting password: ' + error.message, 'error');
    }
}

// Reset login attempts
async function resetLoginAttempts() {
    try {
        if (!selectedUserId) {
            throw new Error('No user selected');
        }
        
        const database = window.db || db;
        const userRef = doc(database, 'users', selectedUserId);
        
        await updateDoc(userRef, {
            loginAttempts: 0,
            lastLoginAttemptReset: new Date().toISOString(),
            resetBy: window.currentUser?.email || 'admin'
        });
        
        document.getElementById('modalLoginAttempts').value = 0;
        
        showToast('Login attempts reset successfully!', 'success');
        
    } catch (error) {
        console.error('Error resetting login attempts:', error);
        showToast('Error resetting login attempts: ' + error.message, 'error');
    }
}

// Update user status
async function updateUserStatus() {
    try {
        if (!selectedUserId) {
            throw new Error('No user selected');
        }
        
        const newStatus = document.getElementById('modalUserStatus').value;
        const database = window.db || db;
        const userRef = doc(database, 'users', selectedUserId);
        
        await updateDoc(userRef, {
            status: newStatus,
            statusUpdated: new Date().toISOString(),
            statusUpdatedBy: window.currentUser?.email || 'admin'
        });
        
        showToast(`User status updated to ${newStatus}!`, 'success');
        refreshUserList();
        
    } catch (error) {
        console.error('Error updating user status:', error);
        showToast('Error updating status: ' + error.message, 'error');
    }
}

// Update user role
async function updateUserRole() {
    try {
        if (!selectedUserId) {
            throw new Error('No user selected');
        }
        
        const newRole = document.getElementById('modalUserRole').value;
        const database = window.db || db;
        const userRef = doc(database, 'users', selectedUserId);
        
        await updateDoc(userRef, {
            role: newRole,
            roleUpdated: new Date().toISOString(),
            roleUpdatedBy: window.currentUser?.email || 'admin'
        });
        
        showToast(`User role updated to ${newRole}!`, 'success');
        refreshUserList();
        
    } catch (error) {
        console.error('Error updating user role:', error);
        showToast('Error updating role: ' + error.message, 'error');
    }
}

// Suspend user
async function suspendUser() {
    if (confirm('Are you sure you want to suspend this user?')) {
        document.getElementById('modalUserStatus').value = 'suspended';
        await updateUserStatus();
    }
}

// Activate user
async function activateUser() {
    document.getElementById('modalUserStatus').value = 'active';
    await updateUserStatus();
}

// Toggle user status
async function toggleUserStatus(userId) {
    try {
        const user = currentUsers.find(u => u.id === userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        const newStatus = user.status === 'active' ? 'suspended' : 'active';
        const database = window.db || db;
        const userRef = doc(database, 'users', userId);
        
        await updateDoc(userRef, {
            status: newStatus,
            statusUpdated: new Date().toISOString(),
            statusUpdatedBy: window.currentUser?.email || 'admin'
        });
        
        showToast(`User ${newStatus === 'active' ? 'activated' : 'suspended'} successfully!`, 'success');
        refreshUserList();
        
    } catch (error) {
        console.error('Error toggling user status:', error);
        showToast('Error updating user status: ' + error.message, 'error');
    }
}

// Confirm delete user
function confirmDeleteUser(userId) {
    const user = currentUsers.find(u => u.id === userId);
    if (user && confirm(`Are you sure you want to delete user ${user.email}? This action cannot be undone.`)) {
        deleteUser(userId);
    }
}

// Delete user
async function deleteUser(userId) {
    try {
        const database = window.db || db;
        
        // Delete user document
        await deleteDoc(doc(database, 'users', userId));
        
        // Delete user's trades
        const tradesQuery = query(collection(database, 'trades'), where('userId', '==', userId));
        const tradesSnapshot = await getDocs(tradesQuery);
        
        const deletePromises = [];
        tradesSnapshot.forEach((doc) => {
            deletePromises.push(deleteDoc(doc.ref));
        });
        
        await Promise.all(deletePromises);
        
        showToast('User deleted successfully!', 'success');
        refreshUserList();
        
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Error deleting user: ' + error.message, 'error');
    }
}

// Add trade record
function addTradeRecord() {
    if (!selectedUserId) {
        showToast('Please select a user first', 'error');
        return;
    }
    
    // Set current date/time
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('tradeDate').value = now.toISOString().slice(0, 16);
    
    document.getElementById('addTradeModal').style.display = 'block';
}

// Save trade record
async function saveTradeRecord() {
    try {
        if (!selectedUserId) {
            throw new Error('No user selected');
        }
        
        const tradeData = {
            userId: selectedUserId,
            symbol: document.getElementById('tradeSymbol').value,
            type: document.getElementById('tradeType').value,
            amount: parseFloat(document.getElementById('tradeAmount').value) || 0,
            entryPrice: parseFloat(document.getElementById('tradeEntryPrice').value) || 0,
            exitPrice: parseFloat(document.getElementById('tradeExitPrice').value) || 0,
            pnl: parseFloat(document.getElementById('tradePnL').value) || 0,
            timestamp: new Date(document.getElementById('tradeDate').value).toISOString(),
            status: document.getElementById('tradeStatus').value,
            addedBy: window.currentUser?.email || 'admin',
            addedAt: new Date().toISOString()
        };
        
        const database = window.db || db;
        const tradeRef = doc(collection(database, 'trades'));
        
        await setDoc(tradeRef, tradeData);
        
        showToast('Trade record added successfully!', 'success');
        closeAddTradeModal();
        
        // Reload trading history
        await loadUserTradingHistory(selectedUserId);
        
    } catch (error) {
        console.error('Error saving trade record:', error);
        showToast('Error saving trade record: ' + error.message, 'error');
    }
}

// Export trading history
function exportTradingHistory() {
    if (!selectedUserId) {
        showToast('Please select a user first', 'error');
        return;
    }
    
    // Get trading history data
    const table = document.getElementById('tradingHistoryBody');
    const rows = table.querySelectorAll('tr');
    
    let csvContent = 'Date,Symbol,Type,Amount,Price,P&L,Status\n';
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const rowData = Array.from(cells).map(cell => cell.textContent.trim()).join(',');
        csvContent += rowData + '\n';
    });
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading_history_${selectedUserId}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showToast('Trading history exported successfully!', 'success');
}

// Send user email
function sendUserEmail() {
    if (!selectedUserId) {
        showToast('Please select a user first', 'error');
        return;
    }
    
    const user = currentUsers.find(u => u.id === selectedUserId);
    if (user && user.email) {
        window.open(`mailto:${user.email}?subject=Central Trade Hub - Account Notice`);
    } else {
        showToast('User email not available', 'error');
    }
}

// View user logs
function viewUserLogs() {
    if (!selectedUserId) {
        showToast('Please select a user first', 'error');
        return;
    }
    
    showToast('User activity logs feature coming soon!', 'info');
}

// Modal functions
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

function closeUserModal() {
    document.getElementById('userDetailsModal').style.display = 'none';
    selectedUserId = null;
}

function closeAddTradeModal() {
    document.getElementById('addTradeModal').style.display = 'none';
    
    // Clear form
    document.getElementById('tradeSymbol').value = '';
    document.getElementById('tradeAmount').value = '';
    document.getElementById('tradeEntryPrice').value = '';
    document.getElementById('tradeExitPrice').value = '';
    document.getElementById('tradePnL').value = '';
    document.getElementById('tradeDate').value = '';
}

// Pagination functions
function changePage(direction) {
    const totalPages = Math.ceil(totalUsers / usersPerPage);
    
    if (direction === 1 && currentPage < totalPages) {
        currentPage++;
    } else if (direction === -1 && currentPage > 1) {
        currentPage--;
    }
    
    displayUsers();
    updatePagination();
}

function updatePagination() {
    const totalPages = Math.ceil(totalUsers / usersPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export functions to global scope
window.initializeUserManagement = initializeUserManagement;
window.searchUsers = searchUsers;
window.filterUsers = filterUsers;
window.refreshUserList = refreshUserList;
window.viewUserDetails = viewUserDetails;
window.editUser = editUser;
window.saveUserChanges = saveUserChanges;
window.resetUserPassword = resetUserPassword;
window.resetLoginAttempts = resetLoginAttempts;
window.updateUserStatus = updateUserStatus;
window.updateUserRole = updateUserRole;
window.suspendUser = suspendUser;
window.activateUser = activateUser;
window.deleteUser = deleteUser;
window.toggleUserStatus = toggleUserStatus;
window.confirmDeleteUser = confirmDeleteUser;
window.addTradeRecord = addTradeRecord;
window.saveTradeRecord = saveTradeRecord;
window.exportTradingHistory = exportTradingHistory;
window.sendUserEmail = sendUserEmail;
window.viewUserLogs = viewUserLogs;
window.showTab = showTab;
window.closeUserModal = closeUserModal;
window.closeAddTradeModal = closeAddTradeModal;
window.changePage = changePage;