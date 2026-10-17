# Points de clarification

Les décisions de USA CARS font foi pour le développement (voir `CLAUDE.md`). Ce fichier contient :
1. les **décisions prises** (section 1) ;
2. les **interprétations** que Claude Code doit appliquer pour certaines réponses, et qu’il doit faire confirmer (section 2) ;
3. les **questions encore ouvertes**, avec la phase qu’elles bloquent et l’hypothèse par défaut (section 3).

Format pour ajouter une décision : `ID — date — décision`.

---

## 1. Décisions prises (17/10/2026)

| ID | Sujet | Décision |
|---|---|---|
| A1 | Comptes techniques | Les comptes **GitHub** et **Supabase** sont créés et détenus par USA CARS. Projet Supabase : référence `hzgkhtaefpbqztwagwph` (tableau de bord : https://supabase.com/dashboard/project/hzgkhtaefpbqztwagwph). |
| A3 | Utilisateurs | Créer **un compte Administrateur avec accès complet**. USA CARS créera ensuite les autres utilisateurs et leur attribuera un rôle depuis l’application. Pas d’accès partenaire USA pour l’instant. |
| B1 | Contrat | **Un contrat par véhicule** (un contrat = un dossier = un véhicule). |
| B2 | Devis multi-véhicules | Non : un devis et ses factures par dossier (conséquence de B1). |
| C1 | Forfaits A et B | **Phase actuelle : calcul manuel.** L’agent en charge de l’opération établit la structure des coûts, calcule les forfaits A et B hors du système ou avec l’aide d’une grille de saisie, puis **saisit les montants** des forfaits. **À terme** : calcul automatique proposé par le système (structure de coûts, règles de marge, arrondi), toujours soumis à vérification et approbation avant validation définitive. Le modèle de données doit dès maintenant permettre cette évolution. |
| C2 | Paiement 1 et dépôt | Le paiement 1 couvre **tout le forfait A**. Le dépôt est égal au **montant total du forfait A** (voir interprétation I2). |
| C3 | TVA et mentions légales | **À confirmer plus tard** avec l’expert-comptable. Champ TVA à 0 % en attendant. |
| C4 | Taux de change | Le taux utilisé est celui **de la date d’émission du devis** ; il est **réactualisé au moment du paiement**. Arrondi des montants FCFA **à l’unité la plus proche**. Pas de majoration (voir interprétation I1). |
| C6 | Trop-perçu | Le trop-perçu est **restitué au client** (remboursement enregistré et justifié). |
| D1 | Validation des modèles | Le développement avance sans attendre l’avocat. Les documents générés portent la mention **« PROJET »** tant que les modèles et les valeurs surlignées ne sont pas validés. |
| D3 | Signature / validation des documents | **Trois options proposées** : (1) document papier signé puis scanné et téléversé ; (2) validation par WhatsApp (preuve enregistrée) ; (3) acceptation directe dans le portail client (horodatée). |
| I1 | Majoration du taux | **Confirmé le 17/10/2026** : aucune majoration en pourcentage. Le devis affiche le montant FCFA au taux du jour de son émission ; à chaque paiement, le montant FCFA est recalculé au taux du jour du paiement. Le montant en USD reste la référence. |
| I2 | Dépôt | **Confirmé le 17/10/2026** : avant l’enchère, dépôt égal au **forfait A estimé à partir de l’enchère maximale** de l’ordre d’achat. Après l’adjudication, le dépôt est imputé sur le paiement 1 (totalité du forfait A) : le client paie la différence, ou l’excédent lui est restitué. Lot non remporté : dépôt intégralement restitué. |
| A1-bis | Environnements | Le projet Supabase `hzgkhtaefpbqztwagwph` est la **production**. Développement et tests sur Supabase **local** uniquement (voir `CLAUDE.md` §2). |
| A1-ter | Dépôt GitHub | https://github.com/abdoundiaye-ship-it/USA-CARS-SYST-ME-DE-GESTION-ET-DE-TRACKING (le garder **privé** : il contiendra les modèles de contrat et la configuration). |
| A2 | Hébergement | USA CARS indique **GitHub** (voir interprétation I5 sur l’hébergement de l’application elle-même). |
| A3-bis | Compte administrateur initial | `abdou.ndiaye@icloud.com` (variable `ADMIN_EMAIL`). |
| E1 / E2 / E3 | Connexion client et notifications | **Dès la première version** : le client reçoit son lien de connexion **par WhatsApp et par e-mail** ; les notifications partent **par e-mail et par WhatsApp** via des services d’envoi réels. |
| A4 | Double authentification | **17/10/2026** : TOTP (application d’authentification) **obligatoire pour admin et comptabilité** ; non imposé à la direction ni aux agents opérations. Liste des rôles paramétrable (`auth.mfa_required_roles`). |
| B3 | Numérotation | **17/10/2026** : référence dossier `UC-AAAA-####` ; compteurs **annuels**, continus et sans trou, pour les dossiers et les documents DV, FA, FS. |
| X7 | Date d’effet des paramètres | **17/10/2026** : chaque dossier conserve la date d’effet des paramètres en vigueur à son ouverture ; une modification de paramètre ne s’applique qu’aux nouveaux dossiers (cahier des charges §6). |

---

## 2. Interprétations à faire confirmer par USA CARS

I1 et I2 ont été confirmées le 17/10/2026 (voir section 1). Restent I3, I4 et I5 : Claude Code applique ces interprétations par défaut, les rappelle dans son plan de phase et attend confirmation avant la phase concernée.

| ID | Réponse donnée | Interprétation appliquée | Phase |
|---|---|---|---|
| I3 | Connexion par lien WhatsApp et e-mail. | Supabase Auth envoie nativement des **liens magiques par e-mail**. Pour WhatsApp, deux solutions à valider techniquement : (a) code à usage unique (OTP) envoyé par WhatsApp via un fournisseur compatible Supabase ; (b) lien de connexion à usage unique généré côté serveur et envoyé par un **modèle WhatsApp d’authentification approuvé**. Claude Code propose la solution en phase 4 avant de la développer. | 4 |
| I4 | Calcul manuel des forfaits par l’agent. | L’agent (rôle `ops`) peut saisir les forfaits A et B et, s’il le souhaite, le détail interne des coûts. **Pas d’approbation obligatoire** en phase actuelle (`quote.require_approval = false`), mais l’émission est journalisée. Ce détail et la marge ne sont jamais visibles du client. | 3 |
| I5 | Hébergeur : GitHub. | GitHub héberge le **code** (dépôt) et l’**intégration continue** (GitHub Actions). GitHub Pages ne sert que des sites **statiques** : il ne peut pas exécuter la partie serveur de l’application (génération des devis et factures, clés Supabase secrètes, réception des messages WhatsApp, tâches planifiées). Deux options : **(a) recommandée** — application Next.js déployée automatiquement depuis le dépôt GitHub sur Vercel (offre gratuite pour démarrer), Supabase restant la base de production ; **(b)** interface statique sur GitHub Pages et toute la logique serveur dans des Supabase Edge Functions (plus de travail, mêmes fonctionnalités). Claude Code applique **(a)** par défaut et attend la confirmation de USA CARS avant le premier déploiement. | 0 (déploiement) |

**Documents à aligner** (hors développement) : l’article 8 du contrat prévoit un taux relevé à la date d’émission de la **facture** ; la décision C4 retient la date du **devis** avec réactualisation au paiement. L’article 6 laisse le dépôt « à définir » ; la décision C2 le fixe au forfait A. Le contrat et le devis Word doivent être mis à jour en conséquence.

---

## 3. Questions encore ouvertes

| # | Question | Bloque | Hypothèse par défaut |
|---|---|---|---|
| A5 | Langue de l’interface. | — | Français uniquement. |
| A6 | Volume attendu (dossiers/mois, clients, utilisateurs internes). | — | 50 dossiers/mois, 200 clients, 10 internes. |
| A7 | Dossiers en cours à reprendre (Excel, papier) ? | Phase 2 | Pas de reprise ; saisie manuelle. |
| B4 | Un véhicule peut-il changer de conteneur ? | Phase 2 | Oui, avec historique. |
| B5 | USA CARS enchérit-il toujours pour le client ? | Phase 2 | Oui, sur ordre d’achat. |
| C5 | Frais de retard : plafond ? Ajout automatique ou après validation ? | Phase 3 | Pas de plafond ; ajout après validation de la comptabilité. |
| C7 | Numérotation des reçus espèces (`RC-AAAA-####`) et des remboursements (`RB-AAAA-####`) ? | Phase 3 | Oui. |
| C8 | Comptes officiels (banque, Wave, Orange Money), numéro WhatsApp et e-mail officiels. | Phase 3 (données) | Valeurs fictives jusqu’à fourniture. |
| C9 | Mode et délai de **remboursement** du trop-perçu ou du dépôt (même canal que le paiement ? délai ?). | Phase 3 | Même mode que le paiement d’origine, sous 5 jours ouvrés, validé par un administrateur. |
| D4 | Logo, couleurs, identité légale (forme, RCCM, NINEA, adresse). | Phase 3 | Mise en page des modèles actuels, sans logo. |
| D5 | Documents remis au client en PDF seul, ou Word + PDF ? | Phase 3 | PDF au client, Word en interne. |
| E2 | **Fournisseur d’e-mail** (Resend, Brevo, autre) et adresse d’expédition (domaine à vérifier). | Phase 4 | Resend, adresse `no-reply@<domaine>`. |
| E3 | **Fournisseur WhatsApp** : API WhatsApp Business de Meta (en direct) ou intermédiaire (Twilio, 360dialog…) ? Numéro WhatsApp Business dédié ? Vérification de l’entreprise par Meta à lancer. | Phase 4 | API WhatsApp Business via Twilio ; modèles de messages soumis à approbation. |
| E5 | Textes des notifications (lot remporté, devis, échéances, départ, ETA modifiée, arrivée, documents prêts, relances). | Phase 4 | Proposés par Claude Code, validés par USA CARS. |
| F1 | Lien officiel de suivi Grimaldi. | — | Lien tiers TrackingMCP, signalé comme tel. |
| F2 | Demander un accès API Maersk / MSC ? | Phase 5 (API) | Liens seulement ; API reportée. |
| F3 | Fréquence de vérification manuelle du suivi. | — | Alerte après 3 jours sans vérification en transit. |
| F4 | Exemples réels anonymisés de numéros de conteneur et de B/L. | Phase 5 | Contrôle ISO 6346 ; B/L en texte libre. |
| G1 | Formalités CDP (données personnelles). | Production | Avant la mise en production. |
| G2 | Durées de conservation après clôture. | Production | 10 ans (comptable), 5 ans (autres), à confirmer. |
| G3 | Sauvegardes (fréquence, rétention), restauration. | Production | Quotidienne, 7 jours minimum. |
| G4 | Publication au JO du décret sur la limite d’âge (10 / 15 ans). | — | 10 / 15 ans, paramétrables. |
