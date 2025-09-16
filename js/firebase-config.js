// Firebase Configuration - Updated with correct credentials
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

// Set authentication persistence to LOCAL (survives browser restarts)
setPersistence(auth, browserLocalPersistence).catch((error) => {
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

export { app, auth, db, storage, analytics };