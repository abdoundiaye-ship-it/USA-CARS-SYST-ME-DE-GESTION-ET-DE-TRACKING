# Déploiement — Cloudflare Workers (décision I5 du 17/10/2026)

Hébergement de test : **Cloudflare Workers + adaptateur OpenNext**, offre gratuite, adresse `https://usa-cars.<sous-domaine-du-compte>.workers.dev`. Code sur GitHub, base sur Supabase (`hzgkhtaefpbqztwagwph`). Un nom de domaine sera acheté quand l’application sera prête ; il remplacera l’adresse `workers.dev` sans changement de code.

> Aucun déploiement sans accord explicite de USA CARS. Les clés ne sont jamais écrites dans le dépôt ni envoyées par message.

## Points de vigilance

- **Temps de calcul** : l’offre gratuite limite chaque requête à 10 ms de calcul (les attentes réseau vers Supabase ne comptent pas). En cas d’erreurs « CPU limit exceeded », passer à l’offre Workers payante (environ 5 $/mois).
- **Proxy Next.js 16** (`proxy.ts`, exécuté sous Node.js) : signalé « expérimental » par OpenNext sur Cloudflare. Vérifié à chaque build par la CI (job « Build Cloudflare » : redirection vers la connexion dans le moteur `workerd`).
- **E-mails** : une adresse `workers.dev` ne permet pas d’envoyer des e-mails (pas d’accès DNS). Envoi réel (Brevo, décision E2) dès qu’un domaine est acheté.

## Étapes (à faire par USA CARS, guidées par Claude Code)

1. Créer un compte Cloudflare (gratuit) au nom de USA CARS.
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
5. **Variables et secrets d’exécution** (Worker → Paramètres → Variables et secrets) :
   - `SUPABASE_SERVICE_ROLE_KEY` → type **Secret**
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (mêmes valeurs qu’au build)
   - `APP_URL` = adresse `workers.dev` attribuée
   - `ADMIN_EMAIL` = `abdou.ndiaye@icloud.com`
6. Désactiver les déploiements de prévisualisation des branches (ils utiliseraient la base de production — point X12).
7. Supabase → Authentication → URL Configuration : `Site URL` = `APP_URL` ; ajouter `APP_URL/auth/confirm` aux redirections (voir README).
8. Avant la première mise en ligne : migrations poussées en production (`supabase db push`, après sauvegarde et accord), puis `pnpm admin:create --production`.

## Commandes locales

| Commande | Rôle |
|---|---|
| `pnpm cf:build` | Build Cloudflare (sous Windows : activer le « Mode développeur » pour autoriser les liens symboliques, ou utiliser WSL) |
| `pnpm cf:preview` | Build puis exécution locale dans `workerd` |
| `pnpm cf:deploy` | Déploiement manuel (réservé, après accord) |
