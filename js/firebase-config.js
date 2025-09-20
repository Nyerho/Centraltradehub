// Firebase Configuration - Modular SDK v10.7.1
// No CDN scripts needed - imports directly from Firebase CDN

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
  getAuth, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
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

// Set authentication persistence to LOCAL (survives browser restarts)
try {
    await setPersistence(auth, browserLocalPersistence);
    console.log('✅ Auth persistence set to LOCAL');
} catch (error) {
    console.error('❌ Error setting auth persistence:', error);
}

// Debug: Log successful initialization
console.log('✅ Firebase initialized successfully (Modular SDK)');
console.log('📊 Auth domain:', firebaseConfig.authDomain);
console.log('📊 Project ID:', firebaseConfig.projectId);

// Add error handling for auth state changes
onAuthStateChanged(auth, 
    (user) => {
        if (user) {
            console.log('👤 User signed in:', user.email);
        } else {
            console.log('👤 User signed out');
        }
    },
    (error) => {
        console.error('❌ Auth state change error:', error);
    }
);

// Make services globally available for backward compatibility
window.firebaseAuth = auth;
window.firebaseDb = db;
window.firebaseStorage = storage;
window.auth = auth;
window.db = db;
window.storage = storage;

// Global error handler for unhandled Firebase errors
window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.code?.startsWith('auth/') || 
        event.reason?.code?.startsWith('firestore/') ||
        event.reason?.code?.startsWith('storage/')) {
        console.error('🔥 Firebase Error:', event.reason);
        // Prevent the error from appearing in console as unhandled
        event.preventDefault();
    }
});

console.log('🚀 Firebase services ready and globally available');

// Export services for ES6 modules
export { auth, db, storage, app };
export default { auth, db, storage, app };