import React, { useState } from "react";
import { inscrirePharmacie, connecterPharmacie } from "./firebase.js";

// Écran affiché tant qu'aucune pharmacie n'est connectée.
// Une fois connecté, App.jsx bascule automatiquement vers l'application.
export default function Auth() {
  const [mode, setMode] = useState("connexion"); // "connexion" | "inscription"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nomPharmacie, setNomPharmacie] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErreur("");
    setChargement(true);
    try {
      if (mode === "inscription") {
        if (!nomPharmacie.trim()) {
          setErreur("Merci d'indiquer le nom de la pharmacie.");
          setChargement(false);
          return;
        }
        await inscrirePharmacie(email, password, nomPharmacie.trim());
      } else {
        await connecterPharmacie(email, password);
      }
      // Pas besoin de redirection manuelle : ecouterConnexion() dans
      // App.jsx détecte automatiquement la connexion et affiche l'app.
    } catch (err) {
      setErreur(traduireErreur(err.code));
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="auth-shell">
      <style>{authStyles}</style>
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-mark">℞</div>
          <div>
            <div className="auth-brand-title">Officine</div>
            <div className="auth-brand-sub">Gestion de pharmacie</div>
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={mode === "connexion" ? "auth-tab-active" : ""}
            onClick={() => { setMode("connexion"); setErreur(""); }}
            type="button"
          >
            Connexion
          </button>
          <button
            className={mode === "inscription" ? "auth-tab-active" : ""}
            onClick={() => { setMode("inscription"); setErreur(""); }}
            type="button"
          >
            Créer une pharmacie
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "inscription" && (
            <label className="auth-field">
              <span>Nom de la pharmacie</span>
              <input
                value={nomPharmacie}
                onChange={(e) => setNomPharmacie(e.target.value)}
                placeholder="Ex: Pharmacie du Plateau"
                required
              />
            </label>
          )}
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              required
            />
          </label>
          <label className="auth-field">
            <span>Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6 caractères minimum"
              minLength={6}
              required
            />
          </label>

          {erreur && <div className="auth-error">{erreur}</div>}

          <button className="auth-submit" type="submit" disabled={chargement}>
            {chargement
              ? "Un instant…"
              : mode === "inscription"
              ? "Créer mon espace pharmacie"
              : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}

function traduireErreur(code) {
  const map = {
    "auth/email-already-in-use": "Cet email est déjà utilisé par une pharmacie.",
    "auth/invalid-email": "Adresse email invalide.",
    "auth/weak-password": "Le mot de passe doit contenir au moins 6 caractères.",
    "auth/user-not-found": "Aucun compte ne correspond à cet email.",
    "auth/wrong-password": "Mot de passe incorrect.",
    "auth/invalid-credential": "Email ou mot de passe incorrect.",
  };
  return map[code] || "Une erreur est survenue. Réessayez.";
}

const authStyles = `
  .auth-shell {
    min-height: 640px; display: flex; align-items: center; justify-content: center;
    background: #f6f4ee; font-family: 'IBM Plex Sans', 'Segoe UI', Arial, sans-serif;
    border-radius: 12px; border: 1px solid #e2e2d8;
  }
  .auth-card { background: white; border: 1px solid #e2e2d8; border-radius: 12px; padding: 28px; width: 360px; max-width: 90vw; }
  .auth-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; }
  .auth-brand-mark { width: 36px; height: 36px; border-radius: 8px; background: #123a33; color: #f3f1e9; display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 700; font-family: Georgia, serif; }
  .auth-brand-title { font-family: Georgia, serif; font-size: 17px; font-weight: 700; color: #123a33; }
  .auth-brand-sub { font-size: 11px; color: #4b5c53; }
  .auth-tabs { display: flex; border: 1px solid #e2e2d8; border-radius: 8px; overflow: hidden; margin-bottom: 18px; }
  .auth-tabs button { flex: 1; border: none; background: #f6f4ee; padding: 9px; font-size: 12.5px; font-weight: 600; color: #4b5c53; cursor: pointer; }
  .auth-tab-active { background: #1f5148 !important; color: white !important; }
  .auth-form { display: flex; flex-direction: column; gap: 12px; }
  .auth-field { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; color: #4b5c53; font-weight: 600; }
  .auth-field input { border: 1px solid #e2e2d8; border-radius: 7px; padding: 9px 10px; font-size: 13px; font-family: inherit; }
  .auth-field input:focus { outline: 2px solid #1f5148; outline-offset: 1px; }
  .auth-error { background: #f3ddd8; color: #a5433a; font-size: 12px; padding: 8px 10px; border-radius: 7px; }
  .auth-submit { background: #1f5148; color: white; border: none; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; margin-top: 4px; }
  .auth-submit:hover { background: #123a33; }
  .auth-submit:disabled { opacity: 0.5; cursor: not-allowed; }
`;

