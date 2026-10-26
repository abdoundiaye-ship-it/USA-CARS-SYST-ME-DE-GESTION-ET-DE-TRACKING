# Rôles et permissions

Rôles techniques : `admin` (Administrateur), `management` (Direction), `accounting` (Comptabilité), `ops` (Agent opérations), `client`.

Démarrage (décision A3) : un seul compte **Administrateur avec accès complet** est créé au premier déploiement ; l’administrateur crée ensuite les autres utilisateurs et leur attribue un rôle depuis l’écran Utilisateurs. Les comptes client sont créés depuis la fiche client. Les permissions sont appliquées **par RLS et dans les fonctions serveur** ; l’interface ne fait que refléter ces droits.

**Référence vivante** (décision P6-5) : la rubrique **Aide → « Rôles et droits d’accès »** de l’application (administrateur et direction), construite à partir de `lib/help/roles-guide.ts`, lui-même fondé sur `SCREEN_ROLES` (`lib/auth/roles.ts`). Les tests unitaires (`lib/help/roles-guide.test.ts`) échouent si un droit d’écran n’est pas documenté. La matrice ci-dessous est générée depuis cette source (mise à jour du 26/10/2026).

Double authentification (paramètre `auth.mfa_required_roles`, décisions A4 et A4-bis) : administrateur, comptabilité, direction.

L = consulter · C = créer · M = modifier · V = valider · S = supprimer · — = aucun accès

| Module | admin | management | accounting | ops | client |
|---|---|---|---|---|---|
| **Pilotage** | | | | | |
| Tableau de bord et recherche | L | L | L | L | — |
| Rapports et exports Excel | L | L | L | L | — |
| **Clients et dossiers** | | | | | |
| Clients | L C M | L | L | L C M | L (sa fiche) |
| Accès du client au portail | C | — | — | C | — |
| Dossiers : ouverture, étapes et statuts | L C M V (exceptions, dérogation d’âge) | L | L | L C M | L (les siens) |
| Contrat, ordre d’achat et acceptations | L C M | L | L | L C M | L V (acceptation) |
| Conteneurs, ETA et suivi | L C M | L | L | L C M | L (ses conteneurs) |
| Documents | L C M | L | L C M | L C M | L (si `visible_client`) |
| Remise des documents | L C | L | L | L C | L |
| Réclamations après l’enlèvement | L C M | L | L | L C M | L C (les siennes) |
| Relances et mises en demeure | L C M | L C M | L C M | L | L (courriers envoyés) |
| Procédure « véhicule non réclamé » | L C M | L C M | L | L | — |
| Notifications au client | L C M (test) | L | L M (renvoi) | L M (renvoi) | L (les siennes) |
| **Finances** | | | | | |
| Écran Finances et taux de change | L C | L | L C | — | — (taux figé sur ses documents) |
| Forfaits et coûts internes | L C M S | L | L C M S | L C M S | **—** |
| Devis | L C M | L | L C M | L C M | L V (acceptation, assurance) |
| Factures et ajustements (frais, remises, retards) | L C M V | L | L C M V | L | L V (frais supplémentaires) |
| Paiements | L C M | L | L C M | L | L (les siens) |
| Remboursements du trop-perçu | L M V | L | L M (exécution) | L | L (les siens) |
| Comptes officiels de paiement | L C M V | L V (approbation, Q1) | L | L | L (comptes actifs) |
| **Administration** | | | | | |
| Paramètres contractuels | L M V (validation P6-4) | L | L | L | — |
| Transporteurs et liens de suivi | L C M | L | L | L | — |
| Jours fériés (jours ouvrés) | L C S | L | L | L | — |
| Utilisateurs et rôles | L C M | L | — | — | — |
| Journal d’audit | L | L | — | — | — |
| Anonymisation des dossiers | L C V (double validation) | L | — | — | — |
| Guide des rôles et droits | L | L | — | — | — |

Rapports (droits vérifiés par la base) : dossiers actifs et délais achat → Dakar (admin, direction, agent) ; retards (tous les internes) ; créances par client (admin, direction, comptabilité) ; marge par véhicule, conservation des données, revue des accès (admin, direction).

Suppressions : aucune dans l’historique (on annule, on désactive, on crée une nouvelle version). Exceptions : une ligne de coût interne ou un jour férié saisis par erreur, et l’anonymisation d’un dossier à l’échéance de conservation (G2-c/G2-d).

Validations à deux personnes : comptes officiels (créateur ≠ approbateur, admin ou direction) ; anonymisation (demandeur ≠ approbateur, deux administrateurs).

Tests obligatoires (phase 1 puis à chaque nouvelle table) :
1. Un client A ne peut lire aucune ligne d’un client B (dossiers, documents, paiements, notifications, événements).
2. Le rôle `client` reçoit zéro ligne de `internal_costs`, et aucun document ou vue client ne contient la marge.
3. Seul `admin` crée ou modifie un compte officiel ; son activation est approuvée par `admin` ou `management` (décision Q1), et l’approbateur doit être différent du créateur.
4. Un document émis (`financial_documents.status <> 'draft'`) ne peut plus être modifié, seulement annulé.
