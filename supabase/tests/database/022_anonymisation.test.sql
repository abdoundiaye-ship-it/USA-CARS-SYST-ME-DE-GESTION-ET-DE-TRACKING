-- Phase 6, G2-c/G2-d : anonymisation des dossiers dont la durée de conservation est atteinte (contrat art. 33).
-- Administrateur uniquement, double validation ; identité et pièces « autres données » effacées à 5 ans, pièces
-- comptables conservées jusqu'à 10 ans ; coûts internes toujours conservés ; journalisé par un résumé.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

-- ============ Préparation (rôle de test) ============
-- Seconde personne pour la double validation : la direction est promue administrateur le temps du test.
update public.profiles set role = 'admin' where id = 'd0000000-0000-4000-8000-000000000004';

-- Dossiers clôturés il y a 6 ans (durée « autres données » = 5 ans atteinte, comptable = 10 ans non atteinte).
-- Le déclencheur impose closed_at = now() : on le désactive, ainsi que le garde d'étape, le temps de la préparation.
alter table public.dossiers disable trigger dossiers_set_closed_at;
alter table public.dossiers disable trigger dossiers_before_update;
update public.dossiers set stage = 'closing', status = 'completed', closed_at = now() - interval '6 years'
  where reference in ('DEMO-2026-0001', 'DEMO-2026-0005');
-- Client isolé avec un seul dossier clôturé : son identité pourra être anonymisée.
insert into public.clients (id, kind, name, notify_phone, notify_email)
  values ('c0000000-0000-4000-8000-0000000000aa', 'person', 'Anon Test (démo)', '+221770000099', 'anon@exemple.test');
insert into public.dossiers (id, reference, client_id, stage, status, closed_at)
  values ('e0000000-0000-4000-8000-0000000000aa', 'DEMO-TEST-ANON', 'c0000000-0000-4000-8000-0000000000aa',
          'closing', 'completed', now() - interval '6 years');
alter table public.dossiers enable trigger dossiers_before_update;
alter table public.dossiers enable trigger dossiers_set_closed_at;

-- Deux documents sur DEMO-2026-0005 : une photo (autres données) et une preuve de paiement (pièce comptable).
insert into public.documents (dossier_id, kind, storage_path, file_name, mime_type, size_bytes, sha256, visible_client)
values
  ((select id from public.dossiers where reference = 'DEMO-2026-0005'), 'photos',
   'demo/anon-photo.jpg', 'photo.jpg', 'image/jpeg', 1000, repeat('a', 64), true),
  ((select id from public.dossiers where reference = 'DEMO-2026-0005'), 'payment_proof',
   'demo/anon-proof.pdf', 'preuve.pdf', 'application/pdf', 1000, repeat('b', 64), false);

-- ============ Droits : l'anonymisation est réservée à l'administrateur ============
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.dossier_erasure_scope((select id from public.dossiers where reference = 'DEMO-2026-0001')) $$,
  '42501', null, 'Agent : pas d’accès à l’éligibilité d’anonymisation');
select throws_ok(
  $$ select public.request_dossier_erasure((select id from public.dossiers where reference = 'DEMO-2026-0001'), 'test') $$,
  '42501', null, 'Agent : ne peut pas demander une anonymisation');
reset role;

-- ============ Administrateur : éligibilité et demande ============
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(public.dossier_erasure_scope((select id from public.dossiers where reference = 'DEMO-2026-0001')),
  'other_data', 'Dossier clôturé depuis 6 ans : portée « autres données »');
select is(public.dossier_erasure_scope((select id from public.dossiers where reference = 'DEMO-2026-0009')),
  null, 'Dossier non clôturé : non éligible');
select throws_ok(
  $$ select public.request_dossier_erasure((select id from public.dossiers where reference = 'DEMO-2026-0009'), 'test anonymisation') $$,
  '22023', null, 'Demande refusée sur un dossier non éligible');
select lives_ok(
  $$ select public.request_dossier_erasure((select id from public.dossiers where reference = 'DEMO-2026-0001'), 'Durée de conservation atteinte') $$,
  'Administrateur : demande l’anonymisation d’un dossier éligible');
