// Integration with existing authentication system
import FirebaseAuthService from './firebase-auth.js';
import FirebaseDatabaseService from './firebase-database.js';

// Update existing auth.js to use Firebase
class AuthManager {
  constructor() {
    this.firebaseAuth = FirebaseAuthService;
    this.currentUser = null;
    this.init();
  }

  // Add the missing showMessage method
  showMessage(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }
  initializeFirebaseAuth() {
    // Listen for authentication state changes
    FirebaseAuthService.addAuthStateListener((user) => {
      this.isLoggedIn = !!user;
      this.currentUser = user;
      this.updateUI();
    });
  }

  async login(email, password) {
    const result = await FirebaseAuthService.signIn(email, password);
    
    if (result.success) {
      this.showMessage('Login successful!', 'success');
      this.closeModal('loginModal');
      return true;
    } else {
      this.showMessage(result.message, 'error');
      return false;
    }
  }

  async register(formData) {
    try {
      const result = await FirebaseAuthService.register(
        formData.email,
        formData.password,
        {
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          country: formData.country
        }
      );
      
      if (result.success) {
        this.showMessage(result.message, 'success');
        this.closeModal('registerModal');
        return true;
      } else {
        this.showMessage(result.message, 'error');
        return false;
      }
    } catch (error) {
      console.error('Registration error:', error);
      this.showMessage('Registration failed. Please try again.', 'error');
      return false;
    }
  }

  async logout() {
    const result = await FirebaseAuthService.signOut();
    
    if (result.success) {
      this.showMessage('Logged out successfully!', 'success');
      // Redirect to home page
      window.location.href = 'index.html';
    }
  }

  updateUI() {
    const loginBtn = document.querySelector('.btn-login');
    const registerBtn = document.querySelector('.btn-register');
    const adminBtn = document.querySelector('.btn-admin');
    const userMenu = document.querySelector('.user-menu');
    const userName = document.querySelector('.user-name');
    const navButtons = document.querySelector('.nav-buttons');
    
    // Define admin emails
    const adminEmails = [
        'admin@centraltradehub.com',
        'owner@centraltradehub.com'
    ];
    
    if (this.isLoggedIn && this.currentUser) {
        // User is logged in - HIDE login and register buttons
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) registerBtn.style.display = 'none';
        
        // Show admin button only for authorized admins
        if (adminBtn) {
            adminBtn.style.display = adminEmails.includes(this.currentUser.email) ? 'inline-block' : 'none';
        }
        
        // Show user menu
        if (userMenu) {
            userMenu.style.display = 'flex';
            if (userName) {
                userName.textContent = this.currentUser.displayName || this.currentUser.email.split('@')[0];
            }
        }
        
        // Add logout button if it doesn't exist
        if (navButtons && !document.querySelector('.btn-logout')) {
            const logoutBtn = document.createElement('a');
            logoutBtn.href = '#';
            logoutBtn.className = 'btn-logout';
            logoutBtn.textContent = 'Logout';
            logoutBtn.style.cssText = 'background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-left: 10px;';
            logoutBtn.onclick = (e) => {
                e.preventDefault();
                this.logout();
            };
            navButtons.appendChild(logoutBtn);
        }
        
    } else {
        // User is NOT logged in - SHOW login and register buttons
        if (loginBtn) loginBtn.style.display = 'inline-block';
        if (registerBtn) registerBtn.style.display = 'inline-block'; // Fixed: was loginBtn, should be registerBtn
        if (adminBtn) adminBtn.style.display = 'none';
        if (userMenu) userMenu.style.display = 'none';
        
        // Remove logout button if it exists
        const logoutBtn = document.querySelector('.btn-logout');
        if (logoutBtn) {
            logoutBtn.remove();
        }
    }

    const navButtons = document.querySelector('.nav-buttons');
    
    if (this.isLoggedIn) {
        // Hide login and register buttons
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) {
            // Replace "Get Started" with logout button
            registerBtn.textContent = 'Logout';
            registerBtn.className = 'btn-logout';
            registerBtn.onclick = (e) => {
        e.preventDefault();
        this.logout();
      };
      registerBtn.href = '#';
    }
    
    // Add user welcome message if nav-buttons container exists
    if (navButtons && !document.querySelector('.user-welcome')) {
      const userWelcome = document.createElement('span');
      userWelcome.className = 'user-welcome';
      userWelcome.textContent = `Welcome, ${this.currentUser.displayName || this.currentUser.email.split('@')[0]}`;
      userWelcome.style.color = '#fff';
      userWelcome.style.marginRight = '15px';
      userWelcome.style.fontSize = '14px';
      navButtons.insertBefore(userWelcome, loginBtn);
    }
  } else {
    // Show login button and restore register button
    if (loginBtn) loginBtn.style.display = 'block';
    if (registerBtn) {
      registerBtn.textContent = 'Get Started';
      registerBtn.className = 'btn-register';
      registerBtn.onclick = null;
      registerBtn.href = '#register';
    }
    
    // Remove user welcome message
    const userWelcome = document.querySelector('.user-welcome');
    if (userWelcome) {
      userWelcome.remove();
    }
  }
}

// Initialize AuthManager and make it globally available
const authManager = new AuthManager();
window.authManager = authManager;

// Export for module usage
export default authManager;