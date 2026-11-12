-- Réinitialisation par l'administrateur (décision du 12/11/2026) : mot de passe d'un utilisateur interne actif
-- (ancien mot de passe bloqué + lien pour en choisir un nouveau) et double authentification (option séparée).
-- Cette fonction porte le contrôle d'accès en base, ferme toutes les sessions du compte visé et journalise
-- l'action ; le changement de mot de passe et la suppression des facteurs 2FA se font ensuite côté serveur
-- (API d'administration de Supabase Auth). Migration additive.

create function public.admin_revoke_user_sessions(p_user_id uuid, p_action text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_target public.profiles%rowtype;
  v_count integer;
begin
  if public.current_role_app() is distinct from 'admin' then
    raise exception 'Action réservée à l’administrateur (avec double authentification validée).' using errcode = '42501';
  end if;
  if p_action not in ('password_reset', 'mfa_reset') then
    raise exception 'Action inconnue.' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas réinitialiser votre propre compte depuis cet écran.' using errcode = '22023';
  end if;

  select * into v_target from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Utilisateur introuvable.' using errcode = '22023';
  end if;
  if v_target.role = 'client' then
    raise exception 'Les clients se connectent par lien, sans mot de passe ni double authentification.'
      using errcode = '22023';
  end if;
  if not v_target.active then
    raise exception 'Compte désactivé : réactivez-le avant de le réinitialiser.' using errcode = '22023';
  end if;

  -- Les jetons de rafraîchissement sont supprimés en cascade avec leur session : le compte est déconnecté partout.
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_count = row_count;

  perform public.log_audit(p_action, 'profiles', p_user_id::text, null, jsonb_build_object('sessions_closed', v_count));
  return v_count;
end;
$$;

revoke execute on function public.admin_revoke_user_sessions(uuid, text) from public, anon;
grant execute on function public.admin_revoke_user_sessions(uuid, text) to authenticated;
