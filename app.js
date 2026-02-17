import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, getDoc, setDoc, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

let usuarioLogado = null;
let msgPadrao = "Olá [NOME], Seu refil [MODELO] vence em [DATA]. Vamos trocar?";

// --- NAVEGAÇÃO ---
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

// --- ESTOQUE E CONFIG ---
window.abrirEstoque = async () => {
    const userDoc = await getDoc(doc(db, "users", usuarioLogado.uid));
    if (userDoc.exists()) {
        const d = userDoc.data();
        document.getElementById('stock-9').value = d.estoque9 || 0;
        document.getElementById('stock-12').value = d.estoque12 || 0;
    }
    document.getElementById('modal-estoque').classList.remove('hidden');
};

window.fecharEstoque = () => document.getElementById('modal-estoque').classList.add('hidden');

window.salvarTudoConfig = async () => {
    const novaMsg = document.getElementById('msg-custom-input').value;
    const s9 = parseInt(document.getElementById('stock-9').value) || 0;
    const s12 = parseInt(document.getElementById('stock-12').value) || 0;
    try {
        await updateDoc(doc(db, "users", usuarioLogado.uid), { msgCustom: novaMsg, estoque9: s9, estoque12: s12 });
        msgPadrao = novaMsg;
        document.getElementById('estoque-badge').innerText = s9 + s12;
        alert("Salvo!");
    } catch (e) { alert("Erro ao salvar"); }
};

// --- AUTENTICAÇÃO ---
window.handleLogin = () => {
    const e = document.getElementById('email').value;
    const s = document.getElementById('password').value;
    signInWithEmailAndPassword(auth, e, s).catch(err => alert("Erro: " + err.message));
};

window.handleSignup = async () => {
    const nome = document.getElementById('signup-nome').value;
    const e = document.getElementById('email').value;
    const s = document.getElementById('password').value;
    try {
        const cred = await createUserWithEmailAndPassword(auth, e, s);
        await setDoc(doc(db, "users", cred.user.uid), { nome, email: e, pago: true, estoque9: 0, estoque12: 0, msgCustom: msgPadrao });
        alert("Cadastrado!");
    } catch (err) { alert(err.message); }
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioLogado = user;
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().pago === false) { showBlock(); }
        else {
            msgPadrao = userDoc.data()?.msgCustom || msgPadrao;
            document.getElementById('estoque-badge').innerText = (userDoc.data()?.estoque9 || 0) + (userDoc.data()?.estoque12 || 0);
            showApp();
            renderClientes();
        }
    } else { showLogin(); }
});

// --- CLIENTES ---
window.renderClientes = async () => {
    if (!db || !usuarioLogado) return;
    try {
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
            let cls = diff < 0 ? "status-vencido" : (diff < 8 ? "status-hoje" : "status-ok");
            if(diff < 0) a++; else if(diff === 0) h++; else if(diff <= 7) s++;

            lista.innerHTML += `
                <div class="cliente-card ${cls}">
                    <div class="card-linha">
                        <div>
                            <h4>${item.nome}</h4>
                            <small>${item.qtd}x ${item.modelo==9?'Alcaline':'Alcaline Max'}</small>
                        </div>
                        <div style="display:flex; gap:5px">
                            <button onclick="notificar('${item.nome}','${item.whatsapp}','${prox.toLocaleDateString()}','${item.modelo}')" class="btn-round btn-wpp">WP</button>
                            <button onclick="editarCliente('${d.id}')" class="btn-round btn-edit">ED</button>
                        </div>
                    </div>
                    <div class="card-linha">
                        <span>Troca: <b>${prox.toLocaleDateString()}</b></span>
                        <button onclick="confirmarReposicao('${d.id}',${item.modelo},${item.qtd})" class="btn-round btn-repo">REPOSIÇÃO</button>
                    </div>
                </div>`;
        });
        document.getElementById('count-hoje').innerText = h;
        document.getElementById('count-atrasados').innerText = a;
        document.getElementById('count-7dias').innerText = s;
    } catch (e) { console.log(e); }
};

window.notificar = (n, t, d, m) => {
    const mod = m == 9 ? "Alcaline" : "Alcaline Max";
    const msg = msgPadrao.replace("[NOME]", n).replace("[DATA]", d).replace("[MODELO]", mod);
    window.open(`https://wa.me/55${t.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
};

window.logout = () => { if (confirm("Sair?")) signOut(auth); };

// Inicialização de botões globais
window.selecionarModelo = (meses) => {
    document.getElementById('modelo-refil-valor').value = meses;
};
