import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inscrirePharmacie, connecterPharmacie, reinitialiserMotDePasse } from "./firebase.js";

// Écran affiché tant qu'aucune pharmacie n'est connectée.
// Une fois connecté, App.jsx bascule automatiquement vers l'application.
export default function Auth() {
  const [mode, setMode] = useState("connexion"); // "connexion" | "inscription" | "oubli"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [voirPassword, setVoirPassword] = useState(false);
  const [nomPharmacie, setNomPharmacie] = useState("");
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [chargement, setChargement] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErreur("");
    setInfo("");

    const emailPropre = email.trim().toLowerCase();

    if (mode === "inscription") {
      if (!nomPharmacie.trim()) {
        setErreur("Merci d'indiquer le nom de la pharmacie.");
        return;
      }
      if (password.length < 6) {
        setErreur("Le mot de passe doit contenir au moins 6 caractères.");
        return;
      }
      if (password !== confirmPassword) {
        setErreur("Les deux mots de passe ne correspondent pas.");
        return;
      }
    }

    setChargement(true);
    try {
      if (mode === "inscription") {
        await inscrirePharmacie(emailPropre, password, nomPharmacie.trim());
      } else if (mode === "oubli") {
        await reinitialiserMotDePasse(emailPropre);
        setInfo("Un email de réinitialisation a été envoyé. Vérifiez votre boîte de réception (et vos spams).");
      } else {
        await connecterPharmacie(emailPropre, password);
      }
      // Pas besoin de redirection manuelle : ecouterConnexion() dans
      // App.jsx détecte automatiquement la connexion et affiche l'app.
    } catch (err) {
      setErreur(traduireErreur(err.code));
    } finally {
      setChargement(false);
    }
  }

  function changerMode(nouveauMode) {
    setMode(nouveauMode);
    setErreur("");
    setInfo("");
    setPassword("");
    setConfirmPassword("");
    setVoirPassword(false);
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

        {mode !== "oubli" && (
          <div className="auth-tabs">
            <button
              className={mode === "connexion" ? "auth-tab-active" : ""}
              onClick={() => changerMode("connexion")}
              type="button"
            >
              Connexion
            </button>
            <button
              className={mode === "inscription" ? "auth-tab-active" : ""}
              onClick={() => changerMode("inscription")}
              type="button"
            >
              Créer une pharmacie
            </button>
          </div>
        )}

        {mode === "oubli" && (
          <div className="auth-back">
            <button type="button" onClick={() => changerMode("connexion")}>
              ← Retour à la connexion
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "inscription" && (
            <label className="auth-field">
              <span>Nom de la pharmacie</span>
              <input
                value={nomPharmacie}
                onChange={(e) => setNomPharmacie(e.target.value)}
                placeholder="Ex: Pharmacie du Plateau"
                autoFocus
                autoComplete="organization"
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
              autoFocus={mode !== "inscription"}
              autoComplete="email"
              required
            />
          </label>

          {mode !== "oubli" && (
            <label className="auth-field">
              <span>Mot de passe</span>
              <div className="auth-password-wrap">
                <input
                  type={voirPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6 caractères minimum"
                  minLength={6}
                  autoComplete={mode === "inscription" ? "new-password" : "current-password"}
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setVoirPassword((v) => !v)}
                  aria-label={voirPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  tabIndex={-1}
                >
                  {voirPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
          )}

          {mode === "inscription" && (
            <label className="auth-field">
              <span>Confirmer le mot de passe</span>
              <input
                type={voirPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Retapez le mot de passe"
                minLength={6}
                autoComplete="new-password"
                required
              />
            </label>
          )}

          {mode === "connexion" && (
            <button
              type="button"
              className="auth-forgot"
              onClick={() => changerMode("oubli")}
            >
              Mot de passe oublié ?
            </button>
          )}

          {erreur && <div className="auth-error">{erreur}</div>}
          {info && <div className="auth-info">{info}</div>}

          <button className="auth-submit" type="submit" disabled={chargement}>
            {chargement
              ? "Un instant…"
              : mode === "inscription"
              ? "Créer mon espace pharmacie"
              : mode === "oubli"
              ? "Envoyer le lien de réinitialisation"
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
    "auth/too-many-requests": "Trop de tentatives. Réessayez dans quelques minutes.",
    "auth/user-disabled": "Ce compte a été désactivé. Contactez le support.",
    "auth/network-request-failed": "Problème de connexion internet. Vérifiez votre réseau et réessayez.",
    "auth/missing-email": "Merci de renseigner votre email.",
    "auth/operation-not-allowed": "Cette méthode de connexion n'est pas activée. Contactez le support.",
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
  .auth-back { margin-bottom: 18px; }
  .auth-back button { border: none; background: none; color: #1f5148; font-size: 12.5px; font-weight: 600; cursor: pointer; padding: 0; }
  .auth-form { display: flex; flex-direction: column; gap: 12px; }
  .auth-field { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; color: #4b5c53; font-weight: 600; }
  .auth-field input { border: 1px solid #e2e2d8; border-radius: 7px; padding: 9px 10px; font-size: 13px; font-family: inherit; width: 100%; }
  .auth-field input:focus { outline: 2px solid #1f5148; outline-offset: 1px; }
  .auth-password-wrap { position: relative; display: flex; align-items: center; }
  .auth-password-wrap input { padding-right: 34px; }
  .auth-eye-btn {
    position: absolute; right: 6px; border: none; background: none; color: #8b988f;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    padding: 4px; border-radius: 5px;
  }
  .auth-eye-btn:hover { color: #1f5148; background: #e4ece4; }
  .auth-forgot { align-self: flex-end; border: none; background: none; color: #1f5148; font-size: 11.5px; font-weight: 600; cursor: pointer; padding: 0; margin-top: -4px; }
  .auth-error { background: #f3ddd8; color: #a5433a; font-size: 12px; padding: 8px 10px; border-radius: 7px; }
  .auth-info { background: #e1ede2; color: #2f6b3f; font-size: 12px; padding: 8px 10px; border-radius: 7px; }
  .auth-submit { background: #1f5148; color: white; border: none; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; margin-top: 4px; }
  .auth-submit:hover { background: #123a33; }
  .auth-submit:disabled { opacity: 0.5; cursor: not-allowed; }
`;
