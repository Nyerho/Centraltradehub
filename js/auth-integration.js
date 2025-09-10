// Integration with existing authentication system
import FirebaseAuthService from './firebase-auth.js';
import FirebaseDatabaseService from './firebase-database.js';

// Update existing auth.js to use Firebase
class AuthManager {
  constructor() {
    this.firebaseAuth = FirebaseAuthService;
    this.databaseService = FirebaseDatabaseService; // Add missing databaseService
    this.currentUser = null;
    this.isLoggedIn = false;
    this.initializeFirebaseAuth();
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
      this.updateUI(); // This calls the main updateUI method
    });
  }

  async login(email, password) {
    try {
        this.showMessage('Signing in...', 'info');
        
        // Fix: Use the correct method name 'signIn' instead of 'signInWithEmailAndPassword'
        const result = await this.firebaseAuth.signIn(email, password);
        
        // Check if login was successful
        if (!result.success) {
            this.showMessage(result.message || 'Login failed', 'error');
            return;
        }
        
        this.showMessage('Login successful!', 'success');
        
        // Close modal if it exists
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Update UI immediately
        this.updateUI();
        
        // Redirect based on user role with proper error handling
        try {
            const userDoc = await this.databaseService.getUserProfile(result.user.uid);
            if (userDoc && userDoc.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                // Redirect to dashboard instead of platform
                window.location.href = 'dashboard.html';
            }
        } catch (dbError) {
            console.warn('Could not fetch user profile, redirecting to dashboard:', dbError);
            // Default redirect to dashboard if profile fetch fails
            window.location.href = 'dashboard.html';
        }
        
    } catch (error) {
        console.error('Login error:', error);
        this.showMessage(this.getErrorMessage(error.code), 'error');
    }
}

  async register(formData) {
    try {
      // Validate required fields
      if (!formData.email || !formData.password) {
        this.showMessage('Email and password are required.', 'error');
        return false;
      }

      if (!formData.firstName || !formData.lastName) {
        this.showMessage('First name and last name are required.', 'error');
        return false;
      }

      // Check password strength
      if (formData.password.length < 6) {
        this.showMessage('Password must be at least 6 characters long.', 'error');
        return false;
      }

      const result = await FirebaseAuthService.register(
        formData.email,
        formData.password,
        {
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone || '',
          country: formData.country || 'Not specified',
          displayName: `${formData.firstName} ${formData.lastName}`
        }
      );
      
      if (result.success) {
        this.showMessage(result.message, 'success');
        // Fix: Use global closeModal function instead of this.closeModal
        if (typeof closeModal === 'function') {
          closeModal('registerModal');
        }
        return true;
      } else {
        // Show specific error message from Firebase
        this.showMessage(result.message || 'Registration failed. Please try again.', 'error');
        console.error('Registration error details:', result);
        return false;
      }
    } catch (error) {
      console.error('Registration error:', error);
      // Show more specific error message
      let errorMessage = 'Registration failed. Please try again.';
      
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'This email is already registered. Please use a different email or try logging in.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Please enter a valid email address.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Password is too weak. Please use at least 6 characters.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your internet connection.';
            break;
          default:
            errorMessage = `Registration failed: ${error.message}`;
        }
      }
      
      this.showMessage(errorMessage, 'error');
      return false;
    }
  }

  async logout() {
    try {
      await FirebaseAuthService.logout();
      this.showMessage('Logged out successfully!', 'success');
      
      // Redirect to home page
      window.location.href = 'index.html';
    } catch (error) {
      console.error('Logout error:', error);
      this.showMessage('Error logging out. Please try again.', 'error');
    }
  }

  // Add the missing getErrorMessage method
  getErrorMessage(errorCode) {
    const errorMessages = {
      'auth/user-not-found': 'No account found with this email address.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Please check your internet connection.',
      'auth/invalid-credential': 'Invalid email or password. Please check your credentials.',
      'auth/email-already-in-use': 'This email is already registered.',
      'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
      'auth/operation-not-allowed': 'Email/password accounts are not enabled.',
      'auth/requires-recent-login': 'Please log in again to complete this action.'
    };
    
    return errorMessages[errorCode] || 'An unexpected error occurred. Please try again.';
  }

  // Add the main updateUI method to fix admin button visibility
  updateUI() {
      const loginButtons = document.querySelectorAll('.btn-login, .btn-login-account, .login-btn, .btn-secondary[href="auth.html"], .trade-btn[href="auth.html"]');
      const registerButtons = document.querySelectorAll('.btn-register, .btn-primary[href="auth.html#register"], .btn-start-trading, .btn-primary[href="auth.html"], .trade-btn, a[href="auth.html#register"]');
      const adminButton = document.querySelector('.btn-admin');
      const userMenu = document.querySelector('.user-menu');
      
      // Update navigation buttons on home page
      const loginBtn = document.getElementById('loginBtn');
      const getStartedBtn = document.getElementById('getStartedBtn');
      const dashboardBtn = document.getElementById('dashboardBtn');
  
      if (this.isLoggedIn) {
          // Hide login/register buttons
          loginButtons.forEach(btn => {
              if (btn && btn.id !== 'loginBtn') btn.style.display = 'none';
          });
          registerButtons.forEach(btn => {
              if (btn && btn.id !== 'getStartedBtn') btn.style.display = 'none';
          });
          
          // Update home page navigation
          if (loginBtn) loginBtn.style.display = 'none';
          if (getStartedBtn) getStartedBtn.style.display = 'none';
          if (dashboardBtn) dashboardBtn.style.display = 'inline-block';
  
          // Show admin button ONLY for authorized admins
          if (adminButton) {
              this.checkAdminStatus().then(isAdmin => {
                  adminButton.style.display = isAdmin ? 'inline-block' : 'none';
              });
          }
  
          // Show user menu if available
          if (userMenu) {
              userMenu.style.display = 'block';
              const userName = userMenu.querySelector('.user-name');
              if (userName && this.currentUser) {
                  userName.textContent = this.currentUser.displayName || this.currentUser.email;
              }
          }
  
          // Add logout functionality
          const logoutBtn = document.querySelector('.btn-logout');
          if (logoutBtn) {
              logoutBtn.onclick = () => this.logout();
          }
      } else {
          // Show login/register buttons
          loginButtons.forEach(btn => {
              if (btn) btn.style.display = 'inline-block';
          });
          registerButtons.forEach(btn => {
              if (btn) btn.style.display = 'inline-block';
          });
          
          // Update home page navigation
          if (loginBtn) loginBtn.style.display = 'inline-block';
          if (getStartedBtn) getStartedBtn.style.display = 'inline-block';
          if (dashboardBtn) dashboardBtn.style.display = 'none';
  
          // Hide admin button and user menu
          if (adminButton) adminButton.style.display = 'none';
          if (userMenu) userMenu.style.display = 'none';
      }
  }
  // Add missing getCurrentUser method
  getCurrentUser() {
    return this.currentUser;
  }

  // Add method to check if user is admin
  isAdmin() {
    const adminEmails = [
      'admin@centraltradehub.com',
      'owner@centraltradehub.com'
    ];
    return this.isLoggedIn && this.currentUser && adminEmails.includes(this.currentUser.email);
  }
}

// Initialize AuthManager and make it globally available
const authManager = new AuthManager();
window.authManager = authManager;

// Export for module usage
export default authManager;