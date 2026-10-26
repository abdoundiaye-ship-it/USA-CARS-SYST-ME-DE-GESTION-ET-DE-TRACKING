-- Décision P6-4 : validation des paramètres « à confirmer » avant la mise en production. Administrateur seulement
-- (avec double authentification), un paramètre à la fois, jamais une valeur « À compléter » ; une valeur non définie
-- peut être confirmée. Chaque validation est une version datée, avec auteur, heure et ligne d'audit.
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

-- ============ Accès refusé ============
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$ select public.confirm_setting('dashboard.recent_eta_change_days', 'Valeur vérifiée') $$,
  '42501', null, 'Accès refusé : un agent opérations ne valide pas les paramètres');
reset role;

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok($$ select public.confirm_setting('dashboard.recent_eta_change_days', 'Valeur vérifiée') $$,
  '42501', null, 'Accès refusé : la direction consulte mais ne valide pas');
reset role;

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$ select public.confirm_setting('dashboard.recent_eta_change_days', 'Valeur vérifiée') $$,
  '22023', null, 'Accès refusé : un client ne voit pas les paramètres');
reset role;

-- ============ Administrateur (second compte de démonstration, 2FA validée) ============
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select throws_ok($$ select public.confirm_setting('dashboard.recent_eta_change_days', 'ok') $$,
  '22023', null, 'Motif obligatoire (au moins 3 caractères)');
select throws_ok($$ select public.confirm_setting('company.email', 'Valeur vérifiée') $$,
  '22023', null, 'Une valeur « À compléter » ne peut pas être confirmée');

select lives_ok($$ select public.confirm_setting('dashboard.recent_eta_change_days', 'Valeur vérifiée et validée') $$,
  'Administrateur : valide la valeur en vigueur');
select is((select status from public.settings_current where key = 'dashboard.recent_eta_change_days'),
  'confirme', 'Le paramètre passe au statut « confirmé »');
select is((select value from public.settings_current where key = 'dashboard.recent_eta_change_days'),
  '3'::jsonb, 'La validation ne change pas la valeur');
select is((select created_by::text || '|' || (created_at is not null)::text from public.settings_current
    where key = 'dashboard.recent_eta_change_days'),
  'd0000000-0000-4000-8000-000000000007|true', 'Traçabilité : administrateur et heure de la validation');
select throws_ok($$ select public.confirm_setting('dashboard.recent_eta_change_days', 'Encore une fois') $$,
  '22023', null, 'Un paramètre déjà confirmé ne se valide pas deux fois');
reset role;

select ok(exists (
    select 1 from public.audit_log
    where object_type = 'settings' and object_id = 'dashboard.recent_eta_change_days' and action = 'insert'
      and actor_id = 'd0000000-0000-4000-8000-000000000007'),
  'Audit : la validation est journalisée avec son auteur');

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
-- Valeur non définie : confirmable (choix volontaire, signalé à l'écran).
select lives_ok($$ select public.confirm_setting('quote.margin_percent_default', 'Volontairement non défini') $$,
  'Une valeur non définie peut être confirmée');
select is((select status || '|' || value::text from public.settings_current where key = 'quote.margin_percent_default'),
  'confirme|null', 'Valeur non définie confirmée telle quelle');

-- Le garde-fou s'applique aussi au formulaire de modification (insertion directe d'une version).
select throws_ok(
  $$ insert into public.settings (key, value, value_type, status, reason)
     values ('company.phone', '"À compléter"', 'string', 'confirme', 'Essai') $$,
  '22023', null, 'Garde-fou en base : « À compléter » jamais au statut confirmé');
select lives_ok(
  $$ insert into public.settings (key, value, value_type, status, reason)
     values ('company.phone', '"+221 33 000 00 00"', 'string', 'confirme', 'Coordonnées saisies') $$,
  'Modification avec une valeur réelle puis confirmation : acceptée');
reset role;

select finish();
rollback;
