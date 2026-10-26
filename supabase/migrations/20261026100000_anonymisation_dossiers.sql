-- Phase 6 — anonymisation des dossiers dont la durée de conservation est atteinte (décisions G2-c et G2-d,
-- contrat art. 33, loi n° 2008-12). Remplace la « purge manuelle hors application » de G2-a.
--
-- Modalités (G2-d, acté le 22/10/2026, précisé le 26/10/2026) :
--   • Anonymisation (pas suppression du dossier) : l'identité du client, les pièces/scans « autres données »,
--     le suivi et les notifications sont effacés à l'échéance « autres données » (data.retention_years, 5 ans) ;
--     les pièces comptables (devis, factures, reçus, paiements, ajustements, remboursements et leurs justificatifs)
--     sont conservées jusqu'à leur propre échéance (data.retention_years_accounting, 10 ans), puis effacées.
--   • Données véhicule/dossier conservées (non nominatives, utiles aux statistiques).
--   • Coûts internes (internal_costs) et factures fournisseurs : TOUJOURS conservés (archives de USA CARS,
--     jamais des données personnelles du client).
--   • Fichiers du Storage réellement supprimés (côté serveur, clé service_role) : la base ne retire que les lignes.
--   • Administrateur uniquement, double validation (approbation par une autre personne que le demandeur).
--   • Uniquement un dossier listé par le rapport « Conservation des données » (report_retention).
--   • Journalisé dans audit_log, par un résumé (jamais de recopie de la donnée personnelle effacée).

-- ---------------------------------------------------------------------------
-- Garde d'anonymisation : autorise ponctuellement la suppression dans les tables « immuables »,
-- uniquement pendant l'exécution d'une anonymisation (app.erasing = 'on', local à la transaction).
-- ---------------------------------------------------------------------------
create function public.forbid_update_delete_unless_erasing() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('app.erasing', true), '') = 'on' then
    return old;                        -- suppression autorisée le temps de l'anonymisation
  end if;
  raise exception 'Table % : modification et suppression interdites (historique conservé).', tg_table_name
    using errcode = '42501';
end;
$$;

revoke execute on function public.forbid_update_delete_unless_erasing() from public, anon, authenticated;

-- Tables immuables dont une anonymisation doit pouvoir supprimer les lignes. L'UPDATE reste interdit
-- (ces triggers étaient « update or delete » ou « delete » ; le garde conserve ce comportement).
drop trigger dossier_events_immutable on public.dossier_events;
create trigger dossier_events_immutable before update or delete on public.dossier_events
  for each row execute function public.forbid_update_delete_unless_erasing();

drop trigger acceptances_immutable on public.acceptances;
create trigger acceptances_immutable before update or delete on public.acceptances
  for each row execute function public.forbid_update_delete_unless_erasing();

drop trigger document_releases_immutable on public.document_releases;
create trigger document_releases_immutable before update or delete on public.document_releases
  for each row execute function public.forbid_update_delete_unless_erasing();

drop trigger financial_documents_no_delete on public.financial_documents;
create trigger financial_documents_no_delete before delete on public.financial_documents
  for each row execute function public.forbid_update_delete_unless_erasing();

drop trigger adjustments_no_delete on public.adjustments;
create trigger adjustments_no_delete before delete on public.adjustments
  for each row execute function public.forbid_update_delete_unless_erasing();

drop trigger refunds_no_delete on public.refunds;
create trigger refunds_no_delete before delete on public.refunds
  for each row execute function public.forbid_update_delete_unless_erasing();

drop trigger unclaimed_letters_no_delete on public.unclaimed_letters;
create trigger unclaimed_letters_no_delete before delete on public.unclaimed_letters
  for each row execute function public.forbid_update_delete_unless_erasing();

drop trigger unclaimed_procedures_no_delete on public.unclaimed_procedures;
create trigger unclaimed_procedures_no_delete before delete on public.unclaimed_procedures
  for each row execute function public.forbid_update_delete_unless_erasing();

-- Pendant une anonymisation, le journal d'audit n'enregistre pas le détail ligne à ligne (il recopierait la
-- donnée personnelle effacée) : un seul résumé est écrit par log_audit à la fin de l'opération.
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_id_cols text[] := string_to_array(coalesce(tg_argv[0], 'id'), ',');
  v_object_id text;
  v_before jsonb;
  v_after jsonb;
  v_key text;
