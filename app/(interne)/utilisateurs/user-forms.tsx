"use client";

import { useActionState, useState } from "react";
import { AccessLink } from "@/components/access-link";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { INTERNAL_ROLES, ROLE_LABELS, type InternalRole } from "@/lib/auth/roles";
import { initialFormState } from "@/lib/forms";
import {
  changeRole,
  generateAccessLink,
  inviteUser,
  resendInvite,
  resetUserMfa,
  resetUserPassword,
  setUserActive,
} from "./actions";

export function InviteUserForm() {
  const [state, action, pending] = useActionState(inviteUser, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="fullName" label="Nom complet" error={state.fieldErrors?.fullName}>
          {(aria) => <Input {...aria} name="fullName" autoComplete="off" required />}
        </Field>
        <Field id="invite-email" label="Adresse e-mail" error={state.fieldErrors?.email}>
          {(aria) => <Input {...aria} name="email" type="email" autoComplete="off" required />}
        </Field>
        <Field id="invite-role" label="Rôle" error={state.fieldErrors?.role}>
          {(aria) => (
            <Select {...aria} name="role" defaultValue="ops" required>
              {INTERNAL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Mode d’envoi</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="delivery" value="lien" defaultChecked className="mt-1" />
          <span>
            Lien à copier et à envoyer moi-même (WhatsApp…) — recommandé tant que l’envoi d’e-mails n’est pas configuré
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="delivery" value="email" className="mt-1" />
          <span>Invitation par e-mail</span>
        </label>
      </fieldset>
      <div>
        <Button type="submit" pending={pending}>
          {pending ? "Création…" : "Créer le compte"}
        </Button>
      </div>
      {state.status === "success" && state.data?.lien && <AccessLink key={state.data.lien} link={state.data.lien} />}
    </form>
  );
}

export function RoleForm({ userId, role, name }: { userId: string; role: InternalRole; name: string }) {
  const [state, action, pending] = useActionState(changeRole, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`role-${userId}`} className="sr-only">
          Rôle de {name}
        </label>
        <Select id={`role-${userId}`} name="role" defaultValue={role} className="w-auto min-w-40">
          {INTERNAL_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" pending={pending}>
          Enregistrer le rôle
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

/**
 * Désactivation / réactivation avec confirmation dans la page (pas de confirm() navigateur).
 * Le parent change la `key` quand l’état du compte change, ce qui referme la confirmation.
 */
export function ActiveToggle({ userId, active, name }: { userId: string; active: boolean; name: string }) {
  const [state, action, pending] = useActionState(setUserActive, initialFormState);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        <Button type="button" variant={active ? "secondary" : "primary"} onClick={() => setConfirming(true)}>
          {active ? "Désactiver le compte" : "Réactiver le compte"}
        </Button>
        <FormMessage state={state} />
      </div>
    );
  }

  return (
    <form action={action} className="border-border flex flex-col gap-2 rounded-md border p-3">
      <FormMessage state={state} />
      <p className="text-sm">
        {active
          ? `Désactiver le compte de ${name} ? Il perdra immédiatement tout accès.`
          : `Réactiver le compte de ${name} ?`}
      </p>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={active ? "danger" : "primary"} pending={pending}>
          {active ? "Confirmer la désactivation" : "Confirmer la réactivation"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

export function ResendInviteForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(resendInvite, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Button
        type="submit"
        variant="ghost"
        pending={pending}
        className="text-primary px-0 underline underline-offset-2"
      >
        Renvoyer l’invitation par e-mail
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

export function AccessLinkForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(generateAccessLink, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Button
        type="submit"
        variant="ghost"
        pending={pending}
        className="text-primary px-0 underline underline-offset-2"
      >
        Obtenir un lien d’accès
      </Button>
      <FormMessage state={state} />
      {state.status === "success" && state.data?.lien && <AccessLink key={state.data.lien} link={state.data.lien} />}
    </form>
  );
}

/** Case de confirmation obligatoire des réinitialisations (avec son message d’erreur). */
function ConfirmationBox({ id, error, children }: { id: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-start gap-2 text-sm">
        <input
          id={id}
          type="checkbox"
          name="confirmation"
          className="mt-1"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-erreur` : undefined}
        />
        <span>{children}</span>
      </label>
      {error && (
        <p id={`${id}-erreur`} className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Réinitialisation du mot de passe par l’administrateur : l’ancien mot de passe est bloqué et les sessions fermées,
 * puis la personne choisit le nouveau depuis un lien (e-mail, ou lien à copier et à lui transmettre).
 */
export function ResetPasswordForm({ userId, name }: { userId: string; name: string }) {
  const [state, action, pending] = useActionState(resetUserPassword, initialFormState);
  const [open, setOpen] = useState(false);
  // Résultat déjà refermé : une nouvelle ouverture repart du formulaire (le lien n’est affiché qu’une fois).
  const [dismissed, setDismissed] = useState<typeof state | null>(null);

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="text-primary px-0 underline underline-offset-2"
      >
        Réinitialiser le mot de passe
      </Button>
    );
  }

  if (state.status === "success" && state !== dismissed) {
    return (
      <div className="border-border flex flex-col gap-2 rounded-md border p-3">
        <FormMessage state={state} />
        {state.data?.lien && <AccessLink key={state.data.lien} link={state.data.lien} />}
        <div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDismissed(state);
              setOpen(false);
            }}
          >
            Fermer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="border-border flex flex-col gap-3 rounded-md border p-3" noValidate>
      {state !== dismissed && <FormMessage state={state} />}
      <p className="text-sm font-medium">Réinitialiser le mot de passe de {name}</p>
      <input type="hidden" name="userId" value={userId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm">Lien pour choisir le nouveau mot de passe</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="delivery" value="lien" defaultChecked className="mt-1" />
          <span>Lien à copier et à transmettre moi-même (WhatsApp, en main propre)</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="delivery" value="email" className="mt-1" />
          <span>Envoi par e-mail</span>
        </label>
      </fieldset>
      <ConfirmationBox id={`reset-password-${userId}`} error={state.fieldErrors?.confirmation}>
        Je confirme : l’ancien mot de passe cessera immédiatement de fonctionner et les sessions ouvertes de {name}{" "}
        seront fermées.
      </ConfirmationBox>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" pending={pending}>
          Confirmer la réinitialisation
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

/**
 * Réinitialisation de la double authentification (téléphone perdu ou changé) ; le mot de passe ne change pas.
 * Toujours rendu (bouton seulement si `hasMfa`) : le message de réussite reste visible après le rafraîchissement.
 */
export function ResetMfaForm({ userId, name, hasMfa }: { userId: string; name: string; hasMfa: boolean }) {
  const [state, action, pending] = useActionState(resetUserMfa, initialFormState);
  const [open, setOpen] = useState(false);

  if (!open || state.status === "success") {
    return (
      <div className="flex flex-col gap-2 empty:hidden">
        {hasMfa && state.status !== "success" && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(true)}
            className="text-primary px-0 underline underline-offset-2"
          >
            Réinitialiser la double authentification
          </Button>
        )}
        <FormMessage state={state} />
      </div>
    );
  }

  return (
    <form action={action} className="border-border flex flex-col gap-3 rounded-md border p-3" noValidate>
      <FormMessage state={state} />
      <p className="text-sm font-medium">Réinitialiser la double authentification de {name}</p>
      <input type="hidden" name="userId" value={userId} />
      <ConfirmationBox id={`reset-mfa-${userId}`} error={state.fieldErrors?.confirmation}>
        Je confirme : la double authentification de {name} sera effacée et ses sessions ouvertes fermées. Elle sera
        reconfigurée à la prochaine connexion (le mot de passe ne change pas).
      </ConfirmationBox>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" pending={pending}>
          Confirmer la réinitialisation
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
