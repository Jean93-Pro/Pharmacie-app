import { initializeApp, deleteApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
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
  limit,
  increment,
} from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

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
export const functions = getFunctions(app);

// ---------------------------------------------------------------
// AUTHENTIFICATION (inchangé)
// ---------------------------------------------------------------
export async function inscrirePharmacie(email, password, nomPharmacie) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  await addDoc(collection(db, "pharmacies", uid, "meta"), {
    nom: nomPharmacie,
    email,
    creeLe: new Date().toISOString(),
  });
  // La personne qui crée la pharmacie est automatiquement "gérant",
  // avec accès complet (y compris la gestion de l'équipe).
  await setDoc(doc(db, "acces", uid), { pharmacieId: uid, role: "gerant", email });
  await setDoc(doc(db, "pharmacies", uid, "membres", uid), {
    email, role: "gerant", creeLe: new Date().toISOString(),
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

// ---------------------------------------------------------------
// ÉQUIPE — un gérant peut inviter des employés (caissiers). Chaque
// employé se connecte avec SON PROPRE email/mot de passe, mais accède
// aux données de la MÊME pharmacie. On retrouve la pharmacie et le
// rôle d'un utilisateur via le document pharmacies/{pharmacieId} :
// désormais via la collection "acces/{uid}".
// ---------------------------------------------------------------

// Retrouve la pharmacie et le rôle associés au compte connecté.
// Retourne null si le compte n'a pas encore de document d'accès
// (cas des comptes créés avant l'ajout de la gestion d'équipe).
export async function getAcces(uid) {
  const snap = await getDoc(doc(db, "acces", uid));
  return snap.exists() ? snap.data() : null;
}

// Crée le document d'accès manquant pour un compte existant (créé
// avant la gestion d'équipe) — le rend "gérant" de sa propre pharmacie,
// comme c'était implicitement le cas jusqu'ici.
export async function reparerAccesExistant(uid, email) {
  await setDoc(doc(db, "acces", uid), { pharmacieId: uid, role: "gerant", email });
  await setDoc(doc(db, "pharmacies", uid, "membres", uid), {
    email, role: "gerant", creeLe: new Date().toISOString(),
  });
}

// Crée le compte Firebase de l'employé SANS déconnecter le gérant :
// on utilise une instance Firebase secondaire, isolée de la session
// principale, uniquement pour cette création de compte.
export async function inviterEmploye(pharmacieId, email, password, role) {
  const secondaryApp = initializeApp(firebaseConfig, "invite-" + Date.now());
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const nouvelUid = cred.user.uid;

    await setDoc(doc(db, "acces", nouvelUid), { pharmacieId, role, email });
    await setDoc(doc(db, "pharmacies", pharmacieId, "membres", nouvelUid), {
      email, role, creeLe: new Date().toISOString(),
    });

    return nouvelUid;
  } finally {
    // On referme proprement la session secondaire, sans jamais toucher
    // à la session principale du gérant.
    await signOut(secondaryAuth);
    await deleteApp(secondaryApp);
  }
}

export function subscribeMembres(pharmacieId, callback) {
  const ref = collection(db, "pharmacies", pharmacieId, "membres");
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// Retire un employé de l'équipe. CORRIGÉ : on ne supprime plus le
// document d'accès — on le marque "desactive". Le supprimer laissait
// l'employé revenir automatiquement (via reparerAccesExistant, côté
// App.jsx) comme gérant d'une pharmacie neuve à sa prochaine connexion.
// Remarque : son compte Firebase Authentication n'est pas supprimé
// (cela nécessite un accès admin côté serveur) — mais il ne peut plus
// entrer dans l'application une fois désactivé.
export async function retirerEmploye(pharmacieId, uid) {
  await deleteDoc(doc(db, "pharmacies", pharmacieId, "membres", uid));
  await setDoc(
    doc(db, "acces", uid),
    { pharmacieId, role: "retire", desactive: true },
    { merge: true }
  );
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
  // Compteurs globaux (CA total, nombre de ventes), mis à jour de façon
  // atomique avec la vente. Rapports peut ainsi lire ces totaux en UNE
  // seule lecture, sans jamais avoir à recharger tout l'historique.
  const compteursRef = doc(db, "pharmacies", pharmacieId, "meta", "compteurs");

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

    // 3) Enregistrer la vente — avec l'identité de l'employé qui l'a
    // faite, pour que le gérant puisse toujours savoir qui a vendu quoi.
    tx.set(saleRef, {
      ...saleMeta,
      employeEmail: auth.currentUser ? auth.currentUser.email : null,
      employeUid: auth.currentUser ? auth.currentUser.uid : null,
      items: cartItems.map((i) => ({
        medId: i.medId,
        name: i.name,
        price: i.price,
        qty: i.qty,
      })),
      createdAt: serverTimestamp(),
    });

    // 4) Incrémenter les compteurs globaux de la pharmacie
    tx.set(
      compteursRef,
      {
        totalRevenue: increment(saleMeta.total),
        totalSalesCount: increment(1),
      },
      { merge: true }
    );
  });

  return saleRef.id;
}

