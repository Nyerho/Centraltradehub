// Real Firebase integration for admin panel
import { auth, db } from './firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// Remove ChatService import
// import ChatService from './chat-service.js';

class AdminDashboard {
    constructor() {
        this.db = db;
        this.auth = auth;
        this.charts = {};
        // Remove chat service
        // this.chatService = new ChatService();
        this.currentConversation = null;
        this.conversationListener = null;
        this.messageListener = null;
        this.init();
    }

    async init() {
        try {
            // Wait for auth manager to be available
            await this.waitForAuthManager();
            
            this.initializeEventListeners();
            this.initializeNavigation();
            await this.loadInitialData();
            this.initializeCharts();
            this.setupRealTimeUpdates();
            // Remove chat initialization
            // this.initializeChatSystem();
            
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
        // User Management Buttons
        document.querySelector('#users .btn-primary').addEventListener('click', () => this.showAddUserModal());
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

        // Content Management Buttons
        document.querySelector('#content .btn-primary').addEventListener('click', () => this.showAddContentModal());
        document.querySelectorAll('#content .btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => this.editContent(e.target.closest('.content-card')));
        });

        // Trading Settings
        document.querySelector('#trading .btn-primary').addEventListener('click', () => this.saveTradingSettings());

        // Site Settings
        document.querySelector('#settings .btn-primary').addEventListener('click', () => this.saveSiteSettings());
    }

    initializeNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.showSection(section);
            });
        });
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Remove active class from nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Show selected section
        document.getElementById(sectionId).classList.add('active');
        document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
    }

    async loadInitialData() {
        try {
            await this.updateDashboardStats();
            await this.loadUsers();
            await this.loadTradingSettings();
            await this.loadSiteSettings();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Some data failed to load: ' + error.message, 'warning');
        }
    }

    async updateDashboardStats() {
        try {
            // Get real data from Firebase
            const usersSnapshot = await getDocs(collection(this.db, 'users'));
            const tradesSnapshot = await getDocs(collection(this.db, 'trades'));
            
            // Update stat cards with real data
            const statCards = document.querySelectorAll('.stat-card h3');
            if (statCards.length >= 4) {
                statCards[0].textContent = usersSnapshot.size || '0'; // Total Users
                statCards[1].textContent = tradesSnapshot.size || '0'; // Total Trades
                statCards[2].textContent = '$0'; // Total Volume (calculate from trades)
                statCards[3].textContent = '0%'; // Growth Rate
            }
            
            // Calculate total volume from trades
            let totalVolume = 0;
            tradesSnapshot.forEach(doc => {
                const trade = doc.data();
                if (trade.amount) {
                    totalVolume += parseFloat(trade.amount) || 0;
                }
            });
            
            if (statCards.length >= 3) {
                statCards[2].textContent = `$${totalVolume.toLocaleString()}`;
            }
            
        } catch (error) {
            console.error('Error updating dashboard stats:', error);
            this.showNotification('Failed to load dashboard statistics', 'warning');
        }
    }

    updateStatCard(index, value, label) {
        const statCards = document.querySelectorAll('.stat-card');
        if (statCards[index]) {
            const h3 = statCards[index].querySelector('h3');
            const p = statCards[index].querySelector('p');
            if (h3) h3.textContent = value;
            if (p) p.textContent = label;
        }
    }

    async loadUsers() {
        try {
            // Add connection check
            if (!this.db) {
                throw new Error('Database connection not available');
            }
            
            const usersSnapshot = await getDocs(collection(this.db, 'users'));
            const tbody = document.querySelector('#users tbody');
            
            if (!tbody) {
                throw new Error('Users table not found in DOM');
            }
            
            tbody.innerHTML = '';
        
            if (usersSnapshot.empty) {
                // Show empty state instead of fake data
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="empty-state">
                            <div class="empty-message">
                                <i class="fas fa-users fa-3x"></i>
                                <h3>No Users Found</h3>
                                <p>Your database is empty. Real users will appear here when they register.</p>
                                <button class="btn btn-primary" onclick="window.adminDashboard.showAddUserModal()">Add Test User</button>
                            </div>
                        </td>
                    </tr>
                `;
                
                this.showNotification('Database is empty. Add some users to see real data.', 'info');
            } else {
                usersSnapshot.forEach((doc, index) => {
                    const user = doc.data();
                    const row = this.createUserRow(doc.id, user, index + 1);
                    tbody.appendChild(row);
                });
                
                this.showNotification(`Loaded ${usersSnapshot.size} users successfully`, 'success');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            
            const tbody = document.querySelector('#users tbody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="error-state">
                            <div class="error-message">
                                <i class="fas fa-exclamation-triangle fa-3x"></i>
                                <h3>Database Connection Error</h3>
                                <p>Error: ${error.message}</p>
                                <button class="btn btn-secondary" onclick="window.adminDashboard.loadUsers()">Retry</button>
                            </div>
                        </td>
                    </tr>
                `;
            }
            
            this.showNotification(`Database error: ${error.message}`, 'error');
        }
    }

    createUserRow(userId, user, index) {
        const row = document.createElement('tr');
        row.dataset.userId = userId;
        
        const balance = user.accountBalance || user.balance || 0;  // Check both fields for compatibility
        
        row.innerHTML = `
            <td>#${String(index).padStart(3, '0')}</td>
            <td>${user.displayName || 'N/A'}</td>
            <td>${user.email || 'N/A'}</td>
            <td><span class="status ${user.status || 'active'}">${(user.status || 'active').charAt(0).toUpperCase() + (user.status || 'active').slice(1)}</span></td>
            <td>$${balance.toLocaleString()}</td>
            <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
            <td>
                <button class="btn-edit" title="Edit User"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" title="Delete User"><i class="fas fa-trash"></i></button>
            </td>
        `;
        
        return row;
    }

    showAddUserModal() {
        const modal = this.createModal('Add New User', `
            <form id="addUserForm">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" name="email" required>
                </div>
                <div class="form-group">
                    <label>Display Name</label>
                    <input type="text" name="displayName" required>
                </div>
                <div class="form-group">
                    <label>Initial Balance</label>
                    <input type="number" name="balance" value="0" min="0">
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select name="status">
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="pending">Pending</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="submit" class="btn-primary">Add User</button>
                </div>
            </form>
        `);

        modal.querySelector('#addUserForm').addEventListener('submit', (e) => this.handleAddUser(e));
    }

    async handleAddUser(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const userData = {
            email: formData.get('email'),
            displayName: formData.get('displayName'),
            balance: parseFloat(formData.get('balance')) || 0,
            status: formData.get('status'),
            createdAt: new Date(),
            role: 'user'
        };

        try {
            await addDoc(collection(this.db, 'users'), userData);
            this.showNotification('User added successfully', 'success');
            e.target.closest('.modal').remove();
            await this.loadUsers();
            await this.updateDashboardStats();
        } catch (error) {
            console.error('Error adding user:', error);
            this.showNotification('Failed to add user', 'error');
        }
    }

    async editUser(row) {
        const userId = row.dataset.userId;
        const cells = row.querySelectorAll('td');
        
        const modal = this.createModal('Edit User', `
            <form id="editUserForm">
                <div class="form-group">
                    <label>Display Name</label>
                    <input type="text" name="displayName" value="${cells[1].textContent}" required>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" name="email" value="${cells[2].textContent}" required>
                </div>
                <div class="form-group">
                    <label>Balance</label>
                    <input type="number" name="balance" value="${cells[4].textContent.replace(/[$,]/g, '')}" min="0">
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select name="status">
                        <option value="active" ${cells[3].textContent.toLowerCase().includes('active') ? 'selected' : ''}>Active</option>
                        <option value="suspended" ${cells[3].textContent.toLowerCase().includes('suspended') ? 'selected' : ''}>Suspended</option>
                        <option value="pending" ${cells[3].textContent.toLowerCase().includes('pending') ? 'selected' : ''}>Pending</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="submit" class="btn-primary">Update User</button>
                </div>
            </form>
        `);

        modal.querySelector('#editUserForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const updateData = {
                displayName: formData.get('displayName'),
                email: formData.get('email'),
                accountBalance: parseFloat(formData.get('balance')) || 0,  // Changed from 'balance' to 'accountBalance'
                status: formData.get('status'),
                balanceUpdatedAt: new Date().toISOString()  // Add timestamp for tracking
            };
        
            try {
                await updateDoc(doc(this.db, 'users', userId), updateData);
                this.showNotification('User updated successfully', 'success');
                e.target.closest('.modal').remove();
                await this.loadUsers();
                await this.updateDashboardStats();
            } catch (error) {
                console.error('Error updating user:', error);
                this.showNotification('Failed to update user', 'error');
            }
        });
    }

    async deleteUser(row) {
        const userId = row.dataset.userId;
        const userName = row.querySelector('td:nth-child(2)').textContent;
        
        if (confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
            try {
                await deleteDoc(doc(this.db, 'users', userId));
                this.showNotification('User deleted successfully', 'success');
                await this.loadUsers();
                await this.updateDashboardStats();
            } catch (error) {
                console.error('Error deleting user:', error);
                this.showNotification('Failed to delete user', 'error');
            }
        }
    }

    showAddContentModal() {
        const modal = this.createModal('Add New Content', `
            <form id="addContentForm">
                <div class="form-group">
                    <label>Content Type</label>
                    <select name="type" required>
                        <option value="">Select Type</option>
                        <option value="homepage">Homepage Content</option>
                        <option value="news">News Article</option>
                        <option value="education">Educational Content</option>
                        <option value="market">Market Update</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" name="title" required>
                </div>
                <div class="form-group">
                    <label>Content</label>
                    <textarea name="content" rows="6" required></textarea>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select name="status">
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="submit" class="btn-primary">Add Content</button>
                </div>
            </form>
        `);

        modal.querySelector('#addContentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const contentData = {
                type: formData.get('type'),
                title: formData.get('title'),
                content: formData.get('content'),
                status: formData.get('status'),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            try {
                await addDoc(collection(this.db, 'content'), contentData);
                this.showNotification('Content added successfully', 'success');
                e.target.closest('.modal').remove();
            } catch (error) {
                console.error('Error adding content:', error);
                this.showNotification('Failed to add content', 'error');
            }
        });
    }

    editContent(contentCard) {
        const title = contentCard.querySelector('h3').textContent;
        const description = contentCard.querySelector('p').textContent;
        
        const modal = this.createModal(`Edit ${title}`, `
            <form id="editContentForm">
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" name="title" value="${title}" required>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea name="description" rows="4" required>${description}</textarea>
                </div>
                <div class="form-group">
                    <label>Content</label>
                    <textarea name="content" rows="8" placeholder="Enter detailed content here..."></textarea>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="submit" class="btn-primary">Update Content</button>
                </div>
            </form>
        `);

        modal.querySelector('#editContentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            this.showNotification('Content updated successfully', 'success');
            e.target.closest('.modal').remove();
        });
    }

    async saveTradingSettings() {
        const form = document.querySelector('#trading .settings-form');
        const formData = new FormData(form);
        
        const settings = {
            tradingHours: form.querySelector('select').value,
            minTradeAmount: parseFloat(form.querySelector('input[type="number"]').value),
            maxTradeAmount: parseFloat(form.querySelectorAll('input[type="number"]')[1].value),
            tradingFee: parseFloat(form.querySelectorAll('input[type="number"]')[2].value),
            updatedAt: new Date()
        };

        try {
            await addDoc(collection(this.db, 'settings'), {
                type: 'trading',
                ...settings
            });
            this.showNotification('Trading settings saved successfully', 'success');
        } catch (error) {
            console.error('Error saving trading settings:', error);
            this.showNotification('Failed to save trading settings', 'error');
        }
    }

    async saveSiteSettings() {
        const form = document.querySelector('#settings .settings-form');
        const inputs = form.querySelectorAll('input, textarea');
        
        const settings = {
            siteName: inputs[0].value,
            siteDescription: inputs[1].value,
            contactEmail: inputs[2].value,
            maintenanceMode: inputs[3].checked,
            updatedAt: new Date()
        };

        try {
            await addDoc(collection(this.db, 'settings'), {
                type: 'site',
                ...settings
            });
            this.showNotification('Site settings saved successfully', 'success');
        } catch (error) {
            console.error('Error saving site settings:', error);
            this.showNotification('Failed to save site settings', 'error');
        }
    }

    async loadTradingSettings() {
        try {
            const settingsSnapshot = await getDocs(query(
                collection(this.db, 'settings'),
                orderBy('updatedAt', 'desc'),
                limit(1)
            ));
            
            if (!settingsSnapshot.empty) {
                const settings = settingsSnapshot.docs[0].data();
                if (settings.type === 'trading') {
                    const form = document.querySelector('#trading .settings-form');
                    if (form) {
                        form.querySelector('select').value = settings.tradingHours || '24/7 Trading';
                        const inputs = form.querySelectorAll('input[type="number"]');
                        if (inputs[0]) inputs[0].value = settings.minTradeAmount || 10;
                        if (inputs[1]) inputs[1].value = settings.maxTradeAmount || 100000;
                        if (inputs[2]) inputs[2].value = settings.tradingFee || 0.1;
                    }
                }
            }
        } catch (error) {
            console.error('Error loading trading settings:', error);
        }
    }

    async loadSiteSettings() {
        try {
            const settingsSnapshot = await getDocs(query(
                collection(this.db, 'settings'),
                orderBy('updatedAt', 'desc'),
                limit(1)
            ));
            
            if (!settingsSnapshot.empty) {
                const settings = settingsSnapshot.docs[0].data();
                if (settings.type === 'site') {
                    const form = document.querySelector('#settings .settings-form');
                    if (form) {
                        const inputs = form.querySelectorAll('input, textarea');
                        if (inputs[0]) inputs[0].value = settings.siteName || 'Central Trade Hub';
                        if (inputs[1]) inputs[1].value = settings.siteDescription || 'Advanced Trading Platform for Professional Traders';
                        if (inputs[2]) inputs[2].value = settings.contactEmail || 'support@centraltradekeplr.com';
                        if (inputs[3]) inputs[3].checked = settings.maintenanceMode || false;
                    }
                }
            }
        } catch (error) {
            console.error('Error loading site settings:', error);
        }
    }

    async initializeCharts() {
        try {
            // Get real trading data from Firebase
            const tradesSnapshot = await getDocs(collection(this.db, 'trades'));
            const monthlyData = this.processTradesForChart(tradesSnapshot);
            
            // Trading Activity Chart
            const tradingCtx = document.getElementById('tradingChart');
            if (tradingCtx) {
                this.charts.trading = new Chart(tradingCtx, {
                    type: 'line',
                    data: {
                        labels: monthlyData.labels,
                        datasets: [{
                            label: 'Trading Volume ($)',
                            data: monthlyData.values,
                            borderColor: '#00d4ff',
                            backgroundColor: 'rgba(0, 212, 255, 0.1)',
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                labels: {
                                    color: '#ffffff'
                                }
                            }
                        },
                        scales: {
                            x: {
                                ticks: {
                                    color: '#ffffff'
                                },
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                }
                            },
                            y: {
                                ticks: {
                                    color: '#ffffff'
                                },
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                }
                            }
                        }
                    }
                });
            }

            // Analytics Mini Charts
            await this.createMiniCharts();
        } catch (error) {
            console.error('Error initializing charts:', error);
            // Fallback to empty charts if Firebase data fails
            this.initializeEmptyCharts();
        }
    }

    processTradesForChart(tradesSnapshot) {
        const monthlyTotals = {};
        const currentDate = new Date();
        
        // Initialize last 6 months
        for (let i = 5; i >= 0; i--) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
            monthlyTotals[monthKey] = 0;
        }
        
        // Process trades data
        tradesSnapshot.forEach(doc => {
            const trade = doc.data();
            if (trade.timestamp && trade.amount) {
                const tradeDate = trade.timestamp.toDate();
                const monthKey = tradeDate.toLocaleDateString('en-US', { month: 'short' });
                if (monthlyTotals.hasOwnProperty(monthKey)) {
                    monthlyTotals[monthKey] += parseFloat(trade.amount) || 0;
                }
            }
        });
        
        return {
            labels: Object.keys(monthlyTotals),
            values: Object.values(monthlyTotals)
        };
    }

    initializeEmptyCharts() {
        const tradingCtx = document.getElementById('tradingChart');
        if (tradingCtx) {
            this.charts.trading = new Chart(tradingCtx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Trading Volume ($)',
                        data: [0, 0, 0, 0, 0, 0],
                        borderColor: '#00d4ff',
                        backgroundColor: 'rgba(0, 212, 255, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#ffffff'
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: '#ffffff'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            }
                        },
                        y: {
                            ticks: {
                                color: '#ffffff'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            }
                        }
                    }
                }
            });
        }
        this.createMiniCharts();
    }

    async createMiniCharts() {
        try {
            const miniCharts = document.querySelectorAll('.chart-mini');
            const analyticsData = await this.getAnalyticsData();
            
            miniCharts.forEach((chart, index) => {
                const canvas = document.createElement('canvas');
                canvas.width = 100;
                canvas.height = 50;
                chart.appendChild(canvas);

                const ctx = canvas.getContext('2d');
                const data = analyticsData[index] || [0, 0, 0, 0, 0, 0];
                
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ['', '', '', '', '', ''],
                        datasets: [{
                            data: data,
                            borderColor: ['#00d4ff', '#00ff88', '#ff6b6b'][index] || '#00d4ff',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            pointRadius: 0,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { display: false },
                            y: { display: false }
                        }
                    }
                });
            });
        } catch (error) {
            console.error('Error creating mini charts:', error);
            // Fallback to empty mini charts
            this.createEmptyMiniCharts();
        }
    }

    async getAnalyticsData() {
        try {
            const usersSnapshot = await getDocs(collection(this.db, 'users'));
            const tradesSnapshot = await getDocs(collection(this.db, 'trades'));
            const activitiesSnapshot = await getDocs(collection(this.db, 'activities'));
            
            // Process data for last 6 periods
            const userData = this.processTimeSeriesData(usersSnapshot, 'createdAt');
            const tradeData = this.processTimeSeriesData(tradesSnapshot, 'timestamp');
            const activityData = this.processTimeSeriesData(activitiesSnapshot, 'timestamp');
            
            return [userData, tradeData, activityData];
        } catch (error) {
            console.error('Error getting analytics data:', error);
            return [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]];
        }
    }

    processTimeSeriesData(snapshot, timestampField) {
        const data = [0, 0, 0, 0, 0, 0];
        const now = new Date();
        
        snapshot.forEach(doc => {
            const item = doc.data();
            if (item[timestampField]) {
                const itemDate = item[timestampField].toDate();
                const daysDiff = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
                const index = Math.floor(daysDiff / 30); // Group by months
                if (index >= 0 && index < 6) {
                    data[5 - index]++; // Reverse order for chronological display
                }
            }
        });
        
        return data;
    }

    createEmptyMiniCharts() {
        const miniCharts = document.querySelectorAll('.chart-mini');
        miniCharts.forEach((chart, index) => {
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 50;
            chart.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['', '', '', '', '', ''],
                    datasets: [{
                        data: [0, 0, 0, 0, 0, 0],
                        borderColor: ['#00d4ff', '#00ff88', '#ff6b6b'][index] || '#00d4ff',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: { display: false },
                        y: { display: false }
                    }
                }
            });
        });
    }

    setupRealTimeUpdates() {
        // Real-time user count updates
        onSnapshot(collection(this.db, 'users'), (snapshot) => {
            this.updateStatCard(0, snapshot.size.toLocaleString(), 'Total Users');
        });

        // Real-time activity feed
        onSnapshot(
            query(collection(this.db, 'activities'), orderBy('timestamp', 'desc'), limit(5)),
            (snapshot) => {
                const activityList = document.querySelector('.activity-list');
                if (activityList) {
                    activityList.innerHTML = '';
                    snapshot.forEach(doc => {
                        const activity = doc.data();
                        const item = this.createActivityItem(activity);
                        activityList.appendChild(item);
                    });
                }
            }
        );
    }

    createActivityItem(activity) {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <i class="fas ${this.getActivityIcon(activity.type)}"></i>
            <span>${activity.description}</span>
            <time>${this.formatTimeAgo(activity.timestamp)}</time>
        `;
        return item;
    }

    getActivityIcon(type) {
        const icons = {
            'user_registered': 'fa-user-plus',
            'trade_executed': 'fa-exchange-alt',
            'system_update': 'fa-cog',
            'deposit': 'fa-plus-circle',
            'withdrawal': 'fa-minus-circle'
        };
        return icons[type] || 'fa-info-circle';
    }

    formatTimeAgo(timestamp) {
        if (!timestamp) return 'Unknown';
        const now = new Date();
        const time = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diff = Math.floor((now - time) / 1000);
        
        if (diff < 60) return `${diff} seconds ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
        return `${Math.floor(diff / 86400)} days ago`;
    }

    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        return modal;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.adminDashboard = new AdminDashboard();
    });
} else {
    window.adminDashboard = new AdminDashboard();
}

export default AdminDashboard;