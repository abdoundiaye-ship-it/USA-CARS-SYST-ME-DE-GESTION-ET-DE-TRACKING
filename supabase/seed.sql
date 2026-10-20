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
--   direction@exemple.test   Direction (MFA déjà configurée : secret de démonstration ci-dessous, décision A4-bis)
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

-- ---------------------------------------------------------------------------
-- Phase 3, lot 3a — taux, comptes officiels FICTIFS (décision C8), forfaits et coûts internes de démonstration.
-- Comptes activés selon la double validation (Q1) : créés par l'administrateur, approuvés par la direction.
-- ---------------------------------------------------------------------------
insert into public.fx_rates (rate, source, captured_at, created_by) values
  (586.52, 'XE.com — taux moyen du marché (valeur de démonstration)', now() - interval '1 day', 'd0000000-0000-4000-8000-000000000003'),
  (587.10, 'XE.com — taux moyen du marché (valeur de démonstration)', now() - interval '5 minutes', 'd0000000-0000-4000-8000-000000000003');

insert into public.official_accounts (id, kind, label, holder_name, bank_name, account_number, iban, phone, instructions,
                                      status, created_by, approved_by, approved_at) values
  ('a0000000-0000-4000-8000-000000000001', 'bank', 'Compte bancaire Démo (fictif)', 'USA CARS (démo)', 'Banque Démo',
   'DEMO-0000-0001', 'SN00 DEMO 0000 0000 0000 0001', null, 'Indiquez la référence du dossier en libellé.', 'active',
   'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004', now()),
  ('a0000000-0000-4000-8000-000000000002', 'wave', 'Wave Démo (fictif)', 'USA CARS (démo)', null, null, null,
   '+221770000900', 'Envoyez une capture du transfert au WhatsApp officiel.', 'active',
   'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004', now());

insert into public.dossier_forfaits (dossier_id, forfait_a_cents, forfait_b_cents, insurance_cents, updated_by) values
  ('e0000000-0000-4000-8000-000000000003', 1150000, 320000, 25000, 'd0000000-0000-4000-8000-000000000002');

insert into public.internal_costs (dossier_id, section, category, label, amount_cents, status, created_by) values
  ('e0000000-0000-4000-8000-000000000003', 'A', 'hammer_price', 'Prix d’adjudication', 950000, 'final', 'd0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000003', 'A', 'auction_fees', 'Frais COPART', 95000, 'final', 'd0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000003', 'B', 'inland_transport', 'Transport vers Houston', 45000, 'estimated', 'd0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000003', 'B', 'ocean_freight', 'Fret maritime (quote-part)', 180000, 'estimated', 'd0000000-0000-4000-8000-000000000002');

-- ---------------------------------------------------------------------------
-- Phase 3, lot 3b — dossier au lot remporté, prêt pour le devis (paiement 1 dû dans 22 h), avec un dépôt reçu.
-- Ordre d'achat sans fichier (brouillon du seed) ; coûts internes aux montants distinctifs, pour vérifier qu'ils
-- n'apparaissent jamais dans le devis ni la facture générés (CLAUDE.md règle 2).
-- ---------------------------------------------------------------------------
insert into public.dossiers (
  id, reference, client_id, owner_id, created_by, stage, status, platform, lot_number, vin, make, model, model_year,
  vehicle_category, purchase_location, departure_port, auction_result, hammer_price_cents, lot_won_notified_at,
  payment1_due_at
) values (
  'e0000000-0000-4000-8000-000000000004', 'DEMO-2026-0004', 'c0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'purchase', 'won', 'iaa',
  'DEMO-LOT-1004', '1DEMXXX0000000004', 'Toyota', 'RAV4', 2020, 'passenger', 'Dallas, TX (démo)', 'Houston', 'won',
  943700, now() - interval '2 hours', now() + interval '22 hours'
);

insert into public.purchase_orders (dossier_id, auction_at, max_bid_cents, deposit_cents, created_by) values
  ('e0000000-0000-4000-8000-000000000004', now() - interval '3 hours', 1000000, 250000, 'd0000000-0000-4000-8000-000000000002');

insert into public.dossier_forfaits (dossier_id, forfait_a_cents, forfait_b_cents, insurance_cents, updated_by) values
  ('e0000000-0000-4000-8000-000000000004', 1180000, 330000, 26000, 'd0000000-0000-4000-8000-000000000002');

insert into public.internal_costs (dossier_id, section, category, label, amount_cents, status, created_by) values
  ('e0000000-0000-4000-8000-000000000004', 'A', 'hammer_price', 'Prix d’adjudication IAA (démo)', 943700, 'final', 'd0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000004', 'A', 'auction_fees', 'Frais IAA (démo)', 87300, 'final', 'd0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000004', 'B', 'ocean_freight', 'Fret maritime (démo)', 178100, 'estimated', 'd0000000-0000-4000-8000-000000000002');

insert into public.payments (dossier_id, client_id, purpose, amount_cents, paid_currency, fx_rate_id, fx_rate, fx_captured_at,
                             fx_rate_same_day, mode, official_account_id, reference, credited_at, recorded_by)
select 'e0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'deposit', 250000, 'USD',
       r.id, r.rate, r.captured_at, true, 'bank_transfer', 'a0000000-0000-4000-8000-000000000001', 'DEMO-VIR-0001',
       r.captured_at + interval '1 minute', 'd0000000-0000-4000-8000-000000000003'
from public.fx_rates r where r.rate = 586.52;

-- ---------------------------------------------------------------------------
-- Décisions A4 et A4-bis : la comptabilité et la direction sont soumises à la double authentification. Pour les
-- essais LOCAUX et les tests, leurs comptes de démonstration ont déjà un facteur TOTP vérifié, de secret connu (à
-- saisir dans une application d'authentification) : JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP. L'administrateur, lui,
-- configure sa double authentification à la première connexion (parcours testé).
-- ---------------------------------------------------------------------------
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values ('d1000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000004', 'Démonstration', 'totp',
        'verified', now(), now(), 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'),
       ('d1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003', 'Démonstration', 'totp',
        'verified', now(), now(), 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
