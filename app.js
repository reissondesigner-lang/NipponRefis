import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc, getDoc, setDoc, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let usuarioLogado = null;
let msgPadrao = "Olá [NOME], Seu refil [MODELO] vence em [DATA]. Vamos trocar?";

// --- NAVEGAÇÃO (Mantendo sua lógica original) ---
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

// --- CONFIGURAÇÕES E ESTOQUE ---
window.abrirConfiguracoes = async () => {
    const userDoc = await getDoc(doc(db, "users", usuarioLogado.uid));
    if (userDoc.exists()) {
        const d = userDoc.data();
        document.getElementById('stock-9').value = d.estoque9 || 0;
        document.getElementById('stock-12').value = d.estoque12 || 0;
        document.getElementById('msg-custom-input').value = d.msgCustom || msgPadrao;
    }
    document.getElementById('modal-config').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
};

window.fecharConfig = () => {
    document.getElementById('modal-config').classList.add('hidden');
    document.body.style.overflow = 'auto';
};

window.salvarTudoConfig = async () => {
    const novaMsg = document.getElementById('msg-custom-input').value;
    const s9 = parseInt(document.getElementById('stock-9').value) || 0;
    const s12 = parseInt(document.getElementById('stock-12').value) || 0;
    
    try {
        await updateDoc(doc(db, "users", usuarioLogado.uid), {
            msgCustom: novaMsg,
            estoque9: s9,
            estoque12: s12
        });
        msgPadrao = novaMsg;
        document.getElementById('estoque-badge').innerText = s9 + s12;
        alert("Salvo com sucesso!");
        fecharConfig();
    } catch (error) {
        alert("Erro ao salvar.");
    }
};

// --- AUTENTICAÇÃO ---
window.handleLogin = () => {
    const e = document.getElementById('email').value;
    const s = document.getElementById('password').value;
    signInWithEmailAndPassword(auth, e, s).catch(err => alert("Erro: " + err.message));
};

window.handleSignup = () => {
    const e = document.getElementById('email').value;
    const s = document.getElementById('password').value;
    createUserWithEmailAndPassword(auth, e, s).then(async (cred) => {
        await setDoc(doc(db, "users", cred.user.uid), { pago: true, estoque9: 0, estoque12: 0, msgCustom: msgPadrao });
    }).catch(err => alert("Erro: " + err.message));
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioLogado = user;
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().pago === false) {
            showBlock();
        } else {
            msgPadrao = userDoc.data()?.msgCustom || msgPadrao;
            document.getElementById('estoque-badge').innerText = (userDoc.data()?.estoque9 || 0) + (userDoc.data()?.estoque12 || 0);
            showApp();
            renderClientes();
        }
    } else {
        showLogin();
    }
});

// --- CLIENTES ---
window.selecionarModelo = (meses) => {
    document.getElementById('modelo-refil-valor').value = meses;
    document.querySelectorAll('.btn-model').forEach(btn => btn.classList.remove('btn-model-active'));
    if(meses === 9) document.getElementById('btn-9m').classList.add('btn-model-active');
    else document.getElementById('btn-12m').classList.add('btn-model-active');
};

window.abrirModalCadastro = () => {
    document.getElementById('nome-cliente').value = "";
    document.getElementById('whatsapp-cliente').value = "";
    document.getElementById('qtd-refil').value = 1;
    document.getElementById('modal-title').innerText = "Novo Cliente";
    document.querySelector('.btn-confirm').onclick = window.salvarCliente;
    document.getElementById('data-venda').value = new Date().toISOString().split('T')[0];
    window.selecionarModelo(9);
    document.getElementById('modal-cliente').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
};

window.fecharModal = () => {
    document.getElementById('modal-cliente').classList.add('hidden');
    document.body.style.overflow = 'auto';
};

window.salvarCliente = async () => {
    const nome = document.getElementById('nome-cliente').value;
    const tel = document.getElementById('whatsapp-cliente').value;
    const modelo = parseInt(document.getElementById('modelo-refil-valor').value);
    const qtd = parseInt(document.getElementById('qtd-refil').value) || 1;
    const dataVendaStr = document.getElementById('data-venda').value;

    const partes = dataVendaStr.split("-");
    const dataVenda = new Date(partes[0], partes[1] - 1, partes[2], 12);
    const proxima = new Date(dataVenda);
    proxima.setMonth(proxima.getMonth() + modelo);

    try {
        await addDoc(collection(db, "clientes"), { 
            userId: usuarioLogado.uid, nome, whatsapp: tel, modelo, qtd, ultimaTroca: dataVenda, proximaTroca: proxima 
        });
        
        const userRef = doc(db, "users", usuarioLogado.uid);
        const userSnap = await getDoc(userRef);
        const campo = modelo === 9 ? 'estoque9' : 'estoque12';
        const novoEstoque = (userSnap.data()[campo] || 0) - qtd;
        await updateDoc(userRef, { [campo]: novoEstoque });
        
        document.getElementById('estoque-badge').innerText = (campo === 'estoque9' ? novoEstoque + (userSnap.data().estoque12 || 0) : novoEstoque + (userSnap.data().estoque9 || 0));

        fecharModal();
        renderClientes();
    } catch (e) { alert("Erro ao salvar."); }
};

