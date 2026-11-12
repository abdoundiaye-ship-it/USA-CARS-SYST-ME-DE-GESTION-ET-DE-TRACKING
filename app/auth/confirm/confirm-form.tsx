"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { confirmLink } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" pending={pending}>
      {label}
    </Button>
  );
}

/** Le jeton n'est consommé qu'au clic : un aperçu automatique du lien (WhatsApp, messagerie) ne l'utilise pas. */
export function ConfirmLinkForm({ fields, label }: { fields: Record<string, string>; label: string }) {
  return (
    <form action={confirmLink} className="flex flex-col gap-4">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div>
        <SubmitButton label={label} />
      </div>
    </form>
  );
}
