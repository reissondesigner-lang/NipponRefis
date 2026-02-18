import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
  collection,
  getDocs,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const usersList = document.getElementById("usersList");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Não autenticado");
    return;
  }

  // AQUI você pode validar se é admin consultando /admins/{uid}

  const snapshot = await getDocs(collection(db, "users"));

  snapshot.forEach(docSnap => {
    const data = docSnap.data();

    const div = document.createElement("div");
    div.innerHTML = `
      <p>${data.email} - Pago: ${data.pago}</p>
      <button onclick="ativar('${docSnap.id}')">Ativar</button>
    `;

    usersList.appendChild(div);
  });
});

window.ativar = async (uid) => {
  await updateDoc(doc(db, "users", uid), {
    pago: true
  });

  alert("Usuário ativado!");
  location.reload();
};

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
