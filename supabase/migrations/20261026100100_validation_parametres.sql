-- Validation des paramètres « à confirmer » avant la mise en production (décision P6-4 du 26/10/2026).
-- Une validation est une nouvelle version datée du paramètre : même valeur, statut « confirmé », auteur (created_by)
-- et heure d'enregistrement (created_at). L'historique et l'audit existants s'appliquent (CLAUDE.md règles 4 et 5) ;
-- les dossiers déjà ouverts gardent les valeurs en vigueur à leur ouverture (décision X7).
-- Validation un paramètre à la fois ; une valeur « non définie » peut être confirmée (choix volontaire) ; une valeur
-- de remplissage « À compléter » ne l'est jamais.

-- ---------------------------------------------------------------------------
-- Garde-fou : jamais de statut « confirmé » sur une valeur de remplissage (ex. coordonnées company.*).
-- ---------------------------------------------------------------------------
create function public.settings_check_confirmation() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'confirme'
     and jsonb_typeof(new.value) = 'string'
     and trim(new.value #>> '{}') in ('À compléter', 'à compléter') then
    raise exception 'La valeur « À compléter » ne peut pas être confirmée : saisissez d’abord la valeur réelle.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function public.settings_check_confirmation() from public, anon, authenticated;

create trigger settings_check_confirmation
  before insert on public.settings
  for each row execute function public.settings_check_confirmation();

-- ---------------------------------------------------------------------------
-- Valider la valeur en vigueur d'un paramètre « à confirmer ». Exécutée avec les droits de l'utilisateur :
-- la RLS réserve l'écriture à l'administrateur (avec double authentification validée).
-- ---------------------------------------------------------------------------
create function public.confirm_setting(p_key text, p_reason text) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v public.settings_current%rowtype;
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Indiquez le motif de la validation (il sera conservé dans l’historique).' using errcode = '22023';
  end if;
  select * into v from public.settings_current s where s.key = p_key;
  if not found then
    raise exception 'Paramètre inconnu.' using errcode = '22023';
  end if;
  if v.status = 'confirme' then
    raise exception 'Ce paramètre est déjà confirmé.' using errcode = '22023';
  end if;
  insert into public.settings (key, value, value_type, status, source, reason, effective_from)
  values (v.key, v.value, v.value_type, 'confirme', 'Écran Paramètres — validation', trim(p_reason), now());
end;
$$;

revoke execute on function public.confirm_setting(text, text) from public, anon;
grant execute on function public.confirm_setting(text, text) to authenticated;
