"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ACCEPTANCE_METHOD_LABELS, PLATFORM_LABELS, VEHICLE_CATEGORY_LABELS } from "@/lib/dossiers/labels";
import { initialFormState, type FormState } from "@/lib/forms";
import type { DossierRow } from "@/lib/supabase/database.types";
import {
  createDossier,
  duplicateDossier,
  recordContractAcceptance,
  regenerateContract,
  updateVehicle,
} from "./actions";

type Values = (name: string, saved: string | number | null | undefined) => string;

const valuesOf =
  (state: FormState): Values =>
  (name, saved) =>
    state.data?.[name] ?? (saved === null || saved === undefined ? "" : String(saved));

/** Champs du véhicule (création et modification du dossier). */
function VehicleFields({ state, dossier }: { state: FormState; dossier?: DossierRow }) {
  const v = valuesOf(state);
  const e = state.fieldErrors ?? {};
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field id="platform" label="Plateforme" error={e.platform}>
        {(aria) => (
          <Select {...aria} name="platform" defaultValue={v("platform", dossier?.platform)}>
            <option value="">— À préciser —</option>
            {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field id="lotNumber" label="N° de lot" error={e.lotNumber}>
        {(aria) => (
          <Input {...aria} name="lotNumber" defaultValue={v("lotNumber", dossier?.lot_number)} autoComplete="off" />
        )}
      </Field>
      <Field id="vin" label="VIN / châssis" hint="17 caractères" error={e.vin}>
        {(aria) => (
          <Input
            {...aria}
            name="vin"
            defaultValue={v("vin", dossier?.vin)}
            autoComplete="off"
            autoCapitalize="characters"
            className="font-mono uppercase"
          />
        )}
      </Field>
      <Field id="make" label="Marque" error={e.make}>
        {(aria) => <Input {...aria} name="make" defaultValue={v("make", dossier?.make)} autoComplete="off" />}
      </Field>
      <Field id="model" label="Modèle" error={e.model}>
        {(aria) => <Input {...aria} name="model" defaultValue={v("model", dossier?.model)} autoComplete="off" />}
      </Field>
      <Field id="modelYear" label="Année" error={e.modelYear}>
        {(aria) => (
          <Input {...aria} name="modelYear" inputMode="numeric" defaultValue={v("modelYear", dossier?.model_year)} />
        )}
      </Field>
      <Field id="mileage" label="Kilométrage (miles, compteur US)" error={e.mileage}>
        {(aria) => <Input {...aria} name="mileage" inputMode="numeric" defaultValue={v("mileage", dossier?.mileage)} />}
      </Field>
      <Field
        id="vehicleCategory"
        label="Catégorie"
        hint="Sert au contrôle de l’âge à l’importation"
        error={e.vehicleCategory}
      >
        {(aria) => (
          <Select {...aria} name="vehicleCategory" defaultValue={v("vehicleCategory", dossier?.vehicle_category)}>
            <option value="">— À préciser —</option>
            {Object.entries(VEHICLE_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field id="titleStatus" label="Statut du titre" error={e.titleStatus}>
        {(aria) => <Input {...aria} name="titleStatus" defaultValue={v("titleStatus", dossier?.title_status)} />}
      </Field>
      <Field id="color" label="Couleur" error={e.color}>
        {(aria) => <Input {...aria} name="color" defaultValue={v("color", dossier?.color)} />}
      </Field>
      <Field id="purchaseLocation" label="Lieu d’achat" error={e.purchaseLocation}>
        {(aria) => (
          <Input {...aria} name="purchaseLocation" defaultValue={v("purchaseLocation", dossier?.purchase_location)} />
        )}
      </Field>
      <Field id="departurePort" label="Port de départ prévu" error={e.departurePort}>
        {(aria) => <Input {...aria} name="departurePort" defaultValue={v("departurePort", dossier?.departure_port)} />}
      </Field>
      <div className="sm:col-span-2 lg:col-span-3">
        <Field id="notes" label="Notes internes (facultatif)" error={e.notes}>
          {(aria) => <Textarea {...aria} name="notes" defaultValue={v("notes", dossier?.notes)} />}
        </Field>
      </div>
    </div>
  );
}

export interface ClientOption {
  id: string;
  name: string;
  notify_phone: string;
}

/** Ouverture d'un dossier : client + véhicule (tout est complétable plus tard, sauf le client). */
export function NewDossierForm({ clients, clientId }: { clients: ClientOption[]; clientId?: string }) {
  const [state, action, pending] = useActionState(createDossier, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <FormMessage state={state} />
      <Field id="clientId" label="Client" error={state.fieldErrors?.clientId}>
        {(aria) => (
          <Select {...aria} name="clientId" defaultValue={state.data?.clientId ?? clientId ?? ""} required>
            <option value="">— Choisir un client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.notify_phone}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold">Véhicule</legend>
        <p className="text-muted text-sm">
          Informations connues à ce stade ; elles pourront être complétées avant la signature.
        </p>
        <VehicleFields state={state} />
      </fieldset>
      <div>
        <Button type="submit" pending={pending}>
          Ouvrir le dossier et générer le contrat
        </Button>
      </div>
    </form>
  );
}

export function VehicleForm({ dossier }: { dossier: DossierRow }) {
  const [state, action, pending] = useActionState(updateVehicle, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="dossierId" value={dossier.id} />
      <VehicleFields state={state} dossier={dossier} />
      <div>
        <Button type="submit" variant="secondary" pending={pending}>
          Enregistrer le véhicule
        </Button>
      </div>
    </form>
  );
}

export function RegenerateContractForm({ dossierId, label }: { dossierId: string; label: string }) {
  const [state, action, pending] = useActionState(regenerateContract, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="dossierId" value={dossierId} />
      <div>
        <Button type="submit" variant="secondary" pending={pending}>
          {label}
        </Button>
      </div>
    </form>
  );
}

/** R15 : décision du client sur le contrat, avec preuve (scan signé ou capture WhatsApp). */
export function AcceptanceForm({
  dossierId,
  contractId,
  today,
}: {
  dossierId: string;
  contractId: string;
  today: string;
}) {
  const [state, action, pending] = useActionState(recordContractAcceptance, initialFormState);
  const [method, setMethod] = useState(state.data?.method ?? "scanned_paper");
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="dossierId" value={dossierId} />
      <input type="hidden" name="contractId" value={contractId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Méthode</legend>
        {(["scanned_paper", "whatsapp"] as const).map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="method"
              value={value}
              checked={method === value}
              onChange={() => setMethod(value)}
            />
            {ACCEPTANCE_METHOD_LABELS[value]}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Décision du client</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="decision" value="accepted" defaultChecked={state.data?.decision !== "refused"} />
            Accepte le contrat
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="decision" value="refused" defaultChecked={state.data?.decision === "refused"} />
            Refuse le contrat
          </label>
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="decidedOn"
          label={method === "whatsapp" ? "Date du message" : "Date de signature"}
          error={e.decidedOn}
        >
          {(aria) => (
            <Input
              {...aria}
              name="decidedOn"
              type="date"
              max={today}
              defaultValue={state.data?.decidedOn ?? today}
              required
            />
          )}
        </Field>
        {method === "whatsapp" && (
          <Field id="whatsappFrom" label="Numéro émetteur du message" error={e.whatsappFrom}>
            {(aria) => (
              <Input
                {...aria}
                name="whatsappFrom"
                type="tel"
                inputMode="tel"
                defaultValue={state.data?.whatsappFrom ?? ""}
              />
            )}
          </Field>
        )}
        <Field
          id="proof"
          label={method === "whatsapp" ? "Capture ou export du message" : "Contrat signé scanné"}
          hint="PDF, JPEG, PNG, WebP ou HEIC — 20 Mo au plus"
          error={e.proof}
        >
          {(aria) => (
            <Input
              {...aria}
              name="proof"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
              required
            />
          )}
        </Field>
      </div>
      <Field id="acceptance-notes" label="Remarque (facultatif)" error={e.notes}>
        {(aria) => <Textarea {...aria} name="notes" defaultValue={state.data?.notes ?? ""} />}
      </Field>
      <div>
        <Button type="submit" pending={pending}>
          Enregistrer la décision du client
        </Button>
      </div>
    </form>
  );
}

export function DuplicateDossierForm({ dossierId }: { dossierId: string }) {
  const [state, action, pending] = useActionState(duplicateDossier, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="dossierId" value={dossierId} />
      <div>
        <Button type="submit" variant="secondary" pending={pending}>
          Dupliquer le dossier
        </Button>
      </div>
    </form>
  );
}
