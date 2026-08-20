import React from "react";
import { X } from "lucide-react";

// Modal léger et autonome (n'importe pas App.jsx) pour afficher les
// textes légaux depuis l'écran de connexion, avant même d'être
// authentifié.
export function LegalModal({ title, onClose, children }) {
  return (
    <div
      className="legal-modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{legalStyles}</style>
      <div className="legal-modal-panel">
        <div className="legal-modal-head">
          <h3>{title}</h3>
          <button className="legal-close-btn" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="legal-modal-body">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// MENTIONS LÉGALES
// ---------------------------------------------------------------
export function MentionsLegales() {
  return (
    <>
      <p><strong>Éditeur du service</strong></p>
      <p>
        Officine est édité par Aboke Aboke Jean Joseph, entrepreneur individuel,
        domicilié à Abidjan, Côte d'Ivoire.
      </p>
      <ul>
        <li>Email : abokejean5@gmail.com</li>
        <li>Téléphone : 07 13 80 02 97</li>
        <li>Numéro RCCM : en cours d'attribution</li>
      </ul>

      <p><strong>Directeur de publication</strong></p>
      <p>Aboke Aboke Jean Joseph.</p>

      <p><strong>Hébergement</strong></p>
      <p>
        L'application est hébergée par :
      </p>
      <ul>
        <li>Google LLC (Firebase / Google Cloud Platform) — 1600 Amphitheatre Parkway, Mountain View, CA 94043, États-Unis</li>
        <li>Vercel Inc. — 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis</li>
      </ul>

      <p><strong>Contact</strong></p>
      <p>
        Pour toute question concernant ces mentions légales, écrivez à
        abokejean5@gmail.com ou appelez le 07 13 80 02 97.
      </p>
    </>
  );
}

// ---------------------------------------------------------------
// CONDITIONS GÉNÉRALES D'UTILISATION (CGU)
// ---------------------------------------------------------------
export function CGU() {
  return (
    <>
      <p><em>Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}</em></p>

      <p><strong>1. Objet</strong></p>
      <p>
        Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et
        l'utilisation d'Officine, un logiciel de gestion de pharmacie en ligne
        (stock, ventes, clients, fournisseurs, comptabilité et fonctionnalités
        associées), édité par Aboke Aboke Jean Joseph, entrepreneur individuel
        basé à Abidjan, Côte d'Ivoire. En créant un compte, l'utilisateur accepte
        sans réserve les présentes CGU.
      </p>

      <p><strong>2. Accès au service</strong></p>
      <p>
        Toute nouvelle pharmacie bénéficie d'une période d'essai gratuite de 14
        jours, sans obligation de renseigner un moyen de paiement. À l'issue de
        cette période, l'accès complet nécessite la souscription à l'un des plans
        payants proposés dans l'application.
      </p>

      <p><strong>3. Compte utilisateur</strong></p>
      <p>
        L'utilisateur est responsable de la confidentialité de son mot de passe et
        de toute activité effectuée depuis son compte. Le gérant d'une pharmacie
        est responsable des accès qu'il attribue aux membres de son équipe
        (caissiers) et peut les révoquer à tout moment depuis l'onglet Équipe.
      </p>

      <p><strong>4. Tarifs et paiement</strong></p>
      <p>
        Les tarifs en vigueur sont affichés dans l'onglet Abonnement de
        l'application. Le paiement s'effectue par Mobile Money (Orange Money, MTN
        Money, Moov Money, Wave) via CinetPay, ou par carte bancaire via Paystack.
        L'abonnement est renouvelé mensuellement ; l'utilisateur peut cesser de
        renouveler à tout moment, sans engagement de durée minimale.
      </p>

      <p><strong>5. Résiliation</strong></p>
      <p>
        L'utilisateur peut cesser d'utiliser le service à tout moment. En l'absence
        de renouvellement du paiement, l'accès aux fonctionnalités est suspendu ;
        les données déjà saisies restent conservées et consultables après
        réactivation de l'abonnement.
      </p>

      <p><strong>6. Responsabilité</strong></p>
      <p>
        Officine est un outil d'aide à la gestion et ne remplace ni le jugement
        professionnel du pharmacien, ni les obligations réglementaires propres à
        l'exercice de la pharmacie en Côte d'Ivoire. L'éditeur ne saurait être tenu
        responsable des erreurs de saisie effectuées par l'utilisateur ou d'une
        interruption temporaire du service liée à un incident technique
        indépendant de sa volonté (panne d'un hébergeur tiers, coupure réseau,
        etc.). L'utilisateur reste seul responsable de la conformité de son
        activité pharmaceutique.
      </p>

      <p><strong>7. Propriété intellectuelle</strong></p>
      <p>
        L'application, son code, son design et sa marque restent la propriété de
        l'éditeur. Les données saisies par l'utilisateur (stock, ventes, clients,
        etc.) lui appartiennent et peuvent être exportées à tout moment via les
        fonctions d'export Excel intégrées.
      </p>

      <p><strong>8. Modification des CGU</strong></p>
      <p>
        Les présentes CGU peuvent être modifiées à tout moment. Toute modification
        substantielle sera signalée dans l'application.
      </p>

      <p><strong>9. Droit applicable</strong></p>
      <p>
        Les présentes CGU sont soumises au droit ivoirien. Tout litige relève de la
        compétence des juridictions d'Abidjan, Côte d'Ivoire.
      </p>

      <p><strong>10. Contact</strong></p>
      <p>Pour toute question : abokejean5@gmail.com — 07 13 80 02 97.</p>
    </>
  );
}

// ---------------------------------------------------------------
// POLITIQUE DE CONFIDENTIALITÉ
// ---------------------------------------------------------------
export function PolitiqueConfidentialite() {
  return (
    <>
      <p><em>Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}</em></p>

      <p><strong>1. Responsable du traitement</strong></p>
      <p>
        Aboke Aboke Jean Joseph, entrepreneur individuel, Abidjan, Côte d'Ivoire —
        abokejean5@gmail.com — 07 13 80 02 97.
      </p>

      <p><strong>2. Données collectées</strong></p>
      <p>Officine collecte et traite :</p>
      <ul>
        <li>Les données de compte : email, nom de la pharmacie, mot de passe (chiffré par Firebase Authentication, jamais visible en clair).</li>
        <li>Les données saisies par l'utilisateur pour faire fonctionner l'application : stock de médicaments, ventes, fiches clients, fournisseurs, dépenses, ordonnances.</li>
        <li>Les données techniques nécessaires au paiement (transmises directement aux prestataires CinetPay et Paystack, jamais stockées par Officine elle-même).</li>
      </ul>

      <p><strong>3. Finalité du traitement</strong></p>
      <p>
        Ces données sont utilisées exclusivement pour faire fonctionner le
        service : afficher le stock, enregistrer les ventes, gérer l'équipe,
        générer les rapports et alertes, et traiter les paiements d'abonnement.
        Elles ne sont ni vendues, ni utilisées à des fins publicitaires.
      </p>

      <p><strong>4. Hébergement et sécurité</strong></p>
      <p>
        Les données sont hébergées sur l'infrastructure Firebase / Google Cloud
        Platform. Chaque pharmacie est isolée : un utilisateur ne peut jamais
        accéder aux données d'une autre pharmacie. Les règles de sécurité
        Firestore vérifient cette isolation à chaque lecture et écriture.
      </p>

      <p><strong>5. Durée de conservation</strong></p>
      <p>
        Les données sont conservées tant que le compte reste actif. En cas de
        suppression de compte demandée par l'utilisateur, les données sont
        supprimées dans un délai raisonnable, sauf obligation légale de
        conservation plus longue (par exemple pour des raisons comptables).
      </p>

      <p><strong>6. Partage avec des tiers</strong></p>
      <p>
        Aucune donnée n'est partagée avec des tiers à des fins commerciales. Les
        seules transmissions à des tiers concernent le traitement des paiements
        (CinetPay, Paystack) et l'hébergement technique (Google Firebase, Vercel),
        strictement nécessaires au fonctionnement du service.
      </p>

      <p><strong>7. Droits de l'utilisateur</strong></p>
      <p>
        Chaque utilisateur peut demander l'accès, la rectification ou la
        suppression de ses données personnelles en écrivant à
        abokejean5@gmail.com. Les données métier (stock, ventes, clients) restent
        exportables à tout moment depuis l'application (Excel).
      </p>

      <p><strong>8. Cookies et traceurs</strong></p>
      <p>
        L'application utilise uniquement les mécanismes techniques nécessaires à
        la connexion (session Firebase Authentication). Aucun cookie publicitaire
        ou traceur tiers n'est utilisé.
      </p>

      <p><strong>9. Contact</strong></p>
      <p>Pour toute question relative à vos données : abokejean5@gmail.com — 07 13 80 02 97.</p>
    </>
  );
}

