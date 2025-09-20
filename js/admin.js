// Real Firebase integration for admin panel
import { auth, db } from './firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, limit, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class AdminDashboard {
    constructor() {
        this.db = db;
        this.auth = auth;
        this.charts = {};
        this.init();
    }

    async init() {
        try {
            // Wait for auth manager to be available
            await this.waitForAuthManager();
            
            // Make database available globally
            window.db = this.db;
            window.currentUser = window.authManager.getCurrentUser();
            
            this.initializeEventListeners();
            this.initializeNavigation();
            await this.loadInitialData();
            this.initializeCharts();
            this.setupRealTimeUpdates();
            
            console.log('Admin dashboard initialized successfully');
        } catch (error) {
            console.error('Admin initialization error:', error);
            this.showNotification('Failed to initialize admin panel: ' + error.message, 'error');
        }
    }

    async waitForAuthManager() {
        let attempts = 0;
        while (!window.authManager && attempts < 100) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        if (!window.authManager) {
            throw new Error('Auth manager not available');
        }
    }

    initializeEventListeners() {
        // Mobile menu toggle
        this.initializeMobileMenu();
        
        // User Management Buttons
        const addUserBtn = document.querySelector('#users .btn-primary');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => this.showAddUserModal());
        }
        
        document.addEventListener('click', (e) => {
            if (e.target.closest('.btn-edit')) {
                const row = e.target.closest('tr');
                if (row) this.editUser(row);
            }
            if (e.target.closest('.btn-delete')) {
                const row = e.target.closest('tr');
                if (row) this.deleteUser(row);
            }
        });

        // Content Management
        const addContentBtn = document.querySelector('#content .btn-primary');
        if (addContentBtn) {
            addContentBtn.addEventListener('click', () => this.showAddContentModal());
        }
    }

    initializeMobileMenu() {
        const mobileToggle = document.getElementById('mobileMenuToggle');
        const sidebar = document.querySelector('.admin-sidebar');
        const body = document.body;
        
        if (mobileToggle && sidebar) {
            // Create mobile overlay if it doesn't exist
            let overlay = document.querySelector('.mobile-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'mobile-overlay';
                body.appendChild(overlay);
            }
            
            // Toggle menu function
            const toggleMenu = () => {
                const isOpen = sidebar.classList.contains('mobile-open');
                
                if (isOpen) {
                    sidebar.classList.remove('mobile-open');
                    overlay.classList.remove('active');
                    mobileToggle.classList.remove('active');
                    body.style.overflow = '';
                } else {
                    sidebar.classList.add('mobile-open');
                    overlay.classList.add('active');
                    mobileToggle.classList.add('active');
                    body.style.overflow = 'hidden';
                }
            };
            
            // Event listeners
            mobileToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleMenu();
            });
            
            // Close menu when clicking overlay
            overlay.addEventListener('click', () => {
                if (sidebar.classList.contains('mobile-open')) {
                    toggleMenu();
                }
            });
            
            // Close menu when clicking nav items on mobile
            sidebar.addEventListener('click', (e) => {
                if (e.target.classList.contains('nav-item') && window.innerWidth <= 768) {
                    setTimeout(() => toggleMenu(), 300); // Small delay for smooth transition
                }
            });
            
            // Handle window resize
            window.addEventListener('resize', () => {
                if (window.innerWidth > 768 && sidebar.classList.contains('mobile-open')) {
                    sidebar.classList.remove('mobile-open');
                    overlay.classList.remove('active');
                    mobileToggle.classList.remove('active');
                    body.style.overflow = '';
                }
            });
            
            console.log('Mobile menu initialized successfully');
        } else {
            console.warn('Mobile toggle or sidebar not found');
        }
    }

    initializeNavigation() {
        const navItems = document.querySelectorAll('.nav-item[data-section]');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.getAttribute('data-section');
                this.showSection(section);
            });
        });
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Show selected section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        // Add active class to clicked nav item
        const activeNavItem = document.querySelector(`[data-section="${sectionId}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }
    }

    async loadInitialData() {
        try {
            await this.updateDashboardStats();
            await this.loadUsers();
            await this.loadTradingSettings();
            await this.loadSiteSettings();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Error loading data: ' + error.message, 'error');
        }
    }

    async updateDashboardStats() {
        try {
            // Load users count
            const usersSnapshot = await getDocs(collection(this.db, 'users'));
            this.updateStatCard(0, usersSnapshot.size, 'Total Users');
            
            // Load active trades count
            const tradesQuery = query(collection(this.db, 'trades'), where('status', '==', 'active'));
            const tradesSnapshot = await getDocs(tradesQuery);
            this.updateStatCard(1, tradesSnapshot.size, 'Active Trades');
            
            // Calculate total volume from all trades
            let totalVolume = 0;
            const allTradesSnapshot = await getDocs(collection(this.db, 'trades'));
            allTradesSnapshot.forEach(doc => {
                const trade = doc.data();
                if (trade.volume) {
                    totalVolume += parseFloat(trade.volume) || 0;
                }
            });
            this.updateStatCard(2, `$${totalVolume.toLocaleString()}`, 'Total Volume');
            
            // Calculate success rate
            let successfulTrades = 0;
            let totalClosedTrades = 0;
            allTradesSnapshot.forEach(doc => {
                const trade = doc.data();
                if (trade.status === 'closed') {
                    totalClosedTrades++;
                    if (trade.profit && parseFloat(trade.profit) > 0) {
                        successfulTrades++;
                    }
                }
            });
            const successRate = totalClosedTrades > 0 ? ((successfulTrades / totalClosedTrades) * 100).toFixed(1) : 0;
            this.updateStatCard(3, `${successRate}%`, 'Success Rate');
            
            console.log('Dashboard stats updated successfully');
            
        } catch (error) {
            console.error('Error updating dashboard stats:', error);
            // Show fallback data
            this.updateStatCard(0, 'Error', 'Total Users');
            this.updateStatCard(1, 'Error', 'Active Trades');
            this.updateStatCard(2, 'Error', 'Total Volume');
            this.updateStatCard(3, 'Error', 'Success Rate');
        }
    }

    updateStatCard(index, value, label) {
        const statCards = document.querySelectorAll('.stat-card h3');
        if (statCards[index]) {
            statCards[index].textContent = value;
        }
    }

    async loadUsers() {
        try {
            const usersSnapshot = await getDocs(collection(this.db, 'users'));
            const tableBody = document.getElementById('users-table-body');
            
            if (!tableBody) return;
            
            tableBody.innerHTML = '';
            
            usersSnapshot.forEach((doc, index) => {
                const user = doc.data();
                const row = this.createUserRow(doc.id, user, index + 1);
                tableBody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Error loading users:', error);
            this.showNotification('Error loading users: ' + error.message, 'error');
        }
    }

    createUserRow(userId, user, index) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index}</td>
            <td>${user.firstName || ''} ${user.lastName || ''}</td>
            <td>${user.email || ''}</td>
            <td><span class="status ${user.emailVerified ? 'active' : 'inactive'}">${user.emailVerified ? 'Verified' : 'Pending'}</span></td>
            <td>${user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
            <td>
                <button class="btn-edit btn-sm"><i class="fas fa-edit"></i></button>
                <button class="btn-delete btn-sm"><i class="fas fa-trash"></i></button>
            </td>
        `;
        row.dataset.userId = userId;
        return row;
    }

    async saveTradingSettings() {
        try {
            const minTrade = document.getElementById('min-trade').value;
            const maxTrade = document.getElementById('max-trade').value;
            const commission = document.getElementById('commission').value;
            
            const settings = {
                minTradeAmount: parseFloat(minTrade) || 0,
                maxTradeAmount: parseFloat(maxTrade) || 0,
                commissionRate: parseFloat(commission) || 0,
                updatedAt: new Date(),
                updatedBy: window.currentUser?.email || 'admin'
            };
            
            await setDoc(doc(this.db, 'admin', 'trading-settings'), settings, { merge: true });
            this.showNotification('Trading settings saved successfully!', 'success');
            
        } catch (error) {
            console.error('Error saving trading settings:', error);
            this.showNotification('Error saving settings: ' + error.message, 'error');
        }
    }

    async saveSiteSettings() {
        try {
            const siteName = document.getElementById('site-name').value;
            const siteEmail = document.getElementById('site-email').value;
            const maintenanceMode = document.getElementById('maintenance-mode').value === 'true';
            
            const settings = {
                siteName: siteName || 'Central Trade Hub',
                contactEmail: siteEmail || '',
                maintenanceMode: maintenanceMode,
                updatedAt: new Date(),
                updatedBy: window.currentUser?.email || 'admin'
            };
            
            await setDoc(doc(this.db, 'admin', 'site-settings'), settings, { merge: true });
            this.showNotification('Site settings saved successfully!', 'success');
            
        } catch (error) {
            console.error('Error saving site settings:', error);
            this.showNotification('Error saving settings: ' + error.message, 'error');
        }
    }

    async loadTradingSettings() {
        try {
            const settingsDoc = await getDoc(doc(this.db, 'admin', 'trading-settings'));
            if (settingsDoc.exists()) {
                const settings = settingsDoc.data();
                
                const minTradeInput = document.getElementById('min-trade');
                const maxTradeInput = document.getElementById('max-trade');
                const commissionInput = document.getElementById('commission');
                
                if (minTradeInput) minTradeInput.value = settings.minTradeAmount || '';
                if (maxTradeInput) maxTradeInput.value = settings.maxTradeAmount || '';
                if (commissionInput) commissionInput.value = settings.commissionRate || '';
            }
        } catch (error) {
            console.error('Error loading trading settings:', error);
        }
    }

    async loadSiteSettings() {
        try {
            const settingsDoc = await getDoc(doc(this.db, 'admin', 'site-settings'));
            if (settingsDoc.exists()) {
                const settings = settingsDoc.data();
                
                const siteNameInput = document.getElementById('site-name');
                const siteEmailInput = document.getElementById('site-email');
                const maintenanceModeSelect = document.getElementById('maintenance-mode');
                
                if (siteNameInput) siteNameInput.value = settings.siteName || '';
                if (siteEmailInput) siteEmailInput.value = settings.contactEmail || '';
                if (maintenanceModeSelect) maintenanceModeSelect.value = settings.maintenanceMode ? 'true' : 'false';
            }
        } catch (error) {
            console.error('Error loading site settings:', error);
        }
    }

    async initializeCharts() {
        // Initialize empty charts
        this.initializeEmptyCharts();
    }

    initializeEmptyCharts() {
        // Volume Chart
        const volumeCtx = document.getElementById('volumeChart');
        if (volumeCtx) {
            this.charts.volume = new Chart(volumeCtx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Trading Volume',
                        data: [0, 0, 0, 0, 0, 0],
                        borderColor: '#007bff',
                        backgroundColor: 'rgba(0, 123, 255, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#fff'
                            }
                        }
                    },
                    scales: {
                        y: {
                            ticks: {
                                color: '#fff'
                            },
                            grid: {
                                color: '#444'
                            }
                        },
                        x: {
                            ticks: {
                                color: '#fff'
                            },
                            grid: {
                                color: '#444'
                            }
                        }
                    }
                }
            });
        }

        // User Growth Chart
        const userCtx = document.getElementById('userChart');
        if (userCtx) {
            this.charts.users = new Chart(userCtx, {
                type: 'bar',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'New Users',
                        data: [0, 0, 0, 0, 0, 0],
                        backgroundColor: '#28a745',
                        borderColor: '#28a745',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#fff'
                            }
                        }
                    },
                    scales: {
                        y: {
                            ticks: {
                                color: '#fff'
                            },
                            grid: {
                                color: '#444'
                            }
                        },
                        x: {
                            ticks: {
                                color: '#fff'
                            },
                            grid: {
                                color: '#444'
                            }
                        }
                    }
                }
            });
        }
    }

    setupRealTimeUpdates() {
        // Set up real-time listeners for data updates
        try {
            // Listen for user changes
            onSnapshot(collection(this.db, 'users'), (snapshot) => {
                this.updateStatCard(0, snapshot.size, 'Total Users');
            });
        } catch (error) {
            console.error('Error setting up real-time updates:', error);
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '1000',
            transform: 'translateX(400px)',
            transition: 'transform 0.3s ease'
        });
        
        // Set background color based on type
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Hide and remove notification
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Placeholder methods for user management
    showAddUserModal() {
        // Redirect to user management page instead of showing popup
        window.location.href = 'user-management.html';
    }

    editUser(row) {
        // Redirect to user management page instead of showing popup
        window.location.href = 'user-management.html';
    }

    deleteUser(row) {
        if (confirm('Are you sure you want to delete this user?')) {
            // Redirect to user management page for actual deletion functionality
            window.location.href = 'user-management.html';
        }
    }

    showAddContentModal() {
        alert('Add content functionality will be implemented here');
    }
}

