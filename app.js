import { auth, db } from "./firebase-config.js";

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

let usuarioLogado = null;
let msgPadrao = "Olá [NOME], Seu refil [MODELO] vence em [DATA]. Vamos trocar?";
let clienteEditando = null;

const loginScreen = document.getElementById("login-screen");
const blockScreen = document.getElementById("block-screen");
const mainApp = document.getElementById("main-app");


// ============================
// NAVEGAÇÃO
// ============================

function showLogin() {
  if (loginScreen) loginScreen.classList.add("active");
  if (blockScreen) blockScreen.classList.remove("active");
  if (mainApp) mainApp.classList.remove("active");
}

function showBlock() {
  loginScreen.classList.remove("active");
  blockScreen.classList.add("active");
  mainApp.classList.remove("active");
}

function showApp() {
  if (loginScreen) loginScreen.classList.remove("active");
  if (blockScreen) blockScreen.classList.remove("active");
  if (mainApp) mainApp.classList.add("active");
}

// ============================
// LOGIN / CADASTRO
// ============================

window.handleLogin = () => {
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


window.handleSignup = async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Preencha e-mail e senha.");
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", cred.user.uid), {
      email,
      pago: false,
      estoque9: 0,
      estoque12: 0,
      msgCustom: msgPadrao,
      createdAt: Timestamp.now()
    });

    alert("Conta criada! Aguarde ativação.");
  } catch (e) {
    alert(e.message);
  }
};


// ============================
// CONTROLE DE SESSÃO
// ============================

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    usuarioLogado = null;
    showLogin();
    return;
  }

  usuarioLogado = user;

  const docSnap = await getDoc(doc(db, "users", user.uid));

  if (!docSnap.exists()) {
    showLogin();
    return;
  }

  const data = docSnap.data();

  if (data.pago === true) {
    msgPadrao = data.msgCustom || msgPadrao;
    document.getElementById("estoque-badge").innerText =
      (data.estoque9 || 0) + (data.estoque12 || 0);

    showApp();
    renderClientes();
  } else {
    showBlock();
  }
});


// ============================
// CLIENTES
// ============================

