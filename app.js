// ... (seu config e inicialização do firebase)
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc, getDoc, setDoc, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let clienteEmEdicaoId = null; // Começa como null (significa novo cadastro)
let usuarioLogado = null;
let msgPadrao = "Olá [NOME], Seu refil [MODELO] vence em [DATA]. Vamos agendar a reposição pra hoje ou amanhã?";

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
    clienteEmEdicaoId = null; // Reseta para novo cliente
    
    // Limpa os campos do formulário
    document.getElementById('nome-cliente').value = "";
    document.getElementById('whatsapp-cliente').value = "";
    document.getElementById('data-venda').value = new Date().toISOString().split('T')[0];
    document.getElementById('qtd-refil').value = 1;
    document.getElementById('modal-title').innerText = "Novo Cliente";
    
    window.selecionarModelo(9); // Padrão
    document.getElementById('modal-cliente').classList.remove('hidden');
};

window.fecharModal = () => {
    document.getElementById('modal-cliente').classList.add('hidden');
    document.body.style.overflow = 'auto';
};

window.editarCliente = (id, nome, whatsapp, data, modelo, qtd) => {
    clienteEmEdicaoId = id; // Armazena o ID para o salvamento saber que é uma edição

    // 1. FORMATAR A DATA PARA O INPUT (Garantir YYYY-MM-DD)
    // Se a data vier do Firebase como objeto, convertemos. Se for string, limpamos.
    let dataFormatada = "";
    if (data) {
        // Pega apenas os primeiros 10 caracteres (caso venha algo como 2023-10-25T14:30...)
        dataFormatada = data.split('T')[0]; 
    }

    // 2. PREENCHER OS CAMPOS DO MODAL
    document.getElementById('modal-title').innerText = "Editar Cliente";
    document.getElementById('nome-cliente').value = nome || "";
    document.getElementById('whatsapp-cliente').value = whatsapp || "";
    document.getElementById('data-venda').value = dataFormatada; // Aqui a data aparece!
    document.getElementById('qtd-refil').value = qtd || 1;
    
    // 3. ATUALIZAR MODELO E VISUAL DOS BOTÕES
    document.getElementById('modelo-refil-valor').value = modelo;
    if (window.selecionarModelo) {
        window.selecionarModelo(modelo);
    }

    // 4. MOSTRAR O MODAL
    document.getElementById('modal-cliente').classList.remove('hidden');
};

window.salvarCliente = async () => {
    const nome = document.getElementById('nome-cliente').value;
    const whatsapp = document.getElementById('whatsapp-cliente').value;
    const dataVenda = document.getElementById('data-venda').value;
    const modelo = parseInt(document.getElementById('modelo-refil-valor').value);
    const qtd = parseInt(document.getElementById('qtd-refil').value);

    if (!nome || !whatsapp || !dataVenda) {
        return alert("Por favor, preencha todos os campos.");
    }

    // Calcula a próxima troca
    const dataObj = new Date(dataVenda);
    dataObj.setMonth(dataObj.getMonth() + modelo);
    const proximaTroca = dataObj.toISOString().split('T')[0];

    const dadosCliente = {
        nome,
        whatsapp,
        dataVenda,
        proximaTroca,
        modelo,
        qtd,
        userId: auth.currentUser.uid // Garante que o cliente pertence ao usuário logado
    };

    try {
        if (clienteEmEdicaoId) {
            // SE EXISTIR ID, ATUALIZA
            console.log("Atualizando documento:", clienteEmEdicaoId);
            const clienteRef = doc(db, "clientes", clienteEmEdicaoId);
            await updateDoc(clienteRef, dadosCliente);
            alert("Cliente atualizado!");
        } else {
            // SE NÃO EXISTIR, CRIA NOVO
            console.log("Criando novo documento");
            await addDoc(collection(db, "clientes"), dadosCliente);
            alert("Cliente cadastrado!");
        }

        fecharModal();
        clienteEmEdicaoId = null; // Reseta após salvar
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro técnico ao salvar. Verifique o console.");
    }
};

