import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

// ⚠️ Remplace ces valeurs par celles de TON projet Firebase.
// Elles se trouvent dans : Console Firebase > Paramètres du projet > Général
// > "Vos applications" > icône Web (</>) > Config SDK.
const firebaseConfig = {
  apiKey: "AIzaSyCesyXpdobQgy-M_XHJ2w_xa53rEdhgEUU",
  authDomain: "gestion-de-pharmacie-7c82f.firebaseapp.com",
  projectId: "gestion-de-pharmacie-7c82f",
  storageBucket: "gestion-de-pharmacie-7c82f.firebasestorage.app",
  messagingSenderId: "164116273764",
  appId: "1:164116273764:web:be2558a57409c22fc7dd71",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Toutes les données de la pharmacie sont stockées dans la collection
// "pharmacie", un document par type de données (meds, ventes, clients).
// Cela reproduit le comportement de window.storage (une valeur JSON par clé),
// mais avec une vraie base de données partagée en ligne.

export async function getList(key) {
  const ref = doc(db, "pharmacie", key);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return snap.data().items || [];
}

export async function setList(key, items) {
  const ref = doc(db, "pharmacie", key);
  await setDoc(ref, { items });
}

// Écoute en temps réel : dès qu'un membre de l'équipe modifie une donnée,
// tous les autres appareils connectés voient la mise à jour instantanément.
export function subscribeList(key, callback) {
  const ref = doc(db, "pharmacie", key);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data().items || [] : []);
  });
}
