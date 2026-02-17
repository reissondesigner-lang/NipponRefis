import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, doc, updateDoc, getDoc, setDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let usuarioLogado = null;
let msgPadrao = "Olá [NOME], Seu refil [MODELO] vence em [DATA]. Vamos trocar?";

// --- NAVEGAÇÃO ---
const showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};

// --- AUTH ---
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

window.logout = () => confirm("Sair do sistema?") && signOut(auth);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioLogado = user;
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().pago === false) {
            showScreen('block-screen');
        } else {
            msgPadrao = userDoc.data()?.msgCustom || msgPadrao;
            document.getElementById('estoque-badge').innerText = (userDoc.data()?.estoque9 || 0) + (userDoc.data()?.estoque12 || 0);
            showScreen('main-app');
            renderClientes();
        }
    } else {
        showScreen('login-screen');
    }
});

// --- CLIENTES & ESTOQUE ---
window.selecionarModelo = (meses) => {
    document.getElementById('modelo-refil-valor').value = meses;
    document.querySelectorAll('.btn-model').forEach(b => b.classList.remove('btn-model-active'));
    document.getElementById(meses === 9 ? 'btn-9m' : 'btn-12m').classList.add('btn-model-active');
};

window.abrirModalCadastro = () => {
    document.getElementById('modal-title').innerText = "Novo Cliente";
    document.getElementById('nome-cliente').value = "";
    document.getElementById('whatsapp-cliente').value = "";
    document.getElementById('data-venda').value = new Date().toISOString().split('T')[0];
    document.getElementById('btn-salvar-cliente').onclick = salvarCliente;
    selecionarModelo(9);
    document.getElementById('modal-cliente').classList.remove('hidden');
};

window.fecharModal = () => document.getElementById('modal-cliente').classList.add('hidden');

const salvarCliente = async () => {
    const nome = document.getElementById('nome-cliente').value;
    const tel = document.getElementById('whatsapp-cliente').value;
    const modelo = parseInt(document.getElementById('modelo-refil-valor').value);
    const qtd = parseInt(document.getElementById('qtd-refil').value) || 1;
    const dataVendaStr = document.getElementById('data-venda').value;

    const proxima = new Date(dataVendaStr + 'T12:00:00');
    proxima.setMonth(proxima.getMonth() + modelo);

    await addDoc(collection(db, "clientes"), { 
        userId: usuarioLogado.uid, nome, whatsapp: tel, modelo, qtd, 
        ultimaTroca: new Date(dataVendaStr + 'T12:00:00'), proximaTroca: proxima 
    });

    const campo = modelo === 9 ? 'estoque9' : 'estoque12';
    const uRef = doc(db, "users", usuarioLogado.uid);
    const uSnap = await getDoc(uRef);
    await updateDoc(uRef, { [campo]: (uSnap.data()[campo] || 0) - qtd });

    fecharModal();
};

window.renderClientes = () => {
    const q = query(collection(db, "clientes"), where("userId", "==", usuarioLogado.uid), orderBy("proximaTroca", "asc"));
    onSnapshot(q, (snap) => {
        const lista = document.getElementById('lista-clientes');
        lista.innerHTML = "";
        let h=0, a=0, s=0;
        const hoje = new Date(); hoje.setHours(0,0,0,0);

        snap.forEach(d => {
            const item = d.data();
            const prox = item.proximaTroca.toDate();
            const diff = Math.ceil((prox - hoje) / (1000*60*60*24));
            
            let cls = diff < 0 ? "status-vencido" : (diff < 8 ? "status-hoje" : "status-ok");
            if(diff < 0) a++; else if(diff === 0) h++; else if(diff <= 7) s++;

            lista.innerHTML += `
                <div class="cliente-card ${cls}">
                    <div class="card-linha">
                        <div>
                            <h4 style="color: var(--azul-marinho)">${item.nome}</h4>
                            <small>${item.qtd}x ${item.modelo==9?'9m':'12m'}</small>
                        </div>
                        <div style="display:flex; gap:5px">
                            <button onclick="notificar('${item.nome}','${item.whatsapp}','${prox.toLocaleDateString()}','${item.modelo}')" class="btn-round btn-wpp"><i class="fab fa-whatsapp"></i></button>
                            <button onclick="editarCliente('${d.id}')" class="btn-round btn-edit"><i class="fas fa-edit"></i></button>
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
    });
};

window.editarCliente = async (id) => {
    const docSnap = await getDoc(doc(db, "clientes", id));
    const dados = docSnap.data();
    document.getElementById('nome-cliente').value = dados.nome;
    document.getElementById('whatsapp-cliente').value = dados.whatsapp;
    document.getElementById('data-venda').value = dados.ultimaTroca.toDate().toISOString().split('T')[0];
    selecionarModelo(dados.modelo);
    document.getElementById('modal-cliente').classList.remove('hidden');
    document.getElementById('btn-salvar-cliente').onclick = () => finalizarEdicao(id);
};

const finalizarEdicao = async (id) => {
    const modelo = parseInt(document.getElementById('modelo-refil-valor').value);
    const dataVendaStr = document.getElementById('data-venda').value;
    const proxima = new Date(dataVendaStr + 'T12:00:00');
    proxima.setMonth(proxima.getMonth() + modelo);

    await updateDoc(doc(db, "clientes", id), {
        nome: document.getElementById('nome-cliente').value,
        whatsapp: document.getElementById('whatsapp-cliente').value,
        ultimaTroca: new Date(dataVendaStr + 'T12:00:00'),
        proximaTroca: proxima,
        modelo: modelo,
        qtd: parseInt(document.getElementById('qtd-refil').value)
    });
    fecharModal();
};

window.confirmarReposicao = async (id, mod, qtd) => {
    if(!confirm("Trocar agora?")) return;
    const nova = new Date();
    const prox = new Date(); prox.setMonth(prox.getMonth() + mod);
    await updateDoc(doc(db, "clientes", id), { ultimaTroca: nova, proximaTroca: prox });
    const uRef = doc(db, "users", usuarioLogado.uid);
    const uSnap = await getDoc(uRef);
    await updateDoc(uRef, { [mod === 9 ? 'estoque9' : 'estoque12']: (uSnap.data()[mod === 9 ? 'estoque9' : 'estoque12'] || 0) - qtd });
};

window.notificar = (n, t, d, m) => {
    const msg = msgPadrao.replace("[NOME]", n).replace("[DATA]", d).replace("[MODELO]", m == 9 ? "Alcaline" : "Alcaline Max");
    window.open(`https://wa.me/55${t.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
};

window.abrirConfiguracoes = async () => {
    const userDoc = await getDoc(doc(db, "users", usuarioLogado.uid));
    const d = userDoc.data();
    document.getElementById('stock-9').value = d.estoque9 || 0;
    document.getElementById('stock-12').value = d.estoque12 || 0;
    document.getElementById('msg-custom-input').value = d.msgCustom || msgPadrao;
    document.getElementById('modal-config').classList.remove('hidden');
};

window.fecharConfig = () => document.getElementById('modal-config').classList.add('hidden');

window.salvarTudoConfig = async () => {
    await updateDoc(doc(db, "users", usuarioLogado.uid), {
        msgCustom: document.getElementById('msg-custom-input').value,
        estoque9: parseInt(document.getElementById('stock-9').value) || 0,
        estoque12: parseInt(document.getElementById('stock-12').value) || 0
    });
    fecharConfig();
};
