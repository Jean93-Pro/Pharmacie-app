import { initializeApp, deleteApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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
  arrayUnion,
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
// Mode hors-ligne : Firestore garde en cache local (IndexedDB) tout ce
// qui a déjà été lu, et met en FILE D'ATTENTE les écritures simples
// (ajout/modif client, fournisseur, dépense...) faites sans réseau —
// elles partent automatiquement dès que la connexion revient.
// persistentMultipleTabManager permet d'avoir l'appli ouverte dans
// plusieurs onglets sans conflit sur le cache local.
// LIMITE IMPORTANTE : les opérations qui utilisent runTransaction
// (finaliserVente, receptionnerCommande, creerRetour, addLot...) ont
// BESOIN d'une connexion active pour vérifier le stock en toute
// sécurité — elles restent bloquées hors-ligne, volontairement, pour
// ne jamais risquer de survendre un article.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
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
    logAudit(pharmacieId, "employe_invite", { email, role });

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
  logAudit(pharmacieId, "employe_retire", { uid });
}
export function ecouterConnexion(callback) {
  return onAuthStateChanged(auth, callback);
}

// Suit l'état de connexion réseau du navigateur (pas celui de
// Firestore lui-même) — utilisé pour afficher un indicateur et
// bloquer les actions qui ont besoin d'une transaction sécurisée
// (vente, réception de commande, retour) tant qu'il n'y a pas de
// réseau. Appelle callback immédiatement avec l'état actuel, puis à
// chaque changement.
export function ecouterReseau(callback) {
  callback(navigator.onLine);
  const onOnline = () => callback(true);
  const onOffline = () => callback(false);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
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
  logAudit(pharmacieId, "medicament_ajoute", { nom: med.name });
}

export async function updateMed(pharmacieId, medId, data) {
  const ref = doc(db, "pharmacies", pharmacieId, "meds", medId);
  await updateDoc(ref, data);
  logAudit(pharmacieId, "medicament_modifie", { medId, champs: Object.keys(data) });
}