window.renderClientes = async () => {
  try {
    if (!usuarioLogado) return;

    const lista = document.getElementById("lista-clientes");
    lista.innerHTML = "";

    const q = query(
      collection(db, "clientes"),
      where("userId", "==", usuarioLogado.uid),
      orderBy("proximaTroca", "asc")
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      lista.innerHTML = "<p style='text-align:center;color:#999;'>Nenhum cliente cadastrado.</p>";
    }

    let hojeCount = 0;
    let atrasadoCount = 0;
    let semanaCount = 0;

    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    snap.forEach(d => {
      const item = d.data();
      const prox = new Date(item.proximaTroca);
      prox.setHours(0,0,0,0);

      const diff = Math.ceil((prox - hoje)/(1000*60*60*24));

      if (diff < 0) atrasadoCount++;
      else if (diff === 0) hojeCount++;
      else if (diff <= 7) semanaCount++;

      const cls = diff < 0 ? "status-vencido"
        : diff === 0 ? "status-hoje"
        : diff <= 7 ? "status-7dias"
        : "status-ok";

      lista.innerHTML += `
  <div class="cliente-card ${cls}">
    <div class="card-linha">
      <div>
        <h4>${item.nome}</h4>
        <small>${item.qtd}x ${item.modelo == 9 ? "Alcaline" : "Alcaline Max"}</small>
      </div>
    </div>

    <div class="card-linha">
      <span>Troca: <b>${prox.toLocaleDateString()}</b></span>
    </div>

    <div class="card-actions">
      <button onclick="enviarWhatsApp('${d.id}')">
        📲 Enviar
      </button>

      <button onclick="editarCliente('${d.id}')" class="btn-small">
        ✏️ Editar
      </button>

      <button onclick="reposicaoCliente('${d.id}', ${item.modelo})" class="btn-small">
        🔄 Reposição
      </button>
    </div>
  </div>
`;


    document.getElementById("count-hoje").innerText = hojeCount;
    document.getElementById("count-atrasados").innerText = atrasadoCount;
    document.getElementById("count-7dias").innerText = semanaCount;

  } catch (error) {
    console.error("Erro ao renderizar clientes:", error);
  }
});



// ============================
// CADASTRAR CLIENTE
// ============================

window.abrirModalCadastro = () => {
  document.getElementById("modal-cliente").classList.remove("hidden");
};

window.fecharModal = () => {
  document.getElementById("modal-cliente").classList.add("hidden");
};

window.salvarCliente = async () => {
  const nome = document.getElementById("nome-cliente").value;
  const whatsapp = document.getElementById("whatsapp-cliente").value;
  const dataVenda = document.getElementById("data-venda").value;
  const modelo = parseInt(document.getElementById("modelo-refil-valor").value);
  const qtd = parseInt(document.getElementById("qtd-refil").value);

  if (!nome || !dataVenda) {
    alert("Preencha os campos obrigatórios.");
    return;
  }

  const dataBase = new Date(dataVenda);
  const proximaTroca = new Date(dataBase);
  proximaTroca.setMonth(proximaTroca.getMonth() + modelo);

  const dados = {
    nome,
    whatsapp,
    modelo,
    qtd,
    dataVenda,
    proximaTroca: proximaTroca.toISOString(),
    userId: usuarioLogado.uid
  };

  if (clienteEditando) {
    await updateDoc(doc(db, "clientes", clienteEditando), dados);
    clienteEditando = null;
  } else {
    await addDoc(collection(db, "clientes"), dados);
  }

  fecharModal();
  renderClientes();
};

// ============================
// CONFIGURAÇÕES
// ============================

window.abrirConfiguracoes = () => {
  document.getElementById("modal-config").classList.remove("hidden");
};

window.fecharConfig = () => {
  document.getElementById("modal-config").classList.add("hidden");
};

window.salvarTudoConfig = async () => {
  if (!usuarioLogado) return;

  const estoque9 = parseInt(document.getElementById("stock-9").value) || 0;
  const estoque12 = parseInt(document.getElementById("stock-12").value) || 0;
  const msgCustom = document.getElementById("msg-custom-input").value;

  await updateDoc(doc(db, "users", usuarioLogado.uid), {
    estoque9,
    estoque12,
    msgCustom
  });

  document.getElementById("estoque-badge").innerText =
    estoque9 + estoque12;

  fecharConfig();
  alert("Configurações salvas.");
};

window.enviarWhatsApp = async (id) => {
  const docSnap = await getDoc(doc(db, "clientes", id));
  if (!docSnap.exists()) return;

  const item = docSnap.data();

  if (!item.whatsapp) {
    alert("Cliente sem WhatsApp cadastrado.");
    return;
  }

  const dataFormatada = new Date(item.proximaTroca).toLocaleDateString();
  const modeloNome = item.modelo == 9 ? "Alcaline" : "Alcaline Max";

  const msg = msgPadrao
    .replace("[NOME]", item.nome)
    .replace("[MODELO]", modeloNome)
    .replace("[DATA]", dataFormatada);

  const numero = item.whatsapp.replace(/\D/g, "");

  window.open(`https://wa.me/55${numero}?text=${encodeURIComponent(msg)}`, "_blank");

};


window.editarCliente = async (id) => {
  const docSnap = await getDoc(doc(db, "clientes", id));

  if (!docSnap.exists()) return;

  const cliente = docSnap.data();
  clienteEditando = id;

  document.getElementById("nome-cliente").value = cliente.nome;
  document.getElementById("whatsapp-cliente").value = cliente.whatsapp;
  document.getElementById("data-venda").value = cliente.dataVenda.split("T")[0];
  document.getElementById("qtd-refil").value = cliente.qtd;

  selecionarModelo(cliente.modelo);

  document.getElementById("modal-title").innerText = "EDITAR CLIENTE";

  abrirModalCadastro();
};

window.reposicaoCliente = async (id, modelo) => {
  const novaData = prompt("Informe a nova data da venda (AAAA-MM-DD):", 
                          new Date().toISOString().split("T")[0]);

  if (!novaData) return;

  const dataBase = new Date(novaData);
  const novaTroca = new Date(dataBase);
  novaTroca.setMonth(novaTroca.getMonth() + modelo);

  await updateDoc(doc(db, "clientes", id), {
    dataVenda: novaData,
    proximaTroca: novaTroca.toISOString()
  });

  renderClientes();
};


// ============================
// LOGOUT
// ============================

window.logout = () => {
  if (confirm("Deseja sair?")) {
    signOut(auth);
  }
};
