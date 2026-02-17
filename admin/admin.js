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
