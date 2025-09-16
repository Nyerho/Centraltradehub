// Firebase Configuration - Fixed
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBvOkBwNQI0GBYuFII-HrEh-rjMO-CW4oo",
    authDomain: "centraltradehub-30f00.firebaseapp.com",
    projectId: "centraltradehub-30f00",
    storageBucket: "centraltradehub-30f00.firebasestorage.app",
    messagingSenderId: "522674886045",
    appId: "1:522674886045:web:4f8f5e9c8e9c8e9c8e9c8e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Set authentication persistence to LOCAL (survives browser restarts)
setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Error setting auth persistence:', error);
});

// Add error handling for auth state changes
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('User is signed in:', user.email);
    } else {
        console.log('User is signed out');
    }
});

export { app, auth, db, storage };