begin
  if coalesce(current_setting('app.erasing', true), '') = 'on' then
    return null;                       -- anonymisation en cours : pas d'audit ligne à ligne (résumé séparé)
  end if;

  select string_agg(v_row ->> c, '|') into v_object_id from unnest(v_id_cols) as c;

  if tg_op = 'UPDATE' then
    v_before := '{}'::jsonb;
    v_after := '{}'::jsonb;
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key <> 'updated_at' and (v_old -> v_key) is distinct from (v_new -> v_key) then
        v_before := v_before || jsonb_build_object(v_key, v_old -> v_key);
        v_after := v_after || jsonb_build_object(v_key, v_new -> v_key);
      end if;
    end loop;
    if v_after = '{}'::jsonb then
      return null;
    end if;
  else
    v_before := v_old;
    v_after := v_new;
  end if;

  insert into public.audit_log (actor_id, actor_role, actor_label, action, object_type, object_id, before, after)
  values (
    auth.uid(),
    public.actor_role(),
    nullif(current_setting('app.actor_label', true), ''),
    lower(tg_op),
    tg_table_name,
    coalesce(v_object_id, '?'),
    v_before,
    v_after
  );
  return null;
end;
$$;

revoke execute on function public.audit_row() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Demandes d'anonymisation : demande → approbation (2e personne) → exécution.
-- ---------------------------------------------------------------------------
create table public.dossier_erasures (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers (id),
  client_id uuid not null references public.clients (id),
  scope text not null check (scope in ('other_data', 'all')),
  reason text not null check (length(trim(reason)) > 2),
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'approved', 'executed', 'cancelled')),
  requested_by uuid not null references public.profiles (id),
  requested_at timestamptz not null default now(),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  executed_by uuid references public.profiles (id),
  executed_at timestamptz,
  client_anonymised boolean,
  summary jsonb,
  cancelled_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  check (status <> 'approved' or (approved_by is not null and approved_by <> requested_by)),
  check (status <> 'executed' or executed_at is not null),
  check (status <> 'cancelled' or cancelled_reason is not null)
);

comment on table public.dossier_erasures is
  'Anonymisations de dossiers (G2-c/G2-d) : demande admin, approbation par une 2e personne, puis exécution.';

-- Une seule anonymisation en cours (à approuver ou approuvée) par dossier.
create unique index dossier_erasures_one_open on public.dossier_erasures (dossier_id)
  where status in ('pending_approval', 'approved');
create index dossier_erasures_dossier_idx on public.dossier_erasures (dossier_id, requested_at desc);

create trigger dossier_erasures_audit after insert or update on public.dossier_erasures
  for each row execute function public.audit_row('id');

