// Integration with existing authentication system
import FirebaseAuthService from './firebase-auth.js';
import FirebaseDatabaseService from './firebase-database.js';

// Update existing auth.js to use Firebase
class AuthManager {
  constructor() {
    this.isLoggedIn = false;
    this.currentUser = null;
    this.initializeFirebaseAuth();
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
    // Use class selectors instead of IDs to match the HTML structure
    const loginBtn = document.querySelector('.btn-login');
    const registerBtn = document.querySelector('.btn-register');
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

  showMessage(message, type) {
    // Implementation for showing messages
    console.log(`${type}: ${message}`);
    
    // Create a simple notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 5px;
      color: white;
      font-weight: bold;
      z-index: 10000;
      ${type === 'success' ? 'background-color: #28a745;' : 'background-color: #dc3545;'}
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
    }
  }
}

// Initialize auth manager
const authManager = new AuthManager();

// Make it globally available
window.authManager = authManager;

export default authManager;