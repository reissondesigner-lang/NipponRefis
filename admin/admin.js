import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { db } from "../firebase-config.js";

const auth = getAuth();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Acesso negado.");
    window.location.href = "../index.html";
    return;
  }

  carregarUsuarios();
});

async function carregarUsuarios() {
  const snap = await getDocs(collection(db, "users"));
  const container = document.getElementById("admin-users");
  container.innerHTML = "";

  snap.forEach(docSnap => {
    const d = docSnap.data();

    container.innerHTML += `
      <div style="border-bottom:1px solid #ddd;padding:10px 0;">
        <b>${d.email}</b><br>
        Status: <b>${d.subscriptionStatus}</b><br>
        <button onclick="ativar('${docSnap.id}')">Ativar</button>
        <button onclick="desativar('${docSnap.id}')">Desativar</button>
      </div>
    `;
  });
}

window.ativar = async (uid) => {
  await updateDoc(doc(db, "users", uid), {
    subscriptionStatus: "active"
  });
  alert("Ativado");
  carregarUsuarios();
};

window.desativar = async (uid) => {
  await updateDoc(doc(db, "users", uid), {
    subscriptionStatus: "inactive"
  });
  alert("Desativado");
  carregarUsuarios();
};
