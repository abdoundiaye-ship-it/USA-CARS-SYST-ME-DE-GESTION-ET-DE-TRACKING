# USA CARS — Package de développement pour Claude Code

Version du 17 octobre 2026 — **mise à jour avec les décisions de USA CARS** (comptes GitHub/Supabase, administrateur initial, contrat par véhicule, forfaits saisis manuellement, taux du devis réactualisé au paiement, trop-perçu remboursé, 3 modes de signature, connexion et notifications par e-mail et WhatsApp dès la V1). Basé sur : cahier des charges v1.1, contrat de prestation révisé (40 articles, annexes A à D), devis / facture client révisé (forfaits), prototype interactif.

## Mode d’emploi

1. Confirmer l’interprétation I5 (hébergement) et relire I3 et I4 dans `docs/00_points_de_clarification.md` ; répondre aux questions ouvertes au fil des phases (fournisseurs e-mail et WhatsApp avant la phase 4).
2. Cloner le dépôt https://github.com/abdoundiaye-ship-it/USA-CARS-SYST-ME-DE-GESTION-ET-DE-TRACKING (privé) et y copier le contenu de ce dossier ; ajouter `.env.local` au `.gitignore`.
3. Ouvrir Claude Code dans ce dépôt et coller le message de `KICKOFF_PROMPT.md`.
4. Valider le plan de chaque phase avant que Claude Code ne code ; répondre aux nouvelles questions dans `docs/00_points_de_clarification.md`.

## Contenu

| Chemin                               | Rôle                                                                                                                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                          | Instructions permanentes lues par Claude Code : contexte, stack, règles non négociables, méthode, définition de « terminé »                                                        |
| `KICKOFF_PROMPT.md`                  | Premier message à envoyer à Claude Code                                                                                                                                            |
| `docs/00_points_de_clarification.md` | Questions à trancher avant / pendant le développement, avec hypothèses par défaut                                                                                                  |
| `docs/10_regles_metier.md`           | Règles R1 à R13 : devise et taux, forfaits, numérotation, échéances, frais de retard, paiements, frais supplémentaires, ordre d’achat, remise des documents, non réclamé, tracking |
| `docs/12_roles_permissions.md`       | Matrice des droits par rôle et tests RLS obligatoires                                                                                                                              |
| `docs/13_workflow_statuts.md`        | Étapes, statuts et conditions de passage (avec diagramme)                                                                                                                          |
| `docs/14_ecrans_ux.md`               | Écrans internes et portail client                                                                                                                                                  |
| `docs/15_user_stories.md`            | User stories par phase avec critères d’acceptation                                                                                                                                 |
| `docs/16_documents_generes.md`       | Documents produits (contrat, ordre d’achat, DV, FA, FS, reçus, décharges) et champs                                                                                                |
| `docs/17_plan_phases.md`             | Phases 0 à 6, dépendances et validations                                                                                                                                           |
| `docs/sources/`                      | Les trois documents de référence convertis en Markdown                                                                                                                             |
| `specs/parametres_contractuels.json` | Paramètres initiaux (délais, montants, seuils, transporteurs, numérotation), avec statut confirmé / à confirmer                                                                    |
| `specs/schema_initial.sql`           | Proposition de schéma PostgreSQL/Supabase (27 tables dont remboursements et acceptations, RLS de principe) — chargée sans erreur sur PostgreSQL 16                                 |
| `reference/templates/`               | Les trois documents Word révisés (modèles de génération)                                                                                                                           |
| `reference/prototype/`               | Prototype cliquable (données fictives)                                                                                                                                             |

## Points d’attention

- Les valeurs surlignées dans le contrat sont reprises comme paramètres « à confirmer » : le développement peut avancer, mais elles doivent être validées avant la production.
- Le prototype date d’avant le passage au devis forfaitaire : ses coûts détaillés correspondent aux coûts internes, que le client ne doit jamais voir.
- Le lien de suivi Grimaldi passe par un service tiers (TrackingMCP) ; à remplacer par le lien officiel dès qu’il est connu.
- Les modèles Word du contrat (art. 6 et 8) et du devis doivent être alignés sur les décisions C2/I2 (dépôt = forfait A estimé sur l’enchère maximale, régularisé après l’adjudication) et C4/I1 (taux du devis réactualisé au paiement, sans majoration).

## Développement

Prérequis : Node.js 24 (`.nvmrc`), pnpm 10, **Docker Desktop** (pour Supabase local).

```bash
pnpm install
pnpm db:start        # démarre Supabase LOCAL (Docker)
pnpm db:env          # écrit .env.local avec les clés locales
pnpm db:reset        # applique les migrations + seed fictif (local uniquement)
pnpm dev             # http://localhost:3000
```

| Commande | Rôle |
|---|---|
| `pnpm lint` · `pnpm typecheck` · `pnpm format` | Qualité du code |
| `pnpm test` | Tests unitaires (Vitest) — règles métier dans `lib/` |
| `pnpm test:db` | Tests de base de données (pgTAP, `supabase/tests/`) |
| `pnpm test:e2e` | Parcours (Playwright, desktop et 400 px) |
| `pnpm db:types` | Types TypeScript générés depuis la base locale |

**Production** (`hzgkhtaefpbqztwagwph`) : jamais de `db reset`, de seed ni de tests. Les clés de production se saisissent
uniquement dans l’hébergeur — pas dans `.env.local`. Garde-fous : l’application refuse de démarrer sur l’URL de
production si `NEXT_PUBLIC_APP_ENV` ≠ `production`, et `db:reset`, `test:db`, `test:e2e` refusent de s’exécuter si
une variable ou un fichier `.env*` pointe vers la production.

Structure : `app/` (Next.js App Router), `lib/` (règles pures, montants, clients Supabase), `supabase/` (migrations,
seed fictif, tests pgTAP), `scripts/`, `tests/` (unitaires, e2e), `.github/workflows/ci.yml` (CI).
