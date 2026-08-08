# Officine — Application de gestion de pharmacie

Application complète : stock, ventes (caisse), clients, rapports.
Les données sont partagées en temps réel entre tous les membres de l'équipe via Firebase.

## Étape 1 — Créer le projet Firebase (gratuit)

1. Va sur https://console.firebase.google.com
2. Clique sur **Ajouter un projet**, donne-lui un nom (ex: "officine-pharmacie")
3. Une fois le projet créé, clique sur l'icône **Web** (`</>`) pour ajouter une application web
4. Donne un nom à l'app, puis Firebase t'affiche un bloc `firebaseConfig` — **copie ces valeurs**
5. Dans le menu de gauche, va dans **Build > Firestore Database**, clique sur **Créer une base de données**
   - Choisis le mode **Production**
   - Choisis une région proche (ex: `eur3` ou `europe-west`)
6. Une fois créée, va dans l'onglet **Règles** de Firestore et remplace le contenu par :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /pharmacie/{document} {
      allow read, write: if true;
    }
  }
}
```

⚠️ Ces règles sont ouvertes (pas d'authentification) — pratiques pour démarrer vite entre collègues de confiance,
mais n'importe qui avec le lien de l'app pourrait modifier les données. Si tu veux sécuriser l'accès avec un mot
de passe par utilisateur, dis-le-moi : on peut ajouter Firebase Authentication ensuite.

## Étape 2 — Connecter le code à ton projet Firebase

Ouvre le fichier `src/firebase.js` et remplace les valeurs `REMPLACE_MOI` par celles copiées à l'étape 1.

## Étape 3 — Tester en local (optionnel, nécessite Node.js installé)

```bash
npm install
npm run dev
```

L'app s'ouvre sur http://localhost:5173

## Étape 4 — Mettre le code sur GitHub

1. Crée un compte sur https://github.com si tu n'en as pas
2. Crée un nouveau dépôt (repository), nomme-le par exemple `pharmacie-app`
3. Dépose tous les fichiers de ce dossier dedans (via l'interface web GitHub, glisser-déposer fonctionne
   pour un premier envoi simple)

## Étape 5 — Déployer sur Vercel (gratuit)

1. Va sur https://vercel.com, crée un compte avec ton GitHub
2. Clique sur **Add New > Project**
3. Sélectionne ton dépôt `pharmacie-app`
4. Vercel détecte automatiquement Vite — clique sur **Deploy**
5. Après 1-2 minutes, tu obtiens un lien du type `pharmacie-app.vercel.app`

Partage ce lien avec ton équipe — chacun peut l'ouvrir depuis son téléphone ou ordinateur.
Toutes les modifications (ventes, stock, clients) se synchronisent automatiquement entre tous les appareils.

## Structure du projet

```
pharmacie-app/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx       → point d'entrée
│   ├── App.jsx         → toute l'application (interface + logique)
│   └── firebase.js     → connexion à la base de données partagée
```
