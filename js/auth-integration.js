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
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const userMenu = document.getElementById('userMenu');
    
    if (this.isLoggedIn) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (registerBtn) registerBtn.style.display = 'none';
      if (userMenu) {
        userMenu.style.display = 'block';
        userMenu.innerHTML = `
          <div class="user-info">
            <span>Welcome, ${this.currentUser.displayName || this.currentUser.email}</span>
            <button onclick="authManager.logout()" class="btn-secondary">Logout</button>
          </div>
        `;
      }
    } else {
      if (loginBtn) loginBtn.style.display = 'block';
      if (registerBtn) registerBtn.style.display = 'block';
      if (userMenu) userMenu.style.display = 'none';
    }
  }

  showMessage(message, type) {
    // Implementation for showing messages
    console.log(`${type}: ${message}`);
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
export default authManager;