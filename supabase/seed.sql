-- Seed de DÉMONSTRATION — Supabase LOCAL uniquement (pnpm db:reset).
-- Interdit sur le projet de production (CLAUDE.md §2).
--
-- Toute donnée est fictive et identifiable (CLAUDE.md règle 8) :
--   références de dossiers  DEMO-…
--   conteneurs              DEMU…  (ex. DEMU1234565)
--   e-mails                 …@exemple.test
--
-- Comptes de démonstration (mot de passe local commun : DemoUsaCars2026) :
--   admin@exemple.test       Administrateur (MFA à configurer à la première connexion)
--   ops@exemple.test         Agent opérations
--   compta@exemple.test      Comptabilité (MFA à configurer à la première connexion)
--   direction@exemple.test   Direction
--   client@exemple.test      Client (portail en phase 4)

select set_config('app.actor_label', 'seed:demo', false);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('DemoUsaCars2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', u.full_name), now(), now(),
  '', '', '', ''
from (values
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'admin@exemple.test', 'Awa Admin (démo)'),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'ops@exemple.test', 'Ousmane Opérations (démo)'),
  ('d0000000-0000-4000-8000-000000000003'::uuid, 'compta@exemple.test', 'Coumba Comptabilité (démo)'),
  ('d0000000-0000-4000-8000-000000000004'::uuid, 'direction@exemple.test', 'Daouda Direction (démo)'),
  ('d0000000-0000-4000-8000-000000000005'::uuid, 'client@exemple.test', 'Client Démo')
) as u (id, email, full_name);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@exemple.test';

insert into public.profiles (id, email, full_name, role) values
  ('d0000000-0000-4000-8000-000000000001', 'admin@exemple.test', 'Awa Admin (démo)', 'admin'),
  ('d0000000-0000-4000-8000-000000000002', 'ops@exemple.test', 'Ousmane Opérations (démo)', 'ops'),
  ('d0000000-0000-4000-8000-000000000003', 'compta@exemple.test', 'Coumba Comptabilité (démo)', 'accounting'),
  ('d0000000-0000-4000-8000-000000000004', 'direction@exemple.test', 'Daouda Direction (démo)', 'management'),
  ('d0000000-0000-4000-8000-000000000005', 'client@exemple.test', 'Client Démo', 'client');
