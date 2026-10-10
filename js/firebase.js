import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAOnWIel6u33KXHE-4esX3cC1pUVxBniFY",
  authDomain: "smhos-d55dc.firebaseapp.com",
  projectId: "smhos-d55dc",
  storageBucket: "smhos-d55dc.firebasestorage.app",
  messagingSenderId: "798910312309",
  appId: "1:798910312309:web:d6239eb4473973d60eed3c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase Authentication
export const auth = getAuth(app);

// Firestore Database
export const db = getFirestore(app);


