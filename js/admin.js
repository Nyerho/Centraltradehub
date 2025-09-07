// Admin Panel JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Navigation functionality
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.admin-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all nav items and sections
            navItems.forEach(nav => nav.classList.remove('active'));
            sections.forEach(section => section.classList.remove('active'));
            
            // Add active class to clicked nav item
            this.classList.add('active');
            
            // Show corresponding section
            const targetSection = this.getAttribute('data-section');
            document.getElementById(targetSection).classList.add('active');
        });
    });
    
    // Simulate chart data
    initializeCharts();
    
    // Form handling
    setupFormHandlers();
    
    // Table interactions
    setupTableHandlers();
});

function initializeCharts() {
    // Placeholder for chart initialization
    // In a real application, you would use Chart.js or similar library
    const chartPlaceholder = document.querySelector('.chart-placeholder');
    if (chartPlaceholder) {
        chartPlaceholder.innerHTML = '<p>Trading Activity Chart<br><small>Chart.js integration would go here</small>';
    }
}

function setupFormHandlers() {
    // Handle form submissions
    const forms = document.querySelectorAll('.settings-form');
    forms.forEach(form => {
        const submitBtn = form.querySelector('.btn-primary');
        if (submitBtn) {
            submitBtn.addEventListener('click', function(e) {
                e.preventDefault();
                showNotification('Settings saved successfully!', 'success');
            });
        }
    });
}

function setupTableHandlers() {
    // Handle table actions
    const editBtns = document.querySelectorAll('.btn-edit');
    const deleteBtns = document.querySelectorAll('.btn-delete');
    
    editBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            showNotification('Edit functionality would open a modal here', 'info');
        });
    });
    
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            if (confirm('Are you sure you want to delete this item?')) {
                showNotification('Item deleted successfully', 'success');
                // Remove the row in a real application
            }
        });
    });
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    // Add styles
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
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 3000);
}

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
document.head.appendChild(style);

// Simulate real-time updates
setInterval(async () => {
    if (document.getElementById('dashboard').classList.contains('active')) {
        await loadDashboardData();
    }
}, 30000); // Update every 30 seconds

function updateDashboardStats() {
    // Simulate updating dashboard statistics
    const statCards = document.querySelectorAll('.stat-info h3');
    statCards.forEach(stat => {
        const currentValue = stat.textContent;
        // Add small random variations to simulate real-time updates
        if (currentValue.includes('$')) {
            const numValue = parseFloat(currentValue.replace(/[$,KM]/g, ''));
            const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
            const newValue = numValue * (1 + variation);
            
            if (currentValue.includes('K')) {
                stat.textContent = `$${newValue.toFixed(0)}K`;
            } else if (currentValue.includes('M')) {
                stat.textContent = `$${newValue.toFixed(1)}M`;
            }
        } else if (!isNaN(currentValue.replace(/,/g, ''))) {
            const numValue = parseInt(currentValue.replace(/,/g, ''));
            const variation = Math.floor((Math.random() - 0.5) * 100);
            const newValue = numValue + variation;
            stat.textContent = newValue.toLocaleString();
        }
    });
}

// Add Firebase integration
let adminAuth = null;
let adminDB = null;

// Wait for Firebase to load
window.addEventListener('load', async () => {
    // Wait for auth manager
    while (!window.authManager) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    adminAuth = window.authManager;
    
    // Check if user is admin
    checkAdminAccess();
    
    // Load real data
    loadDashboardData();
    loadUserData();
});

function checkAdminAccess() {
    const currentUser = adminAuth.getCurrentUser();
    if (!currentUser || !currentUser.isAdmin) {
        window.location.href = 'auth.html';
        return;
    }
}

