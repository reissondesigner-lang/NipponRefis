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

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

document.getElementById("loginBtn").onclick = async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    alert("Preencha email e senha.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Erro no login: " + error.message);
  }
};

document.getElementById("registerBtn").onclick = async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    alert("Preencha email e senha.");
    return;
  }

  try {
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

  } catch (error) {
    alert("Erro ao criar conta: " + error.message);
  }
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
