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

        // Build query - Remove orderBy to avoid issues with missing fields
        let usersQuery = collection(database, 'users');
        
        // Apply filters
        if (statusFilter !== 'all') {
            usersQuery = query(usersQuery, where('status', '==', statusFilter));
        }
        
        if (roleFilter !== 'all') {
            usersQuery = query(usersQuery, where('role', '==', roleFilter));
        }
        
        const querySnapshot = await getDocs(usersQuery);
        currentUsers = [];
        
        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            currentUsers.push({
                id: doc.id,
                ...userData
            });
        });
        
        // Sort by registration date if available, otherwise by email
        currentUsers.sort((a, b) => {
            if (a.registrationDate && b.registrationDate) {
                return new Date(b.registrationDate) - new Date(a.registrationDate);
            }
            return (a.email || '').localeCompare(b.email || '');
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
        console.log(`Loaded ${totalUsers} users`);
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
                    <button onclick="toggleUserDetails('${user.id}')" class="btn-primary btn-sm"><i class="fas fa-eye"></i> Details</button>
                    <button onclick="toggleUserStatus('${user.id}')" class="btn-warning btn-sm"><i class="fas fa-ban"></i></button>
                    <button onclick="confirmDeleteUser('${user.id}')" class="btn-danger btn-sm"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
        
        // Add details row (initially hidden)
        const detailsRow = document.createElement('tr');
        detailsRow.id = `details-${user.id}`;
        detailsRow.className = 'user-details-row';
        detailsRow.style.display = 'none';
        detailsRow.innerHTML = `
            <td colspan="8">
                <div class="user-details-container" id="container-${user.id}">
                    <div class="loading">Loading user details...</div>
                </div>
            </td>
        `;
        tbody.appendChild(detailsRow);
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

// Replace the viewUserDetails function with toggleUserDetails
async function toggleUserDetails(userId) {
    const detailsRow = document.getElementById(`details-${userId}`);
    const container = document.getElementById(`container-${userId}`);
    
    if (detailsRow.style.display === 'none') {
        // Show details
        detailsRow.style.display = 'table-row';
        selectedUserId = userId;
        
        try {
            const database = window.db || db;
            const userRef = doc(database, 'users', userId);
            const userDoc = await getDoc(userRef);
            
            if (!userDoc.exists()) {
                throw new Error('User not found');
            }
            
            const userData = userDoc.data();
            
            // Load financial and trading data
            const [financialData, tradingHistory] = await Promise.all([
                loadUserFinancialDataInline(userId),
                loadUserTradingHistoryInline(userId)
            ]);
            
            // Create inline details interface
            container.innerHTML = createUserDetailsInterface(userId, userData, financialData, tradingHistory);
            
            // Show profile tab by default
            showInlineTab('profile', userId);
            
        } catch (error) {
            console.error('Error loading user details:', error);
            container.innerHTML = `<div class="error">Error loading user details: ${error.message}</div>`;
        }
    } else {
        // Hide details
        detailsRow.style.display = 'none';
        selectedUserId = null;
    }
}

// Create the user details interface
function createUserDetailsInterface(userId, userData, financialData, tradingHistory) {
    return `
        <div class="details-tabs">
            <button class="tab-button active" onclick="showInlineTab('profile', '${userId}')">Profile</button>
            <button class="tab-button" onclick="showInlineTab('security', '${userId}')">Security</button>
            <button class="tab-button" onclick="showInlineTab('financial', '${userId}')">Financial</button>
            <button class="tab-button" onclick="showInlineTab('trading', '${userId}')">Trading History</button>
        </div>
        
        <!-- Profile Tab -->
        <div id="profile-${userId}" class="tab-content active">
            <div class="form-grid">
                <div class="form-group">
                    <label>User ID</label>
                    <input type="text" value="${userId}" readonly class="form-control">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="email-${userId}" value="${userData.email || ''}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="fullName-${userId}" value="${userData.fullName || userData.displayName || ''}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="text" id="phone-${userId}" value="${userData.phone || ''}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Country</label>
                    <input type="text" id="country-${userId}" value="${userData.country || ''}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Address</label>
                    <input type="text" id="address-${userId}" value="${userData.address || ''}" class="form-control">
                </div>
                <div class="form-group">
                    <label>City</label>
                    <input type="text" id="city-${userId}" value="${userData.city || ''}" class="form-control">
                </div>
                <div class="form-group">
                    <label>ZIP Code</label>
                    <input type="text" id="zipCode-${userId}" value="${userData.zipCode || ''}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Birth Date</label>
                    <input type="date" id="birthdate-${userId}" value="${userData.birthdate || ''}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Gender</label>
                    <select id="gender-${userId}" class="form-control">
                        <option value="">Select Gender</option>
                        <option value="male" ${userData.gender === 'male' ? 'selected' : ''}>Male</option>
                        <option value="female" ${userData.gender === 'female' ? 'selected' : ''}>Female</option>
                        <option value="other" ${userData.gender === 'other' ? 'selected' : ''}>Other</option>
                        <option value="prefer_not_to_say" ${userData.gender === 'prefer_not_to_say' ? 'selected' : ''}>Prefer not to say</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Occupation</label>
                    <input type="text" id="occupation-${userId}" value="${userData.occupation || ''}" class="form-control">
                </div>
                <div class="form-group">
                    <label>KYC Status</label>
                    <select id="kycStatus-${userId}" class="form-control">
                        <option value="pending" ${userData.kycStatus === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="verified" ${userData.kycStatus === 'verified' ? 'selected' : ''}>Verified</option>
                        <option value="rejected" ${userData.kycStatus === 'rejected' ? 'selected' : ''}>Rejected</option>
                    </select>
                </div>
                <div class="form-group full-width">
                    <label>Admin Notes</label>
                    <textarea id="adminNotes-${userId}" class="form-control" rows="3" placeholder="Internal notes about this user...">${userData.adminNotes || ''}</textarea>
                </div>
            </div>
            <div class="inline-actions">
                <button onclick="saveInlineUserChanges('${userId}')" class="btn-primary"><i class="fas fa-save"></i> Save Changes</button>
                <button onclick="toggleUserDetails('${userId}')" class="btn-secondary"><i class="fas fa-times"></i> Close</button>
            </div>
        </div>
        
        <!-- Security Tab -->
        <div id="security-${userId}" class="tab-content">
            <div class="form-grid">
                <div class="form-group">
                    <label>Current Password Hash</label>
                    <input type="text" value="${userData.passwordHash || 'Not available'}" readonly class="form-control">
                </div>
                <div class="form-group">
                    <label>Reset Password</label>
                    <div class="balance-input-group">
                        <input type="password" id="newPassword-${userId}" placeholder="Enter new password" class="form-control">
                        <button onclick="resetInlineUserPassword('${userId}')" class="btn-warning"><i class="fas fa-key"></i> Reset</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>2FA Status</label>
                    <input type="text" value="${userData.twoFactorEnabled ? 'Enabled' : 'Disabled'}" readonly class="form-control">
                </div>
                <div class="form-group">
                    <label>Login Attempts</label>
                    <div class="balance-input-group">
                        <input type="text" value="${userData.loginAttempts || 0}" readonly class="form-control">
                        <button onclick="resetInlineLoginAttempts('${userId}')" class="btn-secondary"><i class="fas fa-refresh"></i> Reset</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>Account Status</label>
                    <select id="status-${userId}" class="form-control">
                        <option value="active" ${userData.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="suspended" ${userData.status === 'suspended' ? 'selected' : ''}>Suspended</option>
                        <option value="pending" ${userData.status === 'pending' ? 'selected' : ''}>Pending</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>User Role</label>
                    <select id="role-${userId}" class="form-control">
                        <option value="user" ${userData.role === 'user' ? 'selected' : ''}>User</option>
                        <option value="admin" ${userData.role === 'admin' ? 'selected' : ''}>Admin</option>
                        <option value="premium" ${userData.role === 'premium' ? 'selected' : ''}>Premium</option>
                    </select>
                </div>
            </div>
            <div class="inline-actions">
                <button onclick="saveInlineUserChanges('${userId}')" class="btn-primary"><i class="fas fa-save"></i> Save Security Settings</button>
            </div>
        </div>
        
        <!-- Financial Tab -->
        <div id="financial-${userId}" class="tab-content">
            <div class="balance-controls">
                <div class="form-group">
                    <label>Current Balance</label>
                    <div class="balance-input-group">
                        <input type="number" id="balance-${userId}" value="${userData.balance || 0}" class="form-control" step="0.01">
                        <button onclick="updateInlineUserBalance('${userId}')" class="btn-primary"><i class="fas fa-save"></i> Update</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>Balance Adjustment</label>
                    <div class="balance-input-group">
                        <input type="number" id="adjustment-${userId}" class="form-control" step="0.01" placeholder="Enter amount">
                        <select id="adjustmentType-${userId}" class="form-control">
                            <option value="add">Add</option>
                            <option value="subtract">Subtract</option>
                        </select>
                        <button onclick="adjustInlineUserBalance('${userId}')" class="btn-warning"><i class="fas fa-calculator"></i> Adjust</button>
                    </div>
                </div>
            </div>
            
            <h4>Deposit History</h4>
            <div id="deposits-${userId}">${createTransactionTable(financialData.deposits, 'deposit', userId)}</div>
            
            <h4>Withdrawal History</h4>
            <div id="withdrawals-${userId}">${createTransactionTable(financialData.withdrawals, 'withdrawal', userId)}</div>
            
            <div class="inline-actions">
                <button onclick="addInlineTransaction('${userId}', 'deposit')" class="btn-success"><i class="fas fa-plus"></i> Add Deposit</button>
                <button onclick="addInlineTransaction('${userId}', 'withdrawal')" class="btn-warning"><i class="fas fa-minus"></i> Add Withdrawal</button>
            </div>
        </div>
        
        <!-- Trading History Tab -->
        <div id="trading-${userId}" class="tab-content">
            <div class="trading-stats">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Total Trades</label>
                        <input type="text" value="${tradingHistory.totalTrades || 0}" readonly class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Total Volume</label>
                        <input type="text" value="$${(tradingHistory.totalVolume || 0).toFixed(2)}" readonly class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Total Profit/Loss</label>
                        <input type="text" value="$${(tradingHistory.totalPnL || 0).toFixed(2)}" readonly class="form-control">
                    </div>
                </div>
            </div>
            
            <h4>Recent Trades</h4>
            <div id="trades-${userId}">${createTradingTable(tradingHistory.trades, userId)}</div>
            
            <div class="inline-actions">
                <button onclick="addInlineTradeRecord('${userId}')" class="btn-success"><i class="fas fa-plus"></i> Add Trade Record</button>
                <button onclick="exportInlineTradingHistory('${userId}')" class="btn-secondary"><i class="fas fa-download"></i> Export History</button>
            </div>
        </div>
    `;
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

// Helper function to create transaction table
function createTransactionTable(transactions, type, userId) {
    if (!transactions || transactions.length === 0) {
        return `<p>No ${type} records found.</p>`;
    }
    
    let html = `<table class="transactions-table">
        <thead>
            <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Reference</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>`;
    
    transactions.forEach(transaction => {
        html += `<tr>
            <td>${new Date(transaction.date).toLocaleDateString()}</td>
            <td>$${transaction.amount.toFixed(2)}</td>
            <td>${transaction.method || 'N/A'}</td>
            <td><span class="status-badge status-${transaction.status}">${transaction.status.toUpperCase()}</span></td>
            <td>${transaction.reference || 'N/A'}</td>
            <td>
                <button onclick="editInlineTransaction('${transaction.id}', '${type}', '${userId}')" class="btn-sm btn-secondary"><i class="fas fa-edit"></i></button>
                <button onclick="deleteInlineTransaction('${transaction.id}', '${type}', '${userId}')" class="btn-sm btn-danger"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    
    html += `</tbody></table>`;
    return html;
}

// Helper function to create trading table
function createTradingTable(trades, userId) {
    if (!trades || trades.length === 0) {
        return `<p>No trading records found.</p>`;
    }
    
    let html = `<table class="transactions-table">
        <thead>
            <tr>
                <th>Date</th>
                <th>Symbol</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Price</th>
                <th>P&L</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>`;
    
    trades.forEach(trade => {
        html += `<tr>
            <td>${new Date(trade.date).toLocaleDateString()}</td>
            <td>${trade.symbol}</td>
            <td><span class="status-badge status-${trade.type}">${trade.type.toUpperCase()}</span></td>
            <td>${trade.amount}</td>
            <td>$${trade.price.toFixed(2)}</td>
            <td class="${trade.pnl >= 0 ? 'text-success' : 'text-danger'}">$${trade.pnl.toFixed(2)}</td>
            <td>
                <button onclick="editInlineTrade('${trade.id}', '${userId}')" class="btn-sm btn-secondary"><i class="fas fa-edit"></i></button>
                <button onclick="deleteInlineTrade('${trade.id}', '${userId}')" class="btn-sm btn-danger"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    
    html += `</tbody></table>`;
    return html;
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
            // Basic profile information
            email: document.getElementById('modalUserEmail').value,
            fullName: document.getElementById('modalUserName').value,
            phone: document.getElementById('modalUserPhone').value,
            country: document.getElementById('modalUserCountry').value,
            balance: parseFloat(document.getElementById('modalBalance').value) || 0,
            kycStatus: document.getElementById('modalKycStatus').value,
            
            // Enhanced profile fields
            address: document.getElementById('modalUserAddress').value,
            city: document.getElementById('modalUserCity').value,
            zipCode: document.getElementById('modalUserZip').value,
            birthdate: document.getElementById('modalUserBirthdate').value,
            gender: document.getElementById('modalUserGender').value,
            occupation: document.getElementById('modalUserOccupation').value,
            annualIncome: document.getElementById('modalUserIncome').value,
            tradingExperience: document.getElementById('modalUserExperience').value,
            riskTolerance: document.getElementById('modalUserRiskTolerance').value,
            adminNotes: document.getElementById('modalUserNotes').value,
            
            // Security settings
            twoFactorEnabled: document.getElementById('modal2FA').value === 'enabled',
            status: document.getElementById('modalUserStatus').value,
            role: document.getElementById('modalUserRole').value,
            
            // Audit fields
            lastModified: new Date().toISOString(),
            modifiedBy: window.currentUser?.email || 'admin'
        };
        
        await updateDoc(userRef, updatedData);
        
        showToast('User profile updated successfully!', 'success');
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
        
        if (!newPassword || newPassword.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }
        
        // Validate password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
        if (!passwordRegex.test(newPassword)) {
            throw new Error('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
        }
        
        if (!selectedUserId) {
            throw new Error('No user selected');
        }
        
        const database = window.db || db;
        const userRef = doc(database, 'users', selectedUserId);
        
        // Generate a more secure password hash (in production, use proper bcrypt or similar)
        const passwordHash = await hashPassword(newPassword);
        
        await updateDoc(userRef, {
            passwordHash: passwordHash,
            passwordResetRequired: true,
            lastPasswordReset: new Date().toISOString(),
            resetBy: window.currentUser?.email || 'admin',
            passwordStrength: calculatePasswordStrength(newPassword)
        });
        
        // Clear the password field
        document.getElementById('modalNewPassword').value = '';
        document.getElementById('modalPasswordHash').value = passwordHash;
        
        // Log the password reset action
        await logAdminAction('password_reset', selectedUserId, {
            resetBy: window.currentUser?.email || 'admin',
            timestamp: new Date().toISOString()
        });
        
        showToast('Password reset successfully! User will be required to change password on next login.', 'success');
        
    } catch (error) {
        console.error('Error resetting password:', error);
        showToast('Error resetting password: ' + error.message, 'error');
    }
}

// Helper function to hash password (simplified for demo)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'salt_' + Date.now());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper function to calculate password strength
function calculatePasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[@$!%*?&]/.test(password)) strength++;
    
    if (strength <= 2) return 'weak';
    if (strength <= 4) return 'medium';
    return 'strong';
}

// Function to log admin actions for audit trail
async function logAdminAction(action, targetUserId, details = {}) {
    try {
        const database = window.db || db;
        const logRef = doc(collection(database, 'admin_logs'));
        
        await setDoc(logRef, {
            action: action,
            targetUserId: targetUserId,
            adminId: window.currentUser?.uid || 'unknown',
            adminEmail: window.currentUser?.email || 'unknown',
            timestamp: new Date().toISOString(),
            details: details,
            ipAddress: await getUserIP() // Optional: get user IP
        });
    } catch (error) {
        console.error('Error logging admin action:', error);
    }
}

// Helper function to get user IP (optional)
async function getUserIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        return 'unknown';
    }
}

