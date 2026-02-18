import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  getDoc, 
  setDoc, 
  orderBy, 
  Timestamp,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";

let usuarioLogado = null;
let msgPadrao = "Olá [NOME], Seu refil [MODELO] vence em [DATA]. Vamos trocar?";
let clienteEditandoId = null;

/* ============================= */
/* NAVEGAÇÃO */
/* ============================= */

function showApp() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('block-screen').classList.remove('active');
  document.getElementById('main-app').classList.add('active');
}

function showLogin() {
  document.getElementById('main-app').classList.remove('active');
  document.getElementById('block-screen').classList.remove('active');
  document.getElementById('login-screen').classList.add('active');
}

function showBlock() {
  document.getElementById('main-app').classList.remove('active');
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('block-screen').classList.add('active');
}

/* ============================= */
/* AUTENTICAÇÃO */
/* ============================= */

window.handleLogin = async () => {
  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('password').value.trim();
  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (err) {
    alert(err.message);
  }
};

window.handleSignup = async () => {
  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('password').value.trim();

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);

    await setDoc(doc(db, "users", cred.user.uid), {
      email,
      pago: false,
      estoque9: 0,
      estoque12: 0,
      msgCustom: msgPadrao,
      createdAt: new Date()
    });

    alert("Conta criada! Aguarde ativação via PIX.");
  } catch (err) {
    alert(err.message);
  }
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    usuarioLogado = null;
    showLogin();
    return;
  }

  usuarioLogado = user;
  const userDoc = await getDoc(doc(db, "users", user.uid));

  if (!userDoc.exists()) {
    showLogin();
    return;
  }

  const data = userDoc.data();

  if (data.pago !== true) {
    showBlock();
    return;
  }

  msgPadrao = data.msgCustom || msgPadrao;
  document.getElementById('estoque-badge').innerText =
    (data.estoque9 || 0) + (data.estoque12 || 0);

  showApp();
  renderClientes();
});

window.logout = () => {
  if (confirm("Sair?")) signOut(auth);
};

/* ============================= */
/* CLIENTES */
/* ============================= */

window.abrirModalCadastro = () => {
  clienteEditandoId = null;
  document.getElementById('modal-cliente').classList.remove('hidden');
};

window.fecharModal = () => {
  document.getElementById('modal-cliente').classList.add('hidden');
};

window.salvarCliente = async () => {
  const nome = document.getElementById('nome-cliente').value;
  const whatsapp = document.getElementById('whatsapp-cliente').value;
  const dataVenda = document.getElementById('data-venda').value;
  const modelo = parseInt(document.getElementById('modelo-refil-valor').value);
  const qtd = parseInt(document.getElementById('qtd-refil').value);

  const dataBase = new Date(dataVenda);
  const proxima = new Date(dataBase);
  proxima.setMonth(proxima.getMonth() + modelo);

  const dados = {
    nome,
    whatsapp,
    dataVenda: Timestamp.fromDate(dataBase),
    proximaTroca: Timestamp.fromDate(proxima),
    modelo,
    qtd,
    userId: usuarioLogado.uid
  };

  if (clienteEditandoId) {
    await updateDoc(doc(db, "clientes", clienteEditandoId), dados);
  } else {
    await addDoc(collection(db, "clientes"), dados);
  }

  fecharModal();
  renderClientes();
};

window.renderClientes = async () => {
  const lista = document.getElementById('lista-clientes');
  lista.innerHTML = "";

  const q = query(
    collection(db, "clientes"),
    where("userId", "==", usuarioLogado.uid),
    orderBy("proximaTroca", "asc")
  );

  const snap = await getDocs(q);

  snap.forEach(d => {
    const item = d.data();
    const prox = item.proximaTroca.toDate();

    lista.innerHTML += `
      <div class="cliente-card">
        <div class="card-linha">
          <div>
            <h4>${item.nome}</h4>
            <small>${item.qtd}x ${item.modelo == 9 ? 'Alcaline' : 'Alcaline Max'}</small>
          </div>
          <div style="display:flex; gap:5px">
            <button onclick="editarCliente('${d.id}')">ED</button>
            <button onclick="confirmarReposicao('${d.id}')">REP</button>
          </div>
        </div>
        <div>Troca: ${prox.toLocaleDateString()}</div>
      </div>
    `;
  });
};

window.editarCliente = async (id) => {
  const snap = await getDoc(doc(db, "clientes", id));
  if (!snap.exists()) return;

  const d = snap.data();

  document.getElementById('nome-cliente').value = d.nome;
  document.getElementById('whatsapp-cliente').value = d.whatsapp;
  document.getElementById('data-venda').value =
    d.dataVenda.toDate().toISOString().split("T")[0];
  document.getElementById('modelo-refil-valor').value = d.modelo;
  document.getElementById('qtd-refil').value = d.qtd;

  clienteEditandoId = id;
  abrirModalCadastro();
};

window.confirmarReposicao = async (id) => {
  if (!confirm("Confirmar reposição?")) return;

  const snap = await getDoc(doc(db, "clientes", id));
  const d = snap.data();

  const novaData = new Date();
  const proxima = new Date(novaData);
  proxima.setMonth(proxima.getMonth() + d.modelo);

  await updateDoc(doc(db, "clientes", id), {
    dataVenda: Timestamp.fromDate(novaData),
    proximaTroca: Timestamp.fromDate(proxima)
  });

  renderClientes();
};

/* ============================= */
/* CONFIGURAÇÕES */
/* ============================= */

window.abrirConfiguracoes = async () => {
  const userDoc = await getDoc(doc(db, "users", usuarioLogado.uid));
  const d = userDoc.data();

  document.getElementById('stock-9').value = d.estoque9 || 0;
  document.getElementById('stock-12').value = d.estoque12 || 0;
  document.getElementById('msg-custom-input').value = d.msgCustom || "";

  document.getElementById('modal-config').classList.remove('hidden');
};

window.fecharConfig = () => {
  document.getElementById('modal-config').classList.add('hidden');
};

window.salvarTudoConfig = async () => {
  const estoque9 = parseInt(document.getElementById('stock-9').value) || 0;
  const estoque12 = parseInt(document.getElementById('stock-12').value) || 0;
  const msg = document.getElementById('msg-custom-input').value;

  await updateDoc(doc(db, "users", usuarioLogado.uid), {
    estoque9,
    estoque12,
    msgCustom: msg
  });

  document.getElementById('estoque-badge').innerText =
    estoque9 + estoque12;

  fecharConfig();
};
