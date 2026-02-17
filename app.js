import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

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
  Timestamp 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";

let usuarioLogado = null;
let msgPadrao = "Olá [NOME], Seu refil [MODELO] vence em [DATA]. Vamos trocar?";


// ============================
// NAVEGAÇÃO
// ============================

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


// ============================
// AUTENTICAÇÃO
// ============================

window.handleLogin = () => {
  const email = document.getElementById('email').value;
  const senha = document.getElementById('password').value;

  signInWithEmailAndPassword(auth, email, senha)
    .catch(err => alert("Erro: " + err.message));
};

window.handleSignup = async () => {
  const email = document.getElementById('email').value;
  const senha = document.getElementById('password').value;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);

    await setDoc(doc(db, "users", cred.user.uid), {
      nome: "",
      email,
      subscriptionStatus: "inactive", // começa bloqueado
      estoque9: 0,
      estoque12: 0,
      msgCustom: msgPadrao,
      createdAt: Timestamp.now()
    });

    alert("Conta criada! Regularize sua assinatura.");
  } catch (err) {
    alert(err.message);
  }
};


// ============================
// OBSERVADOR AUTH
// ============================

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLogin();
    return;
  }

  usuarioLogado = user;

  const userRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    showLogin();
    return;
  }

  const dados = userDoc.data();

  if (dados.subscriptionStatus !== "active") {
    showBlock();
    return;
  }

  msgPadrao = dados.msgCustom || msgPadrao;

  document.getElementById('estoque-badge').innerText =
    (dados.estoque9 || 0) + (dados.estoque12 || 0);

  showApp();
  renderClientes();
});


// ============================
// CLIENTES (AGORA ISOLADO)
// ============================

window.renderClientes = async () => {
  if (!usuarioLogado) return;

  const clientesRef = collection(db, "users", usuarioLogado.uid, "clientes");

  const q = query(clientesRef, orderBy("proximaTroca", "asc"));
  const snap = await getDocs(q);

  const lista = document.getElementById('lista-clientes');
  lista.innerHTML = "";

  let h = 0, a = 0, s = 0;

  const hoje = new Date();
  hoje.setHours(0,0,0,0);

  snap.forEach(docSnap => {
    const item = docSnap.data();
    const prox = item.proximaTroca.toDate();
    prox.setHours(0,0,0,0);

    const diff = Math.ceil((prox - hoje) / (1000*60*60*24));

    let cls = diff < 0 ? "status-vencido" :
              diff === 0 ? "status-hoje" :
              diff <= 7 ? "status-hoje" :
              "status-ok";

    if(diff < 0) a++;
    else if(diff === 0) h++;
    else if(diff <= 7) s++;

    lista.innerHTML += `
      <div class="cliente-card ${cls}">
        <div class="card-linha">
          <div>
            <h4>${item.nome}</h4>
            <small>${item.qtd}x ${item.modelo==9?'Alcaline':'Alcaline Max'}</small>
          </div>
          <div style="display:flex; gap:5px">
            <button onclick="notificar('${item.nome}','${item.whatsapp}','${prox.toLocaleDateString()}','${item.modelo}')" class="btn-round btn-wpp">WP</button>
          </div>
        </div>
        <div class="card-linha">
          <span>Troca: <b>${prox.toLocaleDateString()}</b></span>
        </div>
      </div>
    `;
  });

  document.getElementById('count-hoje').innerText = h;
  document.getElementById('count-atrasados').innerText = a;
  document.getElementById('count-7dias').innerText = s;
};


// ============================
// NOTIFICAÇÃO WHATSAPP
// ============================

window.notificar = (n, t, d, m) => {
  const mod = m == 9 ? "Alcaline" : "Alcaline Max";

  const msg = msgPadrao
    .replace("[NOME]", n)
    .replace("[DATA]", d)
    .replace("[MODELO]", mod);

  window.open(
    `https://wa.me/55${t.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`,
    '_blank'
  );
};


// ============================
// CONFIGURAÇÕES
// ============================

window.salvarTudoConfig = async () => {
  const novaMsg = document.getElementById('msg-custom-input').value;
  const s9 = parseInt(document.getElementById('stock-9').value) || 0;
  const s12 = parseInt(document.getElementById('stock-12').value) || 0;

  await updateDoc(doc(db, "users", usuarioLogado.uid), {
    msgCustom: novaMsg,
    estoque9: s9,
    estoque12: s12
  });

  msgPadrao = novaMsg;
  document.getElementById('estoque-badge').innerText = s9 + s12;

  alert("Salvo!");
};


// ============================
// LOGOUT
// ============================

window.logout = () => {
  if (confirm("Sair?")) signOut(auth);
};