window.renderClientes = async () => {
    const q = query(collection(db, "clientes"), where("userId", "==", usuarioLogado.uid), orderBy("proximaTroca", "asc"));
    const snap = await getDocs(q);
    const lista = document.getElementById('lista-clientes');
    lista.innerHTML = "";
    
    let h=0, a=0, s=0;
    const hoje = new Date(); hoje.setHours(0,0,0,0);

    snap.forEach(d => {
        const id = d.id;
        const item = d.data();
        
        // Converte a data (ajuste se for String ou Timestamp do Firebase)
        let prox;
        if (item.proximaTroca.toDate) {
            prox = item.proximaTroca.toDate();
        } else {
            prox = new Date(item.proximaTroca + "T00:00:00");
        }
        
        prox.setHours(0,0,0,0);
        const diff = Math.ceil((prox - hoje) / (1000*60*60*24));

        // Lógica dos contadores do Dashboard
        if(diff < 0) a++; 
        else if(diff === 0) h++; 
        else if(diff <= 7) s++;

        // Define a classe de cor lateral do card
        let cls = diff < 0 ? "status-vencido" : (diff <= 7 ? "status-hoje" : "status-ok");

        // Gera o HTML do card único
        lista.innerHTML += `
            <div class="cliente-card ${cls}">
                <div class="card-linha">
                    <div>
                        <h4 style="color: var(--azul-marinho); margin:0">${item.nome}</h4>
                        <small>${item.qtd} Und Refil ${item.modelo == 9 ? 'Alcaline' : 'Alcaline Max'}</small>
                    </div>
                    <div style="display:flex; gap:10px">
                        <button onclick="notificar('${item.nome}','${item.whatsapp}','${prox.toLocaleDateString()}','${item.modelo}')" class="btn-round btn-wpp">
                            <i class="fab fa-whatsapp"></i>
                        </button>
                        <button onclick="window.editarCliente('${id}', '${item.nome}', '${item.whatsapp}', '${item.dataVenda}', ${item.modelo}, ${item.qtd})" class="btn-round btn-edit">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
                <div class="card-linha" style="margin-top:10px">
                    <span style="font-size: 17px">Troca: <b>${prox.toLocaleDateString()}</b></span>
                    <button onclick="confirmarReposicao('${id}', ${item.modelo}, ${item.qtd})" class="btn-round btn-repo">REPOSIÇÃO</button>
                </div>
            </div>`;
    });

    // Atualiza os números coloridos do Dashboard
    document.getElementById('count-hoje').innerText = h;
    document.getElementById('count-atrasados').innerText = a;
    document.getElementById('count-7dias').innerText = s;
};

window.editarCliente = (id, nome, whatsapp, data, modelo, qtd) => {
    console.log("Editando cliente:", id); // Para debug
    clienteEmEdicaoId = id; // Salva o ID para saber que é uma edição
    
    document.getElementById('modal-title').innerText = "Editar Cliente";
    document.getElementById('nome-cliente').value = nome;
    document.getElementById('whatsapp-cliente').value = whatsapp;
    document.getElementById('data-venda').value = data;
    document.getElementById('qtd-refil').value = qtd;
    
// Atualiza o valor oculto do modelo e a aparência dos botões
    document.getElementById('modelo-refil-valor').value = modelo;
    window.selecionarModelo(modelo); // Chama a função que pinta os botões de 9m ou 12m

    // Abre o modal
    document.getElementById('modal-cliente').classList.remove('hidden');
    window.scrollTo(0, 0);
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
window.selecionarModelo = (meses) => {
    document.getElementById('modelo-refil-valor').value = meses;
    
    const btn9 = document.getElementById('btn-9m');
    const btn12 = document.getElementById('btn-12m');

    if (meses === 9) {
        btn9.classList.add('btn-model-active');
        btn12.classList.remove('btn-model-active');
    } else {
        btn12.classList.add('btn-model-active');
        btn9.classList.remove('btn-model-active');
    }
};