// Make functions available globally
window.saveTradingSettings = function() {
    if (window.adminDashboard) {
        window.adminDashboard.saveTradingSettings();
    }
};

window.saveSiteSettings = function() {
    if (window.adminDashboard) {
        window.adminDashboard.saveSiteSettings();
    }
};

// Add mobile menu toggle functionality
window.toggleMobileMenu = function() {
    const sidebar = document.getElementById('adminSidebar');
    const toggle = document.getElementById('mobileMenuToggle');
    const overlay = document.getElementById('mobileOverlay');
    
    if (sidebar && toggle) {
        const isOpen = sidebar.classList.contains('mobile-open');
        
        if (isOpen) {
            // Close menu
            sidebar.classList.remove('mobile-open');
            toggle.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
            document.body.style.overflow = '';
        } else {
            // Open menu
            sidebar.classList.add('mobile-open');
            toggle.classList.add('active');
            if (overlay) overlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent background scroll
        }
    }
};

// Close mobile menu when clicking overlay
document.addEventListener('click', function(event) {
    const sidebar = document.getElementById('adminSidebar');
    const toggle = document.getElementById('mobileMenuToggle');
    const overlay = document.getElementById('mobileOverlay');
    
    if (overlay && event.target === overlay) {
        sidebar.classList.remove('mobile-open');
        toggle.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Export and initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.AdminDashboard = AdminDashboard;
    });
} else {
    window.AdminDashboard = AdminDashboard;
}

export default AdminDashboard;
