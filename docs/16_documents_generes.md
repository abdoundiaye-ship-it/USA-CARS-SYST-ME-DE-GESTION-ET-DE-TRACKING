# Documents générés par le système

Modèles de référence dans `reference/templates/` (Word). Pour la génération, créer des copies avec des balises (docxtemplater, syntaxe `{champ}`) dans `templates/` ; ne pas modifier les originaux.

| Document | Modèle de référence | Numéro | Généré quand | Visible client |
|---|---|---|---|---|
| Contrat de prestation | `USA_CARS_Contrat_Prestation_Services_Senegal_-_Revise.docx` (art. 1 à 40) | `reference` du contrat | Ouverture du dossier (un contrat par véhicule, B1) | oui |
| Ordre d’achat | Contrat, annexe B | — | Avant l’enchère | oui |
| Fiche opérationnelle | Contrat, annexe A | — | À la demande, mise à jour continue | non (interne), sauf décision contraire |
| Devis | `USA_CARS_Devis_Facture_Client_-_Revise.docx` (case « Devis ») | DV-AAAA-#### | Après l’adjudication | oui |
| Facture d’acompte | même modèle (case « Facture d’acompte ») | FA-AAAA-#### | Après acceptation du devis | oui |
| Facture de solde | même modèle (case « Facture de solde ») | FS-AAAA-#### | Après embarquement et B/L | oui |
| Reçu espèces | à créer (1 page, même charte) | RC-AAAA-#### | Paiement en espèces | oui |
| Note de remboursement | à créer (1 page) | RB-AAAA-#### | Exécution d’un remboursement de trop-perçu | oui |
| Décharge de remise | à créer | — | Remise des documents | oui |
| Relance / mise en demeure | à créer (art. 21–22) | — | Recouvrement | oui |

## Champs du devis / facture

En-tête : identité légale USA CARS (paramètres), type de document coché, numéro, date, n° contrat, référence dossier, client, téléphone, pièce/NINEA, e-mail.

Section 1 : marque, modèle, année, VIN, plateforme, lot, lieu d’achat, port de départ, transporteur, conteneur, navire/voyage, B/L, ETA (indicative), lien de suivi.

Section 2 :
- A — libellé fixe « Coût total d’acquisition du véhicule – forfait » + description fixe + `forfait_a`.
- B — libellé fixe « Logistique et transport maritime vers Dakar – forfait » + description fixe + `forfait_b`.
- C — assurance : case cochée selon `insurance`, montant (0 si refusée), initiales.
- D — lignes `adjustments` approuvées (libellé, montant).
- TVA (si taux > 0) ; TOTAL GÉNÉRAL USD.

Sections 3 à 5 : paiements reçus (date, mode, référence, montant USD, montant FCFA et taux du jour du paiement), total payé, solde USD, taux de référence du devis (valeur, source, date-heure du relevé), solde FCFA au taux du jour d’édition (« indicatif, réactualisé au paiement »), échéancier (paiement 1 = totalité du forfait A moins dépôt, solde avec ETA de référence).

Sections 6 à 8 : comptes officiels actifs, référence à indiquer, conditions, bloc de validation.

**Contrôle automatique** : un test parcourt le texte du fichier généré et échoue s’il contient un libellé ou un montant de `internal_costs`.

## Règles

- Un document émis est figé (fichier stocké + valeurs en base). Correction = annulation + nouveau document.
- Mention « PROJET » en filigrane tant que le paramètre `templates.legal_validated` est faux (décision D1).
- Chaque document soumis à acceptation porte une empreinte (SHA-256) enregistrée avec l’acceptation (R15).
- Export PDF : seconde étape (LibreOffice headless côté serveur ou service dédié), à décider en phase 3.