export async function deleteMed(pharmacieId, medId) {
  const ref = doc(db, "pharmacies", pharmacieId, "meds", medId);
  await deleteDoc(ref);
  logAudit(pharmacieId, "medicament_supprime", { medId });
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

    // Coût total des marchandises vendues dans cette vente (pour la
    // marge réelle) — lu depuis le champ coutAchat de chaque médicament
    // AU MOMENT de la vente, et figé sur la ligne de vente : si le coût
    // d'achat change plus tard, les ventes passées gardent leur marge
    // d'origine plutôt que d'être recalculées après coup.
    const coutTotal = cartItems.reduce((sum, item, idx) => {
      const coutUnitaire = medSnaps[idx].data().coutAchat || 0;
      return sum + coutUnitaire * item.qty;
    }, 0);

    // 3) Enregistrer la vente — avec l'identité de l'employé qui l'a
    // faite, pour que le gérant puisse toujours savoir qui a vendu quoi.
    tx.set(saleRef, {
      ...saleMeta,
      employeEmail: auth.currentUser ? auth.currentUser.email : null,
      employeUid: auth.currentUser ? auth.currentUser.uid : null,
      items: cartItems.map((i, idx) => ({
        medId: i.medId,
        name: i.name,
        price: i.price,
        qty: i.qty,
        coutAchat: medSnaps[idx].data().coutAchat || 0,
      })),
      coutTotal,
      createdAt: serverTimestamp(),
    });

    // 4) Incrémenter les compteurs globaux de la pharmacie
    tx.set(
      compteursRef,
      {
        totalRevenue: increment(saleMeta.total),
        totalCout: increment(coutTotal),
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
// FOURNISSEURS — fiche contact par fournisseur, et un historique de
// commandes indépendant (collection "commandes"). Chaque commande
// référence son fournisseur par id et par nom (le nom est dupliqué
// pour continuer à s'afficher même si la fiche fournisseur est
// supprimée plus tard).
// ---------------------------------------------------------------
export function subscribeFournisseurs(pharmacieId, callback) {
  const ref = collection(db, "pharmacies", pharmacieId, "fournisseurs");
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addFournisseur(pharmacieId, data) {
  const ref = collection(db, "pharmacies", pharmacieId, "fournisseurs");
  await addDoc(ref, data);
}

export async function updateFournisseur(pharmacieId, id, data) {
  await updateDoc(doc(db, "pharmacies", pharmacieId, "fournisseurs", id), data);
}

export async function deleteFournisseur(pharmacieId, id) {
  await deleteDoc(doc(db, "pharmacies", pharmacieId, "fournisseurs", id));
}

// ---------------------------------------------------------------
// COMMANDES FOURNISSEURS
// pharmacies/{pharmacieId}/commandes/{commandeId} :
//   { fournisseurId, fournisseurName, items: [{medId,name,qty,coutUnitaire}],
//     total, statut: "en_attente" | "recue", createdAt, dateReception }
// La réception d'une commande passe OBLIGATOIREMENT par receptionnerCommande
// (transaction) : elle incrémente le stock de chaque article ET marque la
// commande "recue" en une seule opération atomique, pour éviter qu'une
// commande soit marquée reçue sans que le stock soit vraiment mis à jour
// (ou l'inverse) en cas de coupure réseau au mauvais moment.
// ---------------------------------------------------------------
export function subscribeCommandes(pharmacieId, callback, max = 500) {
  const ref = query(
    collection(db, "pharmacies", pharmacieId, "commandes"),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function creerCommande(pharmacieId, data) {
  const ref = collection(db, "pharmacies", pharmacieId, "commandes");
  await addDoc(ref, {
    ...data,
    statut: "en_attente",
    createdAt: serverTimestamp(),
  });
}

// La réception d'une commande met à jour le stock ET, si un numéro de
// lot a été renseigné sur la ligne de commande (voir CommandeModal côté
// App.jsx), ajoute une entrée de traçabilité dans meds/{medId}.lots —
// numéro de lot, quantité reçue, péremption. Ça permet de retrouver
// plus tard de quel lot/fournisseur provenait un article en stock.
export async function receptionnerCommande(pharmacieId, commande) {
  const commandeRef = doc(db, "pharmacies", pharmacieId, "commandes", commande.id);

  await runTransaction(db, async (tx) => {
    const medRefs = commande.items.map((i) =>
      doc(db, "pharmacies", pharmacieId, "meds", i.medId)
    );
    const medSnaps = await Promise.all(medRefs.map((ref) => tx.get(ref)));

    medSnaps.forEach((snap, idx) => {
      const item = commande.items[idx];
      if (snap.exists()) {
        const med = snap.data();
        const update = { quantity: (med.quantity || 0) + item.qty };
        if (item.lotNumero && item.lotNumero.trim()) {
          if (item.lotExpiry && (!med.expiry || item.lotExpiry < med.expiry)) {
            update.expiry = item.lotExpiry;
          }
          update.lots = arrayUnion({
            numero: item.lotNumero.trim(),
            quantity: item.qty,
            expiry: item.lotExpiry || null,
            dateReception: new Date().toISOString().slice(0, 10),
            fournisseur: commande.fournisseurName || "",
          });
        }
        tx.update(medRefs[idx], update);
      }
    });

    tx.update(commandeRef, {
      statut: "recue",
      dateReception: new Date().toISOString().slice(0, 10),
    });
  });
}

export async function annulerCommande(pharmacieId, commandeId) {
  await deleteDoc(doc(db, "pharmacies", pharmacieId, "commandes", commandeId));
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

// Même principe, mais via Stripe Checkout (carte bancaire) — pour les
// pharmacies hors de la zone Mobile Money d'Afrique de l'Ouest.
export async function creerLienPaiementStripe(pharmacieId, plan) {
  const appelable = httpsCallable(functions, "creerPaiementStripe");
  const res = await appelable({ pharmacieId, plan });
  return res.data.paymentUrl;
}

// ---------------------------------------------------------------
// RETOURS / REMBOURSEMENTS — un retour référence la vente d'origine
// et remet en stock chaque article retourné, tout en déduisant son
// montant du chiffre d'affaires total. Fait en UNE transaction pour
// que stock, compteurs et journal du retour restent cohérents même
// en cas d'écriture concurrente (deux employés sur deux appareils).
// ---------------------------------------------------------------
export function subscribeRetours(pharmacieId, callback, max = 500) {
  const ref = query(
    collection(db, "pharmacies", pharmacieId, "retours"),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// items: [{ medId, name, price, qty, coutAchat }] — les articles et
// quantités effectivement retournés (peut être une partie seulement de
// la vente). coutAchat est optionnel : s'il est fourni (repris depuis
// la ligne de vente d'origine), le coût des marchandises vendues est
// corrigé d'autant, pour que la marge réelle reste exacte après retour.
export async function creerRetour(pharmacieId, saleId, items, motif) {
  const retourRef = doc(collection(db, "pharmacies", pharmacieId, "retours"));
  const compteursRef = doc(db, "pharmacies", pharmacieId, "meta", "compteurs");
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const coutTotal = items.reduce((sum, i) => sum + (i.coutAchat || 0) * i.qty, 0);

  await runTransaction(db, async (tx) => {
    const medRefs = items.map((i) => doc(db, "pharmacies", pharmacieId, "meds", i.medId));
    const medSnaps = await Promise.all(medRefs.map((ref) => tx.get(ref)));

    medSnaps.forEach((snap, idx) => {
      const item = items[idx];
      if (snap.exists()) {
        tx.update(medRefs[idx], { quantity: snap.data().quantity + item.qty });
      }
      // Si le médicament a été supprimé du stock entre-temps, on
      // n'échoue pas tout le retour pour autant — le montant est quand
      // même déduit du CA et le retour reste enregistré.
    });

    tx.set(retourRef, {
      saleId,
      items,
      total,
      coutTotal,
      motif: motif || "",
      employeEmail: auth.currentUser ? auth.currentUser.email : null,
      date: new Date().toISOString().slice(0, 10),
      createdAt: serverTimestamp(),
    });

    tx.set(
      compteursRef,
      { totalRevenue: increment(-total), totalCout: increment(-coutTotal) },
      { merge: true }
    );
  });

  logAudit(pharmacieId, "retour_enregistre", { saleId, total, articles: items.length });

  return retourRef.id;
}

// ---------------------------------------------------------------
// ORDONNANCES — historique par client. Un client peut avoir zéro,
// une, ou plusieurs ordonnances au fil du temps.
// pharmacies/{pharmacieId}/ordonnances/{ordonnanceId}
// ---------------------------------------------------------------
export function subscribeOrdonnances(pharmacieId, callback, max = 1000) {
  const ref = query(
    collection(db, "pharmacies", pharmacieId, "ordonnances"),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addOrdonnance(pharmacieId, data) {
  const ref = collection(db, "pharmacies", pharmacieId, "ordonnances");
  await addDoc(ref, { ...data, createdAt: serverTimestamp() });
}

export async function updateOrdonnance(pharmacieId, ordonnanceId, data) {
  const ref = doc(db, "pharmacies", pharmacieId, "ordonnances", ordonnanceId);
  await updateDoc(ref, data);
}

export async function deleteOrdonnance(pharmacieId, ordonnanceId) {
  const ref = doc(db, "pharmacies", pharmacieId, "ordonnances", ordonnanceId);
  await deleteDoc(ref);
}

// ---------------------------------------------------------------
// LOTS — traçabilité pharmaceutique. Chaque médicament porte un
// tableau `lots` (numéro, quantité, péremption, date de réception),
// alimenté automatiquement par receptionnerCommande quand un numéro
// de lot est renseigné sur la commande, ou manuellement via cette
// fonction. C'est un journal additif à but de traçabilité ; la
// quantité et la péremption globales du médicament (utilisées par les
// alertes et la vente) restent les champs `quantity`/`expiry` existants.
// ---------------------------------------------------------------
export async function addLotAMed(pharmacieId, medId, lot) {
  const ref = doc(db, "pharmacies", pharmacieId, "meds", medId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Médicament introuvable.");
    const med = snap.data();
    const update = {
      quantity: (med.quantity || 0) + lot.quantity,
      lots: arrayUnion({
        numero: lot.numero,
        quantity: lot.quantity,
        expiry: lot.expiry || null,
        dateReception: new Date().toISOString().slice(0, 10),
      }),
    };
    if (lot.expiry && (!med.expiry || lot.expiry < med.expiry)) {
      update.expiry = lot.expiry;
    }
    tx.update(ref, update);
  });
}

// ---------------------------------------------------------------
// DÉPENSES / CHARGES — journal des charges de la pharmacie (loyer,
// salaires, électricité...), pour calculer le bénéfice net réel
// (marge brute des ventes moins ces dépenses) dans l'onglet Comptabilité.
// pharmacies/{pharmacieId}/depenses/{depenseId}
// ---------------------------------------------------------------
export function subscribeDepenses(pharmacieId, callback, max = 1000) {
  const ref = query(
    collection(db, "pharmacies", pharmacieId, "depenses"),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addDepense(pharmacieId, data) {
  const ref = collection(db, "pharmacies", pharmacieId, "depenses");
  await addDoc(ref, {
    ...data,
    employeEmail: auth.currentUser ? auth.currentUser.email : null,
    createdAt: serverTimestamp(),
  });
  logAudit(pharmacieId, "depense_ajoutee", { categorie: data.categorie, montant: data.montant });
}

export async function updateDepense(pharmacieId, depenseId, data) {
  const ref = doc(db, "pharmacies", pharmacieId, "depenses", depenseId);
  await updateDoc(ref, data);
}

export async function deleteDepense(pharmacieId, depenseId) {
  const ref = doc(db, "pharmacies", pharmacieId, "depenses", depenseId);
  await deleteDoc(ref);
  logAudit(pharmacieId, "depense_supprimee", { depenseId });
}

// ---------------------------------------------------------------
// JOURNAL D'AUDIT — trace qui a fait quoi et quand, pour les actions
// sensibles (stock, ventes, argent, équipe). Écriture 'best effort' :
// enveloppée dans un try/catch pour ne JAMAIS faire échouer l'action
// principale si la journalisation elle-même rencontre un problème.
// pharmacies/{pharmacieId}/audit/{entryId}
// ---------------------------------------------------------------
export async function logAudit(pharmacieId, action, details) {
  try {
    const ref = collection(db, "pharmacies", pharmacieId, "audit");
    await addDoc(ref, {
      action,
      details: details || {},
      employeEmail: auth.currentUser ? auth.currentUser.email : null,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    // Volontairement silencieux : un souci de journalisation ne doit
    // jamais empêcher l'action métier elle-même de se terminer.
  }
}

export function subscribeAudit(pharmacieId, callback, max = 300) {
  const ref = query(
    collection(db, "pharmacies", pharmacieId, "audit"),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