// Ne renvoie que les `max` ventes les plus récentes en temps réel —
// pas tout l'historique. Une pharmacie active peut accumuler des
// dizaines de milliers de ventes en quelques années ; les charger en
// entier à chaque connexion ralentirait l'appli et ferait grimper les
// coûts de lecture Firestore. Pour les totaux exacts sur toute la
// durée de vie de la pharmacie, voir subscribeCompteurs ci-dessous.
export function subscribeSales(pharmacieId, callback, max = 500) {
  const ref = query(
    collection(db, "pharmacies", pharmacieId, "sales"),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// CA total et nombre de ventes total, sur toute la durée de vie de la
// pharmacie — une seule lecture, indépendante du nombre de ventes.
export function subscribeCompteurs(pharmacieId, callback) {
  const ref = doc(db, "pharmacies", pharmacieId, "meta", "compteurs");
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data() : { totalRevenue: 0, totalSalesCount: 0 });
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

// ---------------------------------------------------------------
// ABONNEMENT & PAIEMENT
// pharmacies/{pharmacieId}/meta/abonnement : { plan, statut, dateFin }
// - Le document est créé côté client UNE SEULE FOIS, avec un essai
//   gratuit de 14 jours (voir demarrerEssaiGratuit). Toute mise à jour
//   ultérieure (passage en "actif" après paiement) passe OBLIGATOIREMENT
//   par la Cloud Function cinetpayNotify, qui utilise les droits admin —
//   les règles Firestore interdisent au client d'écrire statut:"actif"
//   lui-même. Voir firestore.rules et functions/index.js.
// ---------------------------------------------------------------
export function subscribeAbonnement(pharmacieId, callback) {
  const ref = doc(db, "pharmacies", pharmacieId, "meta", "abonnement");
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

// Ne crée le document que s'il n'existe pas encore — ne touche jamais à
// un abonnement déjà en place (essai en cours, ou plan payé actif).
export async function demarrerEssaiGratuit(pharmacieId) {
  const ref = doc(db, "pharmacies", pharmacieId, "meta", "abonnement");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const dateFin = new Date();
    dateFin.setDate(dateFin.getDate() + 14);
    await setDoc(ref, {
      plan: "essai",
      statut: "essai",
      dateFin: dateFin.toISOString().slice(0, 10),
    });
  }
}

// Demande à la Cloud Function de créer une session de paiement CinetPay
// (Orange Money, MTN Money, Moov Money, Wave) et renvoie l'URL vers
// laquelle rediriger l'utilisateur.
export async function creerLienPaiement(pharmacieId, plan) {
  const appelable = httpsCallable(functions, "creerPaiement");
  const res = await appelable({ pharmacieId, plan });
  return res.data.paymentUrl;
}