// Function to view user activity logs
async function viewUserLogs() {
    try {
        if (!selectedUserId) {
            throw new Error('No user selected');
        }
        
        const database = window.db || db;
        const logsQuery = query(
            collection(database, 'admin_logs'),
            where('targetUserId', '==', selectedUserId),
            orderBy('timestamp', 'desc'),
            limit(50)
        );
        
        const querySnapshot = await getDocs(logsQuery);
        const logs = [];
        
        querySnapshot.forEach((doc) => {
            logs.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Display logs in a new modal or tab
        displayUserLogs(logs);
        
    } catch (error) {
        console.error('Error loading user logs:', error);
        showToast('Error loading user activity logs: ' + error.message, 'error');
    }
}

// Function to display user logs
function displayUserLogs(logs) {
    let logHtml = '<div class="user-logs-container">';
    logHtml += '<h3>User Activity Logs</h3>';
    
    if (logs.length === 0) {
        logHtml += '<p>No activity logs found for this user.</p>';
    } else {
        logHtml += '<table class="logs-table">';
        logHtml += '<thead><tr><th>Date</th><th>Action</th><th>Admin</th><th>Details</th></tr></thead>';
        logHtml += '<tbody>';
        
        logs.forEach(log => {
            logHtml += `<tr>
                <td>${new Date(log.timestamp).toLocaleString()}</td>
                <td>${log.action}</td>
                <td>${log.adminEmail}</td>
                <td>${JSON.stringify(log.details || {})}</td>
            </tr>`;
        });
        
        logHtml += '</tbody></table>';
    }
    
    logHtml += '</div>';
    
    // Show in a new modal or replace current tab content
    const actionsTab = document.getElementById('actionsTab');
    actionsTab.innerHTML = logHtml + actionsTab.innerHTML;
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
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
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

// Add the missing showToast function
function showToast(message, type = 'info') {
    // Create toast element if it doesn't exist
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}
window.showToast = showToast;
window.changePage = changePage;

// Tab switching for inline details
function showInlineTab(tabName, userId) {
    // Hide all tabs for this user
    const tabs = ['profile', 'security', 'financial', 'trading'];
    tabs.forEach(tab => {
        const tabContent = document.getElementById(`${tab}-${userId}`);
        if (tabContent) {
            tabContent.classList.remove('active');
        }
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(`${tabName}-${userId}`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Update tab buttons
    const container = document.getElementById(`container-${userId}`);
    const tabButtons = container.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.classList.remove('active');
        if (button.textContent.toLowerCase().includes(tabName)) {
            button.classList.add('active');
        }
    });
}

// Save user changes inline
async function saveInlineUserChanges(userId) {
    try {
        const database = window.db || db;
        const userRef = doc(database, 'users', userId);
        
        const updateData = {
            email: document.getElementById(`email-${userId}`).value,
            fullName: document.getElementById(`fullName-${userId}`).value,
            phone: document.getElementById(`phone-${userId}`).value,
            country: document.getElementById(`country-${userId}`).value,
            address: document.getElementById(`address-${userId}`).value,
            city: document.getElementById(`city-${userId}`).value,
            zipCode: document.getElementById(`zipCode-${userId}`).value,
            birthdate: document.getElementById(`birthdate-${userId}`).value,
            gender: document.getElementById(`gender-${userId}`).value,
            occupation: document.getElementById(`occupation-${userId}`).value,
            kycStatus: document.getElementById(`kycStatus-${userId}`).value,
            adminNotes: document.getElementById(`adminNotes-${userId}`).value,
            status: document.getElementById(`status-${userId}`).value,
            role: document.getElementById(`role-${userId}`).value,
            lastModified: new Date().toISOString()
        };
        
        await updateDoc(userRef, updateData);
        
        // Log admin action
        await logAdminAction('user_updated', userId, updateData);
        
        showToast('User details updated successfully!', 'success');
        
        // Refresh the user list to show updated data
        await loadUsers();
        
    } catch (error) {
        console.error('Error saving user changes:', error);
        showToast('Error saving user changes: ' + error.message, 'error');
    }
}

// Load financial data for inline display
async function loadUserFinancialDataInline(userId) {
    try {
        const database = window.db || db;
        
        // Load deposits
        const depositsQuery = query(
            collection(database, 'deposits'),
            where('userId', '==', userId),
            orderBy('date', 'desc'),
            limit(20)
        );
        
        // Load withdrawals
        const withdrawalsQuery = query(
            collection(database, 'withdrawals'),
            where('userId', '==', userId),
            orderBy('date', 'desc'),
            limit(20)
        );
        
        const [depositsSnapshot, withdrawalsSnapshot] = await Promise.all([
            getDocs(depositsQuery),
            getDocs(withdrawalsQuery)
        ]);
        
        const deposits = [];
        const withdrawals = [];
        
        depositsSnapshot.forEach(doc => {
            deposits.push({ id: doc.id, ...doc.data() });
        });
        
        withdrawalsSnapshot.forEach(doc => {
            withdrawals.push({ id: doc.id, ...doc.data() });
        });
        
        return { deposits, withdrawals };
        
    } catch (error) {
        console.error('Error loading financial data:', error);
        return { deposits: [], withdrawals: [] };
    }
}

// Load trading history for inline display
async function loadUserTradingHistoryInline(userId) {
    try {
        const database = window.db || db;
        const tradesQuery = query(
            collection(database, 'trades'),
            where('userId', '==', userId),
            orderBy('date', 'desc'),
            limit(50)
        );
        
        const querySnapshot = await getDocs(tradesQuery);
        const trades = [];
        let totalVolume = 0;
        let totalPnL = 0;
        
        querySnapshot.forEach((doc) => {
            const trade = { id: doc.id, ...doc.data() };
            trades.push(trade);
            totalVolume += trade.amount * trade.price;
            totalPnL += trade.pnl || 0;
        });
        
        return {
            trades,
            totalTrades: trades.length,
            totalVolume,
            totalPnL
        };
        
    } catch (error) {
        console.error('Error loading trading history:', error);
        return {
            trades: [],
            totalTrades: 0,
            totalVolume: 0,
            totalPnL: 0
        };
    }
}

// Additional inline functions for password reset, balance updates, etc.
async function resetInlineUserPassword(userId) {
    const newPassword = document.getElementById(`newPassword-${userId}`).value;
    if (!newPassword) {
        showToast('Please enter a new password', 'error');
        return;
    }
    
    try {
        const hashedPassword = await hashPassword(newPassword);
        const database = window.db || db;
        const userRef = doc(database, 'users', userId);
        
        await updateDoc(userRef, {
            passwordHash: hashedPassword,
            passwordResetRequired: false,
            lastPasswordChange: new Date().toISOString()
        });
        
        await logAdminAction('password_reset', userId, { adminReset: true });
        
        document.getElementById(`newPassword-${userId}`).value = '';
        showToast('Password reset successfully!', 'success');
        
    } catch (error) {
        console.error('Error resetting password:', error);
        showToast('Error resetting password: ' + error.message, 'error');
    }
}

async function updateInlineUserBalance(userId) {
    const newBalance = parseFloat(document.getElementById(`balance-${userId}`).value);
    if (isNaN(newBalance)) {
        showToast('Please enter a valid balance amount', 'error');
        return;
    }
    
    try {
        const database = window.db || db;
        const userRef = doc(database, 'users', userId);
        
        await updateDoc(userRef, {
            balance: newBalance,
            lastBalanceUpdate: new Date().toISOString()
        });
        
        await logAdminAction('balance_updated', userId, { newBalance });
        
        showToast('Balance updated successfully!', 'success');
        
    } catch (error) {
        console.error('Error updating balance:', error);
        showToast('Error updating balance: ' + error.message, 'error');
    }
}

// Make functions globally available
window.toggleUserDetails = toggleUserDetails;
window.showInlineTab = showInlineTab;
window.saveInlineUserChanges = saveInlineUserChanges;
window.resetInlineUserPassword = resetInlineUserPassword;
window.updateInlineUserBalance = updateInlineUserBalance;

// Global variables for transaction management
let currentEditingTransaction = null;
let currentTransactionType = null;

// Enhanced viewUserDetails function with financial data
async function viewUserDetails(userId) {
    try {
        selectedUserId = userId;
        const database = window.db || db;
        const userRef = doc(database, 'users', userId);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
            throw new Error('User not found');
        }
        
        const userData = userDoc.data();
        
        // Populate all profile fields
        document.getElementById('modalUserId').value = userId;
        document.getElementById('modalUserEmail').value = userData.email || '';
        document.getElementById('modalUserName').value = userData.fullName || userData.displayName || '';
        document.getElementById('modalUserPhone').value = userData.phone || '';
        document.getElementById('modalUserCountry').value = userData.country || '';
        document.getElementById('modalUserAddress').value = userData.address || '';
        document.getElementById('modalUserCity').value = userData.city || '';
        document.getElementById('modalUserZip').value = userData.zipCode || '';
        document.getElementById('modalUserBirthdate').value = userData.birthdate || '';
        document.getElementById('modalUserGender').value = userData.gender || '';
        document.getElementById('modalUserOccupation').value = userData.occupation || '';
        document.getElementById('modalRegDate').value = userData.registrationDate ? 
            new Date(userData.registrationDate).toLocaleDateString() : 'N/A';
        document.getElementById('modalBalance').value = userData.balance || 0;
        document.getElementById('modalKycStatus').value = userData.kycStatus || 'pending';
        document.getElementById('modalUserNotes').value = userData.adminNotes || '';
        
        // Security fields
        document.getElementById('modalPasswordHash').value = userData.passwordHash || 'Not available';
        document.getElementById('modal2FA').value = userData.twoFactorEnabled ? 'enabled' : 'disabled';
        document.getElementById('modalLoginAttempts').value = userData.loginAttempts || 0;
        
        // Status and role
        document.getElementById('modalUserStatus').value = userData.status || 'active';
        document.getElementById('modalUserRole').value = userData.role || 'user';
        
        // Load financial data
        await loadUserFinancialData(userId);
        
        // Load trading history
        await loadUserTradingHistory(userId);
        
        // Show modal
        document.getElementById('userDetailsModal').style.display = 'block';
        showTab('profile');
        
    } catch (error) {
        console.error('Error viewing user details:', error);
        showToast('Error loading user details: ' + error.message, 'error');
    }
}

// Load user financial data (deposits, withdrawals, adjustments)
async function loadUserFinancialData(userId) {
    try {
        const database = window.db || db;
        
        // Load deposits
        const depositsQuery = query(
            collection(database, 'deposits'),
            where('userId', '==', userId),
            orderBy('timestamp', 'desc')
        );
        const depositsSnapshot = await getDocs(depositsQuery);
        const deposits = [];
        depositsSnapshot.forEach((doc) => {
            deposits.push({ id: doc.id, ...doc.data() });
        });
        displayTransactions('deposits', deposits);
        
        // Load withdrawals
        const withdrawalsQuery = query(
            collection(database, 'withdrawals'),
            where('userId', '==', userId),
            orderBy('timestamp', 'desc')
        );
        const withdrawalsSnapshot = await getDocs(withdrawalsQuery);
        const withdrawals = [];
        withdrawalsSnapshot.forEach((doc) => {
            withdrawals.push({ id: doc.id, ...doc.data() });
        });
        displayTransactions('withdrawals', withdrawals);
        
        // Load balance adjustments
        const adjustmentsQuery = query(
            collection(database, 'balance_adjustments'),
            where('userId', '==', userId),
            orderBy('timestamp', 'desc')
        );
        const adjustmentsSnapshot = await getDocs(adjustmentsQuery);
        const adjustments = [];
        adjustmentsSnapshot.forEach((doc) => {
            adjustments.push({ id: doc.id, ...doc.data() });
        });
        displayTransactions('adjustments', adjustments);
        
    } catch (error) {
        console.error('Error loading financial data:', error);
        showToast('Error loading financial data: ' + error.message, 'error');
    }
}

// Display transactions in the appropriate table
function displayTransactions(type, transactions) {
    const tbody = document.getElementById(`${type}TableBody`);
    tbody.innerHTML = '';
    
    transactions.forEach(transaction => {
        const row = document.createElement('tr');
        
        if (type === 'adjustments') {
            row.innerHTML = `
                <td>${transaction.timestamp ? new Date(transaction.timestamp).toLocaleString() : 'N/A'}</td>
                <td class="${transaction.type === 'add' ? 'text-success' : 'text-danger'}">
                    ${transaction.type === 'add' ? '+' : '-'}$${Math.abs(transaction.amount || 0).toFixed(2)}
                </td>
                <td><span class="badge badge-${transaction.type === 'add' ? 'success' : 'warning'}">${transaction.type || 'N/A'}</span></td>
                <td>${transaction.reason || 'N/A'}</td>
                <td>${transaction.adminEmail || 'N/A'}</td>
                <td>
                    <button onclick="editTransaction('${transaction.id}', 'adjustments')" class="btn-sm btn-primary"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteTransaction('${transaction.id}', 'adjustments')" class="btn-sm btn-danger"><i class="fas fa-trash"></i></button>
                </td>
            `;
        } else {
            row.innerHTML = `
                <td>${transaction.timestamp ? new Date(transaction.timestamp).toLocaleString() : 'N/A'}</td>
                <td>$${(transaction.amount || 0).toFixed(2)}</td>
                <td>${transaction.method || 'N/A'}</td>
                <td><span class="status-badge status-${transaction.status || 'pending'}">${(transaction.status || 'pending').toUpperCase()}</span></td>
                <td>${transaction.reference || 'N/A'}</td>
                <td>${transaction.notes || 'N/A'}</td>
                <td>
                    <button onclick="editTransaction('${transaction.id}', '${type}')" class="btn-sm btn-primary"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteTransaction('${transaction.id}', '${type}')" class="btn-sm btn-danger"><i class="fas fa-trash"></i></button>
                </td>
            `;
        }
        
        tbody.appendChild(row);
    });
}

// Update user balance
async function updateUserBalance() {
    try {
        if (!selectedUserId) {
            throw new Error('No user selected');
        }
        
        const newBalance = parseFloat(document.getElementById('modalBalance').value) || 0;
        
        const database = window.db || db;
        const userRef = doc(database, 'users', selectedUserId);
        
        await updateDoc(userRef, {
            balance: newBalance,
            lastModified: new Date().toISOString(),
            modifiedBy: window.currentUser?.email || 'admin'
        });
        
        // Log the balance update
        await logAdminAction('balance_update', selectedUserId, {
            newBalance: newBalance,
            updatedBy: window.currentUser?.email || 'admin'
        });
        
        showToast('Balance updated successfully!', 'success');
        refreshUserList();
        
    } catch (error) {
        console.error('Error updating balance:', error);
        showToast('Error updating balance: ' + error.message, 'error');
    }
}

// Adjust user balance (add or subtract)
async function adjustUserBalance() {
    try {
        if (!selectedUserId) {
            throw new Error('No user selected');
        }
        
        const adjustmentAmount = parseFloat(document.getElementById('balanceAdjustment').value);
        const adjustmentType = document.getElementById('adjustmentType').value;
        const reason = document.getElementById('adjustmentReason').value;
        
        if (!adjustmentAmount || adjustmentAmount <= 0) {
            throw new Error('Please enter a valid adjustment amount');
        }
        
        if (!reason.trim()) {
            throw new Error('Please provide a reason for the adjustment');
        }
        
        const currentBalance = parseFloat(document.getElementById('modalBalance').value) || 0;
        const newBalance = adjustmentType === 'add' ? 
            currentBalance + adjustmentAmount : 
            currentBalance - adjustmentAmount;
        
        if (newBalance < 0) {
            throw new Error('Adjustment would result in negative balance');
        }
        
        const database = window.db || db;
        
        // Update user balance
        const userRef = doc(database, 'users', selectedUserId);
        await updateDoc(userRef, {
            balance: newBalance,
            lastModified: new Date().toISOString(),
            modifiedBy: window.currentUser?.email || 'admin'
        });
        
        // Record the adjustment
        const adjustmentRef = doc(collection(database, 'balance_adjustments'));
        await setDoc(adjustmentRef, {
            userId: selectedUserId,
            amount: adjustmentType === 'add' ? adjustmentAmount : -adjustmentAmount,
            type: adjustmentType,
            reason: reason,
            previousBalance: currentBalance,
            newBalance: newBalance,
            timestamp: new Date().toISOString(),
            adminId: window.currentUser?.uid || 'unknown',
            adminEmail: window.currentUser?.email || 'admin'
        });
        
        // Update UI
        document.getElementById('modalBalance').value = newBalance.toFixed(2);
        document.getElementById('balanceAdjustment').value = '';
        document.getElementById('adjustmentReason').value = '';
        
        // Reload financial data
        await loadUserFinancialData(selectedUserId);
        
        showToast(`Balance ${adjustmentType === 'add' ? 'increased' : 'decreased'} by $${adjustmentAmount.toFixed(2)}`, 'success');
        refreshUserList();
        
    } catch (error) {
        console.error('Error adjusting balance:', error);
        showToast('Error adjusting balance: ' + error.message, 'error');
    }
}

// Add deposit record
function addDepositRecord() {
    currentEditingTransaction = null;
    currentTransactionType = 'deposit';
    
    // Clear form
    document.getElementById('depositAmount').value = '';
    document.getElementById('depositMethod').value = '';
    document.getElementById('depositStatus').value = 'completed';
    document.getElementById('depositReference').value = '';
    document.getElementById('depositDate').value = new Date().toISOString().slice(0, 16);
    document.getElementById('depositNotes').value = '';
    
    document.getElementById('depositModalTitle').textContent = 'Add Deposit Record';
    document.getElementById('depositModal').style.display = 'block';
}

// Add withdrawal record
function addWithdrawalRecord() {
    currentEditingTransaction = null;
    currentTransactionType = 'withdrawal';
    
    // Clear form
    document.getElementById('withdrawalAmount').value = '';
    document.getElementById('withdrawalMethod').value = '';
    document.getElementById('withdrawalStatus').value = 'completed';
    document.getElementById('withdrawalReference').value = '';
    document.getElementById('withdrawalDate').value = new Date().toISOString().slice(0, 16);
    document.getElementById('withdrawalNotes').value = '';
    
    document.getElementById('withdrawalModalTitle').textContent = 'Add Withdrawal Record';
    document.getElementById('withdrawalModal').style.display = 'block';
}

// Save deposit record
async function saveDepositRecord() {
    try {
        const amount = parseFloat(document.getElementById('depositAmount').value);
        const method = document.getElementById('depositMethod').value;
        const status = document.getElementById('depositStatus').value;
        const reference = document.getElementById('depositReference').value;
        const date = document.getElementById('depositDate').value;
        const notes = document.getElementById('depositNotes').value;
        
        if (!amount || amount <= 0) {
            throw new Error('Please enter a valid amount');
        }
        
        if (!method || !status || !date) {
            throw new Error('Please fill in all required fields');
        }
        
        const database = window.db || db;
        const depositData = {
            userId: selectedUserId,
            amount: amount,
            method: method,
            status: status,
            reference: reference,
            notes: notes,
            timestamp: new Date(date).toISOString(),
            createdBy: window.currentUser?.email || 'admin',
            createdAt: new Date().toISOString()
        };
        
        if (currentEditingTransaction) {
            // Update existing deposit
            const depositRef = doc(database, 'deposits', currentEditingTransaction);
            await updateDoc(depositRef, {
                ...depositData,
                updatedAt: new Date().toISOString(),
                updatedBy: window.currentUser?.email || 'admin'
            });
            showToast('Deposit record updated successfully!', 'success');
        } else {
            // Create new deposit
            const depositRef = doc(collection(database, 'deposits'));
            await setDoc(depositRef, depositData);
            showToast('Deposit record added successfully!', 'success');
        }
        
        closeDepositModal();
        await loadUserFinancialData(selectedUserId);
        
    } catch (error) {
        console.error('Error saving deposit record:', error);
        showToast('Error saving deposit record: ' + error.message, 'error');
    }
}

// Save withdrawal record
async function saveWithdrawalRecord() {
    try {
        const amount = parseFloat(document.getElementById('withdrawalAmount').value);
        const method = document.getElementById('withdrawalMethod').value;
        const status = document.getElementById('withdrawalStatus').value;
        const reference = document.getElementById('withdrawalReference').value;
        const date = document.getElementById('withdrawalDate').value;
        const notes = document.getElementById('withdrawalNotes').value;
        
        if (!amount || amount <= 0) {
            throw new Error('Please enter a valid amount');
        }
        
        if (!method || !status || !date) {
            throw new Error('Please fill in all required fields');
        }
        
        const database = window.db || db;
        const withdrawalData = {
            userId: selectedUserId,
            amount: amount,
            method: method,
            status: status,
            reference: reference,
            notes: notes,
            timestamp: new Date(date).toISOString(),
            createdBy: window.currentUser?.email || 'admin',
            createdAt: new Date().toISOString()
        };
        
        if (currentEditingTransaction) {
            // Update existing withdrawal
            const withdrawalRef = doc(database, 'withdrawals', currentEditingTransaction);
            await updateDoc(withdrawalRef, {
                ...withdrawalData,
                updatedAt: new Date().toISOString(),
                updatedBy: window.currentUser?.email || 'admin'
            });
            showToast('Withdrawal record updated successfully!', 'success');
        } else {
            // Create new withdrawal
            const withdrawalRef = doc(collection(database, 'withdrawals'));
            await setDoc(withdrawalRef, withdrawalData);
            showToast('Withdrawal record added successfully!', 'success');
        }
        
        closeWithdrawalModal();
        await loadUserFinancialData(selectedUserId);
        
    } catch (error) {
        console.error('Error saving withdrawal record:', error);
        showToast('Error saving withdrawal record: ' + error.message, 'error');
    }
}

// Edit transaction
async function editTransaction(transactionId, type) {
    try {
        currentEditingTransaction = transactionId;
        currentTransactionType = type;
        
        const database = window.db || db;
        let collectionName;
        
        switch (type) {
            case 'deposits':
                collectionName = 'deposits';
                break;
            case 'withdrawals':
                collectionName = 'withdrawals';
                break;
            case 'adjustments':
                collectionName = 'balance_adjustments';
                break;
            default:
                throw new Error('Invalid transaction type');
        }
        
        const transactionRef = doc(database, collectionName, transactionId);
        const transactionDoc = await getDoc(transactionRef);
        
        if (!transactionDoc.exists()) {
            throw new Error('Transaction not found');
        }
        
        const transactionData = transactionDoc.data();
        
        if (type === 'deposits') {
            document.getElementById('depositAmount').value = transactionData.amount || '';
            document.getElementById('depositMethod').value = transactionData.method || '';
            document.getElementById('depositStatus').value = transactionData.status || '';
            document.getElementById('depositReference').value = transactionData.reference || '';
            document.getElementById('depositDate').value = transactionData.timestamp ? 
                new Date(transactionData.timestamp).toISOString().slice(0, 16) : '';
            document.getElementById('depositNotes').value = transactionData.notes || '';
            
            document.getElementById('depositModalTitle').textContent = 'Edit Deposit Record';
            document.getElementById('depositModal').style.display = 'block';
        } else if (type === 'withdrawals') {
            document.getElementById('withdrawalAmount').value = transactionData.amount || '';
            document.getElementById('withdrawalMethod').value = transactionData.method || '';
            document.getElementById('withdrawalStatus').value = transactionData.status || '';
            document.getElementById('withdrawalReference').value = transactionData.reference || '';
            document.getElementById('withdrawalDate').value = transactionData.timestamp ? 
                new Date(transactionData.timestamp).toISOString().slice(0, 16) : '';
            document.getElementById('withdrawalNotes').value = transactionData.notes || '';
            
            document.getElementById('withdrawalModalTitle').textContent = 'Edit Withdrawal Record';
            document.getElementById('withdrawalModal').style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error loading transaction for edit:', error);
        showToast('Error loading transaction: ' + error.message, 'error');
    }
}

// Delete transaction
async function deleteTransaction(transactionId, type) {
    if (!confirm('Are you sure you want to delete this transaction record?')) {
        return;
    }
    
    try {
        const database = window.db || db;
        let collectionName;
        
        switch (type) {
            case 'deposits':
                collectionName = 'deposits';
                break;
            case 'withdrawals':
                collectionName = 'withdrawals';
                break;
            case 'adjustments':
                collectionName = 'balance_adjustments';
                break;
            default:
                throw new Error('Invalid transaction type');
        }
        
        const transactionRef = doc(database, collectionName, transactionId);
        await deleteDoc(transactionRef);
        
        showToast('Transaction record deleted successfully!', 'success');
        await loadUserFinancialData(selectedUserId);
        
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showToast('Error deleting transaction: ' + error.message, 'error');
    }
}

// Show transaction tab
function showTransactionTab(tabName) {
    // Hide all transaction tabs
    document.querySelectorAll('.transaction-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.transaction-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

// Export transaction history
function exportTransactionHistory(type) {
    try {
        const tableBody = document.getElementById(`${type}TableBody`);
        const rows = tableBody.querySelectorAll('tr');
        
        if (rows.length === 0) {
            showToast('No data to export', 'warning');
            return;
        }
        
        let csvContent = '';
        
        // Add headers based on type
        if (type === 'adjustments') {
            csvContent += 'Date,Amount,Type,Reason,Admin\n';
        } else {
            csvContent += 'Date,Amount,Method,Status,Reference,Notes\n';
        }
        
        // Add data rows
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const rowData = [];
            
            // Skip the last cell (actions column)
            for (let i = 0; i < cells.length - 1; i++) {
                let cellText = cells[i].textContent.trim();
                // Remove any commas and wrap in quotes if necessary
                if (cellText.includes(',')) {
                    cellText = `"${cellText}"`;
                }
                rowData.push(cellText);
            }
            
            csvContent += rowData.join(',') + '\n';
        });
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_${selectedUserId}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} history exported successfully!`, 'success');
        
    } catch (error) {
        console.error('Error exporting transaction history:', error);
        showToast('Error exporting data: ' + error.message, 'error');
    }
}

// Close modals
function closeDepositModal() {
    document.getElementById('depositModal').style.display = 'none';
    currentEditingTransaction = null;
}

function closeWithdrawalModal() {
    document.getElementById('withdrawalModal').style.display = 'none';
    currentEditingTransaction = null;
}

// Enhanced showTab function to handle financial tab
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    // Add active class to clicked button
    event.target.classList.add('active');
    
    // Load financial data when financial tab is shown
    if (tabName === 'financial' && selectedUserId) {
        loadUserFinancialData(selectedUserId);
    }
}