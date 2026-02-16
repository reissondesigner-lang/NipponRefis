import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Inicialização
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let usuarioLogado = null;
let msgPadrao = "Olá [NOME], aqui é o [DISTRIBUIDOR] da Nipponflex. Notei que o seu refil [MODELO] completa o ciclo de uso no dia [DATA]. Para garantir a sua saúde e a qualidade da tecnologia, vamos agendar a troca?";

// --- AUTENTICAÇÃO ---

window.handleLogin = () => {
    const e = document.getElementById('email').value;
    const s = document.getElementById('password').value;
    signInWithEmailAndPassword(auth, e, s).catch(err => alert("Erro ao entrar: " + err.message));
};

window.handleSignup = () => {
    const e = document.getElementById('email').value;
    const s = document.getElementById('password').value;
    
    if (!e || !s) return alert("Preencha e-mail e senha!");

    createUserWithEmailAndPassword(auth, e, s).then(async (cred) => {
        await setDoc(doc(db, "users", cred.user.uid), {
            pago: true,
            estoque9: 0,
            estoque12: 0,
            nomeNegocio: "Distribuidor Nipponflex",
            msgCustom: msgPadrao
        });
        alert("Conta criada com sucesso!");
    }).catch(err => {
        if (err.code === 'auth/email-already-in-use') {
            alert("Este e-mail já está cadastrado! Tente fazer login.");
        } else {
            alert("Erro ao cadastrar: " + err.message);
        }
    });
};
window.logout = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioLogado = user;
        try {
            const userRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userRef);

            let dados;

            if (!userDoc.exists()) {
                // Se o usuário não tem documento, cria um agora
                dados = {
                    pago: true,
                    estoque9: 0,
                    estoque12: 0,
                    msgCustom: msgPadrao
                };
                await setDoc(userRef, dados);
            } else {
                // Se existe, pega os dados com segurança
                dados = userDoc.data();
            }

            // --- PROTEÇÃO CONTRA O ERRO DE UNDEFINED ---
            // Se dados.pago for undefined ou false, bloqueia
            if (!dados || dados.pago === false) {
                showBlock();
                return;
            }

            // Define a mensagem: usa a do banco, se não existir usa a padrão global
            msgPadrao = dados.msgCustom || msgPadrao;
            
            // Atualiza a interface (inputs de estoque e badge)
            atualizarInterfaceEstoque(dados);
            
            // Mostra o app e carrega clientes
            showApp();
            renderClientes();

        } catch (error) {
            console.error("Erro ao carregar perfil:", error);
        }
    } else {
        showLogin();
    }
});

// --- GESTÃO DE CLIENTES ---

window.abrirModalCadastro = () => document.getElementById('modal-cliente').classList.remove('hidden');
window.fecharModal = () => document.getElementById('modal-cliente').classList.add('hidden');

window.salvarCliente = async () => {
    const nome = document.getElementById('nome-cliente').value;
    const tel = document.getElementById('whatsapp-cliente').value;
    const modelo = parseInt(document.getElementById('modelo-refil-valor').value); // Pega do hidden input
    const qtd = parseInt(document.getElementById('qtd-refil').value) || 1;
    const dataVendaStr = document.getElementById('data-venda').value; // Pega a data do campo

    if (!nome || !tel || !dataVendaStr) return alert("Preencha todos os campos!");

    // Converte a string da data para objeto Date
    const partesData = dataVendaStr.split("-");
    const dataVenda = new Date(partesData[0], partesData[1] - 1, partesData[2]);
    
    // Calcula a próxima troca com base na data escolhida
    const proxima = new Date(dataVenda);
    proxima.setMonth(proxima.getMonth() + modelo);

    try {
        await addDoc(collection(db, "clientes"), {
            userId: usuarioLogado.uid,
            nome,
            whatsapp: tel,
            modelo,
            qtd,
            ultimaTroca: dataVenda,
            proximaTroca: proxima
        });
        

        // 2. Atualizar o Estoque com proteção contra undefined
        const userRef = doc(db, "users", usuarioLogado.uid);
        const userDoc = await getDoc(userRef);
        const dadosAtuais = userDoc.data() || {};
        
        // Se o campo não existir, assume 0 e subtrai a quantidade
        const estoqueAtual9 = dadosAtuais.estoque9 || 0;
        const estoqueAtual12 = dadosAtuais.estoque12 || 0;

        if (modelo === 9) {
            await updateDoc(userRef, { estoque9: estoqueAtual9 - qtd });
        } else {
            await updateDoc(userRef, { estoque12: estoqueAtual12 - qtd });
        }

        fecharModal();
        renderClientes();
        
        // Atualiza os inputs de estoque na tela caso o modal de estoque esteja aberto
        const userDocAtualizado = await getDoc(userRef);
        atualizarInterfaceEstoque(userDocAtualizado.data());
        
        alert("Cliente cadastrado com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar dados. Verifique sua conexão.");
    }
};