const legalStyles = `
  .legal-modal-backdrop {
    position: fixed; inset: 0; background: rgba(14,20,17,0.55); backdrop-filter: blur(2px);
    display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px;
  }
  .legal-modal-panel {
    background: #ffffff; border-radius: 14px; width: 560px; max-width: 100%;
    max-height: 84vh; overflow-y: auto; box-shadow: 0 20px 48px rgba(10,58,46,0.2);
    font-family: 'IBM Plex Sans', 'Segoe UI', Arial, sans-serif;
  }
  .legal-modal-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; border-bottom: 1px solid #e7e0cf; position: sticky; top: 0;
    background: #ffffff;
  }
  .legal-modal-head h3 {
    margin: 0; font-size: 16px; font-weight: 600; color: #0a3a2e;
    font-family: 'Fraunces', Georgia, serif;
  }
  .legal-close-btn {
    width: 30px; height: 30px; border-radius: 6px; border: 1px solid #e7e0cf;
    background: #fff; color: #56695d; display: flex; align-items: center; justify-content: center;
    cursor: pointer;
  }
  .legal-close-btn:hover { background: #e1ede3; color: #0a3a2e; }
  .legal-modal-body { padding: 18px 22px 26px; font-size: 13px; line-height: 1.65; color: #16241c; }
  .legal-modal-body p { margin: 0 0 12px; }
  .legal-modal-body ul { margin: 0 0 12px; padding-left: 20px; }
  .legal-modal-body li { margin-bottom: 4px; }
`;
