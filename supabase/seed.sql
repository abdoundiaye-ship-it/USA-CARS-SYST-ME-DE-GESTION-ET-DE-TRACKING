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

-- ---------------------------------------------------------------------------
-- Phase 2 — clients et dossiers fictifs (DEMO-, @exemple.test, numéros +22177000000x)
-- ---------------------------------------------------------------------------
insert into public.clients (id, kind, name, id_document_type, id_document_number, address, notify_phone, notify_email, created_by) values
  ('c0000000-0000-4000-8000-000000000001', 'person', 'Mamadou Diallo (démo)', 'national_id', 'DEMO-CNI-0001',
   'Dakar, adresse fictive', '+221770000001', 'client@exemple.test', 'd0000000-0000-4000-8000-000000000002');
insert into public.clients (id, kind, name, ninea, rccm, representative_name, representative_title, address, notify_phone, notify_email, created_by) values
  ('c0000000-0000-4000-8000-000000000002', 'company', 'Société Démo Auto SARL (démo)', 'DEMO-NINEA-0002', 'DEMO-RCCM-0002',
   'Fatou Ndiaye (démo)', 'Gérante', 'Thiès, adresse fictive', '+221770000002', 'societe@exemple.test',
   'd0000000-0000-4000-8000-000000000002');

-- Le compte client@exemple.test accède au portail du premier client (phase 4).
update public.profiles set client_id = 'c0000000-0000-4000-8000-000000000001'
where id = 'd0000000-0000-4000-8000-000000000005';

insert into public.dossiers (
  id, reference, client_id, owner_id, created_by, status, platform, lot_number, vin, make, model, model_year, mileage,
  vehicle_category, title_status, purchase_location, departure_port
) values
  ('e0000000-0000-4000-8000-000000000001', 'DEMO-2026-0001', 'c0000000-0000-4000-8000-000000000001',
   'd0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'new', 'copart', 'DEMO-LOT-1001',
   '1DEMXXX0000000001', 'Toyota', 'Corolla', 2019, 48000, 'passenger', 'Clean title (démo)', 'Houston, TX (démo)',
   'Houston'),
  ('e0000000-0000-4000-8000-000000000002', 'DEMO-2026-0002', 'c0000000-0000-4000-8000-000000000002',
   'd0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'info_missing', 'iaa', null,
   null, 'Ford', 'Transit', 2020, null, 'light_utility', null, null, null);

-- ---------------------------------------------------------------------------
-- Phase 2, lot 2c — transporteurs et conteneurs fictifs (P4 : les vrais transporteurs sont saisis par
-- l'administrateur en production). Numéros DEMU… conformes à ISO 6346 (chiffre de contrôle valide).
-- ---------------------------------------------------------------------------
insert into public.carriers (id, code, name, tracking_url, url_template, link_type, note, created_by) values
  ('f0000000-0000-4000-8000-000000000001', 'demo-maritime', 'Transporteur Démo (fictif)', 'https://exemple.test/suivi',
   'https://exemple.test/suivi/{container}', 'officiel', 'Transporteur fictif du seed local.',
   'd0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000002', 'demo-tiers', 'Suivi tiers Démo (fictif)', 'https://exemple.test/suivi-tiers',
   null, 'tiers', 'Service tiers fictif : référence à saisir sur la page de suivi.',
   'd0000000-0000-4000-8000-000000000001');

insert into public.containers (id, number, carrier_id, bl_number, vessel, voyage, port_of_loading, etd, eta, created_by) values
  ('f1000000-0000-4000-8000-000000000001', 'DEMU1234560', 'f0000000-0000-4000-8000-000000000001', 'DEMO-BL-0001',
   'Navire Démo', 'DEMO-001', 'Houston', '2026-11-02', '2026-11-20', 'd0000000-0000-4000-8000-000000000002'),
  ('f1000000-0000-4000-8000-000000000002', 'DEMU7654322', 'f0000000-0000-4000-8000-000000000002', null,
   null, null, 'Baltimore', null, null, 'd0000000-0000-4000-8000-000000000002');

-- ---------------------------------------------------------------------------
-- Phase 2, lot 2d — de quoi alimenter le tableau de bord (dates relatives au moment du chargement) :
-- un paiement 1 en retard, un dossier sans mise à jour récente, un conteneur en mer jamais vérifié.
-- ---------------------------------------------------------------------------
insert into public.dossiers (
  id, reference, client_id, owner_id, created_by, stage, status, platform, lot_number, vin, make, model, model_year,
  vehicle_category, auction_result, hammer_price_cents, lot_won_notified_at, payment1_due_at, created_at, updated_at
) values (
  'e0000000-0000-4000-8000-000000000003', 'DEMO-2026-0003', 'c0000000-0000-4000-8000-000000000002',
  'd0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'purchase', 'payment1_pending',
  'copart', 'DEMO-LOT-1003', '1DEMXXX0000000003', 'Honda', 'CR-V', 2021, 'passenger', 'won', 950000,
  now() - interval '3 days', now() - interval '2 days', now() - interval '12 days', now() - interval '9 days'
);

update public.containers
  set status = 'at_sea', departed_on = current_date - 10, eta = current_date + 12
  where id = 'f1000000-0000-4000-8000-000000000002';