window.renderClientes = async () => {
    const q = query(collection(db, "clientes"), where("userId", "==", usuarioLogado.uid));
    const snapshot = await getDocs(q);
    const lista = document.getElementById('lista-clientes');
    lista.innerHTML = "";

    let hojeCount = 0, atrasadosCount = 0, seteDiasCount = 0;
    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    snapshot.forEach((d) => {
        const item = d.data();
        const id = d.id;
        const prox = item.proximaTroca.toDate();
        prox.setHours(0,0,0,0);
        
        const diffTempo = prox - hoje;
        const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));

        let statusClass = "status-ok";
        if (diffDias < 0) { statusClass = "status-vencido"; atrasadosCount++; }
        else if (diffDias === 0) { statusClass = "status-hoje"; hojeCount++; }
        else if (diffDias <= 7) { seteDiasCount++; }

        lista.innerHTML += `
            <div class="cliente-card ${statusClass}">
                <div class="flex justify-between">
                    <div>
                        <small class="text-gray-400">#${item.modelo == 9 ? 'Alcaline' : 'Max'}</small>
                        <h4 class="font-bold text-navy text-lg">${item.nome}</h4>
                        <p class="text-sm">Próxima: <b>${prox.toLocaleDateString()}</b></p>
                        <p class="text-xs ${diffDias < 0 ? 'text-red-600' : 'text-blue-600'}">
                            ${diffDias < 0 ? 'Atrasado há ' + Math.abs(diffDias) : 'Faltam ' + diffDias} dias
                        </p>
                    </div>
                </div>
                <div class="mt-4 flex gap-2">
                    <button onclick="confirmarReposicao('${id}', ${item.modelo})" class="bg-navy text-white flex-1 p-2 rounded text-xs font-bold">REPOSIÇÃO FEITA</button>
                    <button onclick="notificar('${item.nome}', '${item.whatsapp}', '${prox.toLocaleDateString()}', '${item.modelo}')" class="bg-green-500 text-white p-2 rounded px-4"><i class="fab fa-whatsapp"></i></button>
                    <button onclick="editarCliente('${id}')" class="bg-gray-200 text-gray-700 p-2 rounded px-3"><i class="fas fa-edit"></i></button>
                </div>
            </div>
        `;
    });

    document.getElementById('count-hoje').innerText = hojeCount;
    document.getElementById('count-atrasados').innerText = atrasadosCount;
    document.getElementById('count-7dias').innerText = seteDiasCount;

    // Disparar Notificação Interna se houver vencidos
    if (hojeCount > 0) {
        alert(`Atenção! Você tem ${hojeCount} troca(s) para hoje!`);
    }
};

window.confirmarReposicao = async (id, modelo) => {
    const dataManual = confirm("A troca foi feita hoje? Clique em OK para HOJE ou CANCELAR para definir outra data.");
    let novaDataBase = new Date();

    if (!dataManual) {
        const inputData = prompt("Digite a data da troca (AAAA-MM-DD):", new Date().toISOString().split('T')[0]);
        if (inputData) novaDataBase = new Date(inputData);
    }

    const novaProxima = new Date(novaDataBase);
    novaProxima.setMonth(novaProxima.getMonth() + modelo);

    await updateDoc(doc(db, "clientes", id), {
        ultimaTroca: novaDataBase,
        proximaTroca: novaProxima
    });

    // Baixa no estoque
    const userRef = doc(db, "users", usuarioLogado.uid);
    const userDoc = await getDoc(userRef);
    const key = modelo === 9 ? 'estoque9' : 'estoque12';
    await updateDoc(userRef, { [key]: userDoc.data()[key] - 1 });

    renderClientes();
    alert("Ciclo atualizado e stock abatido!");
};

// --- WHATSAPP ---
window.notificar = (nome, tel, data, modelo) => {
    const modNome = modelo == 9 ? "Alcaline (9 meses)" : "Alcaline Max (1 ano)";
    let msg = msgPadrao.replace("[NOME]", nome).replace("[DATA]", data).replace("[MODELO]", modNome);
    const link = `https://wa.me/55${tel.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`;
    window.open(link, '_blank');
};

// --- ESTOQUE ---
window.abrirEstoque = () => document.getElementById('modal-estoque').classList.remove('hidden');
window.fecharEstoque = () => document.getElementById('modal-estoque').classList.add('hidden');

