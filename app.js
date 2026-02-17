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

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen"); // use o ID original do seu app
const blockedScreen = document.getElementById("blocked-screen"); // se existir

// LOGIN
window.handleLogin = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Preencha e-mail e senha.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert(error.message);
  }
};

// CADASTRO
window.handleSignup = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Preencha e-mail e senha.");
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

    alert("Conta criada! Aguarde ativação.");
  } catch (error) {
    alert(error.message);
  }
};

// CONTROLE DE SESSÃO
onAuthStateChanged(auth, async (user) => {

  if (!user) {
    loginScreen.classList.add("active");
    return;
  }

  const docSnap = await getDoc(doc(db, "users", user.uid));

  if (!docSnap.exists()) return;

  const data = docSnap.data();

  if (data.pago) {
    loginScreen.classList.remove("active");
    appScreen.classList.add("active");
  } else {
    loginScreen.classList.remove("active");
    blockedScreen.classList.add("active");
  }
});


window.logout = () => {
  signOut(auth);
};
