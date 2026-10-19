# Déploiement — Cloudflare Workers (décision I5 du 17/10/2026)

Hébergement de test : **Cloudflare Workers + adaptateur OpenNext**, offre gratuite, adresse `https://usa-cars.usacarsusasen.workers.dev` (sous-domaine du compte : `usacarsusasen`, créé le 18/10/2026). Code sur GitHub, base sur Supabase (`hzgkhtaefpbqztwagwph`). Un nom de domaine sera acheté quand l’application sera prête ; il remplacera l’adresse `workers.dev` sans changement de code.

> Aucun déploiement sans accord explicite de USA CARS. Les clés ne sont jamais écrites dans le dépôt ni envoyées par message.

## Points de vigilance

- **Temps de calcul** : l’offre gratuite limite chaque requête à 10 ms de calcul (les attentes réseau vers Supabase ne comptent pas). En cas d’erreurs « CPU limit exceeded », passer à l’offre Workers payante (environ 5 $/mois).
- **Génération des documents Word** (≈ 85 ms de calcul par document (contrat, ordre d’achat), au-delà de la limite gratuite) : faite par la **fonction Supabase `generate-document`** (`supabase/functions/`, 2 s de calcul par appel sur l’offre gratuite de Supabase), appelée par l’application avec le jeton de l’utilisateur (RLS appliquée, jamais la clé `service_role`). Décision de USA CARS du 19/10/2026 : rester sur des offres gratuites pour l’instant.
- **Proxy Next.js 16** (`proxy.ts`, exécuté sous Node.js) : signalé « expérimental » par OpenNext sur Cloudflare. Vérifié à chaque build par la CI (job « Build Cloudflare » : redirection vers la connexion dans le moteur `workerd`).
- **E-mails** : une adresse `workers.dev` ne permet pas d’envoyer des e-mails (pas d’accès DNS). Envoi réel (Brevo, décision E2) dès qu’un domaine est acheté.

## Étapes (à faire par USA CARS, guidées par Claude Code)

1. ✅ Compte Cloudflare créé (18/10/2026), sous-domaine `usacarsusasen.workers.dev`.
2. Workers & Pages → Créer → Importer un dépôt Git → autoriser GitHub → choisir `USA-CARS-SYST-ME-DE-GESTION-ET-DE-TRACKING`.
3. Paramètres du build :
   - Nom du Worker : `usa-cars` (identique à `wrangler.jsonc`)
   - Commande de build : `pnpm cf:build`
   - Commande de déploiement : `pnpm exec opennextjs-cloudflare deploy`
   - Branche de production : `main`
4. **Variables de build** (Next.js les fige au moment du build) :
   - `NEXT_PUBLIC_APP_ENV` = `production`
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://hzgkhtaefpbqztwagwph.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = clé `anon` du projet (publique, soumise à la RLS)
5. **Secrets d’exécution** (Worker → Paramètres → Variables et secrets), tous deux en type **Secret** :
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (même valeur qu’au build)

   Les variables non secrètes (`NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_SUPABASE_URL`, `APP_URL`, `ADMIN_EMAIL`,
   `NOTIFICATIONS_MODE`) sont dans `wrangler.jsonc` : chaque déploiement **remplace** les variables de type
   « texte » saisies dans le tableau de bord par celles du fichier (constaté le 18/10/2026 : erreur 500 sur
   `/auth/confirm`). Seuls les secrets sont conservés d’un déploiement à l’autre.
6. Désactiver les déploiements de prévisualisation des branches (ils utiliseraient la base de production — point X12).
7. Supabase → Authentication → URL Configuration : `Site URL` = `APP_URL` ; ajouter `APP_URL/auth/confirm` aux redirections (voir README).
8. Avant la première mise en ligne : migrations poussées en production (`supabase db push`, après sauvegarde et accord), puis `pnpm admin:create --production --lien` (✅ fait le 19/10/2026 : première connexion de l’administrateur réussie).
9. **Fonctions Supabase** (à chaque modification de `supabase/functions/`, après accord de USA CARS) : `npx supabase functions deploy generate-document --project-ref hzgkhtaefpbqztwagwph`, lancé par USA CARS depuis son terminal. Sans cette étape, l’ouverture d’un dossier en production ne génère pas le contrat (le dossier reste ouvert ; bouton « Générer le contrat » sur sa fiche).

## Commandes locales

| Commande | Rôle |
|---|---|
| `pnpm cf:build` | Build Cloudflare (sous Windows : activer le « Mode développeur » pour autoriser les liens symboliques, ou utiliser WSL) |
| `pnpm cf:preview` | Build puis exécution locale dans `workerd` |
| `pnpm cf:deploy` | Déploiement manuel (réservé, après accord) |
