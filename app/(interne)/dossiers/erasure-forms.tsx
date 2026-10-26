"use client";

import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useFormAction } from "@/lib/use-form-action";
import {
  approveDossierErasure,
  cancelDossierErasure,
  executeDossierErasure,
  requestDossierErasure,
} from "./erasure-actions";

/** Demande d'anonymisation d'un dossier éligible (durée de conservation atteinte) — administrateur. */
export function RequestErasureForm({ dossierId }: { dossierId: string }) {
  const { state, pending, formProps } = useFormAction(requestDossierErasure, { resetOnSuccess: true });
  const e = state.fieldErrors ?? {};
  return (
    <form {...formProps} className="flex flex-col gap-3" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="dossierId" value={dossierId} />
      <Field id="erasure-reason" label="Motif de l’anonymisation" error={e.reason}>
        {(aria) => <Textarea {...aria} name="reason" rows={2} defaultValue={state.data?.reason ?? ""} />}
      </Field>
      <div>
        <Button type="submit" variant="secondary" pending={pending}>
          Demander l’anonymisation
        </Button>
      </div>
    </form>
  );
}

/** Approbation par une seconde personne (double validation). */
export function ApproveErasureForm({ erasureId, dossierId }: { erasureId: string; dossierId: string }) {
  const { state, pending, formProps } = useFormAction(approveDossierErasure);
  return (
    <form {...formProps} className="flex flex-col gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="erasureId" value={erasureId} />
      <input type="hidden" name="dossierId" value={dossierId} />
      <div>
        <Button type="submit" variant="secondary" pending={pending}>
          Approuver l’anonymisation
        </Button>
      </div>
    </form>
  );
}

/** Exécution irréversible : une case à cocher confirme avant l'effacement réel. */
export function ExecuteErasureForm({ erasureId, dossierId }: { erasureId: string; dossierId: string }) {
  const { state, pending, formProps } = useFormAction(executeDossierErasure);
  return (
    <form {...formProps} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="erasureId" value={erasureId} />
      <input type="hidden" name="dossierId" value={dossierId} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" required className="mt-0.5" />
        <span>
          Je comprends que l’anonymisation est <strong>irréversible</strong> (fichiers supprimés définitivement).
        </span>
      </label>
      <div>
        <Button type="submit" variant="danger" pending={pending}>
          Exécuter l’anonymisation
        </Button>
      </div>
    </form>
  );
}

/** Annulation d'une demande non exécutée. */
export function CancelErasureForm({ erasureId, dossierId }: { erasureId: string; dossierId: string }) {
  const { state, pending, formProps } = useFormAction(cancelDossierErasure);
  const e = state.fieldErrors ?? {};
  return (
    <form {...formProps} className="flex flex-col gap-2" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="erasureId" value={erasureId} />
      <input type="hidden" name="dossierId" value={dossierId} />
      <Field id={`erasure-cancel-${erasureId}`} label="Motif de l’annulation" error={e.reason}>
        {(aria) => <Input {...aria} name="reason" defaultValue={state.data?.reason ?? ""} />}
      </Field>
      <div>
        <Button type="submit" variant="ghost" pending={pending}>
          Annuler la demande
        </Button>
      </div>
    </form>
  );
}
