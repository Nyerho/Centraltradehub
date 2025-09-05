// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

// Initialize Firebase services
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Export the initialized services
export { app, analytics, auth, db, storage };