import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBbX57rW9ws4j28LxIVr4KM1CGxqghm4_8",
  authDomain: "nipponrefis.firebaseapp.com",
  projectId: "nipponrefis",
  storageBucket: "nipponrefis.firebasestorage.app",
  messagingSenderId: "714981606481",
  appId: "1:714981606481:web:be99b6ebd430231c212470"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
