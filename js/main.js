// Mobile Navigation Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a link
document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
}));

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Active navigation highlighting
window.addEventListener('scroll', () => {
    let current = '';
    const sections = document.querySelectorAll('section');
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (scrollY >= (sectionTop - 200)) {
            current = section.getAttribute('id');
        }
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});

// Loading animation
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
});

// Enhanced Form validation
function validateForm(form) {
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;
    const errors = [];

    inputs.forEach(input => {
        const value = input.value.trim();
        input.classList.remove('error');
        
        if (!value) {
            input.classList.add('error');
            errors.push(`${input.name || input.type} is required`);
            isValid = false;
        } else {
            // Email validation
            if (input.type === 'email' && !isValidEmail(value)) {
                input.classList.add('error');
                errors.push('Please enter a valid email address');
                isValid = false;
            }
            
            // Password validation
            if (input.type === 'password' && value.length < 6) {
                input.classList.add('error');
                errors.push('Password must be at least 6 characters long');
                isValid = false;
            }
            
            // Phone validation
            if (input.type === 'tel' && !isValidPhone(value)) {
                input.classList.add('error');
                errors.push('Please enter a valid phone number');
                isValid = false;
            }
        }
    });

    if (!isValid) {
        showNotification(errors[0], 'error');
    }

    return isValid;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

// Enhanced Modal functionality
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('modal-open');
        document.body.style.overflow = 'hidden';
        
        // Focus first input
        const firstInput = modal.querySelector('input, select, textarea');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('modal-closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('modal-open', 'modal-closing');
            document.body.style.overflow = 'auto';
        }, 300);
    }
}

// Close modal when clicking outside or pressing Escape
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        const modalId = e.target.id;
        closeModal(modalId);
    }
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal[style*="flex"]');
        if (openModal) {
            closeModal(openModal.id);
        }
    }
});

// Dynamic content updates
class ContentManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.setupPlatformTabs();
        this.setupContactForm();
        this.setupNewsletterForm();
        this.setupLiveChat();
        this.startMarketUpdates();
    }
    
    setupPlatformTabs() {
        const platformTabs = document.querySelectorAll('.platform-tab');
        const platformContent = document.querySelector('.platform-info');
        
        if (platformTabs.length && platformContent) {
            platformTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    platformTabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    
                    const platform = tab.textContent.trim();
                    this.updatePlatformContent(platform, platformContent);
                });
            });
        }
    }
    
    updatePlatformContent(platform, container) {
        const content = {
            'MT4/MT5': {
                title: 'MetaTrader 4 & 5 <span class="highlight">Mobile Trading</span>',
                description: 'Access over 20,000 instruments including forex, metals, shares, indices, commodities & cryptocurrencies on award-winning MT4 and MT5 Mobile Platforms with instant nano-second execution.',
                image: 'assets/images/mt4.webp'
            },
            'Central Trade Hub Trader 4/5': {
                title: 'Central Trade Hub <span class="highlight">Advanced Platform</span>',
                description: 'Our proprietary trading platform with advanced charting tools, algorithmic trading capabilities, and institutional-grade execution. Perfect for professional traders.',
                image: 'assets/images/tradeen.png'
            },
            'CentralTradeHub-Plus': {
                title: 'CentralTradeHub Plus <span class="highlight">Coming Soon</span>',
                description: 'Next-generation trading platform with AI-powered analytics, social trading features, and advanced risk management tools. Stay tuned for the future of trading.',
                image: 'assets/images/mt5.webp'
            }
        };
        
        const platformData = content[platform] || content['MT4/MT5'];
        
        container.querySelector('h3').innerHTML = platformData.title;
        container.querySelector('p').textContent = platformData.description;
        
        const image = document.querySelector('.platform-image');
        if (image) {
            image.src = platformData.image;
            image.alt = `${platform} Trading Platform`;
        }
    }
    
    setupContactForm() {
        const contactForms = document.querySelectorAll('.contact-form');
        contactForms.forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                
                if (validateForm(form)) {
                    this.submitContactForm(new FormData(form));
                }
            });
        });
    }
    
    setupNewsletterForm() {
        const newsletterForms = document.querySelectorAll('.newsletter-form');
        newsletterForms.forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const email = form.querySelector('input[type="email"]').value;
                if (isValidEmail(email)) {
                    this.subscribeNewsletter(email);
                    form.reset();
                } else {
                    showNotification('Please enter a valid email address', 'error');
                }
            });
        });
    }
    
    setupLiveChat() {
        const chatButton = document.getElementById('liveChatBtn');
        if (chatButton) {
            chatButton.addEventListener('click', () => {
                this.openLiveChat();
            });
        }
    }
    
    submitContactForm(formData) {
        // Simulate form submission
        showNotification('Thank you for your message! We will get back to you within 24 hours.', 'success');
        
        // In a real application, you would send this to your backend
        console.log('Contact form submitted:', Object.fromEntries(formData));
    }
    
    subscribeNewsletter(email) {
        // Simulate newsletter subscription
        showNotification('Successfully subscribed to our newsletter!', 'success');
        
        // In a real application, you would send this to your backend
        console.log('Newsletter subscription:', email);
    }
    
    openLiveChat() {
        // Simulate live chat opening
        showNotification('Live chat feature coming soon! Please use our contact form for now.', 'info');
    }
    
    startMarketUpdates() {
        // Update market data every 5 seconds
        setInterval(() => {
            this.updateMarketTicker();
        }, 5000);
    }
    
    updateMarketTicker() {
        const tickerItems = document.querySelectorAll('.ticker-item');
        
        tickerItems.forEach(item => {
            const priceElement = item.querySelector('.price');
            const changeElement = item.querySelector('.change');
            
            if (priceElement && changeElement) {
                // Simulate price changes
                const currentPrice = parseFloat(priceElement.textContent);
                const change = (Math.random() - 0.5) * 0.01; // Random change between -0.005 and +0.005
                const newPrice = (currentPrice + change).toFixed(4);
                const changePercent = ((change / currentPrice) * 100).toFixed(2);
                
                priceElement.textContent = newPrice;
                changeElement.textContent = `${change >= 0 ? '+' : ''}${changePercent}%`;
                changeElement.className = `change ${change >= 0 ? 'positive' : 'negative'}`;
                
                // Add flash effect
                item.classList.add('updated');
                setTimeout(() => item.classList.remove('updated'), 1000);
            }
        });
    }
}

// Notification system
function showNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after duration
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('notification-exit');
            setTimeout(() => notification.remove(), 300);
        }
    }, duration);
}

function getNotificationIcon(type) {
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    return icons[type] || icons.info;
}

// Initialize content manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ContentManager();
    
    // Setup login/register button handlers
    const loginBtn = document.querySelector('.btn-login');
    const registerBtn = document.querySelector('.btn-register');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal('loginModal');
        });
    }
    
    if (registerBtn) {
        registerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal('registerModal');
        });
    }
});

// Scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
        }
    });
}, observerOptions);

// Observe elements for animation
document.addEventListener('DOMContentLoaded', () => {
    const animateElements = document.querySelectorAll('.feature-card, .stat-box, .tool-item');
    animateElements.forEach(el => observer.observe(el));
});