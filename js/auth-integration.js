import FirebaseAuthService from './firebase-auth.js';
import FirebaseDatabaseService from './firebase-database.js';
import EmailService from './email-service.js';

class AuthManager {
  constructor() {
    this.emailService = new EmailService();
    this.initializeFirebaseAuth();
  }

  showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 5px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      max-width: 300px;
      word-wrap: break-word;
    `;
    
    if (type === 'success') {
      messageDiv.style.backgroundColor = '#22c55e';
    } else if (type === 'error') {
      messageDiv.style.backgroundColor = '#ef4444';
    } else {
      messageDiv.style.backgroundColor = '#3b82f6';
    }
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, 5000);
  }

  initializeFirebaseAuth() {
    FirebaseAuthService.onAuthStateChanged((user) => {
      this.currentUser = user;
      this.updateUI();
    });
  }

  async login(email, password) {
    try {
      const result = await FirebaseAuthService.signIn(email, password);
      
      if (result.success) {
        this.showMessage('Login successful! Redirecting...', 'success');
        
        // Check if user is admin
        const isAdmin = await this.checkAdminStatus();
        
        setTimeout(() => {
          if (isAdmin) {
            window.location.href = 'admin.html';
          } else {
            window.location.href = 'dashboard.html';
          }
        }, 1500);
        
        return true;
      } else {
        this.showMessage(result.message || 'Login failed. Please try again.', 'error');
        return false;
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
        // Send welcome email notification
        try {
          await this.emailService.sendWelcomeEmail(
            formData.email,
            `${formData.firstName} ${formData.lastName}`
          );
          console.log('Welcome email sent successfully');
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
          // Don't fail registration if email fails
        }
        
        this.showMessage(result.message, 'success');
        // Fix: Use global closeModal function instead of this.closeModal
        if (typeof closeModal === 'function') {
          closeModal('registerModal');
        }
        
        // Add redirect to dashboard after successful registration
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1500); // Small delay to show success message
        
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
      await FirebaseAuthService.signOut();
      this.showMessage('Logged out successfully', 'success');
      
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    } catch (error) {
      console.error('Logout error:', error);
      this.showMessage('Error logging out', 'error');
    }
  }

  getErrorMessage(errorCode) {
    const errorMessages = {
      'auth/user-not-found': 'No account found with this email address.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/weak-password': 'Password should be at least 6 characters long.',
      'auth/invalid-credential': 'Invalid login credentials. Please check your email and password.'
    };
    
    return errorMessages[errorCode] || 'An error occurred. Please try again.';
  }

  updateUI() {
    // Update UI elements based on authentication state
    const userElements = document.querySelectorAll('[data-user-only]');
    const guestElements = document.querySelectorAll('[data-guest-only]');
    
    if (this.currentUser) {
      userElements.forEach(el => el.style.display = 'block');
      guestElements.forEach(el => el.style.display = 'none');
      
      // Update user info displays
      const userNameElements = document.querySelectorAll('.user-name, #dashboard-user-name');
      const userEmailElements = document.querySelectorAll('.user-email, #userEmail');
      
      userNameElements.forEach(el => {
        el.textContent = this.currentUser.displayName || this.currentUser.email;
      });
      
      userEmailElements.forEach(el => {
        el.textContent = this.currentUser.email;
      });
      
      // Update avatar initials
      const avatarElements = document.querySelectorAll('.avatar-initial');
      avatarElements.forEach(el => {
        const name = this.currentUser.displayName || this.currentUser.email;
        el.textContent = name.charAt(0).toUpperCase();
      });
    } else {
      userElements.forEach(el => el.style.display = 'none');
      guestElements.forEach(el => el.style.display = 'block');
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAdmin() {
    return this.currentUser && this.currentUser.email === 'admin@centraltradehub.com';
  }

  async checkAdminStatus() {
    if (!this.currentUser) return false;
    
    try {
      const userData = await FirebaseDatabaseService.getUserData(this.currentUser.uid);
      return userData && userData.role === 'admin';
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }
}

// Create and export auth manager instance
const authManager = new AuthManager();
window.authManager = authManager;

export default authManager;