import FirebaseAuthService from './firebase-auth.js';
import FirebaseDatabaseService from './firebase-database.js';

class AuthManager {
  constructor() {
    this.initializeEmailService();
    this.initializeFirebaseAuth();
  }

  async initializeEmailService() {
    try {
      const { default: EmailService } = await import('./email-service.js');
      this.emailService = new EmailService();
      console.log('Email service initialized successfully');
    } catch (error) {
      console.warn('Email service failed to initialize:', error.message);
      this.emailService = null; // Continue without email service
    }
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
    // Fix: Use addAuthStateListener instead of onAuthStateChanged
    FirebaseAuthService.addAuthStateListener((user) => {
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
      console.log('Starting registration process...');
      console.log('Form data received:', formData);
      
      // Create proper data structure for Firebase
      const firebaseUserData = {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        country: formData.country,
        displayName: `${formData.firstName} ${formData.lastName}`.trim()
      };
      
      console.log('Sending to Firebase:', firebaseUserData);
      
      // Register with Firebase
      const result = await FirebaseAuthService.register(
        firebaseUserData.email,
        firebaseUserData.password,
        firebaseUserData
      );
      
      if (result.success) {
        console.log('Registration successful');
        this.showMessage('Registration successful! Please check your email for verification.', 'success');
        
        // Send welcome email only if email service is available
        if (this.emailService) {
          try {
            await this.emailService.sendWelcomeEmail(
              firebaseUserData.email, 
              firebaseUserData.displayName
            );
            console.log('Welcome email sent successfully');
          } catch (emailError) {
            console.warn('Failed to send welcome email:', emailError.message);
            // Don't fail registration if email fails
          }
        }
        
        return true;
      } else {
        console.error('Registration failed:', result);
        this.showMessage(result.message || 'Registration failed. Please try again.', 'error');
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
          case 'auth/operation-not-allowed':
            errorMessage = 'Email/password accounts are not enabled. Please contact support.';
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
      this.currentUser = null;
      this.showMessage('Logged out successfully', 'success');
      
      // Always redirect to index.html instead of auth.html to prevent loops
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
    
    // Use email-based admin validation (consistent with main.js)
    const adminEmails = [
      'admin@centraltradehub.com',
      'owner@centraltradehub.com'
    ];
    
    return adminEmails.includes(this.currentUser.email);
  }
}

// Create and export auth manager instance
const authManager = new AuthManager();
window.authManager = authManager;

export default authManager;