window.renderClientes = async () => {
    const q = query(collection(db, "clientes"), where("userId", "==", usuarioLogado.uid), orderBy("proximaTroca", "asc"));
    const snap = await getDocs(q);
    const lista = document.getElementById('lista-clientes');
    lista.innerHTML = "";
    
    let h=0, a=0, s=0;
    const hoje = new Date(); hoje.setHours(0,0,0,0);

    snap.forEach(d => {
        const item = d.data();
        const prox = item.proximaTroca.toDate(); prox.setHours(0,0,0,0);
        const diff = Math.ceil((prox - hoje) / (1000*60*60*24));
        
        let cls = diff < 0 ? "status-vencido" : (diff <= 7 ? "status-hoje" : "status-ok");
        if(diff < 0) a++; else if(diff === 0) h++; else if(diff <= 7) s++;

        lista.innerHTML += `
            <div class="cliente-card ${cls}">
                <div class="card-linha">
                    <div>
                        <h4 style="color: var(--azul-marinho)">${item.nome}</h4>
                        <small>${item.qtd}x ${item.modelo==9?'Alcaline':'Alcaline Max'}</small>
                    </div>
                    <div style="display:flex; gap:5px">
                        <button onclick="notificar('${item.nome}','${item.whatsapp}','${prox.toLocaleDateString()}','${item.modelo}')" class="btn-round btn-wpp"><i class="fab fa-whatsapp"></i></button>
                        <button onclick="editarCliente('${d.id}')" class="btn-round btn-edit"><i class="fas fa-edit"></i></button>
                    </div>
                </div>
                <div class="card-linha" style="margin-top:10px">
                    <span>Troca: <b>${prox.toLocaleDateString()}</b></span>
                    <button onclick="confirmarReposicao('${d.id}',${item.modelo},${item.qtd})" class="btn-round btn-repo">REPOSIÇÃO</button>
                </div>
            </div>`;
    });
    document.getElementById('count-hoje').innerText = h;
    document.getElementById('count-atrasados').innerText = a;
    document.getElementById('count-7dias').innerText = s;
};

window.editarCliente = async (id) => {
    const docSnap = await getDoc(doc(db, "clientes", id));
    const dados = docSnap.data();
    document.getElementById('nome-cliente').value = dados.nome;
    document.getElementById('whatsapp-cliente').value = dados.whatsapp;
    document.getElementById('data-venda').value = dados.ultimaTroca.toDate().toISOString().split('T')[0];
    selecionarModelo(dados.modelo);
    document.getElementById('modal-title').innerText = "Editar Cliente";
    document.getElementById('modal-cliente').classList.remove('hidden');
    document.querySelector('.btn-confirm').onclick = () => finalizarEdicao(id);
};

async function finalizarEdicao(id) {
    const modelo = parseInt(document.getElementById('modelo-refil-valor').value);
    const dataVendaStr = document.getElementById('data-venda').value;
    const partes = dataVendaStr.split("-");
    const dataVenda = new Date(partes[0], partes[1] - 1, partes[2], 12);
    const proxima = new Date(dataVenda);
    proxima.setMonth(proxima.getMonth() + modelo);

    await updateDoc(doc(db, "clientes", id), {
        nome: document.getElementById('nome-cliente').value,
        whatsapp: document.getElementById('whatsapp-cliente').value,
        ultimaTroca: dataVenda,
        proximaTroca: proxima,
        modelo: modelo,
        qtd: parseInt(document.getElementById('qtd-refil').value)
    });
    fecharModal();
    renderClientes();
}

window.confirmarReposicao = async (id, mod, qtd) => {
    if(!confirm("Confirmar troca de refil?")) return;
    const nova = new Date();
    const prox = new Date(); prox.setMonth(prox.getMonth() + mod);
    await updateDoc(doc(db, "clientes", id), { ultimaTroca: nova, proximaTroca: prox });
    
    const uRef = doc(db, "users", usuarioLogado.uid);
    const uSnap = await getDoc(uRef);
    const campo = mod === 9 ? 'estoque9' : 'estoque12';
    const novoEst = (uSnap.data()[campo] || 0) - qtd;
    await updateDoc(uRef, { [campo]: novoEst });
    
    document.getElementById('estoque-badge').innerText = (campo === 'estoque9' ? novoEst + (uSnap.data().estoque12 || 0) : novoEst + (uSnap.data().estoque9 || 0));
    renderClientes();
};

window.notificar = (n, t, d, m) => {
    const mod = m == 9 ? "Alcaline" : "Alcaline Max";
    const msg = msgPadrao.replace("[NOME]", n).replace("[DATA]", d).replace("[MODELO]", mod);
    window.open(`https://wa.me/55${t.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
};

window.logout = () => { if (confirm("Sair?")) signOut(auth); };

// Inicialização
window.selecionarModelo(9);
