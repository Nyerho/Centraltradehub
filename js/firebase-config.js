import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Your web app's Firebase configuration
// IMPORTANT: storageBucket must be the appspot.com bucket, not firebasestorage.app
const firebaseConfig = {
  apiKey: "AIzaSyAwnWoLfrEc1EtXWCD0by5L0VtCmYf8Unw",
  authDomain: "centraltradehub-30f00.firebaseapp.com",
  projectId: "centraltradehub-30f00",
  storageBucket: "centraltradehub-30f00.firebasestorage.app",
  messagingSenderId: "745751687877",
  appId: "1:745751687877:web:4576449aa2e8360931b6ac",
  measurementId: "G-YHCS5CH450"
};

// Initialize Firebase singletons and export for reuse
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;