-- ---------------------------------------------------------------------------
-- Éligibilité : le dossier doit être listé par le rapport « Conservation des données ».
-- Renvoie la portée atteinte ('other_data' ou 'all'), ou NULL si aucune durée n'est atteinte.
-- ---------------------------------------------------------------------------
create function public.dossier_erasure_scope(p_dossier_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_scope text;
begin
  if public.current_role_app() <> 'admin' then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  select r.scope into v_scope from public.report_retention() r where r.dossier_id = p_dossier_id;
  -- 'accounting' seul (comptable atteint mais pas « autres données ») n'arrive pas avec 10 ans ≥ 5 ans :
  -- on ne retient que les portées effaçables.
  if v_scope not in ('other_data', 'all') then
    return null;
  end if;
  return v_scope;
end;
$$;

-- Demande d'anonymisation (admin). Vérifie l'éligibilité et l'absence d'une demande déjà en cours.
create function public.request_dossier_erasure(p_dossier_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_scope text;
  v_client uuid;
  v_id uuid;
begin
  if public.current_role_app() <> 'admin' then
    raise exception 'Seul un administrateur peut demander une anonymisation.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Indiquez le motif de l’anonymisation.' using errcode = '22023';
  end if;
  v_scope := public.dossier_erasure_scope(p_dossier_id);
  if v_scope is null then
    raise exception 'Ce dossier n’est pas éligible : aucune durée de conservation n’est atteinte.'
      using errcode = '22023';
  end if;
  if exists (select 1 from public.dossier_erasures e
             where e.dossier_id = p_dossier_id and e.status in ('pending_approval', 'approved')) then
    raise exception 'Une demande d’anonymisation est déjà en cours pour ce dossier.' using errcode = '22023';
  end if;
  select d.client_id into v_client from public.dossiers d where d.id = p_dossier_id;

  insert into public.dossier_erasures (dossier_id, client_id, scope, reason, requested_by)
  values (p_dossier_id, v_client, v_scope, trim(p_reason), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Annulation d'une demande non exécutée (admin).
create function public.cancel_dossier_erasure(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.current_role_app() <> 'admin' then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Indiquez le motif de l’annulation.' using errcode = '22023';
  end if;
  update public.dossier_erasures
    set status = 'cancelled', cancelled_reason = trim(p_reason), cancelled_at = now(), cancelled_by = auth.uid()
    where id = p_id and status in ('pending_approval', 'approved');
  if not found then
    raise exception 'Demande introuvable ou déjà traitée.' using errcode = '22023';
  end if;
end;
$$;

-- Approbation par une seconde personne (admin, différente du demandeur) — double validation (G2-d).
create function public.approve_dossier_erasure(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.dossier_erasures%rowtype;
begin
  if public.current_role_app() <> 'admin' then
    raise exception 'Seul un administrateur peut approuver une anonymisation.' using errcode = '42501';
  end if;
  select * into v from public.dossier_erasures e where e.id = p_id for update;
  if not found or v.status <> 'pending_approval' then
    raise exception 'Cette demande n’est pas en attente d’approbation.' using errcode = '22023';
  end if;
  if v.requested_by = auth.uid() then
    raise exception 'Double validation : l’approbation doit venir d’une autre personne que le demandeur.'
      using errcode = '42501';
  end if;
  -- L'éligibilité est revérifiée au moment de l'exécution (la durée reste atteinte).
  update public.dossier_erasures set status = 'approved', approved_by = auth.uid(), approved_at = now()
    where id = p_id;
end;
$$;

-- Chemins Storage des fichiers à supprimer pour une demande approuvée (le serveur les supprime du bucket
-- avant d'appeler execute_dossier_erasure). Même prédicat que la suppression en base.
create function public.dossier_erasure_file_targets(p_id uuid) returns setof text
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.dossier_erasures%rowtype;
begin
  if public.current_role_app() <> 'admin' then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  select * into v from public.dossier_erasures e where e.id = p_id;
  if not found or v.status <> 'approved' then
    raise exception 'Demande introuvable ou non approuvée.' using errcode = '22023';
  end if;
  return query
  select d.storage_path
  from public.documents d
  where d.dossier_id = v.dossier_id
    and not exists (select 1 from public.internal_costs ic where ic.document_id = d.id)
    and (
      v.scope = 'all'
      or (
        d.kind <> 'payment_proof'
        and not exists (select 1 from public.financial_documents f where f.document_id = d.id)
        and not exists (select 1 from public.payments p where p.proof_document_id = d.id)
        and not exists (select 1 from public.adjustments a where a.proof_document_id = d.id)
      )
    );
end;
$$;

-- Exécution de l'anonymisation en base (les fichiers du Storage sont supprimés par le serveur au préalable).
create function public.execute_dossier_erasure(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.dossier_erasures%rowtype;
  v_other int := (public.setting_value('data.retention_years') #>> '{}')::int;
  v_as_of date := (now() at time zone 'Africa/Dakar')::date;
  v_other_kept int;
  v_docs int := 0;
  v_client_anonymised boolean := false;
begin
  if public.current_role_app() <> 'admin' then
    raise exception 'Seul un administrateur peut exécuter une anonymisation.' using errcode = '42501';
  end if;
  select * into v from public.dossier_erasures e where e.id = p_id for update;
  if not found or v.status <> 'approved' then
    raise exception 'Demande introuvable ou non approuvée.' using errcode = '22023';
  end if;

  perform set_config('app.erasing', 'on', true);   -- local à la transaction

  -- « Autres données » (toujours, l'éligibilité l'impose) : pièces non comptables, suivi, notifications,
  -- remise des documents et procédure « non réclamé ». Les référents sont supprimés avant les documents.
  delete from public.document_releases where dossier_id = v.dossier_id;
  delete from public.unclaimed_procedures where dossier_id = v.dossier_id;
  delete from public.unclaimed_letters where dossier_id = v.dossier_id;
  delete from public.acceptances where dossier_id = v.dossier_id;
  delete from public.contracts where dossier_id = v.dossier_id;
  delete from public.dossier_events where dossier_id = v.dossier_id;
  delete from public.notifications where dossier_id = v.dossier_id;

  -- Pièces comptables : seulement si leur propre durée (10 ans) est atteinte.
  if v.scope = 'all' then
    delete from public.refunds where dossier_id = v.dossier_id;
    delete from public.adjustments where dossier_id = v.dossier_id;
    delete from public.payments where dossier_id = v.dossier_id;
    delete from public.financial_documents where dossier_id = v.dossier_id;
  end if;

  -- Documents : à 5 ans, tout sauf les pièces comptables et les coûts internes ; à 10 ans, tout sauf les
  -- coûts internes (archives de USA CARS, jamais des données personnelles du client).
  delete from public.documents d
  where d.dossier_id = v.dossier_id
    and not exists (select 1 from public.internal_costs ic where ic.document_id = d.id)
    and (
      v.scope = 'all'
      or (
        d.kind <> 'payment_proof'
        and not exists (select 1 from public.financial_documents f where f.document_id = d.id)
        and not exists (select 1 from public.payments p where p.proof_document_id = d.id)
        and not exists (select 1 from public.adjustments a where a.proof_document_id = d.id)
      )
    );
  get diagnostics v_docs = row_count;

  -- Identité du client : effacée seulement si aucun autre dossier du client n'est encore en conservation
  -- « autres données » (son identité sert encore à ces dossiers).
  select count(*) into v_other_kept
  from public.dossiers o
  where o.client_id = v.client_id and o.id <> v.dossier_id
    and (o.closed_at is null or v_other is null
         or ((o.closed_at at time zone 'Africa/Dakar')::date + make_interval(years => v_other))::date > v_as_of);

  if v_other_kept = 0 then
    update public.clients set
      name = 'Client anonymisé',
      id_document_type = null, id_document_number = null, ninea = null, rccm = null,
      representative_name = null, representative_title = null, address = null,
      notify_phone = '+10000000000', notify_email = null, notes = null, active = false
    where id = v.client_id;
    v_client_anonymised := true;
  end if;

  update public.dossier_erasures
    set status = 'executed', executed_by = auth.uid(), executed_at = now(),
        client_anonymised = v_client_anonymised,
        summary = jsonb_build_object('scope', v.scope, 'documents_deleted', v_docs,
                                     'client_anonymised', v_client_anonymised)
    where id = p_id;

  -- Un seul résumé au journal (jamais la donnée personnelle effacée).
  perform public.log_audit('anonymise_dossier', 'dossier', v.dossier_id::text, null,
    jsonb_build_object('erasure_id', p_id, 'scope', v.scope, 'documents_deleted', v_docs,
                       'client_anonymised', v_client_anonymised),
    v.reason);
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits : fonctions réservées aux utilisateurs connectés (le contrôle de rôle est dans chaque fonction) ;
-- la table n'est jamais écrite directement.
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'dossier_erasure_scope(uuid)', 'request_dossier_erasure(uuid, text)', 'cancel_dossier_erasure(uuid, text)',
    'approve_dossier_erasure(uuid)', 'dossier_erasure_file_targets(uuid)', 'execute_dossier_erasure(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS : lecture admin et direction ; aucune écriture directe (tout passe par les fonctions).
-- ---------------------------------------------------------------------------
alter table public.dossier_erasures enable row level security;

create policy dossier_erasures_select on public.dossier_erasures for select to authenticated
  using ((select public.current_role_app()) in ('admin', 'management'));

revoke insert, update, delete, truncate on public.dossier_erasures from anon, authenticated;
revoke all on public.dossier_erasures from anon;
