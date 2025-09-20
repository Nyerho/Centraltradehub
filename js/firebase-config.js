// Firebase Configuration - Compat version for non-module loading
// Import Firebase scripts in HTML first:
// <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-storage-compat.js"></script>

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAwnWoLfrEc1EtXWCD0by5L0VtCmYf8Unw",
    authDomain: "centraltradehub-30f00.firebaseapp.com",
    projectId: "centraltradehub-30f00",
    storageBucket: "centraltradehub-30f00.firebasestorage.app",
    messagingSenderId: "745751687877",
    appId: "1:745751687877:web:4576449aa2e8360931b6ac",
    measurementId: "G-YHCS5CH450"
};

// Initialize Firebase (compat version)
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Set authentication persistence to LOCAL (survives browser restarts)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((error) => {
    console.error('Error setting auth persistence:', error);
});

// Debug: Log successful initialization
console.log('Firebase initialized successfully');
console.log('Auth domain:', firebaseConfig.authDomain);
console.log('Project ID:', firebaseConfig.projectId);

// Add error handling for auth state changes
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('User is signed in:', user.email);
    } else {
        console.log('User is signed out');
    }
}, (error) => {
    console.error('Auth state change error:', error);
});

// Make services globally available
window.firebaseAuth = auth;
window.firebaseDb = db;
window.firebaseStorage = storage;

// Export for ES6 modules (when loaded as module)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { auth, db, storage };
} else if (typeof window !== 'undefined') {
    window.auth = auth;
    window.db = db;
    window.storage = storage;
}