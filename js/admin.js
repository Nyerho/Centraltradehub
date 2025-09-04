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
setInterval(() => {
    updateDashboardStats();
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