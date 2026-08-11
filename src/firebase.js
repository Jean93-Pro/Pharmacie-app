import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
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
// AUTHENTIFICATION (inchangé)
// ---------------------------------------------------------------
export async function inscrirePharmacie(email, password, nomPharmacie) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await addDoc(collection(db, "pharmacies", cred.user.uid, "meta"), {
    nom: nomPharmacie,
    email,
    creeLe: new Date().toISOString(),
  });
  return cred.user;
}
export async function connecterPharmacie(email, password) { 
  import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
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
// AUTHENTIFICATION (inchangé)
// ---------------------------------------------------------------
export async function inscrirePharmacie(email, password, nomPharmacie) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await addDoc(collection(db, "pharmacies", cred.user.uid, "meta"), {
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

// Envoie un email de réinitialisation de mot de passe. Firebase se charge
// de tout : l'envoi de l'email, le lien, et la page de changement de
// mot de passe. On n'a rien d'autre à héberger nous-mêmes.
export async function reinitialiserMotDePasse(email) {
  await sendPasswordResetEmail(auth, email);
}
export function ecouterConnexion(callback) {
  return onAuthStateChanged(auth, callback);
}

// ---------------------------------------------------------------
// MÉDICAMENTS — un document par médicament (au lieu d'un tableau)
// pharmacies/{pharmacieId}/meds/{medId}
// Ça permet à Firestore de gérer les écritures concurrentes
// article par article, sans qu'un employé écrase le travail d'un autre.
// ---------------------------------------------------------------
export function subscribeMeds(pharmacieId, callback) {
  const ref = collection(db, "pharmacies", pharmacieId, "meds");
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addMed(pharmacieId, med) {
  const ref = collection(db, "pharmacies", pharmacieId, "meds");
  await addDoc(ref, med);
}

export async function updateMed(pharmacieId, medId, data) {
  const ref = doc(db, "pharmacies", pharmacieId, "meds", medId);
  await updateDoc(ref, data);
}

export async function deleteMed(pharmacieId, medId) {
  const ref = doc(db, "pharmacies", pharmacieId, "meds", medId);
  await deleteDoc(ref);
}

// Insère les médicaments d'exemple UNE SEULE FOIS, seulement si la
// pharmacie n'a encore aucun médicament enregistré.
export async function seedMedsIfEmpty(pharmacieId, seedItems) {
  const ref = collection(db, "pharmacies", pharmacieId, "meds");
  const snap = await getDocs(ref);
  if (snap.empty) {
    await Promise.all(seedItems.map((m) => addDoc(ref, m)));
  }
}

// ---------------------------------------------------------------
// VENTES — un document par vente, créé via une TRANSACTION.
// La transaction relit le stock exact au moment de l'écriture,
// vérifie qu'il y a assez de quantité pour CHAQUE article, puis
// décrémente le stock ET enregistre la vente en une seule opération
// atomique. Si deux employés vendent le dernier article en même
// temps, Firestore garantit qu'une seule des deux ventes passera
// avec la bonne quantité — l'autre recevra une erreur claire au
// lieu de survendre ou d'écraser les données de l'autre.
// ---------------------------------------------------------------
export async function finaliserVente(pharmacieId, cartItems, saleMeta) {
  const saleRef = doc(collection(db, "pharmacies", pharmacieId, "sales"));

  await runTransaction(db, async (tx) => {
    const medRefs = cartItems.map((i) =>
      doc(db, "pharmacies", pharmacieId, "meds", i.medId)
    );
    const medSnaps = await Promise.all(medRefs.map((ref) => tx.get(ref)));

    // 1) Vérifier le stock réel AVANT d'écrire quoi que ce soit
    medSnaps.forEach((snap, idx) => {
      const item = cartItems[idx];
      if (!snap.exists()) {
        throw new Error(`Médicament introuvable : ${item.name}`);
      }
      const stockActuel = snap.data().quantity;
      if (stockActuel < item.qty) {
        throw new Error(
          `Stock insuffisant pour ${item.name} (il reste ${stockActuel})`
        );
      }
    });

    // 2) Décrémenter chaque médicament
    medSnaps.forEach((snap, idx) => {
      const item = cartItems[idx];
      tx.update(medRefs[idx], { quantity: snap.data().quantity - item.qty });
    });

    // 3) Enregistrer la vente
    tx.set(saleRef, {
      ...saleMeta,
      items: cartItems.map((i) => ({
        medId: i.medId,
        name: i.name,
        price: i.price,
        qty: i.qty,
      })),
      createdAt: serverTimestamp(),
    });
  });

  return saleRef.id;
}

export function subscribeSales(pharmacieId, callback) {
  const ref = query(
    collection(db, "pharmacies", pharmacieId, "sales"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// ---------------------------------------------------------------
// CLIENTS — un document par client, même logique que les médicaments.
// ---------------------------------------------------------------
export function subscribeClients(pharmacieId, callback) {
  const ref = collection(db, "pharmacies", pharmacieId, "clients");
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addClient(pharmacieId, client) {
  const ref = collection(db, "pharmacies", pharmacieId, "clients");
  await addDoc(ref, client);
}

export async function updateClient(pharmacieId, clientId, data) {
  const ref = doc(db, "pharmacies", pharmacieId, "clients", clientId);
  await updateDoc(ref, data);
}

export async function deleteClient(pharmacieId, clientId) {
  const ref = doc(db, "pharmacies", pharmacieId, "clients", clientId);
  await deleteDoc(ref);
}
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}
export async function deconnecter() {
  await signOut(auth);
}
export function ecouterConnexion(callback) {
  return onAuthStateChanged(auth, callback);
}

// ---------------------------------------------------------------
// MÉDICAMENTS — un document par médicament (au lieu d'un tableau)
// pharmacies/{pharmacieId}/meds/{medId}
// Ça permet à Firestore de gérer les écritures concurrentes
// article par article, sans qu'un employé écrase le travail d'un autre.
// ---------------------------------------------------------------
export function subscribeMeds(pharmacieId, callback) {
  const ref = collection(db, "pharmacies", pharmacieId, "meds");
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addMed(pharmacieId, med) {
  const ref = collection(db, "pharmacies", pharmacieId, "meds");
  await addDoc(ref, med);
}

export async function updateMed(pharmacieId, medId, data) {
  const ref = doc(db, "pharmacies", pharmacieId, "meds", medId);
  await updateDoc(ref, data);
}

export async function deleteMed(pharmacieId, medId) {
  const ref = doc(db, "pharmacies", pharmacieId, "meds", medId);
  await deleteDoc(ref);
}

// Insère les médicaments d'exemple UNE SEULE FOIS, seulement si la
// pharmacie n'a encore aucun médicament enregistré.
export async function seedMedsIfEmpty(pharmacieId, seedItems) {
  const ref = collection(db, "pharmacies", pharmacieId, "meds");
  const snap = await getDocs(ref);
  if (snap.empty) {
    await Promise.all(seedItems.map((m) => addDoc(ref, m)));
  }
}

// ---------------------------------------------------------------
// VENTES — un document par vente, créé via une TRANSACTION.
// La transaction relit le stock exact au moment de l'écriture,
// vérifie qu'il y a assez de quantité pour CHAQUE article, puis
// décrémente le stock ET enregistre la vente en une seule opération
// atomique. Si deux employés vendent le dernier article en même
// temps, Firestore garantit qu'une seule des deux ventes passera
// avec la bonne quantité — l'autre recevra une erreur claire au
// lieu de survendre ou d'écraser les données de l'autre.
// ---------------------------------------------------------------
export async function finaliserVente(pharmacieId, cartItems, saleMeta) {
  const saleRef = doc(collection(db, "pharmacies", pharmacieId, "sales"));

  await runTransaction(db, async (tx) => {
    const medRefs = cartItems.map((i) =>
      doc(db, "pharmacies", pharmacieId, "meds", i.medId)
    );
    const medSnaps = await Promise.all(medRefs.map((ref) => tx.get(ref)));

    // 1) Vérifier le stock réel AVANT d'écrire quoi que ce soit
    medSnaps.forEach((snap, idx) => {
      const item = cartItems[idx];
      if (!snap.exists()) {
        throw new Error(`Médicament introuvable : ${item.name}`);
      }
      const stockActuel = snap.data().quantity;
      if (stockActuel < item.qty) {
        throw new Error(
          `Stock insuffisant pour ${item.name} (il reste ${stockActuel})`
        );
      }
    });

    // 2) Décrémenter chaque médicament
    medSnaps.forEach((snap, idx) => {
      const item = cartItems[idx];
      tx.update(medRefs[idx], { quantity: snap.data().quantity - item.qty });
    });

    // 3) Enregistrer la vente
    tx.set(saleRef, {
      ...saleMeta,
      items: cartItems.map((i) => ({
        medId: i.medId,
        name: i.name,
        price: i.price,
        qty: i.qty,
      })),
      createdAt: serverTimestamp(),
    });
  });

  return saleRef.id;
}

export function subscribeSales(pharmacieId, callback) {
  const ref = query(
    collection(db, "pharmacies", pharmacieId, "sales"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// ---------------------------------------------------------------
// CLIENTS — un document par client, même logique que les médicaments.
// ---------------------------------------------------------------
export function subscribeClients(pharmacieId, callback) {
  const ref = collection(db, "pharmacies", pharmacieId, "clients");
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addClient(pharmacieId, client) {
  const ref = collection(db, "pharmacies", pharmacieId, "clients");
  await addDoc(ref, client);
}

export async function updateClient(pharmacieId, clientId, data) {
  const ref = doc(db, "pharmacies", pharmacieId, "clients", clientId);
  await updateDoc(ref, data);
}

export async function deleteClient(pharmacieId, clientId) {
  const ref = doc(db, "pharmacies", pharmacieId, "clients", clientId);
  await deleteDoc(ref);
}
