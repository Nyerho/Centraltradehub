// Integration with existing authentication system
import FirebaseAuthService from './firebase-auth.js';
import FirebaseDatabaseService from './firebase-database.js';

// Update existing auth.js to use Firebase
class AuthManager {
  constructor() {
    this.firebaseAuth = FirebaseAuthService;
    this.currentUser = null;
    this.isLoggedIn = false;
    this.init();
    this.initializeFirebaseAuth(); // Add this missing call
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
    this.currentUser = user;
    this.updateUI();
  }
}

// Initialize AuthManager and make it globally available
const authManager = new AuthManager();
window.authManager = authManager;

// Export for module usage
export default authManager;