import { auth, db } from './firebase-config.js';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const loginScreen = document.getElementById("loginScreen");
const blockedScreen = document.getElementById("blockedScreen");
const appScreen = document.getElementById("appScreen");

document.getElementById("loginBtn").onclick = async () => {
  const email = email.value;
  const password = password.value;
  await signInWithEmailAndPassword(auth, email, password);
};

document.getElementById("registerBtn").onclick = async () => {
  const email = email.value;
  const password = password.value;

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  await setDoc(doc(db, "users", user.uid), {
    email: user.email,
    estoque12: 0,
    estoque9: 0,
    msgCustom: "",
    pago: false,
    createdAt: new Date()
  });
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginScreen.style.display = "block";
    blockedScreen.style.display = "none";
    appScreen.style.display = "none";
    return;
  }

  const userDoc = await getDoc(doc(db, "users", user.uid));

  if (!userDoc.exists()) return;

  const data = userDoc.data();

  if (data.pago === true) {
    loginScreen.style.display = "none";
    blockedScreen.style.display = "none";
    appScreen.style.display = "block";
  } else {
    loginScreen.style.display = "none";
    blockedScreen.style.display = "block";
    appScreen.style.display = "none";
  }
});

window.logout = () => {
  signOut(auth);
};
