// Balance Fix Script - Ensures dashboard shows correct wallet balance
class BalanceFixer {
    constructor() {
        this.initialized = false;
        this.retryCount = 0;
        this.maxRetries = 5;
    }

    // Get current user ID from various possible storage locations
    getCurrentUserId() {
        return localStorage.getItem('userId') || 
               localStorage.getItem('currentUserId') ||
               sessionStorage.getItem('userId') ||
               sessionStorage.getItem('currentUserId') ||
               window.currentUserId ||
               null;
    }

    // Update all possible balance display elements
    updateBalanceDisplays(balance) {
        const balanceSelectors = [
            '.wallet-balance',
            '.balance-display',
            '.account-balance',
            '#walletBalance',
            '#accountBalance',
            '#balance',
            '[data-balance]',
            '.user-balance',
            '.current-balance',
            '.dashboard-balance'
        ];

        let updatedElements = 0;
        
        balanceSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (element) {
                    const formattedBalance = `$${parseFloat(balance).toFixed(2)}`;
                    
                    // Update text content
                    if (element.textContent.includes('$') || element.textContent.includes('balance')) {
                        element.textContent = formattedBalance;
                    }
                    
                    // Update innerHTML if it contains balance-related content
                    if (element.innerHTML.includes('$') || element.innerHTML.includes('balance')) {
                        element.innerHTML = formattedBalance;
                    }
                    
                    // Update value attribute for input elements
                    if (element.tagName === 'INPUT') {
                        element.value = balance;
                    }
                    
                    // Update data attribute
                    element.setAttribute('data-balance', balance);
                    
                    updatedElements++;
                }
            });
        });

        console.log(`Balance Fix: Updated ${updatedElements} elements with balance: $${balance}`);
        return updatedElements > 0;
    }

    // Fetch actual balance from Firebase
    async fetchActualBalance() {
        const userId = this.getCurrentUserId();
        
        if (!userId) {
            console.warn('Balance Fix: No user ID found');
            return null;
        }

        if (!window.firebase || !firebase.firestore) {
            console.warn('Balance Fix: Firebase not available');
            return null;
        }

        try {
            const doc = await firebase.firestore().collection('users').doc(userId).get();
            
            if (doc.exists) {
                const userData = doc.data();
                const actualBalance = userData.walletBalance || userData.accountBalance || 0;
                
                console.log('Balance Fix: Fetched actual balance:', actualBalance);
                console.log('Balance Fix: User data:', {
                    walletBalance: userData.walletBalance,
                    accountBalance: userData.accountBalance,
                    deposits: userData.deposits,
                    profits: userData.profits
                });
                
                return actualBalance;
            } else {
                console.warn('Balance Fix: User document not found');
                return null;
            }
        } catch (error) {
            console.error('Balance Fix: Error fetching balance:', error);
            return null;
        }
    }

    // Override any existing balance calculations
    overrideBalanceCalculations() {
        // Override common balance calculation patterns
        const originalConsoleLog = console.log;
        console.log = function(...args) {
            const message = args.join(' ');
            if (message.includes('Balance calculation:') || message.includes('calculatedWalletBalance')) {
                console.warn('Balance Fix: Intercepted balance calculation, using actual database balance instead');
                window.balanceFixer.fixBalance();
            }
            originalConsoleLog.apply(console, args);
        };
    }

    // Main fix function
    async fixBalance() {
        if (this.retryCount >= this.maxRetries) {
            console.warn('Balance Fix: Max retries reached');
            return;
        }

        this.retryCount++;
        console.log(`Balance Fix: Attempt ${this.retryCount}/${this.maxRetries}`);

        const actualBalance = await this.fetchActualBalance();
        
        if (actualBalance !== null) {
            const updated = this.updateBalanceDisplays(actualBalance);
            
            if (updated) {
                console.log('Balance Fix: Successfully updated balance displays');
                this.retryCount = 0; // Reset on success
            } else {
                console.warn('Balance Fix: No balance elements found to update');
                // Retry after a short delay
                setTimeout(() => this.fixBalance(), 1000);
            }
        } else {
            console.warn('Balance Fix: Could not fetch actual balance');
            // Retry after a short delay
            setTimeout(() => this.fixBalance(), 2000);
        }
    }

    // Initialize the balance fixer
    init() {
        if (this.initialized) return;
        
        console.log('Balance Fix: Initializing...');
        this.initialized = true;

        // Override balance calculations
        this.overrideBalanceCalculations();

        // Fix balance immediately
        setTimeout(() => this.fixBalance(), 1000);

        // Fix balance when page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(() => this.fixBalance(), 500);
            }
        });

        // Fix balance when window gains focus
        window.addEventListener('focus', () => {
            setTimeout(() => this.fixBalance(), 500);
        });

        // Periodic balance check (every 30 seconds)
        setInterval(() => this.fixBalance(), 30000);

        console.log('Balance Fix: Initialized successfully');
    }
}

// Create global instance
window.balanceFixer = new BalanceFixer();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => window.balanceFixer.init(), 2000);
    });
} else {
    setTimeout(() => window.balanceFixer.init(), 2000);
}

// Export for manual use
window.fixBalance = () => window.balanceFixer.fixBalance();