select throws_ok(
  $$ select public.request_dossier_erasure((select id from public.dossiers where reference = 'DEMO-2026-0001'), 'x') $$,
  '22023', null, 'Pas de deuxième demande tant que la première est en cours');
select throws_ok(
  $$ select public.approve_dossier_erasure((select id from public.dossier_erasures
       where dossier_id = (select id from public.dossiers where reference = 'DEMO-2026-0001'))) $$,
  '42501', null, 'Double validation : le demandeur ne peut pas approuver');
reset role;

-- ============ Seconde personne : approbation ============
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.approve_dossier_erasure((select id from public.dossier_erasures
       where dossier_id = (select id from public.dossiers where reference = 'DEMO-2026-0001'))) $$,
  'Seconde personne : approuve l’anonymisation');
reset role;

-- ============ Exécution ============
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.execute_dossier_erasure((select id from public.dossier_erasures
       where dossier_id = (select id from public.dossiers where reference = 'DEMO-2026-0001'))) $$,
  'Administrateur : exécute l’anonymisation');
select is((select count(*) from public.dossier_events
    where dossier_id = (select id from public.dossiers where reference = 'DEMO-2026-0001')),
  0::bigint, 'Suivi du dossier effacé');
select is((select status from public.dossier_erasures
    where dossier_id = (select id from public.dossiers where reference = 'DEMO-2026-0001')),
  'executed', 'Demande marquée « exécutée »');
select is((select name from public.clients where id = 'c0000000-0000-4000-8000-000000000001'),
  'Mamadou Diallo (démo)', 'Identité conservée : le client a d’autres dossiers en conservation');
select ok(exists (select 1 from public.audit_log where action = 'anonymise_dossier'),
  'Anonymisation journalisée (résumé)');
reset role;

-- ============ DEMO-2026-0005 : comptable conservé, non comptable effacé ============
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select public.request_dossier_erasure((select id from public.dossiers where reference = 'DEMO-2026-0005'), 'Conservation atteinte');
reset role;
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select public.approve_dossier_erasure((select id from public.dossier_erasures
  where dossier_id = (select id from public.dossiers where reference = 'DEMO-2026-0005')));
reset role;
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*) from public.dossier_erasure_file_targets((select id from public.dossier_erasures
    where dossier_id = (select id from public.dossiers where reference = 'DEMO-2026-0005')))),
  1::bigint, 'Fichiers à supprimer : seulement la pièce non comptable');
select public.execute_dossier_erasure((select id from public.dossier_erasures
  where dossier_id = (select id from public.dossiers where reference = 'DEMO-2026-0005')));
select is((select count(*) from public.documents
    where dossier_id = (select id from public.dossiers where reference = 'DEMO-2026-0005') and kind = 'photos'),
  0::bigint, 'Pièce non comptable (photo) effacée');
select is((select count(*) from public.documents
    where dossier_id = (select id from public.dossiers where reference = 'DEMO-2026-0005') and kind = 'payment_proof'),
  1::bigint, 'Pièce comptable (preuve de paiement) conservée');
select ok((select count(*) from public.financial_documents
    where dossier_id = (select id from public.dossiers where reference = 'DEMO-2026-0005')) > 0,
  'Documents comptables conservés à 5 ans');
reset role;

-- ============ Client isolé : identité effacée (dossier unique) ============
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select public.request_dossier_erasure('e0000000-0000-4000-8000-0000000000aa', 'Conservation atteinte');
reset role;
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select public.approve_dossier_erasure((select id from public.dossier_erasures
  where dossier_id = 'e0000000-0000-4000-8000-0000000000aa'));
reset role;
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select public.execute_dossier_erasure((select id from public.dossier_erasures
  where dossier_id = 'e0000000-0000-4000-8000-0000000000aa'));
select is((select name || '|' || notify_phone || '|' || active::text from public.clients
    where id = 'c0000000-0000-4000-8000-0000000000aa'),
  'Client anonymisé|+10000000000|false', 'Identité du client effacée (dossier unique)');
reset role;

-- ============ Isolation : un client ne lit aucune demande ============
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*) from public.dossier_erasures), 0::bigint, 'Un client ne voit aucune demande d’anonymisation');
reset role;

select finish();
rollback;