window.atualizarEstoqueLocal = async () => {
    const s9 = parseInt(document.getElementById('stock-9').value);
    const s12 = parseInt(document.getElementById('stock-12').value);
    
    await updateDoc(doc(db, "users", usuarioLogado.uid), {
        estoque9: s9,
        estoque12: s12
    });
    
    if (s9 <= 2 || s12 <= 2) alert("Atenção: Stock baixo (menos de 2 unidades)!");
    document.getElementById('estoque-badge').innerText = s9 + s12;
};

function atualizarInterfaceEstoque(dados) {
    document.getElementById('stock-9').value = dados.estoque9 || 0;
    document.getElementById('stock-12').value = dados.estoque12 || 0;
    document.getElementById('estoque-badge').innerText = (dados.estoque9 || 0) + (dados.estoque12 || 0);
}

// --- FUNÇÕES DE NAVEGAÇÃO DE TELAS ---

function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('block-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
}

function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('block-screen').classList.add('hidden');
    document.getElementById('main-app').classList.add('hidden');
}

function showBlock() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('block-screen').classList.remove('hidden');
}

// Tornando as funções acessíveis para o HTML se necessário
window.showApp = showApp;
window.showLogin = showLogin;
window.showBlock = showBlock;

// --- FUNÇÃO DE EDIÇÃO ---

let idClienteSendoEditado = null;

window.editarCliente = async (id) => {
    idClienteSendoEditado = id;
    
    try {
        const docRef = doc(db, "clientes", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const dados = docSnap.data();
            
            // Preenche os campos de texto
            document.getElementById('nome-cliente').value = dados.nome || "";
            document.getElementById('whatsapp-cliente').value = dados.whatsapp || "";
            document.getElementById('qtd-refil').value = dados.qtd || 1;
            
            // Preenche a data (Proteção contra erro)
            if (dados.ultimaTroca && document.getElementById('data-venda')) {
                const dataISO = dados.ultimaTroca.toDate().toISOString().split('T')[0];
                document.getElementById('data-venda').value = dataISO;
            }

            // Seleciona o modelo nos botões
            if (document.getElementById('modelo-refil-valor')) {
                selecionarModelo(dados.modelo || 9);
            }
            
            document.getElementById('modal-title').innerText = "Editar Cliente";
            document.getElementById('modal-cliente').classList.remove('hidden');
            
            const btnSalvar = document.querySelector('.btn-confirm');
            btnSalvar.onclick = () => finalizarEdicao(id);
        }
    } catch (error) {
        console.error("Erro ao carregar cliente para edição:", error);
        alert("Erro ao carregar dados do cliente.");
    }
};

async function finalizarEdicao(id) {
    const nome = document.getElementById('nome-cliente').value;
    const tel = document.getElementById('whatsapp-cliente').value;
    const modelo = parseInt(document.getElementById('modelo-refil').value);
    const qtd = parseInt(document.getElementById('qtd-refil').value);

    const docRef = doc(db, "clientes", id);
    
    try {
        await updateDoc(docRef, {
            nome: nome,
            whatsapp: tel,
            modelo: modelo,
            qtd: qtd
        });
        
        alert("Dados atualizados!");
        fecharModal();
        renderClientes();
        
        // Restaura o botão para o modo "Novo Cadastro"
        const btnSalvar = document.querySelector('.btn-confirm');
        document.getElementById('modal-title').innerText = "Novo Cliente";
        btnSalvar.onclick = salvarCliente;
        
    } catch (error) {
        console.error("Erro ao editar:", error);
    }
}

// Garante que ao fechar o modal, os campos sejam limpos e o botão resetado
const originalFecharModal = window.fecharModal;
window.fecharModal = () => {
    document.getElementById('nome-cliente').value = "";
    document.getElementById('whatsapp-cliente').value = "";
    document.getElementById('modal-title').innerText = "Novo Cliente";
    document.querySelector('.btn-confirm').onclick = window.salvarCliente;
    originalFecharModal();
};

// Função para marcar o botão selecionado
window.selecionarModelo = (meses) => {
    document.getElementById('modelo-refil-valor').value = meses;
    
    // Remove classe ativa de todos e adiciona no clicado
    document.querySelectorAll('.btn-model').forEach(btn => btn.classList.remove('btn-model-active'));
    if(meses === 9) document.getElementById('btn-9m').classList.add('btn-model-active');
    else document.getElementById('btn-12m').classList.add('btn-model-active');
};

// Modifique o abrirModalCadastro para setar a data de hoje automaticamente
const originalAbrirModal = window.abrirModalCadastro;
window.abrirModalCadastro = () => {
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('data-venda').value = hoje;
    selecionarModelo(9); // Default 9 meses
    originalAbrirModal();
};
