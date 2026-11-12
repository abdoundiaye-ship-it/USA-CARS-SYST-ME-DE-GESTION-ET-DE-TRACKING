-- Décision du 12/11/2026 : l'administrateur (avec double authentification validée) réinitialise le mot de passe ou la
-- double authentification d'un utilisateur interne actif. La fonction admin_revoke_user_sessions contrôle l'accès,
-- ferme toutes les sessions du compte visé (jetons de rafraîchissement compris) et journalise l'action.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- Sessions fictives : deux pour l'agent opérations (…002), une pour la direction (…004).
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('e1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', now(), now()),
  ('e1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', now(), now()),
  ('e1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000004', now(), now());
insert into auth.refresh_tokens (token, user_id, revoked, session_id, created_at, updated_at) values
  ('jeton-demo-reinit-1', 'd0000000-0000-4000-8000-000000000002', false, 'e1000000-0000-4000-8000-000000000001', now(), now());

-- ============ Accès refusé ============
set local role anon;
select throws_ok($$ select public.admin_revoke_user_sessions('d0000000-0000-4000-8000-000000000002', 'password_reset') $$,
  '42501', null, 'Accès refusé : visiteur non connecté');
reset role;

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$ select public.admin_revoke_user_sessions('d0000000-0000-4000-8000-000000000004', 'password_reset') $$,
  '42501', null, 'Accès refusé : un agent opérations ne réinitialise pas un compte');
reset role;

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok($$ select public.admin_revoke_user_sessions('d0000000-0000-4000-8000-000000000002', 'password_reset') $$,
  '42501', null, 'Accès refusé : la direction consulte les utilisateurs sans les réinitialiser');
reset role;

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$ select public.admin_revoke_user_sessions('d0000000-0000-4000-8000-000000000002', 'password_reset') $$,
  '42501', null, 'Accès refusé : administrateur sans double authentification validée');
reset role;

select is((select count(*)::int from auth.sessions where user_id = 'd0000000-0000-4000-8000-000000000002'),
  2, 'Après les refus, les sessions de l’agent sont intactes');

-- ============ Administrateur (second compte de démonstration, 2FA validée) ============
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select throws_ok($$ select public.admin_revoke_user_sessions('d0000000-0000-4000-8000-000000000007', 'password_reset') $$,
  '22023', null, 'Pas de réinitialisation de son propre compte depuis cet écran');
select throws_ok($$ select public.admin_revoke_user_sessions('d0000000-0000-4000-8000-000000000005', 'password_reset') $$,
  '22023', null, 'Un client (connexion par lien) n’est pas concerné');
select throws_ok($$ select public.admin_revoke_user_sessions('d0000000-0000-4000-8000-000000000002', 'autre') $$,
  '22023', null, 'Action inconnue refusée');
select throws_ok($$ select public.admin_revoke_user_sessions('d0000000-0000-4000-8000-0000000000ff', 'password_reset') $$,
  '22023', null, 'Utilisateur introuvable');

select is(public.admin_revoke_user_sessions('d0000000-0000-4000-8000-000000000002', 'password_reset'),
  2, 'Mot de passe : les deux sessions de l’agent sont fermées');
reset role;

select is((select count(*)::int from auth.sessions where user_id = 'd0000000-0000-4000-8000-000000000002'),
  0, 'Plus aucune session pour l’agent');
select is((select count(*)::int from auth.refresh_tokens where token = 'jeton-demo-reinit-1'),
  0, 'Jetons de rafraîchissement supprimés avec la session');
select is((select count(*)::int from auth.sessions where user_id = 'd0000000-0000-4000-8000-000000000004'),
  1, 'Les sessions des autres comptes sont intactes');
select ok(exists (
    select 1 from public.audit_log
    where action = 'password_reset' and object_type = 'profiles'
      and object_id = 'd0000000-0000-4000-8000-000000000002'
      and actor_id = 'd0000000-0000-4000-8000-000000000007'
      and after = '{"sessions_closed": 2}'::jsonb),
  'Audit : réinitialisation du mot de passe journalisée avec son auteur');

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(public.admin_revoke_user_sessions('d0000000-0000-4000-8000-000000000004', 'mfa_reset'),
  1, 'Double authentification : sessions de la direction fermées');
reset role;
select ok(exists (
    select 1 from public.audit_log
    where action = 'mfa_reset' and object_id = 'd0000000-0000-4000-8000-000000000004'
      and actor_id = 'd0000000-0000-4000-8000-000000000007'),
  'Audit : réinitialisation de la double authentification journalisée');

-- Compte désactivé : à réactiver d'abord.
update public.profiles set active = false where id = 'd0000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok($$ select public.admin_revoke_user_sessions('d0000000-0000-4000-8000-000000000003', 'password_reset') $$,
  '22023', null, 'Compte désactivé : pas de réinitialisation');
reset role;

select finish();
rollback;
