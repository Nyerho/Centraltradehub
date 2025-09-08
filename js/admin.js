// Admin Panel JavaScript with Real Firebase Integration
import { db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    doc, 
    deleteDoc, 
    updateDoc, 
    onSnapshot, 
    query, 
    where, 
    orderBy, 
    limit,
    getDoc,
    addDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Real-time dashboard data
class AdminDashboard {
    constructor() {
        this.initializeEventListeners();
        this.waitForAuth();
    }

    async waitForAuth() {
        // Wait for auth manager to be available
        let attempts = 0;
        while (!window.authManager && attempts < 100) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (window.authManager) {
            await this.loadInitialData();
            this.setupRealTimeUpdates();
        } else {
            console.error('Auth manager not available');
            // Show some default data or error message
            this.showFallbackData();
        }
    }

    showFallbackData() {
        // If Firebase is not available, show some realistic demo data
        this.updateStatCard(0, '0');
        this.updateStatCard(1, '$0');
        this.updateStatCard(2, '0');
        this.updateStatCard(3, '$0');
        
        // Update recent activity with demo data
        const activityList = document.querySelector('.activity-list');
        if (activityList) {
            activityList.innerHTML = `
                <div class="activity-item">
                    <i class="fas fa-info-circle"></i>
                    <span>No Firebase connection - showing demo data</span>
                    <time>Now</time>
                </div>
            `;
        }
    }

    initializeEventListeners() {
        // Navigation functionality
        const navItems = document.querySelectorAll('.nav-item');
        const sections = document.querySelectorAll('.admin-section');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remove active class from all nav items and sections
                navItems.forEach(nav => nav.classList.remove('active'));
                sections.forEach(section => section.classList.remove('active'));
                
                // Add active class to clicked nav item
                item.classList.add('active');
                
                // Show corresponding section
                const targetSection = item.getAttribute('data-section');
                const targetElement = document.getElementById(targetSection);
                if (targetElement) {
                    targetElement.classList.add('active');
                }
                
                // Load section-specific data
                this.loadSectionData(targetSection);
            });
        });

        // Setup form handlers
        this.setupFormHandlers();
    }

    async loadInitialData() {
        try {
            console.log('Loading initial admin data...');
            await Promise.all([
                this.updateDashboardStats(),
                this.loadRecentActivity(),
                this.loadUserManagement()
            ]);
            console.log('Initial data loaded successfully');
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Error loading dashboard data: ' + error.message, 'error');
            this.showFallbackData();
        }
    }

    async updateDashboardStats() {
        try {
            console.log('Updating dashboard stats...');
            
            // Get total users
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const totalUsers = usersSnapshot.size;
            console.log('Total users:', totalUsers);
            
            // Get trading data
            const tradesSnapshot = await getDocs(collection(db, 'trades'));
            let totalVolume = 0;
            let totalRevenue = 0;
            let activeTrades = 0;
            
            tradesSnapshot.forEach(docSnap => {
                const trade = docSnap.data();
                if (trade.amount) totalVolume += parseFloat(trade.amount);
                if (trade.fee) totalRevenue += parseFloat(trade.fee);
                if (trade.status === 'active') activeTrades++;
            });
            
            console.log('Trading stats:', { totalVolume, totalRevenue, activeTrades });
            
            // Update dashboard cards with real data
            this.updateStatCard(0, totalUsers.toLocaleString());
            this.updateStatCard(1, totalVolume > 0 ? `$${(totalVolume / 1000000).toFixed(1)}M` : '$0');
            this.updateStatCard(2, activeTrades.toLocaleString());
            this.updateStatCard(3, totalRevenue > 0 ? `$${(totalRevenue / 1000).toFixed(0)}K` : '$0');
            
        } catch (error) {
            console.error('Error updating dashboard stats:', error);
            // Show zeros if there's an error
            this.updateStatCard(0, '0');
            this.updateStatCard(1, '$0');
            this.updateStatCard(2, '0');
            this.updateStatCard(3, '$0');
        }
    }

    updateStatCard(index, value) {
        const statCards = document.querySelectorAll('.stat-card');
        if (statCards[index]) {
            const statValue = statCards[index].querySelector('h3');
            if (statValue) {
                statValue.textContent = value;
                console.log(`Updated stat card ${index} to:`, value);
            }
        }
    }

    async loadRecentActivity() {
        try {
            const activityList = document.querySelector('.activity-list');
            if (!activityList) return;
            
            console.log('Loading recent activity...');
            
            // Get recent user registrations
            const recentUsers = await getDocs(
                query(
                    collection(db, 'users'),
                    orderBy('createdAt', 'desc'),
                    limit(3)
                )
            );
            
            // Get recent trades
            const recentTrades = await getDocs(
                query(
                    collection(db, 'trades'),
                    orderBy('timestamp', 'desc'),
                    limit(3)
                )
            );
            
            activityList.innerHTML = '';
            
            // Add user registrations
            recentUsers.forEach(docSnap => {
                const user = docSnap.data();
                const timeAgo = this.getTimeAgo(user.createdAt?.toDate() || new Date());
                activityList.innerHTML += `
                    <div class="activity-item">
                        <i class="fas fa-user-plus"></i>
                        <span>New user registered: ${user.email || 'Unknown'}</span>
                        <time>${timeAgo}</time>
                    </div>
                `;
            });
            
            // Add recent trades
            recentTrades.forEach(docSnap => {
                const trade = docSnap.data();
                const timeAgo = this.getTimeAgo(trade.timestamp?.toDate() || new Date());
                activityList.innerHTML += `
                    <div class="activity-item">
                        <i class="fas fa-exchange-alt"></i>
                        <span>Trade executed: $${trade.amount?.toLocaleString() || '0'} ${trade.pair || 'BTC/USD'}</span>
                        <time>${timeAgo}</time>
                    </div>
                `;
            });
            
            // If no activity, show a message
            if (recentUsers.empty && recentTrades.empty) {
                activityList.innerHTML = `
                    <div class="activity-item">
                        <i class="fas fa-info-circle"></i>
                        <span>No recent activity</span>
                        <time>-</time>
                    </div>
                `;
            }
            
        } catch (error) {
            console.error('Error loading recent activity:', error);
            const activityList = document.querySelector('.activity-list');
            if (activityList) {
                activityList.innerHTML = `
                    <div class="activity-item">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>Error loading activity data</span>
                        <time>-</time>
                    </div>
                `;
            }
        }
    }

    async loadUserManagement() {
        try {
            const tableBody = document.querySelector('#users .admin-table tbody');
            if (!tableBody) return;
            
            console.log('Loading user management data...');
            
            const usersSnapshot = await getDocs(collection(db, 'users'));
            tableBody.innerHTML = '';
            
            if (usersSnapshot.empty) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 2rem;">No users found</td>
                    </tr>
                `;
                return;
            }
            
            usersSnapshot.forEach(docSnap => {
                const user = docSnap.data();
                const userId = docSnap.id;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>#${userId.substring(0, 6)}</td>
                    <td>${user.displayName || 'N/A'}</td>
                    <td>${user.email || 'N/A'}</td>
                    <td><span class="status ${user.status || 'active'}">${user.status || 'Active'}</span></td>
                    <td>$${(user.balance || 0).toLocaleString()}</td>
                    <td>${new Date(user.createdAt?.toDate() || Date.now()).toLocaleDateString()}</td>
                    <td>
                        <button class="btn-edit" onclick="window.adminDashboard.editUser('${userId}')"><i class="fas fa-edit"></i></button>
                        <button class="btn-delete" onclick="window.adminDashboard.deleteUser('${userId}')"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Error loading user management:', error);
            const tableBody = document.querySelector('#users .admin-table tbody');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 2rem; color: red;">Error loading users: ${error.message}</td>
                    </tr>
                `;
            }
        }
    }

    setupRealTimeUpdates() {
        try {
            console.log('Setting up real-time updates...');
            
            // Real-time user count updates
            onSnapshot(collection(db, 'users'), (snapshot) => {
                this.updateStatCard(0, snapshot.size.toLocaleString());
            });
            
            // Real-time trades updates
            onSnapshot(collection(db, 'trades'), (snapshot) => {
                let activeTrades = 0;
                let totalVolume = 0;
                let totalRevenue = 0;
                
                snapshot.forEach(docSnap => {
                    const trade = docSnap.data();
                    if (trade.status === 'active') activeTrades++;
                    if (trade.amount) totalVolume += parseFloat(trade.amount);
                    if (trade.fee) totalRevenue += parseFloat(trade.fee);
                });
                
                this.updateStatCard(1, totalVolume > 0 ? `$${(totalVolume / 1000000).toFixed(1)}M` : '$0');
                this.updateStatCard(2, activeTrades.toLocaleString());
                this.updateStatCard(3, totalRevenue > 0 ? `$${(totalRevenue / 1000).toFixed(0)}K` : '$0');
            });
            
        } catch (error) {
            console.error('Error setting up real-time updates:', error);
        }
    }

    setupFormHandlers() {
        // Handle trading settings form
        const tradingForm = document.querySelector('#trading .settings-form');
        if (tradingForm) {
            const saveBtn = tradingForm.querySelector('.btn-primary');
            if (saveBtn) {
                saveBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await this.saveTradingSettings();
                });
            }
        }

        // Handle site settings form
        const siteForm = document.querySelector('#settings .settings-form');
        if (siteForm) {
            const saveBtn = siteForm.querySelector('.btn-primary');
            if (saveBtn) {
                saveBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await this.saveSiteSettings();
                });
            }
        }
    }

    async saveTradingSettings() {
        try {
            const form = document.querySelector('#trading .settings-form');
            const formData = new FormData(form);
            
            const settings = {
                tradingHours: form.querySelector('select').value,
                minTradeAmount: parseFloat(form.querySelector('input[type="number"]').value),
                maxTradeAmount: parseFloat(form.querySelectorAll('input[type="number"]')[1].value),
                tradingFee: parseFloat(form.querySelectorAll('input[type="number"]')[2].value),
                updatedAt: serverTimestamp()
            };
            
            await addDoc(collection(db, 'settings'), {
                type: 'trading',
                ...settings
            });
            
            this.showNotification('Trading settings saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving trading settings:', error);
            this.showNotification('Error saving settings: ' + error.message, 'error');
        }
    }

    async saveSiteSettings() {
        try {
            const form = document.querySelector('#settings .settings-form');
            
            const settings = {
                siteName: form.querySelector('input[type="text"]').value,
                siteDescription: form.querySelector('textarea').value,
                contactEmail: form.querySelector('input[type="email"]').value,
                maintenanceMode: form.querySelector('input[type="checkbox"]').checked,
                updatedAt: serverTimestamp()
            };
            
            await addDoc(collection(db, 'settings'), {
                type: 'site',
                ...settings
            });
            
            this.showNotification('Site settings saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving site settings:', error);
            this.showNotification('Error saving settings: ' + error.message, 'error');
        }
    }

    async editUser(userId) {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (!userDoc.exists()) {
                this.showNotification('User not found', 'error');
                return;
            }
            
            const user = userDoc.data();
            const newStatus = prompt(`Edit user status for ${user.email}:`, user.status || 'active');
            
            if (newStatus && newStatus !== user.status) {
                await updateDoc(doc(db, 'users', userId), {
                    status: newStatus,
                    updatedAt: serverTimestamp()
                });
                
                this.showNotification('User updated successfully', 'success');
                this.loadUserManagement(); // Refresh table
            }
        } catch (error) {
            console.error('Error editing user:', error);
            this.showNotification('Error updating user: ' + error.message, 'error');
        }
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }
        
        try {
            await deleteDoc(doc(db, 'users', userId));
            this.showNotification('User deleted successfully', 'success');
            this.loadUserManagement(); // Refresh table
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showNotification('Error deleting user: ' + error.message, 'error');
        }
    }

    loadSectionData(section) {
        switch(section) {
            case 'dashboard':
                this.updateDashboardStats();
                this.loadRecentActivity();
                break;
            case 'users':
                this.loadUserManagement();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
        }
    }

    async loadAnalytics() {
        try {
            // Calculate growth metrics
            const now = new Date();
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            
            const currentUsers = await getDocs(collection(db, 'users'));
            const lastMonthUsers = await getDocs(
                query(
                    collection(db, 'users'),
                    where('createdAt', '<=', lastMonth)
                )
            );
            
            const userGrowth = lastMonthUsers.size > 0 ? 
                ((currentUsers.size - lastMonthUsers.size) / lastMonthUsers.size * 100).toFixed(1) : 
                '0';
            
            // Update analytics cards
            const analyticsCards = document.querySelectorAll('.analytics-card p');
            if (analyticsCards[0]) analyticsCards[0].textContent = `+${userGrowth}% this month`;
            
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
        return `${Math.floor(diffInMinutes / 1440)} days ago`;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 1001;
            display: flex;
            align-items: center;
            gap: 1rem;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }
}

// Initialize admin dashboard when DOM is loaded
let adminDashboard;
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing admin dashboard...');
    adminDashboard = new AdminDashboard();
    window.adminDashboard = adminDashboard;
});

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;