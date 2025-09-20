// Firebase Configuration - Modular SDK v10.7.1
// No CDN scripts needed - imports directly from Firebase CDN

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
  getAuth, 
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence  // Changed from browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAwnWoLfrEc1EtXWCD0by5L0VtCmYf8Unw",
    authDomain: "centraltradehub-30f00.firebaseapp.com",
    projectId: "centraltradehub-30f00",
    storageBucket: "centraltradehub-30f00.firebasestorage.app",
    messagingSenderId: "745751687877",
    appId: "1:745751687877:web:4576449aa2e8360931b6ac",
    measurementId: "G-YHCS5CH450"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Set authentication persistence (wrapped in async function)
(async () => {
    try {
        await setPersistence(auth, browserSessionPersistence);
        console.log('✅ Auth persistence set to SESSION (no auto-login)');
    } catch (error) {
        console.error('❌ Error setting auth persistence:', error);
    }
})();

// Debug: Log successful initialization
console.log('✅ Firebase initialized successfully (Modular SDK)');
console.log('📊 Auth domain:', firebaseConfig.authDomain);
console.log('📊 Project ID:', firebaseConfig.projectId);

// Add error handling for auth state changes
onAuthStateChanged(auth, 
    (user) => {
        if (user) {
            console.log('👤 User signed in:', user.email);
            // Dispatch custom event for other modules
            window.dispatchEvent(new CustomEvent('firebaseUserSignedIn', { detail: user }));
        } else {
            console.log('👤 User signed out');
            // Dispatch custom event for other modules
            window.dispatchEvent(new CustomEvent('firebaseUserSignedOut'));
        }
    },
    (error) => {
        console.error('❌ Auth state change error:', error);
    }
);

// Make services globally available for compatibility
window.firebaseAuth = auth;
window.firebaseDb = db;
window.firebaseStorage = storage;
window.auth = auth;
window.db = db;
window.storage = storage;

// Global error handler for unhandled Firebase promises
window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.code && event.reason.code.startsWith('auth/')) {
        console.error('🔥 Firebase Auth Error:', event.reason);
        // Prevent the error from appearing in console as unhandled
        event.preventDefault();
    }
});

console.log('🚀 Firebase services ready and globally available');

// Export for ES6 modules
export { auth, db, storage, app };
export default { auth, db, storage, app };