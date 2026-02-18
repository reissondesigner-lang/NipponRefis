import { auth, db } from "../firebase-config.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let usuarioLogado = null;

const loginScreen = document.getElementById("login-screen");
const adminScreen = document.getElementById("admin-screen");


// ===============================
// NAVEGAÇÃO
// ===============================

function showLogin() {
  loginScreen.classList.add("active");
  adminScreen.classList.remove("active");
}

function showAdmin() {
  loginScreen.classList.remove("active");
  adminScreen.classList.add("active");
}


// ===============================
// LOGIN
// ===============================

window.handleLogin = async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Preencha e-mail e senha.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    alert(e.message);
  }
};


// ===============================
// CONTROLE DE SESSÃO
// ===============================

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    usuarioLogado = null;
    showLogin();
    return;
  }

  usuarioLogado = user;

  const docSnap = await getDoc(doc(db, "users", user.uid));

  if (!docSnap.exists()) {
    alert("Usuário não encontrado.");
    signOut(auth);
    return;
  }

  const data = docSnap.data();

  if (data.role !== "admin") {
    alert("Acesso negado.");
    signOut(auth);
    return;
  }

  showAdmin();
  renderUsuarios();
});


// ===============================
// RENDER USUÁRIOS
// ===============================

window.renderUsuarios = async () => {

  const lista = document.getElementById("lista-usuarios");
  lista.innerHTML = "Carregando...";

  const snap = await getDocs(collection(db, "users"));

  lista.innerHTML = "";

  let total = 0;
  let ativos = 0;
  let bloqueados = 0;

  snap.forEach(d => {

    const u = d.data();

    if (u.role === "admin") return;

    total++;

    if (u.pago) ativos++;
    else bloqueados++;

    lista.innerHTML += `
      <div class="cliente-card">
        <div>
          <h4>${u.email}</h4>
          <small>Status: ${u.pago ? "Ativo" : "Bloqueado"}</small>
        </div>

        <div class="card-actions">
          <button onclick="togglePagamento('${d.id}', ${u.pago})">
            ${u.pago ? "Bloquear" : "Ativar"}
          </button>

          <button onclick="excluirUsuario('${d.id}')" class="btn-small">
            🗑 Excluir
          </button>
        </div>
      </div>
    `;
  });

  document.getElementById("total-users").innerText = total;
  document.getElementById("ativos").innerText = ativos;
  document.getElementById("bloqueados").innerText = bloqueados;
};


// ===============================
// ATIVAR / BLOQUEAR
// ===============================

window.togglePagamento = async (uid, statusAtual) => {

  await updateDoc(doc(db, "users", uid), {
    pago: !statusAtual
  });

  renderUsuarios();
};


// ===============================
// EXCLUIR USUÁRIO
// ===============================

window.excluirUsuario = async (uid) => {

  if (!confirm("Deseja realmente excluir este usuário?")) return;

  await deleteDoc(doc(db, "users", uid));

  renderUsuarios();
};


// ===============
