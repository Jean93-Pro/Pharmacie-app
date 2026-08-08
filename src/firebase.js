import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

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
export const auth = getAuth(app);

// ---------------------------------------------------------------
// AUTHENTIFICATION
// Chaque pharmacie cliente a son propre compte (email + mot de passe).
// Le "pharmacieId" utilisé pour isoler les données est l'UID Firebase
// de l'utilisateur connecté — unique, stable, et jamais choisi par
// l'utilisateur, donc impossible à deviner ou à usurper.
// ---------------------------------------------------------------

export async function inscrirePharmacie(email, password, nomPharmacie) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  // On enregistre le nom de la pharmacie dans un document à part,
  // pratique pour l'afficher dans l'interface plus tard.
  await setDoc(doc(db, "pharmacies", cred.user.uid), {
    nom: nomPharmacie,
    email,
    creeLe: new Date().toISOString(),
  });
  return cred.user;
}

export async function connecterPharmacie(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function deconnecter() {
  await signOut(auth);
}

// Appelle callback(user) à chaque changement d'état de connexion.
// user est null si personne n'est connecté.
export function ecouterConnexion(callback) {
  return onAuthStateChanged(auth, callback);
}

// ---------------------------------------------------------------
// DONNÉES — désormais isolées par pharmacie
// Avant : pharmacie/{key}                     (partagé par tout le monde)
// Après : pharmacies/{pharmacieId}/data/{key}  (propre à chaque pharmacie)
// ---------------------------------------------------------------

export async function getList(pharmacieId, key) {
  const ref = doc(db, "pharmacies", pharmacieId, "data", key);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return snap.data().items || [];
}

export async function setList(pharmacieId, key, items) {
  const ref = doc(db, "pharmacies", pharmacieId, "data", key);
  await setDoc(ref, { items });
}

export function subscribeList(pharmacieId, key, callback) {
  const ref = doc(db, "pharmacies", pharmacieId, "data", key);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data().items || [] : []);
  });
}