async function loadDashboardData() {
    try {
        // Load real statistics from Firebase
        const stats = await adminDB.getAdminStats();
        updateStatsCards(stats);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Security middleware

// Import Firebase services (add at top of file)
import { auth, db } from './firebase-config.js';
import { collection, getDocs, doc, deleteDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Admin Authentication Check
class AdminSecurity {
    constructor() {
        this.checkAdminAccess();
    }

    async checkAdminAccess() {
        // Wait for auth manager to be available
        let attempts = 0;
        while (!window.authManager && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!window.authManager) {
            this.redirectToLogin('Authentication system not available');
            return;
        }

        const user = window.authManager.getCurrentUser();
        if (!user) {
            this.redirectToLogin('Please log in to access admin panel');
            return;
        }

        // Check admin role using ES6 Firebase
        const userRole = await this.getUserRole(user.uid);
        if (userRole !== 'admin') {
            this.redirectToLogin('Access denied: Admin privileges required');
            return;
        }

        console.log('Admin access granted for:', user.email);
        this.initializeAdminPanel();
    }

    async getUserRole(uid) {
        try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            return userDoc.exists() ? userDoc.data().role : 'user';
        } catch (error) {
            console.error('Error fetching user role:', error);
            return 'user';
        }
    }

    redirectToLogin(message) {
        alert(message);
        window.location.href = 'auth.html';
    }

    initializeAdminPanel() {
        this.loadDashboardData();
        this.setupRealTimeUpdates();
    }

    async loadDashboardData() {
        try {
            // Load real user statistics
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const totalUsers = usersSnapshot.size;
            
            // Load trading data
            const tradesSnapshot = await getDocs(collection(db, 'trades'));
            const totalTrades = tradesSnapshot.size;
            
            // Update dashboard stats
            document.querySelector('.stat-card:nth-child(1) .stat-number').textContent = totalUsers;
            document.querySelector('.stat-card:nth-child(3) .stat-number').textContent = totalTrades;
            
            // Load user management table
            this.loadUserManagementTable(usersSnapshot);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    loadUserManagementTable(usersSnapshot) {
        const tableBody = document.querySelector('#userManagement tbody');
        if (!tableBody) return;

        tableBody.innerHTML = '';
        usersSnapshot.forEach(docSnapshot => {
            const user = docSnapshot.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.email || 'N/A'}</td>
                <td>${user.displayName || 'N/A'}</td>
                <td><span class="status ${user.status || 'active'}">${user.status || 'Active'}</span></td>
                <td>${user.role || 'user'}</td>
                <td>${new Date(user.createdAt?.toDate() || Date.now()).toLocaleDateString()}</td>
                <td>
                    <button class="btn-edit" onclick="editUser('${docSnapshot.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteUser('${docSnapshot.id}')">Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    setupRealTimeUpdates() {
        // Real-time user count updates
        onSnapshot(collection(db, 'users'), (snapshot) => {
            document.querySelector('.stat-card:nth-child(1) .stat-number').textContent = snapshot.size;
        });

        // Real-time trades updates
        onSnapshot(collection(db, 'trades'), (snapshot) => {
            document.querySelector('.stat-card:nth-child(3) .stat-number').textContent = snapshot.size;
        });
    }
}

// User management functions
window.editUser = async (userId) => {
    console.log('Edit user:', userId);
    // Implementation for editing user
};

window.deleteUser = async (userId) => {
    if (confirm('Are you sure you want to delete this user?')) {
        try {
            await deleteDoc(doc(db, 'users', userId));
            showNotification('User deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting user:', error);
            showNotification('Error deleting user', 'error');
        }
    }
};

// Initialize admin security when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AdminSecurity();
});

// Add logout functionality
document.querySelector('.admin-nav .user-section').addEventListener('click', async () => {
    if (confirm('Are you sure you want to logout?')) {
        try {
            await window.authManager.signOut();
            window.location.href = 'auth.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
});
function updateStatsCards(stats) {
    const statCards = document.querySelectorAll('.stat-card');
    if (stats && statCards.length >= 4) {
        statCards[0].querySelector('h3').textContent = stats.totalUsers || '0';
        statCards[1].querySelector('h3').textContent = `$${(stats.tradingVolume || 0).toLocaleString()}`;
        statCards[2].querySelector('h3').textContent = stats.activeTrades || '0';
        statCards[3].querySelector('h3').textContent = `$${(stats.revenue || 0).toLocaleString()}`;
    }
}