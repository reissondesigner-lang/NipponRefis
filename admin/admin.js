// Importando as instâncias já configuradas do arquivo principal
import { auth, db } from "../app.js"; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Proteção da Página: Só entra se for Admin
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
            console.log("Bem-vindo, Admin!");
            renderUsuarios();
        } else {
            alert("Acesso Negado! Área restrita para administradores.");
            window.location.href = "../index.html";
        }
    } else {
        window.location.href = "../index.html";
    }
});

async function renderUsuarios() {
    const loader = document.getElementById('loader');
    const lista = document.getElementById('lista-usuarios');
    if(loader) loader.classList.remove('hidden');
    lista.innerHTML = "";

    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        if(loader) loader.classList.add('hidden');

        querySnapshot.forEach((d) => {
            const u = d.data();
            if (u.role === 'admin') return; 

            const card = document.createElement('div');
            card.className = 'user-card';
            card.innerHTML = `
                <div>
                    <strong>${u.nome || 'Sem Nome'}</strong><br>
                    <small>${u.email}</small><br>
                    <span class="badge ${u.status === 'ativo' ? 'status-ativo' : 'status-pendente'}">
                        ${u.status ? u.status.toUpperCase() : 'PENDENTE'}
                    </span>
                </div>
                <div>
                    <button onclick="toggleStatus('${d.id}', '${u.status || 'pendente'}')" class="btn-repo" style="background: var(--azul-marinho); color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer;">
                        ${u.status === 'pendente' ? 'Ativar Acesso' : 'Bloquear'}
                    </button>
                </div>
            `;
            lista.appendChild(card);
        });
    } catch (error) {
        console.error("Erro ao buscar usuários:", error);
        lista.innerHTML = "Erro ao carregar usuários. Verifique as permissões do banco de dados.";
    }
}

// Função global para os botões
window.toggleStatus = async (id, statusAtual) => {
    const novoStatus = statusAtual === 'pendente' ? 'ativo' : 'pendente';
    if (confirm(`Mudar status do distribuidor para ${novoStatus}?`)) {
        try {
            await updateDoc(doc(db, "users", id), { status: novoStatus });
            renderUsuarios();
        } catch (e) {
            alert("Erro ao atualizar status: " + e.message);
        }
    }
};
