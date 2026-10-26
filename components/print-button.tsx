"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Impression de la page (ou « Enregistrer en PDF » depuis la boîte d'impression du navigateur). */
export function PrintButton({ label = "Imprimer" }: { label?: string }) {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden />
      {label}
    </Button>
  );
}
