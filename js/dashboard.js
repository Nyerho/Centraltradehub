// Dashboard functionality
class DashboardManager {
    constructor() {
        this.currentSection = 'overview';
        this.portfolioChart = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUserData();
        this.initializeChart();
        this.startRealTimeUpdates();
    }

    setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.menu-item[data-section]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.switchSection(section);
            });
        });

        // Time filter buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateChart(btn.dataset.period);
            });
        });

        // User dropdown toggle
        window.toggleUserDropdown = () => {
            const dropdown = document.getElementById('userDropdown');
            dropdown.classList.toggle('show');
        };

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const userMenu = document.querySelector('.user-menu');
            const dropdown = document.getElementById('userDropdown');
            if (!userMenu.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    }

    switchSection(sectionName) {
        // Update active menu item
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        // Update active section
        document.querySelectorAll('.dashboard-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionName}-section`).classList.add('active');

        this.currentSection = sectionName;
    }

    async loadUserData() {
        try {
            // Load user profile data
            if (typeof firebase !== 'undefined') {
                firebase.auth().onAuthStateChanged(async (user) => {
                    if (user) {
                        document.getElementById('dashboard-user-name').textContent = user.displayName || 'User';
                        document.getElementById('dashboard-user-email').textContent = user.email;
                        
                        // Load additional user data from Firestore
                        await this.loadAccountData(user.uid);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async loadAccountData(userId) {
        try {
            // This would typically fetch from your database
            // For now, we'll use mock data
            const accountData = {
                balance: 10000.00,
                equity: 10250.00,
                margin: 500.00,
                freeMargin: 9750.00,
                todayPnL: 125.00
            };

            this.updateAccountSummary(accountData);
        } catch (error) {
            console.error('Error loading account data:', error);
        }
    }

    updateAccountSummary(data) {
        document.querySelector('.balance-amount').textContent = `$${data.balance.toFixed(2)}`;
        document.querySelector('.equity-amount').textContent = `$${data.equity.toFixed(2)}`;
        document.querySelector('.margin-amount').textContent = `$${data.freeMargin.toFixed(2)}`;
        document.querySelector('.pnl-amount').textContent = `+$${data.todayPnL.toFixed(2)}`;
    }

    initializeChart() {
        const ctx = document.getElementById('portfolioChart');
        if (!ctx) return;

        this.portfolioChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'],
                datasets: [{
                    label: 'Portfolio Value',
                    data: [10000, 10050, 10025, 10100, 10150, 10200, 10180, 10250],
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#2d2d44'
                        },
                        ticks: {
                            color: '#888'
                        }
                    },
                    y: {
                        grid: {
                            color: '#2d2d44'
                        },
                        ticks: {
                            color: '#888',
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    updateChart(period) {
        // Update chart data based on selected time period
        // This would typically fetch new data from your API
        console.log('Updating chart for period:', period);
    }

    startRealTimeUpdates() {
        // Update market prices every 5 seconds
        setInterval(() => {
            this.updateMarketPrices();
        }, 5000);
    }

    updateMarketPrices() {
        // Simulate real-time price updates
        const priceElements = document.querySelectorAll('.current-price');
        priceElements.forEach(element => {
            const currentPrice = parseFloat(element.textContent);
            const change = (Math.random() - 0.5) * 0.001; // Small random change
            const newPrice = currentPrice + change;
            element.textContent = newPrice.toFixed(4);
        });
    }
}

// Global functions for button actions
window.openTradingModal = () => {
    alert('Opening trading modal...');
    // Implement trading modal
};

window.showDeposit = () => {
    window.location.href = 'funding.html';
};

window.showWithdraw = () => {
    alert('Opening withdrawal form...');
    // Implement withdrawal functionality
};

window.goToAnalytics = () => {
    alert('Navigating to analytics...');
    // Switch to analytics section
};

window.closePosition = (symbol) => {
    if (confirm(`Close position for ${symbol}?`)) {
        alert(`Position ${symbol} closed successfully!`);
        // Implement position closing logic
    }
};

window.handleLogout = async () => {
    try {
        if (typeof firebase !== 'undefined') {
            await firebase.auth().signOut();
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Error logging out:', error);
    }
};

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DashboardManager();
});