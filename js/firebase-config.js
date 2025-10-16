import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Export the config object so modules can import { firebaseConfig }
export const firebaseConfig = {
  apiKey: "AIzaSyAwnWoLfrEc1EtXWCD0by5L0VtCmYf8Unw",
  authDomain: "centraltradehub-30f00.firebaseapp.com",
  projectId: "centraltradehub-30f00",
  storageBucket: "centraltradehub-30f00.firebasestorage.app",
  messagingSenderId: "745751687877",
  appId: "1:745751687877:web:4576449aa2e8360931b6ac",
  measurementId: "G-YHCS5CH450"
};

const app = initializeApp(firebaseConfig);

// Shared singletons
export const auth = getAuth(app);
export const storage = getStorage(app);
export const db = getFirestore(app);

export default app;