import { auth, db } from "../firebase-config.js"; // Caminho voltando uma pasta
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("Teste de conexão DB:", db);

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
    const lista = document.getElementById('lista-usuarios');
    try {
        console.log("Buscando usuários...");
        const snap = await getDocs(collection(db, "users"));
        console.log("Usuários encontrados:", snap.size);
        
        if (snap.empty) {
            lista.innerHTML = "<p>Nenhum distribuidor cadastrado.</p>";
            return;
        }

        lista.innerHTML = "";
        snap.forEach(d => {
            const u = d.data();
            // Pula você mesmo (o admin) na lista
            if (u.role === 'admin') return;

            lista.innerHTML += `
                <div class="user-card" style="background:white; padding:15px; margin-bottom:10px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${u.email}</strong><br>
                        <small>Status: ${u.pago ? 'Ativo' : 'Pendente'}</small>
                    </div>
                    <button onclick="toggleAcesso('${d.id}', ${u.pago})" class="btn-repo">
                        ${u.pago ? 'Bloquear' : 'Liberar'}
                    </button>
                </div>`;
        });
    } catch (e) {
        console.error("Erro ao listar usuários:", e);
        lista.innerHTML = "<p>Erro ao carregar lista. Verifique as Regras de Segurança no Firebase.</p>";
    }
}
window.toggleAcesso = async (id, statusAtual) => {
    await updateDoc(doc(db, "users", id), { pago: !statusAtual });
    renderUsuarios();
};

window.toggleStatus = async (id, statusAtual) => {
    const novoStatus = statusAtual === 'pendente' ? 'ativo' : 'pendente';
    await updateDoc(doc(db, "users", id), { status: novoStatus });
    renderUsuarios();
};

window.logoutAdmin = () => signOut(auth);
