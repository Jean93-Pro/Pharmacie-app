rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Chaque utilisateur peut lire son propre document d'accès
    // (pour savoir à quelle pharmacie il appartient et son rôle).
    match /acces/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      // Un utilisateur peut créer SON PROPRE accès (à l'inscription).
      allow create: if request.auth != null && request.auth.uid == uid
        && request.resource.data.pharmacieId == uid;
      // Un gérant peut créer l'accès d'un nouvel employé de SA pharmacie.
      allow create: if request.auth != null
        && get(/databases/$(database)/documents/acces/$(request.auth.uid)).data.role == 'gerant'
        && get(/databases/$(database)/documents/acces/$(request.auth.uid)).data.pharmacieId == request.resource.data.pharmacieId;
      // CORRIGÉ : un gérant ne peut supprimer que l'accès d'un membre
      // de SA PROPRE pharmacie (avant : n'importe quel accès, partout).
      allow delete: if request.auth != null
        && get(/databases/$(database)/documents/acces/$(request.auth.uid)).data.role == 'gerant'
        && get(/databases/$(database)/documents/acces/$(request.auth.uid)).data.pharmacieId == resource.data.pharmacieId;
      // NOUVEAU : un gérant peut désactiver (jamais réactiver, ni
      // changer la pharmacieId) l'accès d'un membre de sa pharmacie.
      allow update: if request.auth != null
        && get(/databases/$(database)/documents/acces/$(request.auth.uid)).data.role == 'gerant'
        && get(/databases/$(database)/documents/acces/$(request.auth.uid)).data.pharmacieId == resource.data.pharmacieId
        && request.resource.data.pharmacieId == resource.data.pharmacieId
        && request.resource.data.desactive == true;
    }
    match /pharmacies/{pharmacieId} {
      function estMembre() {
        return request.auth != null &&
          get(/databases/$(database)/documents/acces/$(request.auth.uid)).data.pharmacieId == pharmacieId;
      }
      function estGerant() {
        return request.auth != null &&
          get(/databases/$(database)/documents/acces/$(request.auth.uid)).data.pharmacieId == pharmacieId &&
          get(/databases/$(database)/documents/acces/$(request.auth.uid)).data.role == 'gerant';
      }
      allow read, write: if estMembre();
      match /meds/{medId} { allow read, write: if estMembre(); }
      match /sales/{saleId} {
        allow read: if estMembre();
        allow create: if estMembre();
        // Journal immuable : une vente ne peut plus être modifiée ni
        // supprimée après coup, y compris par un gérant. Les
        // corrections passeront par un avoir/une annulation tracée
        // (fonctionnalité à ajouter), jamais par une réécriture.
        allow update, delete: if false;
      }
      match /clients/{clientId} { allow read, write: if estMembre(); }
      // NOUVEAU : fiches fournisseurs et historique des commandes
      // passées auprès d'eux (voir onglet "Fournisseurs" côté appli).
      // La réception d'une commande met à jour le stock (meds) et le
      // statut de la commande en une seule transaction côté client ;
      // ces règles autorisent simplement la lecture/écriture par tout
      // membre de la pharmacie, comme pour meds et clients.
      match /fournisseurs/{fournisseurId} { allow read, write: if estMembre(); }
      match /commandes/{commandeId} { allow read, write: if estMembre(); }
      // NOUVEAU : retours/remboursements de vente. Un retour référence
      // une vente existante (immuable, voir /sales ci-dessus) sans la
      // modifier ; il remet le stock à jour et déduit son montant du
      // CA via une transaction côté client (voir creerRetour).
      match /retours/{retourId} { allow read, write: if estMembre(); }
      // NOUVEAU : ordonnances / suivi des traitements par client.
      match /ordonnances/{ordonnanceId} { allow read, write: if estMembre(); }
      // NOUVEAU : dépenses/charges de la pharmacie (Comptabilité).
      match /depenses/{depenseId} { allow read, write: if estMembre(); }
      // NOUVEAU : le document d'abonnement est spécifiquement protégé.
      // Un membre peut le LIRE (pour connaître son statut), et peut le
      // CRÉER uniquement pour démarrer un essai gratuit (statut/plan
      // forcés à "essai") — voir demarrerEssaiGratuit côté client.
      // Toute autre écriture (passage en "actif" après paiement) est
      // interdite ici : elle passe exclusivement par la Cloud Function
      // cinetpayNotify, qui utilise le SDK admin et contourne ces règles.
      match /meta/abonnement {
        allow read: if estMembre();
        allow create: if estMembre()
          && request.resource.data.statut == 'essai'
          && request.resource.data.plan == 'essai';
        allow update, delete: if false;
      }
      match /meta/{metaId} { allow read, write: if estMembre(); }
      match /membres/{uid} {
        allow read: if estMembre();
        allow write: if estGerant();
      }
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
