// Firebase Authentication Service
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser,
  sendEmailVerification
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase-config.js';

class FirebaseAuthService {
  constructor() {
    this.currentUser = null;
    this.authStateListeners = [];
    this.initializeAuthListener();
  }

  // Initialize authentication state listener
  initializeAuthListener() {
    onAuthStateChanged(auth, async (user) => {
      this.currentUser = user;
      if (user) {
        await this.syncUserProfile(user);
      }
      this.notifyAuthStateListeners(user);
    });
  }

  // Register new user
  async register(email, password, userData = {}) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update user profile
      await updateProfile(user, {
        displayName: userData.displayName || userData.firstName + ' ' + userData.lastName
      });

      // Create user document in Firestore
      await this.createUserDocument(user, userData);

      // Send email verification
      await sendEmailVerification(user);

      return {
        success: true,
        user: user,
        message: 'Registration successful. Please verify your email.'
      };
    } catch (error) {
      return {
        success: false,
        error: error.code,
        message: this.getErrorMessage(error.code)
      };
    }
  }

  // Sign in user
  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update last login
      await this.updateLastLogin(user.uid);

      return {
        success: true,
        user: user,
        message: 'Sign in successful'
      };
    } catch (error) {
      return {
        success: false,
        error: error.code,
        message: this.getErrorMessage(error.code)
      };
    }
  }

  // Sign out user
  async signOut() {
    try {
      await signOut(auth);
      return {
        success: true,
        message: 'Sign out successful'
      };
    } catch (error) {
      return {
        success: false,
        error: error.code,
        message: this.getErrorMessage(error.code)
      };
    }
  }

  // Reset password
  async resetPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      return {
        success: true,
        message: 'Password reset email sent'
      };
    } catch (error) {
      return {
        success: false,
        error: error.code,
        message: this.getErrorMessage(error.code)
      };
    }
  }

  // Update user password
  async updateUserPassword(currentPassword, newPassword) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No authenticated user');

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      return {
        success: true,
        message: 'Password updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.code,
        message: this.getErrorMessage(error.code)
      };
    }
  }

  // Create user document in Firestore
  async createUserDocument(user, userData) {
    const userRef = doc(db, 'users', user.uid);
    const userDoc = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      createdAt: new Date(),
      lastLogin: new Date(),
      profile: {
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        phone: userData.phone || '',
        country: userData.country || '',
        dateOfBirth: userData.dateOfBirth || null,
        address: userData.address || ''
      },
      trading: {
        accountType: 'demo',
        balance: 10000, // Demo balance
        currency: 'USD',
        leverage: '1:100',
        accountStatus: 'active'
      },
      preferences: {
        theme: 'dark',
        language: 'en',
        notifications: {
          email: true,
          push: true,
          trading: true,
          news: true
        }
      }
    };

    await setDoc(userRef, userDoc);
  }

  // Sync user profile
  async syncUserProfile(user) {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        await this.createUserDocument(user, {});
      }
    } catch (error) {
      console.error('Error syncing user profile:', error);
    }
  }

  // Update last login
  async updateLastLogin(uid) {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        lastLogin: new Date()
      });
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }

  // Add authentication state listener
  addAuthStateListener(callback) {
    this.authStateListeners.push(callback);
  }

  // Remove authentication state listener
  removeAuthStateListener(callback) {
    this.authStateListeners = this.authStateListeners.filter(listener => listener !== callback);
  }

  // Notify authentication state listeners
  notifyAuthStateListeners(user) {
    this.authStateListeners.forEach(callback => callback(user));
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser;
  }

  // Get error message
  getErrorMessage(errorCode) {
    const errorMessages = {
      'auth/user-not-found': 'No user found with this email address.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/weak-password': 'Password should be at least 6 characters.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
      'auth/requires-recent-login': 'Please sign in again to complete this action.'
    };

    return errorMessages[errorCode] || 'An unexpected error occurred.';
  }
}

// Export singleton instance
export default new FirebaseAuthService();