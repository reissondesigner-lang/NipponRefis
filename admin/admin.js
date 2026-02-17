import { auth, db } from "../firebase-config.js"; // Caminho voltando uma pasta
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const areaLogin = document.getElementById('area-login-admin');
const areaPainel = document.getElementById('area-painel-admin');

// Monitor de Sessão
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
            mostrarPainel();
        } else {
            // Se logar mas não for admin, expulsa
            alert("Acesso Negado: Você não tem permissão de administrador.");
            await signOut(auth);
            location.reload();
        }
    } else {
        areaLogin.classList.remove('hidden');
        areaPainel.classList.add('hidden');
    }
});

// Função de Login Exclusiva para Admin
window.loginAdmin = async () => {
    const e = document.getElementById('admin-email').value;
    const s = document.getElementById('admin-senha').value;
    window.loginAdmin = loginAdmin;
    
    try {
        await signInWithEmailAndPassword(auth, e, s);
        // O onAuthStateChanged cuidará do resto
    } catch (error) {
        alert("Erro ao acessar: " + error.message);
    }
};

async function mostrarPainel() {
    areaLogin.classList.add('hidden');
    areaPainel.classList.remove('hidden');
    renderUsuarios();
}

async function renderUsuarios() {
    const snap = await getDocs(collection(db, "users"));
    const lista = document.getElementById('lista-usuarios');
    lista.innerHTML = "Carregando distribuidores...";

    try {
        const snap = await getDocs(collection(db, "users"));
        lista.innerHTML = "";

        snap.forEach(d => {
            const u = d.data();
            if(u.role === 'admin') return;

            const card = document.createElement('div');
            card.className = 'user-card';
            card.innerHTML = `
                <div>
                    <strong>${u.nome || 'Sem nome'}</strong><br>
                    <small>${u.email}</small> <span class="badge ${u.status === 'ativo' ? 'status-ativo' : 'status-pendente'}">${u.status || 'pendente'}</span>
                </div>
                <button onclick="toggleStatus('${d.id}', '${u.status || 'pendente'}')" class="btn-round" style="background:#0a4c96; color:white; width:auto; padding:5px 15px;">
                    ${u.status === 'pendente' ? 'Ativar' : 'Bloquear'}
                </button>
            `;
            lista.appendChild(card);
        });
    } catch (e) {
        lista.innerHTML = "Erro ao carregar.";
    }
}

window.toggleStatus = async (id, statusAtual) => {
    const novoStatus = statusAtual === 'pendente' ? 'ativo' : 'pendente';
    await updateDoc(doc(db, "users", id), { status: novoStatus });
    renderUsuarios();
};

window.logoutAdmin = () => signOut(auth);
