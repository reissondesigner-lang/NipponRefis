import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc, getDoc, setDoc, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Estado Global da Aplicação (Padrão Sênior)
let state = {
    usuario: null,
    dadosUsuario: null,
    msgPadrao: "Olá [NOME], Seu refil [MODELO] vence em [DATA]. Vamos trocar?",
    isSaving: false
};

// --- UTILITÁRIOS DE INTERFACE ---
const screens = ['login-screen', 'block-screen', 'main-app'];
const showScreen = (screenId) => {
    screens.forEach(s => document.getElementById(s).classList.toggle('active', s === screenId));
};

const toggleModal = (modalId, show) => {
    const modal = document.getElementById(modalId);
    modal.classList.toggle('hidden', !show);
    document.body.style.overflow = show ? 'hidden' : 'auto';
};

// --- CONFIGURAÇÕES E ESTOQUE ---
window.abrirConfiguracoes = async () => {
    if (state.dadosUsuario) {
        document.getElementById('stock-9').value = state.dadosUsuario.estoque9 || 0;
        document.getElementById('stock-12').value = state.dadosUsuario.estoque12 || 0;
        document.getElementById('msg-custom-input').value = state.dadosUsuario.msgCustom || state.msgPadrao;
    }
    toggleModal('modal-config', true);
};

window.fecharConfig = () => toggleModal('modal-config', false);

window.salvarTudoConfig = async () => {
    if (state.isSaving) return;
    state.isSaving = true;

    const updates = {
        msgCustom: document.getElementById('msg-custom-input').value,
        estoque9: parseInt(document.getElementById('stock-9').value) || 0,
        estoque12: parseInt(document.getElementById('stock-12').value) || 0
    };

    try {
        await updateDoc(doc(db, "users", state.usuario.uid), updates);
        state.dadosUsuario = { ...state.dadosUsuario, ...updates };
        atualizarBadgeEstoque();
        alert("Configurações salvas!");
        fecharConfig();
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Falha na conexão.");
    } finally {
        state.isSaving = false;
    }
};

// --- AUTENTICAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        state.usuario = user;
        const userDoc = await getDoc(doc(db, "users", user.uid));
        state.dadosUsuario = userDoc.data();

        if (state.dadosUsuario?.pago === false) {
            showScreen('block-screen');
        } else {
            atualizarBadgeEstoque();
            showScreen('main-app');
            renderClientes();
        }
    } else {
        showScreen('login-screen');
    }
});

window.handleLogin = () => {
    const e = document.getElementById('email').value;
    const s = document.getElementById('password').value;
    signInWithEmailAndPassword(auth, e, s).catch(err => alert("Email ou senha inválidos."));
};

// --- GESTÃO DE CLIENTES ---
window.selecionarModelo = (meses) => {
    document.getElementById('modelo-refil-valor').value = meses;
    document.querySelectorAll('.btn-model').forEach(btn => 
        btn.classList.toggle('btn-model-active', parseInt(btn.id.replace(/\D/g,'')) === meses)
    );
};

window.abrirModalCadastro = () => {
    document.getElementById('nome-cliente').value = "";
    document.getElementById('whatsapp-cliente').value = "";
    document.getElementById('qtd-refil').value = 1;
    document.getElementById('data-venda').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-title').innerText = "Novo Cliente";
    document.querySelector('.btn-confirm').onclick = window.salvarCliente;
    window.selecionarModelo(9);
    toggleModal('modal-cliente', true);
};

window.salvarCliente = async () => {
    if (state.isSaving) return;
    const nome = document.getElementById('nome-cliente').value;
    if (!nome) return alert("Nome é obrigatório");

    state.isSaving = true;
    const modelo = parseInt(document.getElementById('modelo-refil-valor').value);
    const qtd = parseInt(document.getElementById('qtd-refil').value) || 1;
    const dataVenda = new Date(document.getElementById('data-venda').value + 'T12:00:00'); // Evita erro de fuso horário
    
    const proxima = new Date(dataVenda);
    proxima.setMonth(proxima.getMonth() + modelo);

    try {
        await addDoc(collection(db, "clientes"), {
            userId: state.usuario.uid,
            nome,
            whatsapp: document.getElementById('whatsapp-cliente').value,
            modelo,
            qtd,
            ultimaTroca: dataVenda,
            proximaTroca: proxima
        });

        // Atualiza estoque localmente e no banco
        const campo = modelo === 9 ? 'estoque9' : 'estoque12';
        const novoEstoque = (state.dadosUsuario[campo] || 0) - qtd;
        await updateDoc(doc(db, "users", state.usuario.uid), { [campo]: novoEstoque });
        state.dadosUsuario[campo] = novoEstoque;

        atualizarBadgeEstoque();
        toggleModal('modal-cliente', false);
        renderClientes();
    } catch (e) {
        alert("Erro ao salvar cliente.");
    } finally {
        state.isSaving = false;
    }
};

window.renderClientes = async () => {
    const lista = document.getElementById('lista-clientes');
    lista.innerHTML = "<p style='text-align:center; padding:20px'>Carregando...</p>";

    const q = query(collection(db, "clientes"), where("userId", "==", state.usuario.uid), orderBy("proximaTroca", "asc"));
    const snap = await getDocs(q);
    lista.innerHTML = "";
    
    let h=0, a=0, s=0;
    const hoje = new Date(); hoje.setHours(0,0,0,0);

    snap.forEach(d => {
        const item = d.data();
        const prox = item.proximaTroca.toDate();
        const diff = Math.ceil((prox - hoje) / (1000*60*60*24));
        
        const cls = diff < 0 ? "status-vencido" : (diff <= 7 ? "status-hoje" : "status-ok");
        if(diff < 0) a++; else if(diff === 0) h++; else if(diff <= 7) s++;

        lista.innerHTML += `
            <div class="cliente-card ${cls}">
                <div class="card-linha">
                    <div>
                        <h4 style="color: var(--azul-marinho)">${item.nome}</h4>
                        <small>${item.qtd}x ${item.modelo === 9 ? 'Alcaline' : 'Alcaline Max'}</small>
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

window.notificar = (n, t, d, m) => {
    const mod = m == 9 ? "Alcaline" : "Alcaline Max";
    const msgTemplate = state.dadosUsuario?.msgCustom || state.msgPadrao;
    const msg = msgTemplate.replace("[NOME]", n).replace("[DATA]", d).replace("[MODELO]", mod);
    window.open(`https://wa.me/55${t.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
};

function atualizarBadgeEstoque() {
    const total = (state.dadosUsuario?.estoque9 || 0) + (state.dadosUsuario?.estoque12 || 0);
    document.getElementById('estoque-badge').innerText = total;
}

window.logout = () => { if(confirm("Sair do sistema?")) signOut(auth); };
window.fecharModal = () => toggleModal('modal-cliente', false);
