import React, { useState } from "react";
import { Eye, EyeOff, CheckCircle2, ShieldCheck, TrendingUp, Users } from "lucide-react";
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

  const ATOUTS = [
    { icon: TrendingUp, text: "Stock, ventes et alertes de péremption en temps réel" },
    { icon: Users, text: "Toute l'équipe connectée, chacun avec son propre accès" },
    { icon: ShieldCheck, text: "Données sauvegardées automatiquement, à tout moment" },
  ];

  return (
    <div className="auth-shell">
      <style>{authStyles}</style>
      <div className="auth-grid">
        <div className="auth-brand-panel">
          <div className="auth-brand-glow" />
          <div className="auth-brand-content">
            <div className="auth-brand">
              <div className="auth-brand-mark"><img src="/logo.png" alt="Officine" /></div>
              <div>
                <div className="auth-brand-title">Officine</div>
                <div className="auth-brand-sub">Gestion de pharmacie</div>
              </div>
            </div>
            <h1 className="auth-tagline">L'officine, simplement mieux gérée.</h1>
            <p className="auth-tagline-sub">
              Stock, ventes, clients, fournisseurs et comptabilité — tout au même endroit, accessible depuis n'importe quel appareil.
            </p>
            <ul className="auth-atouts">
              {ATOUTS.map((a) => (
                <li key={a.text}>
                  <span className="auth-atout-icon"><a.icon size={15} /></span>
                  {a.text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-card">
            <div className="auth-card-head-mobile">
              <div className="auth-brand-mark"><img src="/logo.png" alt="Officine" /></div>
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

            <div className="auth-form-head">
              <h2>
                {mode === "inscription" ? "Créez votre espace" : mode === "oubli" ? "Mot de passe oublié" : "Content de vous revoir"}
              </h2>
              <p>
                {mode === "inscription"
                  ? "Quelques secondes suffisent pour démarrer."
                  : mode === "oubli"
                  ? "On vous envoie un lien pour le réinitialiser."
                  : "Connectez-vous pour accéder à votre officine."}
              </p>
            </div>

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
              {info && <div className="auth-info"><CheckCircle2 size={14} /> {info}</div>}

              <button className="auth-submit" type="submit" disabled={chargement}>
                {chargement
                  ? "Un instant…"
                  : mode === "inscription"
                  ? "Créer mon espace pharmacie"
                  : mode === "oubli"
                  ? "Envoyer le lien de réinitialisation"
                  : "Se connecter"}
              </button>

              {mode === "connexion" && (
                <p className="auth-switch">
                  Pas encore de compte ?{" "}
                  <button type="button" onClick={() => changerMode("inscription")}>Créer une pharmacie</button>
                </p>
              )}
              {mode === "inscription" && (
                <p className="auth-switch">
                  Déjà un compte ?{" "}
                  <button type="button" onClick={() => changerMode("connexion")}>Se connecter</button>
                </p>
              )}
            </form>
          </div>
        </div>
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
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&display=swap');

  .auth-shell {
    --ink: #16241c;
    --ink-soft: #56695d;
    --paper: #f8f4ea;
    --panel: #ffffff;
    --line: #e7e0cf;
    --teal: #0e5c48;
    --teal-deep: #0a3a2e;
    --sage: #e1ede3;
    --rose: #8f3a3a;
    --rose-soft: #f0dad7;
    --ok: #2c6b3d;
    --ok-soft: #dfeee1;
    --gold: #ab8636;
    --gold-soft: #f1e5c2;
    --font-display: 'Fraunces', Georgia, serif;
    --font-body: 'IBM Plex Sans', 'Segoe UI', Arial, sans-serif;
    min-height: 640px; display: flex;
    background: var(--paper); font-family: var(--font-body); color: var(--ink);
    border-radius: 12px; overflow: hidden; border: 1px solid var(--line);
    -webkit-font-smoothing: antialiased;
  }
  .auth-shell * { box-sizing: border-box; }

  .auth-grid { display: grid; grid-template-columns: 1.05fr 1fr; width: 100%; }

  /* ---------- Panneau de présentation ---------- */
  .auth-brand-panel {
    position: relative; overflow: hidden;
    background: linear-gradient(160deg, var(--teal-deep) 0%, #06201a 100%);
    color: #f3f1e9; padding: 44px 40px; display: flex; align-items: center;
  }
  .auth-brand-glow {
    position: absolute; width: 480px; height: 480px; border-radius: 50%;
    background: radial-gradient(circle, rgba(171,134,54,0.18) 0%, rgba(171,134,54,0) 70%);
    top: -160px; right: -160px; pointer-events: none;
  }
  .auth-brand-content { position: relative; z-index: 1; max-width: 380px; }
  .auth-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 36px; }
  .auth-brand-mark {
    width: 38px; height: 38px; border-radius: 9px; background: #f3f1e9; color: var(--teal-deep);
    display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;
  }
  .auth-brand-mark img { width: 100%; height: 100%; object-fit: contain; padding: 3px; }
  .auth-brand-title { font-family: var(--font-display); font-size: 17px; font-weight: 600; }
  .auth-brand-sub { font-size: 11px; opacity: 0.7; margin-top: 1px; }

  .auth-tagline {
    font-family: var(--font-display); font-weight: 600; font-size: 32px; line-height: 1.2;
    margin: 0 0 14px; letter-spacing: -0.3px;
  }
  .auth-tagline-sub { font-size: 13.5px; line-height: 1.6; color: #cfd9d1; margin: 0 0 32px; }
  .auth-atouts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
  .auth-atouts li { display: flex; align-items: flex-start; gap: 11px; font-size: 13px; line-height: 1.45; color: #eef0ea; }
  .auth-atout-icon {
    width: 26px; height: 26px; border-radius: 7px; background: rgba(171,134,54,0.22); color: var(--gold-soft);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
  }

  /* ---------- Panneau formulaire ---------- */
  .auth-form-panel { display: flex; align-items: center; justify-content: center; padding: 40px 32px; background: var(--paper); }
  .auth-card { width: 100%; max-width: 340px; }
  .auth-card-head-mobile { display: none; align-items: center; gap: 10px; margin-bottom: 22px; }

  .auth-form-head { margin-bottom: 20px; }
  .auth-form-head h2 { font-family: var(--font-display); font-size: 21px; font-weight: 600; margin: 0 0 5px; color: var(--teal-deep); letter-spacing: -0.2px; }
  .auth-form-head p { font-size: 12.5px; color: var(--ink-soft); margin: 0; }

  .auth-tabs { display: flex; border: 1px solid var(--line); border-radius: 9px; overflow: hidden; margin-bottom: 22px; background: var(--panel); }
  .auth-tabs button { flex: 1; border: none; background: transparent; padding: 9px; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); cursor: pointer; transition: background 0.15s ease, color 0.15s ease; }
  .auth-tab-active { background: var(--teal) !important; color: white !important; }
  .auth-back { margin-bottom: 18px; }
  .auth-back button { border: none; background: none; color: var(--teal); font-size: 12.5px; font-weight: 600; cursor: pointer; padding: 0; }

  .auth-form { display: flex; flex-direction: column; gap: 13px; }
  .auth-field { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; color: var(--ink-soft); font-weight: 600; }
  .auth-field input {
    border: 1px solid var(--line); border-radius: 8px; padding: 10px 11px; font-size: 13px;
    font-family: inherit; width: 100%; background: var(--panel); color: var(--ink);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .auth-field input:focus { outline: none; border-color: var(--teal); box-shadow: 0 0 0 3px rgba(14,92,72,0.12); }
  .auth-password-wrap { position: relative; display: flex; align-items: center; }
  .auth-password-wrap input { padding-right: 36px; }
  .auth-eye-btn {
    position: absolute; right: 6px; border: none; background: none; color: #9aa89f;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    padding: 5px; border-radius: 5px;
  }
  .auth-eye-btn:hover { color: var(--teal); background: var(--sage); }
  .auth-forgot { align-self: flex-end; border: none; background: none; color: var(--teal); font-size: 11.5px; font-weight: 600; cursor: pointer; padding: 0; margin-top: -4px; }
  .auth-error { background: var(--rose-soft); color: var(--rose); font-size: 12px; padding: 9px 11px; border-radius: 8px; }
  .auth-info { background: var(--ok-soft); color: var(--ok); font-size: 12px; padding: 9px 11px; border-radius: 8px; display: flex; align-items: center; gap: 6px; }
  .auth-submit {
    background: var(--teal); color: white; border: none; padding: 11px; border-radius: 9px;
    font-size: 13.5px; font-weight: 700; cursor: pointer; margin-top: 4px;
    transition: background 0.15s ease, box-shadow 0.15s ease;
    box-shadow: 0 6px 16px rgba(10,58,46,0.18);
  }
  .auth-submit:hover { background: var(--teal-deep); }
  .auth-submit:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
  .auth-switch { text-align: center; font-size: 12px; color: var(--ink-soft); margin: 6px 0 0; }
  .auth-switch button { border: none; background: none; color: var(--teal); font-weight: 700; cursor: pointer; padding: 0; font-size: 12px; }

  @media (max-width: 760px) {
    .auth-grid { grid-template-columns: 1fr; }
    .auth-brand-panel { display: none; }
    .auth-card-head-mobile { display: flex; }
    .auth-form-panel { padding: 32px 20px; }
  }
`;
